// ============================================================
// FAULTLINE — Trading Signal Engine v2
//
// Computes actionable BUY / SELL / HOLD signals using:
//   WHEN dailyBars provided (Polygon.io Starter+):
//     • True Wilder's 14-period RSI from daily closes
//     • Real 50-day / 200-day SMA crossover (golden/death cross)
//     • Proper MACD (12/26/9 EMA) with histogram
//   FALLBACK (free tier / no bars):
//     • RSI approximation from 5-day sparkline momentum
//     • SMA proxy from short vs long sparkline windows
//
//   Always applied:
//     • Volume confirmation (current vs average)
//     • Regime-weighted signal adjustment
//     • ATR-based key price levels (support, resistance, entry, stop, target)
//
// All computation is deterministic and runs server-side.
// ============================================================

// ── Types ─────────────────────────────────────────────────────

export type TradingAction = "BUY" | "SELL" | "HOLD" | "WATCH";

export interface DailyBar {
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number; // Unix ms
}

export interface PriceLevels {
  support: number;       // estimated support (recent low area)
  resistance: number;    // estimated resistance (recent high area)
  entryZone: number;     // suggested entry price
  stopLoss: number;      // ATR-based stop-loss
  targetPrice: number;   // 2:1 R:R target based on direction
  riskReward: number;    // (target - entry) / (entry - stop), rounded to 1dp
  atr: number;           // estimated ATR (high - low range proxy)
}

export interface MACDResult {
  macdLine: number;      // EMA(12) - EMA(26)
  signalLine: number;    // EMA(9) of macdLine
  histogram: number;     // macdLine - signalLine
  signal: "Bullish" | "Bearish" | "Neutral";
}

export interface TradingSignalResult {
  ticker: string;
  action: TradingAction;
  confidence: number;          // 0–100
  strength: "Strong" | "Moderate" | "Weak";
  timeframe: "Short-Term" | "Swing" | "Watch";
  rationale: string;           // 1-sentence reason
  technicals: {
    rsiEstimate: number;       // 0–100 RSI (true 14-period when bars available)
    rsiLabel: "Overbought" | "Neutral" | "Oversold";
    rsiIsTrue: boolean;        // true = Wilder's 14-period; false = sparkline approx
    trend: "Uptrend" | "Downtrend" | "Sideways";
    volumeSignal: "Surge" | "Normal" | "Low";
    momentumScore: number;     // 0–100
    smaSignal: "Golden Cross" | "Death Cross" | "Neutral";
    smaIsTrue: boolean;        // true = real 50/200-day SMA; false = sparkline proxy
    macd: MACDResult | null;   // null when daily bars not available
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
  dailyBars?: DailyBar[];      // optional: 20–200 daily OHLC bars from Polygon.io
}

export interface RegimeInput {
  label: string;
  score: number;               // 0–10 (higher = more stressed)
}

// ── In-memory cache ───────────────────────────────────────────
import { LRUCache } from "./lruCache";

interface SignalCacheEntry {
  result: TradingSignalResult;
  computedAt: number;
}
const SIGNAL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// Max 1000 entries (one per ticker:regime:price combo) — LRU evicts oldest
const signalCache = new LRUCache<string, SignalCacheEntry>(1000, SIGNAL_CACHE_TTL_MS);

// ── EMA helper ────────────────────────────────────────────────

/**
 * Compute Exponential Moving Average (EMA) over a series of values.
 * Uses standard EMA multiplier: k = 2 / (period + 1)
 */
export function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

// ── True Wilder's RSI ─────────────────────────────────────────

/**
 * Compute true Wilder's 14-period RSI from an array of closing prices.
 * Requires at least 15 values (14 changes).
 * Returns the most recent RSI value.
 */
export function computeWildersRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) {
    // Fallback: simple average gain/loss RSI
    return approximateRSIFromCloses(closes);
  }

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // Seed with simple average over first `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for remaining changes
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] >= 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

/**
 * Simple RSI approximation from a short series of close prices.
 * Used as fallback when fewer than 15 bars are available.
 */
function approximateRSIFromCloses(closes: number[]): number {
  if (closes.length < 2) return 50;
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  const gains = changes.filter(c => c > 0);
  const losses = changes.filter(c => c < 0).map(Math.abs);
  const avgGain = gains.length > 0 ? gains.reduce((s, v) => s + v, 0) / changes.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, v) => s + v, 0) / changes.length : 0;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

// ── True MACD ─────────────────────────────────────────────────

/**
 * Compute MACD (12/26/9) from an array of closing prices.
 * Returns the most recent MACD line, signal line, and histogram.
 * Requires at least 35 values (26 + 9) for reliable output.
 */
export function computeMACD(closes: number[], fast = 12, slow = 26, signal = 9): MACDResult | null {
  if (closes.length < slow + signal) return null;

  const ema12 = computeEMA(closes, fast);
  const ema26 = computeEMA(closes, slow);

  // MACD line: only valid from index (slow - 1) onwards
  const macdLine: number[] = [];
  for (let i = slow - 1; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }

  if (macdLine.length < signal) return null;

  const signalLineArr = computeEMA(macdLine, signal);
  const lastMACD = macdLine[macdLine.length - 1];
  const lastSignal = signalLineArr[signalLineArr.length - 1];
  const histogram = lastMACD - lastSignal;

  // Determine signal direction
  let macdSignal: "Bullish" | "Bearish" | "Neutral";
  if (histogram > 0 && lastMACD > 0) macdSignal = "Bullish";
  else if (histogram < 0 && lastMACD < 0) macdSignal = "Bearish";
  else if (histogram > 0) macdSignal = "Bullish"; // above signal even if MACD negative
  else if (histogram < 0) macdSignal = "Bearish";
  else macdSignal = "Neutral";

  return {
    macdLine: parseFloat(lastMACD.toFixed(4)),
    signalLine: parseFloat(lastSignal.toFixed(4)),
    histogram: parseFloat(histogram.toFixed(4)),
    signal: macdSignal,
  };
}

// ── True SMA crossover ────────────────────────────────────────

/**
 * Compute SMA crossover using real daily closes.
 * Uses 50-day and 200-day SMAs when enough bars are available,
 * otherwise falls back to shorter windows.
 */
export function computeSMACrossover(closes: number[]): {
  signal: "Golden Cross" | "Death Cross" | "Neutral";
  isTrue: boolean;
  sma50: number | null;
  sma200: number | null;
} {
  if (closes.length < 10) {
    return { signal: "Neutral", isTrue: false, sma50: null, sma200: null };
  }

  // Use real 50/200 when we have enough data
  if (closes.length >= 200) {
    const sma50 = closes.slice(-50).reduce((s, v) => s + v, 0) / 50;
    const sma200 = closes.slice(-200).reduce((s, v) => s + v, 0) / 200;
    const signal = sma50 > sma200 * 1.001 ? "Golden Cross"
      : sma50 < sma200 * 0.999 ? "Death Cross"
      : "Neutral";
    return { signal, isTrue: true, sma50: parseFloat(sma50.toFixed(2)), sma200: parseFloat(sma200.toFixed(2)) };
  }

  // 20-day data: use 10/20 SMA as proxy
  if (closes.length >= 20) {
    const sma10 = closes.slice(-10).reduce((s, v) => s + v, 0) / 10;
    const sma20 = closes.slice(-20).reduce((s, v) => s + v, 0) / 20;
    const signal = sma10 > sma20 * 1.001 ? "Golden Cross"
      : sma10 < sma20 * 0.999 ? "Death Cross"
      : "Neutral";
    return { signal, isTrue: false, sma50: null, sma200: null };
  }

  // Short data: use sparkline-style short/long windows
  const shortSMA = closes.slice(-Math.floor(closes.length / 3)).reduce((s, v) => s + v, 0) / Math.floor(closes.length / 3);
  const longSMA = closes.reduce((s, v) => s + v, 0) / closes.length;
  const diff = (shortSMA - longSMA) / longSMA * 100;
  const signal = diff > 0.5 ? "Golden Cross" : diff < -0.5 ? "Death Cross" : "Neutral";
  return { signal, isTrue: false, sma50: null, sma200: null };
}

// ── Fallback helpers (sparkline-based) ───────────────────────

/**
 * Approximate RSI from a series of % change values (sparkline).
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
 * Derive daily % changes from a sparkline (% from first close).
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
 * SMA crossover signal using sparkline values (fallback).
 */
function smaCrossoverFallback(sparkline: number[]): "Golden Cross" | "Death Cross" | "Neutral" {
  if (sparkline.length < 4) return "Neutral";
  const shortSMA = sparkline.slice(-2).reduce((s, v) => s + v, 0) / 2;
  const longSMA = sparkline.slice(-4).reduce((s, v) => s + v, 0) / 4;
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
  action: TradingAction,
  dailyBars?: DailyBar[]
): PriceLevels {
  // Use 14-day ATR if daily bars available
  let atr: number;
  if (dailyBars && dailyBars.length >= 14) {
    const ranges = dailyBars.slice(-14).map(b => b.high - b.low);
    atr = ranges.reduce((s, v) => s + v, 0) / ranges.length;
    atr = Math.max(atr, price * 0.005);
  } else {
    const range = high - low;
    atr = Math.max(range, price * 0.005);
  }

  const support = parseFloat((low - atr * 0.1).toFixed(2));
  const resistance = parseFloat((high + atr * 0.1).toFixed(2));

  let entryZone: number;
  let stopLoss: number;
  let targetPrice: number;

  if (action === "BUY") {
    entryZone = parseFloat(price.toFixed(2));
    stopLoss = parseFloat(Math.max(low - atr * 0.1, entryZone - atr * 1.5).toFixed(2));
    const riskPerShare = entryZone - stopLoss;
    targetPrice = parseFloat((entryZone + riskPerShare * 2).toFixed(2));
  } else if (action === "SELL") {
    entryZone = parseFloat(price.toFixed(2));
    stopLoss = parseFloat(Math.min(high + atr * 0.1, entryZone + atr * 1.5).toFixed(2));
    const riskPerShare = stopLoss - entryZone;
    targetPrice = parseFloat((entryZone - riskPerShare * 2).toFixed(2));
  } else {
    entryZone = parseFloat(price.toFixed(2));
    stopLoss = parseFloat((price - atr * 1.5).toFixed(2));
    targetPrice = parseFloat((price + atr * 2).toFixed(2));
  }

  const risk = Math.abs(entryZone - stopLoss);
  const reward = Math.abs(targetPrice - entryZone);
  const riskReward = risk > 0 ? parseFloat((reward / risk).toFixed(1)) : 0;

  return { support, resistance, entryZone, stopLoss, targetPrice, riskReward, atr: parseFloat(atr.toFixed(2)) };
}

/**
 * Regime alignment: how well does the action align with the current macro regime?
 */
function computeRegimeAlignment(
  action: TradingAction,
  regime: RegimeInput
): { alignment: "Aligned" | "Neutral" | "Counter-Trend"; score: number } {
  const label = regime.label.toUpperCase();
  const pressureScore = regime.score;

  let regimeBias: "bullish" | "bearish" | "neutral" = "neutral";
  if (label.includes("AI MELT") || label.includes("MOMENTUM") || pressureScore < 3.5) {
    regimeBias = "bullish";
  } else if (label.includes("RECESSION") || label.includes("CREDIT") || label.includes("LIQUIDITY") || pressureScore > 7) {
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
  if (action === "HOLD" || action === "WATCH") return { alignment: "Neutral", score: 5 };
  return { alignment: "Neutral", score: 6 };
}

/**
 * Compute a momentum score (0–100) from sparkline and RSI.
 */
function computeMomentumScore(sparkline: number[], rsi: number, relativeStrength: number): number {
  const trend = deriveTrend(sparkline);
  let base = relativeStrength;
  if (trend === "Uptrend") base = Math.min(100, base + 10);
  if (trend === "Downtrend") base = Math.max(0, base - 10);
  const blended = base * 0.6 + rsi * 0.4;
  return Math.round(Math.max(0, Math.min(100, blended)));
}

// ── Core signal computation ───────────────────────────────────

export function computeTradingSignal(
  input: TradingSignalsInput,
  regime: RegimeInput
): TradingSignalResult {
  const cacheKey = `${input.ticker}:${regime.label}:${input.price}:${input.dailyBars?.length ?? 0}`;
  const cached = signalCache.peek(cacheKey);
  if (cached) {
    return cached.value.result;
  }

  const { price, high, low, changePercent, volumeMillions, avgVolume, sparkline, relativeStrength, dailyBars } = input;

  // ── Determine data quality path ───────────────────────────
  const closes = dailyBars?.map(b => b.close) ?? [];
  const hasDailyBars = closes.length >= 15;

  // ── RSI ───────────────────────────────────────────────────
  let rsiEstimate: number;
  let rsiIsTrue: boolean;

  if (hasDailyBars) {
    rsiEstimate = computeWildersRSI(closes, 14);
    rsiIsTrue = true;
  } else {
    const dailyChanges = sparklineToDailyChanges(sparkline);
    rsiEstimate = approximateRSI(dailyChanges.length > 0 ? dailyChanges : [changePercent]);
    rsiIsTrue = false;
  }

  const rsiLabel: "Overbought" | "Neutral" | "Oversold" =
    rsiEstimate >= 70 ? "Overbought" : rsiEstimate <= 30 ? "Oversold" : "Neutral";

  // ── SMA crossover ─────────────────────────────────────────
  let smaSignal: "Golden Cross" | "Death Cross" | "Neutral";
  let smaIsTrue: boolean;

  if (hasDailyBars) {
    const smaResult = computeSMACrossover(closes);
    smaSignal = smaResult.signal;
    smaIsTrue = smaResult.isTrue;
  } else {
    smaSignal = smaCrossoverFallback(sparkline);
    smaIsTrue = false;
  }

  // ── MACD ──────────────────────────────────────────────────
  const macd = hasDailyBars ? computeMACD(closes) : null;

  // ── Trend ─────────────────────────────────────────────────
  const trend = hasDailyBars && closes.length >= 5
    ? deriveTrend(closes.slice(-5).map((c, i, arr) => i === 0 ? 0 : (c - arr[0]) / arr[0] * 100))
    : deriveTrend(sparkline);

  // ── Volume ────────────────────────────────────────────────
  const volSignal = volumeSignal(volumeMillions, avgVolume);

  // ── Momentum score ────────────────────────────────────────
  const momentumScore = computeMomentumScore(sparkline, rsiEstimate, relativeStrength);

  // ── Signal scoring ────────────────────────────────────────
  // Score range: -10 (strong sell) to +10 (strong buy)
  let score = 0;

  // RSI contribution
  if (rsiEstimate <= 30) score += 3;
  else if (rsiEstimate <= 45) score += 1;
  else if (rsiEstimate >= 70) score -= 3;
  else if (rsiEstimate >= 60) score -= 1;

  // Trend
  if (trend === "Uptrend") score += 2;
  else if (trend === "Downtrend") score -= 2;

  // SMA crossover
  if (smaSignal === "Golden Cross") score += 2;
  else if (smaSignal === "Death Cross") score -= 2;

  // MACD confirmation (bonus when real bars available)
  if (macd) {
    if (macd.signal === "Bullish") score += 1.5;
    else if (macd.signal === "Bearish") score -= 1.5;
    // Strong histogram divergence adds extra weight
    if (macd.histogram > 0 && macd.macdLine > 0) score += 0.5;
    if (macd.histogram < 0 && macd.macdLine < 0) score -= 0.5;
  }

  // Daily change momentum
  if (changePercent > 3) score += 1;
  else if (changePercent > 1) score += 0.5;
  else if (changePercent < -3) score -= 1;
  else if (changePercent < -1) score -= 0.5;

  // Volume confirmation
  if (volSignal === "Surge" && trend === "Uptrend") score += 1;
  if (volSignal === "Surge" && trend === "Downtrend") score -= 1;
  if (volSignal === "Low") score -= 0.5;

  // Relative strength
  if (relativeStrength >= 75) score += 1;
  else if (relativeStrength <= 30) score -= 1;

  // Regime pressure adjustment
  const pressureAdj = (regime.score - 5) * -0.3;
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

  confidence = Math.round(Math.max(30, Math.min(95, confidence)));

  // ── Rationale ─────────────────────────────────────────────
  const macdNote = macd ? ` MACD ${macd.signal.toLowerCase()}.` : "";
  const rsiNote = rsiIsTrue ? `RSI(14) at ${rsiEstimate.toFixed(0)}` : `RSI~ ${rsiEstimate.toFixed(0)}`;
  const rationaleMap: Record<TradingAction, string> = {
    BUY: `${trend === "Uptrend" ? "Uptrend intact" : "Oversold conditions"} — ${rsiNote}, ${smaSignal === "Golden Cross" ? "golden cross" : "positive momentum"}${volSignal === "Surge" ? ", volume surge" : ""}.${macdNote}`,
    SELL: `${trend === "Downtrend" ? "Downtrend confirmed" : "Overbought conditions"} — ${rsiNote}, ${smaSignal === "Death Cross" ? "death cross" : "negative momentum"}${volSignal === "Surge" ? ", elevated volume" : ""}.${macdNote}`,
    HOLD: `Mixed technicals — ${trend} trend, ${rsiNote}; await clearer directional signal.${macdNote}`,
    WATCH: `Insufficient conviction — monitor for breakout above resistance or breakdown below support.`,
  };
  const rationale = rationaleMap[action];

  // ── Price levels ──────────────────────────────────────────
  const priceLevels = computePriceLevels(price, high, low, action, dailyBars);

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
      rsiIsTrue,
      trend,
      volumeSignal: volSignal,
      momentumScore,
      smaSignal,
      smaIsTrue,
      macd,
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

/** Get signal cache stats (for testing and monitoring) */
export function getSignalCacheStats(): { size: number } {
  return { size: signalCache.size };
}
