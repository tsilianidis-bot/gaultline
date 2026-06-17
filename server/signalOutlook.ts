// ============================================================
// FAULTLINE — Signal Outlook Center™  (server/signalOutlook.ts)
//
// Transforms raw signals into actionable market intelligence.
// Answers five core questions for every asset:
//   1. What is happening?
//   2. Why is it happening?
//   3. What could change it?
//   4. How does it fit the market?
//   5. What would invalidate it?
//
// Design principles:
//   • Deterministic scoring first — AI explains, never invents
//   • Strict stock/crypto separation — no cross-contamination
//   • No fabricated values — if data unavailable, say so
//   • All price levels are calculated, never invented
// ============================================================

import { invokeLLM } from "./_core/llm";
import { calculateFaultlinePressure, type FaultlinePressureOutput } from "./pressure/engine";
import { getDiagnosticReport, pressureToActionBias, classifyRegimeLabel } from "./diagnosticAI";
import { getPreFlightData } from "./preFlight";
import { LRUCache } from "./lruCache";
import { getDb } from "./db";
import { outlookHistory } from "../drizzle/schema";
import { desc, eq, and, gte } from "drizzle-orm";
import { getQuote } from "./yahooProxy";
import { getCoinMarketData } from "./coingeckoProxy";

// ── Types ─────────────────────────────────────────────────────

export type OutlookDirection = "Bullish" | "Bearish" | "Neutral" | "Avoid";
export type OutlookTimeframe = "day" | "short" | "swing" | "long";
export type OutlookRiskLevel = "Low" | "Moderate" | "High" | "Extreme";
export type OutlookDataStatus = "Live" | "Delayed" | "Cached" | "Unavailable";
export type TradeReadiness = "Cleared" | "Caution" | "Defensive";

export interface OutlookScoreFactor {
  name: string;
  score: number;       // 0–100 (higher = more bullish)
  weight: number;      // 0–1, weights sum to 1 per asset class
  label: string;       // e.g. "Strong", "Neutral", "Weak"
  note: string;        // one-line explanation
}

export interface OutlookScoreBreakdown {
  composite: number;           // 0–100 weighted composite
  factors: OutlookScoreFactor[];
}

export interface FaultlineEnvironmentContext {
  pressureIndex: number;
  pressureTrend: "Rising" | "Falling" | "Stable";
  regimeLabel: string;
  bullProbability: number;    // 0–100
  bearProbability: number;    // 0–100
  environmentImpact: string;  // AI-generated plain-English explanation
}

export interface OutlookInvalidationScenario {
  trigger: string;
  description: string;
  severity: "Minor" | "Major" | "Critical";
}

export interface OutlookScenario {
  label: "Aggressive" | "Balanced" | "Defensive";
  assets: string[];
  rationale: string;
}

export interface StockOutlookAnalysis {
  sectorStrength: number;       // 0–100
  sectorLabel: string;
  spyAlignment: "Aligned" | "Diverging" | "Opposed";
  qqqAlignment: "Aligned" | "Diverging" | "Opposed";
  relativeStrength: number;     // 0–100
  volumeTrend: "Expanding" | "Contracting" | "Neutral";
  earningsRisk: "Low" | "Moderate" | "High" | "Unknown";
  macroSensitivity: "Low" | "Moderate" | "High";
  institutionalParticipation: "High" | "Moderate" | "Low" | "Unknown";
}

export interface CryptoOutlookAnalysis {
  btcDominanceTrend: "Rising" | "Falling" | "Stable";
  btcDominanceSignal: "BTC Favored" | "Altcoin Rotation" | "Neutral";
  ethLeadership: "Leading" | "Lagging" | "Neutral";
  altRotationSignal: "Active" | "Inactive" | "Uncertain";
  liquidityEnvironment: "Risk-On" | "Neutral" | "Defensive";
  onChainContext: string | null;
  cryptoRegime: "Risk-On" | "Neutral" | "Defensive";
}

export interface DiagnosticAI2Integration {
  primaryDriver: string;
  bullCase: string;
  bearCase: string;
  portfolioImplication: string;
  sensitiveTrigger: string;
  macroPath: string;
  historicalAnalog: string;
  confidence: number;
}

export interface PreflightImpact {
  supportsThisTrade: boolean;
  opposesThisTrade: boolean;
  supportReasons: string[];
  oppositionReasons: string[];
  reviewBeforeEntering: string[];
}

export interface TradeParameterLevel {
  price: number | null;         // calculated dollar price (null if unavailable)
  pctFromEntry: number | null;  // % distance from entry price (negative = below entry)
  label: string;                // short label, e.g. "Trade Stop", "Entry Zone"
  description: string;          // e.g. "Near current price — momentum entry"
  rationale: string;            // one-line explanation of why this level matters
}

export interface TakeProfitTier {
  tier: 1 | 2 | 3;
  price: number | null;         // calculated dollar target price
  pctFromEntry: number | null;  // % gain from entry to this target
  description: string;          // e.g. "First resistance zone — partial exit"
  rationale: string;
}

export interface TradeFramework {
  available: boolean;
  noTradeRecommended: boolean;   // true when direction is Avoid or score < 30
  noTradeReason: string | null;  // explanation when noTradeRecommended is true

  // Entry
  entryZone: TradeParameterLevel | null;

  // Stop levels (3-tier, no absolute prices — described conceptually)
  tradeStop: TradeParameterLevel | null;     // tight stop for active traders
  swingStop: TradeParameterLevel | null;     // medium-term structural stop
  thesisFailure: TradeParameterLevel | null; // full invalidation level

  // Take-profit ladder (up to 3 tiers)
  takeProfitLadder: TakeProfitTier[];

  // Timeframe-specific parameters
  maxHoldTime: string;           // e.g. "1–3 days", "1–4 weeks", "1–3 months"
  idealHoldCondition: string;    // what must remain true to hold
  exitTrigger: string;           // what forces an exit regardless of price

  // Confidence & risk
  parameterConfidence: number;   // 0–100 — how reliable are these parameters
  riskRating: "Low" | "Moderate" | "High" | "Extreme";

  // Bull / bear case for this specific trade
  bullCaseForTrade: string;
  bearCaseForTrade: string;

  // Do-not-trade conditions
  doNotTradeIf: string[];

  // Legacy fields kept for backward compatibility
  explanation: string;
  dataInsufficient: boolean;
}

export interface OutlookHistoryPoint {
  snapshotAt: number;
  outlookScore: number;
  direction: OutlookDirection;
  confidence: number;
  riskLevel: OutlookRiskLevel;
}

export interface OutlookHistoryComparison {
  current: OutlookHistoryPoint;
  h24: OutlookHistoryPoint | null;
  d7: OutlookHistoryPoint | null;
  d30: OutlookHistoryPoint | null;
  trend: "Improving" | "Stable" | "Deteriorating";
}

export interface QuickOutlook {
  symbol: string;
  assetType: "stock" | "crypto";
  outlookScore: number;
  direction: OutlookDirection;
  confidence: number;
  riskLevel: OutlookRiskLevel;
  dataStatus: OutlookDataStatus;
}

export interface TopOpportunity {
  symbol: string;
  name: string;
  assetType: "stock" | "crypto";
  outlookScore: number;
  direction: OutlookDirection;
  confidence: number;
  riskLevel: OutlookRiskLevel;
  regimeAlignment: string;
  topReason: string;
}

export interface FullOutlookResult {
  // Header
  symbol: string;
  name: string;
  assetType: "stock" | "crypto";
  timeframe: OutlookTimeframe;
  generatedAt: number;
  dataStatus: OutlookDataStatus;

  // Outlook Card
  outlookScore: number;
  direction: OutlookDirection;
  confidence: number;
  riskLevel: OutlookRiskLevel;
  timeHorizon: string;
  regimeAlignment: string;
  scoreBreakdown: OutlookScoreBreakdown;

  // FAULTLINE Environment
  environment: FaultlineEnvironmentContext;

  // Why This Outlook (AI plain-English)
  whyBullish: string;
  whyBearish: string;
  mainDrivers: string[];
  momentumCondition: string;
  volumeCondition: string;
  liquidityCondition: string;
  volatilityCondition: string;
  macroCondition: string;

  // What Could Change This
  invalidationScenarios: OutlookInvalidationScenario[];

  // What Would FAULTLINE Do (scenarios — NOT advice)
  scenarios: OutlookScenario[];

  // Asset-class specific analysis
  stockAnalysis: StockOutlookAnalysis | null;    // null for crypto
  cryptoAnalysis: CryptoOutlookAnalysis | null;  // null for stocks

  // Diagnostic AI 2.0 Integration
  diagnosticIntegration: DiagnosticAI2Integration;

  // Market Preflight Integration
  preflightImpact: PreflightImpact;

  // Trade Readiness (from Situation Room / PreFlight)
  tradeReadiness: TradeReadiness;

  // Trade Framework (calculated only)
  tradeFramework: TradeFramework;

  // History comparison
  history: OutlookHistoryComparison | null;

  cached?: boolean;
}

// ── Caches ────────────────────────────────────────────────────

const fullOutlookCache = new LRUCache<string, FullOutlookResult>(50, 10 * 60 * 1000); // 10 min
const topOppsCache = new LRUCache<string, { stocks: TopOpportunity[]; crypto: TopOpportunity[] }>(4, 8 * 60 * 1000); // 8 min
const quickOutlookCache = new LRUCache<string, QuickOutlook>(200, 10 * 60 * 1000);

// ── Stock universe for top opportunities ──────────────────────

const STOCK_UNIVERSE: Array<{ symbol: string; name: string; sector: string }> = [
  { symbol: "NVDA", name: "NVIDIA Corporation",       sector: "Technology" },
  { symbol: "TSLA", name: "Tesla Inc.",                sector: "Consumer Discretionary" },
  { symbol: "META", name: "Meta Platforms Inc.",       sector: "Communication Services" },
  { symbol: "PLTR", name: "Palantir Technologies",     sector: "Technology" },
  { symbol: "AMD",  name: "Advanced Micro Devices",    sector: "Technology" },
  { symbol: "AAPL", name: "Apple Inc.",                sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corporation",     sector: "Technology" },
  { symbol: "AMZN", name: "Amazon.com Inc.",           sector: "Consumer Discretionary" },
  { symbol: "COIN", name: "Coinbase Global Inc.",      sector: "Financials" },
  { symbol: "SPY",  name: "S&P 500 ETF",               sector: "ETF" },
  { symbol: "QQQ",  name: "Nasdaq 100 ETF",            sector: "ETF" },
  { symbol: "SMCI", name: "Super Micro Computer",      sector: "Technology" },
  { symbol: "MSTR", name: "MicroStrategy Inc.",        sector: "Technology" },
  { symbol: "IONQ", name: "IonQ Inc.",                 sector: "Technology" },
  { symbol: "RKLB", name: "Rocket Lab USA",            sector: "Industrials" },
];

const CRYPTO_UNIVERSE: Array<{ symbol: string; name: string; coinId: string }> = [
  { symbol: "BTC",  name: "Bitcoin",     coinId: "bitcoin" },
  { symbol: "ETH",  name: "Ethereum",    coinId: "ethereum" },
  { symbol: "SOL",  name: "Solana",      coinId: "solana" },
  { symbol: "AVAX", name: "Avalanche",   coinId: "avalanche-2" },
  { symbol: "LINK", name: "Chainlink",   coinId: "chainlink" },
  { symbol: "ARB",  name: "Arbitrum",    coinId: "arbitrum" },
  { symbol: "TAO",  name: "Bittensor",   coinId: "bittensor" },
];

// ── Helpers ───────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function scoreToLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Moderate";
  if (score >= 35) return "Weak";
  return "Very Weak";
}

function scoreToRisk(score: number): OutlookRiskLevel {
  if (score >= 75) return "Extreme";
  if (score >= 55) return "High";
  if (score >= 35) return "Moderate";
  return "Low";
}

function scoreToDirection(score: number): OutlookDirection {
  if (score >= 65) return "Bullish";
  if (score >= 50) return "Neutral";
  if (score >= 30) return "Bearish";
  return "Avoid";
}

function pressureToBullProb(pressure: number): number {
  // Inverse relationship: high pressure = low bull probability
  return clamp(Math.round(100 - pressure * 0.85));
}

function pressureToBearProb(pressure: number): number {
  return clamp(Math.round(pressure * 0.75));
}

function timeframeLabel(tf: OutlookTimeframe): string {
  if (tf === "day")   return "Intraday";
  if (tf === "short") return "1\u20135 Days";
  if (tf === "swing") return "1\u20134 Weeks";
  return "1\u20133 Months";
}

// ── Deterministic Stock Scoring Engine ────────────────────────
// All 8 factors scored 0–100 (higher = more bullish / favorable)

function scoreStockFactors(
  symbol: string,
  pressure: FaultlinePressureOutput,
  timeframe: OutlookTimeframe
): OutlookScoreBreakdown {
  const p = pressure.overallPressure;
  const vectors = pressure.vectors;

  const getVec = (id: string) => vectors.find(v => v.id === id)?.score ?? 50;

  // Factor 1: Trend (inverse of pressure — high pressure = bearish trend)
  const trendScore = clamp(100 - p * 0.8);

  // Factor 2: Relative Strength (based on market breadth vector)
  const breadthScore = clamp(100 - getVec("market_breadth"));

  // Factor 3: Volume (based on volatility vector as proxy — high vol = volume expansion)
  const volumeScore = clamp(100 - getVec("volatility_regime") * 0.6);

  // Factor 4: Volatility (inverse — high volatility = unfavorable for entries)
  const volatilityScore = clamp(100 - getVec("volatility_regime"));

  // Factor 5: Sector Strength (based on sector leadership / AI concentration)
  const aiTechSymbols = ["NVDA", "AMD", "MSFT", "META", "GOOGL", "SMCI", "PLTR", "IONQ"];
  const isAITech = aiTechSymbols.includes(symbol.toUpperCase());
  const aiBubbleVec = getVec("ai_bubble");
  const sectorScore = isAITech
    ? clamp(100 - aiBubbleVec * 0.7)  // AI stocks penalized when bubble is elevated
    : clamp(100 - getVec("macro_sensitivity") * 0.5);

  // Factor 6: Market Breadth (direct from breadth vector)
  const breadthDirectScore = clamp(100 - getVec("market_breadth"));

  // Factor 7: Regime Alignment (how well the asset fits current regime)
  const regimeScore = clamp(100 - p * 0.75);

  // Factor 8: Market Structure (credit + liquidity conditions)
  const creditVec = getVec("credit_contagion");
  const liquidityVec = getVec("liquidity_stress");
  const structureScore = clamp(100 - (creditVec * 0.5 + liquidityVec * 0.5));

  // Timeframe adjustment — day trade amplifies momentum; longer timeframes smooth noise
  const tfMultiplier = timeframe === "day" ? 1.1 : timeframe === "short" ? 1.0 : timeframe === "swing" ? 0.9 : 0.8;

  const factors: OutlookScoreFactor[] = [
    { name: "Trend",            score: clamp(trendScore * tfMultiplier),    weight: 0.20, label: scoreToLabel(trendScore),    note: `Macro pressure at ${p}/100 — ${p > 60 ? "bearish trend conditions" : p > 40 ? "mixed trend" : "favorable trend environment"}` },
    { name: "Relative Strength",score: clamp(breadthScore * tfMultiplier),  weight: 0.15, label: scoreToLabel(breadthScore),  note: `Market breadth score ${getVec("market_breadth")}/100 — ${getVec("market_breadth") > 60 ? "narrow leadership" : "broad participation"}` },
    { name: "Volume",           score: clamp(volumeScore * tfMultiplier),   weight: 0.10, label: scoreToLabel(volumeScore),   note: `Volatility regime ${getVec("volatility_regime")}/100 — ${getVec("volatility_regime") > 60 ? "elevated volatility" : "normal volume conditions"}` },
    { name: "Volatility",       score: clamp(volatilityScore * tfMultiplier),weight: 0.10, label: scoreToLabel(volatilityScore), note: `${getVec("volatility_regime") > 70 ? "High volatility — entry risk elevated" : getVec("volatility_regime") > 40 ? "Moderate volatility" : "Low volatility — favorable for entries"}` },
    { name: "Sector Strength",  score: clamp(sectorScore * tfMultiplier),   weight: 0.15, label: scoreToLabel(sectorScore),   note: isAITech ? `AI bubble score ${aiBubbleVec}/100 — ${aiBubbleVec > 70 ? "extreme AI concentration risk" : "manageable AI exposure"}` : "Sector macro sensitivity analysis" },
    { name: "Market Breadth",   score: clamp(breadthDirectScore * tfMultiplier), weight: 0.10, label: scoreToLabel(breadthDirectScore), note: "Participation across market cap spectrum" },
    { name: "Regime Alignment", score: clamp(regimeScore * tfMultiplier),   weight: 0.10, label: scoreToLabel(regimeScore),   note: `Current regime: ${pressure.regime} — ${p > 60 ? "unfavorable for new longs" : "supportive of risk-taking"}` },
    { name: "Market Structure", score: clamp(structureScore * tfMultiplier),weight: 0.10, label: scoreToLabel(structureScore), note: `Credit ${creditVec}/100, Liquidity ${liquidityVec}/100 — ${creditVec > 60 || liquidityVec > 60 ? "structural stress present" : "stable foundation"}` },
  ];

  const composite = clamp(Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  ));

  return { composite, factors };
}

// ── Deterministic Crypto Scoring Engine ───────────────────────

function scoreCryptoFactors(
  symbol: string,
  pressure: FaultlinePressureOutput,
  timeframe: OutlookTimeframe
): OutlookScoreBreakdown {
  const p = pressure.overallPressure;
  const vectors = pressure.vectors;
  const getVec = (id: string) => vectors.find(v => v.id === id)?.score ?? 50;

  const isBTC = symbol.toUpperCase() === "BTC";
  const isETH = symbol.toUpperCase() === "ETH";
  const isLayer1 = ["BTC", "ETH", "SOL", "AVAX"].includes(symbol.toUpperCase());

  // Factor 1: Trend (macro pressure inverse)
  const trendScore = clamp(100 - p * 0.85);

  // Factor 2: BTC Dominance (BTC benefits from rising dominance, alts suffer)
  // Approximated from AI bubble vector (correlated with risk-on/risk-off)
  const aiBubble = getVec("ai_bubble");
  const btcDomScore = isBTC
    ? clamp(50 + (p - 50) * 0.3)  // BTC benefits from defensive rotation
    : clamp(100 - (p - 50) * 0.5); // Alts suffer when pressure is high

  // Factor 3: ETH Leadership
  const ethLeaderScore = isETH
    ? clamp(100 - p * 0.7)
    : clamp(100 - p * 0.8);

  // Factor 4: Alt Rotation (alts benefit from low pressure / risk-on)
  const altRotScore = isLayer1
    ? clamp(100 - p * 0.6)
    : clamp(100 - p * 0.9); // Small caps more sensitive

  // Factor 5: Liquidity Environment
  const liquidityVec = getVec("liquidity_stress");
  const liquidityScore = clamp(100 - liquidityVec);

  // Factor 6: Volatility
  const volVec = getVec("volatility_regime");
  const volatilityScore = clamp(100 - volVec);

  // Factor 7: Regime Alignment
  const regimeScore = clamp(100 - p * 0.75);

  // Factor 8: Market Structure
  const creditVec = getVec("credit_contagion");
  const structureScore = clamp(100 - (creditVec * 0.4 + liquidityVec * 0.6));

    const tfMultiplier = timeframe === "day" ? 1.1 : timeframe === "short" ? 1.0 : timeframe === "swing" ? 0.9 : 0.8;
  const factors: OutlookScoreFactor[] = [
    { name: "Trend",           score: clamp(trendScore * tfMultiplier),    weight: 0.20, label: scoreToLabel(trendScore),    note: `Macro pressure ${p}/100 — ${p > 60 ? "risk-off conditions" : "risk-on environment"}` },
    { name: "BTC Dominance",   score: clamp(btcDomScore * tfMultiplier),   weight: 0.20, label: scoreToLabel(btcDomScore),   note: isBTC ? "BTC is the defensive crypto asset" : `BTC dominance ${p > 60 ? "rising — headwind for alts" : "stable or falling — supportive"}` },
    { name: "ETH Leadership",  score: clamp(ethLeaderScore * tfMultiplier),weight: 0.10, label: scoreToLabel(ethLeaderScore), note: isETH ? "ETH as market bellwether" : `ETH ${p < 50 ? "leading — positive for ecosystem" : "lagging — ecosystem risk elevated"}` },
    { name: "Alt Rotation",    score: clamp(altRotScore * tfMultiplier),   weight: 0.15, label: scoreToLabel(altRotScore),   note: `${p < 40 ? "Active rotation into alts" : p < 60 ? "Rotation uncertain" : "Risk-off — rotation away from alts"}` },
    { name: "Liquidity",       score: clamp(liquidityScore * tfMultiplier),weight: 0.15, label: scoreToLabel(liquidityScore), note: `Liquidity stress ${liquidityVec}/100 — ${liquidityVec > 60 ? "tightening conditions" : "adequate liquidity"}` },
    { name: "Volatility",      score: clamp(volatilityScore * tfMultiplier),weight: 0.05, label: scoreToLabel(volatilityScore), note: `${volVec > 70 ? "High volatility — position sizing critical" : "Normal volatility range"}` },
    { name: "Regime Alignment",score: clamp(regimeScore * tfMultiplier),   weight: 0.10, label: scoreToLabel(regimeScore),   note: `FAULTLINE regime: ${pressure.regime}` },
    { name: "Market Structure",score: clamp(structureScore * tfMultiplier),weight: 0.05, label: scoreToLabel(structureScore), note: `Credit/liquidity foundation ${creditVec > 60 ? "stressed" : "stable"}` },
  ];

  const composite = clamp(Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  ));

  return { composite, factors };
}

// ── Stock-specific analysis ───────────────────────────────────

function buildStockAnalysis(
  symbol: string,
  pressure: FaultlinePressureOutput
): StockOutlookAnalysis {
  const p = pressure.overallPressure;
  const vectors = pressure.vectors;
  const getVec = (id: string) => vectors.find(v => v.id === id)?.score ?? 50;

  const aiTechSymbols = ["NVDA", "AMD", "MSFT", "META", "SMCI", "PLTR", "IONQ", "MSTR"];
  const isAITech = aiTechSymbols.includes(symbol.toUpperCase());
  const aiBubble = getVec("ai_bubble");

  const sectorStrength = isAITech
    ? clamp(100 - aiBubble * 0.7)
    : clamp(100 - p * 0.5);

  const sectorLabel = isAITech
    ? (aiBubble > 70 ? "AI/Tech — Extreme Bubble Risk" : aiBubble > 50 ? "AI/Tech — Elevated" : "AI/Tech — Moderate")
    : (p > 60 ? "Defensive positioning favored" : "Growth sectors supported");

  const spyAlignment: "Aligned" | "Diverging" | "Opposed" =
    p < 40 ? "Aligned" : p < 65 ? "Diverging" : "Opposed";

  const qqqAlignment: "Aligned" | "Diverging" | "Opposed" =
    isAITech && aiBubble > 70 ? "Opposed" : p < 50 ? "Aligned" : "Diverging";

  const relativeStrength = clamp(100 - getVec("market_breadth") * 0.6);
  const volumeTrend: "Expanding" | "Contracting" | "Neutral" =
    getVec("volatility_regime") > 65 ? "Expanding" : getVec("volatility_regime") < 35 ? "Contracting" : "Neutral";

  const earningsRisk: "Low" | "Moderate" | "High" | "Unknown" = "Unknown"; // No earnings date data available
  const macroSensitivity: "Low" | "Moderate" | "High" =
    isAITech ? "High" : p > 60 ? "High" : p > 40 ? "Moderate" : "Low";

  const institutionalParticipation: "High" | "Moderate" | "Low" | "Unknown" =
    ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN", "META"].includes(symbol.toUpperCase())
      ? "High"
      : "Unknown";

  return {
    sectorStrength,
    sectorLabel,
    spyAlignment,
    qqqAlignment,
    relativeStrength,
    volumeTrend,
    earningsRisk,
    macroSensitivity,
    institutionalParticipation,
  };
}

// ── Crypto-specific analysis ──────────────────────────────────

function buildCryptoAnalysis(
  symbol: string,
  pressure: FaultlinePressureOutput
): CryptoOutlookAnalysis {
  const p = pressure.overallPressure;
  const vectors = pressure.vectors;
  const getVec = (id: string) => vectors.find(v => v.id === id)?.score ?? 50;
  const liquidityVec = getVec("liquidity_stress");

  const btcDominanceTrend: "Rising" | "Falling" | "Stable" =
    p > 60 ? "Rising" : p < 40 ? "Falling" : "Stable";

  const btcDominanceSignal: "BTC Favored" | "Altcoin Rotation" | "Neutral" =
    p > 60 ? "BTC Favored" : p < 40 ? "Altcoin Rotation" : "Neutral";

  const ethLeadership: "Leading" | "Lagging" | "Neutral" =
    symbol.toUpperCase() === "ETH" ? "Leading" : p < 50 ? "Leading" : "Lagging";

  const altRotationSignal: "Active" | "Inactive" | "Uncertain" =
    p < 40 ? "Active" : p > 65 ? "Inactive" : "Uncertain";

  const liquidityEnvironment: "Risk-On" | "Neutral" | "Defensive" =
    liquidityVec > 65 ? "Defensive" : liquidityVec < 35 ? "Risk-On" : "Neutral";

  const cryptoRegime: "Risk-On" | "Neutral" | "Defensive" =
    p < 40 ? "Risk-On" : p > 65 ? "Defensive" : "Neutral";

  return {
    btcDominanceTrend,
    btcDominanceSignal,
    ethLeadership,
    altRotationSignal,
    liquidityEnvironment,
    onChainContext: null, // Not available without on-chain data provider
    cryptoRegime,
  };
}

// ── Trade Framework (calculated only) ────────────────────────

function buildTradeFramework(
  scoreBreakdown: OutlookScoreBreakdown,
  direction: OutlookDirection,
  timeframe: OutlookTimeframe,
  assetType: "stock" | "crypto",
  pressure: FaultlinePressureOutput,
  livePrice?: number | null,
  priceHigh?: number | null,
  priceLow?: number | null
): TradeFramework {
  const p = pressure.overallPressure;
  const score = scoreBreakdown.composite;
  const isHighPressure = p > 60;
  const isCrypto = assetType === "crypto";

  // ── No-trade gate ────────────────────────────────────────────
  if (direction === "Avoid" || score < 30) {
    const reasons: string[] = [];
    if (direction === "Avoid") reasons.push(`Outlook direction is Avoid — no trade setup exists`);
    if (score < 30) reasons.push(`Outlook score ${score}/100 is below the minimum threshold for a trade framework`);
    if (isHighPressure) reasons.push(`FAULTLINE Pressure Index at ${p}/100 — systemic risk is elevated`);
    return {
      available: false,
      noTradeRecommended: true,
      noTradeReason: reasons.join(". "),
      entryZone: null,
      tradeStop: null,
      swingStop: null,
      thesisFailure: null,
      takeProfitLadder: [],
      maxHoldTime: "N/A",
      idealHoldCondition: "N/A — no trade recommended",
      exitTrigger: "Do not enter",
      parameterConfidence: 0,
      riskRating: "Extreme",
      bullCaseForTrade: "No bull case — outlook is Avoid",
      bearCaseForTrade: `Score ${score}/100 with ${direction} direction indicates high risk of loss`,
      doNotTradeIf: reasons,
      explanation: reasons.join(". "),
      dataInsufficient: false,
    };
  }

  // ── Timeframe parameters ─────────────────────────────────────
  const tfParams: Record<OutlookTimeframe, {
    maxHold: string;
    entryDesc: string;
    entryRationale: string;
    tradeStopDesc: string;
    tradeStopRationale: string;
    swingStopDesc: string;
    swingStopRationale: string;
    thesisDesc: string;
    thesisRationale: string;
    tp1Desc: string; tp1Rationale: string;
    tp2Desc: string; tp2Rationale: string;
    tp3Desc: string; tp3Rationale: string;
    holdCondition: string;
    exitTrigger: string;
  }> = {
    day: {
      maxHold: "Same session (close before market close)",
      entryDesc: isCrypto
        ? "Near current price during the first 30 minutes of the session — wait for opening range to establish"
        : "Within the opening range (first 30 minutes) — enter on a confirmed breakout above the opening high",
      entryRationale: "Day trades require momentum confirmation at the open; entering before the range is established increases whipsaw risk",
      tradeStopDesc: isCrypto
        ? "Below the opening range low or the 15-minute VWAP — whichever is tighter"
        : "Below the opening range low — a break here signals the intraday thesis has failed",
      tradeStopRationale: "Intraday stops must be tight; the opening range low is the key structural level for day trades",
      swingStopDesc: "Below the prior day's low — a close below this level means the broader intraday structure is broken",
      swingStopRationale: "Prior day's low is the intraday swing stop; breaching it typically means the session is trending against the trade",
      thesisDesc: "Below the prior week's low — if price reaches here on an intraday trade, the setup has completely failed",
      thesisRationale: "Thesis failure for a day trade is a full structural breakdown; exit immediately with no averaging down",
      tp1Desc: "First intraday resistance (prior day's high or a key intraday pivot)",
      tp1Rationale: "Take partial profits at the first resistance; this locks in gains and reduces risk on the remaining position",
      tp2Desc: "Second intraday resistance or a measured move equal to the opening range height",
      tp2Rationale: "Measured move targets are the most reliable intraday TP levels; they represent the natural extension of the opening range",
      tp3Desc: "Extended target at 2x the opening range height — only reached on high-momentum days",
      tp3Rationale: "Extended targets require strong volume confirmation; reduce size significantly before this level",
      holdCondition: "Price remains above VWAP and volume is expanding; momentum indicators are not diverging",
      exitTrigger: "Price closes below VWAP on 15-minute chart, or market close — whichever comes first",
    },
    short: {
      maxHold: "1–5 trading days",
      entryDesc: isCrypto
        ? "On a pullback to the nearest support level or after a confirmed breakout above recent resistance"
        : "On a pullback to the 5-day moving average or after a confirmed break above the prior week's high",
      entryRationale: "Short-term entries require a defined catalyst; chasing price without a pullback increases the cost basis unnecessarily",
      tradeStopDesc: isCrypto
        ? "Below the most recent swing low (last 3–5 days) — a break here signals the short-term momentum has reversed"
        : "Below the prior day's low or the 5-day moving average — whichever is closer to entry",
      tradeStopRationale: "Short-term stops should be placed at the nearest structural low to keep the risk-reward ratio favorable",
      swingStopDesc: isCrypto
        ? "Below the 10-day moving average — a close below signals the short-term trend has changed"
        : "Below the 10-day moving average or the prior week's low",
      swingStopRationale: "The 10-day MA is the key trend indicator for short-term trades; a close below it means the setup is no longer valid",
      thesisDesc: "Below the prior 2-week low — a breach here means the short-term bullish thesis has failed completely",
      thesisRationale: "Thesis failure for a short-term trade is a 2-week structural breakdown; exit without hesitation",
      tp1Desc: "Prior week's high or the nearest resistance level",
      tp1Rationale: "Take 30–50% off at the first resistance to lock in gains; this is where most short-term moves stall",
      tp2Desc: "Next resistance level or a 1:2 risk-reward target from entry",
      tp2Rationale: "A 1:2 R:R is the minimum acceptable for short-term trades; this tier captures the bulk of the move",
      tp3Desc: "Extended target at 1:3 R:R — only reached on strong momentum with expanding volume",
      tp3Rationale: "Extended targets require volume confirmation; trail stop aggressively if price reaches this level",
      holdCondition: "Price remains above the 5-day moving average and FAULTLINE pressure is not rising sharply",
      exitTrigger: "Price closes below the 5-day MA, or FAULTLINE Pressure Index rises above 70, or the catalyst that drove the trade is invalidated",
    },
    swing: {
      maxHold: "1–4 weeks",
      entryDesc: isCrypto
        ? "On a pullback to the 20-day moving average or a key support level — wait for a daily close above the level before entering"
        : "On a pullback to the 20-day moving average or a prior breakout level — enter on the first close back above the level",
      entryRationale: "Swing entries require patience; entering on the first close above a key level reduces the risk of a false breakout",
      tradeStopDesc: isCrypto
        ? "Below the most recent weekly swing low — a close below signals the swing trade has failed"
        : "Below the most recent weekly low or the 20-day moving average",
      tradeStopRationale: "Swing stops should be placed at weekly structural lows; this gives the trade room to breathe while protecting against a trend reversal",
      swingStopDesc: isCrypto
        ? "Below the 50-day moving average — a weekly close below this level signals a medium-term trend change"
        : "Below the 50-day moving average or the prior month's low",
      swingStopRationale: "The 50-day MA is the key trend indicator for swing trades; a weekly close below it means the medium-term trend has changed",
      thesisDesc: "Below the prior 4-week low — a breach here means the swing trade thesis has completely failed",
      thesisRationale: "Thesis failure for a swing trade is a monthly structural breakdown; this level should never be reached if stops are respected",
      tp1Desc: "Prior month's high or the nearest weekly resistance level",
      tp1Rationale: "Take 25–40% off at the first monthly resistance; this is where swing moves typically consolidate",
      tp2Desc: "Next major resistance level or a 1:2 risk-reward target from entry",
      tp2Rationale: "The 1:2 R:R tier captures the core of most swing moves; trail stop to breakeven after this level",
      tp3Desc: "Extended target at 1:3 R:R — only reached on strong fundamental catalysts or regime shifts",
      tp3Rationale: "Extended swing targets require a fundamental driver; reduce size to 25% of original position at this level",
      holdCondition: "Price remains above the 20-day MA, FAULTLINE pressure is stable or falling, and the original catalyst remains intact",
      exitTrigger: "Weekly close below the 20-day MA, FAULTLINE Pressure Index rises above 65, or the original catalyst is invalidated",
    },
    long: {
      maxHold: "1–3 months",
      entryDesc: isCrypto
        ? "On a significant pullback to the 50-day or 200-day moving average — enter only after a weekly close above the level"
        : "On a pullback to the 50-day moving average or a prior quarterly breakout level — enter on a monthly close above the level",
      entryRationale: "Long-term entries require major structural confirmation; a monthly close above a key level is the minimum requirement",
      tradeStopDesc: isCrypto
        ? "Below the 50-day moving average — a monthly close below signals the long-term trend is in question"
        : "Below the 50-day moving average or the prior quarter's low",
      tradeStopRationale: "Long-term stops should be placed at major structural levels; the 50-day MA is the minimum stop for a long-term position",
      swingStopDesc: isCrypto
        ? "Below the 200-day moving average — a monthly close below signals a major trend reversal"
        : "Below the 200-day moving average or the prior 6-month low",
      swingStopRationale: "The 200-day MA is the ultimate trend indicator; a monthly close below it signals a major bear market",
      thesisDesc: "Below the prior 3-month low — a breach here means the long-term investment thesis has fundamentally changed",
      thesisRationale: "Thesis failure for a long-term position requires a complete re-evaluation of the fundamental case",
      tp1Desc: "Prior quarterly high or the nearest major resistance level",
      tp1Rationale: "Take 20–30% off at the first quarterly resistance; long-term positions should be managed in tranches",
      tp2Desc: "Next major resistance level or a 1:2 risk-reward target from entry",
      tp2Rationale: "The 1:2 R:R tier represents a significant move for a long-term position; trail stop to breakeven after this level",
      tp3Desc: "Extended target at 1:3 R:R or the prior all-time high area",
      tp3Rationale: "Extended long-term targets require fundamental confirmation; reduce size to 25% of original position at this level",
      holdCondition: "Price remains above the 50-day MA, FAULTLINE pressure is below 60, and the fundamental thesis remains intact",
      exitTrigger: "Monthly close below the 50-day MA, FAULTLINE Pressure Index rises above 70 and stays elevated for 2+ weeks, or a fundamental change in the investment thesis",
    },
  };

  const tf = tfParams[timeframe];

  // ── Do-not-trade conditions ───────────────────────────────────
  const doNotTradeIf: string[] = [];
  if (isHighPressure) doNotTradeIf.push(`FAULTLINE Pressure Index is at ${p}/100 — systemic risk is elevated; reduce position size or wait for pressure to fall below 60`);
  if (direction === "Bearish") doNotTradeIf.push("Outlook direction is Bearish — this is a short setup, not a long entry; do not buy into a bearish outlook");
  if (direction === "Neutral") doNotTradeIf.push("Outlook direction is Neutral — wait for a directional signal before entering");
  if (score < 50) doNotTradeIf.push(`Outlook score is ${score}/100 — below 50 means the balance of evidence does not support a high-conviction entry`);
  if (timeframe === "day" && p > 50) doNotTradeIf.push("Day trading in elevated pressure environments amplifies risk; consider reducing size by 50% or skipping the session");
  if (isCrypto && p > 55) doNotTradeIf.push("Crypto is highly sensitive to macro pressure; a pressure index above 55 significantly increases the risk of sharp reversals");

  // ── Confidence ───────────────────────────────────────────────
  const baseConfidence = score;
  const pressurePenalty = isHighPressure ? 20 : p > 45 ? 10 : 0;
  const timeframePenalty = timeframe === "day" ? 10 : timeframe === "long" ? 5 : 0;
  const parameterConfidence = Math.max(10, Math.min(95, baseConfidence - pressurePenalty - timeframePenalty));

  // ── Risk rating ───────────────────────────────────────────────
  const riskRating: TradeFramework["riskRating"] = p > 65 ? "Extreme" : p > 50 ? "High" : p > 35 ? "Moderate" : "Low";

    // ── Bull / bear case for this specific trade ─────────────────
  const topFactor = [...scoreBreakdown.factors].sort((a, b) => b.score - a.score)[0];
  const bottomFactor = [...scoreBreakdown.factors].sort((a, b) => a.score - b.score)[0];
  const bullCaseForTrade = `${topFactor?.name ?? "Momentum"} is the strongest factor at ${topFactor?.score ?? score}/100. ${tf.holdCondition}.`;
  const bearCaseForTrade = `${bottomFactor?.name ?? "Macro"} is the primary headwind at ${bottomFactor?.score ?? 50}/100. ${isHighPressure ? `FAULTLINE pressure at ${p}/100 adds systemic risk.` : "Monitor for deterioration in macro conditions."}`;

  // ── ATR-based price level calculations ───────────────────────
  // Use live price data when available; fall back to null prices gracefully.
  const hasPrice = livePrice != null && livePrice > 0;
  const entry = hasPrice ? livePrice! : null;
  const high = priceHigh != null && priceHigh > 0 ? priceHigh! : (entry ?? 0) * 1.01;
  const low  = priceLow  != null && priceLow  > 0 ? priceLow!  : (entry ?? 0) * 0.99;

  // ATR: use single-bar (high - low) as fallback; clamp to minimum 0.5% of price
  const rawAtr = high - low;
  const atr = entry ? Math.max(rawAtr, entry * 0.005) : 0;

  const isBull = direction === "Bullish" || direction === "Neutral";
  const fmt2 = (n: number) => parseFloat(n.toFixed(2));
  const fmtPct = (price: number, ref: number) => parseFloat(((price - ref) / ref * 100).toFixed(1));

  // ── Per-timeframe ATR multipliers ─────────────────────────────
  // Day:   tighter stops (0.5× ATR), smaller TP targets (0.5–1.5× ATR)
  // Short: standard stops (0.75× ATR), TP1 1:1, TP2 2:1, TP3 3:1
  // Swing: full 3-tier stops, TP ladder 1:1 / 2:1 / 3:1
  // Long:  wider stops (1.5× ATR), larger TP targets (2–5× ATR)
  let calcEntry: number | null = null;
  let calcTradeStop: number | null = null;
  let calcSwingStop: number | null = null;
  let calcThesisFailure: number | null = null;
  let calcTp1: number | null = null;
  let calcTp2: number | null = null;
  let calcTp3: number | null = null;

  if (entry && atr > 0) {
    calcEntry = fmt2(entry);

    if (timeframe === "day") {
      // Day trade: very tight stops, quick TP targets
      const stopDist = atr * 0.5;
      const tp1Dist  = atr * 0.5;
      const tp2Dist  = atr * 1.0;
      const tp3Dist  = atr * 1.5;
      if (isBull) {
        calcTradeStop    = fmt2(Math.max(entry * 0.96, entry - stopDist));
        calcSwingStop    = fmt2(Math.max(entry * 0.93, entry - atr * 0.75));
        calcThesisFailure = fmt2(Math.max(entry * 0.90, entry - atr * 1.0));
        calcTp1 = fmt2(entry + tp1Dist);
        calcTp2 = fmt2(entry + tp2Dist);
        calcTp3 = fmt2(entry + tp3Dist);
      } else {
        calcTradeStop    = fmt2(Math.min(entry * 1.04, entry + stopDist));
        calcSwingStop    = fmt2(Math.min(entry * 1.07, entry + atr * 0.75));
        calcThesisFailure = fmt2(Math.min(entry * 1.10, entry + atr * 1.0));
        calcTp1 = fmt2(entry - tp1Dist);
        calcTp2 = fmt2(entry - tp2Dist);
        calcTp3 = fmt2(entry - tp3Dist);
      }
    } else if (timeframe === "short") {
      // Short-term: 0.75× ATR trade stop, 1:1 / 2:1 / 3:1 TP ladder
      const rawTradeStop = low - atr * 0.75;
      const rawSwingStop = low - atr * 1.5;
      const rawThesis    = low - atr * 2.5;
      if (isBull) {
        calcTradeStop    = fmt2(Math.min(entry * 0.96, Math.max(entry * 0.85, rawTradeStop)));
        calcSwingStop    = fmt2(Math.min(entry * 0.92, Math.max(entry * 0.80, rawSwingStop)));
        calcThesisFailure = fmt2(Math.min(entry * 0.88, Math.max(entry * 0.70, rawThesis)));
        const risk = entry - calcTradeStop;
        calcTp1 = fmt2(entry + risk * 1);
        calcTp2 = fmt2(entry + risk * 2);
        calcTp3 = fmt2(entry + risk * 3);
      } else {
        calcTradeStop    = fmt2(Math.max(entry * 1.04, Math.min(entry * 1.15, high + atr * 0.75)));
        calcSwingStop    = fmt2(Math.max(entry * 1.08, Math.min(entry * 1.20, high + atr * 1.5)));
        calcThesisFailure = fmt2(Math.max(entry * 1.12, Math.min(entry * 1.30, high + atr * 2.5)));
        const risk = calcTradeStop - entry;
        calcTp1 = fmt2(entry - risk * 1);
        calcTp2 = fmt2(entry - risk * 2);
        calcTp3 = fmt2(entry - risk * 3);
      }
    } else if (timeframe === "swing") {
      // Swing: full 3-tier stops, 1:1 / 2:1 / 3:1 TP ladder
      const rawTradeStop = low - atr * 0.75;
      const rawSwingStop = low - atr * 1.5;
      const rawThesis    = low - atr * 2.5;
      if (isBull) {
        calcTradeStop    = fmt2(Math.min(entry * 0.95, Math.max(entry * 0.85, rawTradeStop)));
        calcSwingStop    = fmt2(Math.min(entry * 0.90, Math.max(entry * 0.75, rawSwingStop)));
        calcThesisFailure = fmt2(Math.min(entry * 0.82, Math.max(entry * 0.60, rawThesis)));
        const risk = entry - calcTradeStop;
        calcTp1 = fmt2(entry + risk * 1);
        calcTp2 = fmt2(entry + risk * 2);
        calcTp3 = fmt2(entry + risk * 3);
      } else {
        calcTradeStop    = fmt2(Math.max(entry * 1.05, Math.min(entry * 1.15, high + atr * 0.75)));
        calcSwingStop    = fmt2(Math.max(entry * 1.10, Math.min(entry * 1.25, high + atr * 1.5)));
        calcThesisFailure = fmt2(Math.max(entry * 1.18, Math.min(entry * 1.40, high + atr * 2.5)));
        const risk = calcTradeStop - entry;
        calcTp1 = fmt2(entry - risk * 1);
        calcTp2 = fmt2(entry - risk * 2);
        calcTp3 = fmt2(entry - risk * 3);
      }
    } else {
      // Long-term: wider stops (1.5× ATR), larger TP targets (2–5× ATR)
      const rawTradeStop = low - atr * 1.5;
      const rawSwingStop = low - atr * 2.5;
      const rawThesis    = low - atr * 4.0;
      if (isBull) {
        calcTradeStop    = fmt2(Math.min(entry * 0.93, Math.max(entry * 0.80, rawTradeStop)));
        calcSwingStop    = fmt2(Math.min(entry * 0.88, Math.max(entry * 0.70, rawSwingStop)));
        calcThesisFailure = fmt2(Math.min(entry * 0.80, Math.max(entry * 0.50, rawThesis)));
        const risk = entry - calcTradeStop;
        calcTp1 = fmt2(entry + risk * 1.5);
        calcTp2 = fmt2(entry + risk * 3.0);
        calcTp3 = fmt2(entry + risk * 5.0);
      } else {
        calcTradeStop    = fmt2(Math.max(entry * 1.07, Math.min(entry * 1.20, high + atr * 1.5)));
        calcSwingStop    = fmt2(Math.max(entry * 1.12, Math.min(entry * 1.30, high + atr * 2.5)));
        calcThesisFailure = fmt2(Math.max(entry * 1.20, Math.min(entry * 1.50, high + atr * 4.0)));
        const risk = calcTradeStop - entry;
        calcTp1 = fmt2(entry - risk * 1.5);
        calcTp2 = fmt2(entry - risk * 3.0);
        calcTp3 = fmt2(entry - risk * 5.0);
      }
    }
  }

  // R:R ratio using Trade Stop as primary risk measure
  const rrRatio = (calcEntry && calcTradeStop && calcTp1)
    ? parseFloat((Math.abs(calcTp1 - calcEntry) / Math.abs(calcTradeStop - calcEntry)).toFixed(1))
    : null;

  return {
    available: true,
    noTradeRecommended: false,
    noTradeReason: null,
    entryZone: {
      price: calcEntry,
      pctFromEntry: calcEntry ? 0 : null,
      label: "Entry Zone",
      description: tf.entryDesc,
      rationale: tf.entryRationale,
    },
    tradeStop: {
      price: calcTradeStop,
      pctFromEntry: (calcEntry && calcTradeStop) ? fmtPct(calcTradeStop, calcEntry) : null,
      label: "Trade Stop",
      description: tf.tradeStopDesc,
      rationale: tf.tradeStopRationale,
    },
    swingStop: {
      price: calcSwingStop,
      pctFromEntry: (calcEntry && calcSwingStop) ? fmtPct(calcSwingStop, calcEntry) : null,
      label: "Swing Stop",
      description: tf.swingStopDesc,
      rationale: tf.swingStopRationale,
    },
    thesisFailure: {
      price: calcThesisFailure,
      pctFromEntry: (calcEntry && calcThesisFailure) ? fmtPct(calcThesisFailure, calcEntry) : null,
      label: "Thesis Failure",
      description: tf.thesisDesc,
      rationale: tf.thesisRationale,
    },
    takeProfitLadder: [
      {
        tier: 1,
        price: calcTp1,
        pctFromEntry: (calcEntry && calcTp1) ? fmtPct(calcTp1, calcEntry) : null,
        description: tf.tp1Desc,
        rationale: tf.tp1Rationale,
      },
      {
        tier: 2,
        price: calcTp2,
        pctFromEntry: (calcEntry && calcTp2) ? fmtPct(calcTp2, calcEntry) : null,
        description: tf.tp2Desc,
        rationale: tf.tp2Rationale,
      },
      {
        tier: 3,
        price: calcTp3,
        pctFromEntry: (calcEntry && calcTp3) ? fmtPct(calcTp3, calcEntry) : null,
        description: tf.tp3Desc,
        rationale: tf.tp3Rationale,
      },
    ],
    maxHoldTime: tf.maxHold,
    idealHoldCondition: tf.holdCondition,
    exitTrigger: tf.exitTrigger,
    parameterConfidence,
    riskRating,
    bullCaseForTrade,
    bearCaseForTrade,
    doNotTradeIf,
    explanation: `${direction} outlook with ${score}/100 conviction. ${tf.maxHold} timeframe.${rrRatio ? ` R:R ratio ${rrRatio}:1.` : ""} ${doNotTradeIf.length > 0 ? "Caution: " + doNotTradeIf[0] : "Conditions are acceptable for entry."}`,
    dataInsufficient: !hasPrice,
  };
}

// ── Preflight Impact ──────────────────────────────────────────

async function buildPreflightImpact(
  direction: OutlookDirection,
  pressure: FaultlinePressureOutput
): Promise<PreflightImpact> {
  const p = pressure.overallPressure;
  const isBullish = direction === "Bullish";
  const isHighPressure = p > 60;

  const supportReasons: string[] = [];
  const oppositionReasons: string[] = [];
  const reviewBeforeEntering: string[] = [];

  if (isBullish && !isHighPressure) {
    supportReasons.push("Macro pressure is below elevated threshold — supports risk-taking");
    supportReasons.push("Regime conditions align with bullish outlook");
  }
  if (isHighPressure) {
    oppositionReasons.push(`Macro pressure at ${p}/100 — elevated systemic risk`);
    oppositionReasons.push("High-pressure environments historically increase drawdown risk");
    reviewBeforeEntering.push("Review current pressure index reading before entry");
    reviewBeforeEntering.push("Confirm position sizing accounts for elevated volatility");
  }
  if (direction === "Bearish" || direction === "Avoid") {
    oppositionReasons.push("Outlook direction conflicts with entering a long position");
    reviewBeforeEntering.push("Consider whether this is a short setup or an avoidance signal");
  }

  reviewBeforeEntering.push("Complete Market Preflight™ before entering any position");
  reviewBeforeEntering.push("Verify stop-loss levels using the Sizing Calculator");

  return {
    supportsThisTrade: supportReasons.length > 0,
    opposesThisTrade: oppositionReasons.length > 0,
    supportReasons,
    oppositionReasons,
    reviewBeforeEntering,
  };
}

// ── Invalidation Scenarios ────────────────────────────────────

function buildInvalidationScenarios(
  assetType: "stock" | "crypto",
  direction: OutlookDirection,
  pressure: FaultlinePressureOutput
): OutlookInvalidationScenario[] {
  const scenarios: OutlookInvalidationScenario[] = [];
  const p = pressure.overallPressure;

  if (assetType === "stock") {
    scenarios.push({
      trigger: "Price Breakdown",
      description: "Asset closes below key support level on elevated volume — structural breakdown invalidates bullish thesis",
      severity: "Major",
    });
    scenarios.push({
      trigger: "Earnings Miss",
      description: "Significant earnings miss or guidance cut shifts fundamental picture — re-evaluate position sizing",
      severity: "Major",
    });
    scenarios.push({
      trigger: "Volume Collapse",
      description: "Sustained decline in volume on up days signals institutional distribution — momentum thesis fails",
      severity: "Minor",
    });
    scenarios.push({
      trigger: "Macro Deterioration",
      description: `FAULTLINE Pressure Index rises above 70 — systemic stress overrides individual stock setups`,
      severity: p > 55 ? "Critical" : "Major",
    });
    scenarios.push({
      trigger: "Regime Shift",
      description: "FAULTLINE regime shifts from current state to Bear — all long positions require reassessment",
      severity: "Critical",
    });
  } else {
    scenarios.push({
      trigger: "BTC Weakness",
      description: "Bitcoin loses key support — historically triggers broad crypto selloff regardless of individual coin setup",
      severity: "Critical",
    });
    scenarios.push({
      trigger: "Alt Weakness",
      description: "Broad altcoin market cap decline signals risk-off rotation — individual coin setups become unreliable",
      severity: "Major",
    });
    scenarios.push({
      trigger: "Liquidity Withdrawal",
      description: "Stablecoin supply contraction or exchange outflows signal institutional exit — liquidity thesis fails",
      severity: "Major",
    });
    scenarios.push({
      trigger: "Macro Deterioration",
      description: "Rising macro pressure index correlates with crypto risk-off — defensive positioning required",
      severity: p > 55 ? "Critical" : "Major",
    });
    scenarios.push({
      trigger: "Regulatory Event",
      description: "Unexpected regulatory action in major market — sentiment override regardless of technical setup",
      severity: "Critical",
    });
  }

  return scenarios;
}

// ── Scenario Analysis (NOT advice) ───────────────────────────

function buildScenarios(
  assetType: "stock" | "crypto",
  symbol: string,
  direction: OutlookDirection,
  pressure: FaultlinePressureOutput
): OutlookScenario[] {
  const p = pressure.overallPressure;

  if (assetType === "stock") {
    return [
      {
        label: "Aggressive",
        assets: p < 50 ? ["NVDA", "PLTR", "AMD", "TSLA"] : ["COIN", "MSTR"],
        rationale: p < 50
          ? "Low macro pressure supports higher-beta growth exposure. AI and momentum names benefit from risk-on conditions."
          : "Elevated pressure limits aggressive positioning. Only highest-conviction setups with tight stops.",
      },
      {
        label: "Balanced",
        assets: ["AAPL", "MSFT", "AMZN", "SPY"],
        rationale: "Large-cap quality names with strong balance sheets and diversified revenue streams. SPY provides broad market exposure with built-in diversification.",
      },
      {
        label: "Defensive",
        assets: p > 60 ? ["SPY", "QQQ"] : ["SPY"],
        rationale: p > 60
          ? "Elevated pressure warrants index-only exposure. Individual stock risk elevated. Reduce position sizes."
          : "Defensive positioning via broad index ETFs. Preserves capital while maintaining market exposure.",
      },
    ];
  } else {
    return [
      {
        label: "Aggressive",
        assets: p < 50 ? ["SOL", "AVAX", "TAO", "LINK"] : ["ETH"],
        rationale: p < 50
          ? "Risk-on conditions support high-beta altcoin exposure. Layer 1 alternatives and AI-adjacent tokens benefit from rotation."
          : "Elevated macro pressure limits aggressive crypto positioning. ETH as the only aggressive option in stressed conditions.",
      },
      {
        label: "Balanced",
        assets: ["ETH", "BTC"],
        rationale: "ETH and BTC provide crypto exposure with the highest liquidity and institutional participation. Core holdings for any crypto allocation.",
      },
      {
        label: "Defensive",
        assets: p > 60 ? ["BTC", "Stablecoins"] : ["BTC"],
        rationale: p > 60
          ? "High macro pressure — BTC as the defensive crypto asset. Stablecoin allocation preserves capital during risk-off periods."
          : "BTC as the lowest-risk crypto exposure. Defensive positioning while maintaining crypto market presence.",
      },
    ];
  }
}

// ── AI Interpretation Layer ───────────────────────────────────

async function generateOutlookInterpretation(
  symbol: string,
  assetType: "stock" | "crypto",
  direction: OutlookDirection,
  scoreBreakdown: OutlookScoreBreakdown,
  pressure: FaultlinePressureOutput,
  timeframe: OutlookTimeframe
): Promise<{
  whyBullish: string;
  whyBearish: string;
  mainDrivers: string[];
  momentumCondition: string;
  volumeCondition: string;
  liquidityCondition: string;
  volatilityCondition: string;
  macroCondition: string;
  diagnosticIntegration: DiagnosticAI2Integration;
  environmentImpact: string;
}> {
  const p = pressure.overallPressure;
  const regimeLabel = classifyRegimeLabel(p);
  const topFactors = [...scoreBreakdown.factors].sort((a, b) => b.score - a.score);
  const bottomFactors = [...scoreBreakdown.factors].sort((a, b) => a.score - b.score);

  const prompt = `You are FAULTLINE's Signal Outlook AI. Provide plain-English market intelligence for ${symbol} (${assetType.toUpperCase()}).

CURRENT DATA:
- FAULTLINE Pressure Index: ${p}/100 (${regimeLabel})
- Outlook Direction: ${direction}
- Outlook Score: ${scoreBreakdown.composite}/100
- Timeframe: ${timeframe === "day" ? "Day Trade (Intraday)" : timeframe === "short" ? "Short-Term (1-5 days)" : timeframe === "swing" ? "Swing (1-4 weeks)" : "Long-Term (1-3 months)"}
- Top Bullish Factor: ${topFactors[0]?.name} (${topFactors[0]?.score}/100) — ${topFactors[0]?.note}
- Top Bearish Factor: ${bottomFactors[0]?.name} (${bottomFactors[0]?.score}/100) — ${bottomFactors[0]?.note}
- Regime: ${pressure.regime}

Write in plain English. No jargon. No financial advice. No specific price targets. No entry/exit recommendations.
Be direct and specific. Use short sentences.

Respond with JSON matching this exact schema:
{
  "whyBullish": "2-3 sentence explanation of what supports a bullish case",
  "whyBearish": "2-3 sentence explanation of what supports a bearish case",
  "mainDrivers": ["driver 1", "driver 2", "driver 3"],
  "momentumCondition": "1 sentence on momentum",
  "volumeCondition": "1 sentence on volume",
  "liquidityCondition": "1 sentence on liquidity",
  "volatilityCondition": "1 sentence on volatility",
  "macroCondition": "1 sentence on macro environment",
  "primaryDriver": "The single most important factor driving this outlook",
  "bullCase": "2 sentence bull case",
  "bearCase": "2 sentence bear case",
  "portfolioImplication": "1 sentence on what this means for a portfolio",
  "sensitiveTrigger": "The single event that would most change this outlook",
  "macroPath": "1 sentence on the macro path forward",
  "historicalAnalog": "Brief historical comparison if relevant, or 'No clear analog'",
  "diagnosticConfidence": 65,
  "environmentImpact": "2 sentences on how the current FAULTLINE environment specifically impacts ${symbol}"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a professional market intelligence analyst. Respond only with valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "outlook_interpretation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              whyBullish: { type: "string" },
              whyBearish: { type: "string" },
              mainDrivers: { type: "array", items: { type: "string" } },
              momentumCondition: { type: "string" },
              volumeCondition: { type: "string" },
              liquidityCondition: { type: "string" },
              volatilityCondition: { type: "string" },
              macroCondition: { type: "string" },
              primaryDriver: { type: "string" },
              bullCase: { type: "string" },
              bearCase: { type: "string" },
              portfolioImplication: { type: "string" },
              sensitiveTrigger: { type: "string" },
              macroPath: { type: "string" },
              historicalAnalog: { type: "string" },
              diagnosticConfidence: { type: "number" },
              environmentImpact: { type: "string" },
            },
            required: ["whyBullish", "whyBearish", "mainDrivers", "momentumCondition", "volumeCondition", "liquidityCondition", "volatilityCondition", "macroCondition", "primaryDriver", "bullCase", "bearCase", "portfolioImplication", "sensitiveTrigger", "macroPath", "historicalAnalog", "diagnosticConfidence", "environmentImpact"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices?.[0]?.message?.content;
    const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));

    return {
      whyBullish: parsed.whyBullish,
      whyBearish: parsed.whyBearish,
      mainDrivers: parsed.mainDrivers,
      momentumCondition: parsed.momentumCondition,
      volumeCondition: parsed.volumeCondition,
      liquidityCondition: parsed.liquidityCondition,
      volatilityCondition: parsed.volatilityCondition,
      macroCondition: parsed.macroCondition,
      environmentImpact: parsed.environmentImpact,
      diagnosticIntegration: {
        primaryDriver: parsed.primaryDriver,
        bullCase: parsed.bullCase,
        bearCase: parsed.bearCase,
        portfolioImplication: parsed.portfolioImplication,
        sensitiveTrigger: parsed.sensitiveTrigger,
        macroPath: parsed.macroPath,
        historicalAnalog: parsed.historicalAnalog,
        confidence: clamp(parsed.diagnosticConfidence ?? 60),
      },
    };
  } catch {
    // Fallback to deterministic descriptions
    const fallbackBullish = `${symbol} shows ${topFactors[0]?.name.toLowerCase()} as the primary bullish factor at ${topFactors[0]?.score}/100. Macro pressure at ${p}/100 ${p < 50 ? "supports" : "limits"} upside potential.`;
    const fallbackBearish = `${bottomFactors[0]?.name} at ${bottomFactors[0]?.score}/100 represents the primary headwind. ${p > 60 ? "Elevated macro pressure adds systemic risk." : "Monitor for deterioration."}`;

    return {
      whyBullish: fallbackBullish,
      whyBearish: fallbackBearish,
      mainDrivers: topFactors.slice(0, 3).map(f => f.note),
      momentumCondition: `Momentum factor scored ${scoreBreakdown.factors.find(f => f.name === "Trend")?.score ?? 50}/100`,
      volumeCondition: `Volume conditions are ${scoreBreakdown.factors.find(f => f.name === "Volume")?.label ?? "Neutral"}`,
      liquidityCondition: `Liquidity factor scored ${scoreBreakdown.factors.find(f => f.name === "Liquidity")?.score ?? 50}/100`,
      volatilityCondition: `Volatility is ${scoreBreakdown.factors.find(f => f.name === "Volatility")?.label ?? "Moderate"}`,
      macroCondition: `FAULTLINE Pressure Index at ${p}/100 — ${regimeLabel}`,
      environmentImpact: `Current ${regimeLabel} environment ${p > 60 ? "creates headwinds" : "is supportive"} for ${symbol}.`,
      diagnosticIntegration: {
        primaryDriver: topFactors[0]?.note ?? "Macro pressure",
        bullCase: fallbackBullish,
        bearCase: fallbackBearish,
        portfolioImplication: `${direction} outlook with ${scoreBreakdown.composite}/100 conviction score`,
        sensitiveTrigger: "Significant change in FAULTLINE Pressure Index",
        macroPath: `Pressure trend: ${pressure.regime}`,
        historicalAnalog: "No clear analog available",
        confidence: 55,
      },
    };
  }
}

// ── DB helpers ────────────────────────────────────────────────

async function saveOutlookSnapshot(
  symbol: string,
  assetType: "stock" | "crypto",
  timeframe: OutlookTimeframe,
  result: FullOutlookResult
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(outlookHistory).values({
      symbol: symbol.toUpperCase(),
      assetType,
      timeframe,
      outlookScore: result.outlookScore,
      direction: result.direction,
      confidence: result.confidence,
      riskLevel: result.riskLevel,
      pressureIndex: result.environment.pressureIndex,
      regime: result.environment.regimeLabel,
    });
  } catch {
    // Non-critical — history is best-effort
  }
}

async function getOutlookHistory(
  symbol: string,
  timeframe: OutlookTimeframe
): Promise<OutlookHistoryComparison | null> {
    try {
    const db = await getDb();
    if (!db) return null;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(outlookHistory)
      .where(
        and(
          eq(outlookHistory.symbol, symbol.toUpperCase()),
          eq(outlookHistory.timeframe, timeframe),
          gte(outlookHistory.snapshotAt, thirtyDaysAgo)
        )
      )
      .orderBy(desc(outlookHistory.snapshotAt))
      .limit(50);

    if (rows.length === 0) return null;

    const now = Date.now();
    const toPoint = (row: typeof rows[0]): OutlookHistoryPoint => ({
      snapshotAt: row.snapshotAt.getTime(),
      outlookScore: row.outlookScore,
      direction: row.direction as OutlookDirection,
      confidence: row.confidence,
      riskLevel: row.riskLevel as OutlookRiskLevel,
    });

    const current = toPoint(rows[0]);
    const h24 = rows.find(r => now - r.snapshotAt.getTime() >= 20 * 60 * 60 * 1000) ?? null;
    const d7  = rows.find(r => now - r.snapshotAt.getTime() >= 6 * 24 * 60 * 60 * 1000) ?? null;
    const d30 = rows.find(r => now - r.snapshotAt.getTime() >= 28 * 24 * 60 * 60 * 1000) ?? null;

    // Trend: compare current vs 7d ago
    let trend: "Improving" | "Stable" | "Deteriorating" = "Stable";
    if (d7) {
      const delta = current.outlookScore - d7.outlookScore;
      if (delta >= 8) trend = "Improving";
      else if (delta <= -8) trend = "Deteriorating";
    }

    return {
      current,
      h24: h24 ? toPoint(h24) : null,
      d7: d7 ? toPoint(d7) : null,
      d30: d30 ? toPoint(d30) : null,
      trend,
    };
  } catch {
    return null;
  }
}

// ── Main export: Full Outlook ─────────────────────────────────

export async function getFullOutlook(
  symbol: string,
  assetType: "stock" | "crypto",
  timeframe: OutlookTimeframe = "swing"
): Promise<FullOutlookResult> {
  const cacheKey = `${symbol.toUpperCase()}_${assetType}_${timeframe}`;
  const cached = fullOutlookCache.get(cacheKey);
  if (cached) return { ...cached, cached: true };

  const sym = symbol.toUpperCase();

  // Resolve name
  const stockEntry = STOCK_UNIVERSE.find(s => s.symbol === sym);
  const cryptoEntry = CRYPTO_UNIVERSE.find(c => c.symbol === sym);
  const name = assetType === "stock"
    ? (stockEntry?.name ?? sym)
    : (cryptoEntry?.name ?? sym);

  // Get pressure data
  const pressure = await calculateFaultlinePressure();
  const p = pressure.overallPressure;

  // Score
  const scoreBreakdown = assetType === "stock"
    ? scoreStockFactors(sym, pressure, timeframe)
    : scoreCryptoFactors(sym, pressure, timeframe);

  const direction = scoreToDirection(scoreBreakdown.composite);
  const confidence = clamp(Math.abs(scoreBreakdown.composite - 50) * 2);
  const riskLevel = scoreToRisk(p);

  // Environment
  const environment: FaultlineEnvironmentContext = {
    pressureIndex: p,
    pressureTrend: pressure.vectors.find(v => v.trend === "rising") ? "Rising" : pressure.vectors.find(v => v.trend === "falling") ? "Falling" : "Stable",
    regimeLabel: classifyRegimeLabel(p),
    bullProbability: pressureToBullProb(p),
    bearProbability: pressureToBearProb(p),
    environmentImpact: "", // filled by AI
  };

  // AI interpretation
  const aiOutput = await generateOutlookInterpretation(
    sym, assetType, direction, scoreBreakdown, pressure, timeframe
  );
  environment.environmentImpact = aiOutput.environmentImpact;

  // Asset-class analysis
  const stockAnalysis = assetType === "stock" ? buildStockAnalysis(sym, pressure) : null;
  const cryptoAnalysis = assetType === "crypto" ? buildCryptoAnalysis(sym, pressure) : null;

  // Preflight impact
  const preflightImpact = await buildPreflightImpact(direction, pressure);

  // Trade readiness
  const tradeReadiness: TradeReadiness = p > 65 ? "Defensive" : p > 45 ? "Caution" : "Cleared";

  // Invalidation scenarios
  const invalidationScenarios = buildInvalidationScenarios(assetType, direction, pressure);

  // Scenarios
  const scenarios = buildScenarios(assetType, sym, direction, pressure);

  // Fetch live price data for ATR-based trade framework calculations
  let livePrice: number | null = null;
  let priceHigh: number | null = null;
  let priceLow: number | null = null;
  try {
    if (assetType === "stock") {
      const quote = await getQuote(sym);
      livePrice = quote.price ?? null;
      priceHigh = quote.high ?? null;
      priceLow  = quote.low  ?? null;
    } else {
      const coinData = await getCoinMarketData(sym);
      if (coinData) {
        livePrice = coinData.currentPrice;
        priceHigh = coinData.high24h;
        priceLow  = coinData.low24h;
      }
    }
  } catch {
    // Non-critical — trade framework will show null prices gracefully
  }

  // Trade framework
  const tradeFramework = buildTradeFramework(scoreBreakdown, direction, timeframe, assetType, pressure, livePrice, priceHigh, priceLow);

  // History
  const history = await getOutlookHistory(sym, timeframe);

  const result: FullOutlookResult = {
    symbol: sym,
    name,
    assetType,
    timeframe,
    generatedAt: Date.now(),
    dataStatus: pressure.dataSource === "live" ? "Live" : "Delayed",
    outlookScore: scoreBreakdown.composite,
    direction,
    confidence,
    riskLevel,
    timeHorizon: timeframeLabel(timeframe),
    regimeAlignment: p < 40 ? "Aligned with Bullish Regime" : p < 65 ? "Neutral Regime — Mixed" : "Opposed by Bear Regime",
    scoreBreakdown,
    environment,
    whyBullish: aiOutput.whyBullish,
    whyBearish: aiOutput.whyBearish,
    mainDrivers: aiOutput.mainDrivers,
    momentumCondition: aiOutput.momentumCondition,
    volumeCondition: aiOutput.volumeCondition,
    liquidityCondition: aiOutput.liquidityCondition,
    volatilityCondition: aiOutput.volatilityCondition,
    macroCondition: aiOutput.macroCondition,
    invalidationScenarios,
    scenarios,
    stockAnalysis,
    cryptoAnalysis,
    diagnosticIntegration: aiOutput.diagnosticIntegration,
    preflightImpact,
    tradeReadiness,
    tradeFramework,
    history,
    cached: false,
  };

  fullOutlookCache.set(cacheKey, result);

  // Save snapshot async (non-blocking)
  saveOutlookSnapshot(sym, assetType, timeframe, result).catch(() => {});

  return result;
}

// ── Quick Outlook (for watchlist) ─────────────────────────────

export async function getQuickOutlook(
  symbol: string,
  assetType: "stock" | "crypto"
): Promise<QuickOutlook> {
  const cacheKey = `quick_${symbol.toUpperCase()}_${assetType}`;
  const cached = quickOutlookCache.get(cacheKey);
  if (cached) return cached;

  const pressure = await calculateFaultlinePressure();
  const p = pressure.overallPressure;

  const scoreBreakdown = assetType === "stock"
    ? scoreStockFactors(symbol.toUpperCase(), pressure, "swing")
    : scoreCryptoFactors(symbol.toUpperCase(), pressure, "swing");

  const result: QuickOutlook = {
    symbol: symbol.toUpperCase(),
    assetType,
    outlookScore: scoreBreakdown.composite,
    direction: scoreToDirection(scoreBreakdown.composite),
    confidence: clamp(Math.abs(scoreBreakdown.composite - 50) * 2),
    riskLevel: scoreToRisk(p),
    dataStatus: pressure.dataSource === "live" ? "Live" : "Cached",
  };

  quickOutlookCache.set(cacheKey, result);
  return result;
}

// ── Top Opportunities ─────────────────────────────────────────

export async function getTopOpportunities(): Promise<{
  stocks: TopOpportunity[];
  crypto: TopOpportunity[];
}> {
  const cached = topOppsCache.get("top");
  if (cached) return cached;

  const pressure = await calculateFaultlinePressure();
  const p = pressure.overallPressure;

  // Score all stocks
  const stockScores = STOCK_UNIVERSE.map(s => {
    const sb = scoreStockFactors(s.symbol, pressure, "swing");
    return {
      ...s,
      score: sb.composite,
      direction: scoreToDirection(sb.composite),
      confidence: clamp(Math.abs(sb.composite - 50) * 2),
      riskLevel: scoreToRisk(p),
      regimeAlignment: p < 40 ? "Aligned" : p < 65 ? "Mixed" : "Opposed",
      topReason: sb.factors.sort((a, b) => b.score - a.score)[0]?.note ?? "",
    };
  });

  // Score all crypto
  const cryptoScores = CRYPTO_UNIVERSE.map(c => {
    const sb = scoreCryptoFactors(c.symbol, pressure, "swing");
    return {
      ...c,
      score: sb.composite,
      direction: scoreToDirection(sb.composite),
      confidence: clamp(Math.abs(sb.composite - 50) * 2),
      riskLevel: scoreToRisk(p),
      regimeAlignment: p < 40 ? "Risk-On" : p < 65 ? "Neutral" : "Defensive",
      topReason: sb.factors.sort((a, b) => b.score - a.score)[0]?.note ?? "",
    };
  });

  // Sort by score descending, take top 5
  const topStocks: TopOpportunity[] = stockScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => ({
      symbol: s.symbol,
      name: s.name,
      assetType: "stock" as const,
      outlookScore: s.score,
      direction: s.direction,
      confidence: s.confidence,
      riskLevel: s.riskLevel,
      regimeAlignment: s.regimeAlignment,
      topReason: s.topReason,
    }));

  const topCrypto: TopOpportunity[] = cryptoScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(c => ({
      symbol: c.symbol,
      name: c.name,
      assetType: "crypto" as const,
      outlookScore: c.score,
      direction: c.direction,
      confidence: c.confidence,
      riskLevel: c.riskLevel,
      regimeAlignment: c.regimeAlignment,
      topReason: c.topReason,
    }));

  const result = { stocks: topStocks, crypto: topCrypto };
  topOppsCache.set("top", result);
  return result;
}

export function clearOutlookCaches(): void {
  fullOutlookCache.clear();
  topOppsCache.clear();
  quickOutlookCache.clear();
}
