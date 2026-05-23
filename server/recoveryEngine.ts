// FAULTLINE — Recovery Confirmation Engine  (server/recoveryEngine.ts)
//
// Implements a skeptical, confirmation-first recovery classification system.
// FAULTLINE does not flip bullish on a single green day or short-term bounce.
//
// Recovery Status Hierarchy (5 levels):
//   "Breakdown Continuing"    — Selling pressure still dominant
//   "Relief Bounce"           — Short bounce, likely aftershock / failed rally
//   "Recovery Attempt"        — Early signs, not yet confirmed
//   "Stabilizing"             — Multiple conditions improving, not fully confirmed
//   "Confirmed Recovery"      — All confirmation rules met
//
// Recovery Confidence Score (0–100):
//   0–25:  Weak bounce / high failure risk
//   26–50: Recovery attempt
//   51–75: Improving but not fully confirmed
//   76–100: Confirmed recovery
//
// Aftershock Risk (4 levels):
//   "Low"      — Stable conditions, low re-selloff probability
//   "Moderate" — Some residual risk factors present
//   "Elevated" — Multiple risk factors active
//   "High"     — Sharp selloff + weak bounce + poor confirmation
//
// Asymmetric decay principle:
//   Risk score rises quickly when breakdown conditions appear.
//   Risk score falls slowly — only after confirmation rules are met.
//   A single green day does NOT reduce risk meaningfully.
// ============================================================
import { LRUCache } from "./lruCache";
import type { CoinMarketData, CoinOHLCBar } from "./coingeckoProxy";
import type { FaultlinePressureOutput } from "./pressure/engine";

// ── Types ─────────────────────────────────────────────────────
export type RecoveryStatus =
  | "Breakdown Continuing"
  | "Relief Bounce"
  | "Recovery Attempt"
  | "Stabilizing"
  | "Confirmed Recovery";

export type AftershockRisk = "Low" | "Moderate" | "Elevated" | "High";

export interface ConfirmationRule {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  weight: number;      // contribution to confidence score
  detail: string;      // specific reason why it passed or failed
}

export interface RecoveryAnalysis {
  symbol: string;
  name: string;
  isCrypto: boolean;
  isBitcoin: boolean;

  // Core outputs
  status: RecoveryStatus;
  statusColor: "red" | "orange" | "yellow" | "blue" | "green";
  recoveryConfidence: number;        // 0–100
  confidenceTier: "Weak Bounce" | "Recovery Attempt" | "Improving" | "Confirmed";
  aftershockRisk: AftershockRisk;
  aftershockRiskScore: number;       // 0–100 (higher = more risk)

  // Confirmation checklist
  confirmationRules: ConfirmationRule[];
  confirmationsPassed: number;
  confirmationsRequired: number;

  // Dashboard fields
  trendBias: "Bearish" | "Neutral" | "Cautiously Bullish" | "Bullish";
  marketRegime: string;
  keyReasoning: string;              // 1–2 sentence narrative
  btcSpecificLanguage: string | null; // only for BTC

  // Metadata
  consecutiveGreenCloses: number;
  requiredConsecutiveCloses: number; // 3 for stocks, 5 for crypto
  computedAt: number;
}

export interface RecoveryInput {
  symbol: string;
  name: string;
  market: CoinMarketData;
  ohlcBars?: CoinOHLCBar[];
  btcDominance?: number;
  pressure?: FaultlinePressureOutput | null;
  isCrypto?: boolean;
}

// ── Cache ─────────────────────────────────────────────────────
interface RecoveryCacheEntry {
  result: RecoveryAnalysis;
  computedAt: number;
}
const RECOVERY_CACHE_TTL_MS = 90 * 1000; // 90 seconds
const recoveryCache = new LRUCache<string, RecoveryCacheEntry>(200, RECOVERY_CACHE_TTL_MS);

// ── Helpers ───────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Count consecutive closes above a threshold from the end of the series.
 */
function countConsecutiveClosesAbove(closes: number[], threshold: number): number {
  let count = 0;
  for (let i = closes.length - 1; i >= 0; i--) {
    if (closes[i] > threshold) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Compute a simple moving average over the last N values.
 */
function sma(values: number[], n: number): number | null {
  if (values.length < n) return null;
  const slice = values.slice(-n);
  return slice.reduce((s, v) => s + v, 0) / n;
}

/**
 * Estimate recent volatility as the coefficient of variation over last 7 closes.
 */
function estimateVolatility(closes: number[]): number {
  if (closes.length < 3) return 50;
  const recent = closes.slice(-7);
  const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
  if (mean === 0) return 50;
  const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length;
  return Math.sqrt(variance) / mean * 100; // CV as %
}

/**
 * Detect if the asset recently had a sharp selloff (within last 7 bars).
 */
function detectRecentSelloff(closes: number[], threshold = -8): boolean {
  if (closes.length < 3) return false;
  // Check if any 2-bar window had a drop >= threshold %
  for (let i = Math.max(0, closes.length - 7); i < closes.length - 1; i++) {
    const change = ((closes[i + 1] - closes[i]) / closes[i]) * 100;
    if (change <= threshold) return true;
  }
  return false;
}

/**
 * Estimate if price has reclaimed a key breakdown level.
 * Uses the 20-bar low as a proxy for the breakdown level.
 */
function hasReclaimedBreakdownLevel(closes: number[]): { reclaimed: boolean; breakdownLevel: number } {
  if (closes.length < 5) return { reclaimed: false, breakdownLevel: 0 };
  const lookback = closes.slice(-20);
  const breakdownLevel = Math.min(...lookback.slice(0, -3)); // lowest point excluding last 3
  const currentPrice = closes[closes.length - 1];
  const reclaimed = currentPrice > breakdownLevel * 1.02; // must be 2% above breakdown
  return { reclaimed, breakdownLevel };
}

// ── Core computation ──────────────────────────────────────────
export function computeRecoveryAnalysis(input: RecoveryInput): RecoveryAnalysis {
  const { symbol, name, market, ohlcBars, btcDominance, pressure, isCrypto = true } = input;
  const isBitcoin = symbol.toUpperCase() === "BTC";

  // ── Extract price series ──────────────────────────────────
  const closes: number[] = ohlcBars && ohlcBars.length >= 5
    ? ohlcBars.map(b => b.close)
    : market.sparkline7d.length >= 10
      ? market.sparkline7d
      : [];

  const currentPrice = market.currentPrice;
  const change24h = market.priceChangePercent24h;
  const change7d = market.priceChangePercent7d ?? change24h * 3;
  const change30d = market.priceChangePercent30d ?? change24h * 10;
  const volatility24h = market.volatility24h;
  const distanceFromAth = market.distanceFromAth; // negative = below ATH

  // ── Macro pressure context ────────────────────────────────
  const macroPressure = pressure?.overallPressure ?? 50;
  const macroLevel = pressure?.level ?? "Moderate";
  const macroWorsening = pressure?.vectors?.some(v => v.trend === "rising" && v.score > 60) ?? false;

  // ── Required consecutive closes (stricter for crypto) ─────
  const requiredConsecutiveCloses = isCrypto ? 5 : 3;

  // ── Count consecutive green closes ───────────────────────
  let consecutiveGreenCloses = 0;
  if (closes.length >= 2) {
    consecutiveGreenCloses = countConsecutiveClosesAbove(
      closes,
      closes[Math.max(0, closes.length - requiredConsecutiveCloses - 1)]
    );
  } else {
    // Fallback: use 24h change as a single-bar proxy
    consecutiveGreenCloses = change24h > 0 ? 1 : 0;
  }

  // ── Breakdown level reclamation ───────────────────────────
  const { reclaimed: reclaimedBreakdown, breakdownLevel } = hasReclaimedBreakdownLevel(closes);

  // ── Moving average context ────────────────────────────────
  const sma10 = sma(closes, 10);
  const sma20 = sma(closes, 20);
  const aboveSma10 = sma10 !== null && currentPrice > sma10;
  const aboveSma20 = sma20 !== null && currentPrice > sma20;
  const aboveAnyMa = aboveSma10 || aboveSma20;

  // ── Volume confirmation ───────────────────────────────────
  const volumeToMcap = market.marketCap > 0
    ? (market.totalVolume / market.marketCap) * 100
    : 0;
  const volumeConfirmed = volumeToMcap > 1.5; // >1.5% volume/mcap ratio = meaningful volume

  // ── Volatility cooling ────────────────────────────────────
  const volatilityCV = estimateVolatility(closes);
  const volatilityCooling = volatility24h < 4.0 && volatilityCV < 5.0;

  // ── 7d and 14d trend improvement ─────────────────────────
  const trendImproving7d = change7d > -5; // not still in freefall
  const trendImproving14d = change30d > -15; // 30d used as proxy for 14d

  // ── BTC dominance (altcoin breadth proxy) ─────────────────
  const btcDom = btcDominance ?? 55;
  const altcoinsBreadthOk = isBitcoin
    ? true // BTC doesn't need altcoin confirmation
    : btcDom < 58; // altcoins confirm when BTC dom is not surging

  // ── Recent selloff detection ──────────────────────────────
  const hadRecentSelloff = closes.length >= 3
    ? detectRecentSelloff(closes)
    : change7d < -10 || change30d < -20;

  // ── Macro pressure not worsening ─────────────────────────
  const macroNotWorsening = !macroWorsening && macroPressure < 70;

  // ── Build confirmation rules ──────────────────────────────
  const confirmationRules: ConfirmationRule[] = [
    {
      id: "consecutive_closes",
      label: `${requiredConsecutiveCloses} Consecutive Green Closes`,
      description: `Price must close higher for ${requiredConsecutiveCloses} consecutive sessions`,
      passed: consecutiveGreenCloses >= requiredConsecutiveCloses,
      weight: 20,
      detail: consecutiveGreenCloses >= requiredConsecutiveCloses
        ? `${consecutiveGreenCloses} consecutive green closes confirmed`
        : `Only ${consecutiveGreenCloses}/${requiredConsecutiveCloses} consecutive green closes — insufficient`,
    },
    {
      id: "breakdown_reclaim",
      label: "Key Breakdown Level Reclaimed",
      description: "Price must reclaim and hold above the key breakdown level",
      passed: reclaimedBreakdown,
      weight: 18,
      detail: reclaimedBreakdown
        ? `Price has reclaimed breakdown level (~$${breakdownLevel.toFixed(2)})`
        : breakdownLevel > 0
          ? `Price still below breakdown level (~$${breakdownLevel.toFixed(2)})`
          : "Insufficient data to determine breakdown level",
    },
    {
      id: "trend_7d",
      label: "7-Day Trend Improving",
      description: "7-day price change must not be in freefall (> -5%)",
      passed: trendImproving7d,
      weight: 12,
      detail: trendImproving7d
        ? `7d change: ${change7d.toFixed(1)}% — trend stabilizing`
        : `7d change: ${change7d.toFixed(1)}% — still in downtrend`,
    },
    {
      id: "trend_14d",
      label: "14-Day Trend Not Deteriorating",
      description: "Medium-term trend must show signs of stabilization",
      passed: trendImproving14d,
      weight: 10,
      detail: trendImproving14d
        ? `30d change: ${change30d.toFixed(1)}% — medium-term stabilizing`
        : `30d change: ${change30d.toFixed(1)}% — medium-term still weak`,
    },
    {
      id: "volume_confirmation",
      label: "Volume Supports the Move",
      description: "Volume must be meaningful relative to market cap",
      passed: volumeConfirmed,
      weight: 12,
      detail: volumeConfirmed
        ? `Volume/MCap ratio: ${volumeToMcap.toFixed(2)}% — volume confirming`
        : `Volume/MCap ratio: ${volumeToMcap.toFixed(2)}% — volume too thin`,
    },
    {
      id: "volatility_cooling",
      label: "Volatility Cooling",
      description: "Intraday volatility must begin decreasing",
      passed: volatilityCooling,
      weight: 10,
      detail: volatilityCooling
        ? `24h volatility: ${volatility24h.toFixed(1)}% — cooling`
        : `24h volatility: ${volatility24h.toFixed(1)}% — still elevated`,
    },
    {
      id: "above_ma",
      label: "Price Above Key Moving Averages",
      description: "Price must be above at least one key moving average",
      passed: aboveAnyMa,
      weight: 10,
      detail: aboveAnyMa
        ? `Price above ${aboveSma10 ? "10-period" : "20-period"} MA`
        : "Price still below key moving averages",
    },
    {
      id: "macro_not_worsening",
      label: "Macro Pressure Not Worsening",
      description: "FAULTLINE Pressure Index must not be escalating",
      passed: macroNotWorsening,
      weight: 8,
      detail: macroNotWorsening
        ? `Macro pressure: ${macroLevel} (${macroPressure.toFixed(0)}/100) — not escalating`
        : `Macro pressure: ${macroLevel} (${macroPressure.toFixed(0)}/100) — still worsening`,
    },
    ...(isCrypto ? [{
      id: "altcoin_breadth",
      label: "Crypto Breadth Confirming",
      description: "Altcoins must participate in the recovery (BTC dominance not surging)",
      passed: altcoinsBreadthOk,
      weight: 8,
      detail: altcoinsBreadthOk
        ? `BTC dominance: ${btcDom.toFixed(1)}% — altcoins participating`
        : `BTC dominance: ${btcDom.toFixed(1)}% — altcoins not confirming`,
    }] : []),
  ];

  const totalWeight = confirmationRules.reduce((s, r) => s + r.weight, 0);
  const passedWeight = confirmationRules.filter(r => r.passed).reduce((s, r) => s + r.weight, 0);
  const confirmationsPassed = confirmationRules.filter(r => r.passed).length;
  const confirmationsRequired = confirmationRules.length;

  // ── Recovery Confidence Score (0–100) ─────────────────────
  // Base score from confirmation rules
  let rawConfidence = totalWeight > 0 ? (passedWeight / totalWeight) * 100 : 0;

  // Asymmetric decay: penalize heavily if recent selloff with weak bounce
  if (hadRecentSelloff) {
    const bounceMagnitude = Math.max(0, change24h); // positive = bounced
    const bounceQuality = clamp(bounceMagnitude / 5, 0, 1); // normalize: 5%+ bounce = full quality
    rawConfidence = rawConfidence * (0.4 + 0.6 * bounceQuality);
  }

  // Penalize if macro is worsening
  if (macroWorsening) {
    rawConfidence *= 0.75;
  }

  // Penalize if still well below ATH (deep discount = more downside risk)
  if (distanceFromAth < -40) {
    rawConfidence *= 0.85;
  }

  const recoveryConfidence = clamp(Math.round(rawConfidence), 0, 100);

  // ── Confidence Tier ───────────────────────────────────────
  let confidenceTier: RecoveryAnalysis["confidenceTier"];
  if (recoveryConfidence <= 25) confidenceTier = "Weak Bounce";
  else if (recoveryConfidence <= 50) confidenceTier = "Recovery Attempt";
  else if (recoveryConfidence <= 75) confidenceTier = "Improving";
  else confidenceTier = "Confirmed";

  // ── Aftershock Risk Score (0–100) ─────────────────────────
  // Rises quickly on breakdown signals, falls slowly
  let aftershockRiskScore = 0;

  // Base: recent selloff is the primary driver
  if (hadRecentSelloff) aftershockRiskScore += 35;

  // Weak bounce (small recovery after large drop)
  if (hadRecentSelloff && change24h < 3) aftershockRiskScore += 20;

  // Failed to reclaim breakdown levels
  if (!reclaimedBreakdown) aftershockRiskScore += 15;

  // Volatility still high
  if (volatility24h > 5) aftershockRiskScore += 10;
  else if (volatility24h > 3) aftershockRiskScore += 5;

  // Macro pressure elevated
  if (macroPressure > 70) aftershockRiskScore += 10;
  else if (macroPressure > 50) aftershockRiskScore += 5;

  // Risk assets weak (price still below MAs)
  if (!aboveAnyMa) aftershockRiskScore += 8;

  // Crypto breadth poor
  if (isCrypto && !altcoinsBreadthOk) aftershockRiskScore += 7;

  // Asymmetric: reduce risk only if multiple confirmations passed
  if (confirmationsPassed >= Math.ceil(confirmationsRequired * 0.75)) {
    aftershockRiskScore = Math.max(0, aftershockRiskScore - 20);
  } else if (confirmationsPassed >= Math.ceil(confirmationsRequired * 0.5)) {
    aftershockRiskScore = Math.max(0, aftershockRiskScore - 10);
  }

  aftershockRiskScore = clamp(aftershockRiskScore, 0, 100);

  // ── Aftershock Risk Label ─────────────────────────────────
  let aftershockRisk: AftershockRisk;
  if (aftershockRiskScore <= 20) aftershockRisk = "Low";
  else if (aftershockRiskScore <= 45) aftershockRisk = "Moderate";
  else if (aftershockRiskScore <= 70) aftershockRisk = "Elevated";
  else aftershockRisk = "High";

  // ── Recovery Status ───────────────────────────────────────
  let status: RecoveryStatus;
  if (recoveryConfidence >= 76) {
    status = "Confirmed Recovery";
  } else if (recoveryConfidence >= 51) {
    status = "Stabilizing";
  } else if (recoveryConfidence >= 26) {
    status = "Recovery Attempt";
  } else if (change24h > 1 && hadRecentSelloff) {
    // Small bounce after selloff = relief bounce
    status = "Relief Bounce";
  } else {
    status = "Breakdown Continuing";
  }

  // ── Status Color ──────────────────────────────────────────
  const statusColorMap: Record<RecoveryStatus, RecoveryAnalysis["statusColor"]> = {
    "Breakdown Continuing": "red",
    "Relief Bounce": "orange",
    "Recovery Attempt": "yellow",
    "Stabilizing": "blue",
    "Confirmed Recovery": "green",
  };
  const statusColor = statusColorMap[status];

  // ── Trend Bias ────────────────────────────────────────────
  let trendBias: RecoveryAnalysis["trendBias"];
  if (recoveryConfidence >= 76) trendBias = "Bullish";
  else if (recoveryConfidence >= 51) trendBias = "Cautiously Bullish";
  else if (recoveryConfidence >= 26) trendBias = "Neutral";
  else trendBias = "Bearish";

  // ── Market Regime ─────────────────────────────────────────
  const marketRegime = pressure?.regime ?? (macroPressure > 65 ? "ELEVATED RISK" : "MODERATE RISK");

  // ── Key Reasoning ─────────────────────────────────────────
  let keyReasoning: string;
  if (status === "Confirmed Recovery") {
    keyReasoning = `${name} has met the required confirmation criteria. Price has reclaimed key levels, volume is supportive, and macro conditions are not deteriorating.`;
  } else if (status === "Stabilizing") {
    keyReasoning = `${name} is showing improving conditions but has not yet met all confirmation requirements. Monitoring for continued follow-through before upgrading to Confirmed Recovery.`;
  } else if (status === "Recovery Attempt") {
    keyReasoning = `${name} is attempting a recovery, but confirmation remains incomplete. ${confirmationsPassed} of ${confirmationsRequired} confirmation rules have been met. Caution is warranted.`;
  } else if (status === "Relief Bounce") {
    keyReasoning = `${name} is experiencing a short-term bounce following a recent selloff. This may be a relief rally or aftershock rather than a genuine recovery. Key levels have not been reclaimed.`;
  } else {
    keyReasoning = `${name} remains in a downtrend. Selling pressure has not abated and confirmation criteria have not been met. Aftershock risk is ${aftershockRisk.toLowerCase()}.`;
  }

  // ── BTC-specific language ─────────────────────────────────
  let btcSpecificLanguage: string | null = null;
  if (isBitcoin) {
    if (status === "Relief Bounce" || (status === "Recovery Attempt" && recoveryConfidence < 40)) {
      btcSpecificLanguage = `Bitcoin is attempting a short-term recovery, but confirmation remains weak. Aftershock risk remains ${aftershockRisk.toLowerCase()} until BTC reclaims and holds key breakdown levels with sustained volume and volatility cooling.`;
    } else if (status === "Recovery Attempt") {
      btcSpecificLanguage = `Bitcoin has begun a recovery attempt. ${confirmationsPassed} of ${confirmationsRequired} confirmation rules are met. The recovery requires ${requiredConsecutiveCloses} consecutive green closes to reduce aftershock risk meaningfully.`;
    } else if (status === "Stabilizing") {
      btcSpecificLanguage = `Bitcoin is stabilizing. Most confirmation criteria are met, but the recovery has not yet been fully confirmed. Watch for continued volume support and volatility reduction.`;
    } else if (status === "Confirmed Recovery") {
      btcSpecificLanguage = `Bitcoin has confirmed a recovery across price, trend, volume, volatility, and macro conditions. Aftershock risk has decreased to ${aftershockRisk.toLowerCase()}.`;
    } else {
      btcSpecificLanguage = `Bitcoin remains under pressure. The current bounce has not met the required ${requiredConsecutiveCloses}-close confirmation threshold. Aftershock risk is ${aftershockRisk.toLowerCase()}.`;
    }
  }

  return {
    symbol: symbol.toUpperCase(),
    name,
    isCrypto,
    isBitcoin,
    status,
    statusColor,
    recoveryConfidence,
    confidenceTier,
    aftershockRisk,
    aftershockRiskScore,
    confirmationRules,
    confirmationsPassed,
    confirmationsRequired,
    trendBias,
    marketRegime,
    keyReasoning,
    btcSpecificLanguage,
    consecutiveGreenCloses,
    requiredConsecutiveCloses,
    computedAt: Date.now(),
  };
}

// ── Cached wrapper ────────────────────────────────────────────
export function getRecoveryAnalysis(input: RecoveryInput): RecoveryAnalysis {
  const cacheKey = `${input.symbol.toUpperCase()}_recovery`;
  const cached = recoveryCache.get(cacheKey);
  if (cached) return cached.result;

  const result = computeRecoveryAnalysis(input);
  recoveryCache.set(cacheKey, { result, computedAt: Date.now() });
  return result;
}

export function clearRecoveryCache(): void {
  recoveryCache.clear();
}
