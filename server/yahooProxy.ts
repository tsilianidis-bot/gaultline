// ============================================================
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

  return {
    ticker: ticker.toUpperCase(),
    price:         meta.regularMarketPrice         ?? null,
    prevClose:     meta.previousClose              ?? meta.chartPreviousClose ?? null,
    open:          meta.regularMarketOpen          ?? null,
    high:          meta.regularMarketDayHigh       ?? null,
    low:           meta.regularMarketDayLow        ?? null,
    volume:        meta.regularMarketVolume        ?? null,
    change:        meta.regularMarketPrice != null && meta.previousClose != null
                     ? meta.regularMarketPrice - meta.previousClose
                     : null,
    changePercent: meta.regularMarketChangePercent ?? (
      meta.regularMarketPrice != null && meta.previousClose != null && meta.previousClose !== 0
        ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
        : null
    ),
    marketState:   (meta.marketState as YahooQuote["marketState"]) ?? "UNKNOWN",
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
