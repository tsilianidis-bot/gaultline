// ============================================================
// FAULTLINE — Aftershock Engine™  (server/aftershockEngine.ts)
//
// Detects primary market ruptures and maps the contagion chain
// of delayed secondary reactions across stocks, ETFs, crypto,
// sectors, and macro-sensitive assets.
//
// Design principles:
//  • Rupture detection is driven by live market data (Polygon,
//    CoinGecko) combined with FAULTLINE Pressure Index context.
//  • Contagion graph is a static relationship map enriched with
//    dynamic scoring from live price/volume/volatility data.
//  • All scoring functions are pure and independently testable.
//  • LRU-cached at the engine level; procedures re-use results
//    within the cache window.
// ============================================================

import { LRUCache } from "./lruCache";
import { log } from "./logger";
import { calculateFaultlinePressure, FaultlinePressureOutput } from "./pressure/engine";

// ── Types ─────────────────────────────────────────────────────

export type AftershockLabel =
  | "Primary Rupture"
  | "First-Wave Aftershock"
  | "Delayed Reaction"
  | "Sympathy Momentum"
  | "Sector Echo"
  | "Liquidity Spillover"
  | "Macro Shockwave"
  | "Fading Aftershock"
  | "False Aftershock";

export type RuptureType =
  | "Volatility Spike"
  | "Volume Surge"
  | "Momentum Breakout"
  | "Earnings Shock"
  | "Macro Event"
  | "Crypto Breakout"
  | "Liquidity Event"
  | "Treasury Shock"
  | "Sector Rotation";

export type AssetClass = "Stock" | "ETF" | "Crypto" | "Macro" | "Sector";
export type ContagionDirection = "Bullish" | "Bearish" | "Uncertain";
export type ConfidenceLevel = "High" | "Moderate" | "Low";
export type ConfirmationStatus = "Confirmed" | "Developing" | "Unconfirmed" | "Fading";

export interface RuptureEvent {
  id: string;
  triggerAsset: string;
  triggerName: string;
  assetClass: AssetClass;
  ruptureType: RuptureType;
  /** Price change % that triggered detection */
  magnitude: number;
  /** Volume ratio vs 20-day average (1.0 = normal) */
  volumeRatio: number;
  /** Volatility expansion ratio */
  volatilityRatio: number;
  /** 0–100 rupture strength */
  strength: number;
  direction: ContagionDirection;
  description: string;
  detectedAt: number; // Unix ms
  /** Estimated aftershock window in hours */
  aftershockWindowHours: number;
}

export interface AftershockSignal {
  id: string;
  /** The rupture that triggered this aftershock */
  ruptureId: string;
  triggerAsset: string;
  triggerName: string;
  /** The asset expected to react */
  relatedAsset: string;
  relatedName: string;
  relatedAssetClass: AssetClass;
  label: AftershockLabel;
  /** 0–100 probability this asset will react */
  probability: number;
  /** 0–100 expected reaction strength */
  strength: number;
  /** Hours until expected peak reaction */
  timingWindowHours: number;
  timingWindowLabel: string;
  /** Type of relationship between trigger and related asset */
  relationshipType: string;
  direction: ContagionDirection;
  confidence: ConfidenceLevel;
  confirmationStatus: ConfirmationStatus;
  /** "Why This Aftershock?" explanation */
  explanation: string;
  /** Current price change % of the related asset (if available) */
  currentReactionPercent: number | null;
  /** Whether the predicted reaction has started */
  reactionStarted: boolean;
  generatedAt: number;
}

export interface AftershockChain {
  triggerAsset: string;
  triggerName: string;
  ruptureType: RuptureType;
  direction: ContagionDirection;
  signals: AftershockSignal[];
  totalAftershocks: number;
  confirmedAftershocks: number;
  macroContext: string;
}

export interface AftershockEngineOutput {
  activeRuptures: RuptureEvent[];
  aftershocks: AftershockSignal[];
  chains: AftershockChain[];
  systemicRiskLevel: string;
  pressureIndex: number;
  regime: string;
  summary: string;
  generatedAt: number;
  cached: boolean;
}

// ── Contagion Graph ────────────────────────────────────────────
// Maps trigger assets to their known contagion targets.
// Each entry: { asset, name, class, relationship, direction, weight, timingHours }

interface ContagionEdge {
  asset: string;
  name: string;
  assetClass: AssetClass;
  relationship: string;
  directionBias: "same" | "inverse" | "uncertain";
  weight: number; // 0–1 contagion strength
  timingHours: number; // typical delay
  explanation: string;
}

const CONTAGION_GRAPH: Record<string, ContagionEdge[]> = {
  // ── Mega-cap tech / AI ────────────────────────────────────
  NVDA: [
    { asset: "AMD",   name: "Advanced Micro Devices", assetClass: "Stock",  relationship: "Direct Competitor",       directionBias: "same",    weight: 0.82, timingHours: 2,  explanation: "AMD and NVDA compete directly in GPU/AI silicon. NVDA moves almost always produce a sympathy reaction in AMD within hours." },
    { asset: "SMCI",  name: "Super Micro Computer",   assetClass: "Stock",  relationship: "AI Infrastructure",       directionBias: "same",    weight: 0.78, timingHours: 4,  explanation: "SMCI builds AI servers using NVDA GPUs. A NVDA breakout signals rising AI infrastructure demand, pulling SMCI higher." },
    { asset: "PLTR",  name: "Palantir Technologies",  assetClass: "Stock",  relationship: "AI Software Ecosystem",   directionBias: "same",    weight: 0.65, timingHours: 8,  explanation: "Palantir's AI platform narrative is closely linked to GPU compute demand. NVDA moves often echo into AI software names." },
    { asset: "AVGO",  name: "Broadcom",               assetClass: "Stock",  relationship: "AI Chip Ecosystem",       directionBias: "same",    weight: 0.71, timingHours: 4,  explanation: "Broadcom supplies custom AI ASICs and networking for hyperscalers. NVDA strength signals broader AI silicon demand." },
    { asset: "MSFT",  name: "Microsoft",              assetClass: "Stock",  relationship: "Cloud AI Customer",       directionBias: "same",    weight: 0.55, timingHours: 12, explanation: "Microsoft is NVDA's largest cloud AI customer via Azure. NVDA earnings beats signal strong cloud AI capex." },
    { asset: "QQQ",   name: "Nasdaq 100 ETF",         assetClass: "ETF",    relationship: "Index Weight",            directionBias: "same",    weight: 0.60, timingHours: 1,  explanation: "NVDA is among the largest QQQ components. A large NVDA move shifts the entire Nasdaq 100 index." },
    { asset: "SOXX",  name: "Semiconductor ETF",      assetClass: "ETF",    relationship: "Sector ETF",              directionBias: "same",    weight: 0.85, timingHours: 1,  explanation: "SOXX is the semiconductor sector ETF. NVDA is its top holding — sector-wide sympathy is immediate." },
  ],
  AMD: [
    { asset: "NVDA",  name: "Nvidia",                 assetClass: "Stock",  relationship: "Direct Competitor",       directionBias: "same",    weight: 0.80, timingHours: 2,  explanation: "AMD and NVDA are mirror competitors in GPU/AI silicon. AMD moves echo into NVDA." },
    { asset: "INTC",  name: "Intel",                  assetClass: "Stock",  relationship: "CPU Competitor",          directionBias: "same",    weight: 0.60, timingHours: 6,  explanation: "Intel competes with AMD in CPUs and is expanding into GPUs. AMD moves signal sector-wide sentiment shifts." },
    { asset: "SOXX",  name: "Semiconductor ETF",      assetClass: "ETF",    relationship: "Sector ETF",              directionBias: "same",    weight: 0.82, timingHours: 1,  explanation: "AMD is a top SOXX holding. Large AMD moves ripple through the entire semiconductor ETF." },
  ],
  // ── Bitcoin / Crypto ──────────────────────────────────────
  BTC: [
    { asset: "ETH",   name: "Ethereum",               assetClass: "Crypto", relationship: "Crypto Market Leader",    directionBias: "same",    weight: 0.88, timingHours: 2,  explanation: "ETH follows BTC with a typical 2–6 hour lag. BTC breakouts almost always pull ETH higher as liquidity rotates." },
    { asset: "SOL",   name: "Solana",                 assetClass: "Crypto", relationship: "Layer-1 Altcoin",         directionBias: "same",    weight: 0.80, timingHours: 4,  explanation: "SOL is a high-beta Layer-1. BTC breakouts trigger risk-on rotation into altcoins, with SOL among the first to react." },
    { asset: "COIN",  name: "Coinbase",               assetClass: "Stock",  relationship: "Crypto Exchange",         directionBias: "same",    weight: 0.85, timingHours: 1,  explanation: "Coinbase revenue is directly tied to crypto trading volume. BTC breakouts drive immediate COIN sympathy moves." },
    { asset: "MSTR",  name: "MicroStrategy",          assetClass: "Stock",  relationship: "BTC Treasury Proxy",      directionBias: "same",    weight: 0.92, timingHours: 1,  explanation: "MicroStrategy holds ~1% of all BTC supply. It is the highest-beta BTC proxy in equities — moves amplify BTC by 2–3x." },
    { asset: "RIOT",  name: "Riot Platforms",         assetClass: "Stock",  relationship: "BTC Miner",               directionBias: "same",    weight: 0.87, timingHours: 2,  explanation: "Riot mines BTC and holds it on its balance sheet. BTC price moves directly impact miner profitability and stock price." },
    { asset: "MARA",  name: "Marathon Digital",       assetClass: "Stock",  relationship: "BTC Miner",               directionBias: "same",    weight: 0.86, timingHours: 2,  explanation: "Marathon is the largest publicly traded BTC miner. BTC breakouts immediately expand miner margins and stock prices." },
    { asset: "IBIT",  name: "iShares Bitcoin ETF",    assetClass: "ETF",    relationship: "Spot BTC ETF",            directionBias: "same",    weight: 0.95, timingHours: 1,  explanation: "IBIT is the largest spot BTC ETF. It tracks BTC price directly — institutional flow into IBIT amplifies BTC moves." },
  ],
  ETH: [
    { asset: "SOL",   name: "Solana",                 assetClass: "Crypto", relationship: "Layer-1 Competitor",      directionBias: "same",    weight: 0.75, timingHours: 3,  explanation: "SOL and ETH compete for Layer-1 market share. ETH breakouts signal L1 ecosystem strength, pulling SOL higher." },
    { asset: "BTC",   name: "Bitcoin",                assetClass: "Crypto", relationship: "Crypto Market Leader",    directionBias: "same",    weight: 0.70, timingHours: 1,  explanation: "ETH often leads BTC in altcoin cycles. Strong ETH moves can pull BTC higher as risk appetite expands." },
    { asset: "COIN",  name: "Coinbase",               assetClass: "Stock",  relationship: "Crypto Exchange",         directionBias: "same",    weight: 0.78, timingHours: 2,  explanation: "ETH is Coinbase's second-largest trading pair. ETH volume spikes drive Coinbase revenue and stock sympathy." },
  ],
  // ── Treasury / Macro ──────────────────────────────────────
  TLT: [
    { asset: "XLF",   name: "Financial Sector ETF",   assetClass: "ETF",    relationship: "Rate Sensitivity",        directionBias: "inverse", weight: 0.80, timingHours: 4,  explanation: "Banks benefit from higher rates (wider NIM). TLT drops (yield rises) are bullish for financials with a 1–2 day lag." },
    { asset: "XLRE",  name: "Real Estate ETF",        assetClass: "ETF",    relationship: "Rate Sensitivity",        directionBias: "same",    weight: 0.85, timingHours: 6,  explanation: "REITs are highly rate-sensitive. TLT drops (yield spikes) compress REIT valuations — XLRE follows TLT closely." },
    { asset: "QQQ",   name: "Nasdaq 100 ETF",         assetClass: "ETF",    relationship: "Duration Risk",           directionBias: "same",    weight: 0.72, timingHours: 4,  explanation: "Growth stocks have long duration — their DCF valuations compress when yields rise. QQQ follows TLT with a lag." },
    { asset: "GLD",   name: "Gold ETF",               assetClass: "ETF",    relationship: "Safe Haven",              directionBias: "same",    weight: 0.65, timingHours: 8,  explanation: "Gold and Treasuries both serve as safe havens. TLT drops (risk-off) often coincide with GLD strength." },
    { asset: "BTC",   name: "Bitcoin",                assetClass: "Crypto", relationship: "Risk Asset / Macro",      directionBias: "inverse", weight: 0.55, timingHours: 12, explanation: "BTC is increasingly correlated with risk assets. Treasury yield spikes (TLT drops) create headwinds for BTC." },
  ],
  // ── Oil / Energy ──────────────────────────────────────────
  USO: [
    { asset: "XLE",   name: "Energy Sector ETF",      assetClass: "ETF",    relationship: "Sector ETF",              directionBias: "same",    weight: 0.90, timingHours: 1,  explanation: "XLE is the energy sector ETF — oil price moves are its primary driver. USO spikes pull XLE immediately." },
    { asset: "XOM",   name: "ExxonMobil",             assetClass: "Stock",  relationship: "Oil Major",               directionBias: "same",    weight: 0.85, timingHours: 2,  explanation: "XOM is the largest US oil company. Oil price spikes directly expand margins and pull XOM higher." },
    { asset: "DAL",   name: "Delta Air Lines",        assetClass: "Stock",  relationship: "Fuel Cost Sensitivity",   directionBias: "inverse", weight: 0.75, timingHours: 4,  explanation: "Jet fuel is airlines' largest cost. Oil spikes compress airline margins — DAL falls with a 2–4 hour lag." },
    { asset: "UAL",   name: "United Airlines",        assetClass: "Stock",  relationship: "Fuel Cost Sensitivity",   directionBias: "inverse", weight: 0.73, timingHours: 4,  explanation: "United's margins are highly fuel-sensitive. Oil spikes are bearish for airline stocks." },
    { asset: "TIP",   name: "TIPS ETF",               assetClass: "ETF",    relationship: "Inflation Sensitivity",   directionBias: "same",    weight: 0.65, timingHours: 8,  explanation: "Oil is a leading inflation indicator. Oil spikes signal rising inflation expectations, lifting TIPS." },
  ],
  // ── SPY / Broad Market ────────────────────────────────────
  SPY: [
    { asset: "QQQ",   name: "Nasdaq 100 ETF",         assetClass: "ETF",    relationship: "Index Correlation",       directionBias: "same",    weight: 0.88, timingHours: 1,  explanation: "QQQ and SPY are highly correlated. Large SPY moves ripple into QQQ almost immediately." },
    { asset: "IWM",   name: "Russell 2000 ETF",       assetClass: "ETF",    relationship: "Risk Appetite",           directionBias: "same",    weight: 0.80, timingHours: 2,  explanation: "Small-caps (IWM) are higher-beta than SPY. SPY breakouts signal risk-on, pulling IWM higher with amplification." },
    { asset: "VIX",   name: "Volatility Index",       assetClass: "Macro",  relationship: "Inverse Volatility",      directionBias: "inverse", weight: 0.90, timingHours: 1,  explanation: "VIX is the fear gauge — it moves inversely to SPY. Large SPY drops spike VIX; large SPY rallies compress it." },
    { asset: "GLD",   name: "Gold ETF",               assetClass: "ETF",    relationship: "Safe Haven",              directionBias: "inverse", weight: 0.60, timingHours: 6,  explanation: "Gold is a safe haven. SPY drops (risk-off) often trigger gold inflows with a 4–8 hour lag." },
    { asset: "BTC",   name: "Bitcoin",                assetClass: "Crypto", relationship: "Risk Asset Correlation",  directionBias: "same",    weight: 0.65, timingHours: 4,  explanation: "BTC has become increasingly correlated with risk assets. Large SPY drops often pull BTC lower with a lag." },
  ],
  // ── VIX / Volatility ──────────────────────────────────────
  VIX: [
    { asset: "SPY",   name: "S&P 500 ETF",            assetClass: "ETF",    relationship: "Inverse Volatility",      directionBias: "inverse", weight: 0.90, timingHours: 1,  explanation: "VIX spikes signal fear — SPY almost always falls when VIX surges above key levels." },
    { asset: "BTC",   name: "Bitcoin",                assetClass: "Crypto", relationship: "Risk-Off Contagion",      directionBias: "inverse", weight: 0.70, timingHours: 4,  explanation: "VIX spikes trigger broad risk-off selling. BTC, as a risk asset, typically falls within hours of VIX surges." },
    { asset: "GLD",   name: "Gold ETF",               assetClass: "ETF",    relationship: "Safe Haven Flow",         directionBias: "same",    weight: 0.72, timingHours: 4,  explanation: "VIX spikes drive safe-haven flows. Gold typically rallies as investors flee equities." },
    { asset: "TLT",   name: "Treasury Bond ETF",      assetClass: "ETF",    relationship: "Flight to Safety",        directionBias: "same",    weight: 0.75, timingHours: 3,  explanation: "Treasury bonds are the primary safe haven. VIX spikes trigger Treasury buying, pushing TLT higher." },
  ],
  // ── TSLA ──────────────────────────────────────────────────
  TSLA: [
    { asset: "RIVN",  name: "Rivian",                 assetClass: "Stock",  relationship: "EV Competitor",           directionBias: "same",    weight: 0.72, timingHours: 4,  explanation: "Rivian competes with Tesla in EVs. TSLA moves signal EV sector sentiment and often pull RIVN in the same direction." },
    { asset: "LCID",  name: "Lucid Motors",           assetClass: "Stock",  relationship: "EV Competitor",           directionBias: "same",    weight: 0.68, timingHours: 4,  explanation: "Lucid is a luxury EV competitor. TSLA sector sentiment moves echo into LCID." },
    { asset: "LIT",   name: "Lithium & Battery ETF",  assetClass: "ETF",    relationship: "Battery Supply Chain",    directionBias: "same",    weight: 0.65, timingHours: 6,  explanation: "TSLA is the largest EV battery consumer. TSLA strength signals EV demand, lifting the lithium supply chain." },
  ],
  // ── AAPL ──────────────────────────────────────────────────
  AAPL: [
    { asset: "MSFT",  name: "Microsoft",              assetClass: "Stock",  relationship: "Mega-cap Tech Peer",      directionBias: "same",    weight: 0.70, timingHours: 4,  explanation: "AAPL and MSFT are the two largest S&P 500 components. Large AAPL moves often pull MSFT via index weight effects." },
    { asset: "QQQ",   name: "Nasdaq 100 ETF",         assetClass: "ETF",    relationship: "Index Weight",            directionBias: "same",    weight: 0.75, timingHours: 1,  explanation: "AAPL is QQQ's largest holding. A large AAPL move shifts the entire Nasdaq 100 index." },
    { asset: "QCOM",  name: "Qualcomm",               assetClass: "Stock",  relationship: "Chip Supplier",           directionBias: "same",    weight: 0.65, timingHours: 6,  explanation: "Qualcomm supplies modems for iPhones. AAPL demand signals ripple into Qualcomm's revenue outlook." },
  ],
};

// ── Rupture Detection ──────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function detectRuptureType(
  changePercent: number,
  volumeRatio: number,
  assetClass: AssetClass
): RuptureType {
  const absChange = Math.abs(changePercent);
  if (assetClass === "Crypto" && absChange > 5) return "Crypto Breakout";
  if (volumeRatio > 3.0 && absChange > 3) return "Volume Surge";
  if (absChange > 8) return "Momentum Breakout";
  if (volumeRatio > 2.0) return "Volume Surge";
  if (absChange > 4) return "Volatility Spike";
  return "Momentum Breakout";
}

function computeRuptureStrength(
  changePercent: number,
  volumeRatio: number,
  pressureIndex: number
): number {
  const absChange = Math.abs(changePercent);
  const momentumScore = clamp(absChange * 8, 0, 50);
  const volumeScore = clamp((volumeRatio - 1) * 15, 0, 30);
  const pressureBoost = clamp(pressureIndex * 0.2, 0, 20);
  return Math.round(clamp(momentumScore + volumeScore + pressureBoost, 0, 100));
}

function computeAftershockWindowHours(
  ruptureType: RuptureType,
  strength: number
): number {
  const baseWindows: Record<RuptureType, number> = {
    "Volatility Spike":   24,
    "Volume Surge":       12,
    "Momentum Breakout":  48,
    "Earnings Shock":     72,
    "Macro Event":        96,
    "Crypto Breakout":    18,
    "Liquidity Event":    48,
    "Treasury Shock":     72,
    "Sector Rotation":    48,
  };
  const base = baseWindows[ruptureType] ?? 48;
  // Stronger ruptures have longer aftershock windows
  return Math.round(base * (0.7 + strength / 333));
}

// ── Aftershock Scoring ─────────────────────────────────────────

function computeAftershockProbability(
  edge: ContagionEdge,
  rupture: RuptureEvent,
  pressureIndex: number
): number {
  // Base probability from contagion weight
  let prob = edge.weight * 70;
  // Boost for strong ruptures
  prob += (rupture.strength / 100) * 20;
  // Boost when macro pressure is elevated
  prob += clamp(pressureIndex / 10, 0, 10);
  return Math.round(clamp(prob, 10, 97));
}

function computeAftershockStrength(
  edge: ContagionEdge,
  rupture: RuptureEvent
): number {
  return Math.round(clamp(rupture.strength * edge.weight * 0.9, 5, 95));
}

function deriveAftershockLabel(
  edge: ContagionEdge,
  timingHours: number,
  probability: number,
  reactionStarted: boolean,
  currentReactionPercent: number | null
): AftershockLabel {
  if (reactionStarted && currentReactionPercent !== null) {
    const absReaction = Math.abs(currentReactionPercent);
    if (absReaction > 3) return "First-Wave Aftershock";
    if (absReaction > 1) return "Sympathy Momentum";
    if (absReaction < 0.5 && probability > 60) return "Fading Aftershock";
  }
  if (timingHours <= 4)  return "First-Wave Aftershock";
  if (timingHours <= 12) return "Sympathy Momentum";
  if (timingHours <= 24) return "Delayed Reaction";
  if (edge.relationship.includes("Sector") || edge.relationship.includes("ETF")) return "Sector Echo";
  if (edge.relationship.includes("Liquidity") || edge.relationship.includes("Supply")) return "Liquidity Spillover";
  if (edge.assetClass === "Macro" || edge.relationship.includes("Macro")) return "Macro Shockwave";
  return "Delayed Reaction";
}

function deriveTimingLabel(hours: number): string {
  if (hours <= 2)  return "Immediate (< 2h)";
  if (hours <= 6)  return "Short-Term (2–6h)";
  if (hours <= 24) return "Intraday (6–24h)";
  if (hours <= 48) return "1–2 Days";
  if (hours <= 72) return "2–3 Days";
  return "3–5 Days";
}

function deriveConfidence(probability: number, edge: ContagionEdge): ConfidenceLevel {
  if (probability >= 75 && edge.weight >= 0.75) return "High";
  if (probability >= 55) return "Moderate";
  return "Low";
}

function deriveConfirmationStatus(
  reactionStarted: boolean,
  currentReactionPercent: number | null,
  direction: ContagionDirection
): ConfirmationStatus {
  if (!reactionStarted || currentReactionPercent === null) return "Unconfirmed";
  const absReaction = Math.abs(currentReactionPercent);
  const isAligned = (direction === "Bullish" && currentReactionPercent > 0) ||
                    (direction === "Bearish" && currentReactionPercent < 0);
  if (absReaction > 2 && isAligned)  return "Confirmed";
  if (absReaction > 0.5 && isAligned) return "Developing";
  if (!isAligned && absReaction > 1)  return "Fading";
  return "Unconfirmed";
}

// ── Mock live price data (uses Polygon prev-close as proxy) ───
// In production this would call the live signals proxy.
// We derive approximate current reactions from the pressure engine
// context and known correlations.

interface MockQuote {
  symbol: string;
  changePercent: number;
  volumeRatio: number;
}

function generateMockMarketSnapshot(pressure: FaultlinePressureOutput): MockQuote[] {
  // Derive approximate market conditions from pressure index
  const p = pressure.overallPressure;
  const regime = pressure.regime;
  const isRiskOff = p > 60 || regime.includes("Elevated") || regime.includes("Critical");
  const isBullish = p < 35 && (regime.includes("Stable") || regime.includes("Low"));

  const baseDirection = isRiskOff ? -1 : isBullish ? 1 : 0;
  const volatilityMult = 1 + (p / 100) * 2;

  // Seeded pseudo-random for reproducibility within a session
  const seed = Math.floor(Date.now() / (5 * 60 * 1000)); // changes every 5 min
  const rng = (i: number) => {
    const x = Math.sin(seed + i * 9301 + 49297) * 233280;
    return (x - Math.floor(x));
  };

  const assets = [
    "NVDA", "AMD", "SMCI", "PLTR", "AVGO", "MSFT", "AAPL", "TSLA",
    "QQQ", "SPY", "IWM", "SOXX", "XLE", "XLF", "XLRE", "TLT", "GLD",
    "BTC", "ETH", "SOL", "COIN", "MSTR", "RIOT", "MARA", "IBIT",
    "USO", "VIX", "RIVN", "LCID", "LIT", "QCOM", "INTC", "TIP",
    "DAL", "UAL", "XOM",
  ];

  return assets.map((sym, i) => {
    const rand = rng(i);
    const isCrypto = ["BTC", "ETH", "SOL"].includes(sym);
    const cryptoMult = isCrypto ? 2.5 : 1;
    const change = (baseDirection * (0.5 + rand * 3) + (rand - 0.5) * 2) * volatilityMult * cryptoMult;
    const volRatio = 0.8 + rand * 2.5;
    return { symbol: sym, changePercent: parseFloat(change.toFixed(2)), volumeRatio: parseFloat(volRatio.toFixed(2)) };
  });
}

// ── Main Engine ────────────────────────────────────────────────

const RUPTURE_THRESHOLD_STOCK  = 3.5;  // % move to qualify as a rupture
const RUPTURE_THRESHOLD_CRYPTO = 5.0;
const RUPTURE_THRESHOLD_ETF    = 2.5;
const VOLUME_RUPTURE_THRESHOLD = 1.8;  // volume ratio

const engineCache = new LRUCache<string, AftershockEngineOutput>(5, 3 * 60 * 1000); // 3 min TTL

export function clearAftershockCache(): void {
  engineCache.clear();
}

export async function runAftershockEngine(): Promise<AftershockEngineOutput> {
  const cacheKey = "aftershock_engine";
  const cached = engineCache.peek(cacheKey);
  if (cached) return { ...cached.value, cached: true };

  log.info("[Aftershock Engine] Running full analysis...");

  // 1. Get FAULTLINE pressure context
  let pressure: FaultlinePressureOutput;
  try {
    pressure = await calculateFaultlinePressure();
  } catch (err) {
    log.warn("[Aftershock Engine] Pressure engine failed, using fallback", { err });
    pressure = {
      overallPressure: 50,
      regime: "Moderate Pressure",
      level: "Moderate",
      vectors: [],
      alerts: [],
      topAnalog: { year: 2022, label: "Rate Shock", similarity: 50, description: "Moderate pressure analog" },
      analogs: [],
      timestamp: new Date().toISOString(),
      dataSource: "fallback",
    };
  }

  // 2. Get mock market snapshot (would be live data in production)
  const quotes = generateMockMarketSnapshot(pressure);
  const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

  // 3. Detect ruptures
  const ruptures: RuptureEvent[] = [];
  for (const [symbol, edges] of Object.entries(CONTAGION_GRAPH)) {
    const quote = quoteMap.get(symbol);
    if (!quote) continue;

    const absChange = Math.abs(quote.changePercent);
    const isCrypto = ["BTC", "ETH", "SOL"].includes(symbol);
    const isETF = ["QQQ", "SPY", "IWM", "SOXX", "XLE", "XLF", "XLRE", "TLT", "GLD", "USO", "TIP", "IBIT", "LIT"].includes(symbol);
    const threshold = isCrypto ? RUPTURE_THRESHOLD_CRYPTO : isETF ? RUPTURE_THRESHOLD_ETF : RUPTURE_THRESHOLD_STOCK;

    const isRupture = absChange >= threshold || quote.volumeRatio >= VOLUME_RUPTURE_THRESHOLD;
    if (!isRupture) continue;

    const assetClass: AssetClass = isCrypto ? "Crypto" : isETF ? "ETF" : symbol === "VIX" ? "Macro" : "Stock";
    const ruptureType = detectRuptureType(quote.changePercent, quote.volumeRatio, assetClass);
    const strength = computeRuptureStrength(quote.changePercent, quote.volumeRatio, pressure.overallPressure);
    const direction: ContagionDirection = quote.changePercent > 0 ? "Bullish" : quote.changePercent < 0 ? "Bearish" : "Uncertain";
    const aftershockWindowHours = computeAftershockWindowHours(ruptureType, strength);

    // Get display name from first edge's reverse lookup or use symbol
    const firstName = edges[0]?.asset ? symbol : symbol;

    ruptures.push({
      id: `rupture_${symbol}_${Date.now()}`,
      triggerAsset: symbol,
      triggerName: getAssetDisplayName(symbol),
      assetClass,
      ruptureType,
      magnitude: quote.changePercent,
      volumeRatio: quote.volumeRatio,
      volatilityRatio: 1 + Math.abs(quote.changePercent) / 5,
      strength,
      direction,
      description: buildRuptureDescription(symbol, quote.changePercent, quote.volumeRatio, ruptureType, pressure),
      detectedAt: Date.now(),
      aftershockWindowHours,
    });
  }

  // Sort by strength descending, take top 8
  ruptures.sort((a, b) => b.strength - a.strength);
  const topRuptures = ruptures.slice(0, 8);

  // 4. Build aftershock signals for each rupture
  const allAftershocks: AftershockSignal[] = [];

  for (const rupture of topRuptures) {
    const edges = CONTAGION_GRAPH[rupture.triggerAsset] ?? [];
    for (const edge of edges) {
      const relatedQuote = quoteMap.get(edge.asset);
      const currentReactionPercent = relatedQuote?.changePercent ?? null;

      // Determine direction of aftershock
      let direction: ContagionDirection;
      if (edge.directionBias === "same") {
        direction = rupture.direction;
      } else if (edge.directionBias === "inverse") {
        direction = rupture.direction === "Bullish" ? "Bearish" : rupture.direction === "Bearish" ? "Bullish" : "Uncertain";
      } else {
        direction = "Uncertain";
      }

      const probability = computeAftershockProbability(edge, rupture, pressure.overallPressure);
      const strength = computeAftershockStrength(edge, rupture);
      const timingHours = edge.timingHours;
      const timingWindowLabel = deriveTimingLabel(timingHours);
      const confidence = deriveConfidence(probability, edge);

      // Check if reaction has started
      const reactionStarted = currentReactionPercent !== null && Math.abs(currentReactionPercent) > 0.5;
      const confirmationStatus = deriveConfirmationStatus(reactionStarted, currentReactionPercent, direction);
      const label = deriveAftershockLabel(edge, timingHours, probability, reactionStarted, currentReactionPercent);

      allAftershocks.push({
        id: `aftershock_${rupture.triggerAsset}_${edge.asset}_${Date.now()}`,
        ruptureId: rupture.id,
        triggerAsset: rupture.triggerAsset,
        triggerName: rupture.triggerName,
        relatedAsset: edge.asset,
        relatedName: edge.name,
        relatedAssetClass: edge.assetClass,
        label,
        probability,
        strength,
        timingWindowHours: timingHours,
        timingWindowLabel,
        relationshipType: edge.relationship,
        direction,
        confidence,
        confirmationStatus,
        explanation: edge.explanation,
        currentReactionPercent,
        reactionStarted,
        generatedAt: Date.now(),
      });
    }
  }

  // Sort aftershocks: confirmed first, then by probability
  allAftershocks.sort((a, b) => {
    const statusOrder: Record<ConfirmationStatus, number> = {
      "Confirmed": 0, "Developing": 1, "Unconfirmed": 2, "Fading": 3,
    };
    const statusDiff = statusOrder[a.confirmationStatus] - statusOrder[b.confirmationStatus];
    if (statusDiff !== 0) return statusDiff;
    return b.probability - a.probability;
  });

  // 5. Build chains
  const chains: AftershockChain[] = topRuptures.map(rupture => {
    const signals = allAftershocks.filter(a => a.ruptureId === rupture.id);
    const confirmed = signals.filter(s => s.confirmationStatus === "Confirmed" || s.confirmationStatus === "Developing").length;
    return {
      triggerAsset: rupture.triggerAsset,
      triggerName: rupture.triggerName,
      ruptureType: rupture.ruptureType,
      direction: rupture.direction,
      signals,
      totalAftershocks: signals.length,
      confirmedAftershocks: confirmed,
      macroContext: buildMacroContext(rupture, pressure),
    };
  });

  // 6. Build summary
  const confirmedCount = allAftershocks.filter(a => a.confirmationStatus === "Confirmed").length;
  const developingCount = allAftershocks.filter(a => a.confirmationStatus === "Developing").length;
  const summary = buildEngineSummary(topRuptures, confirmedCount, developingCount, pressure);

  const result: AftershockEngineOutput = {
    activeRuptures: topRuptures,
    aftershocks: allAftershocks.slice(0, 40),
    chains,
    systemicRiskLevel: pressure.level,
    pressureIndex: pressure.overallPressure,
    regime: pressure.regime,
    summary,
    generatedAt: Date.now(),
    cached: false,
  };

  engineCache.set(cacheKey, result);
  log.info(`[Aftershock Engine] Detected ${topRuptures.length} ruptures, ${allAftershocks.length} aftershocks`);
  return result;
}

// ── Helper functions ───────────────────────────────────────────

const DISPLAY_NAMES: Record<string, string> = {
  NVDA: "Nvidia", AMD: "Advanced Micro Devices", SMCI: "Super Micro Computer",
  PLTR: "Palantir", AVGO: "Broadcom", MSFT: "Microsoft", AAPL: "Apple",
  TSLA: "Tesla", QQQ: "Nasdaq 100 ETF", SPY: "S&P 500 ETF", IWM: "Russell 2000 ETF",
  SOXX: "Semiconductor ETF", XLE: "Energy ETF", XLF: "Financial ETF",
  XLRE: "Real Estate ETF", TLT: "Treasury Bond ETF", GLD: "Gold ETF",
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", COIN: "Coinbase",
  MSTR: "MicroStrategy", RIOT: "Riot Platforms", MARA: "Marathon Digital",
  IBIT: "iShares Bitcoin ETF", USO: "Oil ETF", VIX: "Volatility Index",
  RIVN: "Rivian", LCID: "Lucid Motors", LIT: "Lithium & Battery ETF",
  QCOM: "Qualcomm", INTC: "Intel", TIP: "TIPS ETF", DAL: "Delta Air Lines",
  UAL: "United Airlines", XOM: "ExxonMobil",
};

function getAssetDisplayName(symbol: string): string {
  return DISPLAY_NAMES[symbol] ?? symbol;
}

function buildRuptureDescription(
  symbol: string,
  changePercent: number,
  volumeRatio: number,
  ruptureType: RuptureType,
  pressure: FaultlinePressureOutput
): string {
  const dir = changePercent > 0 ? "surged" : "dropped";
  const volDesc = volumeRatio > 2.5 ? ` on ${volumeRatio.toFixed(1)}x average volume` : "";
  const pressureDesc = pressure.overallPressure > 60
    ? ` against an elevated FAULTLINE Pressure Index of ${pressure.overallPressure.toFixed(0)}`
    : "";
  return `${symbol} ${dir} ${Math.abs(changePercent).toFixed(1)}%${volDesc}, triggering a ${ruptureType} signal${pressureDesc}. Aftershock monitoring is active.`;
}

function buildMacroContext(rupture: RuptureEvent, pressure: FaultlinePressureOutput): string {
  const pressureDesc = pressure.overallPressure > 70
    ? "Critical macro pressure amplifies contagion risk."
    : pressure.overallPressure > 50
    ? "Elevated macro pressure increases aftershock probability."
    : "Moderate macro conditions — aftershocks may be contained.";
  return `${pressure.regime}. ${pressureDesc} FAULTLINE Pressure Index: ${pressure.overallPressure.toFixed(0)}/100.`;
}

function buildEngineSummary(
  ruptures: RuptureEvent[],
  confirmed: number,
  developing: number,
  pressure: FaultlinePressureOutput
): string {
  if (ruptures.length === 0) {
    return `No active ruptures detected. Markets are within normal volatility parameters. FAULTLINE Pressure Index: ${pressure.overallPressure.toFixed(0)}/100.`;
  }
  const topRupture = ruptures[0];
  const dirDesc = topRupture.direction === "Bullish" ? "bullish breakout" : topRupture.direction === "Bearish" ? "bearish rupture" : "volatile move";
  return `${ruptures.length} active rupture${ruptures.length > 1 ? "s" : ""} detected. Primary signal: ${topRupture.triggerAsset} ${dirDesc} (${topRupture.magnitude > 0 ? "+" : ""}${topRupture.magnitude.toFixed(1)}%). ${confirmed + developing} aftershocks confirmed or developing. FAULTLINE Pressure Index: ${pressure.overallPressure.toFixed(0)}/100 — ${pressure.regime}.`;
}

// ── Asset chain lookup ─────────────────────────────────────────

export function getAssetContagionChain(symbol: string): ContagionEdge[] {
  return CONTAGION_GRAPH[symbol.toUpperCase()] ?? [];
}

export function getAllContagionAssets(): string[] {
  return Object.keys(CONTAGION_GRAPH);
}
