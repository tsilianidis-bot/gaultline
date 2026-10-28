/**
 * Cross-Market Intelligence Engine
 * Detects alignment and divergence between the Stock Market Regime and
 * the Crypto Market Regime, explains what it means in plain English,
 * and emits regime-change alerts when either market transitions.
 */
import { computeStockMarketRegime, StockMarketRegime, StockRegimeLabel } from "./stockRegimeEngine";
import { computeCryptoMarketRegime, CryptoMarketRegime, CryptoRegimeLabel } from "./cryptoRegimeEngine";
import { LRUCache } from "./lruCache";
import { getDb } from "./db";
import { regimeAlerts } from "../drizzle/schema";

// ── Types ─────────────────────────────────────────────────────
export type AlignmentStatus =
  | "Strongly Aligned — Higher appetite"
  | "Aligned — Higher appetite"
  | "Aligned — Lower appetite"
  | "Strongly Aligned — Lower appetite"
  | "Diverging — Stocks Leading"
  | "Diverging — Crypto Leading"
  | "Diverging — Conflicting Signals"
  | "Neutral";

export interface RegimeChangeAlert {
  asset:           "Stock" | "Crypto";
  previous:        string;
  current:         string;
  message:         string;
  /** Why this regime change matters for investors */
  whyItMatters:    string;
  /** Key signals/events to monitor following this change */
  whatToWatchNext: string;
  timestamp:       number;
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
  if (ss === "bullish" && cs === "bullish")       return { status: "Strongly Aligned \u2014 Higher appetite",       score: 90 };
  if (ss === "bullish" && cs === "neutral")        return { status: "Aligned \u2014 Higher appetite",               score: 70 };
  if (ss === "neutral" && cs === "bullish")        return { status: "Diverging \u2014 Crypto Leading",      score: 55 };
  if (ss === "neutral" && cs === "neutral")        return { status: "Neutral",                              score: 50 };
  if (ss === "neutral" && cs === "bearish")        return { status: "Diverging \u2014 Conflicting Signals", score: 40 };
  if (ss === "bearish" && cs === "neutral")        return { status: "Diverging \u2014 Stocks Leading",      score: 40 };
  if (ss === "bearish" && cs === "bullish")        return { status: "Diverging \u2014 Conflicting Signals", score: 35 };
  if (ss === "bullish" && cs === "bearish")        return { status: "Diverging \u2014 Conflicting Signals", score: 35 };
  if (ss === "bearish" && cs === "bearish")        return { status: "Aligned \u2014 Lower appetite",              score: 25 };
  if (ss === "extreme-bear" && cs === "extreme-bear") return { status: "Strongly Aligned \u2014 Lower appetite", score: 10 };
  if (ss === "extreme-bear")                       return { status: "Aligned \u2014 Lower appetite",              score: 20 };
  if (cs === "extreme-bear")                       return { status: "Diverging \u2014 Conflicting Signals", score: 30 };
  return { status: "Neutral", score: 50 };
}

function buildPlainEnglishSummary(
  stockRegime: StockRegimeLabel,
  cryptoRegime: CryptoRegimeLabel,
  status: AlignmentStatus,
): string {
  const isRiskOn  = status.includes("Higher appetite");
  const isRiskOff = status.includes("Lower appetite");
  const isDiverge = status.includes("Diverging");

  if (isRiskOn && status.includes("Strongly")) {
    return `Stock regime label is ${stockRegime}. Crypto regime label is ${cryptoRegime}. Both labels are in the higher-appetite group. Macro, price-trend, and liquidity inputs on this card share that group.`;
  }
  if (isRiskOn) {
    return `Stock regime label is ${stockRegime}. Crypto regime label is ${cryptoRegime}. Both labels are in the higher-appetite group. The two conviction readings differ. No position change is published.`;
  }
  if (isRiskOff && status.includes("Strongly")) {
    return `Stock regime label is ${stockRegime}. Crypto regime label is ${cryptoRegime}. Both labels are in the lower-appetite group. No position change is published.`;
  }
  if (isRiskOff) {
    return `The stock market (${stockRegime}) and crypto market (${cryptoRegime}) are both in a lower-risk appetite reading. High-beta assets are the smaller share of this reading. Cash, bonds, and stablecoins are the larger share. This is not an instruction.`;
  }
  if (isDiverge && status.includes("Stocks Leading")) {
    return `Stock regime label is ${stockRegime}. Crypto regime label is ${cryptoRegime}. The stock label is the lower-appetite class and the crypto label is not. No position change is published.`;
  }
  if (isDiverge && status.includes("Crypto Leading")) {
    return `Crypto regime label is ${cryptoRegime}. Stock regime label is ${stockRegime}. Equity breadth is not a separate input on this card. No position change is published.`;
  }
  if (isDiverge) {
    return `Stock regime label is ${stockRegime}. Crypto regime label is ${cryptoRegime}. The two labels disagree. No position change is published.`;
  }
  return `Stock regime label is ${stockRegime}. Crypto regime label is ${cryptoRegime}. Neither label is a directional break. No position change is published.`;
}

function buildKeyInsights(
  stock: StockMarketRegime,
  crypto: CryptoMarketRegime,
  status: AlignmentStatus,
): string[] {
  const insights: string[] = [];
  const ss = stockSentiment(stock.regime);
  const cs = cryptoSentiment(crypto.regime);

  if (status.includes("Strongly Aligned \u2014 Higher appetite")) {
    insights.push("Both markets are in higher-risk appetite alignment \u2014 historically the strongest environment for portfolio returns.");
  } else if (status.includes("Strongly Aligned \u2014 Lower appetite")) {
    insights.push("Both markets carry the lower-appetite regime label on this card. No position change is published.");
  } else if (status.includes("Diverging")) {
    insights.push(`Cross-market divergence detected: stocks are ${ss} while crypto is ${cs}. Divergences typically resolve within 2\u20134 weeks.`);
  }

  if (stock.pressureScore >= 70) {
    insights.push(`FAULTLINE Pressure Index is at ${Math.round(stock.pressureScore)}/100, in the elevated-stress band.`);
  } else if (stock.pressureScore <= 30) {
    insights.push(`FAULTLINE Pressure Index is at ${Math.round(stock.pressureScore)}/100, below the elevated-stress band.`);
  }

  if (crypto.regime === "Bear Market \u2192 Accumulation Phase") {
    insights.push("Bitcoin is in an accumulation phase inside a bear structure. A new bull cycle requires: price breakout above major resistance, strong volume, improving liquidity, and sustained higher-risk appetite macro confirmation.");
  }

  if (stock.regime === "Recession Risk") {
    insights.push("Recession risk is elevated in the stock market. Historically, this regime precedes significant equity drawdowns.");
  }
  if (crypto.regime === "Capitulation") {
    insights.push("Crypto regime label is capitulation. Volume confirmation is not on this card.");
  }
  if (stock.regime === "Recovery" && cs === "bullish") {
    insights.push(`Stock regime label is Recovery. Crypto sentiment label is ${cs}. Both labels are on this card. No position change is published.`);
  }

  if (ss === "bullish" && cs === "bullish") {
    insights.push(`Stock sentiment label is ${ss}. Crypto sentiment label is ${cs}. No position change is published.`);
  } else if (ss === "extreme-bear" || cs === "extreme-bear") {
    insights.push(`Forward reading: stock sentiment is ${ss}. Crypto sentiment is ${cs}. Pressure and regime labels are on this card. No position change is published.`);
  }

  return insights.slice(0, 5);
}

function buildForwardBias(ss: RegimeSentiment, cs: RegimeSentiment): string {
  if (ss === "bullish" && cs === "bullish") return `Stock sentiment label is ${ss}. Crypto sentiment label is ${cs}. No position change is published.`;
  if (ss === "bullish" && cs === "neutral") return `Stock sentiment label is ${ss}. Crypto sentiment label is ${cs}. No position change is published.`;
  if (ss === "neutral" && cs === "bullish") return `Stock sentiment label is ${ss}. Crypto sentiment label is ${cs}. No position change is published.`;
  if (ss === "neutral" && cs === "neutral") return "Stock sentiment is neutral. Crypto sentiment is neutral. No direction is established beyond those labels.";
  if (ss === "bearish" || cs === "bearish") return `Stock sentiment label is ${ss}. Crypto sentiment label is ${cs}. At least one label is bearish. No position change is published.`;
  return `Stock sentiment label is ${ss}. Crypto sentiment label is ${cs}. No position change is published.`;
}

// ── Alert Enrichment Helpers ─────────────────────────────────
function buildWhyItMatters(asset: "Stock" | "Crypto", previous: string, current: string): string {
  const prev = previous.toLowerCase();
  const curr = current.toLowerCase();

  // Deteriorating transitions
  if (asset === "Stock") {
    if (curr.includes("recession") || curr.includes("crisis")) {
      return "The regime label is recessionary or crisis. Historical drawdown ranges are not a forecast on this card. No position change is published.";
    }
    if (curr.includes("correction") || curr.includes("distribution")) {
      return "The equity market is entering a corrective or distribution phase. Institutional selling often accelerates in this regime. Risk-reward for new long positions deteriorates materially.";
    }
    if (curr.includes("bull") || curr.includes("expansion")) {
      return "The equity market has transitioned to a higher-risk appetite regime. Historically, this environment favours growth equities, cyclicals, and momentum strategies. Breadth tends to improve and drawdowns are shallower.";
    }
    if (curr.includes("recovery")) {
      return "The equity market is in early recovery. This regime often offers asymmetric upside as valuations reset and macro conditions stabilise. Selective accumulation in quality names tends to outperform.";
    }
    return `The equity market regime has shifted from ${previous} to ${current}. Review your equity allocation and risk exposure accordingly.`;
  }

  // Crypto
  if (curr.includes("accumulation")) {
    return "Bitcoin is forming a potential base inside a bear structure. Long-term holders are accumulating and exchange balances are declining — historically a precursor to the next bull cycle, but confirmation is required before aggressive positioning.";
  }
  if (curr.includes("capitulation")) {
    return "Crypto regime label is capitulation. Volume confirmation is not on this card. No position change is published.";
  }
  if (curr.includes("bull") || curr.includes("early bull")) {
    return "Crypto has transitioned to a bull regime. Historically, early bull phases offer the best risk-adjusted returns. Momentum and on-chain metrics tend to confirm the move. Selective accumulation in quality assets is favoured.";
  }
  if (curr.includes("bear")) {
    return "Crypto has entered a bear market regime. Drawdowns of 50–80%+ are common in this environment. Capital preservation and stablecoin positioning are the priority until macro and on-chain conditions improve.";
  }
  return `The crypto market regime has shifted from ${previous} to ${current}. Review your crypto allocation and risk exposure accordingly.`;
}

function buildWhatToWatchNext(asset: "Stock" | "Crypto", current: string): string {
  const curr = current.toLowerCase();

  if (asset === "Stock") {
    if (curr.includes("bull") || curr.includes("expansion")) {
      return "Watch for: (1) SPY/QQQ holding above 50-day MA, (2) VIX remaining below 20, (3) credit spreads staying tight, (4) earnings revisions trending positive, (5) breadth expanding across sectors.";
    }
    if (curr.includes("correction") || curr.includes("distribution")) {
      return "Watch for: (1) SPY breaking below 200-day MA, (2) VIX spiking above 25, (3) credit spreads widening, (4) defensive sectors (XLP, XLV) outperforming, (5) declining advance/decline line.";
    }
    if (curr.includes("recession") || curr.includes("crisis")) {
      return "Watch for: (1) Fed pivot signals (rate cut expectations), (2) credit spreads peaking and compressing, (3) unemployment claims stabilising, (4) SPY reclaiming 50-day MA on strong volume, (5) yield curve steepening.";
    }
    if (curr.includes("recovery")) {
      return "Watch for: (1) SPY reclaiming 200-day MA, (2) VIX declining below 20, (3) improving PMI data, (4) earnings guidance turning positive, (5) cyclical sectors (XLY, XLK) leading the recovery.";
    }
    return "Watch for: (1) price action relative to key moving averages, (2) VIX trend, (3) credit spread direction, (4) sector rotation patterns, (5) macro data surprises.";
  }

  // Crypto
  if (curr.includes("accumulation")) {
    return "Watch for: (1) BTC price breaking above major resistance with strong volume, (2) improving on-chain metrics (MVRV, SOPR), (3) declining exchange balances, (4) higher-risk appetite macro confirmation, (5) ETF inflow acceleration.";
  }
  if (curr.includes("capitulation")) {
    return "Watch for: (1) volume spike on a down day followed by reversal, (2) MVRV ratio below 1.0, (3) long-term holder accumulation resuming, (4) funding rates deeply negative, (5) macro higher-risk appetite shift.";
  }
  if (curr.includes("bull")) {
    return "Watch for: (1) BTC dominance declining (altcoin season signal), (2) funding rates turning positive but not extreme, (3) ETF inflows sustaining, (4) on-chain SOPR above 1.0, (5) macro liquidity conditions remaining supportive.";
  }
  if (curr.includes("bear")) {
    return "Watch for: (1) BTC holding key support levels, (2) funding rates normalising from extreme negative, (3) long-term holder accumulation signals, (4) macro liquidity improvement, (5) exchange balance decline resuming.";
  }
  return "Watch for: (1) price action at key support/resistance, (2) on-chain accumulation signals, (3) funding rate normalisation, (4) macro higher-risk appetite/off shifts, (5) exchange balance trends.";
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
  const now = Date.now();

  if (prevStockRegime !== null && prevStockRegime !== stock.regime) {
    const alert: RegimeChangeAlert = {
      asset:           "Stock",
      previous:        prevStockRegime,
      current:         stock.regime,
      message:         `US equity market regime changed from ${prevStockRegime} to ${stock.regime}. Review your equity positioning.`,
      whyItMatters:    buildWhyItMatters("Stock", prevStockRegime, stock.regime),
      whatToWatchNext: buildWhatToWatchNext("Stock", stock.regime),
      timestamp:       now,
    };
    regimeChangeAlerts.push(alert);
    // Persist to DB (fire-and-forget)
    getDb().then(db => { if (db) return db.insert(regimeAlerts).values({
      asset:           alert.asset,
      previous:        alert.previous,
      current:         alert.current,
      message:         alert.message,
      whyItMatters:    alert.whyItMatters,
      whatToWatchNext: alert.whatToWatchNext,
      detectedAt:      alert.timestamp,
    }); }).catch(err => console.error("[CrossMarket] Failed to persist stock regime alert:", err));
  }
  if (prevCryptoRegime !== null && prevCryptoRegime !== crypto.regime) {
    const alert: RegimeChangeAlert = {
      asset:           "Crypto",
      previous:        prevCryptoRegime,
      current:         crypto.regime,
      message:         `Crypto market regime changed from ${prevCryptoRegime} to ${crypto.regime}. Review your crypto positioning.`,
      whyItMatters:    buildWhyItMatters("Crypto", prevCryptoRegime, crypto.regime),
      whatToWatchNext: buildWhatToWatchNext("Crypto", crypto.regime),
      timestamp:       now,
    };
    regimeChangeAlerts.push(alert);
    // Persist to DB (fire-and-forget)
    getDb().then(db => { if (db) return db.insert(regimeAlerts).values({
      asset:           alert.asset,
      previous:        alert.previous,
      current:         alert.current,
      message:         alert.message,
      whyItMatters:    alert.whyItMatters,
      whatToWatchNext: alert.whatToWatchNext,
      detectedAt:      alert.timestamp,
    }); }).catch(err => console.error("[CrossMarket] Failed to persist crypto regime alert:", err));
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
