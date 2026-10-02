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
  /**
   * Provider delay flag from the server. Yahoo's chart feed is ~15-min delayed
   * (the same flag that makes the header strip read OPEN · DELAYED), so a
   * delayed quote in an open session is DELAYED, never LIVE.
   */
  isDelayed?: boolean;
  /**
   * The /api/signals/quotes response `source` this quote came in. A quote served
   * from the stale cache (or as fallback) is never LIVE, whatever its own
   * isLive flag said when it was cached.
   */
  feedSource?: SignalFeedSource | null;
  marketStatus: "open" | "closed" | "extended" | "unknown" | string;
  sparkline?: number[];
  volumeMillions?: number;
}

export type SignalQuoteBadge = "LIVE" | "DELAYED" | "LAST CLOSE" | "STALE" | "UNAVAILABLE";
export type SignalFeedSource = "live" | "stale" | "fallback";

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

/**
 * Per-quote freshness badge. `source` is the response source (defaults to the
 * quote's own feedSource): "stale" → STALE, "fallback" → UNAVAILABLE, never LIVE.
 * LIVE needs a live, non-delayed quote in an open session from a live response.
 */
export function signalQuoteBadge(
  quote: SignalQuoteLike | null | undefined,
  source: SignalFeedSource | null | undefined = quote?.feedSource,
): SignalQuoteBadge {
  if (!hasUsableSignalQuote(quote)) return "UNAVAILABLE";
  if (source === "fallback") return "UNAVAILABLE";
  if (source === "stale") return "STALE";
  if (quote.isLive && quote.marketStatus === "open" && quote.isDelayed !== true) return "LIVE";
  if (quote.marketStatus === "closed") return "LAST CLOSE";
  return "DELAYED";
}

export function signalQuoteView(
  quote: SignalQuoteLike | null | undefined,
  source: SignalFeedSource | null | undefined = quote?.feedSource,
): SignalQuoteView {
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
    badge: signalQuoteBadge(quote, source),
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
  if (usable.some(q => signalQuoteBadge(q, input.source) === "LIVE")) return { label: "YAHOO FINANCE LIVE", coverage };
  if (usable.every(q => q.marketStatus === "closed")) return { label: "YAHOO FINANCE · LAST CLOSE", coverage };
  return { label: "YAHOO FINANCE · DELAYED", coverage };
}

/**
 * Page-level price badge. "LIVE PRICES" only when at least one server quote is
 * actually live in an open session; otherwise the honest freshness of the best
 * quote available, or UNAVAILABLE when there are no usable quotes at all.
 * (The pressure-engine integrity label is NOT a statement about quote freshness.)
 */
export function signalsPriceBadge(
  quotes: readonly SignalQuoteLike[] | null | undefined,
  source?: SignalFeedSource | null,
): {
  label: "LIVE PRICES" | "LAST CLOSE" | "DELAYED" | "STALE" | "UNAVAILABLE";
  color: "green" | "amber" | "gray";
} {
  const badges = new Set((quotes ?? []).map(q => signalQuoteBadge(q, source ?? q?.feedSource)));
  if (badges.has("STALE")) return { label: "STALE", color: "amber" };
  if (badges.has("LIVE")) return { label: "LIVE PRICES", color: "green" };
  if (badges.has("LAST CLOSE")) return { label: "LAST CLOSE", color: "amber" };
  if (badges.has("DELAYED")) return { label: "DELAYED", color: "amber" };
  return { label: "UNAVAILABLE", color: "gray" };
}

/** Quotes for the scanner's own catalog only (the quote feed also carries index/ETF symbols). */
export function catalogQuotes<Q extends { ticker: string }>(
  quotes: readonly Q[] | null | undefined,
  catalogTickers: readonly string[],
): Q[] {
  const catalog = new Set(catalogTickers);
  return (quotes ?? []).filter(q => catalog.has(q.ticker));
}

/**
 * Footer copy derived from the SAME signalsFeedLabel() result as the header, so
 * the two can never disagree (freshness or ticker coverage).
 */
export function signalsFooter(feed: { label: string; coverage: string }): {
  title: string;
  detail: string;
  coverage: string;
  tone: "live" | "muted" | "alert";
} {
  const coverage = feed.coverage;
  switch (feed.label) {
    case "YAHOO FINANCE LIVE":
      return { title: "LIVE DATA", detail: "Yahoo Finance intraday prices (market open).", coverage, tone: "live" };
    case "YAHOO FINANCE · LAST CLOSE":
      return { title: "LAST CLOSE", detail: "Yahoo Finance prices from the most recent session close — not live.", coverage, tone: "muted" };
    case "YAHOO FINANCE · DELAYED":
      return { title: "DELAYED", detail: "Yahoo Finance prices, delayed — not live.", coverage, tone: "muted" };
    case "STALE CACHE":
      return { title: "STALE CACHE", detail: "Last cached quotes — not current.", coverage, tone: "alert" };
    default:
      return { title: "QUOTES UNAVAILABLE", detail: "No current server quotes. Unquoted tickers show — / UNAVAILABLE; no catalog prices are shown as market data.", coverage, tone: "alert" };
  }
}

/**
 * Page subtitle derived from the SAME signalsFeedLabel() result as the header
 * badge and footer, so it never claims "live prices" when quotes are last
 * close, delayed, stale or unavailable.
 */
export function signalsSubtitle(feed: { label: string } | null, opts: { loading?: boolean } = {}): string {
  const prefix = "Macro-regime-aware market scanner — ";
  const suffix = ", trading signals, and regime-fit scores for 30+ tickers.";
  if (opts.loading) return `${prefix}checking quote freshness${suffix}`;
  switch (feed?.label) {
    case "YAHOO FINANCE LIVE":
      return `${prefix}live intraday prices (market open)${suffix}`;
    case "YAHOO FINANCE · LAST CLOSE":
      return `${prefix}last-close prices (not live)${suffix}`;
    case "YAHOO FINANCE · DELAYED":
      return `${prefix}delayed prices (not live)${suffix}`;
    case "STALE CACHE":
      return `${prefix}stale cached prices (not current)${suffix}`;
    default:
      return `${prefix}prices currently unavailable${suffix}`;
  }
}
