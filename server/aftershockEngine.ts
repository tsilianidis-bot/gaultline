// ============================================================
// FAULTLINE — Aftershock Engine™ (server/aftershockEngine.ts)
//
// Observed market changes use completed, source-backed daily bars only.
// The static contagion graph remains a methodology assumption; it is not a
// calibrated forecast and is never emitted as an observed market fact.
// ============================================================

import { LRUCache } from "./lruCache";
import { log } from "./logger";
import { getDailyBars, type YahooDailyBar } from "./yahooProxy";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { projectPressureFromCanonical } from "./canonicalPressureProjection";
import { etDate, isSessionComplete } from "./sectorRotation/calc";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import type { EngineEvidenceStatus } from "../shared/snapshotEvidence";
import type { FaultlinePressureOutput } from "./pressure/engine";

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
export type AftershockAvailability = "AVAILABLE" | "UNAVAILABLE";
export type AftershockObservationSource = "yahoo-daily";

/** Completed daily-bar observation with the provider symbol and local receipt retained separately. */
export interface ObservedAftershockQuote {
  symbol: string;
  providerSymbol: string;
  changePercent: number;
  volumeRatio: number;
  observedAt: number;
  receivedAt: number;
  source: AftershockObservationSource;
  freshness: "DELAYED";
  availability: "AVAILABLE";
}

export interface AftershockMarketSnapshot {
  availability: AftershockAvailability;
  quotes: ObservedAftershockQuote[];
  reason: string | null;
}

export interface AftershockGraphModelMetadata {
  modelId: "aftershock-static-contagion-graph";
  modelVersion: "static-graph-v1";
  methodologyVersion: "aftershock-methodology-v1";
  modelDerived: true;
  calibrationStatus: "NOT_CALIBRATED";
  probabilityStatus: "NOT_ESTABLISHED";
}

export interface RuptureEvent {
  id: string;
  triggerAsset: string;
  triggerName: string;
  assetClass: AssetClass;
  ruptureType: RuptureType;
  /** Observed completed-bar close-to-close price change %. */
  magnitude: number;
  /** Observed latest volume divided by the prior 20 completed bars' mean volume. */
  volumeRatio: number;
  /** Derived descriptive metric, not a provider volatility observation. */
  volatilityRatio: number;
  /** Derived methodology output, not a calibrated score. */
  strength: number;
  direction: ContagionDirection;
  description: string;
  detectedAt: number;
  aftershockWindowHours: number;
  source: AftershockObservationSource;
  observedAt: number;
  receivedAt: number;
  availability: "AVAILABLE";
  evidenceStatus: "DELAYED";
  canonicalStateId: string;
  sourceInputIds: string[];
  modelDerived: true;
  methodologyVersion: "aftershock-methodology-v1";
}

export interface AftershockSignal {
  id: string;
  ruptureId: string;
  triggerAsset: string;
  triggerName: string;
  relatedAsset: string;
  relatedName: string;
  relatedAssetClass: AssetClass;
  label: AftershockLabel;
  /** Withheld: the static graph has no authorized calibrated forecast contract. */
  probability: null;
  /** Graph-derived strength; it is not a calibrated probability or observed reaction magnitude. */
  strength: number;
  timingWindowHours: number;
  timingWindowLabel: string;
  relationshipType: string;
  direction: ContagionDirection;
  /** Withheld: no calibrated confidence metric exists. */
  confidence: null;
  confirmationStatus: ConfirmationStatus;
  /** Methodology explanation for a static graph edge, not an observed causal claim. */
  explanation: string;
  currentReactionPercent: number | null;
  reactionStarted: boolean;
  generatedAt: number;
  source: "aftershock-static-contagion-graph";
  observedAt: number;
  receivedAt: number;
  availability: "AVAILABLE";
  evidenceStatus: "DELAYED";
  canonicalStateId: string;
  sourceInputIds: string[];
  reactionSource: AftershockObservationSource | null;
  reactionObservedAt: number | null;
  reactionReceivedAt: number | null;
  reactionAvailability: AftershockAvailability;
  modelDerived: true;
  methodologyVersion: "aftershock-methodology-v1";
  model: AftershockGraphModelMetadata;
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
  model: AftershockGraphModelMetadata;
}

export interface AftershockEngineOutput {
  availability: AftershockAvailability;
  evidenceStatus: EngineEvidenceStatus;
  reason: string | null;
  /** Observation provider used by this run; null when no usable quote was available. */
  source: AftershockObservationSource | null;
  /** Latest provider observation represented in this run, never response-generation time. */
  observedAt: number | null;
  /** Local provider-receipt time, retained separately from observedAt. */
  receivedAt: number | null;
  canonicalStateId: string | null;
  canonicalInputSnapshotId: string | null;
  canonicalAsOf: string | null;
  activeRuptures: RuptureEvent[];
  aftershocks: AftershockSignal[];
  chains: AftershockChain[];
  systemicRiskLevel: string | null;
  pressureIndex: number | null;
  regime: string | null;
  summary: string;
  model: AftershockGraphModelMetadata;
  generatedAt: number;
  cached: boolean;
}

export type AftershockMarketSnapshotProvider = (now: number) => Promise<AftershockMarketSnapshot>;
export type AftershockCanonicalStateProvider = () => Promise<CanonicalIntelligenceState | null>;

export interface AftershockEngineDependencies {
  /** Test seam; the production default only uses the existing Yahoo completed daily-bar adapter. */
  marketSnapshotProvider?: AftershockMarketSnapshotProvider;
  /** Test seam; the production default is the read-only canonical-state accessor. */
  canonicalStateProvider?: AftershockCanonicalStateProvider;
  /** Test seam. It never substitutes for a provider observation time. */
  now?: () => number;
}

// ── Contagion Graph ────────────────────────────────────────────
// Static graph weights/timing/explanations are methodology assumptions. They
// are shown only as model-derived context and have no calibration claim.

interface ContagionEdge {
  asset: string;
  name: string;
  assetClass: AssetClass;
  relationship: string;
  directionBias: "same" | "inverse" | "uncertain";
  weight: number;
  timingHours: number;
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

const GRAPH_MODEL: AftershockGraphModelMetadata = {
  modelId: "aftershock-static-contagion-graph",
  modelVersion: "static-graph-v1",
  methodologyVersion: "aftershock-methodology-v1",
  modelDerived: true,
  calibrationStatus: "NOT_CALIBRATED",
  probabilityStatus: "NOT_ESTABLISHED",
};

const RUPTURE_THRESHOLD_STOCK = 3.5;
const RUPTURE_THRESHOLD_CRYPTO = 5.0;
const RUPTURE_THRESHOLD_ETF = 2.5;
const VOLUME_RUPTURE_THRESHOLD = 1.8;

/** Yahoo symbols are explicit so internal contagion tickers cannot leak into provider calls unchanged. */
const YAHOO_SYMBOLS: Readonly<Record<string, string>> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
  VIX: "^VIX",
};

const ETF_SYMBOLS = new Set(["QQQ", "SPY", "IWM", "SOXX", "XLE", "XLF", "XLRE", "TLT", "GLD", "USO", "TIP", "IBIT", "LIT"]);
const CRYPTO_SYMBOLS = new Set(["BTC", "ETH", "SOL"]);

const engineCache = new LRUCache<string, AftershockEngineOutput>(5, 3 * 60 * 1000);

export function clearAftershockCache(): void {
  engineCache.clear();
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function stableInputId(quote: ObservedAftershockQuote): string {
  return `market:${quote.source}:${quote.symbol}:${quote.observedAt}`;
}

function canonicalEvidenceStatus(state: CanonicalIntelligenceState): EngineEvidenceStatus {
  if (state.confidenceOrEvidenceQuality === "UNAVAILABLE" || state.unavailableInputs.length > 0) return "UNAVAILABLE";
  if (state.staleInputs.length > 0) return "STALE";
  if (state.fallbackInputs.length > 0) return "FALLBACK";
  if (state.delayedInputs.length > 0) return "DELAYED";
  return "CURRENT";
}

function mostConservativeStatus(...statuses: EngineEvidenceStatus[]): EngineEvidenceStatus {
  const rank: Record<EngineEvidenceStatus, number> = {
    UNAVAILABLE: 5, STALE: 4, FALLBACK: 3, DELAYED: 2, CURRENT: 1,
  };
  return statuses.reduce((worst, status) => rank[status] > rank[worst] ? status : worst, "CURRENT");
}

/**
 * Maps a graph ticker to the provider ticker deliberately. Crypto quote values
 * are only admitted through Yahoo's own completed daily bars (e.g. BTC-USD),
 * never synthesized from CoinGecko's 24h fields or a Polygon/Yahoo quote mix.
 */
export function normalizeAftershockTicker(symbol: string): string | null {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized || !DISPLAY_NAMES[normalized]) return null;
  return YAHOO_SYMBOLS[normalized] ?? normalized;
}

function completedBars(bars: readonly YahooDailyBar[], now: number): YahooDailyBar[] {
  return [...bars]
    .filter(bar => Number.isFinite(bar.timestamp) && isSessionComplete(etDate(bar.timestamp), now))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Converts 21 valid completed daily bars into one reproducible observation.
 * Baseline is precisely the twenty bars preceding the latest bar; no values
 * are generated or defaulted. `receivedAt` is caller-supplied so fixtures can
 * replay byte-for-byte without treating Date.now() as an observation.
 */
export function toObservedAftershockQuote(
  symbol: string,
  bars: readonly YahooDailyBar[],
  receivedAt = Date.now(),
  now = receivedAt,
  providerSymbol = normalizeAftershockTicker(symbol) ?? symbol,
): ObservedAftershockQuote | null {
  const completed = completedBars(bars, now).filter(bar => (
    Number.isFinite(bar.close) && bar.close > 0
    && Number.isFinite(bar.volume) && bar.volume > 0
    && Number.isFinite(bar.timestamp)
  ));
  if (completed.length < 21 || !Number.isFinite(receivedAt)) return null;
  const latest = completed.at(-1)!;
  const prior = completed.at(-2)!;
  const baseline = completed.slice(-21, -1);
  const average20 = baseline.reduce((sum, bar) => sum + bar.volume, 0) / baseline.length;
  if (!Number.isFinite(prior.close) || prior.close <= 0 || !Number.isFinite(average20) || average20 <= 0) return null;
  const changePercent = ((latest.close - prior.close) / prior.close) * 100;
  const volumeRatio = latest.volume / average20;
  if (!Number.isFinite(changePercent) || !Number.isFinite(volumeRatio) || volumeRatio <= 0) return null;
  return {
    symbol: symbol.trim().toUpperCase(),
    providerSymbol,
    changePercent,
    volumeRatio,
    observedAt: latest.timestamp,
    receivedAt,
    source: "yahoo-daily",
    freshness: "DELAYED",
    availability: "AVAILABLE",
  };
}

function aftershockSymbols(): string[] {
  return Array.from(new Set([
    ...Object.keys(CONTAGION_GRAPH),
    ...Object.values(CONTAGION_GRAPH).flatMap(edges => edges.map(edge => edge.asset)),
  ])).sort();
}

/** Production observation adapter. Existing CoinGecko OHLC lacks a volume field, so it is intentionally not coerced into this contract. */
async function fetchObservedMarketSnapshot(now: number): Promise<AftershockMarketSnapshot> {
  const receivedAt = now;
  const observations = await Promise.all(aftershockSymbols().map(async symbol => {
    const providerSymbol = normalizeAftershockTicker(symbol);
    if (!providerSymbol) return null;
    try {
      const bars = await getDailyBars(providerSymbol, "3mo");
      return toObservedAftershockQuote(symbol, bars, receivedAt, now, providerSymbol);
    } catch (error) {
      log.warn("[Aftershock Engine] Daily-bar observation unavailable", { symbol, error });
      return null;
    }
  }));
  const quotes = observations.filter((quote): quote is ObservedAftershockQuote => quote !== null);
  if (quotes.length === 0) {
    return {
      availability: "UNAVAILABLE",
      quotes: [],
      reason: "Completed Yahoo daily-bar observations with a 20-session volume baseline are unavailable.",
    };
  }
  return { availability: "AVAILABLE", quotes, reason: null };
}

function assetClass(symbol: string): AssetClass {
  if (CRYPTO_SYMBOLS.has(symbol)) return "Crypto";
  if (ETF_SYMBOLS.has(symbol)) return "ETF";
  if (symbol === "VIX") return "Macro";
  return "Stock";
}

function ruptureThreshold(symbol: string): number {
  return CRYPTO_SYMBOLS.has(symbol) ? RUPTURE_THRESHOLD_CRYPTO : ETF_SYMBOLS.has(symbol) ? RUPTURE_THRESHOLD_ETF : RUPTURE_THRESHOLD_STOCK;
}

function detectRuptureType(changePercent: number, volumeRatio: number, klass: AssetClass): RuptureType {
  const magnitude = Math.abs(changePercent);
  if (klass === "Crypto" && magnitude > 5) return "Crypto Breakout";
  if (volumeRatio > 3 && magnitude > 3) return "Volume Surge";
  if (magnitude > 8) return "Momentum Breakout";
  if (volumeRatio > 2) return "Volume Surge";
  if (magnitude > 4) return "Volatility Spike";
  return "Momentum Breakout";
}

function computeRuptureStrength(changePercent: number, volumeRatio: number, pressureIndex: number): number {
  const momentumScore = clamp(Math.abs(changePercent) * 8, 0, 50);
  const volumeScore = clamp((volumeRatio - 1) * 15, 0, 30);
  const macroContribution = clamp(pressureIndex * 0.2, 0, 20);
  return Math.round(clamp(momentumScore + volumeScore + macroContribution, 0, 100));
}

function computeAftershockWindowHours(ruptureType: RuptureType, strength: number): number {
  const baseWindows: Record<RuptureType, number> = {
    "Volatility Spike": 24, "Volume Surge": 12, "Momentum Breakout": 48,
    "Earnings Shock": 72, "Macro Event": 96, "Crypto Breakout": 18,
    "Liquidity Event": 48, "Treasury Shock": 72, "Sector Rotation": 48,
  };
  return Math.round((baseWindows[ruptureType] ?? 48) * (0.7 + strength / 333));
}

function computeAftershockStrength(edge: ContagionEdge, rupture: RuptureEvent): number {
  return Math.round(clamp(rupture.strength * edge.weight * 0.9, 5, 95));
}

function deriveAftershockLabel(edge: ContagionEdge, timingHours: number, reactionStarted: boolean, reactionPercent: number | null): AftershockLabel {
  if (reactionStarted && reactionPercent !== null) {
    const absolute = Math.abs(reactionPercent);
    if (absolute > 3) return "First-Wave Aftershock";
    if (absolute > 1) return "Sympathy Momentum";
  }
  if (timingHours <= 4) return "First-Wave Aftershock";
  if (timingHours <= 12) return "Sympathy Momentum";
  if (timingHours <= 24) return "Delayed Reaction";
  if (edge.relationship.includes("Sector") || edge.relationship.includes("ETF")) return "Sector Echo";
  if (edge.relationship.includes("Liquidity") || edge.relationship.includes("Supply")) return "Liquidity Spillover";
  if (edge.assetClass === "Macro" || edge.relationship.includes("Macro")) return "Macro Shockwave";
  return "Delayed Reaction";
}

function deriveTimingLabel(hours: number): string {
  if (hours <= 2) return "Immediate (< 2h)";
  if (hours <= 6) return "Short-Term (2–6h)";
  if (hours <= 24) return "Intraday (6–24h)";
  if (hours <= 48) return "1–2 Days";
  if (hours <= 72) return "2–3 Days";
  return "3–5 Days";
}

/** Confirmation is allowed only where a separately observed related quote is direction-aligned. */
function deriveConfirmationStatus(reactionStarted: boolean, reactionPercent: number | null, direction: ContagionDirection): ConfirmationStatus {
  if (!reactionStarted || reactionPercent === null) return "Unconfirmed";
  const aligned = (direction === "Bullish" && reactionPercent > 0) || (direction === "Bearish" && reactionPercent < 0);
  const magnitude = Math.abs(reactionPercent);
  if (aligned && magnitude > 2) return "Confirmed";
  if (aligned && magnitude > 0.5) return "Developing";
  if (!aligned && magnitude > 1) return "Fading";
  return "Unconfirmed";
}

function unavailableOutput(
  now: number,
  reason: string,
  canonical: CanonicalIntelligenceState | null,
): AftershockEngineOutput {
  return {
    availability: "UNAVAILABLE",
    evidenceStatus: "UNAVAILABLE",
    reason,
    source: null,
    observedAt: null,
    receivedAt: null,
    canonicalStateId: canonical?.stateId ?? null,
    canonicalInputSnapshotId: canonical?.inputSnapshotId ?? null,
    canonicalAsOf: canonical?.effectiveAt ?? null,
    activeRuptures: [], aftershocks: [], chains: [],
    systemicRiskLevel: null, pressureIndex: null, regime: null,
    summary: `Observations unavailable: ${reason}`,
    model: GRAPH_MODEL,
    generatedAt: now,
    cached: false,
  };
}

/**
 * Runs only from a canonical macro projection plus traceable completed bars.
 * Default providers are read-only; injected providers exist solely for source
 * fixture tests and never change the public procedure signature.
 */
export async function runAftershockEngine(dependencies: AftershockEngineDependencies = {}): Promise<AftershockEngineOutput> {
  const now = dependencies.now ?? Date.now;
  const canonicalProvider = dependencies.canonicalStateProvider ?? getAuthoritativeCanonicalIntelligenceState;
  const marketSnapshotProvider = dependencies.marketSnapshotProvider ?? fetchObservedMarketSnapshot;
  const useCache = !dependencies.canonicalStateProvider && !dependencies.marketSnapshotProvider && !dependencies.now;

  let canonical: CanonicalIntelligenceState | null;
  try {
    canonical = await canonicalProvider();
  } catch (error) {
    log.warn("[Aftershock Engine] Canonical state unavailable", { error });
    return unavailableOutput(now(), "Canonical macro state could not be read.", null);
  }
  const pressure = projectPressureFromCanonical(canonical);
  if (!canonical || !pressure || !Number.isFinite(canonical.pressureIndex) || !canonical.regime?.trim()) {
    return unavailableOutput(now(), "Canonical macro state is unavailable, lacks a canonical regime, or cannot be projected.", canonical);
  }

  const cacheKey = `aftershock_engine:${canonical.stateId}`;
  if (useCache) {
    const cached = engineCache.peek(cacheKey);
    if (cached) return { ...cached.value, cached: true };
  }

  const generatedAt = now();
  let market: AftershockMarketSnapshot;
  try {
    market = await marketSnapshotProvider(generatedAt);
  } catch (error) {
    log.warn("[Aftershock Engine] Market observation provider failed", { error });
    return unavailableOutput(generatedAt, "Market observations could not be verified.", canonical);
  }
  const quotes = market.quotes.filter(isValidObservedQuote);
  if (market.availability !== "AVAILABLE" || quotes.length === 0) {
    return unavailableOutput(generatedAt, market.reason ?? "No verified completed market observations were returned.", canonical);
  }

  const quoteMap = new Map(quotes.map(quote => [quote.symbol, quote]));
  const ruptures: RuptureEvent[] = [];
  for (const symbol of Object.keys(CONTAGION_GRAPH)) {
    const quote = quoteMap.get(symbol);
    if (!quote) continue;
    if (Math.abs(quote.changePercent) < ruptureThreshold(symbol) && quote.volumeRatio < VOLUME_RUPTURE_THRESHOLD) continue;
    const klass = assetClass(symbol);
    const ruptureType = detectRuptureType(quote.changePercent, quote.volumeRatio, klass);
    const strength = computeRuptureStrength(quote.changePercent, quote.volumeRatio, pressure.overallPressure);
    const direction: ContagionDirection = quote.changePercent > 0 ? "Bullish" : quote.changePercent < 0 ? "Bearish" : "Uncertain";
    ruptures.push({
      id: `rupture_${symbol}_${quote.observedAt}`,
      triggerAsset: symbol,
      triggerName: getAssetDisplayName(symbol),
      assetClass: klass,
      ruptureType,
      magnitude: quote.changePercent,
      volumeRatio: quote.volumeRatio,
      volatilityRatio: 1 + Math.abs(quote.changePercent) / 5,
      strength,
      direction,
      description: buildRuptureDescription(symbol, quote, ruptureType, pressure),
      detectedAt: quote.observedAt,
      aftershockWindowHours: computeAftershockWindowHours(ruptureType, strength),
      source: quote.source,
      observedAt: quote.observedAt,
      receivedAt: quote.receivedAt,
      availability: "AVAILABLE",
      evidenceStatus: quote.freshness,
      canonicalStateId: canonical.stateId,
      sourceInputIds: [stableInputId(quote), `canonical:${canonical.stateId}`],
      modelDerived: true,
      methodologyVersion: GRAPH_MODEL.methodologyVersion,
    });
  }

  const topRuptures = ruptures.sort((a, b) => b.strength - a.strength).slice(0, 8);
  const allAftershocks: AftershockSignal[] = [];
  for (const rupture of topRuptures) {
    for (const edge of CONTAGION_GRAPH[rupture.triggerAsset] ?? []) {
      const relatedQuote = quoteMap.get(edge.asset) ?? null;
      const reactionPercent = relatedQuote?.changePercent ?? null;
      const direction: ContagionDirection = edge.directionBias === "same"
        ? rupture.direction
        : edge.directionBias === "inverse"
          ? rupture.direction === "Bullish" ? "Bearish" : rupture.direction === "Bearish" ? "Bullish" : "Uncertain"
          : "Uncertain";
      const reactionStarted = relatedQuote !== null && Math.abs(reactionPercent ?? 0) > 0.5;
      const confirmationStatus = deriveConfirmationStatus(reactionStarted, reactionPercent, direction);
      allAftershocks.push({
        id: `aftershock_${rupture.id}_${edge.asset}_${relatedQuote?.observedAt ?? "unavailable"}`,
        ruptureId: rupture.id,
        triggerAsset: rupture.triggerAsset,
        triggerName: rupture.triggerName,
        relatedAsset: edge.asset,
        relatedName: edge.name,
        relatedAssetClass: edge.assetClass,
        label: deriveAftershockLabel(edge, edge.timingHours, reactionStarted, reactionPercent),
        probability: null,
        strength: computeAftershockStrength(edge, rupture),
        timingWindowHours: edge.timingHours,
        timingWindowLabel: deriveTimingLabel(edge.timingHours),
        relationshipType: edge.relationship,
        direction,
        confidence: null,
        confirmationStatus,
        explanation: edge.explanation,
        currentReactionPercent: reactionPercent,
        reactionStarted,
        generatedAt,
        source: "aftershock-static-contagion-graph",
        observedAt: rupture.observedAt,
        receivedAt: rupture.receivedAt,
        availability: "AVAILABLE",
        evidenceStatus: "DELAYED",
        canonicalStateId: canonical.stateId,
        sourceInputIds: [
          ...rupture.sourceInputIds,
          ...(relatedQuote ? [stableInputId(relatedQuote)] : []),
        ],
        reactionSource: relatedQuote?.source ?? null,
        reactionObservedAt: relatedQuote?.observedAt ?? null,
        reactionReceivedAt: relatedQuote?.receivedAt ?? null,
        reactionAvailability: relatedQuote ? "AVAILABLE" : "UNAVAILABLE",
        modelDerived: true,
        methodologyVersion: GRAPH_MODEL.methodologyVersion,
        model: GRAPH_MODEL,
      });
    }
  }

  allAftershocks.sort((a, b) => {
    const order: Record<ConfirmationStatus, number> = { Confirmed: 0, Developing: 1, Unconfirmed: 2, Fading: 3 };
    return order[a.confirmationStatus] - order[b.confirmationStatus] || b.strength - a.strength;
  });
  const emittedAftershocks = allAftershocks.slice(0, 40);
  const chains = topRuptures.map(rupture => {
    const signals = emittedAftershocks.filter(signal => signal.ruptureId === rupture.id);
    return {
      triggerAsset: rupture.triggerAsset,
      triggerName: rupture.triggerName,
      ruptureType: rupture.ruptureType,
      direction: rupture.direction,
      signals,
      totalAftershocks: signals.length,
      confirmedAftershocks: signals.filter(signal => signal.confirmationStatus === "Confirmed" || signal.confirmationStatus === "Developing").length,
      macroContext: buildMacroContext(pressure, canonical),
      model: GRAPH_MODEL,
    };
  });

  const evidenceStatus = mostConservativeStatus(canonicalEvidenceStatus(canonical), "DELAYED");
  const result: AftershockEngineOutput = {
    availability: "AVAILABLE",
    evidenceStatus,
    reason: null,
    source: "yahoo-daily",
    observedAt: Math.max(...quotes.map(quote => quote.observedAt)),
    receivedAt: Math.max(...quotes.map(quote => quote.receivedAt)),
    canonicalStateId: canonical.stateId,
    canonicalInputSnapshotId: canonical.inputSnapshotId,
    canonicalAsOf: canonical.effectiveAt,
    activeRuptures: topRuptures,
    aftershocks: emittedAftershocks,
    chains,
    systemicRiskLevel: pressure.level,
    pressureIndex: pressure.overallPressure,
    regime: pressure.regime,
    summary: buildEngineSummary(topRuptures, emittedAftershocks, quotes.length, pressure, evidenceStatus),
    model: GRAPH_MODEL,
    generatedAt,
    cached: false,
  };
  if (useCache) engineCache.set(cacheKey, result);
  log.info(`[Aftershock Engine] Observed ${quotes.length} completed-bar inputs; ${topRuptures.length} ruptures.`);
  return result;
}

function isValidObservedQuote(quote: ObservedAftershockQuote): boolean {
  return quote.availability === "AVAILABLE"
    && quote.source === "yahoo-daily"
    && quote.freshness === "DELAYED"
    && typeof quote.symbol === "string" && quote.symbol.length > 0
    && Number.isFinite(quote.changePercent) && Number.isFinite(quote.volumeRatio) && quote.volumeRatio > 0
    && Number.isFinite(quote.observedAt) && Number.isFinite(quote.receivedAt);
}

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

function buildRuptureDescription(symbol: string, quote: ObservedAftershockQuote, ruptureType: RuptureType, pressure: FaultlinePressureOutput): string {
  const direction = quote.changePercent > 0 ? "rose" : quote.changePercent < 0 ? "fell" : "was unchanged";
  const volume = quote.volumeRatio > 1 ? `; volume was ${quote.volumeRatio.toFixed(1)}× the prior 20 completed sessions` : "";
  return `${symbol} ${direction} ${Math.abs(quote.changePercent).toFixed(1)}% on a completed Yahoo daily bar${volume}. ${ruptureType} classification and strength are methodology-derived with canonical macro context ${pressure.overallPressure.toFixed(0)}/100.`;
}

function buildMacroContext(pressure: FaultlinePressureOutput, canonical: CanonicalIntelligenceState): string {
  return `Canonical macro context: ${pressure.regime} · ${pressure.overallPressure.toFixed(0)}/100 · state ${canonical.stateId} · as of ${canonical.effectiveAt}.`;
}

function buildEngineSummary(
  ruptures: readonly RuptureEvent[],
  signals: readonly AftershockSignal[],
  observationCount: number,
  pressure: FaultlinePressureOutput,
  evidenceStatus: EngineEvidenceStatus,
): string {
  if (ruptures.length === 0) {
    return `${observationCount} completed Yahoo daily-bar observations are available; none met the configured rupture thresholds. This is not a claim of market calm. Observation freshness: ${evidenceStatus}. Canonical pressure context: ${pressure.overallPressure.toFixed(0)}/100.`;
  }
  const confirmed = signals.filter(signal => signal.confirmationStatus === "Confirmed").length;
  const developing = signals.filter(signal => signal.confirmationStatus === "Developing").length;
  return `${ruptures.length} observed rupture${ruptures.length === 1 ? "" : "s"} met configured thresholds from completed Yahoo daily bars. ${confirmed} related reactions are confirmed and ${developing} are developing only where an observed related quote is direction-aligned. Static graph strength and timing are methodology-derived, not calibrated probabilities.`;
}

/** Returns graph edges with explicit model provenance for public read-only consumers. */
export function getAssetContagionChain(symbol: string): Array<ContagionEdge & { model: AftershockGraphModelMetadata }> {
  return (CONTAGION_GRAPH[symbol.toUpperCase()] ?? []).map(edge => ({ ...edge, model: GRAPH_MODEL }));
}

export function getAllContagionAssets(): string[] {
  return Object.keys(CONTAGION_GRAPH);
}
