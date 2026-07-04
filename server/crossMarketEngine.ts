/**
 * Cross-Market Intelligence Engine
 * Detects alignment and divergence between the Stock Market Regime and
 * the Crypto Market Regime, explains what it means in plain English,
 * and emits regime-change alerts when either market transitions.
 */
import { computeStockMarketRegime, StockMarketRegime, StockRegimeLabel } from "./stockRegimeEngine";
import { computeCryptoMarketRegime, CryptoMarketRegime, CryptoRegimeLabel } from "./cryptoRegimeEngine";
import { LRUCache } from "./lruCache";

// ── Types ─────────────────────────────────────────────────────
export type AlignmentStatus =
  | "Strongly Aligned — Risk On"
  | "Aligned — Risk On"
  | "Aligned — Risk Off"
  | "Strongly Aligned — Risk Off"
  | "Diverging — Stocks Leading"
  | "Diverging — Crypto Leading"
  | "Diverging — Conflicting Signals"
  | "Neutral";

export interface RegimeChangeAlert {
  asset:     "Stock" | "Crypto";
  previous:  string;
  current:   string;
  message:   string;
  timestamp: number;
}

export interface CrossMarketIntelligence {
  stockRegime:          StockMarketRegime;
  cryptoRegime:         CryptoMarketRegime;
  alignmentStatus:      AlignmentStatus;
  alignmentScore:       number;
  plainEnglishSummary:  string;
  keyInsights:          string[];
  forwardBias:          string;
  regimeChangeAlerts:   RegimeChangeAlert[];
  fetchedAt:            number;
  cached:               boolean;
}

// ── Cache ─────────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new LRUCache<string, { result: CrossMarketIntelligence; fetchedAt: number }>(4, CACHE_TTL_MS);

let prevStockRegime: string | null = null;
let prevCryptoRegime: string | null = null;

/** Clears the result cache but preserves prev regime values for change detection. */
export function clearCrossMarketCache(): void {
  cache.clear();
}
/** Resets prev regime tracking — use in tests for full isolation. */
export function resetCrossMarketPrevRegimes(): void {
  prevStockRegime = null;
  prevCryptoRegime = null;
}

// ── Helpers ───────────────────────────────────────────────────
type RegimeSentiment = "bullish" | "neutral" | "bearish" | "extreme-bear";

function stockSentiment(regime: StockRegimeLabel): RegimeSentiment {
  if (["Bull Market", "Expansion"].includes(regime)) return "bullish";
  if (["Recovery", "Consolidation"].includes(regime)) return "neutral";
  if (["Correction", "Distribution"].includes(regime)) return "bearish";
  return "extreme-bear";
}

function cryptoSentiment(regime: CryptoRegimeLabel): RegimeSentiment {
  if (["Bull Market", "Expansion", "Early Recovery"].includes(regime)) return "bullish";
  if (["Accumulation", "Bear Market \u2192 Accumulation Phase"].includes(regime)) return "neutral";
  if (["Distribution", "Late Bull / Euphoria"].includes(regime)) return "bearish";
  return "extreme-bear";
}

function computeAlignmentStatus(
  ss: RegimeSentiment,
  cs: RegimeSentiment,
): { status: AlignmentStatus; score: number } {
  if (ss === "bullish" && cs === "bullish")       return { status: "Strongly Aligned \u2014 Risk On",       score: 90 };
  if (ss === "bullish" && cs === "neutral")        return { status: "Aligned \u2014 Risk On",               score: 70 };
  if (ss === "neutral" && cs === "bullish")        return { status: "Diverging \u2014 Crypto Leading",      score: 55 };
  if (ss === "neutral" && cs === "neutral")        return { status: "Neutral",                              score: 50 };
  if (ss === "neutral" && cs === "bearish")        return { status: "Diverging \u2014 Conflicting Signals", score: 40 };
  if (ss === "bearish" && cs === "neutral")        return { status: "Diverging \u2014 Stocks Leading",      score: 40 };
  if (ss === "bearish" && cs === "bullish")        return { status: "Diverging \u2014 Conflicting Signals", score: 35 };
  if (ss === "bullish" && cs === "bearish")        return { status: "Diverging \u2014 Conflicting Signals", score: 35 };
  if (ss === "bearish" && cs === "bearish")        return { status: "Aligned \u2014 Risk Off",              score: 25 };
  if (ss === "extreme-bear" && cs === "extreme-bear") return { status: "Strongly Aligned \u2014 Risk Off", score: 10 };
  if (ss === "extreme-bear")                       return { status: "Aligned \u2014 Risk Off",              score: 20 };
  if (cs === "extreme-bear")                       return { status: "Diverging \u2014 Conflicting Signals", score: 30 };
  return { status: "Neutral", score: 50 };
}

function buildPlainEnglishSummary(
  stockRegime: StockRegimeLabel,
  cryptoRegime: CryptoRegimeLabel,
  status: AlignmentStatus,
): string {
  const isRiskOn  = status.includes("Risk On");
  const isRiskOff = status.includes("Risk Off");
  const isDiverge = status.includes("Diverging");

  if (isRiskOn && status.includes("Strongly")) {
    return `Both the stock market (${stockRegime}) and crypto market (${cryptoRegime}) are in risk-on regimes. This is a broadly constructive environment for risk assets. Macro conditions, price trends, and liquidity are all aligned in favour of continued upside.`;
  }
  if (isRiskOn) {
    return `The stock market is in a ${stockRegime} regime while crypto is showing ${cryptoRegime} conditions. Both markets are broadly risk-on, though with different levels of conviction. The overall environment favours risk assets, but position sizing should reflect the divergence in confidence.`;
  }
  if (isRiskOff && status.includes("Strongly")) {
    return `Both the stock market (${stockRegime}) and crypto market (${cryptoRegime}) are in risk-off regimes. This is a broadly defensive environment. Capital preservation should be the primary objective across both asset classes.`;
  }
  if (isRiskOff) {
    return `The stock market (${stockRegime}) and crypto market (${cryptoRegime}) are both leaning risk-off. Defensive positioning is warranted. Reduce exposure to high-beta assets and favour cash, bonds, and stablecoins.`;
  }
  if (isDiverge && status.includes("Stocks Leading")) {
    return `The stock market is in a ${stockRegime} regime while crypto is showing ${cryptoRegime} conditions. Stocks are leading the risk-off move. Historically, crypto tends to follow equities lower with a lag.`;
  }
  if (isDiverge && status.includes("Crypto Leading")) {
    return `Crypto (${cryptoRegime}) is outperforming equities (${stockRegime}). This divergence can signal either a crypto-specific catalyst or an early risk-on rotation. Monitor equity market breadth for confirmation.`;
  }
  if (isDiverge) {
    return `The stock market (${stockRegime}) and crypto market (${cryptoRegime}) are sending conflicting signals. Reduce size, wait for alignment, and favour assets with clear trend confirmation.`;
  }
  return `The stock market is in a ${stockRegime} regime and crypto is in a ${cryptoRegime} phase. Conditions are broadly neutral. Monitor for a directional break in either market before adjusting positioning.`;
}

function buildKeyInsights(
  stock: StockMarketRegime,
  crypto: CryptoMarketRegime,
  status: AlignmentStatus,
): string[] {
  const insights: string[] = [];
  const ss = stockSentiment(stock.regime);
  const cs = cryptoSentiment(crypto.regime);

  if (status.includes("Strongly Aligned \u2014 Risk On")) {
    insights.push("Both markets are in risk-on alignment \u2014 historically the strongest environment for portfolio returns.");
  } else if (status.includes("Strongly Aligned \u2014 Risk Off")) {
    insights.push("Both markets are in risk-off alignment \u2014 a rare and serious signal. Prioritise capital preservation.");
  } else if (status.includes("Diverging")) {
    insights.push(`Cross-market divergence detected: stocks are ${ss} while crypto is ${cs}. Divergences typically resolve within 2\u20134 weeks.`);
  }

  if (stock.pressureScore >= 70) {
    insights.push(`FAULTLINE Pressure Index is at ${Math.round(stock.pressureScore)}/100 \u2014 elevated stress. Reduce risk exposure.`);
  } else if (stock.pressureScore <= 30) {
    insights.push(`FAULTLINE Pressure Index is at ${Math.round(stock.pressureScore)}/100 \u2014 benign conditions. The macro backdrop supports risk-taking.`);
  }

  if (crypto.regime === "Bear Market \u2192 Accumulation Phase") {
    insights.push("Bitcoin is in an accumulation phase inside a bear structure. A new bull cycle requires: price breakout above major resistance, strong volume, improving liquidity, and sustained risk-on macro confirmation.");
  }

  if (stock.regime === "Recession Risk") {
    insights.push("Recession risk is elevated in the stock market. Historically, this regime precedes significant equity drawdowns.");
  }
  if (crypto.regime === "Capitulation") {
    insights.push("Crypto is in capitulation. Wait for stabilisation and volume confirmation before re-entering.");
  }
  if (stock.regime === "Recovery" && cs === "bullish") {
    insights.push("Stocks are recovering while crypto is already risk-on \u2014 a positive leading indicator for equities.");
  }

  if (ss === "bullish" && cs === "bullish") {
    insights.push("Forward bias: Overweight risk assets. Favour growth equities and quality crypto. Use momentum as your guide.");
  } else if (ss === "extreme-bear" || cs === "extreme-bear") {
    insights.push("Forward bias: Defensive. Raise cash, reduce equity beta, and favour stablecoins over crypto alts.");
  }

  return insights.slice(0, 5);
}

function buildForwardBias(ss: RegimeSentiment, cs: RegimeSentiment): string {
  if (ss === "bullish" && cs === "bullish") return "Risk-on. Overweight equities and quality crypto. Momentum-driven positioning.";
  if (ss === "bullish" && cs === "neutral") return "Moderately risk-on. Favour equities over crypto. Wait for crypto confirmation.";
  if (ss === "neutral" && cs === "bullish") return "Selective risk-on. Crypto outperforming \u2014 watch for equity confirmation before adding broad risk.";
  if (ss === "neutral" && cs === "neutral") return "Neutral. Hold core positions. Avoid chasing breakouts. Wait for directional confirmation.";
  if (ss === "bearish" || cs === "bearish") return "Defensive. Reduce high-beta exposure. Favour cash, bonds, and stablecoins.";
  return "Defensive. Capital preservation is the priority. Minimal equity and crypto exposure.";
}

// ── Public API ────────────────────────────────────────────────
export async function computeCrossMarketIntelligence(): Promise<CrossMarketIntelligence> {
  const cacheKey = "cross-market";
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return { ...hit.result, cached: true };
  }

  const [stock, crypto] = await Promise.all([
    computeStockMarketRegime(),
    computeCryptoMarketRegime(),
  ]);

  const ss = stockSentiment(stock.regime);
  const cs = cryptoSentiment(crypto.regime);
  const { status, score } = computeAlignmentStatus(ss, cs);

  const regimeChangeAlerts: RegimeChangeAlert[] = [];
  if (prevStockRegime !== null && prevStockRegime !== stock.regime) {
    regimeChangeAlerts.push({
      asset:     "Stock",
      previous:  prevStockRegime,
      current:   stock.regime,
      message:   `US equity market regime changed from ${prevStockRegime} to ${stock.regime}. Review your equity positioning.`,
      timestamp: Date.now(),
    });
  }
  if (prevCryptoRegime !== null && prevCryptoRegime !== crypto.regime) {
    regimeChangeAlerts.push({
      asset:     "Crypto",
      previous:  prevCryptoRegime,
      current:   crypto.regime,
      message:   `Crypto market regime changed from ${prevCryptoRegime} to ${crypto.regime}. Review your crypto positioning.`,
      timestamp: Date.now(),
    });
  }
  prevStockRegime  = stock.regime;
  prevCryptoRegime = crypto.regime;

  const result: CrossMarketIntelligence = {
    stockRegime:         stock,
    cryptoRegime:        crypto,
    alignmentStatus:     status,
    alignmentScore:      score,
    plainEnglishSummary: buildPlainEnglishSummary(stock.regime, crypto.regime, status),
    keyInsights:         buildKeyInsights(stock, crypto, status),
    forwardBias:         buildForwardBias(ss, cs),
    regimeChangeAlerts,
    fetchedAt:           Date.now(),
    cached:              false,
  };

  cache.set(cacheKey, { result, fetchedAt: Date.now() });
  return result;
}
