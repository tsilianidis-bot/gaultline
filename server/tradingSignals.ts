// ============================================================
// FAULTLINE — Trading Signal Engine
//
// Computes actionable BUY / SELL / HOLD signals for each
// screener ticker using:
//   • RSI approximation from 5-day sparkline momentum
//   • SMA crossover (short vs long window on sparkline)
//   • Volume confirmation (current vs average)
//   • Regime-weighted signal adjustment
//   • Key price levels (support, resistance, entry, stop-loss)
//
// All computation is deterministic and runs server-side.
// No additional Polygon.io calls — uses data already cached
// by signalsProxy.ts (sparkline, OHLC, volume).
// ============================================================

// ── Types ─────────────────────────────────────────────────────

export type TradingAction = "BUY" | "SELL" | "HOLD" | "WATCH";

export interface PriceLevels {
  support: number;       // estimated support (recent low area)
  resistance: number;    // estimated resistance (recent high area)
  entryZone: number;     // suggested entry price
  stopLoss: number;      // ATR-based stop-loss
  targetPrice: number;   // 2:1 R:R target based on direction
  riskReward: number;    // (target - entry) / (entry - stop), rounded to 1dp
  atr: number;           // estimated ATR (high - low range proxy)
}

export interface TradingSignalResult {
  ticker: string;
  action: TradingAction;
  confidence: number;          // 0–100
  strength: "Strong" | "Moderate" | "Weak";
  timeframe: "Short-Term" | "Swing" | "Watch";
  rationale: string;           // 1-sentence reason
  technicals: {
    rsiEstimate: number;       // 0–100 RSI approximation
    rsiLabel: "Overbought" | "Neutral" | "Oversold";
    trend: "Uptrend" | "Downtrend" | "Sideways";
    volumeSignal: "Surge" | "Normal" | "Low";
    momentumScore: number;     // 0–100
    smaSignal: "Golden Cross" | "Death Cross" | "Neutral";
  };
  priceLevels: PriceLevels;
  regimeAlignment: "Aligned" | "Neutral" | "Counter-Trend";
  regimeAlignmentScore: number; // 0–10
  computedAt: number;          // Unix ms
}

export interface TradingSignalsInput {
  ticker: string;
  price: number;
  open: number;
  high: number;
  low: number;
  changePercent: number;
  volumeMillions: number;
  avgVolume: number;           // in millions
  sparkline: number[];         // 5-day % change from first close
  relativeStrength: number;    // 0–100 (from signalsData catalog)
}

export interface RegimeInput {
  label: string;
  score: number;               // 0–10 (higher = more stressed)
}

// ── In-memory cache ───────────────────────────────────────────
interface SignalCacheEntry {
  result: TradingSignalResult;
  computedAt: number;
}

const signalCache = new Map<string, SignalCacheEntry>();
const SIGNAL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Technical indicator helpers ───────────────────────────────

/**
 * Approximate RSI from a series of % change values.
 * Uses the standard Wilder smoothing on gains vs losses.
 */
function approximateRSI(changes: number[]): number {
  if (changes.length < 2) return 50;
  const gains: number[] = [];
  const losses: number[] = [];
  for (const c of changes) {
    if (c > 0) { gains.push(c); losses.push(0); }
    else { gains.push(0); losses.push(Math.abs(c)); }
  }
  const avgGain = gains.reduce((s, v) => s + v, 0) / gains.length;
  const avgLoss = losses.reduce((s, v) => s + v, 0) / losses.length;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

/**
 * Compute a simple moving average over the last N values.
 */
function sma(values: number[], window: number): number {
  const slice = values.slice(-window);
  if (slice.length === 0) return 0;
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

/**
 * Derive daily % changes from a sparkline (% from first close).
 * sparkline[i] = cumulative % change from day 0.
 * daily change = sparkline[i] - sparkline[i-1].
 */
function sparklineToDailyChanges(sparkline: number[]): number[] {
  if (sparkline.length < 2) return [];
  const changes: number[] = [];
  for (let i = 1; i < sparkline.length; i++) {
    changes.push(sparkline[i] - sparkline[i - 1]);
  }
  return changes;
}

/**
 * Determine trend direction from sparkline.
 */
function deriveTrend(sparkline: number[]): "Uptrend" | "Downtrend" | "Sideways" {
  if (sparkline.length < 2) return "Sideways";
  const first = sparkline[0];
  const last = sparkline[sparkline.length - 1];
  const delta = last - first;
  if (delta > 1.5) return "Uptrend";
  if (delta < -1.5) return "Downtrend";
  return "Sideways";
}

/**
 * SMA crossover signal using sparkline values.
 * Short window = 2 days, long window = 4 days (on 5-day data).
 */
function smaCrossover(sparkline: number[]): "Golden Cross" | "Death Cross" | "Neutral" {
  if (sparkline.length < 4) return "Neutral";
  const shortSMA = sma(sparkline, 2);
  const longSMA = sma(sparkline, 4);
  const diff = shortSMA - longSMA;
  if (diff > 0.5) return "Golden Cross";
  if (diff < -0.5) return "Death Cross";
  return "Neutral";
}

/**
 * Volume signal based on current vs average.
 */
function volumeSignal(volumeMillions: number, avgVolume: number): "Surge" | "Normal" | "Low" {
  if (avgVolume <= 0) return "Normal";
  const ratio = volumeMillions / avgVolume;
  if (ratio >= 1.5) return "Surge";
  if (ratio < 0.7) return "Low";
  return "Normal";
}

/**
 * Estimate key price levels from OHLC using ATR-based stops and 2:1 R:R targets.
 * ATR proxy = intraday high - low range (single-bar ATR).
 */
function computePriceLevels(
  price: number,
  high: number,
  low: number,
  action: TradingAction
): PriceLevels {
  const range = high - low;
  // ATR proxy: use intraday range, floor at 0.5% of price to avoid zero
  const atr = Math.max(range, price * 0.005);

  const support = parseFloat((low - atr * 0.1).toFixed(2));
  const resistance = parseFloat((high + atr * 0.1).toFixed(2));

  let entryZone: number;
  let stopLoss: number;
  let targetPrice: number;

  if (action === "BUY") {
    // Entry: current price (buy at market / slight pullback)
    entryZone = parseFloat(price.toFixed(2));
    // ATR stop: 1.5× ATR below entry, but no worse than the day's low
    stopLoss = parseFloat(Math.max(low - atr * 0.1, entryZone - atr * 1.5).toFixed(2));
    // Target: 2:1 R:R from entry
    const riskPerShare = entryZone - stopLoss;
    targetPrice = parseFloat((entryZone + riskPerShare * 2).toFixed(2));
  } else if (action === "SELL") {
    // Short entry: current price
    entryZone = parseFloat(price.toFixed(2));
    // ATR stop: 1.5× ATR above entry, but no worse than the day's high
    stopLoss = parseFloat(Math.min(high + atr * 0.1, entryZone + atr * 1.5).toFixed(2));
    // Target: 2:1 R:R downside
    const riskPerShare = stopLoss - entryZone;
    targetPrice = parseFloat((entryZone - riskPerShare * 2).toFixed(2));
  } else {
    // HOLD / WATCH: neutral levels
    entryZone = parseFloat(price.toFixed(2));
    stopLoss = parseFloat((price - atr * 1.5).toFixed(2));
    targetPrice = parseFloat((price + atr * 2).toFixed(2));
  }

  // Risk/reward ratio (always positive; represents reward units per 1 unit of risk)
  const risk = Math.abs(entryZone - stopLoss);
  const reward = Math.abs(targetPrice - entryZone);
  const riskReward = risk > 0 ? parseFloat((reward / risk).toFixed(1)) : 0;

  return { support, resistance, entryZone, stopLoss, targetPrice, riskReward, atr: parseFloat(atr.toFixed(2)) };
}

/**
 * Regime alignment: how well does the action align with the current macro regime?
 * High pressure (score > 7) favors SELL/defensive.
 * Low pressure (score < 4) favors BUY/momentum.
 */
function computeRegimeAlignment(
  action: TradingAction,
  regime: RegimeInput
): { alignment: "Aligned" | "Neutral" | "Counter-Trend"; score: number } {
  const label = regime.label.toUpperCase();
  const pressureScore = regime.score; // 0–10

  // Determine regime bias
  let regimeBias: "bullish" | "bearish" | "neutral" = "neutral";
  if (
    label.includes("AI MELT") ||
    label.includes("MOMENTUM") ||
    pressureScore < 3.5
  ) {
    regimeBias = "bullish";
  } else if (
    label.includes("RECESSION") ||
    label.includes("CREDIT") ||
    label.includes("LIQUIDITY") ||
    pressureScore > 7
  ) {
    regimeBias = "bearish";
  }

  if (regimeBias === "bullish") {
    if (action === "BUY") return { alignment: "Aligned", score: 9 };
    if (action === "SELL") return { alignment: "Counter-Trend", score: 2 };
    return { alignment: "Neutral", score: 5 };
  }
  if (regimeBias === "bearish") {
    if (action === "SELL") return { alignment: "Aligned", score: 9 };
    if (action === "BUY") return { alignment: "Counter-Trend", score: 2 };
    return { alignment: "Neutral", score: 5 };
  }
  // Neutral regime
  if (action === "HOLD" || action === "WATCH") return { alignment: "Neutral", score: 5 };
  return { alignment: "Neutral", score: 6 };
}

/**
 * Compute a momentum score (0–100) from sparkline and RSI.
 */
function computeMomentumScore(sparkline: number[], rsi: number, relativeStrength: number): number {
  const trend = deriveTrend(sparkline);
  let base = relativeStrength; // use catalog RS as base
  if (trend === "Uptrend") base = Math.min(100, base + 10);
  if (trend === "Downtrend") base = Math.max(0, base - 10);
  // Blend with RSI
  const blended = base * 0.6 + rsi * 0.4;
  return Math.round(Math.max(0, Math.min(100, blended)));
}

// ── Core signal computation ───────────────────────────────────

export function computeTradingSignal(
  input: TradingSignalsInput,
  regime: RegimeInput
): TradingSignalResult {
  const cacheKey = `${input.ticker}:${regime.label}:${input.price}`;
  const cached = signalCache.get(cacheKey);
  if (cached && Date.now() - cached.computedAt < SIGNAL_CACHE_TTL_MS) {
    return cached.result;
  }

  const { price, high, low, changePercent, volumeMillions, avgVolume, sparkline, relativeStrength } = input;

  // Derive daily changes from sparkline
  const dailyChanges = sparklineToDailyChanges(sparkline);

  // Technical indicators
  const rsiEstimate = approximateRSI(dailyChanges.length > 0 ? dailyChanges : [changePercent]);
  const rsiLabel: "Overbought" | "Neutral" | "Oversold" =
    rsiEstimate >= 70 ? "Overbought" : rsiEstimate <= 30 ? "Oversold" : "Neutral";
  const trend = deriveTrend(sparkline);
  const smaSignal = smaCrossover(sparkline);
  const volSignal = volumeSignal(volumeMillions, avgVolume);
  const momentumScore = computeMomentumScore(sparkline, rsiEstimate, relativeStrength);

  // ── Signal scoring ────────────────────────────────────────
  // Score range: -10 (strong sell) to +10 (strong buy)
  let score = 0;

  // RSI contribution
  if (rsiEstimate <= 30) score += 3;        // oversold → bullish
  else if (rsiEstimate <= 45) score += 1;
  else if (rsiEstimate >= 70) score -= 3;   // overbought → bearish
  else if (rsiEstimate >= 60) score -= 1;

  // Trend contribution
  if (trend === "Uptrend") score += 2;
  else if (trend === "Downtrend") score -= 2;

  // SMA crossover
  if (smaSignal === "Golden Cross") score += 2;
  else if (smaSignal === "Death Cross") score -= 2;

  // Daily change momentum
  if (changePercent > 3) score += 1;
  else if (changePercent > 1) score += 0.5;
  else if (changePercent < -3) score -= 1;
  else if (changePercent < -1) score -= 0.5;

  // Volume confirmation
  if (volSignal === "Surge" && trend === "Uptrend") score += 1;
  if (volSignal === "Surge" && trend === "Downtrend") score -= 1;
  if (volSignal === "Low") score -= 0.5; // weak conviction

  // Relative strength
  if (relativeStrength >= 75) score += 1;
  else if (relativeStrength <= 30) score -= 1;

  // Regime pressure adjustment
  const pressureAdj = (regime.score - 5) * -0.3; // high pressure → bearish bias
  score += pressureAdj;

  // ── Determine action ──────────────────────────────────────
  let action: TradingAction;
  let confidence: number;
  let strength: "Strong" | "Moderate" | "Weak";
  let timeframe: "Short-Term" | "Swing" | "Watch";

  const absScore = Math.abs(score);

  if (score >= 4) {
    action = "BUY";
    confidence = Math.min(95, 55 + absScore * 5);
    strength = score >= 6 ? "Strong" : "Moderate";
    timeframe = "Short-Term";
  } else if (score <= -4) {
    action = "SELL";
    confidence = Math.min(95, 55 + absScore * 5);
    strength = score <= -6 ? "Strong" : "Moderate";
    timeframe = "Short-Term";
  } else if (absScore >= 2) {
    action = "HOLD";
    confidence = Math.min(80, 45 + absScore * 5);
    strength = "Moderate";
    timeframe = "Swing";
  } else {
    action = "WATCH";
    confidence = Math.min(65, 35 + absScore * 5);
    strength = "Weak";
    timeframe = "Watch";
  }

  // Clamp confidence
  confidence = Math.round(Math.max(30, Math.min(95, confidence)));

  // ── Rationale ─────────────────────────────────────────────
  const rationaleMap: Record<TradingAction, string> = {
    BUY: `${trend === "Uptrend" ? "Uptrend intact" : "Oversold conditions"} with ${smaSignal === "Golden Cross" ? "golden cross" : "positive momentum"}${volSignal === "Surge" ? " and volume surge" : ""} in ${regime.label} regime.`,
    SELL: `${trend === "Downtrend" ? "Downtrend confirmed" : "Overbought conditions"} with ${smaSignal === "Death Cross" ? "death cross" : "negative momentum"}${volSignal === "Surge" ? " on elevated volume" : ""} in ${regime.label} regime.`,
    HOLD: `Mixed technicals — ${trend} trend with RSI at ${rsiEstimate.toFixed(0)}; await clearer directional signal before acting.`,
    WATCH: `Insufficient directional conviction; monitor for breakout above resistance or breakdown below support.`,
  };
  const rationale = rationaleMap[action];

  // ── Price levels ──────────────────────────────────────────
  const priceLevels = computePriceLevels(price, high, low, action);

  // ── Regime alignment ──────────────────────────────────────
  const { alignment: regimeAlignment, score: regimeAlignmentScore } = computeRegimeAlignment(action, regime);

  const result: TradingSignalResult = {
    ticker: input.ticker,
    action,
    confidence,
    strength,
    timeframe,
    rationale,
    technicals: {
      rsiEstimate,
      rsiLabel,
      trend,
      volumeSignal: volSignal,
      momentumScore,
      smaSignal,
    },
    priceLevels,
    regimeAlignment,
    regimeAlignmentScore,
    computedAt: Date.now(),
  };

  signalCache.set(cacheKey, { result, computedAt: Date.now() });
  return result;
}

/**
 * Compute trading signals for a batch of tickers.
 */
export function computeTradingSignals(
  inputs: TradingSignalsInput[],
  regime: RegimeInput
): TradingSignalResult[] {
  return inputs.map(input => computeTradingSignal(input, regime));
}

/** Clear the signal cache */
export function clearSignalCache(): void {
  signalCache.clear();
}

/** Get cache stats */
export function getSignalCacheStats(): { size: number } {
  return { size: signalCache.size };
}
