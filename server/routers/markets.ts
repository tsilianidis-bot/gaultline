/**
 * Canonical Global Markets snapshot.
 * One batched normalization layer for the ticker and Markets page. It does not
 * claim delayed, daily, unavailable, or stale observations are live.
 */
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getQuotes, type YahooQuote } from "../yahooProxy";
import { fetchFredBulk, type FredObservation } from "../fredClient";
import { getGlobalStats } from "../coingeckoProxy";
import { LRUCache } from "../lruCache";
import { log } from "../logger";

export type MarketCategory = "us_equity" | "volatility" | "europe" | "asia" | "rates" | "fx" | "commodity" | "crypto";
type InstrumentProvider = "yahoo" | "fred" | "coingecko" | "derived";
export type FreshnessState = "LIVE" | "DELAYED" | "LATEST_VERIFIED" | "STALE" | "UNAVAILABLE";
export type GlobalSession = "ASIA" | "EUROPE" | "US" | "OFF_HOURS";

export interface MarketInstrument {
  symbol: string;
  label: string;
  shortLabel: string;
  category: MarketCategory;
  provider: InstrumentProvider;
  region?: string;
  unit?: "price" | "percent" | "bps" | "percent_of_market" | "usd_trillions";
  priority?: number;
  destination: string;
}

/** Canonical symbol mapping. Unsupported instruments remain unavailable, never simulated. */
export const GLOBAL_INSTRUMENTS: MarketInstrument[] = [
  { symbol: "^GSPC", label: "S&P 500", shortLabel: "SPX", category: "us_equity", provider: "yahoo", destination: "/app/markets", priority: 1 },
  { symbol: "^IXIC", label: "Nasdaq Composite", shortLabel: "IXIC", category: "us_equity", provider: "yahoo", destination: "/app/markets", priority: 2 },
  { symbol: "^DJI", label: "Dow Jones", shortLabel: "DJIA", category: "us_equity", provider: "yahoo", destination: "/app/markets", priority: 3 },
  { symbol: "^RUT", label: "Russell 2000", shortLabel: "RUT", category: "us_equity", provider: "yahoo", destination: "/app/markets", priority: 4 },
  { symbol: "^VIX", label: "CBOE Volatility Index", shortLabel: "VIX", category: "volatility", provider: "yahoo", destination: "/app/markets?focus=volatility", priority: 5 },

  { symbol: "^STOXX", label: "STOXX Europe 600", shortLabel: "STOXX", category: "europe", provider: "yahoo", region: "Europe", destination: "/app/markets?group=europe", priority: 1 },
  { symbol: "^FTSE", label: "FTSE 100", shortLabel: "FTSE", category: "europe", provider: "yahoo", region: "UK", destination: "/app/markets?group=europe", priority: 2 },
  { symbol: "^GDAXI", label: "DAX", shortLabel: "DAX", category: "europe", provider: "yahoo", region: "Germany", destination: "/app/markets?group=europe", priority: 3 },
  { symbol: "^FCHI", label: "CAC 40", shortLabel: "CAC", category: "europe", provider: "yahoo", region: "France", destination: "/app/markets?group=europe", priority: 4 },

  { symbol: "^N225", label: "Nikkei 225", shortLabel: "NIKKEI", category: "asia", provider: "yahoo", region: "Japan", destination: "/app/markets?group=asia", priority: 1 },
  { symbol: "^HSI", label: "Hang Seng", shortLabel: "HSI", category: "asia", provider: "yahoo", region: "Hong Kong", destination: "/app/markets?group=asia", priority: 2 },
  { symbol: "000001.SS", label: "Shanghai Composite", shortLabel: "SHCOMP", category: "asia", provider: "yahoo", region: "China", destination: "/app/markets?group=asia", priority: 3 },
  { symbol: "000300.SS", label: "CSI 300", shortLabel: "CSI 300", category: "asia", provider: "yahoo", region: "China", destination: "/app/markets?group=asia", priority: 4 },
  { symbol: "^KS11", label: "KOSPI", shortLabel: "KOSPI", category: "asia", provider: "yahoo", region: "South Korea", destination: "/app/markets?group=asia", priority: 5 },

  { symbol: "FRED:DGS2", label: "US 2-Year Treasury", shortLabel: "2Y", category: "rates", provider: "fred", unit: "percent", destination: "/app/markets?group=rates", priority: 1 },
  { symbol: "FRED:DGS10", label: "US 10-Year Treasury", shortLabel: "10Y", category: "rates", provider: "fred", unit: "percent", destination: "/app/markets?group=rates", priority: 2 },
  { symbol: "FRED:DGS30", label: "US 30-Year Treasury", shortLabel: "30Y", category: "rates", provider: "fred", unit: "percent", destination: "/app/markets?group=rates", priority: 3 },
  { symbol: "DERIVED:2Y10Y", label: "2Y / 10Y Curve", shortLabel: "2Y10Y", category: "rates", provider: "derived", unit: "bps", destination: "/app/markets?group=rates", priority: 4 },

  { symbol: "DX-Y.NYB", label: "US Dollar Index", shortLabel: "DXY", category: "fx", provider: "yahoo", destination: "/app/markets?group=fx", priority: 1 },
  { symbol: "EURUSD=X", label: "EUR / USD", shortLabel: "EURUSD", category: "fx", provider: "yahoo", destination: "/app/markets?group=fx", priority: 2 },
  { symbol: "JPY=X", label: "USD / JPY", shortLabel: "USDJPY", category: "fx", provider: "yahoo", destination: "/app/markets?group=fx", priority: 3 },
  { symbol: "GBPUSD=X", label: "GBP / USD", shortLabel: "GBPUSD", category: "fx", provider: "yahoo", destination: "/app/markets?group=fx", priority: 4 },

  { symbol: "GC=F", label: "Gold", shortLabel: "GOLD", category: "commodity", provider: "yahoo", destination: "/app/markets?group=commodities", priority: 1 },
  { symbol: "SI=F", label: "Silver", shortLabel: "SILVER", category: "commodity", provider: "yahoo", destination: "/app/markets?group=commodities", priority: 2 },
  { symbol: "CL=F", label: "WTI Crude", shortLabel: "WTI", category: "commodity", provider: "yahoo", destination: "/app/markets?group=commodities", priority: 3 },
  { symbol: "BZ=F", label: "Brent Crude", shortLabel: "BRENT", category: "commodity", provider: "yahoo", destination: "/app/markets?group=commodities", priority: 4 },
  { symbol: "NG=F", label: "Natural Gas", shortLabel: "NAT GAS", category: "commodity", provider: "yahoo", destination: "/app/markets?group=commodities", priority: 5 },

  { symbol: "BTC-USD", label: "Bitcoin", shortLabel: "BTC", category: "crypto", provider: "yahoo", destination: "/app/crypto", priority: 1 },
  { symbol: "ETH-USD", label: "Ethereum", shortLabel: "ETH", category: "crypto", provider: "yahoo", destination: "/app/crypto", priority: 2 },
  { symbol: "CG:TOTAL_MC", label: "Total Crypto Market Cap", shortLabel: "CRYPTO MC", category: "crypto", provider: "coingecko", unit: "usd_trillions", destination: "/app/crypto", priority: 3 },
  { symbol: "CG:BTC_DOM", label: "Bitcoin Dominance", shortLabel: "BTC DOM", category: "crypto", provider: "coingecko", unit: "percent_of_market", destination: "/app/crypto", priority: 4 },
];

export interface MarketQuoteItem {
  symbol: string;
  label: string;
  shortLabel: string;
  category: MarketCategory;
  region?: string;
  unit?: string;
  price: number | null;
  prevClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number | null;
  changePercent: number | null;
  marketState: YahooQuote["marketState"];
  sessionStatus: "OPEN" | "PRE-MARKET" | "AFTER HOURS" | "CLOSED" | "UNKNOWN";
  freshnessState: FreshnessState;
  isDelayed: boolean;
  observedAt: number | null;
  fetchedAt: number;
  source: string;
  destination: string;
  error?: string;
}

export interface GlobalMarketSnapshot {
  items: MarketQuoteItem[];
  fetchedAt: number;
  activeSession: GlobalSession;
  summary: {
    usEquities: "risk-on" | "risk-off" | "mixed" | "unavailable";
    europe: "positive" | "negative" | "mixed" | "closed" | "unavailable";
    asia: "positive" | "negative" | "mixed" | "closed" | "unavailable";
    volatility: "elevated" | "normal" | "low" | "unavailable";
    dollar: "strengthening" | "weakening" | "stable" | "unavailable";
    rates: "rising" | "falling" | "stable" | "unavailable";
    commodities: "positive" | "negative" | "mixed" | "unavailable";
    crypto: "positive" | "negative" | "mixed" | "unavailable";
  };
  strongest: MarketQuoteItem[];
  weakest: MarketQuoteItem[];
}

const SNAPSHOT_TTL_MS = 90_000;
const snapshotCache = new LRUCache<string, GlobalMarketSnapshot>(1, SNAPSHOT_TTL_MS);

function globalSession(now = new Date()): GlobalSession {
  const hour = now.getUTCHours();
  if (hour >= 0 && hour < 8) return "ASIA";
  if (hour >= 7 && hour < 16) return "EUROPE";
  if (hour >= 13 && hour < 21) return "US";
  return "OFF_HOURS";
}

function sessionStatus(state: YahooQuote["marketState"]): MarketQuoteItem["sessionStatus"] {
  if (state === "REGULAR") return "OPEN";
  if (state === "PRE" || state === "PREPRE") return "PRE-MARKET";
  if (state === "POST" || state === "POSTPOST") return "AFTER HOURS";
  if (state === "CLOSED") return "CLOSED";
  return "UNKNOWN";
}

export function classifyFreshness({ price, isDelayed, fetchedAt, provider, state, now = Date.now() }: { price: number | null; isDelayed: boolean; fetchedAt: number; provider: InstrumentProvider; state: YahooQuote["marketState"]; now?: number }): FreshnessState {
  if (price == null) return "UNAVAILABLE";
  const age = Math.max(0, now - fetchedAt);
  const threshold = provider === "fred" ? 27 * 60 * 60 * 1000 : state === "CLOSED" ? 26 * 60 * 60 * 1000 : 12 * 60 * 1000;
  if (age > threshold) return "STALE";
  if (provider === "fred" || provider === "coingecko" || provider === "derived") return "LATEST_VERIFIED";
  return isDelayed ? "DELAYED" : "LIVE";
}

function latestFinite(observations: FredObservation[] = []): { value: number; observedAt: number } | null {
  for (const observation of observations) {
    const value = Number(observation.value);
    if (Number.isFinite(value)) return { value, observedAt: Date.parse(`${observation.date}T00:00:00Z`) };
  }
  return null;
}

function fredItem(inst: MarketInstrument, observations: FredObservation[], fetchedAt: number): MarketQuoteItem {
  const latest = latestFinite(observations);
  const previous = latestFinite(observations.slice(1));
  const change = latest && previous ? latest.value - previous.value : null;
  const changePercent = latest && previous && previous.value !== 0 ? (change! / previous.value) * 100 : null;
  return {
    ...inst,
    price: latest?.value ?? null, prevClose: previous?.value ?? null, open: null, high: null, low: null,
    change, changePercent, marketState: "CLOSED", sessionStatus: "CLOSED", isDelayed: true,
    observedAt: latest?.observedAt ?? null, fetchedAt, source: "fred", destination: inst.destination,
    freshnessState: classifyFreshness({ price: latest?.value ?? null, isDelayed: true, fetchedAt, provider: "fred", state: "CLOSED" }),
    ...(latest ? {} : { error: "Latest verified FRED observation unavailable" }),
  };
}

function yahooItem(inst: MarketInstrument, quote: YahooQuote | undefined): MarketQuoteItem {
  const fetchedAt = quote?.fetchedAt ?? Date.now();
  const marketState = quote?.marketState ?? "UNKNOWN";
  return {
    ...inst,
    price: quote?.price ?? null, prevClose: quote?.prevClose ?? null, open: quote?.open ?? null, high: quote?.high ?? null, low: quote?.low ?? null,
    change: quote?.change ?? null, changePercent: quote?.changePercent ?? null, marketState, sessionStatus: sessionStatus(marketState),
    isDelayed: quote?.isDelayed ?? true, observedAt: quote?.observedAt ?? null, fetchedAt, source: quote?.source ?? "error", destination: inst.destination,
    freshnessState: classifyFreshness({ price: quote?.price ?? null, isDelayed: quote?.isDelayed ?? true, fetchedAt, provider: "yahoo", state: marketState }),
    ...(quote?.error ? { error: quote.error } : {}),
  };
}

function derivedCurveItem(inst: MarketInstrument, twoYear: MarketQuoteItem | undefined, tenYear: MarketQuoteItem | undefined, fetchedAt: number): MarketQuoteItem {
  const price = twoYear?.price != null && tenYear?.price != null ? (tenYear.price - twoYear.price) * 100 : null;
  const observedAt = twoYear?.observedAt && tenYear?.observedAt ? Math.min(twoYear.observedAt, tenYear.observedAt) : null;
  return {
    ...inst, price, prevClose: null, open: null, high: null, low: null, change: null, changePercent: null,
    marketState: "CLOSED", sessionStatus: "CLOSED", isDelayed: true, observedAt, fetchedAt, source: "derived:FRED", destination: inst.destination,
    freshnessState: price == null ? "UNAVAILABLE" : "LATEST_VERIFIED",
    ...(price == null ? { error: "2Y/10Y curve requires both latest verified Treasury yields" } : {}),
  };
}

function cryptoGlobalItem(inst: MarketInstrument, value: number | null, changePercent: number | null, fetchedAt: number): MarketQuoteItem {
  return {
    ...inst, price: value, prevClose: null, open: null, high: null, low: null, change: null, changePercent,
    marketState: "REGULAR", sessionStatus: "OPEN", isDelayed: false, observedAt: value == null ? null : fetchedAt, fetchedAt, source: "coingecko", destination: inst.destination,
    freshnessState: classifyFreshness({ price: value, isDelayed: false, fetchedAt, provider: "coingecko", state: "REGULAR" }),
    ...(value == null ? { error: "Latest verified CoinGecko global metric unavailable" } : {}),
  };
}

function deriveStatus<T extends string>(items: MarketQuoteItem[], positive: T, negative: T, mixed: T, unavailable: T, closed?: T): T {
  const available = items.filter(item => item.changePercent != null && item.freshnessState !== "STALE");
  if (!available.length) return unavailable;
  if (closed && available.every(item => item.sessionStatus === "CLOSED")) return closed;
  const average = available.reduce((sum, item) => sum + (item.changePercent ?? 0), 0) / available.length;
  if (Math.abs(average) < 0.15) return mixed;
  return average > 0 ? positive : negative;
}

function summary(items: MarketQuoteItem[]): GlobalMarketSnapshot["summary"] {
  const group = (category: MarketCategory) => items.filter(item => item.category === category);
  const us = group("us_equity");
  const usAverage = us.filter(item => item.changePercent != null).reduce((sum, item) => sum + (item.changePercent ?? 0), 0) / Math.max(1, us.filter(item => item.changePercent != null).length);
  const vix = items.find(item => item.symbol === "^VIX");
  const dxy = items.find(item => item.symbol === "DX-Y.NYB");
  const tenYear = items.find(item => item.symbol === "FRED:DGS10");
  return {
    usEquities: !us.some(item => item.changePercent != null) ? "unavailable" : usAverage > 0.3 ? "risk-on" : usAverage < -0.3 ? "risk-off" : "mixed",
    europe: deriveStatus(group("europe"), "positive", "negative", "mixed", "unavailable", "closed"),
    asia: deriveStatus(group("asia"), "positive", "negative", "mixed", "unavailable", "closed"),
    volatility: vix?.price == null ? "unavailable" : vix.price > 25 ? "elevated" : vix.price < 15 ? "low" : "normal",
    dollar: dxy?.changePercent == null ? "unavailable" : dxy.changePercent > 0.15 ? "strengthening" : dxy.changePercent < -0.15 ? "weakening" : "stable",
    rates: tenYear?.change == null ? "unavailable" : tenYear.change > 0.04 ? "rising" : tenYear.change < -0.04 ? "falling" : "stable",
    commodities: deriveStatus(group("commodity"), "positive", "negative", "mixed", "unavailable"),
    crypto: deriveStatus(group("crypto"), "positive", "negative", "mixed", "unavailable"),
  };
}

export async function getGlobalMarketSnapshot(force = false): Promise<GlobalMarketSnapshot> {
  if (!force) {
    const cached = snapshotCache.get("global");
    if (cached) return cached;
  }
  const fetchedAt = Date.now();
  const yahooInstruments = GLOBAL_INSTRUMENTS.filter(inst => inst.provider === "yahoo");
  const [quotesResult, fredResult, globalResult] = await Promise.allSettled([
    getQuotes(yahooInstruments.map(inst => inst.symbol)),
    fetchFredBulk([{ id: "DGS2", limit: 2 }, { id: "DGS10", limit: 2 }, { id: "DGS30", limit: 2 }]),
    getGlobalStats(),
  ]);
  const quoteMap = new Map((quotesResult.status === "fulfilled" ? quotesResult.value : []).map(quote => [quote.ticker, quote]));
  const fred = fredResult.status === "fulfilled" ? fredResult.value : null;
  const global = globalResult.status === "fulfilled" ? globalResult.value : null;
  if (quotesResult.status === "rejected") log.warn("[Markets] Yahoo batch failed", { error: String(quotesResult.reason) });
  if (fredResult.status === "rejected") log.warn("[Markets] FRED batch failed", { error: String(fredResult.reason) });
  if (globalResult.status === "rejected") log.warn("[Markets] CoinGecko global failed", { error: String(globalResult.reason) });

  const items: MarketQuoteItem[] = [];
  for (const inst of GLOBAL_INSTRUMENTS) {
    if (inst.provider === "yahoo") items.push(yahooItem(inst, quoteMap.get(inst.symbol)));
    if (inst.provider === "fred") items.push(fredItem(inst, fred?.results[inst.symbol.replace("FRED:", "")]?.observations ?? [], fetchedAt));
  }
  const twoYear = items.find(item => item.symbol === "FRED:DGS2");
  const tenYear = items.find(item => item.symbol === "FRED:DGS10");
  const curve = GLOBAL_INSTRUMENTS.find(item => item.symbol === "DERIVED:2Y10Y");
  if (curve) items.push(derivedCurveItem(curve, twoYear, tenYear, fetchedAt));
  const totalCap = GLOBAL_INSTRUMENTS.find(item => item.symbol === "CG:TOTAL_MC");
  const btcDom = GLOBAL_INSTRUMENTS.find(item => item.symbol === "CG:BTC_DOM");
  if (totalCap) items.push(cryptoGlobalItem(totalCap, global ? global.totalMarketCap / 1_000_000_000_000 : null, global?.marketCapChangePercent24h ?? null, global?.fetchedAt ?? fetchedAt));
  if (btcDom) items.push(cryptoGlobalItem(btcDom, global?.btcDominance ?? null, null, global?.fetchedAt ?? fetchedAt));

  const rankable = items.filter(item => item.changePercent != null && !["rates", "volatility"].includes(item.category) && item.freshnessState !== "STALE");
  const ranked = [...rankable].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const snapshot: GlobalMarketSnapshot = { items, fetchedAt, activeSession: globalSession(), summary: summary(items), strongest: ranked.slice(0, 5), weakest: ranked.slice(-5).reverse() };
  snapshotCache.set("global", snapshot);
  return snapshot;
}

export const marketsRouter = router({
  getGlobalSnapshot: publicProcedure.query(() => getGlobalMarketSnapshot()),
  getMarketHealth: adminProcedure.query(async () => {
    const snapshot = await getGlobalMarketSnapshot();
    return {
      fetchedAt: snapshot.fetchedAt,
      failedInstruments: snapshot.items.filter(item => item.freshnessState === "UNAVAILABLE").map(item => ({ symbol: item.symbol, error: item.error ?? "Unavailable" })),
      staleInstruments: snapshot.items.filter(item => item.freshnessState === "STALE").map(item => item.symbol),
      delayedInstruments: snapshot.items.filter(item => item.freshnessState === "DELAYED").map(item => item.symbol),
      lastSuccessfulUpdate: snapshot.items.filter(item => item.price != null).reduce((latest, item) => Math.max(latest, item.fetchedAt), 0),
    };
  }),
});
