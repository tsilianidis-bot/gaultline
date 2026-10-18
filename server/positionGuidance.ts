// ============================================================
// FAULTLINE Position Guidance™ — canonical-bound market context
//
// Position Guidance is a deterministic, model-derived interpretation of an
// authoritative canonical macro state plus observed asset price history. It
// does not infer company balance-sheet, sector, AI-exposure, or recession
// characteristics from a ticker, name, or asset category.
// ============================================================

import type { FaultlinePressureOutput } from "./pressure/engine";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { projectPressureFromCanonical } from "./canonicalPressureProjection";
import { classifyYahooObservation, getDailyBars, getQuote, type YahooDailyBar, type YahooQuote } from "./yahooProxy";
import { getCoinMarketData, getCoinOHLC, type CoinMarketData, type CoinOHLCBar } from "./coingeckoProxy";
import type { CanonicalIntelligenceState, CanonicalQualityStatus } from "../shared/canonicalIntelligenceState";

export type PositionAction =
  | "Add"
  | "Hold"
  | "Trim"
  | "Watch / No Add"
  | "Exit Watch"
  | "Sell Bias";

export type ConvictionLevel = "High" | "Moderate" | "Low";
export type PositionTimeframe = "Today" | "Week" | "Month" | "Year";
export type PositionAssetType = "Stock" | "ETF" | "Crypto" | "Index" | "Other";

/**
 * Compatibility score fields retained for existing surfaces. `sectorStrengthScore`
 * is intentionally null: this engine has no verified sector-strength adapter.
 * `liquidityScore`, when present, is observed volume confirmation (not a claim
 * about issuer or market liquidity) and is labelled as such by the UI.
 */
export interface AssetScores {
  assetSignalScore: number;
  marketRegimeScore: number;
  pressureIndexScore: number;
  sectorStrengthScore: null;
  momentumScore: number;
  volatilityScore: number;
  liquidityScore: number | null;
  macroRiskScore: number;
  breadthScore: number;
  trendSupportScore: number;
  compositeScore: number;
}

export type PositionGuidancePriceStatus = "OBSERVED" | "DELAYED" | "COMPLETED_SESSION" | "STALE" | "UNAVAILABLE";

export interface PositionGuidanceSourceMetadata {
  assetProvider: "Yahoo Finance" | "CoinGecko";
  assetInputClassification: "OBSERVED";
  quoteProvider: "yahoo" | "polygon-prev" | "coingecko";
  quoteObservedAt: string;
  quoteFetchedAt: string | null;
  priceStatus: PositionGuidancePriceStatus;
  dailyBarProvider: "Yahoo Finance" | "CoinGecko";
  dailyBarCount: number;
  latestDailyBarAt: string;
  volumeObserved: boolean;
}

export interface PositionGuidanceModelMetadata {
  classification: "DERIVED_MODEL";
  modelId: "position-guidance-market-context";
  modelVersion: "2.0.0";
  methodologyVersion: "2026-10-17";
  methodology: string;
}

export interface PositionGuidanceCard {
  status: "AVAILABLE";
  availability: "AVAILABLE";
  ticker: string;
  name: string;
  assetType: "Stock" | "ETF" | "Crypto" | "Index";
  action: PositionAction;
  conviction: ConvictionLevel;
  timeframe: PositionTimeframe;
  /** A provider-observed value only; never a static price string. */
  currentPrice: string;
  priceStatus: PositionGuidancePriceStatus;
  pressureIndex: number;
  regime: string;
  regimeLabel: string;
  scores: AssetScores;
  trendCondition: string;
  supportLevel: string;
  keyDrivers: string[];
  aiInterpretation: string;
  suggestedBehavior: string;
  invalidationCondition: string;
  nextConditionToWatch: string;
  whyThisSignal: {
    cause: string;
    driver: string;
    issueType: string;
    whatImproves: string;
    whatWorsens: string;
  };
  /** Canonical state binding. */
  stateId: string;
  effectiveAt: string;
  modelVersion: string;
  configurationVersion: string;
  quality: CanonicalQualityStatus;
  source: PositionGuidanceSourceMetadata;
  model: PositionGuidanceModelMetadata;
  cached?: boolean;
}

export interface PositionGuidanceUnavailable {
  status: "UNAVAILABLE";
  availability: "UNAVAILABLE";
  ticker: string;
  name: string;
  assetType: PositionAssetType;
  reason: string;
  /** Present only when a canonical state was read but could not be used. */
  stateId: string | null;
  effectiveAt: string | null;
  modelVersion: string | null;
  configurationVersion: string | null;
  quality: CanonicalQualityStatus | "UNAVAILABLE";
  source: null;
  model: PositionGuidanceModelMetadata;
}

export type PositionGuidanceResult = PositionGuidanceCard | PositionGuidanceUnavailable;

interface GuidanceRequest {
  ticker: string;
  name: string;
  assetType: PositionAssetType;
}

interface ObservedBar {
  close: number;
  high: number;
  low: number;
  volume: number | null;
  timestamp: number;
}

interface ObservedAssetContext {
  ticker: string;
  name: string;
  assetType: "Stock" | "ETF" | "Crypto" | "Index";
  price: number;
  priceStatus: PositionGuidancePriceStatus;
  quoteObservedAt: number;
  quoteFetchedAt: number | null;
  quoteProvider: "yahoo" | "polygon-prev" | "coingecko";
  assetProvider: "Yahoo Finance" | "CoinGecko";
  dailyBarProvider: "Yahoo Finance" | "CoinGecko";
  bars: ObservedBar[];
  currentVolume: number | null;
}

interface MacroContext {
  state: CanonicalIntelligenceState;
  pressure: FaultlinePressureOutput;
}

const REQUIRED_VECTOR_IDS = [
  "liquidity-stress",
  "credit-contagion",
  "volatility-regime",
  "macro-sensitivity",
  "market-breadth",
  "ai-bubble",
] as const;

const DEFAULT_PUBLIC_GUIDANCE: GuidanceRequest[] = [
  { ticker: "SPY", name: "SPY", assetType: "ETF" },
  { ticker: "QQQ", name: "QQQ", assetType: "ETF" },
  { ticker: "NVDA", name: "NVDA", assetType: "Stock" },
  { ticker: "AAPL", name: "AAPL", assetType: "Stock" },
  { ticker: "TSLA", name: "TSLA", assetType: "Stock" },
  { ticker: "BTC", name: "BTC", assetType: "Crypto" },
  { ticker: "ETH", name: "ETH", assetType: "Crypto" },
];

const MODEL: PositionGuidanceModelMetadata = {
  classification: "DERIVED_MODEL",
  modelId: "position-guidance-market-context",
  modelVersion: "2.0.0",
  methodologyVersion: "2026-10-17",
  methodology: "Deterministic composite of canonical macro pressure and provider-observed price, completed daily returns, realized volatility, and volume confirmation when a comparable volume history exists. It does not use issuer fundamentals or category-derived traits.",
};

/**
 * @deprecated Test-only compatibility export for the pre-repair catalog test.
 * It is deliberately not read by any operational request, scorer, cache, or
 * response path. It contains no price or provenance claim. Remove alongside
 * the obsolete `diagnosticAI.test.ts` catalog assertions in a coordinated test
 * cleanup; Position Guidance itself uses only DEFAULT_PUBLIC_GUIDANCE and the
 * provider adapters below.
 */
export const DEMO_ASSETS = Object.freeze([
  { ticker: "SPY", assetType: "ETF", aiExposure: 0, debtRisk: 0, recessionSensitivity: 0, volatilityBase: 0, momentumBase: 0, sectorStrengthBase: 0 },
  { ticker: "QQQ", assetType: "ETF", aiExposure: 0, debtRisk: 0, recessionSensitivity: 0, volatilityBase: 0, momentumBase: 0, sectorStrengthBase: 0 },
  { ticker: "NVDA", assetType: "Stock", aiExposure: 1, debtRisk: 0, recessionSensitivity: 0, volatilityBase: 0, momentumBase: 0, sectorStrengthBase: 0 },
  { ticker: "AAPL", assetType: "Stock", aiExposure: 0, debtRisk: 0, recessionSensitivity: 0, volatilityBase: 0, momentumBase: 0, sectorStrengthBase: 0 },
  { ticker: "TSLA", assetType: "Stock", aiExposure: 0, debtRisk: 0, recessionSensitivity: 0, volatilityBase: 0, momentumBase: 0, sectorStrengthBase: 0 },
  { ticker: "BTC", assetType: "Crypto", aiExposure: 0, debtRisk: 0, recessionSensitivity: 0, volatilityBase: 1, momentumBase: 0, sectorStrengthBase: 0 },
  { ticker: "ETH", assetType: "Crypto", aiExposure: 0, debtRisk: 0, recessionSensitivity: 0, volatilityBase: 1, momentumBase: 0, sectorStrengthBase: 0 },
] as const);

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(clamp(value));
}

function iso(ms: number | null | undefined): string | null {
  return finite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

function formatPrice(price: number): string {
  const decimals = price >= 1 ? 2 : price >= 0.01 ? 4 : 6;
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function scoreToAction(compositeScore: number): PositionAction {
  if (compositeScore >= 80) return "Add";
  if (compositeScore >= 65) return "Hold";
  if (compositeScore >= 50) return "Watch / No Add";
  if (compositeScore >= 35) return "Trim";
  if (compositeScore >= 20) return "Exit Watch";
  return "Sell Bias";
}

function vectorScore(pressure: FaultlinePressureOutput, id: string): number | null {
  const value = pressure.vectors.find(vector => vector.id === id)?.score;
  return finite(value) && value >= 0 && value <= 100 ? value : null;
}

function hasRequiredVectors(pressure: FaultlinePressureOutput): boolean {
  return REQUIRED_VECTOR_IDS.every(id => vectorScore(pressure, id) !== null);
}

function unavailable(request: GuidanceRequest, reason: string, state: CanonicalIntelligenceState | null = null): PositionGuidanceUnavailable {
  return {
    status: "UNAVAILABLE",
    availability: "UNAVAILABLE",
    ticker: request.ticker,
    name: request.name,
    assetType: request.assetType,
    reason,
    stateId: state?.stateId ?? null,
    effectiveAt: state?.effectiveAt ?? null,
    modelVersion: state?.modelVersion ?? null,
    configurationVersion: state?.configurationVersion ?? null,
    quality: state?.confidenceOrEvidenceQuality ?? "UNAVAILABLE",
    source: null,
    model: MODEL,
  };
}

async function resolveMacroContext(): Promise<MacroContext | { reason: string; state: CanonicalIntelligenceState | null }> {
  const state = await getAuthoritativeCanonicalIntelligenceState();
  const pressure = projectPressureFromCanonical(state);
  if (!state || !pressure) {
    return { reason: "Authoritative canonical macro state is unavailable or unusable; guidance is withheld rather than recalculated.", state };
  }
  if (!finite(pressure.overallPressure) || pressure.overallPressure < 0 || pressure.overallPressure > 100 || !state.regime || !hasRequiredVectors(pressure)) {
    return { reason: "Canonical macro state is missing a required pressure, regime, or named risk vector; guidance is withheld.", state };
  }
  return { state, pressure };
}

function isMacroContext(context: MacroContext | { reason: string; state: CanonicalIntelligenceState | null }): context is MacroContext {
  return "pressure" in context;
}

function validYahooBars(bars: YahooDailyBar[]): ObservedBar[] {
  return bars.filter(bar => (
    finite(bar.close) && bar.close > 0 && finite(bar.high) && bar.high > 0
    && finite(bar.low) && bar.low > 0 && finite(bar.volume) && bar.volume >= 0
    && finite(bar.timestamp) && bar.timestamp > 0
  )).map(bar => ({ ...bar, volume: bar.volume }));
}

function validCoinBars(bars: CoinOHLCBar[]): ObservedBar[] {
  return bars.filter(bar => (
    finite(bar.close) && bar.close > 0 && finite(bar.high) && bar.high > 0
    && finite(bar.low) && bar.low > 0 && finite(bar.open) && bar.open > 0
    && finite(bar.timestamp) && bar.timestamp > 0
  )).map(bar => ({ close: bar.close, high: bar.high, low: bar.low, volume: null, timestamp: bar.timestamp }));
}

function yahooPriceStatus(quote: YahooQuote): PositionGuidancePriceStatus | null {
  const freshness = classifyYahooObservation(quote);
  if (freshness.timing === "live") return "OBSERVED";
  if (freshness.timing === "delayed") return "DELAYED";
  if (freshness.timing === "completed_session") return "COMPLETED_SESSION";
  if (freshness.timing === "stale") return "STALE";
  return null;
}

async function observedYahooContext(request: GuidanceRequest): Promise<ObservedAssetContext | { reason: string }> {
  const [quote, rawBars] = await Promise.all([getQuote(request.ticker), getDailyBars(request.ticker, "3mo")]);
  const bars = validYahooBars(rawBars).sort((a, b) => a.timestamp - b.timestamp);
  const priceStatus = yahooPriceStatus(quote);
  if (quote.source === "error" || !finite(quote.price) || quote.price <= 0 || !finite(quote.observedAt) || !priceStatus) {
    return { reason: "A provider-observed Yahoo quote with price and observation time is required." };
  }
  if (bars.length < 21) {
    return { reason: "At least 21 valid provider-observed daily OHLCV bars are required for market-context guidance." };
  }
  const assetType = request.assetType === "Other" ? "Stock" : request.assetType;
  return {
    ticker: request.ticker,
    name: request.name,
    assetType,
    price: quote.price,
    priceStatus,
    quoteObservedAt: quote.observedAt,
    quoteFetchedAt: finite(quote.fetchedAt) ? quote.fetchedAt : null,
    quoteProvider: quote.source,
    assetProvider: "Yahoo Finance",
    dailyBarProvider: "Yahoo Finance",
    bars,
    currentVolume: finite(quote.volume) && quote.volume >= 0 ? quote.volume : null,
  };
}

function coinPriceStatus(coin: CoinMarketData): PositionGuidancePriceStatus | null {
  const updatedAt = Date.parse(coin.lastUpdated);
  if (!finite(updatedAt) || updatedAt <= 0) return null;
  return Date.now() - updatedAt <= 10 * 60_000 ? "OBSERVED" : "STALE";
}

async function observedCryptoContext(request: GuidanceRequest): Promise<ObservedAssetContext | { reason: string }> {
  const [coin, rawBars] = await Promise.all([getCoinMarketData(request.ticker), getCoinOHLC(request.ticker, 30)]);
  const bars = validCoinBars(rawBars).sort((a, b) => a.timestamp - b.timestamp);
  const priceStatus = coin ? coinPriceStatus(coin) : null;
  const updatedAt = coin ? Date.parse(coin.lastUpdated) : Number.NaN;
  if (!coin || !finite(coin.currentPrice) || coin.currentPrice <= 0 || !finite(coin.totalVolume) || coin.totalVolume <= 0 || !finite(updatedAt) || !priceStatus) {
    return { reason: "A CoinGecko market observation with price, volume, and provider timestamp is required." };
  }
  if (bars.length < 21) {
    return { reason: "At least 21 valid CoinGecko daily OHLC bars are required for market-context guidance." };
  }
  return {
    ticker: request.ticker,
    name: coin.name || request.name,
    assetType: "Crypto",
    price: coin.currentPrice,
    priceStatus,
    quoteObservedAt: updatedAt,
    quoteFetchedAt: null,
    quoteProvider: "coingecko",
    assetProvider: "CoinGecko",
    dailyBarProvider: "CoinGecko",
    bars,
    currentVolume: coin.totalVolume,
  };
}

async function observedAssetContext(request: GuidanceRequest): Promise<ObservedAssetContext | { reason: string }> {
  return request.assetType === "Crypto" ? observedCryptoContext(request) : observedYahooContext(request);
}

function percentChange(current: number, previous: number): number | null {
  if (!finite(current) || !finite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function standardDeviation(values: number[]): number | null {
  if (values.length < 2 || values.some(value => !finite(value))) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return finite(variance) && variance >= 0 ? Math.sqrt(variance) : null;
}

function observedScores(asset: ObservedAssetContext, pressure: FaultlinePressureOutput): { scores: AssetScores; return5: number; return20: number; priceVsSma20: number; volumeRatio: number | null; realizedVolatility: number; low20: number } | null {
  const bars = asset.bars;
  const latestTwenty = bars.slice(-20);
  const closes = latestTwenty.map(bar => bar.close);
  const closesForReturns = bars.slice(-21).map(bar => bar.close);
  if (closes.length !== 20 || closesForReturns.length !== 21) return null;

  const sma20 = closes.reduce((sum, close) => sum + close, 0) / closes.length;
  const return5 = percentChange(asset.price, closesForReturns.at(-6) as number);
  const return20 = percentChange(asset.price, closesForReturns[0]);
  const priceVsSma20 = percentChange(asset.price, sma20);
  const dailyReturns = closesForReturns.slice(1).map((close, index) => percentChange(close, closesForReturns[index])).filter((value): value is number => value !== null);
  const dailyStdDev = standardDeviation(dailyReturns);
  if (return5 === null || return20 === null || priceVsSma20 === null || dailyStdDev === null) return null;

  const annualizationDays = asset.assetType === "Crypto" ? 365 : 252;
  const realizedVolatility = dailyStdDev * Math.sqrt(annualizationDays);
  const momentumScore = round(50 + return5 * 2.5 + return20 * 1.25);
  const trendSupportScore = round(50 + priceVsSma20 * 5);
  const volatilityScore = round(realizedVolatility * 1.6);
  const assetSignalScore = round(momentumScore * 0.55 + trendSupportScore * 0.45);

  const historicalVolumes = latestTwenty.map(bar => bar.volume).filter((volume): volume is number => volume !== null && volume > 0);
  const averageVolume = historicalVolumes.length >= 20
    ? historicalVolumes.reduce((sum, volume) => sum + volume, 0) / historicalVolumes.length
    : null;
  const volumeRatio = asset.currentVolume !== null && averageVolume !== null && averageVolume > 0
    ? asset.currentVolume / averageVolume
    : null;
  const volumeConfirmationScore = volumeRatio === null ? null : round(50 + (volumeRatio - 1) * 35);

  const p = pressure.overallPressure;
  const macroStress = vectorScore(pressure, "macro-sensitivity");
  const breadthStress = vectorScore(pressure, "market-breadth");
  if (macroStress === null || breadthStress === null) return null;
  const marketRegimeScore = round(100 - p);
  const pressureIndexScore = round(100 - p);
  const macroRiskScore = round(100 - macroStress);
  const breadthScore = round(100 - breadthStress);
  const weighted = [
    { value: assetSignalScore, weight: 0.20 },
    { value: marketRegimeScore, weight: 0.15 },
    { value: pressureIndexScore, weight: 0.10 },
    { value: momentumScore, weight: 0.15 },
    { value: 100 - volatilityScore, weight: 0.10 },
    { value: macroRiskScore, weight: 0.10 },
    { value: breadthScore, weight: 0.05 },
    { value: trendSupportScore, weight: 0.15 },
    ...(volumeConfirmationScore === null ? [] : [{ value: volumeConfirmationScore, weight: 0.10 }]),
  ];
  const totalWeight = weighted.reduce((sum, component) => sum + component.weight, 0);
  const compositeScore = round(weighted.reduce((sum, component) => sum + component.value * component.weight, 0) / totalWeight);

  return {
    scores: {
      assetSignalScore,
      marketRegimeScore,
      pressureIndexScore,
      sectorStrengthScore: null,
      momentumScore,
      volatilityScore,
      liquidityScore: volumeConfirmationScore,
      macroRiskScore,
      breadthScore,
      trendSupportScore,
      compositeScore,
    },
    return5,
    return20,
    priceVsSma20,
    volumeRatio,
    realizedVolatility,
    low20: Math.min(...latestTwenty.map(bar => bar.low)),
  };
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function conviction(asset: ObservedAssetContext, state: CanonicalIntelligenceState): ConvictionLevel {
  if (state.confidenceOrEvidenceQuality === "HEALTHY" && asset.bars.length >= 60 && (asset.priceStatus === "OBSERVED" || asset.priceStatus === "DELAYED")) return "Moderate";
  return "Low";
}

function buildCard(request: GuidanceRequest, asset: ObservedAssetContext, macro: MacroContext): PositionGuidanceCard | PositionGuidanceUnavailable {
  const observed = observedScores(asset, macro.pressure);
  if (!observed) return unavailable(request, "Observed price history could not produce the required deterministic returns, volatility, and trend inputs.", macro.state);
  const { scores, return5, return20, priceVsSma20, volumeRatio, realizedVolatility, low20 } = observed;
  const action = scoreToAction(scores.compositeScore);
  const liquidityStress = vectorScore(macro.pressure, "liquidity-stress") as number;
  const creditStress = vectorScore(macro.pressure, "credit-contagion") as number;
  const drivers = [
    `Canonical macro pressure: ${macro.pressure.overallPressure}/100 (${macro.pressure.regime}).`,
    `Observed return: ${signed(return5)} over 5 sessions and ${signed(return20)} over 20 sessions.`,
    `Observed price is ${signed(priceVsSma20)} versus its 20-session average.`,
    `Observed annualized realized volatility: ${realizedVolatility.toFixed(1)}%.`,
    volumeRatio === null ? null : `Observed volume is ${volumeRatio.toFixed(2)}× its 20-session average.`,
    liquidityStress >= 60 ? `Canonical liquidity-stress vector is elevated at ${liquidityStress}/100.` : null,
    creditStress >= 60 ? `Canonical credit-contagion vector is elevated at ${creditStress}/100.` : null,
  ].filter((driver): driver is string => driver !== null).slice(0, 5);
  const aboveTrend = priceVsSma20 >= 0;
  const source = {
    assetProvider: asset.assetProvider,
    assetInputClassification: "OBSERVED" as const,
    quoteProvider: asset.quoteProvider,
    quoteObservedAt: new Date(asset.quoteObservedAt).toISOString(),
    quoteFetchedAt: iso(asset.quoteFetchedAt),
    priceStatus: asset.priceStatus,
    dailyBarProvider: asset.dailyBarProvider,
    dailyBarCount: asset.bars.length,
    latestDailyBarAt: new Date(asset.bars.at(-1)!.timestamp).toISOString(),
    volumeObserved: asset.currentVolume !== null,
  };
  return {
    status: "AVAILABLE",
    availability: "AVAILABLE",
    ticker: asset.ticker,
    name: asset.name,
    assetType: asset.assetType,
    action,
    conviction: conviction(asset, macro.state),
    timeframe: "Month",
    currentPrice: formatPrice(asset.price),
    priceStatus: asset.priceStatus,
    pressureIndex: macro.pressure.overallPressure,
    regime: macro.pressure.regime,
    regimeLabel: macro.pressure.level,
    scores,
    trendCondition: aboveTrend
      ? `Observed price is above its 20-session average (${signed(priceVsSma20)}).`
      : `Observed price is below its 20-session average (${signed(priceVsSma20)}).`,
    supportLevel: `20-session observed reference low: ${formatPrice(low20)} (not a forecast or guaranteed support).`,
    keyDrivers: drivers,
    aiInterpretation: `${asset.ticker} has a deterministic market-context composite of ${scores.compositeScore}/100, derived from canonical macro pressure and observed price history. The ${action} label is a model output, not a company-specific fundamental assessment or personalized advice.`,
    suggestedBehavior: `${action} is a model-derived context label for the next monthly observation window; review it alongside your own objectives, exposure, and risk limits.`,
    invalidationCondition: `A change in the bound canonical state, or a materially different observed price/return/volume record, recalculates this market-context model.`,
    nextConditionToWatch: `Watch the next canonical-state publication and the next completed daily bar for ${asset.ticker}.`,
    whyThisSignal: {
      cause: `Composite ${scores.compositeScore}/100 combines canonical macro pressure with observed 5- and 20-session returns, trend, and realized volatility.`,
      driver: `The reading is driven by observed market context; no category-derived company traits or issuer fundamentals are used.`,
      issueType: "Market context",
      whatImproves: "Lower canonical macro pressure and stronger observed return/trend inputs would improve the model context.",
      whatWorsens: "Higher canonical macro pressure, weaker observed returns, or higher realized volatility would weaken the model context.",
    },
    stateId: macro.state.stateId,
    effectiveAt: macro.state.effectiveAt,
    modelVersion: macro.state.modelVersion,
    configurationVersion: macro.state.configurationVersion,
    quality: macro.state.confidenceOrEvidenceQuality,
    source,
    model: MODEL,
    cached: false,
  };
}

async function guidanceForRequest(request: GuidanceRequest, macro: MacroContext | { reason: string; state: CanonicalIntelligenceState | null }): Promise<PositionGuidanceResult> {
  if (!isMacroContext(macro)) return unavailable(request, macro.reason, macro.state);
  const asset = await observedAssetContext(request);
  if ("reason" in asset) return unavailable(request, asset.reason, macro.state);
  return buildCard(request, asset, macro);
}

function publicRequests(tickers?: string[]): GuidanceRequest[] {
  if (!tickers || tickers.length === 0) return DEFAULT_PUBLIC_GUIDANCE;
  return tickers.slice(0, 10).map<GuidanceRequest>(raw => {
    const ticker = raw.trim().toUpperCase();
    const knownDefault = DEFAULT_PUBLIC_GUIDANCE.find(asset => asset.ticker === ticker);
    return knownDefault ?? { ticker, name: ticker, assetType: "Stock" };
  }).filter(request => request.ticker.length > 0);
}

/**
 * Public reference-guidance entrypoint. Its old `pressureData` parameter is
 * retained for source compatibility but deliberately never becomes a macro
 * authority: only the persisted canonical state may create a card.
 */
export async function getPositionGuidance(
  tickers?: string[],
  _pressureData?: FaultlinePressureOutput,
): Promise<PositionGuidanceResult[]> {
  const requests = publicRequests(tickers);
  const macro = await resolveMacroContext();
  return Promise.all(requests.map(request => guidanceForRequest(request, macro)));
}

/** Retained router interface; no independent guidance cache is maintained. */
export function clearGuidanceCache(): void {
  // Asset adapters maintain short-lived provider caches. Guidance must remain
  // bound to the current canonical state and its observed source timestamps.
}

/**
 * Authenticated portfolio entrypoint. Asset type selects the source adapter
 * only; it never supplies score inputs or synthetic financial characteristics.
 */
export async function getGuidanceForTicker(
  ticker: string,
  name: string,
  assetType: "Stock" | "ETF" | "Crypto" | "Other",
  _pressureData?: FaultlinePressureOutput,
): Promise<PositionGuidanceResult> {
  const request: GuidanceRequest = {
    ticker: ticker.trim().toUpperCase(),
    name: name.trim() || ticker.trim().toUpperCase(),
    assetType,
  };
  const macro = await resolveMacroContext();
  return guidanceForRequest(request, macro);
}
