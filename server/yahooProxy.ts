// ============================================================
import { captureError } from "./errorTracking";
// FAULTLINE — Yahoo Finance Intraday Quote Proxy
// server/yahooProxy.ts
//
// Fetches 15-min delayed intraday quotes from Yahoo Finance's
// unofficial public endpoint. No API key required.
//
// Caches results server-side for 60 seconds to avoid hammering
// Yahoo with per-user requests.
//
// Falls back to Polygon.io /v2/aggs/ticker/{T}/prev on Yahoo
// failure. If both fail, returns null fields with error info.
// ============================================================

import { LRUCache } from "./lruCache";
import { log } from "./logger";

const CACHE_TTL_MS = 60_000; // 60 seconds

export interface YahooQuote {
  ticker: string;
  price: number | null;
  prevClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  change: number | null;
  changePercent: number | null;
  marketState: "REGULAR" | "PRE" | "POST" | "CLOSED" | "PREPRE" | "POSTPOST" | "UNKNOWN";
  isDelayed: boolean;
  source: "yahoo" | "polygon-prev" | "error";
  fetchedAt: number;
  error?: string;
}

// Per-ticker LRU cache — max 500 tickers, 60s TTL
const quoteCache = new LRUCache<string, YahooQuote>(500, CACHE_TTL_MS);

// ── Yahoo fetcher ─────────────────────────────────────────────

/** Derive market state from Yahoo's currentTradingPeriod timestamps when marketState is missing */
function deriveMarketStateFromPeriod(meta: any): YahooQuote["marketState"] {
  const period = meta?.currentTradingPeriod;
  if (!period) return "UNKNOWN";
  const nowSec = Math.floor(Date.now() / 1000);
  const pre = period.pre;
  const regular = period.regular;
  const post = period.post;
  if (regular && nowSec >= regular.start && nowSec < regular.end) return "REGULAR";
  if (pre && nowSec >= pre.start && nowSec < pre.end) return "PRE";
  if (post && nowSec >= post.start && nowSec < post.end) return "POST";
  return "CLOSED";
}

async function fetchYahooQuote(ticker: string): Promise<YahooQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d&includePrePost=true`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://finance.yahoo.com/",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);

  const json = await res.json() as any;
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No chart result in Yahoo response");

  const meta = result.meta;

  // Derive market state: prefer Yahoo's field, fall back to period timestamps
  const rawMarketState = meta.marketState as YahooQuote["marketState"] | null | undefined;
  const marketState: YahooQuote["marketState"] = rawMarketState ?? deriveMarketStateFromPeriod(meta);

  // Compute changePercent: prefer Yahoo's field, fall back to (price - prevClose) / prevClose
  const price = meta.regularMarketPrice ?? null;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? null;
  const changePercent = meta.regularMarketChangePercent ?? (
    price != null && prevClose != null && prevClose !== 0
      ? ((price - prevClose) / prevClose) * 100
      : null
  );

  return {
    ticker: ticker.toUpperCase(),
    price,
    prevClose,
    open:          meta.regularMarketOpen          ?? null,
    high:          meta.regularMarketDayHigh       ?? null,
    low:           meta.regularMarketDayLow        ?? null,
    volume:        meta.regularMarketVolume        ?? null,
    change:        price != null && prevClose != null ? price - prevClose : null,
    changePercent,
    marketState,
    isDelayed:     true,
    source:        "yahoo",
    fetchedAt:     Date.now(),
  };
}

// ── Polygon prev-close fallback ───────────────────────────────

async function fetchPolygonPrevClose(ticker: string): Promise<YahooQuote> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error("No POLYGON_API_KEY configured");

  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

  if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);

  const json = await res.json() as any;
  const bar = json?.results?.[0];
  if (!bar) throw new Error("No results from Polygon prev-close");

  return {
    ticker: ticker.toUpperCase(),
    price:         bar.c ?? null,   // close price
    prevClose:     bar.c ?? null,
    open:          bar.o ?? null,
    high:          bar.h ?? null,
    low:           bar.l ?? null,
    volume:        bar.v ?? null,
    change:        null,
    changePercent: null,
    marketState:   "CLOSED",
    isDelayed:     true,
    source:        "polygon-prev",
    fetchedAt:     Date.now(),
  };
}

// ── Core fetch with fallback ──────────────────────────────────

async function fetchQuoteWithFallback(ticker: string): Promise<YahooQuote> {
  // 1. Try Yahoo Finance
  try {
    return await fetchYahooQuote(ticker);
  } catch (yahooErr: any) {
    log.warn(`[Yahoo Proxy] Yahoo failed for ${ticker}: ${yahooErr?.message} — trying Polygon fallback`);
  }

  // 2. Try Polygon prev-close
  try {
    const q = await fetchPolygonPrevClose(ticker);
    log.info(`[Yahoo Proxy] Polygon fallback succeeded for ${ticker}`);
    return q;
  } catch (polyErr: any) {
    log.warn(`[Yahoo Proxy] Polygon fallback also failed for ${ticker}: ${polyErr?.message}`);
    captureError(polyErr as Error, { source: "yahooProxy", ticker, stage: "both_sources_failed" }).catch(() => {});
  }

  // 3. Return error placeholder
  return {
    ticker: ticker.toUpperCase(),
    price: null,
    prevClose: null,
    open: null,
    high: null,
    low: null,
    volume: null,
    change: null,
    changePercent: null,
    marketState: "UNKNOWN",
    isDelayed: true,
    source: "error",
    fetchedAt: Date.now(),
    error: "Both Yahoo and Polygon failed",
  };
}

// ── Public API ────────────────────────────────────────────────

/**
 * Get a cached or fresh quote for a single ticker.
 * Falls back to Polygon prev-close if Yahoo fails.
 * Never throws — returns null fields on total failure.
 */
export async function getQuote(ticker: string): Promise<YahooQuote> {
  const upper = ticker.toUpperCase();
    const cached = quoteCache.get(upper);
  if (cached) {
    return cached;
  }
  const quote = await fetchQuoteWithFallback(upper);
  quoteCache.set(upper, quote);
  return quote;
}

/**
 * Batch fetch quotes for multiple tickers.
 * Fetches in parallel with a concurrency limit of 5.
 */
export async function getQuotes(tickers: string[]): Promise<YahooQuote[]> {
  const unique = Array.from(new Set(tickers.map(t => t.toUpperCase())));

  const CHUNK = 5;
  const results: YahooQuote[] = [];

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const chunkResults = await Promise.all(chunk.map(t => getQuote(t)));
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Clear the quote cache (useful for testing or forced refresh).
 */
export function clearQuoteCache(): void {
  quoteCache.clear();
}

/**
 * Get cache stats for health checks.
 */
export function getQuoteCacheStats(): { size: number; tickers: string[] } {
  return {
    size: quoteCache.size,
    tickers: [],
  };
}

// ── Top Stock Performers (Daily Gainers Screener) ─────────────

export interface StockPerformer {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  sector: string | null;
  avgVolume: number | null;
  source: "yahoo-screener";
  fetchedAt: number;
}

// Cache for 3 minutes — screener data doesn't change second-by-second
const performersCache = new LRUCache<string, StockPerformer[]>(4, 3 * 60_000);

/**
 * Fetch top N daily stock gainers from Yahoo Finance screener.
 * Uses the same predefined screener Yahoo Finance uses for "Top Gainers".
 * No API key required. Returns sorted by changePercent descending.
 */
export async function getTopStockPerformers(limit = 100): Promise<StockPerformer[]> {
  const cacheKey = `gainers_${limit}`;
  const cached = performersCache.get(cacheKey);
  if (cached) return cached;

  const count = Math.min(limit, 100);

  // Yahoo Finance screener — day_gainers predefined screen
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=day_gainers&count=${count}&start=0`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finance.yahoo.com/gainers/",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`Yahoo screener HTTP ${res.status}`);

    const json = await res.json() as any;
    const quotes: any[] = json?.finance?.result?.[0]?.quotes ?? [];

    if (!quotes.length) throw new Error("Empty screener response");

    const performers: StockPerformer[] = quotes
      .filter((q: any) => q.symbol && q.regularMarketChangePercent != null)
      .slice(0, count)
      .map((q: any) => ({
        ticker:        q.symbol,
        name:          q.shortName ?? q.longName ?? q.symbol,
        price:         q.regularMarketPrice ?? 0,
        change:        q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        volume:        q.regularMarketVolume ?? 0,
        marketCap:     q.marketCap ?? null,
        sector:        q.sector ?? null,
        avgVolume:     q.averageDailyVolume3Month ?? null,
        source:        "yahoo-screener" as const,
        fetchedAt:     Date.now(),
      }))
      .sort((a, b) => b.changePercent - a.changePercent);

    performersCache.set(cacheKey, performers);
    log.info(`[Yahoo Proxy] Top ${performers.length} stock performers fetched`);
    return performers;

  } catch (err: any) {
    log.warn(`[Yahoo Proxy] Screener fetch failed: ${err?.message} — falling back to Polygon gainers`);
    captureError(err as Error, { source: "yahooProxy", stage: "screener_fetch_failed" }).catch(() => {});

    // Fallback: return top gainers from the existing signals catalog via Polygon
    return getPolygonTopGainers(count);
  }
}

/**
 * Fallback: fetch top gainers from Polygon.io's snapshot endpoint.
 * Uses the /v2/snapshot/locale/us/markets/stocks/gainers endpoint.
 */
async function getPolygonTopGainers(limit: number): Promise<StockPerformer[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?include_otc=false&apiKey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Polygon gainers HTTP ${res.status}`);

    const json = await res.json() as any;
    const tickers: any[] = json?.tickers ?? [];

    return tickers
      .slice(0, limit)
      .map((t: any) => ({
        ticker:        t.ticker,
        name:          t.ticker,
        price:         t.day?.c ?? t.prevDay?.c ?? 0,
        change:        (t.day?.c ?? 0) - (t.prevDay?.c ?? 0),
        changePercent: (t.todaysChangePerc ?? 0),
        volume:        t.day?.v ?? 0,
        marketCap:     null,
        sector:        null,
        avgVolume:     null,
        source:        "yahoo-screener" as const,
        fetchedAt:     Date.now(),
      }))
      .sort((a, b) => b.changePercent - a.changePercent);

  } catch (err: any) {
    log.warn(`[Yahoo Proxy] Polygon gainers fallback also failed: ${err?.message}`);
    return [];
  }
}
