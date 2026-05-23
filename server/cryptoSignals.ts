// FAULTLINE — Crypto Trading Signal Engine
//
// Computes actionable BUY / SELL / HOLD / WATCH signals for crypto assets using:
//   WHEN OHLC bars available (CoinGecko /ohlc endpoint):
//     • True Wilder's 14-period RSI from daily closes
//     • Real SMA crossover (10/20-day when 20+ bars; 5/10-day otherwise)
//     • Proper MACD (12/26/9 EMA) with histogram
//   FALLBACK (sparkline only):
//     • RSI approximation from 7-day sparkline momentum
//     • SMA proxy from short vs long sparkline windows
//
//   Always applied:
//     • Volume confirmation (24h volume vs market cap ratio)
//     • Regime-weighted signal adjustment (FAULTLINE Pressure Index)
//     • Crypto-specific factors: BTC dominance, volatility regime, ATH distance
//     • ATR-based key price levels (support, resistance, entry, stop, target)
//
// All computation is deterministic and runs server-side.
// ============================================================

import { LRUCache } from "./lruCache";
import {
  computeEMA,
  computeWildersRSI,
  computeMACD,
  computeSMACrossover,
  type TradingAction,
  type MACDResult,
  type PriceLevels,
  type RegimeInput,
} from "./tradingSignals";
import type { CoinMarketData, CoinOHLCBar } from "./coingeckoProxy";

// ── Types ─────────────────────────────────────────────────────

export type { TradingAction };

export interface CryptoSignalResult {
  symbol: string;
  name: string;
  coinId: string;
  action: TradingAction;
  confidence: number;          // 0–100
  strength: "Strong" | "Moderate" | "Weak";
  timeframe: "Short-Term" | "Swing" | "Watch";
  rationale: string;
  technicals: {
    rsiEstimate: number;
    rsiLabel: "Overbought" | "Neutral" | "Oversold";
    rsiIsTrue: boolean;
    trend: "Uptrend" | "Downtrend" | "Sideways";
    volumeSignal: "Surge" | "Normal" | "Low";
    momentumScore: number;       // 0–100
    smaSignal: "Golden Cross" | "Death Cross" | "Neutral";
    smaIsTrue: boolean;
    macd: MACDResult | null;
    volatility24h: number;       // % intraday range
    distanceFromAth: number;     // % below ATH (negative = below)
    priceChange7d: number | null;
    priceChange30d: number | null;
  };
  priceLevels: PriceLevels;
  regimeAlignment: "Aligned" | "Neutral" | "Counter-Trend";
  regimeAlignmentScore: number;
  cryptoFactors: {
    btcDominanceEffect: "Headwind" | "Neutral" | "Tailwind";
    volatilityRegime: "High" | "Normal" | "Low";
    athProximity: "Near ATH" | "Mid-Range" | "Deep Discount";
    liquidityScore: number;      // 0–10 (volume/mcap ratio)
  };
  computedAt: number;
}

export interface CryptoSignalInput {
  market: CoinMarketData;
  ohlcBars?: CoinOHLCBar[];     // optional 30-day daily OHLC
  btcDominance?: number;         // % BTC dominance from global stats
  regime: RegimeInput;
}

// ── In-memory cache ───────────────────────────────────────────
interface CryptoSignalCacheEntry {
  result: CryptoSignalResult;
  computedAt: number;
}
const CRYPTO_SIGNAL_CACHE_TTL_MS = 90 * 1000; // 90 seconds — matches asset cache TTL
const cryptoSignalCache = new LRUCache<string, CryptoSignalCacheEntry>(500, CRYPTO_SIGNAL_CACHE_TTL_MS);

// ── Helpers ───────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Derive trend from a series of close prices (last 5 values).
 */
function deriveTrendFromCloses(closes: number[]): "Uptrend" | "Downtrend" | "Sideways" {
  if (closes.length < 2) return "Sideways";
  const recent = closes.slice(-5);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const delta = ((last - first) / first) * 100;
  if (delta > 2) return "Uptrend";
  if (delta < -2) return "Downtrend";
  return "Sideways";
}

/**
 * Derive trend from sparkline % values.
 */
function deriveTrendFromSparkline(sparkline: number[]): "Uptrend" | "Downtrend" | "Sideways" {
  if (sparkline.length < 2) return "Sideways";
  const first = sparkline[0];
  const last = sparkline[sparkline.length - 1];
  const delta = last - first;
  if (delta > 2) return "Uptrend";
  if (delta < -2) return "Downtrend";
  return "Sideways";
}

/**
 * Volume signal: volume/mcap ratio as a proxy for liquidity surge.
 * Crypto volume is typically 2–8% of market cap per day.
 */
function cryptoVolumeSignal(volume: number, marketCap: number): "Surge" | "Normal" | "Low" {
  if (marketCap <= 0) return "Normal";
  const ratio = volume / marketCap;
  if (ratio >= 0.12) return "Surge";
  if (ratio < 0.03) return "Low";
  return "Normal";
}

/**
 * Liquidity score (0–10) based on volume/mcap ratio.
 */
function computeLiquidityScore(volume: number, marketCap: number): number {
  if (marketCap <= 0) return 5;
  const ratio = volume / marketCap;
  // 0.02 = illiquid (score 1), 0.10 = very liquid (score 9)
  const score = clamp((ratio / 0.10) * 9, 1, 10);
  return parseFloat(score.toFixed(1));
}

/**
 * BTC dominance effect on altcoins.
 * Rising BTC dominance = headwind for alts; falling = tailwind.
 */
function btcDominanceEffect(
  symbol: string,
  btcDominance: number
): "Headwind" | "Neutral" | "Tailwind" {
  // BTC itself is not affected by its own dominance
  if (symbol === "BTC" || symbol === "WBTC") return "Neutral";
  if (btcDominance >= 58) return "Headwind";   // capital concentrating in BTC
  if (btcDominance <= 50) return "Tailwind";   // capital flowing to alts
  return "Neutral";
}

/**
 * ATH proximity classification.
 */
function athProximity(distanceFromAth: number): "Near ATH" | "Mid-Range" | "Deep Discount" {
  if (distanceFromAth >= -15) return "Near ATH";
  if (distanceFromAth >= -60) return "Mid-Range";
  return "Deep Discount";
}

/**
 * Volatility regime from 24h intraday range.
 */
function volatilityRegime(volatility24h: number): "High" | "Normal" | "Low" {
  if (volatility24h >= 8) return "High";
  if (volatility24h <= 2) return "Low";
  return "Normal";
}

/**
 * Compute ATR-based price levels for crypto.
 */
function computeCryptoPriceLevels(
  price: number,
  high: number,
  low: number,
  action: TradingAction,
  ohlcBars?: CoinOHLCBar[]
): PriceLevels {
  let atr: number;
  if (ohlcBars && ohlcBars.length >= 14) {
    const ranges = ohlcBars.slice(-14).map(b => b.high - b.low);
    atr = ranges.reduce((s, v) => s + v, 0) / ranges.length;
    atr = Math.max(atr, price * 0.01); // crypto min ATR = 1% of price
  } else {
    const range = high - low;
    atr = Math.max(range, price * 0.02); // fallback: 2% of price
  }

  const support = parseFloat((low - atr * 0.1).toFixed(8));
  const resistance = parseFloat((high + atr * 0.1).toFixed(8));

  let entryZone: number;
  let stopLoss: number;
  let targetPrice: number;

  if (action === "BUY") {
    entryZone = parseFloat(price.toFixed(8));
    stopLoss = parseFloat(Math.max(low - atr * 0.1, entryZone - atr * 1.5).toFixed(8));
    const risk = entryZone - stopLoss;
    targetPrice = parseFloat((entryZone + risk * 2).toFixed(8));
  } else if (action === "SELL") {
    entryZone = parseFloat(price.toFixed(8));
    stopLoss = parseFloat(Math.min(high + atr * 0.1, entryZone + atr * 1.5).toFixed(8));
    const risk = stopLoss - entryZone;
    targetPrice = parseFloat((entryZone - risk * 2).toFixed(8));
  } else {
    entryZone = parseFloat(price.toFixed(8));
    stopLoss = parseFloat((price - atr * 1.5).toFixed(8));
    targetPrice = parseFloat((price + atr * 2).toFixed(8));
  }

  const risk = Math.abs(entryZone - stopLoss);
  const reward = Math.abs(targetPrice - entryZone);
  const riskReward = risk > 0 ? parseFloat((reward / risk).toFixed(1)) : 0;

  return { support, resistance, entryZone, stopLoss, targetPrice, riskReward, atr: parseFloat(atr.toFixed(8)) };
}

/**
 * Regime alignment for crypto — same logic as stocks but with crypto-specific regime labels.
 */
function computeCryptoRegimeAlignment(
  action: TradingAction,
  regime: RegimeInput
): { alignment: "Aligned" | "Neutral" | "Counter-Trend"; score: number } {
  const label = regime.label.toUpperCase();
  const pressureScore = regime.score;

  let regimeBias: "bullish" | "bearish" | "neutral" = "neutral";
  if (label.includes("AI MELT") || label.includes("MOMENTUM") || pressureScore < 3.5) {
    regimeBias = "bullish";
  } else if (
    label.includes("RECESSION") || label.includes("CREDIT") ||
    label.includes("LIQUIDITY") || pressureScore > 7
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
  if (action === "HOLD" || action === "WATCH") return { alignment: "Neutral", score: 5 };
  return { alignment: "Neutral", score: 6 };
}

// ── Core signal computation ───────────────────────────────────

export function computeCryptoSignal(input: CryptoSignalInput): CryptoSignalResult {
  const { market, ohlcBars, btcDominance = 55, regime } = input;

  const cacheKey = `${market.id}:${regime.label}:${market.currentPrice}:${ohlcBars?.length ?? 0}`;
  const cached = cryptoSignalCache.peek(cacheKey);
  if (cached) return cached.value.result;

  const {
    symbol, name, id: coinId,
    currentPrice: price,
    high24h: high, low24h: low,
    priceChangePercent24h: changePercent,
    totalVolume: volume,
    marketCap,
    sparkline7d,
    volatility24h: vol24h,
    distanceFromAth: dFromAth,
    priceChangePercent7d: change7d,
    priceChangePercent30d: change30d,
  } = market;

  // ── Data quality path ─────────────────────────────────────
  const closes = ohlcBars?.map(b => b.close) ?? [];
  const hasDailyBars = closes.length >= 15;

  // Convert sparkline7d (hourly prices) to daily-like changes for fallback
  // sparkline7d contains up to 48 hourly price points
  const sparklineChanges: number[] = [];
  if (sparkline7d.length >= 2) {
    for (let i = 1; i < sparkline7d.length; i++) {
      const pct = ((sparkline7d[i] - sparkline7d[i - 1]) / sparkline7d[i - 1]) * 100;
      sparklineChanges.push(pct);
    }
  }

  // ── RSI ───────────────────────────────────────────────────
  let rsiEstimate: number;
  let rsiIsTrue: boolean;

  if (hasDailyBars) {
    rsiEstimate = computeWildersRSI(closes, 14);
    rsiIsTrue = true;
  } else if (sparkline7d.length >= 15) {
    rsiEstimate = computeWildersRSI(sparkline7d, 14);
    rsiIsTrue = false;
  } else if (sparklineChanges.length >= 2) {
    const gains = sparklineChanges.filter(c => c > 0);
    const losses = sparklineChanges.filter(c => c < 0).map(Math.abs);
    const avgGain = gains.length > 0 ? gains.reduce((s, v) => s + v, 0) / sparklineChanges.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, v) => s + v, 0) / sparklineChanges.length : 0;
    rsiEstimate = avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
    rsiIsTrue = false;
  } else {
    // Last resort: derive from single 24h change
    rsiEstimate = changePercent > 5 ? 65 : changePercent < -5 ? 35 : 50;
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
  } else if (sparkline7d.length >= 20) {
    const smaResult = computeSMACrossover(sparkline7d);
    smaSignal = smaResult.signal;
    smaIsTrue = false;
  } else {
    // Fallback: use 7d vs 30d price change direction
    const short = change7d ?? changePercent;
    const long = change30d ?? changePercent;
    smaSignal = short > long + 1 ? "Golden Cross" : short < long - 1 ? "Death Cross" : "Neutral";
    smaIsTrue = false;
  }

  // ── MACD ──────────────────────────────────────────────────
  let macd: MACDResult | null = null;
  if (hasDailyBars && closes.length >= 35) {
    macd = computeMACD(closes);
  } else if (sparkline7d.length >= 35) {
    macd = computeMACD(sparkline7d);
  }

  // ── Trend ─────────────────────────────────────────────────
  const trend = hasDailyBars
    ? deriveTrendFromCloses(closes)
    : deriveTrendFromSparkline(sparklineChanges);

  // ── Volume ────────────────────────────────────────────────
  const volSignal = cryptoVolumeSignal(volume, marketCap);

  // ── Crypto-specific factors ───────────────────────────────
  const btcEffect = btcDominanceEffect(symbol, btcDominance);
  const volRegime = volatilityRegime(vol24h);
  const athProx = athProximity(dFromAth);
  const liquidityScore = computeLiquidityScore(volume, marketCap);

  // ── Momentum score ────────────────────────────────────────
  // Blend RSI, trend, 7d change, and liquidity
  let momentumBase = clamp(rsiEstimate, 0, 100);
  if (trend === "Uptrend") momentumBase = Math.min(100, momentumBase + 8);
  if (trend === "Downtrend") momentumBase = Math.max(0, momentumBase - 8);
  if (change7d !== null) {
    momentumBase += clamp(change7d * 0.5, -10, 10);
  }
  const momentumScore = Math.round(clamp(momentumBase, 0, 100));

  // ── Signal scoring ────────────────────────────────────────
  // Score range: -10 (strong sell) to +10 (strong buy)
  let score = 0;

  // RSI contribution (crypto uses wider bands due to higher volatility)
  if (rsiEstimate <= 28) score += 3.5;
  else if (rsiEstimate <= 40) score += 1.5;
  else if (rsiEstimate >= 75) score -= 3.5;
  else if (rsiEstimate >= 65) score -= 1.5;

  // Trend
  if (trend === "Uptrend") score += 2;
  else if (trend === "Downtrend") score -= 2;

  // SMA crossover
  if (smaSignal === "Golden Cross") score += 1.5;
  else if (smaSignal === "Death Cross") score -= 1.5;

  // MACD confirmation
  if (macd) {
    if (macd.signal === "Bullish") score += 1.5;
    else if (macd.signal === "Bearish") score -= 1.5;
    if (macd.histogram > 0 && macd.macdLine > 0) score += 0.5;
    if (macd.histogram < 0 && macd.macdLine < 0) score -= 0.5;
  }

  // 24h momentum (crypto amplified)
  if (changePercent > 8) score += 1.5;
  else if (changePercent > 3) score += 0.75;
  else if (changePercent < -8) score -= 1.5;
  else if (changePercent < -3) score -= 0.75;

  // 7d momentum
  if (change7d !== null) {
    if (change7d > 15) score += 1;
    else if (change7d > 5) score += 0.5;
    else if (change7d < -15) score -= 1;
    else if (change7d < -5) score -= 0.5;
  }

  // Volume confirmation
  if (volSignal === "Surge" && trend === "Uptrend") score += 1;
  if (volSignal === "Surge" && trend === "Downtrend") score -= 1;
  if (volSignal === "Low") score -= 0.5;

  // BTC dominance effect on altcoins
  if (btcEffect === "Tailwind") score += 0.5;
  if (btcEffect === "Headwind") score -= 0.5;

  // ATH proximity — near ATH = more resistance; deep discount = potential reversal
  if (athProx === "Deep Discount" && trend === "Uptrend") score += 0.5;
  if (athProx === "Near ATH" && trend === "Uptrend") score -= 0.5;

  // High volatility reduces conviction
  if (volRegime === "High") score *= 0.9;

  // Regime pressure adjustment (same as stocks)
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
    confidence = Math.min(92, 52 + absScore * 5);
    strength = score >= 6 ? "Strong" : "Moderate";
    timeframe = "Short-Term";
  } else if (score <= -4) {
    action = "SELL";
    confidence = Math.min(92, 52 + absScore * 5);
    strength = score <= -6 ? "Strong" : "Moderate";
    timeframe = "Short-Term";
  } else if (absScore >= 2) {
    action = "HOLD";
    confidence = Math.min(78, 42 + absScore * 5);
    strength = "Moderate";
    timeframe = "Swing";
  } else {
    action = "WATCH";
    confidence = Math.min(62, 32 + absScore * 5);
    strength = "Weak";
    timeframe = "Watch";
  }

  confidence = Math.round(clamp(confidence, 30, 92));

  // ── Rationale ─────────────────────────────────────────────
  const macdNote = macd ? ` MACD ${macd.signal.toLowerCase()}.` : "";
  const rsiNote = rsiIsTrue ? `RSI(14) at ${rsiEstimate.toFixed(0)}` : `RSI~ ${rsiEstimate.toFixed(0)}`;
  const btcNote = btcEffect !== "Neutral" ? ` BTC dominance ${btcEffect === "Headwind" ? "rising (headwind for alts)" : "falling (tailwind for alts)"}.` : "";

  const rationaleMap: Record<TradingAction, string> = {
    BUY: `${trend === "Uptrend" ? "Uptrend intact" : "Oversold conditions"} — ${rsiNote}, ${smaSignal === "Golden Cross" ? "golden cross" : "positive momentum"}${volSignal === "Surge" ? ", volume surge" : ""}.${macdNote}${btcNote}`,
    SELL: `${trend === "Downtrend" ? "Downtrend confirmed" : "Overbought conditions"} — ${rsiNote}, ${smaSignal === "Death Cross" ? "death cross" : "negative momentum"}${volSignal === "Surge" ? ", elevated volume" : ""}.${macdNote}${btcNote}`,
    HOLD: `Mixed technicals — ${trend} trend, ${rsiNote}; await clearer directional signal.${macdNote}${btcNote}`,
    WATCH: `Insufficient conviction — monitor for breakout above resistance or breakdown below support.${btcNote}`,
  };
  const rationale = rationaleMap[action];

  // ── Price levels ──────────────────────────────────────────
  const priceLevels = computeCryptoPriceLevels(price, high, low, action, ohlcBars);

  // ── Regime alignment ──────────────────────────────────────
  const { alignment: regimeAlignment, score: regimeAlignmentScore } = computeCryptoRegimeAlignment(action, regime);

  const result: CryptoSignalResult = {
    symbol,
    name,
    coinId,
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
      volatility24h: parseFloat(vol24h.toFixed(2)),
      distanceFromAth: parseFloat(dFromAth.toFixed(2)),
      priceChange7d: change7d !== null ? parseFloat(change7d.toFixed(2)) : null,
      priceChange30d: change30d !== null ? parseFloat(change30d.toFixed(2)) : null,
    },
    priceLevels,
    regimeAlignment,
    regimeAlignmentScore,
    cryptoFactors: {
      btcDominanceEffect: btcEffect,
      volatilityRegime: volRegime,
      athProximity: athProx,
      liquidityScore,
    },
    computedAt: Date.now(),
  };

  cryptoSignalCache.set(cacheKey, { result, computedAt: Date.now() });
  return result;
}

/**
 * Compute signals for a batch of crypto assets.
 */
export function computeCryptoSignals(
  inputs: CryptoSignalInput[]
): CryptoSignalResult[] {
  return inputs.map(input => computeCryptoSignal(input));
}

/** Clear the crypto signal cache */
export function clearCryptoSignalCache(): void {
  cryptoSignalCache.clear();
}

/** Get cache stats */
export function getCryptoSignalCacheStats(): { size: number } {
  return { size: cryptoSignalCache.size };
}

// Re-export shared indicator helpers for use in tests
export { computeEMA, computeWildersRSI, computeMACD, computeSMACrossover };
