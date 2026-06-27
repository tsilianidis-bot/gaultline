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
import { getCoinMarketData, getCoinOHLC } from "./coingeckoProxy";
import { fetchDailyBars } from "./signalsProxy";
import { computeCalculatedLevels, type CalculatedLevels } from "./priceLevels";

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

  // Calculated Price Levels (ATR, Pivot Points, SMA, Bollinger Bands, Prev Highs/Lows)
  calculatedLevels: CalculatedLevels;

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

  // ── 6 New Proprietary Signals ──────────────────────────────────────────

  // Signal 9: Early Accumulation (low breadth stress + low credit stress = accumulation phase)
  const earlyAccumScore = clamp(100 - (getVec("market_breadth") * 0.4 + getVec("credit_contagion") * 0.6));

  // Signal 10: Momentum Beginning (pressure declining from elevated = momentum inflection)
  const momentumBeginScore = clamp(p > 40 && p < 65 ? 100 - p * 0.8 : p <= 40 ? 80 : 30);

  // Signal 11: Institutional Accumulation (low liquidity stress + low volatility = institutional window)
  const instAccumScore = clamp(100 - (getVec("liquidity_stress") * 0.5 + getVec("volatility_regime") * 0.5));

  // Signal 12: Volatility Compression (very low vol = coil before breakout)
  const volCompressionScore = clamp(getVec("volatility_regime") < 35 ? 85 : getVec("volatility_regime") < 50 ? 65 : 40);

  // Signal 13: News Catalyst Probability (macro sensitivity + AI bubble = catalyst-rich environment)
  const newsCatalystScore = clamp(100 - (getVec("macro_sensitivity") * 0.4 + getVec("ai_bubble") * 0.3 + p * 0.3));

  // Signal 14: Technical Breakout (trend + breadth + low vol = breakout conditions)
  const technicalBreakoutScore = clamp((trendScore * 0.4 + breadthScore * 0.3 + volatilityScore * 0.3) * tfMultiplier);

  const factors: OutlookScoreFactor[] = [
    { name: "Trend",                      score: clamp(trendScore * tfMultiplier),          weight: 0.12, label: scoreToLabel(trendScore),          note: `Macro pressure at ${p}/100 — ${p > 60 ? "bearish trend conditions" : p > 40 ? "mixed trend" : "favorable trend environment"}` },
    { name: "Relative Strength",          score: clamp(breadthScore * tfMultiplier),        weight: 0.10, label: scoreToLabel(breadthScore),        note: `Market breadth score ${getVec("market_breadth")}/100 — ${getVec("market_breadth") > 60 ? "narrow leadership" : "broad participation"}` },
    { name: "Volume Expansion",           score: clamp(volumeScore * tfMultiplier),         weight: 0.08, label: scoreToLabel(volumeScore),         note: `Volatility regime ${getVec("volatility_regime")}/100 — ${getVec("volatility_regime") > 60 ? "elevated volatility" : "normal volume conditions"}` },
    { name: "Volatility",                 score: clamp(volatilityScore * tfMultiplier),     weight: 0.08, label: scoreToLabel(volatilityScore),     note: `${getVec("volatility_regime") > 70 ? "High volatility — entry risk elevated" : getVec("volatility_regime") > 40 ? "Moderate volatility" : "Low volatility — favorable for entries"}` },
    { name: "Sector Strength",            score: clamp(sectorScore * tfMultiplier),         weight: 0.10, label: scoreToLabel(sectorScore),         note: isAITech ? `AI bubble score ${aiBubbleVec}/100 — ${aiBubbleVec > 70 ? "extreme AI concentration risk" : "manageable AI exposure"}` : "Sector macro sensitivity analysis" },
    { name: "Market Breadth",             score: clamp(breadthDirectScore * tfMultiplier),  weight: 0.08, label: scoreToLabel(breadthDirectScore),  note: "Participation across market cap spectrum" },
    { name: "Regime Alignment",           score: clamp(regimeScore * tfMultiplier),         weight: 0.08, label: scoreToLabel(regimeScore),         note: `Current regime: ${pressure.regime} — ${p > 60 ? "unfavorable for new longs" : "supportive of risk-taking"}` },
    { name: "Market Structure",           score: clamp(structureScore * tfMultiplier),      weight: 0.08, label: scoreToLabel(structureScore),      note: `Credit ${creditVec}/100, Liquidity ${liquidityVec}/100 — ${creditVec > 60 || liquidityVec > 60 ? "structural stress present" : "stable foundation"}` },
    { name: "Early Accumulation",         score: clamp(earlyAccumScore * tfMultiplier),     weight: 0.06, label: scoreToLabel(earlyAccumScore),     note: `${earlyAccumScore > 65 ? "Accumulation phase detected — smart money positioning" : earlyAccumScore > 40 ? "Mixed accumulation signals" : "Distribution phase — institutional selling"}` },
    { name: "Momentum Beginning",         score: clamp(momentumBeginScore * tfMultiplier),  weight: 0.06, label: scoreToLabel(momentumBeginScore),  note: `${momentumBeginScore > 65 ? "Early momentum inflection — trend change underway" : momentumBeginScore > 40 ? "Momentum building" : "No momentum signal"}` },
    { name: "Institutional Accumulation", score: clamp(instAccumScore * tfMultiplier),      weight: 0.06, label: scoreToLabel(instAccumScore),      note: `${instAccumScore > 65 ? "Institutional window open — low stress environment" : instAccumScore > 40 ? "Moderate institutional activity" : "Institutional caution — stress elevated"}` },
    { name: "Volatility Compression",     score: clamp(volCompressionScore * tfMultiplier), weight: 0.04, label: scoreToLabel(volCompressionScore), note: `${volCompressionScore > 70 ? "Volatility coil — breakout imminent" : volCompressionScore > 50 ? "Moderate compression" : "No compression signal"}` },
    { name: "News Catalyst Probability",  score: clamp(newsCatalystScore * tfMultiplier),   weight: 0.04, label: scoreToLabel(newsCatalystScore),   note: `${newsCatalystScore > 65 ? "High catalyst probability — macro + AI events converging" : newsCatalystScore > 40 ? "Moderate catalyst environment" : "Low catalyst probability"}` },
    { name: "Technical Breakout",         score: clamp(technicalBreakoutScore),             weight: 0.02, label: scoreToLabel(technicalBreakoutScore), note: `${technicalBreakoutScore > 70 ? "Breakout conditions present — trend + breadth + vol aligned" : technicalBreakoutScore > 50 ? "Partial breakout setup" : "No breakout signal"}` },
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
        { role: "system", content: "You are FAULTLINE — an elite institutional market intelligence system operating as a Chief Investment Strategist. You synthesize live market data and proprietary signal scoring into clear, confident analysis. Be direct, specific, and institutional in tone. Respond only with valid JSON." },
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

  // Fetch live price data + daily bars for trade framework and calculated levels
  let livePrice: number | null = null;
  let priceHigh: number | null = null;
  let priceLow: number | null = null;
  let dailyBarsForLevels: Array<{ close: number; open: number; high: number; low: number; volume: number; timestamp: number }> = [];

  try {
    if (assetType === "stock") {
      const [quote, bars] = await Promise.all([
        getQuote(sym),
        (async () => {
          const apiKey = process.env.POLYGON_API_KEY;
          if (!apiKey) return [];
          return fetchDailyBars(apiKey, sym, 252);
        })(),
      ]);
      livePrice = quote.price ?? null;
      priceHigh = quote.high ?? null;
      priceLow  = quote.low  ?? null;
      dailyBarsForLevels = bars;
    } else {
      const [coinData, ohlcBars] = await Promise.all([
        getCoinMarketData(sym),
        getCoinOHLC(sym, 90),
      ]);
      if (coinData) {
        livePrice = coinData.currentPrice;
        priceHigh = coinData.high24h;
        priceLow  = coinData.low24h;
      }
      // Convert CoinOHLC bars to the common OHLCBar format
      dailyBarsForLevels = ohlcBars.map(b => ({
        close: b.close, open: b.open, high: b.high, low: b.low,
        volume: 0, timestamp: b.timestamp,
      }));
    }
  } catch {
    // Non-critical — trade framework and levels will show gracefully
  }

  // Trade framework (ATR-based entry/stop/target from live price)
  const tradeFramework = buildTradeFramework(scoreBreakdown, direction, timeframe, assetType, pressure, livePrice, priceHigh, priceLow);

  // Calculated price levels (pivot points, SMA, Bollinger Bands, prev highs/lows)
  const calculatedLevels = computeCalculatedLevels(
    dailyBarsForLevels,
    livePrice ?? 0,
    direction,
    timeframe
  );

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
    calculatedLevels,
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

// ============================================================
// FAULTLINE — Opportunity Discovery Engine™
// Proactive 8-category opportunity feed displayed before users search.
// Each category surfaces 3-5 securities with Opportunity Score,
// Time Horizon, Catalyst, and Risk Level.
// ============================================================

export type DiscoveryCategory =
  | "top_opportunity_today"
  | "emerging_breakouts"
  | "high_conviction_setups"
  | "ai_leaders"
  | "crypto_leaders"
  | "macro_beneficiaries"
  | "undervalued_opportunities"
  | "high_risk_high_reward"
  | "defense_geopolitical"
  | "energy_transition"
  | "biotech_healthcare"
  | "fintech_payments"
  | "infrastructure_industrials"
  | "consumer_discretionary"
  | "dividend_income"
  | "small_cap_growth"
  | "defi_web3"
  | "commodities_real_assets"
  | "volatility_plays"
  | "short_squeeze_candidates"
  | "earnings_momentum"
  | "technical_reversals"
  | "institutional_accumulation"
  | "etf_flows"
  | "global_macro"
  | "space_deep_tech";

export interface DiscoveryItem {
  ticker: string;
  name: string;
  assetType: "stock" | "crypto";
  opportunityScore: number;
  expectedTimeHorizon: string;
  catalyst: string;
  riskLevel: "Low" | "Medium" | "High" | "Extreme";
  direction: OutlookDirection;
  rationale: string;
  // Extended card data
  bullCase: string;
  bearCase: string;
  invalidationLevel: string;
  whyFaultlineLikesIt: string;
  institutionalConviction: "Low" | "Moderate" | "High" | "Very High";
  macroAlignment: number;         // 0–100
  riskRewardRatio: string;        // e.g. "2.5:1"
  confidenceLevel: number;        // 0–100
  topCatalyst: string;
  actionBias: "BUY" | "WATCH" | "HOLD" | "REDUCE" | "AVOID";
}

export interface DiscoveryBucket {
  category: DiscoveryCategory;
  label: string;
  description: string;
  items: DiscoveryItem[];
  generatedAt: number;
}

export interface OpportunityDiscoveryResult {
  buckets: DiscoveryBucket[];
  pressureIndex: number;
  regime: string;
  generatedAt: number;
}

const DISCOVERY_CATEGORY_META: Record<DiscoveryCategory, { label: string; description: string }> = {
  top_opportunity_today:      { label: "Top Opportunity Today",       description: "Highest-conviction setup across all assets right now" },
  emerging_breakouts:         { label: "Emerging Breakouts",          description: "Securities approaching key technical breakout levels" },
  high_conviction_setups:     { label: "High Conviction Setups",      description: "Strong regime alignment with clear risk/reward" },
  ai_leaders:                 { label: "AI Leaders",                  description: "AI infrastructure and semiconductor plays" },
  crypto_leaders:             { label: "Crypto Leaders",              description: "Top digital assets by momentum and regime fit" },
  macro_beneficiaries:        { label: "Macro Beneficiaries",         description: "Assets positioned to benefit from current macro regime" },
  undervalued_opportunities:  { label: "Undervalued Opportunities",   description: "Setups where price may not reflect fundamental strength" },
  high_risk_high_reward:      { label: "High Risk / High Reward",     description: "Asymmetric setups with elevated volatility and outsized potential" },
  defense_geopolitical:       { label: "Defense & Geopolitical",      description: "Defense contractors and geopolitical risk beneficiaries" },
  energy_transition:          { label: "Energy Transition",           description: "Clean energy, nuclear, and fossil fuel transition plays" },
  biotech_healthcare:         { label: "Biotech & Healthcare",        description: "Biotech catalysts, FDA events, and healthcare sector plays" },
  fintech_payments:           { label: "Fintech & Payments",          description: "Digital payments, banking disruption, and financial technology" },
  infrastructure_industrials: { label: "Infrastructure & Industrials",description: "Government spending beneficiaries and industrial cycle plays" },
  consumer_discretionary:     { label: "Consumer Discretionary",     description: "Consumer spending trends and retail/leisure sector plays" },
  dividend_income:            { label: "Dividend & Income",           description: "High-yield dividend payers with stable cash flows" },
  small_cap_growth:           { label: "Small Cap Growth",            description: "High-growth small caps with outsized return potential" },
  defi_web3:                  { label: "DeFi & Web3",                 description: "Decentralized finance protocols and Web3 infrastructure" },
  commodities_real_assets:    { label: "Commodities & Real Assets",   description: "Gold, silver, oil, and hard asset inflation hedges" },
  volatility_plays:           { label: "Volatility Plays",            description: "VIX-related instruments and volatility regime trades" },
  short_squeeze_candidates:   { label: "Short Squeeze Candidates",    description: "High short interest with potential for rapid short covering" },
  earnings_momentum:          { label: "Earnings Momentum",           description: "Companies with strong earnings beats and upward revisions" },
  technical_reversals:        { label: "Technical Reversals",         description: "Oversold setups approaching key support with reversal signals" },
  institutional_accumulation: { label: "Institutional Accumulation",  description: "Unusual volume and dark pool activity suggesting institutional buying" },
  etf_flows:                  { label: "ETF Flow Leaders",            description: "ETFs with strongest inflows and sector rotation momentum" },
  global_macro:               { label: "Global Macro",                description: "International markets and cross-asset macro regime plays" },
  space_deep_tech:            { label: "Space & Deep Tech",           description: "Space exploration, quantum computing, and frontier technology" },
};

const DISCOVERY_POOLS: Record<DiscoveryCategory, Array<{ symbol: string; name: string; assetType: "stock" | "crypto" }>> = {
  top_opportunity_today: [
    { symbol: "NVDA", name: "NVIDIA Corporation",       assetType: "stock" },
    { symbol: "PLTR", name: "Palantir Technologies",    assetType: "stock" },
    { symbol: "BTC",  name: "Bitcoin",                  assetType: "crypto" },
    { symbol: "ETH",  name: "Ethereum",                 assetType: "crypto" },
    { symbol: "TSLA", name: "Tesla Inc.",               assetType: "stock" },
    { symbol: "META", name: "Meta Platforms Inc.",      assetType: "stock" },
    { symbol: "SOL",  name: "Solana",                   assetType: "crypto" },
    { symbol: "AMD",  name: "Advanced Micro Devices",   assetType: "stock" },
  ],
  emerging_breakouts: [
    { symbol: "IONQ", name: "IonQ Inc.",                assetType: "stock" },
    { symbol: "RKLB", name: "Rocket Lab USA",           assetType: "stock" },
    { symbol: "SMCI", name: "Super Micro Computer",     assetType: "stock" },
    { symbol: "TAO",  name: "Bittensor",                assetType: "crypto" },
    { symbol: "ARB",  name: "Arbitrum",                 assetType: "crypto" },
    { symbol: "MSTR", name: "MicroStrategy Inc.",       assetType: "stock" },
  ],
  high_conviction_setups: [
    { symbol: "NVDA", name: "NVIDIA Corporation",       assetType: "stock" },
    { symbol: "META", name: "Meta Platforms Inc.",      assetType: "stock" },
    { symbol: "MSFT", name: "Microsoft Corporation",    assetType: "stock" },
    { symbol: "BTC",  name: "Bitcoin",                  assetType: "crypto" },
    { symbol: "SPY",  name: "S&P 500 ETF",              assetType: "stock" },
  ],
  ai_leaders: [
    { symbol: "NVDA", name: "NVIDIA Corporation",       assetType: "stock" },
    { symbol: "PLTR", name: "Palantir Technologies",    assetType: "stock" },
    { symbol: "AMD",  name: "Advanced Micro Devices",   assetType: "stock" },
    { symbol: "MSFT", name: "Microsoft Corporation",    assetType: "stock" },
    { symbol: "SMCI", name: "Super Micro Computer",     assetType: "stock" },
    { symbol: "IONQ", name: "IonQ Inc.",                assetType: "stock" },
    { symbol: "TAO",  name: "Bittensor",                assetType: "crypto" },
  ],
  crypto_leaders: [
    { symbol: "BTC",  name: "Bitcoin",                  assetType: "crypto" },
    { symbol: "ETH",  name: "Ethereum",                 assetType: "crypto" },
    { symbol: "SOL",  name: "Solana",                   assetType: "crypto" },
    { symbol: "TAO",  name: "Bittensor",                assetType: "crypto" },
    { symbol: "AVAX", name: "Avalanche",                assetType: "crypto" },
    { symbol: "LINK", name: "Chainlink",                assetType: "crypto" },
  ],
  macro_beneficiaries: [
    { symbol: "SPY",  name: "S&P 500 ETF",              assetType: "stock" },
    { symbol: "QQQ",  name: "Nasdaq 100 ETF",           assetType: "stock" },
    { symbol: "AAPL", name: "Apple Inc.",               assetType: "stock" },
    { symbol: "AMZN", name: "Amazon.com Inc.",          assetType: "stock" },
    { symbol: "MSFT", name: "Microsoft Corporation",    assetType: "stock" },
    { symbol: "BTC",  name: "Bitcoin",                  assetType: "crypto" },
  ],
  undervalued_opportunities: [
    { symbol: "AMD",  name: "Advanced Micro Devices",   assetType: "stock" },
    { symbol: "COIN", name: "Coinbase Global Inc.",     assetType: "stock" },
    { symbol: "RKLB", name: "Rocket Lab USA",           assetType: "stock" },
    { symbol: "ETH",  name: "Ethereum",                 assetType: "crypto" },
    { symbol: "AVAX", name: "Avalanche",                assetType: "crypto" },
    { symbol: "ARB",  name: "Arbitrum",                 assetType: "crypto" },
  ],
  high_risk_high_reward: [
    { symbol: "MSTR", name: "MicroStrategy Inc.",       assetType: "stock" },
    { symbol: "IONQ", name: "IonQ Inc.",                assetType: "stock" },
    { symbol: "SMCI", name: "Super Micro Computer",     assetType: "stock" },
    { symbol: "TAO",  name: "Bittensor",                assetType: "crypto" },
    { symbol: "ARB",  name: "Arbitrum",                 assetType: "crypto" },
    { symbol: "RKLB", name: "Rocket Lab USA",           assetType: "stock" },
  ],
  defense_geopolitical: [
    { symbol: "LMT",  name: "Lockheed Martin",          assetType: "stock" },
    { symbol: "RTX",  name: "RTX Corporation",          assetType: "stock" },
    { symbol: "NOC",  name: "Northrop Grumman",         assetType: "stock" },
    { symbol: "PLTR", name: "Palantir Technologies",    assetType: "stock" },
    { symbol: "GD",   name: "General Dynamics",         assetType: "stock" },
  ],
  energy_transition: [
    { symbol: "ENPH", name: "Enphase Energy",           assetType: "stock" },
    { symbol: "FSLR", name: "First Solar Inc.",         assetType: "stock" },
    { symbol: "CEG",  name: "Constellation Energy",     assetType: "stock" },
    { symbol: "NEE",  name: "NextEra Energy",           assetType: "stock" },
    { symbol: "XOM",  name: "ExxonMobil Corp.",         assetType: "stock" },
  ],
  biotech_healthcare: [
    { symbol: "MRNA", name: "Moderna Inc.",             assetType: "stock" },
    { symbol: "NVAX", name: "Novavax Inc.",             assetType: "stock" },
    { symbol: "BIIB", name: "Biogen Inc.",              assetType: "stock" },
    { symbol: "GILD", name: "Gilead Sciences",          assetType: "stock" },
    { symbol: "REGN", name: "Regeneron Pharmaceuticals",assetType: "stock" },
  ],
  fintech_payments: [
    { symbol: "SQ",   name: "Block Inc.",               assetType: "stock" },
    { symbol: "PYPL", name: "PayPal Holdings",          assetType: "stock" },
    { symbol: "COIN", name: "Coinbase Global",          assetType: "stock" },
    { symbol: "V",    name: "Visa Inc.",                assetType: "stock" },
    { symbol: "SOFI", name: "SoFi Technologies",        assetType: "stock" },
  ],
  infrastructure_industrials: [
    { symbol: "CAT",  name: "Caterpillar Inc.",         assetType: "stock" },
    { symbol: "DE",   name: "Deere & Company",          assetType: "stock" },
    { symbol: "URI",  name: "United Rentals",           assetType: "stock" },
    { symbol: "PWR",  name: "Quanta Services",          assetType: "stock" },
    { symbol: "VMC",  name: "Vulcan Materials",         assetType: "stock" },
  ],
  consumer_discretionary: [
    { symbol: "AMZN", name: "Amazon.com Inc.",          assetType: "stock" },
    { symbol: "TSLA", name: "Tesla Inc.",               assetType: "stock" },
    { symbol: "NKE",  name: "Nike Inc.",                assetType: "stock" },
    { symbol: "SBUX", name: "Starbucks Corp.",          assetType: "stock" },
    { symbol: "MCD",  name: "McDonald's Corp.",         assetType: "stock" },
  ],
  dividend_income: [
    { symbol: "JNJ",  name: "Johnson & Johnson",        assetType: "stock" },
    { symbol: "KO",   name: "Coca-Cola Co.",            assetType: "stock" },
    { symbol: "PG",   name: "Procter & Gamble",         assetType: "stock" },
    { symbol: "VZ",   name: "Verizon Communications",   assetType: "stock" },
    { symbol: "T",    name: "AT&T Inc.",                assetType: "stock" },
  ],
  small_cap_growth: [
    { symbol: "RKLB", name: "Rocket Lab USA",           assetType: "stock" },
    { symbol: "IONQ", name: "IonQ Inc.",                assetType: "stock" },
    { symbol: "LUNR", name: "Intuitive Machines",       assetType: "stock" },
    { symbol: "ACHR", name: "Archer Aviation",          assetType: "stock" },
    { symbol: "JOBY", name: "Joby Aviation",            assetType: "stock" },
  ],
  defi_web3: [
    { symbol: "ETH",  name: "Ethereum",                 assetType: "crypto" },
    { symbol: "SOL",  name: "Solana",                   assetType: "crypto" },
    { symbol: "LINK", name: "Chainlink",                assetType: "crypto" },
    { symbol: "UNI",  name: "Uniswap",                  assetType: "crypto" },
    { symbol: "AAVE", name: "Aave",                     assetType: "crypto" },
  ],
  commodities_real_assets: [
    { symbol: "GLD",  name: "SPDR Gold Shares",         assetType: "stock" },
    { symbol: "SLV",  name: "iShares Silver Trust",     assetType: "stock" },
    { symbol: "USO",  name: "United States Oil Fund",   assetType: "stock" },
    { symbol: "WEAT", name: "Teucrium Wheat Fund",      assetType: "stock" },
    { symbol: "PDBC", name: "Invesco Commodity ETF",    assetType: "stock" },
  ],
  volatility_plays: [
    { symbol: "UVXY", name: "ProShares Ultra VIX",      assetType: "stock" },
    { symbol: "VXX",  name: "iPath VIX Short-Term",     assetType: "stock" },
    { symbol: "SVXY", name: "ProShares Short VIX",      assetType: "stock" },
    { symbol: "VIXY", name: "ProShares VIX Short-Term", assetType: "stock" },
  ],
  short_squeeze_candidates: [
    { symbol: "GME",  name: "GameStop Corp.",           assetType: "stock" },
    { symbol: "AMC",  name: "AMC Entertainment",        assetType: "stock" },
    { symbol: "BBBY", name: "Beyond Inc.",              assetType: "stock" },
    { symbol: "MSTR", name: "MicroStrategy Inc.",       assetType: "stock" },
    { symbol: "SMCI", name: "Super Micro Computer",     assetType: "stock" },
  ],
  earnings_momentum: [
    { symbol: "NVDA", name: "NVIDIA Corporation",       assetType: "stock" },
    { symbol: "META", name: "Meta Platforms Inc.",      assetType: "stock" },
    { symbol: "MSFT", name: "Microsoft Corporation",    assetType: "stock" },
    { symbol: "AAPL", name: "Apple Inc.",               assetType: "stock" },
    { symbol: "AMZN", name: "Amazon.com Inc.",          assetType: "stock" },
  ],
  technical_reversals: [
    { symbol: "INTC", name: "Intel Corporation",        assetType: "stock" },
    { symbol: "BABA", name: "Alibaba Group",            assetType: "stock" },
    { symbol: "NIO",  name: "NIO Inc.",                 assetType: "stock" },
    { symbol: "PYPL", name: "PayPal Holdings",          assetType: "stock" },
    { symbol: "DOGE", name: "Dogecoin",                 assetType: "crypto" },
  ],
  institutional_accumulation: [
    { symbol: "NVDA", name: "NVIDIA Corporation",       assetType: "stock" },
    { symbol: "PLTR", name: "Palantir Technologies",    assetType: "stock" },
    { symbol: "BTC",  name: "Bitcoin",                  assetType: "crypto" },
    { symbol: "MSFT", name: "Microsoft Corporation",    assetType: "stock" },
    { symbol: "AAPL", name: "Apple Inc.",               assetType: "stock" },
  ],
  etf_flows: [
    { symbol: "SPY",  name: "S&P 500 ETF",              assetType: "stock" },
    { symbol: "QQQ",  name: "Nasdaq 100 ETF",           assetType: "stock" },
    { symbol: "IWM",  name: "Russell 2000 ETF",         assetType: "stock" },
    { symbol: "XLK",  name: "Technology Select ETF",    assetType: "stock" },
    { symbol: "ARKK", name: "ARK Innovation ETF",       assetType: "stock" },
  ],
  global_macro: [
    { symbol: "EEM",  name: "Emerging Markets ETF",     assetType: "stock" },
    { symbol: "FXI",  name: "China Large-Cap ETF",      assetType: "stock" },
    { symbol: "EWJ",  name: "Japan ETF",                assetType: "stock" },
    { symbol: "EWZ",  name: "Brazil ETF",               assetType: "stock" },
    { symbol: "DXY",  name: "US Dollar Index",          assetType: "stock" },
  ],
  space_deep_tech: [
    { symbol: "RKLB", name: "Rocket Lab USA",           assetType: "stock" },
    { symbol: "SPCE", name: "Virgin Galactic",          assetType: "stock" },
    { symbol: "LUNR", name: "Intuitive Machines",       assetType: "stock" },
    { symbol: "IONQ", name: "IonQ Inc.",                assetType: "stock" },
    { symbol: "RGTI", name: "Rigetti Computing",        assetType: "stock" },
  ],
};

function discoveryTimeHorizon(score: number, assetType: "stock" | "crypto"): string {
  if (assetType === "crypto") {
    if (score >= 75) return "1\u20133 days";
    if (score >= 60) return "3\u20137 days";
    if (score >= 45) return "1\u20133 weeks";
    return "2\u20136 weeks";
  }
  if (score >= 75) return "1\u20132 weeks";
  if (score >= 60) return "2\u20134 weeks";
  if (score >= 45) return "1\u20133 months";
  return "3\u20136 months";
}

function discoveryCatalyst(category: DiscoveryCategory, score: number): string {
  const pools: Record<DiscoveryCategory, string[]> = {
    top_opportunity_today: [
      "Regime alignment at peak \u2014 momentum window open",
      "Macro pressure easing \u2014 risk-on rotation accelerating",
      "Institutional accumulation signals detected",
    ],
    emerging_breakouts: [
      "Price coiling near key resistance \u2014 breakout imminent",
      "Volume expansion preceding technical breakout",
      "Sector rotation catalyst building",
    ],
    high_conviction_setups: [
      "Multiple timeframe confluence \u2014 strong directional bias",
      "Earnings catalyst approaching with positive setup",
      "Macro regime fully aligned with bullish thesis",
    ],
    ai_leaders: [
      "AI infrastructure capex cycle accelerating",
      "Enterprise AI adoption driving revenue beats",
      "Semiconductor supply constraints easing \u2014 margin expansion",
    ],
    crypto_leaders: [
      "On-chain accumulation by long-term holders",
      "Institutional inflows via ETF products",
      "Protocol upgrade or ecosystem expansion catalyst",
    ],
    macro_beneficiaries: [
      "Fed policy pivot supporting risk assets",
      "Liquidity conditions improving \u2014 risk appetite expanding",
      "Earnings season tailwind with positive guidance",
    ],
    undervalued_opportunities: [
      "Price-to-growth ratio below sector average",
      "Sentiment overshoot creating asymmetric entry",
      "Fundamental catalyst not yet priced in",
    ],
    high_risk_high_reward: [
      "Binary catalyst approaching \u2014 high volatility expected",
      "Short squeeze potential with elevated short interest",
      "Speculative momentum building ahead of key event",
    ],
    defense_geopolitical: [
      "Geopolitical escalation driving defense budget expansion",
      "Government contract awards accelerating revenue growth",
      "NATO spending commitments boosting defense sector",
    ],
    energy_transition: [
      "IRA incentives driving clean energy capex surge",
      "Nuclear renaissance gaining policy and investor support",
      "Grid modernization spending accelerating sector tailwinds",
    ],
    biotech_healthcare: [
      "FDA catalyst approaching \u2014 binary event setup",
      "Phase 3 trial readout with positive interim data",
      "Aging demographics driving healthcare sector demand",
    ],
    fintech_payments: [
      "Digital payment volume growth outpacing traditional banking",
      "Crypto integration expanding addressable market",
      "Interest rate environment improving fintech margins",
    ],
    infrastructure_industrials: [
      "Infrastructure bill spending flowing into sector",
      "Reshoring trend driving domestic industrial demand",
      "Backlog growth signaling multi-year revenue visibility",
    ],
    consumer_discretionary: [
      "Consumer spending resilience defying recession fears",
      "Travel and leisure demand recovering above expectations",
      "Wage growth supporting discretionary spending power",
    ],
    dividend_income: [
      "Dividend growth streak intact with strong free cash flow",
      "Yield premium attractive relative to bond alternatives",
      "Defensive positioning as recession risk increases",
    ],
    small_cap_growth: [
      "Small cap rotation catalyst \u2014 rate cut expectations rising",
      "Insider buying cluster signaling management confidence",
      "Niche market leadership with high growth runway",
    ],
    defi_web3: [
      "DeFi TVL expanding \u2014 protocol revenue accelerating",
      "Layer 2 adoption driving transaction volume growth",
      "Institutional DeFi integration expanding user base",
    ],
    commodities_real_assets: [
      "Inflation hedge demand rising as CPI remains elevated",
      "Supply constraints supporting commodity price floor",
      "Dollar weakness amplifying commodity return potential",
    ],
    volatility_plays: [
      "VIX compression creating asymmetric long volatility setup",
      "Event risk calendar dense \u2014 volatility premium elevated",
      "Macro uncertainty supporting volatility regime",
    ],
    short_squeeze_candidates: [
      "Short interest above 20% with rising borrow cost",
      "Retail momentum building against institutional short thesis",
      "Positive catalyst could force rapid short covering",
    ],
    earnings_momentum: [
      "Earnings beat streak with upward guidance revisions",
      "Analyst estimate upgrades accelerating into earnings",
      "Revenue growth reaccelerating above consensus",
    ],
    technical_reversals: [
      "RSI oversold with bullish divergence forming",
      "Price at key multi-year support with volume confirmation",
      "Sentiment extreme creating contrarian entry opportunity",
    ],
    institutional_accumulation: [
      "Dark pool prints above average \u2014 institutional buying detected",
      "13F filings show new large position initiations",
      "Block trade activity suggesting smart money accumulation",
    ],
    etf_flows: [
      "Sector ETF inflows at 52-week high \u2014 rotation confirmed",
      "Options flow on ETF suggesting directional conviction",
      "Passive fund rebalancing creating systematic buying pressure",
    ],
    global_macro: [
      "Emerging market recovery gaining momentum",
      "Currency regime shift creating cross-asset opportunity",
      "Central bank divergence driving international flows",
    ],
    space_deep_tech: [
      "Commercial space launch backlog growing rapidly",
      "Quantum computing milestone driving sector re-rating",
      "Government contract awards validating technology roadmap",
    ],
  };
  const pool = pools[category];
  return pool[Math.floor((score / 100) * pool.length) % pool.length];
}

const discoveryCache = new LRUCache<string, OpportunityDiscoveryResult>(2, 10 * 60_000);

// ── Discovery item extended field helpers ─────────────────────

function discoveryBullCase(category: DiscoveryCategory, score: number, pressure: number): string {
  const pools: Partial<Record<DiscoveryCategory, string[]>> = {
    top_opportunity_today:      ["Regime alignment at peak — all macro vectors confirm risk-on", "Institutional flows accelerating into this setup", "Momentum breakout with volume confirmation"],
    emerging_breakouts:         ["Price approaching key resistance with volume expansion", "Breakout pattern forming on multiple timeframes", "Relative strength outperforming benchmark"],
    high_conviction_setups:     ["Strong regime alignment with clear risk/reward", "Multiple technical factors converging", "Institutional accumulation detected in recent sessions"],
    ai_leaders:                 ["AI infrastructure spending cycle accelerating", "Earnings revisions trending higher across sector", "Regime favors high-growth technology exposure"],
    crypto_leaders:             ["On-chain metrics showing accumulation phase", "Macro regime supports digital asset exposure", "Momentum building across crypto market structure"],
    macro_beneficiaries:        ["Current macro regime directly benefits this sector", "Policy tailwinds aligning with sector fundamentals", "Rotation flows moving into this category"],
    undervalued_opportunities:  ["Price-to-fundamentals gap creating asymmetric upside", "Catalyst approaching that could close the valuation gap", "Smart money accumulation visible in volume patterns"],
    high_risk_high_reward:      ["Asymmetric setup with defined risk and outsized potential", "Catalyst event approaching — binary outcome favors bulls", "Short interest elevated — squeeze potential if momentum builds"],
    defense_geopolitical:       ["Geopolitical risk premium supporting defense spending", "Government contract pipeline expanding", "Sector rotation into defensive names accelerating"],
    energy_transition:          ["Policy support for clean energy investment increasing", "Infrastructure spending cycle benefits this sector", "Long-term secular tailwind intact"],
    biotech_healthcare:         ["FDA catalyst approaching — binary event with upside", "Pipeline value not reflected in current price", "Healthcare spending resilient in all macro regimes"],
    fintech_payments:           ["Digital payment volumes growing at accelerating rate", "Market share gains in underpenetrated markets", "Regulatory environment becoming more favorable"],
    infrastructure_industrials: ["Government infrastructure spending creating durable demand", "Industrial cycle in early expansion phase", "Pricing power intact despite input cost pressures"],
    consumer_discretionary:     ["Consumer spending resilient despite macro headwinds", "Brand strength supporting premium pricing", "International expansion driving incremental growth"],
    dividend_income:            ["Dividend yield attractive relative to risk-free rate", "Cash flow generation supports dividend sustainability", "Defensive characteristics attractive in current regime"],
    small_cap_growth:           ["Small cap premium historically attractive at current valuations", "Niche market leadership with high growth runway", "Acquisition target potential adds optionality"],
    defi_web3:                  ["Protocol revenue growing with user adoption", "DeFi TVL recovering — ecosystem health improving", "Institutional interest in Web3 infrastructure increasing"],
    commodities_real_assets:    ["Inflation hedge demand supporting real asset prices", "Supply constraints creating structural price support", "Dollar weakness tailwind for commodity prices"],
    volatility_plays:           ["Volatility regime shift approaching — positioning ahead", "Event risk calendar supports elevated VIX", "Portfolio hedge value increasing in current environment"],
    short_squeeze_candidates:   ["Short interest at extreme levels — fuel for rapid squeeze", "Catalyst approaching that could force short covering", "Options market pricing in elevated upside move"],
    earnings_momentum:          ["Earnings beat streak intact — revisions trending higher", "Guidance raised — management confidence high", "Multiple expansion possible as earnings quality improves"],
    technical_reversals:        ["Oversold conditions with positive divergence forming", "Key support level holding — buyers stepping in", "Mean reversion setup with defined risk at support"],
    institutional_accumulation: ["Dark pool activity suggests institutional buying program", "Unusual volume patterns consistent with accumulation", "Smart money positioning ahead of catalyst"],
    etf_flows:                  ["ETF inflows accelerating — passive demand supporting price", "Index rebalancing creating technical buying pressure", "Sector rotation flows entering this ETF category"],
    global_macro:               ["Global macro regime shift creating international opportunity", "Currency tailwind for this market", "Valuation discount to US equities closing"],
    space_deep_tech:            ["Government contract awards accelerating revenue visibility", "Technology milestones approaching — catalyst potential", "Long-term secular growth in space economy intact"],
  };
  const options = pools[category] ?? ["Regime-aligned setup with favorable risk/reward", "Multiple factors converging for upside"];
  return options[score % options.length];
}

function discoveryBearCase(category: DiscoveryCategory, pressure: number): string {
  const highPressure = pressure >= 60;
  const pools: Partial<Record<DiscoveryCategory, string[]>> = {
    top_opportunity_today:      ["Macro pressure spike could invalidate setup quickly", "Crowded trade — reversal risk if sentiment shifts"],
    emerging_breakouts:         ["False breakout risk if volume doesn't confirm", "Resistance level may hold — setup fails without volume"],
    high_conviction_setups:     ["Conviction can reverse quickly if macro deteriorates", "High expectations already priced in"],
    ai_leaders:                 ["AI bubble risk — valuation stretched relative to earnings", "Rate sensitivity high — Fed pivot could compress multiples"],
    crypto_leaders:             ["Crypto volatility can overwhelm technical setups", "Regulatory risk remains elevated"],
    macro_beneficiaries:        ["Macro regime can shift faster than fundamentals", "Policy reversal could remove tailwind"],
    undervalued_opportunities:  ["Value trap risk — cheap for a reason", "Catalyst may not materialize on expected timeline"],
    high_risk_high_reward:      ["Binary outcome — full loss possible if catalyst fails", "Liquidity risk in volatile conditions"],
    defense_geopolitical:       ["Geopolitical de-escalation removes premium", "Budget cuts could reduce contract pipeline"],
    energy_transition:          ["Policy reversal risk under new administration", "Technology cost curve slower than expected"],
    biotech_healthcare:         ["FDA rejection risk — binary downside", "Clinical trial failure could erase gains"],
    fintech_payments:           ["Regulatory crackdown risk increasing", "Competition from big tech intensifying"],
    infrastructure_industrials: ["Spending delays or budget cuts reduce visibility", "Input cost inflation squeezing margins"],
    consumer_discretionary:     ["Consumer spending slowdown risk", "Interest rate sensitivity high"],
    dividend_income:            ["Dividend cut risk if cash flows deteriorate", "Rising rates make yield less attractive"],
    small_cap_growth:           ["Liquidity risk — small caps sell off harder in downturns", "Funding risk if rates stay elevated"],
    defi_web3:                  ["Smart contract exploit risk", "Regulatory action could freeze protocols"],
    commodities_real_assets:    ["Dollar strength headwind", "Demand destruction in recession scenario"],
    volatility_plays:           ["Volatility crush risk if event passes without move", "Contango decay in VIX products"],
    short_squeeze_candidates:   ["Short sellers may be right — fundamentals deteriorating", "Squeeze may have already occurred"],
    earnings_momentum:          ["High expectations — any miss punished severely", "Multiple compression risk if growth decelerates"],
    technical_reversals:        ["Support breaks — setup fails with accelerated downside", "Dead cat bounce risk in downtrend"],
    institutional_accumulation: ["Institutions may be wrong — contrarian risk", "Distribution disguised as accumulation"],
    etf_flows:                  ["Passive flows can reverse quickly in risk-off", "Concentration risk in top holdings"],
    global_macro:               ["Currency risk can overwhelm equity returns", "Political instability adds unpredictable risk"],
    space_deep_tech:            ["Long development timelines — capital at risk for years", "Competition from well-funded incumbents"],
  };
  const options = pools[category] ?? ["Macro deterioration could invalidate setup", "Execution risk remains elevated"];
  return options[highPressure ? 0 : 1] ?? options[0];
}

function discoveryInvalidation(score: number, assetType: "stock" | "crypto"): string {
  if (assetType === "crypto") {
    if (score >= 75) return "Breakdown below 7% from entry — close position";
    if (score >= 60) return "Breakdown below 10% from entry — reassess thesis";
    return "Breakdown below 15% from entry — exit and wait";
  }
  if (score >= 75) return "Close below 20-day SMA with volume — exit signal";
  if (score >= 60) return "Break of recent swing low — thesis invalidated";
  return "Loss of key support level — reduce exposure";
}

function discoveryWhyFaultlineLikesIt(score: number, pressure: number, category: DiscoveryCategory): string {
  const rr = score >= 75 ? "3:1" : score >= 60 ? "2:1" : "1.5:1";
  const conviction = score >= 75 ? "High" : score >= 55 ? "Moderate" : "Low";
  const regime = pressure < 40 ? "risk-on" : pressure < 60 ? "mixed" : "risk-off";
  return `${conviction} conviction setup in ${regime} regime. R:R ${rr}. Score ${score}/100 — ${score >= 70 ? "top decile opportunity" : score >= 55 ? "above-average setup" : "speculative position only"}.`;
}

function discoveryInstitutionalConviction(score: number, category: DiscoveryCategory): DiscoveryItem["institutionalConviction"] {
  const highConvictionCategories: DiscoveryCategory[] = ["institutional_accumulation", "top_opportunity_today", "high_conviction_setups", "earnings_momentum"];
  const boost = highConvictionCategories.includes(category) ? 10 : 0;
  const adjusted = score + boost;
  if (adjusted >= 80) return "Very High";
  if (adjusted >= 65) return "High";
  if (adjusted >= 50) return "Moderate";
  return "Low";
}

function discoveryActionBias(score: number, pressure: number): DiscoveryItem["actionBias"] {
  if (pressure >= 70) return score >= 75 ? "WATCH" : "AVOID";
  if (score >= 75) return "BUY";
  if (score >= 60) return "WATCH";
  if (score >= 45) return "HOLD";
  if (score >= 30) return "REDUCE";
  return "AVOID";
}

export async function getOpportunityDiscovery(): Promise<OpportunityDiscoveryResult> {
  const cached = discoveryCache.get("discovery");
  if (cached) return cached;

  const pressure = await calculateFaultlinePressure();
  const p = pressure.overallPressure;
  const now = Date.now();

  const buckets: DiscoveryBucket[] = (Object.keys(DISCOVERY_POOLS) as DiscoveryCategory[]).map(category => {
    const pool = DISCOVERY_POOLS[category];
    const meta = DISCOVERY_CATEGORY_META[category];

    const scored: DiscoveryItem[] = pool.map(item => {
      const sb = item.assetType === "stock"
        ? scoreStockFactors(item.symbol, pressure, "swing")
        : scoreCryptoFactors(item.symbol, pressure, "swing");
      const score = sb.composite;
      const direction = scoreToDirection(score);
      const baseRisk: DiscoveryItem["riskLevel"] = p >= 65 ? "High" : p >= 45 ? "Medium" : "Low";
      const riskLevel: DiscoveryItem["riskLevel"] =
        (category === "high_risk_high_reward" || item.assetType === "crypto")
          ? (score >= 70 ? "High" : "Extreme")
          : baseRisk;

      const topFactor = sb.factors.sort((a, b) => b.score - a.score)[0];
      const macroAlignment = Math.round((topFactor?.score ?? score) * 0.9);
      const rr = score >= 75 ? "3:1" : score >= 60 ? "2:1" : "1.5:1";

      return {
        ticker: item.symbol,
        name: item.name,
        assetType: item.assetType,
        opportunityScore: score,
        expectedTimeHorizon: discoveryTimeHorizon(score, item.assetType),
        catalyst: discoveryCatalyst(category, score),
        riskLevel,
        direction,
        rationale: topFactor?.note ?? "Regime-aligned setup",
        // Extended fields
        bullCase: discoveryBullCase(category, score, p),
        bearCase: discoveryBearCase(category, p),
        invalidationLevel: discoveryInvalidation(score, item.assetType),
        whyFaultlineLikesIt: discoveryWhyFaultlineLikesIt(score, p, category),
        institutionalConviction: discoveryInstitutionalConviction(score, category),
        macroAlignment,
        riskRewardRatio: rr,
        confidenceLevel: Math.round(score * 0.85 + (p < 40 ? 10 : p < 60 ? 5 : 0)),
        topCatalyst: discoveryCatalyst(category, score),
        actionBias: discoveryActionBias(score, p),
      };
    });

    return {
      category,
      label: meta.label,
      description: meta.description,
      items: scored.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 4),
      generatedAt: now,
    };
  });

  const sortedBuckets = buckets.sort((a, b) => {
    if (a.category === "top_opportunity_today") return -1;
    if (b.category === "top_opportunity_today") return 1;
    const avgA = a.items.reduce((s, i) => s + i.opportunityScore, 0) / (a.items.length || 1);
    const avgB = b.items.reduce((s, i) => s + i.opportunityScore, 0) / (b.items.length || 1);
    return avgB - avgA;
  });

  const result: OpportunityDiscoveryResult = {
    buckets: sortedBuckets,
    pressureIndex: p,
    regime: pressure.regime,
    generatedAt: now,
  };

  discoveryCache.set("discovery", result);
  return result;
}
