/**
 * Landing market ticker — pure view model.
 *
 * Symbols are the original FAULTLINE ticker set (GlobalMarketTicker, 02ec5d4),
 * in the original order. ^TNX was the original 10Y quote; the current
 * markets.getGlobalSnapshot contract publishes the 10Y as FRED:DGS10, so the
 * 10Y slot reads that series. Nothing here invents a price: a symbol missing
 * from the snapshot, or with no price, renders as unavailable.
 */
import type { MarketQuoteItem } from "../../../../../server/routers/markets";

export const ORIGINAL_TICKER_SYMBOLS = [
  { symbol: "^GSPC", fallbackLabel: "SPX" },
  { symbol: "^DJI", fallbackLabel: "DJIA" },
  { symbol: "^IXIC", fallbackLabel: "IXIC" },
  { symbol: "^RUT", fallbackLabel: "RUT" },
  { symbol: "^VIX", fallbackLabel: "VIX" },
  { symbol: "DX-Y.NYB", fallbackLabel: "DXY" },
  { symbol: "FRED:DGS10", fallbackLabel: "10Y" }, // originally ^TNX
  { symbol: "GC=F", fallbackLabel: "GOLD" },
  { symbol: "CL=F", fallbackLabel: "WTI" },
  { symbol: "BTC-USD", fallbackLabel: "BTC" },
  { symbol: "ETH-USD", fallbackLabel: "ETH" },
  { symbol: "^FTSE", fallbackLabel: "FTSE" },
  { symbol: "^GDAXI", fallbackLabel: "DAX" },
  { symbol: "^N225", fallbackLabel: "NIKKEI" },
] as const;

export type TickerQuoteState = "live" | "delayed" | "closed" | "stale" | "unavailable";

export interface TickerQuoteView {
  symbol: string;
  label: string;
  price: string | null;
  change: string | null;
  direction: "up" | "down" | "flat" | null;
  state: TickerQuoteState;
  /** Visible state tag; null only for a genuinely live print. */
  stateLabel: string | null;
}

export type TickerView =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "available"; quotes: TickerQuoteView[]; fetchedAt: number; allUnavailable: boolean };

type QuoteLike = Pick<MarketQuoteItem, "symbol" | "shortLabel" | "price" | "changePercent" | "freshnessState" | "sessionStatus" | "unit" | "proxySymbol">;

export function formatTickerPrice(price: number, unit?: string): string {
  if (unit === "percent") return `${price.toFixed(2)}%`;
  if (unit === "bps") return `${price >= 0 ? "+" : ""}${price.toFixed(0)}bp`;
  if (price >= 10_000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1_000) return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return price.toFixed(2);
}

function quoteState(item: QuoteLike): TickerQuoteState {
  if (item.price == null || !Number.isFinite(item.price) || item.freshnessState === "UNAVAILABLE") return "unavailable";
  if (item.freshnessState === "STALE") return "stale";
  if (item.sessionStatus === "CLOSED" || item.freshnessState === "LATEST_VERIFIED") return "closed";
  if (item.freshnessState === "LIVE" && !item.proxySymbol) return "live";
  return "delayed";
}

const STATE_LABEL: Record<TickerQuoteState, string | null> = {
  live: null,
  delayed: "DELAYED",
  closed: "LAST CLOSE",
  stale: "STALE",
  unavailable: "UNAVAILABLE",
};

export function toTickerQuote(item: QuoteLike | undefined, fallbackLabel: string, symbol: string): TickerQuoteView {
  if (!item) {
    return { symbol, label: fallbackLabel, price: null, change: null, direction: null, state: "unavailable", stateLabel: STATE_LABEL.unavailable };
  }
  const state = quoteState(item);
  const label = item.shortLabel || fallbackLabel;
  if (state === "unavailable") {
    return { symbol, label, price: null, change: null, direction: null, state, stateLabel: STATE_LABEL.unavailable };
  }
  const pct = item.changePercent;
  const hasPct = pct != null && Number.isFinite(pct);
  return {
    symbol,
    label,
    price: formatTickerPrice(item.price as number, item.unit),
    change: hasPct ? `${pct! > 0 ? "+" : ""}${pct!.toFixed(2)}%` : null,
    direction: !hasPct ? null : pct! > 0.05 ? "up" : pct! < -0.05 ? "down" : "flat",
    state,
    stateLabel: item.proxySymbol && state === "delayed" ? `${item.proxySymbol} PROXY · DELAYED` : STATE_LABEL[state],
  };
}

export function buildTickerView(input: {
  isLoading: boolean;
  isError: boolean;
  data: { items: readonly QuoteLike[]; fetchedAt: number } | null | undefined;
}): TickerView {
  if (input.data && Array.isArray(input.data.items)) {
    const bySymbol = new Map(input.data.items.map(item => [item.symbol, item]));
    const quotes = ORIGINAL_TICKER_SYMBOLS.map(({ symbol, fallbackLabel }) => toTickerQuote(bySymbol.get(symbol), fallbackLabel, symbol));
    return { status: "available", quotes, fetchedAt: input.data.fetchedAt, allUnavailable: quotes.every(q => q.state === "unavailable") };
  }
  if (input.isLoading && !input.isError) return { status: "loading" };
  return { status: "unavailable" };
}
