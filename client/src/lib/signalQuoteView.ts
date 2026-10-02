/* ============================================================
   Signals quote view (presentation only).

   A Signals card shows a price / change ONLY from the server's
   /api/signals/quotes response. When the server has no usable quote for a
   ticker, the card shows "—" + UNAVAILABLE. The static reference values in
   client/src/lib/signalsData.ts (price, changePercent, sparkline, volume) are
   never presented as a quote, and never under a LIVE label.
   ============================================================ */

export interface SignalQuoteLike {
  price: number;
  changePercent: number;
  isLive: boolean;
  marketStatus: "open" | "closed" | "extended" | "unknown" | string;
  sparkline?: number[];
  volumeMillions?: number;
}

export type SignalQuoteBadge = "LIVE" | "DELAYED" | "LAST CLOSE" | "UNAVAILABLE";

export interface SignalQuoteView {
  available: boolean;
  price: number | null;
  changePercent: number | null;
  priceText: string;
  changeText: string;
  badge: SignalQuoteBadge;
  sparkline: number[];
  volumeMillions: number | null;
}

export const SIGNAL_QUOTE_UNAVAILABLE = "UNAVAILABLE";

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function hasUsableSignalQuote(quote: SignalQuoteLike | null | undefined): quote is SignalQuoteLike {
  return !!quote && finite(quote.price) && quote.price > 0 && finite(quote.changePercent);
}

export function signalQuoteBadge(quote: SignalQuoteLike | null | undefined): SignalQuoteBadge {
  if (!hasUsableSignalQuote(quote)) return "UNAVAILABLE";
  if (quote.isLive && quote.marketStatus === "open") return "LIVE";
  if (quote.marketStatus === "closed") return "LAST CLOSE";
  return "DELAYED";
}

export function signalQuoteView(quote: SignalQuoteLike | null | undefined): SignalQuoteView {
  if (!hasUsableSignalQuote(quote)) {
    return { available: false, price: null, changePercent: null, priceText: "—", changeText: "—", badge: "UNAVAILABLE", sparkline: [], volumeMillions: null };
  }
  const change = quote.changePercent;
  return {
    available: true,
    price: quote.price,
    changePercent: change,
    priceText: `$${quote.price.toFixed(2)}`,
    changeText: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
    badge: signalQuoteBadge(quote),
    sparkline: Array.isArray(quote.sparkline) ? quote.sparkline : [],
    volumeMillions: finite(quote.volumeMillions) ? quote.volumeMillions : null,
  };
}

/**
 * Page-level feed label. "YAHOO FINANCE LIVE" only when at least one quote is
 * actually live in an open session; otherwise the feed is labelled by what the
 * quotes are (LAST CLOSE / DELAYED). Coverage is always stated.
 */
export function signalsFeedLabel(input: {
  source: "live" | "stale" | "fallback" | null;
  quotes: readonly SignalQuoteLike[] | null | undefined;
  tickerCount: number;
}): { label: string; coverage: string } {
  const usable = (input.quotes ?? []).filter(hasUsableSignalQuote);
  const coverage = `${usable.length}/${input.tickerCount} TICKERS QUOTED${usable.length < input.tickerCount ? " · OTHERS UNAVAILABLE" : ""}`;
  if (input.source === "stale") return { label: "STALE CACHE", coverage };
  if (input.source !== "live" || usable.length === 0) return { label: "FALLBACK MODE", coverage };
  if (usable.some(q => signalQuoteBadge(q) === "LIVE")) return { label: "YAHOO FINANCE LIVE", coverage };
  if (usable.every(q => q.marketStatus === "closed")) return { label: "YAHOO FINANCE · LAST CLOSE", coverage };
  return { label: "YAHOO FINANCE · DELAYED", coverage };
}

/**
 * Page-level price badge. "LIVE PRICES" only when at least one server quote is
 * actually live in an open session; otherwise the honest freshness of the best
 * quote available, or UNAVAILABLE when there are no usable quotes at all.
 * (The pressure-engine integrity label is NOT a statement about quote freshness.)
 */
export function signalsPriceBadge(quotes: readonly SignalQuoteLike[] | null | undefined): {
  label: "LIVE PRICES" | "LAST CLOSE" | "DELAYED" | "UNAVAILABLE";
  color: "green" | "amber" | "gray";
} {
  const badges = new Set((quotes ?? []).map(q => signalQuoteBadge(q)));
  if (badges.has("LIVE")) return { label: "LIVE PRICES", color: "green" };
  if (badges.has("LAST CLOSE")) return { label: "LAST CLOSE", color: "amber" };
  if (badges.has("DELAYED")) return { label: "DELAYED", color: "amber" };
  return { label: "UNAVAILABLE", color: "gray" };
}
