// FAULTLINE — Crypto Trading Signal Engine
//
// Computes actionable BUY / SELL / HOLD / WATCH signals for crypto assets using:
//   Completed daily OHLC closes (15 or more) are required:
//     • True Wilder's 14-period RSI from daily closes
//     • SMA 50/200 crossover only when 200 closes exist
//     • MACD (12/26/9) only when the close series is long enough
//   Fewer than 15 completed closes returns Unavailable. A 7-day sparkline
//   is not a completed-bar history and is never scored.
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
  cryptoActionLabel,
  MACD_MIN_COMPLETED_BARS,
  RSI_MIN_COMPLETED_BARS,
  type TradingAction,
  type MACDResult,
  type PriceLevels,
  type RegimeInput,
} from "./tradingSignals";
import { completedCoinDailyBars, type CoinMarketData, type CoinOHLCBar } from "./coingeckoProxy";

// ── Types ─────────────────────────────────────────────────────

export type { TradingAction };

/** Crypto-specific regime label (separate from equity regime). */
export type CryptoRegimeLabel = "Bullish" | "Neutral" | "Defensive" | "Risk-Off";

export interface CryptoSignalResult {
  symbol: string;
  name: string;
  coinId: string;
  assetClass: "CRYPTO";         // always CRYPTO for UI labeling
  action: TradingAction;
  actionLabel: string;         // precision label: "Accumulation Zone" | "Avoid New Entry" | "Hold" | "Watch"
  cryptoRegime: CryptoRegimeLabel; // overall crypto market regime
  regimeConflict: boolean;     // true if individual signal conflicts with overall crypto regime
  regimeConflictExplanation: string | null; // why signal differs from regime (shown in UI)
  confidence: number | null;   // null when completed bars or RSI are withheld
  strength: "Strong" | "Moderate" | "Weak";
  timeframe: "Short-Term" | "Swing" | "Watch";
  rationale: string;
  technicals: {
    rsiEstimate: number | null;
    rsiLabel: "Overbought" | "Neutral" | "Oversold";
    rsiIsTrue: boolean;
    trend: "Uptrend" | "Downtrend" | "Sideways";
    volumeSignal: "Surge" | "Normal" | "Low" | "Unavailable";
    momentumScore: number | null; // null when RSI is withheld
    smaSignal: "Golden Cross" | "Death Cross" | "Neutral";
    smaIsTrue: boolean;
    macd: MACDResult | null;
    volatility24h: number | null;       // % intraday range
    distanceFromAth: number | null;     // % below ATH (negative = below)
    priceChange7d: number | null;
    priceChange30d: number | null;
  };
  priceLevels: PriceLevels;
  regimeAlignment: "Aligned" | "Neutral" | "Counter-Trend";
  regimeAlignmentScore: number;
  cryptoFactors: {
    btcDominanceEffect: "Headwind" | "Neutral" | "Tailwind" | "Unavailable";
    volatilityRegime: "High" | "Normal" | "Low" | "Unavailable";
    athProximity: "Near ATH" | "Mid-Range" | "Deep Discount" | "Unavailable";
    liquidityScore: number | null;      // 0–10 (volume/mcap ratio); null when volume or market cap is missing
  };
  computedAt: number;
}

export interface CryptoSignalInput {
  market: CoinMarketData;
  ohlcBars?: CoinOHLCBar[];     // optional 30-day daily OHLC
  btcDominance?: number | null; // omitted when global stats did not supply it
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
 * Volume signal: volume/mcap ratio as a proxy for liquidity surge.
 * Crypto volume is typically 2–8% of market cap per day.
 */
function cryptoVolumeSignal(volume: number | null, marketCap: number | null): "Surge" | "Normal" | "Low" | "Unavailable" {
  if (volume == null || marketCap == null) return "Unavailable";
  if (marketCap <= 0) return "Normal";
  const ratio = volume / marketCap;
  if (ratio >= 0.12) return "Surge";
  if (ratio < 0.03) return "Low";
  return "Normal";
}

/**
 * Liquidity score (0–10) based on volume/mcap ratio.
 */
function computeLiquidityScore(volume: number | null, marketCap: number | null): number | null {
  if (volume == null || marketCap == null) return null;
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
  btcDominance: number | null
): "Headwind" | "Neutral" | "Tailwind" | "Unavailable" {
  if (btcDominance == null || !Number.isFinite(btcDominance)) return "Unavailable";
  // BTC itself is not affected by its own dominance
  if (symbol === "BTC" || symbol === "WBTC") return "Neutral";
  if (btcDominance >= 58) return "Headwind";   // capital concentrating in BTC
  if (btcDominance <= 50) return "Tailwind";   // capital flowing to alts
  return "Neutral";
}

/**
 * ATH proximity classification.
 */
function athProximity(distanceFromAth: number | null): "Near ATH" | "Mid-Range" | "Deep Discount" | "Unavailable" {
  if (distanceFromAth == null || !Number.isFinite(distanceFromAth)) return "Unavailable";
  if (distanceFromAth >= -15) return "Near ATH";
  if (distanceFromAth >= -60) return "Mid-Range";
  return "Deep Discount";
}

/**
 * Volatility regime from 24h intraday range.
 */
function volatilityRegime(volatility24h: number | null): "High" | "Normal" | "Low" | "Unavailable" {
  if (volatility24h == null || !Number.isFinite(volatility24h)) return "Unavailable";
  if (volatility24h >= 8) return "High";
  if (volatility24h <= 2) return "Low";
  return "Normal";
}

/**
 * Compute ATR-based price levels for crypto, including multi-tier risk framework.
 */
function computeCryptoPriceLevels(
  price: number,
  high: number | null,
  low: number | null,
  action: TradingAction,
  ohlcBars?: CoinOHLCBar[]
): PriceLevels {
  let atr: number;
  if (ohlcBars && ohlcBars.length >= 14) {
    const ranges = ohlcBars.slice(-14).map(b => b.high - b.low);
    atr = ranges.reduce((s, v) => s + v, 0) / ranges.length;
    atr = Math.max(atr, price * 0.01); // crypto min ATR = 1% of price
  } else if (typeof high === "number" && typeof low === "number") {
    const range = high - low;
    atr = Math.max(range, price * 0.02); // fallback: 2% of price
  } else {
    atr = price * 0.02;
  }

  const supportBase = typeof low === "number" ? low : price;
  const resistanceBase = typeof high === "number" ? high : price;
  const support = parseFloat((supportBase - atr * 0.1).toFixed(8));
  const resistance = parseFloat((resistanceBase + atr * 0.1).toFixed(8));

  let entryZone: number;
  let stopLoss: number;
  let targetPrice: number;

  if (action === "BUY") {
    entryZone = parseFloat(price.toFixed(8));
    stopLoss = parseFloat(Math.max(supportBase - atr * 0.1, entryZone - atr * 1.5).toFixed(8));
    const risk = entryZone - stopLoss;
    targetPrice = parseFloat((entryZone + risk * 2).toFixed(8));
  } else if (action === "SELL") {
    entryZone = parseFloat(price.toFixed(8));
    stopLoss = parseFloat(Math.min(resistanceBase + atr * 0.1, entryZone + atr * 1.5).toFixed(8));
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

  // Build multi-tier risk levels for crypto
  // Crypto uses wider bands due to higher volatility
  const tradeStopPrice = parseFloat(Math.max(supportBase - atr * 0.75, entryZone * 0.85).toFixed(8));
  const tradeStopPct = parseFloat(((tradeStopPrice - entryZone) / entryZone * 100).toFixed(1));
  const swingStopRaw = ohlcBars && ohlcBars.length >= 20
    ? ohlcBars.slice(-20).reduce((s, b) => s + b.close, 0) / 20 - atr * 0.5
    : supportBase - atr * 2;
  const swingStopPrice = parseFloat(Math.max(swingStopRaw, entryZone * 0.72).toFixed(8));
  const swingStopPct = parseFloat(((swingStopPrice - entryZone) / entryZone * 100).toFixed(1));
  const thesisRaw = ohlcBars && ohlcBars.length >= 50
    ? Math.min(...ohlcBars.slice(-50).map(b => b.low)) - atr * 0.25
    : swingStopPrice - atr * 3;
  const thesisPrice = parseFloat(Math.max(thesisRaw, entryZone * 0.45).toFixed(8));
  const thesisPct = parseFloat(((thesisPrice - entryZone) / entryZone * 100).toFixed(1));
  const tradeRisk = Math.abs(entryZone - tradeStopPrice);
  const rrFromTradeStop = tradeRisk > 0 ? parseFloat((Math.abs(targetPrice - entryZone) / tradeRisk).toFixed(1)) : 0;

  const riskLevels: import('./tradingSignals').RiskLevels = {
    tradeStop: { price: tradeStopPrice, pctFromEntry: tradeStopPct, label: "Trade Stop" },
    swingStop: { price: swingStopPrice, pctFromEntry: swingStopPct, label: "Swing Stop" },
    thesisFailure: { price: thesisPrice, pctFromEntry: thesisPct, label: "Thesis Failure" },
    riskReward: rrFromTradeStop,
    tradeStopExplanation: `Trade Stop at ${Math.abs(tradeStopPct).toFixed(1)}% below entry, just under recent intraday support. Protects against normal crypto volatility for active traders.`,
    swingStopExplanation: ohlcBars && ohlcBars.length >= 20
      ? `Swing Stop anchored to the 20-day moving average (${Math.abs(swingStopPct).toFixed(1)}% below entry). A close below signals the short-term trend is broken.`
      : `Swing Stop at ${Math.abs(swingStopPct).toFixed(1)}% below entry allows for trend fluctuations while protecting against a sustained breakdown.`,
    thesisFailureExplanation: ohlcBars && ohlcBars.length >= 50
      ? `Thesis Failure marks the 50-session structural low (${Math.abs(thesisPct).toFixed(1)}% below entry). A breach here means the bullish thesis has fundamentally broken down.`
      : `Thesis Failure at ${Math.abs(thesisPct).toFixed(1)}% below entry is the structural invalidation point — where the original trade thesis is no longer valid.`,
  };

  return { support, resistance, entryZone, stopLoss, targetPrice, riskReward, atr: parseFloat(atr.toFixed(8)), riskLevels };
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
  const { market, ohlcBars, btcDominance = null, regime } = input;

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
    volatility24h: vol24h,
    distanceFromAth: dFromAth,
    priceChangePercent7d: change7d,
    priceChangePercent30d: change30d,
  } = market;
  const levelPrice = typeof price === "number" && Number.isFinite(price) ? price : null;

  // ── Data quality path ─────────────────────────────────────
  const admittedBars = completedCoinDailyBars(ohlcBars ?? []);
  const closes = admittedBars.map(bar => bar.close).filter(close => Number.isFinite(close));
  const hasDailyBars = closes.length >= RSI_MIN_COMPLETED_BARS;
  if (!hasDailyBars) {
    const unavailable: CryptoSignalResult = {
      symbol,
      name,
      coinId,
      assetClass: "CRYPTO",
      action: "WATCH",
      actionLabel: "Unavailable",
      cryptoRegime: regime.score < 3.5 ? "Bullish" : regime.score < 5.5 ? "Neutral" : regime.score < 7.5 ? "Defensive" : "Risk-Off",
      regimeConflict: false,
      regimeConflictExplanation: null,
      confidence: null,
      strength: "Weak",
      timeframe: "Watch",
      rationale: "Insufficient completed historical bars; trading indicators are unavailable.",
      technicals: {
        rsiEstimate: null,
        rsiLabel: "Neutral",
        rsiIsTrue: false,
        trend: "Sideways",
        volumeSignal: "Normal",
        momentumScore: null,
        smaSignal: "Neutral",
        smaIsTrue: false,
        macd: null,
        volatility24h: typeof vol24h === "number" ? parseFloat(vol24h.toFixed(2)) : null,
        distanceFromAth: typeof dFromAth === "number" ? parseFloat(dFromAth.toFixed(2)) : null,
        priceChange7d: change7d !== null ? parseFloat(change7d.toFixed(2)) : null,
        priceChange30d: change30d !== null ? parseFloat(change30d.toFixed(2)) : null,
      },
      priceLevels: computeCryptoPriceLevels(levelPrice ?? Number.NaN, high, low, "WATCH", admittedBars),
      regimeAlignment: "Neutral",
      regimeAlignmentScore: 0,
      cryptoFactors: {
        btcDominanceEffect: btcDominanceEffect(symbol, btcDominance),
        volatilityRegime: volatilityRegime(vol24h),
        athProximity: athProximity(dFromAth),
        liquidityScore: computeLiquidityScore(volume, marketCap),
      },
      computedAt: Date.now(),
    };
    cryptoSignalCache.set(cacheKey, { result: unavailable, computedAt: Date.now() });
    return unavailable;
  }

  // ── RSI ───────────────────────────────────────────────────
  const rsiEstimate = computeWildersRSI(closes, 14);
  if (rsiEstimate == null) {
    return computeCryptoSignal({ ...input, ohlcBars: [] });
  }
  const rsiIsTrue = true;

  const rsiLabel: "Overbought" | "Neutral" | "Oversold" =
    rsiEstimate >= 70 ? "Overbought" : rsiEstimate <= 30 ? "Oversold" : "Neutral";

  // ── SMA crossover ─────────────────────────────────────────
  let smaSignal: "Golden Cross" | "Death Cross" | "Neutral";
  let smaIsTrue: boolean;

  const smaResult = computeSMACrossover(closes);
  smaIsTrue = smaResult.isTrue;
  smaSignal = smaIsTrue ? smaResult.signal : "Neutral";

  // ── MACD ──────────────────────────────────────────────────
  // MACD_MIN_COMPLETED_BARS is 35 (26+9). 39 completed closes are enough; 34 are not.
  const macd: MACDResult | null = closes.length >= MACD_MIN_COMPLETED_BARS ? computeMACD(closes) : null;

  // ── Trend ─────────────────────────────────────────────────
  const trend = deriveTrendFromCloses(closes);

  // ── Volume ────────────────────────────────────────────────
  const volSignal = cryptoVolumeSignal(volume, marketCap);

  // ── Crypto-specific factors ───────────────────────────────
  const btcEffect = btcDominanceEffect(symbol, btcDominance);
  const volRegime = volatilityRegime(vol24h);
  const athProx = athProximity(dFromAth);
  const liquidityScore = computeLiquidityScore(volume, marketCap);

  // ── Momentum score ────────────────────────────────────────
  // Blend a completed-bar RSI with trend, 7d change, and liquidity.
  // A missing RSI never reaches this line: it returns Unavailable above.
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
  if (rsiIsTrue && rsiEstimate <= 28) score += 3.5;
  else if (rsiIsTrue && rsiEstimate <= 40) score += 1.5;
  else if (rsiIsTrue && rsiEstimate >= 75) score -= 3.5;
  else if (rsiIsTrue && rsiEstimate >= 65) score -= 1.5;

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
  const rsiNote = `RSI(14) at ${rsiEstimate.toFixed(0)}`;
  const btcNote = btcEffect !== "Neutral" ? ` BTC dominance ${btcEffect === "Headwind" ? "rising (headwind for alts)" : "falling (tailwind for alts)"}.` : "";

  const rationaleMap: Record<TradingAction, string> = {
    BUY: `${trend === "Uptrend" ? "Uptrend intact" : "Oversold conditions"} — ${rsiNote}, ${smaSignal === "Golden Cross" ? "golden cross" : "positive momentum"}${volSignal === "Surge" ? ", volume surge" : ""}.${macdNote}${btcNote}`,
    SELL: `${trend === "Downtrend" ? "Downtrend confirmed" : "Overbought conditions"} — ${rsiNote}, ${smaSignal === "Death Cross" ? "death cross" : "negative momentum"}${volSignal === "Surge" ? ", elevated volume" : ""}.${macdNote}${btcNote}`,
    HOLD: `Mixed technicals — ${trend} trend, ${rsiNote}; await clearer directional signal.${macdNote}${btcNote}`,
    WATCH: `Insufficient conviction — monitor for breakout above resistance or breakdown below support.${btcNote}`,
  };
  const rationale = rationaleMap[action];

  // ── Price levels ──────────────────────────────────────────
  const priceLevels = computeCryptoPriceLevels(levelPrice ?? Number.NaN, high, low, action, admittedBars);

  // ── Regime alignment ──────────────────────────────────────
  const { alignment: regimeAlignment, score: regimeAlignmentScore } = computeCryptoRegimeAlignment(action, regime);

  // ── Crypto regime label (independent of equity regime) ────────
  const cryptoRegime: CryptoRegimeLabel =
    regime.score < 3.5 ? "Bullish" :
    regime.score < 5.5 ? "Neutral" :
    regime.score < 7.5 ? "Defensive" : "Risk-Off";

  // ── Regime conflict detection ────────────────────────────────
  // A conflict exists when the individual signal is bearish (SELL) but the
  // overall crypto regime is Neutral or Bullish — or vice versa.
  const isSignalBearish = action === "SELL";
  const isSignalBullish = action === "BUY";
  const regimeIsBullish = cryptoRegime === "Bullish";
  const regimeIsNeutralOrBetter = cryptoRegime === "Bullish" || cryptoRegime === "Neutral";
  const regimeIsBearish = cryptoRegime === "Defensive" || cryptoRegime === "Risk-Off";

  let regimeConflict = false;
  let regimeConflictExplanation: string | null = null;

  if (isSignalBearish && regimeIsNeutralOrBetter) {
    regimeConflict = true;
    regimeConflictExplanation =
      `Overall crypto regime is ${cryptoRegime}, but ${symbol} shows asset-specific weakness: ` +
      `${trend === "Downtrend" ? "price in downtrend" : "overbought conditions"}, ` +
      `${rsiIsTrue ? (rsiEstimate > 70 ? `RSI at ${rsiEstimate.toFixed(0)} (overbought)` : `RSI at ${rsiEstimate.toFixed(0)}`) : "completed-bar RSI unavailable"}` +
      `${smaSignal === "Death Cross" ? ", death cross confirmed" : ""}` +
      `. Individual asset signal differs from broader crypto regime — reduce exposure to this asset only.`;
  } else if (isSignalBullish && regimeIsBearish) {
    regimeConflict = true;
    regimeConflictExplanation =
      `Overall crypto regime is ${cryptoRegime}, but ${symbol} shows relative strength: ` +
      `${trend === "Uptrend" ? "price in uptrend" : "oversold bounce potential"}, ` +
      `${rsiIsTrue ? (rsiEstimate < 30 ? `RSI at ${rsiEstimate.toFixed(0)} (oversold)` : `RSI at ${rsiEstimate.toFixed(0)}`) : "completed-bar RSI unavailable"}` +
      `. Proceed with caution — counter-trend signal in a defensive regime.`;
  }

  const result: CryptoSignalResult = {
    symbol,
    name,
    coinId,
    assetClass: "CRYPTO",
    action,
    actionLabel: cryptoActionLabel(action),
    cryptoRegime,
    regimeConflict,
    regimeConflictExplanation,
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
      volatility24h: typeof vol24h === "number" ? parseFloat(vol24h.toFixed(2)) : null,
      distanceFromAth: typeof dFromAth === "number" ? parseFloat(dFromAth.toFixed(2)) : null,
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
