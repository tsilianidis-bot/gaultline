/**
 * Canonical Global Markets snapshot.
 * One batched normalization layer for the ticker and Markets page. It does not
 * claim delayed, daily, unavailable, or stale observations are live.
 */
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getQuotes, type YahooQuote } from "../yahooProxy";
import { fetchFredBulk, type FredObservation, type FredSeriesResult } from "../fredClient";
import { getGlobalStats } from "../coingeckoProxy";
import { LRUCache } from "../lruCache";
import { log } from "../logger";
import { isFiniteNumber } from "../../shared/marketsDisplay";

export type MarketCategory = "us_equity" | "volatility" | "europe" | "asia" | "rates" | "fx" | "commodity" | "crypto";
type InstrumentProvider = "yahoo" | "fred" | "coingecko" | "derived";
export type FreshnessState = "LIVE" | "DELAYED" | "LATEST_VERIFIED" | "STALE" | "UNAVAILABLE";
export type CacheHealthState = "FRESH" | "STALE" | "UNAVAILABLE";
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
  /** Provider's precise observation time, when that precision is supplied. */
  observedAt: number | null;
  /** FRED observations are date-granular, so their source date is never turned into a made-up time of day. */
  observedDate: string | null;
  /** Local adapter receipt/cache time; this is never substituted for provider observation time. */
  fetchedAt: number | null;
  /** Receipt/cache health is deliberately separate from provider-observation freshness. */
  cacheState: CacheHealthState;
  source: string;
  destination: string;
  /** Present only when the print is an explicitly labeled ETF proxy, never the cash index. */
  proxySymbol?: string;
  error?: string;
}

export interface GlobalMarketSnapshot {
  items: MarketQuoteItem[];
  fetchedAt: number;
  activeSession: GlobalSession;
  summary: {
    usEquities: "higher-risk appetite" | "lower-risk appetite" | "mixed" | "unavailable";
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

const FRED_STALE_AFTER_CALENDAR_DAYS = 1;

function validPastTimestamp(value: unknown, now = Date.now()): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= now ? value : null;
}

function fredReceiptTimestamp(result: FredSeriesResult | undefined, now = Date.now()): number | null {
  return validPastTimestamp(result?.fetchedAt, now);
}

function validFredDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null;
}

function utcDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function fredCalendarDayAge(observedDate: string, now: number): number | null {
  const verifiedDate = validFredDate(observedDate);
  if (!verifiedDate || verifiedDate > utcDate(now)) return null;
  const [year, month, day] = verifiedDate.split("-").map(Number);
  const today = new Date(now);
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const observationStart = Date.UTC(year, month - 1, day);
  return Math.floor((todayStart - observationStart) / 86_400_000);
}

function cacheHealthFor({ fetchedAt, provider, now = Date.now() }: { fetchedAt: number | null | undefined; provider: InstrumentProvider; now?: number }): CacheHealthState {
  const receiptAt = validPastTimestamp(fetchedAt, now);
  if (receiptAt == null) return "UNAVAILABLE";
  const threshold = provider === "fred" ? 15 * 60 * 1000 : provider === "coingecko" ? 5 * 60 * 1000 : 12 * 60 * 1000;
  return now - receiptAt > threshold ? "STALE" : "FRESH";
}

export function classifyFreshness({ price, isDelayed, fetchedAt, observedAt, observedDate, provider, state, now = Date.now() }: { price: number | null; isDelayed: boolean; fetchedAt: number | null; observedAt?: number | null; observedDate?: string | null; provider: InstrumentProvider; state: YahooQuote["marketState"]; now?: number }): FreshnessState {
  if (!isFiniteNumber(price)) return "UNAVAILABLE";
  if (provider === "fred") {
    const ageInCalendarDays = observedDate == null ? null : fredCalendarDayAge(observedDate, now);
    if (ageInCalendarDays == null) return "UNAVAILABLE";
    return ageInCalendarDays > FRED_STALE_AFTER_CALENDAR_DAYS ? "STALE" : "LATEST_VERIFIED";
  }
  if (provider === "coingecko") {
    const sourceObservedAt = validPastTimestamp(observedAt, now);
    if (sourceObservedAt == null) return "UNAVAILABLE";
    if (now - sourceObservedAt > 12 * 60 * 1000) return "STALE";
    return "LATEST_VERIFIED";
  }
  if (fetchedAt == null || validPastTimestamp(fetchedAt, now) == null) return "UNAVAILABLE";
  const age = Math.max(0, now - fetchedAt);
  const threshold = state === "CLOSED" ? 26 * 60 * 60 * 1000 : 12 * 60 * 1000;
  if (age > threshold) return "STALE";
  if (provider === "derived") return "LATEST_VERIFIED";
  return isDelayed ? "DELAYED" : "LIVE";
}

function latestFinite(observations: FredObservation[] = []): { value: number; observedDate: string | null } | null {
  for (const observation of observations) {
    // Number("") and Number(" ") are zero, but FRED blank/missing values are
    // not readings. An explicit string "0" remains a valid numeric print.
    if (typeof observation.value !== "string" || observation.value.trim() === "") continue;
    const value = Number(observation.value);
    if (Number.isFinite(value)) return { value, observedDate: validFredDate(observation.date) };
  }
  return null;
}

function fredItem(inst: MarketInstrument, observations: FredObservation[], fetchedAt: number | null): MarketQuoteItem {
  const latest = latestFinite(observations);
  const previous = latestFinite(observations.slice(1));
  const rawSourceDate = latest?.observedDate ?? null;
  const sourceDate = rawSourceDate != null && fredCalendarDayAge(rawSourceDate, Date.now()) != null ? rawSourceDate : null;
  const sourceUsable = sourceDate != null;
  const price = sourceUsable ? latest?.value ?? null : null;
  const change = sourceUsable && latest && previous ? latest.value - previous.value : null;
  const changePercent = change != null && previous && previous.value !== 0 ? (change / previous.value) * 100 : null;
  return {
    ...inst,
    price, prevClose: sourceUsable ? previous?.value ?? null : null, open: null, high: null, low: null,
    change, changePercent, marketState: "CLOSED", sessionStatus: "CLOSED", isDelayed: true,
    observedAt: null, observedDate: sourceDate, fetchedAt, cacheState: cacheHealthFor({ fetchedAt, provider: "fred" }), source: "fred", destination: inst.destination,
    freshnessState: classifyFreshness({ price, isDelayed: true, fetchedAt, observedDate: sourceDate, provider: "fred", state: "CLOSED" }),
    ...(sourceUsable ? {} : { error: "Latest verified FRED observation timestamp unavailable, invalid, or in the future" }),
  };
}

/** Polygon prev-close and ETF proxies are never LIVE, even if a quote omits isDelayed. */
export function freshnessForYahooQuote(quote: YahooQuote | undefined, now = Date.now()): FreshnessState {
  const price = quote?.price ?? null;
  if (!quote || quote.source === "error" || !isFiniteNumber(price)) return "UNAVAILABLE";
  const forceDelayed = quote.source === "polygon-prev" || Boolean(quote.proxySymbol);
  return classifyFreshness({
    price,
    isDelayed: forceDelayed || (quote.isDelayed ?? true),
    fetchedAt: quote.fetchedAt,
    provider: "yahoo",
    state: quote.marketState,
    now,
  });
}

function yahooItem(inst: MarketInstrument, quote: YahooQuote | undefined): MarketQuoteItem {
  const fetchedAt = quote?.fetchedAt ?? Date.now();
  const marketState = quote?.marketState ?? "UNKNOWN";
  const proxySymbol = quote?.proxySymbol;
  return {
    ...inst,
    label: proxySymbol ? `${inst.label} (${proxySymbol} proxy)` : inst.label,
    shortLabel: proxySymbol ? `${inst.shortLabel}·${proxySymbol}` : inst.shortLabel,
    price: quote?.price ?? null, prevClose: quote?.prevClose ?? null, open: quote?.open ?? null, high: quote?.high ?? null, low: quote?.low ?? null,
    change: quote?.change ?? null, changePercent: quote?.changePercent ?? null, marketState, sessionStatus: sessionStatus(marketState),
    isDelayed: Boolean(proxySymbol) || quote?.source !== "yahoo" || (quote?.isDelayed ?? true),
    observedAt: quote?.observedAt ?? null, observedDate: null, fetchedAt, cacheState: cacheHealthFor({ fetchedAt, provider: "yahoo" }), source: quote?.source ?? "error", destination: inst.destination,
    freshnessState: freshnessForYahooQuote(quote),
    ...(proxySymbol ? { proxySymbol } : {}),
    ...(quote?.error ? { error: quote.error } : {}),
  };
}

/**
 * A derived print is receipt-verifiable only when every input has a receipt.
 * When both Treasury inputs do, retain the oldest so the curve cannot look
 * fresher than either source series.
 */
function oldestFredReceipt(...items: Array<MarketQuoteItem | undefined>): number | null {
  const receipts = items.map(item => validPastTimestamp(item?.fetchedAt));
  return receipts.length === items.length && receipts.every((receipt): receipt is number => receipt != null)
    ? Math.min(...receipts)
    : null;
}

function derivedCurveItem(inst: MarketInstrument, twoYear: MarketQuoteItem | undefined, tenYear: MarketQuoteItem | undefined): MarketQuoteItem {
  const fetchedAt = oldestFredReceipt(twoYear, tenYear);
  const inputsAvailable = twoYear?.price != null && tenYear?.price != null
    && twoYear.freshnessState !== "UNAVAILABLE" && tenYear.freshnessState !== "UNAVAILABLE";
  const price = inputsAvailable && tenYear?.price != null && twoYear?.price != null
    ? (tenYear.price - twoYear.price) * 100 : null;
  const observedDate = twoYear?.observedDate && tenYear?.observedDate
    ? (twoYear.observedDate < tenYear.observedDate ? twoYear.observedDate : tenYear.observedDate)
    : null;
  const freshnessState: FreshnessState = price == null
    ? "UNAVAILABLE"
    : twoYear?.freshnessState === "STALE" || tenYear?.freshnessState === "STALE"
      ? "STALE"
      : "LATEST_VERIFIED";
  return {
    ...inst, price, prevClose: null, open: null, high: null, low: null, change: null, changePercent: null,
    marketState: "CLOSED", sessionStatus: "CLOSED", isDelayed: true, observedAt: null, observedDate, fetchedAt,
    cacheState: cacheHealthFor({ fetchedAt, provider: "fred" }), source: "derived:FRED", destination: inst.destination,
    freshnessState,
    ...(price == null ? { error: "2Y/10Y curve requires both latest verified Treasury yields" } : {}),
  };
}

function cryptoGlobalItem(inst: MarketInstrument, value: number | null, changePercent: number | null, observedAt: number | null, fetchedAt: number | null): MarketQuoteItem {
  const sourceObservedAt = validPastTimestamp(observedAt);
  const receiptAt = validPastTimestamp(fetchedAt);
  const price = sourceObservedAt == null ? null : value;
  return {
    ...inst, price, prevClose: null, open: null, high: null, low: null, change: null, changePercent: price == null ? null : changePercent,
    marketState: "REGULAR", sessionStatus: "OPEN", isDelayed: false, observedAt: sourceObservedAt, observedDate: null, fetchedAt: receiptAt,
    cacheState: cacheHealthFor({ fetchedAt: receiptAt, provider: "coingecko" }), source: "coingecko", destination: inst.destination,
    freshnessState: classifyFreshness({ price, isDelayed: false, fetchedAt: receiptAt, observedAt: sourceObservedAt, provider: "coingecko", state: "REGULAR" }),
    ...(price == null ? { error: "Latest verified CoinGecko global observation timestamp unavailable, invalid, or in the future" } : {}),
  };
}

function deriveStatus<T extends string>(items: MarketQuoteItem[], positive: T, negative: T, mixed: T, unavailable: T, closed?: T): T {
  const available = items.filter(item => isFiniteNumber(item.changePercent) && item.freshnessState !== "STALE");
  if (!available.length) return unavailable;
  if (closed && available.every(item => item.sessionStatus === "CLOSED")) return closed;
  const average = available.reduce((sum, item) => sum + item.changePercent!, 0) / available.length;
  if (Math.abs(average) < 0.15) return mixed;
  return average > 0 ? positive : negative;
}

function summary(items: MarketQuoteItem[]): GlobalMarketSnapshot["summary"] {
  const group = (category: MarketCategory) => items.filter(item => item.category === category);
  const us = group("us_equity");
  const usMoves = us.filter(item => item.freshnessState !== "STALE").map(item => item.changePercent).filter(isFiniteNumber);
  const usAverage = usMoves.length ? usMoves.reduce((sum, value) => sum + value, 0) / usMoves.length : null;
  const vix = items.find(item => item.symbol === "^VIX");
  const dxy = items.find(item => item.symbol === "DX-Y.NYB");
  const tenYear = items.find(item => item.symbol === "FRED:DGS10");
  const vixPrice = vix?.price;
  const dollarMove = dxy?.changePercent;
  const tenYearChange = tenYear?.change;
  return {
    usEquities: usAverage === null ? "unavailable" : usAverage > 0.3 ? "higher-risk appetite" : usAverage < -0.3 ? "lower-risk appetite" : "mixed",
    europe: deriveStatus(group("europe"), "positive", "negative", "mixed", "unavailable", "closed"),
    asia: deriveStatus(group("asia"), "positive", "negative", "mixed", "unavailable", "closed"),
    volatility: !isFiniteNumber(vixPrice) ? "unavailable" : vixPrice > 25 ? "elevated" : vixPrice < 15 ? "low" : "normal",
    dollar: !isFiniteNumber(dollarMove) ? "unavailable" : dollarMove > 0.15 ? "strengthening" : dollarMove < -0.15 ? "weakening" : "stable",
    rates: !isFiniteNumber(tenYearChange) ? "unavailable" : tenYearChange > 0.04 ? "rising" : tenYearChange < -0.04 ? "falling" : "stable",
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
    if (inst.provider === "fred") {
      const result = fred?.results[inst.symbol.replace("FRED:", "")];
      items.push(fredItem(inst, result?.observations ?? [], fredReceiptTimestamp(result)));
    }
  }
  const twoYear = items.find(item => item.symbol === "FRED:DGS2");
  const tenYear = items.find(item => item.symbol === "FRED:DGS10");
  const curve = GLOBAL_INSTRUMENTS.find(item => item.symbol === "DERIVED:2Y10Y");
  if (curve) items.push(derivedCurveItem(curve, twoYear, tenYear));
  const totalCap = GLOBAL_INSTRUMENTS.find(item => item.symbol === "CG:TOTAL_MC");
  const btcDom = GLOBAL_INSTRUMENTS.find(item => item.symbol === "CG:BTC_DOM");
  const totalMarketCapTrillions = typeof global?.totalMarketCap === "number" && Number.isFinite(global.totalMarketCap)
    ? global.totalMarketCap / 1_000_000_000_000
    : null;
  const marketCapChange = typeof global?.marketCapChangePercent24h === "number" && Number.isFinite(global.marketCapChangePercent24h)
    ? global.marketCapChangePercent24h
    : null;
  if (totalCap) items.push(cryptoGlobalItem(totalCap, totalMarketCapTrillions, marketCapChange, global?.observedAt ?? null, global?.fetchedAt ?? null));
  if (btcDom) items.push(cryptoGlobalItem(btcDom, global?.btcDominance ?? null, null, global?.observedAt ?? null, global?.fetchedAt ?? null));

  const rankable = items.filter(item => isFiniteNumber(item.changePercent) && !["rates", "volatility"].includes(item.category) && item.freshnessState !== "STALE");
  const ranked = [...rankable].sort((a, b) => b.changePercent! - a.changePercent!);
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
      lastSuccessfulUpdate: snapshot.items.filter(item => item.price != null).reduce((latest, item) => Math.max(latest, item.fetchedAt ?? 0), 0),
    };
  }),
});
