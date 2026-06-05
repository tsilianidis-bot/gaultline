// ============================================================
// FAULTLINE — Signals Proxy Server Route
//
// Fetches live market data from Polygon.io server-side.
// The API key NEVER leaves the server — not in responses,
// not in logs, not in headers forwarded to the client.
//
// Strategy (free-plan compatible, 5 req/min):
//   Phase 1 (immediate): Grouped daily aggs for close/volume/OHLC
//                        Previous day grouped for change% calculation
//   Phase 2 (background): Per-ticker 5-day range for sparklines
//                         Fetched in batches of 3 with delays
//                         Stored in a separate sparkline cache
//
// Endpoints:
//   GET /api/signals/quotes          — live quotes for all priority tickers
//   GET /api/signals/health          — health/cache status
//   POST /api/signals/clear-cache    — clear quote cache
// ============================================================
import { log } from "./logger";
import type { Express, Request, Response } from "express";
import { getQuote as getYahooQuote, getQuotes as getYahooQuotes } from "./yahooProxy";

const POLYGON_BASE = "https://api.polygon.io";

// Priority tickers for FAULTLINE Signals tab
const PRIORITY_TICKERS = [
  "NVDA", "MSFT", "META", "AMZN", "GOOGL",
  "TSLA", "PLTR", "QUBT", "IONQ", "RGTI",
  "FRMI", "AMD", "SMCI", "SOFI", "JPM",
  "XLF", "XLK", "SPY", "QQQ", "SPCE",
];

// ── Types ─────────────────────────────────────────────────────
export interface QuoteResult {
  ticker: string;
  price: number;           // latest close price
  open: number;            // day open
  high: number;            // day high
  low: number;             // day low
  changePercent: number;   // % change vs prior close
  volume: number;          // shares (raw)
  volumeMillions: number;  // volume in millions for display
  timestamp: number;       // Unix ms of the bar
  marketStatus: "open" | "closed" | "extended" | "unknown";
  isLive: boolean;
  sparkline: number[];     // 5-day close prices normalized to % change from first
}

interface PolygonAggBar {
  T?: string;  // ticker
  v?: number;  // volume
  vw?: number; // volume-weighted avg price
  o?: number;  // open
  c?: number;  // close
  h?: number;  // high
  l?: number;  // low
  t?: number;  // timestamp ms
  n?: number;  // number of transactions
}

interface PolygonGroupedResponse {
  status?: string;
  resultsCount?: number;
  results?: PolygonAggBar[];
}

interface PolygonRangeResponse {
  status?: string;
  resultsCount?: number;
  results?: PolygonAggBar[];
  ticker?: string;
}

// ── In-memory caches ──────────────────────────────────────────
interface CacheEntry {
  quotes: QuoteResult[];
  fetchedAt: number;
  marketStatus: string;
  tradeDate: string;
}

let quotesCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Full grouped daily bar maps — populated when quotes are fetched.
// Allows any ticker search to be served instantly from the grouped data
// without making additional Polygon.io API calls.
let fullBarMap: Map<string, PolygonAggBar> | null = null;
let fullPrevBarMap: Map<string, PolygonAggBar> | null = null;
let fullBarMapTradeDate: string | null = null;

// Sparkline cache (longer TTL — 5-day bars don't change intraday)
const sparklineCache = new Map<string, number[]>();
let sparklineFetchedAt: number | null = null;
let sparklineFetchInProgress = false;
const SPARKLINE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Date helpers ──────────────────────────────────────────────
/**
 * US stock market holidays (NYSE/NASDAQ) — fixed + observed dates.
 * Covers 2024–2028. Add years as needed.
 */
const US_MARKET_HOLIDAYS = new Set([
  // 2024
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-03-29', '2024-05-27',
  '2024-06-19', '2024-07-04', '2024-09-02', '2024-11-28', '2024-12-25',
  // 2025
  '2025-01-01', '2025-01-09', '2025-01-20', '2025-02-17', '2025-04-18',
  '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27',
  '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
  // 2028
  '2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29',
  '2028-06-19', '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25',
]);

/** Returns true if the given YYYY-MM-DD date is a US market holiday or weekend */
function isNonTradingDay(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6 || US_MARKET_HOLIDAYS.has(dateStr);
}

/** Get the most recent COMPLETED trading day.
 * Polygon free plan only provides grouped data for completed sessions.
 * Skips weekends AND US market holidays.
 */
function getLastTradingDate(): string {
  const now = new Date();
  const d = new Date(now.getTime());
  // Always go back at least 1 day to get a completed session
  d.setUTCDate(d.getUTCDate() - 1);
  // Skip weekends and US holidays
  while (isNonTradingDay(d.toISOString().slice(0, 10))) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Get date N trading days before a given date string */
function getNTradingDaysBefore(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  let count = 0;
  while (count < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    const s = d.toISOString().slice(0, 10);
    if (!isNonTradingDay(s)) count++;
  }
  return d.toISOString().slice(0, 10);
}

// ── Retry helper ──────────────────────────────────────────────
async function fetchWithRetry(url: string, maxAttempts = 3, timeoutMs = 8000): Promise<globalThis.Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      if (res.status === 429) {
        // Rate limited — wait before retry
        await new Promise(r => setTimeout(r, attempt * 2000));
        continue;
      }
      // Non-retryable error
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, attempt * 500));
      }
    }
  }
  throw lastError ?? new Error("Unknown fetch error");
}

// ── Market status ─────────────────────────────────────────────
function deriveMarketStatus(tradeDate: string): QuoteResult["marketStatus"] {
  const today = new Date().toISOString().slice(0, 10);
  if (tradeDate === today) {
    const utcHour = new Date().getUTCHours();
    if (utcHour >= 14 && utcHour < 21) return "open";
    if ((utcHour >= 10 && utcHour < 14) || utcHour >= 21) return "extended";
    return "closed";
  }
  return "closed";
}

// ── Sparkline helpers ─────────────────────────────────────────
function buildSparkline(closes: number[]): number[] {
  if (closes.length === 0) return [];
  const base = closes[0];
  if (base === 0) return closes.map(() => 0);
  return closes.map(c => parseFloat(((c - base) / base * 100).toFixed(2)));
}

/** Fetch sparklines in background (rate-limit-aware batching).
 * Does NOT block the main quotes response.
 */
async function fetchSparklinesBg(apiKey: string, tradeDate: string): Promise<void> {
  if (sparklineFetchInProgress) return;
  sparklineFetchInProgress = true;

  const sparklineFrom = getNTradingDaysBefore(tradeDate, 5);
  const BATCH_SIZE = 3;
  const BATCH_DELAY_MS = 14000; // 14s between batches → ~3 req/min per batch

  log.info(`[Signals Proxy] Background sparkline fetch started (${PRIORITY_TICKERS.length} tickers)`);

  try {
    for (let i = 0; i < PRIORITY_TICKERS.length; i += BATCH_SIZE) {
      const batch = PRIORITY_TICKERS.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async ticker => {
          try {
            const url = `${POLYGON_BASE}/v2/aggs/ticker/${ticker}/range/1/day/${sparklineFrom}/${tradeDate}?adjusted=true&sort=asc&apiKey=${apiKey}`;
            const res = await fetchWithRetry(url, 2);
            const data = await res.json() as unknown as PolygonRangeResponse;
            if (data.results && Array.isArray(data.results)) {
              const closes = data.results.map(r => r.c ?? 0);
              sparklineCache.set(ticker, buildSparkline(closes));
            }
          } catch {
            // Non-fatal — sparkline failure just means no chart
          }
        })
      );
      if (i + BATCH_SIZE < PRIORITY_TICKERS.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }
    sparklineFetchedAt = Date.now();
    // background sparkline fetch complete

    // Merge sparklines into the quotes cache if it's still fresh
    if (quotesCache && Date.now() - quotesCache.fetchedAt < CACHE_TTL_MS) {
      quotesCache.quotes = quotesCache.quotes.map(q => ({
        ...q,
        sparkline: sparklineCache.get(q.ticker) ?? q.sparkline,
      }));
    }
  } finally {
    sparklineFetchInProgress = false;
  }
}

// ── Fallback data ─────────────────────────────────────────────
function buildFallbackQuotes(): QuoteResult[] {
  return PRIORITY_TICKERS.map(ticker => ({
    ticker,
    price: 0, open: 0, high: 0, low: 0,
    changePercent: 0,
    volume: 0, volumeMillions: 0,
    timestamp: Date.now(),
    marketStatus: "unknown" as const,
    isLive: false,
    sparkline: sparklineCache.get(ticker) ?? [],
  }));
}

// ── Core fetch logic (Phase 1 only — prices + volume) ────────
async function fetchLiveQuotes(apiKey: string): Promise<{ quotes: QuoteResult[]; tradeDate: string }> {
  // ── Step 1: Always fetch Polygon grouped bars for sparklines + fallback prices ──
  // Try up to 5 trading days back — Polygon free tier can lag 1-2 days
  // and holidays may cause empty grouped results.
  let tradeDate = getLastTradingDate();
  let groupedData: PolygonGroupedResponse | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const url = `${POLYGON_BASE}/v2/aggs/grouped/locale/us/market/stocks/${tradeDate}?adjusted=true&apiKey=${apiKey}`;
    const res = await fetchWithRetry(url);
    const data = await res.json() as unknown as PolygonGroupedResponse;
    if (data.results && Array.isArray(data.results) && data.results.length > 100) {
      groupedData = data;
      break;
    }
    // Empty or too sparse — go back one more trading day
    tradeDate = getNTradingDaysBefore(tradeDate, 1);
  }

  if (!groupedData || !groupedData.results) {
    throw new Error('Grouped aggs returned no data after 5 attempts');
  }

  const prevDate = getNTradingDaysBefore(tradeDate, 1);

  // Build a map of ticker → bar (store globally so any ticker search can use it)
  const barMap = new Map<string, PolygonAggBar>();
  for (const bar of groupedData.results) {
    if (bar.T) barMap.set(bar.T, bar);
  }
  fullBarMap = barMap;
  fullBarMapTradeDate = tradeDate;

  // Fetch previous day grouped for change% calculation (fallback path)
  const prevGroupedUrl = `${POLYGON_BASE}/v2/aggs/grouped/locale/us/market/stocks/${prevDate}?adjusted=true&apiKey=${apiKey}`;
  const prevGroupedRes = await fetchWithRetry(prevGroupedUrl);
  const prevGroupedData = await prevGroupedRes.json() as unknown as PolygonGroupedResponse;

  const prevBarMap = new Map<string, PolygonAggBar>();
  if (prevGroupedData.results && Array.isArray(prevGroupedData.results)) {
    for (const bar of prevGroupedData.results) {
      if (bar.T) prevBarMap.set(bar.T, bar);
    }
  }
  fullPrevBarMap = prevBarMap;

  // ── Step 2: Try Yahoo Finance for live prices during market hours ──
  // Yahoo provides real-time intraday prices (60s cache TTL) for REGULAR/PRE/POST sessions.
  // We batch-fetch all priority tickers and overlay Yahoo data on top of Polygon bars.
  const today = new Date().toISOString().slice(0, 10);
  let yahooMap = new Map<string, import("./yahooProxy").YahooQuote>();
  let yahooSucceeded = false;
  try {
    const yahooQuotes = await getYahooQuotes(PRIORITY_TICKERS);
    for (const q of yahooQuotes) {
      if (q && q.price !== null && q.source !== "error") {
        yahooMap.set(q.ticker, q);
      }
    }
    yahooSucceeded = yahooMap.size > 0;
  } catch (err) {
    log.warn("[Signals Proxy] Yahoo Finance bulk fetch failed, falling back to Polygon", { err });
  }

  // ── Step 3: Assemble quotes — Yahoo prices when live, Polygon as fallback ──
  const quotes: QuoteResult[] = PRIORITY_TICKERS.map(ticker => {
    const bar = barMap.get(ticker);
    const prevBar = prevBarMap.get(ticker);
    const yahooQ = yahooMap.get(ticker);

    // Determine if Yahoo has a live/extended price for this ticker
    const yahooIsLive = yahooQ != null &&
      yahooQ.price !== null &&
      (yahooQ.marketState === "REGULAR" || yahooQ.marketState === "PRE" ||
       yahooQ.marketState === "POST" || yahooQ.marketState === "PREPRE" ||
       yahooQ.marketState === "POSTPOST");

    if (yahooIsLive && yahooQ && yahooQ.price !== null) {
      // ── Yahoo live path ──
      const price = yahooQ.price;
      const prevClose = yahooQ.prevClose ?? bar?.c ?? 0;
      const change = yahooQ.change ?? (prevClose > 0 ? price - prevClose : 0);
      const changePercent = yahooQ.changePercent ??
        (prevClose > 0 ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(3)) : 0);
      const volumeRaw = yahooQ.volume ?? bar?.v ?? 0;
      const volumeMillions = parseFloat((volumeRaw / 1_000_000).toFixed(2));

      // Map Yahoo marketState → QuoteResult marketStatus
      let marketStatus: QuoteResult["marketStatus"];
      if (yahooQ.marketState === "REGULAR") {
        marketStatus = "open";
      } else if (yahooQ.marketState === "PRE" || yahooQ.marketState === "PREPRE" ||
                 yahooQ.marketState === "POST" || yahooQ.marketState === "POSTPOST") {
        marketStatus = "extended";
      } else {
        marketStatus = "closed";
      }

      return {
        ticker,
        price: parseFloat(price.toFixed(2)),
        open: parseFloat((yahooQ.open ?? bar?.o ?? 0).toFixed(2)),
        high: parseFloat((yahooQ.high ?? bar?.h ?? 0).toFixed(2)),
        low: parseFloat((yahooQ.low ?? bar?.l ?? 0).toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(3)),
        volume: volumeRaw,
        volumeMillions,
        timestamp: Date.now(),
        marketStatus,
        isLive: true,
        sparkline: sparklineCache.get(ticker) ?? [],
      };
    }

    // ── Polygon fallback path ──
    if (!bar) {
      return {
        ticker,
        price: 0, open: 0, high: 0, low: 0,
        changePercent: 0,
        volume: 0, volumeMillions: 0,
        timestamp: Date.now(),
        marketStatus: "unknown" as const,
        isLive: false,
        sparkline: sparklineCache.get(ticker) ?? [],
      };
    }

    const price = bar.c ?? 0;
    const prevClose = prevBar?.c ?? bar.o ?? price;
    const changePercent = prevClose > 0
      ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(3))
      : 0;

    const volumeRaw = bar.v ?? 0;
    const volumeMillions = parseFloat((volumeRaw / 1_000_000).toFixed(2));

    // Use Yahoo's marketState for status if available (even for closed market)
    let marketStatus: QuoteResult["marketStatus"];
    if (yahooQ && yahooQ.marketState === "CLOSED") {
      marketStatus = "closed";
    } else {
      marketStatus = deriveMarketStatus(tradeDate);
    }

    return {
      ticker,
      price: parseFloat(price.toFixed(2)),
      open: parseFloat((bar.o ?? 0).toFixed(2)),
      high: parseFloat((bar.h ?? 0).toFixed(2)),
      low: parseFloat((bar.l ?? 0).toFixed(2)),
      changePercent,
      volume: volumeRaw,
      volumeMillions,
      timestamp: bar.t ?? Date.now(),
      marketStatus,
      isLive: false,
      sparkline: sparklineCache.get(ticker) ?? [],
    };
  });

  // Use today's date when Yahoo succeeded (live data), otherwise use Polygon's trade date
  const effectiveTradeDate = yahooSucceeded ? today : tradeDate;
  return { quotes, tradeDate: effectiveTradeDate };
}

// ── Per-ticker cache ─────────────────────────────────────────
export interface TickerProfile {
  ticker: string;
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  changePercent: number;
  volume: number;
  volumeMillions: number;
  avgVolume: number | null;      // from reference endpoint if available
  marketCap: number | null;      // in millions
  sector: string | null;
  industry: string | null;
  description: string | null;
  sparkline: number[];           // 5-day % change from first close
  tradeDate: string;
  marketStatus: QuoteResult["marketStatus"];
  isLive: boolean;
  source: "live" | "stale" | "fallback";
}

const tickerCache = new Map<string, { profile: TickerProfile; fetchedAt: number }>();
const TICKER_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/** Validate ticker symbol: 1–5 uppercase alphanumeric chars */
function isValidTicker(symbol: string): boolean {
  return /^[A-Z]{1,5}$/.test(symbol);
}

/** Fetch a single ticker's profile — Yahoo Finance primary, Polygon fallback */
async function fetchTickerProfile(apiKey: string, symbol: string): Promise<TickerProfile> {
  const tradeDate = getLastTradingDate();
  const sparklineFrom = getNTradingDaysBefore(tradeDate, 5);

  // 1. Try Yahoo Finance first — real-time 15-min delayed price, same source as Portfolio
  let price = 0, open = 0, high = 0, low = 0, volumeRaw = 0, volumeMillions = 0, changePercent = 0;
  let yahooSucceeded = false;
  let yahooMarketState: string | null = null;
  let yahooTradeDate: string | null = null;
  try {
    const yahooQuote = await getYahooQuote(symbol);
    if (yahooQuote.price != null && yahooQuote.price > 0) {
      price = parseFloat((yahooQuote.price).toFixed(2));
      open = parseFloat((yahooQuote.open ?? yahooQuote.price).toFixed(2));
      high = parseFloat((yahooQuote.high ?? yahooQuote.price).toFixed(2));
      low = parseFloat((yahooQuote.low ?? yahooQuote.price).toFixed(2));
      volumeRaw = yahooQuote.volume ?? 0;
      volumeMillions = parseFloat((volumeRaw / 1_000_000).toFixed(2));
      changePercent = yahooQuote.changePercent != null
        ? parseFloat(yahooQuote.changePercent.toFixed(3))
        : (open > 0 ? parseFloat(((price - open) / open * 100).toFixed(3)) : 0);
      yahooMarketState = yahooQuote.marketState ?? null;
      // When Yahoo succeeds, the price is from today's session
      yahooTradeDate = new Date().toISOString().slice(0, 10);
      yahooSucceeded = true;
      log.info(`[Signals Proxy] Yahoo Finance price for ${symbol}: $${price} (${changePercent > 0 ? '+' : ''}${changePercent}%) state=${yahooMarketState}`);
    }
  } catch (yahooErr: any) {
    log.warn(`[Signals Proxy] Yahoo Finance failed for ${symbol}: ${yahooErr?.message} — falling back to Polygon`);
  }

  // 2. Polygon fallback for price/OHLC if Yahoo failed
  if (!yahooSucceeded) {
    const prevUrl = `${POLYGON_BASE}/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${apiKey}`;
    const prevRes = await fetchWithRetry(prevUrl, 2);
    const prevData = await prevRes.json() as unknown as PolygonRangeResponse;
    const bar = prevData.results?.[0];
    if (!bar) {
      throw new Error(`No data found for ticker ${symbol}`);
    }
    price = parseFloat((bar.c ?? 0).toFixed(2));
    open = parseFloat((bar.o ?? 0).toFixed(2));
    high = parseFloat((bar.h ?? 0).toFixed(2));
    low = parseFloat((bar.l ?? 0).toFixed(2));
    volumeRaw = bar.v ?? 0;
    volumeMillions = parseFloat((volumeRaw / 1_000_000).toFixed(2));
    changePercent = open > 0 ? parseFloat(((price - open) / open * 100).toFixed(3)) : 0;
  }

  // 2. Fetch 5-day sparkline (separate call — rate limit aware)
  let sparkline: number[] = [];
  try {
    const rangeUrl = `${POLYGON_BASE}/v2/aggs/ticker/${symbol}/range/1/day/${sparklineFrom}/${tradeDate}?adjusted=true&sort=asc&apiKey=${apiKey}`;
    const rangeRes = await fetchWithRetry(rangeUrl, 2);
    const rangeData = await rangeRes.json() as unknown as PolygonRangeResponse;
    if (rangeData.results && Array.isArray(rangeData.results)) {
      sparkline = buildSparkline(rangeData.results.map(r => r.c ?? 0));
    }
  } catch {
    // Non-fatal — sparkline failure just means no chart
  }

  // 3. Fetch ticker reference details (name, sector, market cap)
  let name = symbol;
  let sector: string | null = null;
  let industry: string | null = null;
  let description: string | null = null;
  let marketCap: number | null = null;

  try {
    const refUrl = `${POLYGON_BASE}/v3/reference/tickers/${symbol}?apiKey=${apiKey}`;
    const refRes = await fetchWithRetry(refUrl, 2);
    const refData = await refRes.json() as unknown as {
      results?: {
        name?: string;
        sic_description?: string;
        description?: string;
        market_cap?: number;
        primary_exchange?: string;
        type?: string;
      };
    };
    if (refData.results) {
      name = refData.results.name ?? symbol;
      sector = refData.results.sic_description ?? null;
      description = refData.results.description ?? null;
      marketCap = refData.results.market_cap
        ? parseFloat((refData.results.market_cap / 1_000_000).toFixed(0))
        : null;
    }
  } catch {
    // Non-fatal — reference data failure just means less metadata
  }

  // Determine market status: prefer Yahoo's derived state over Polygon's time-based estimate
  let marketStatus: TickerProfile["marketStatus"];
  let effectiveTradeDate: string;

  if (yahooSucceeded && yahooMarketState) {
    // Map Yahoo's marketState to our marketStatus type
    const stateMap: Record<string, TickerProfile["marketStatus"]> = {
      REGULAR: "open",
      PRE: "extended",
      PREPRE: "extended",
      POST: "extended",
      POSTPOST: "extended",
      CLOSED: "closed",
      UNKNOWN: "unknown",
    };
    marketStatus = stateMap[yahooMarketState] ?? "unknown";
    effectiveTradeDate = yahooTradeDate ?? tradeDate;
  } else {
    marketStatus = deriveMarketStatus(tradeDate);
    effectiveTradeDate = tradeDate;
  }

  return {
    ticker: symbol,
    name,
    price,
    open,
    high,
    low,
    changePercent,
    volume: volumeRaw,
    volumeMillions,
    avgVolume: null,  // not available on free plan without premium endpoint
    marketCap,
    sector,
    industry,
    description,
    sparkline,
    tradeDate: effectiveTradeDate,
    marketStatus,
    isLive: marketStatus === "open" || marketStatus === "extended",
    source: "live",
  };
}

// ── Daily bars cache ─────────────────────────────────────────
interface DailyBarsEntry {
  bars: Array<{ close: number; open: number; high: number; low: number; volume: number; timestamp: number }>;
  fetchedAt: number;
}

const dailyBarsCache = new Map<string, DailyBarsEntry>();
const DAILY_BARS_TTL_MS = 60 * 60 * 1000; // 1 hour (bars don't change intraday)

/**
 * Fetch up to `days` daily OHLC bars for a single ticker.
 * Uses the /v2/aggs/ticker/{sym}/range/1/day endpoint.
 * Returns empty array on failure (graceful degradation for free tier).
 */
async function fetchDailyBars(
  apiKey: string,
  symbol: string,
  days: number
): Promise<DailyBarsEntry["bars"]> {
  const cached = dailyBarsCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < DAILY_BARS_TTL_MS) {
    return cached.bars;
  }

  const tradeDate = getLastTradingDate();
  const fromDate = getNTradingDaysBefore(tradeDate, days + 5); // buffer for weekends
  const url = `${POLYGON_BASE}/v2/aggs/ticker/${symbol}/range/1/day/${fromDate}/${tradeDate}?adjusted=true&sort=asc&limit=${days + 10}&apiKey=${apiKey}`;

  try {
    const res = await fetchWithRetry(url, 2);
    const data = await res.json() as unknown as PolygonRangeResponse;
    if (!data.results || !Array.isArray(data.results)) return [];

    const bars = data.results.slice(-(days)).map(r => ({
      close: r.c ?? 0,
      open: r.o ?? 0,
      high: r.h ?? 0,
      low: r.l ?? 0,
      volume: r.v ?? 0,
      timestamp: r.t ?? 0,
    }));

    dailyBarsCache.set(symbol, { bars, fetchedAt: Date.now() });
    return bars;
  } catch {
    return []; // graceful fallback — signal engine will use sparkline approximations
  }
}

// ── Register Express routes ───────────────────────────────────
export function registerSignalsProxy(app: Express) {
  // GET /api/signals/quotes — fetch live quotes for all priority tickers
  app.get("/api/signals/quotes", async (_req: Request, res: Response) => {
    const apiKey = process.env.POLYGON_API_KEY;

    if (!apiKey) {
      log.error("[Signals Proxy] POLYGON_API_KEY not set");
      res.status(503).json({
        error: "Market data service not configured",
        source: "fallback",
        quotes: buildFallbackQuotes(),
        timestamp: new Date().toISOString(),
        marketStatus: "unknown",
      });
      return;
    }

    // Serve from cache if fresh
    if (quotesCache && Date.now() - quotesCache.fetchedAt < CACHE_TTL_MS) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-Age", String(Math.round((Date.now() - quotesCache.fetchedAt) / 1000)));
      res.json({
        quotes: quotesCache.quotes,
        timestamp: new Date(quotesCache.fetchedAt).toISOString(),
        marketStatus: quotesCache.marketStatus,
        tradeDate: quotesCache.tradeDate,
        source: "live",
        cached: true,
        count: quotesCache.quotes.length,
        sparklinesCached: sparklineCache.size,
      });
      return;
    }

    try {
      const { quotes, tradeDate } = await fetchLiveQuotes(apiKey);

      // Determine overall market status
      const statusCounts: Record<string, number> = {};
      for (const q of quotes) {
        statusCounts[q.marketStatus] = (statusCounts[q.marketStatus] ?? 0) + 1;
      }
      const overallStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

      // Update cache
      quotesCache = { quotes, fetchedAt: Date.now(), marketStatus: overallStatus, tradeDate };

      // Trigger background sparkline fetch if stale or missing
      const sparklineAge = sparklineFetchedAt ? Date.now() - sparklineFetchedAt : Infinity;
      if (sparklineAge > SPARKLINE_TTL_MS && !sparklineFetchInProgress) {
        // Fire and forget — don't await
        fetchSparklinesBg(apiKey, tradeDate).catch(err => {
          log.error("[Signals Proxy] Background sparkline fetch error:", err);
        });
      }

      res.setHeader("X-Cache", "MISS");
      res.json({
        quotes,
        timestamp: new Date().toISOString(),
        marketStatus: overallStatus,
        tradeDate,
        source: "live",
        cached: false,
        count: quotes.length,
        sparklinesCached: sparklineCache.size,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error("[Signals Proxy] Error fetching from Polygon.io", { errMsg });

      // Return stale cache if available, otherwise fallback
      if (quotesCache) {
        res.setHeader("X-Cache", "STALE");
        res.json({
          quotes: quotesCache.quotes,
          timestamp: new Date(quotesCache.fetchedAt).toISOString(),
          marketStatus: quotesCache.marketStatus,
          tradeDate: quotesCache.tradeDate,
          source: "stale",
          cached: true,
          error: "Using stale cache due to upstream error",
          count: quotesCache.quotes.length,
          sparklinesCached: sparklineCache.size,
        });
        return;
      }

      // Return HTTP 200 with fallback data — the service is operational,
      // just using catalog data. Callers check `source` field for data quality.
      res.setHeader("X-Cache", "FALLBACK");
      res.json({
        error: "Market data temporarily unavailable",
        source: "fallback",
        quotes: buildFallbackQuotes(),
        timestamp: new Date().toISOString(),
        marketStatus: "unknown",
        count: PRIORITY_TICKERS.length,
        sparklinesCached: sparklineCache.size,
      });
    }
  });

  // GET /api/signals/health — lightweight health check
  app.get("/api/signals/health", (_req: Request, res: Response) => {
    const apiKey = process.env.POLYGON_API_KEY;
    const cacheAge = quotesCache ? Math.round((Date.now() - quotesCache.fetchedAt) / 1000) : null;
    const sparklineAge = sparklineFetchedAt ? Math.round((Date.now() - sparklineFetchedAt) / 1000) : null;

    res.json({
      configured: !!apiKey,
      cached: !!quotesCache,
      cacheAgeSeconds: cacheAge,
      cacheFresh: cacheAge !== null && cacheAge < CACHE_TTL_MS / 1000,
      tradeDate: quotesCache?.tradeDate ?? null,
      tickers: PRIORITY_TICKERS.length,
      sparklinesCached: sparklineCache.size,
      sparklineAgeSeconds: sparklineAge,
      sparklineFetchInProgress,
    });
  });

  // POST /api/signals/clear-cache — clear quote cache
  app.post("/api/signals/clear-cache", (_req: Request, res: Response) => {
    quotesCache = null;
    sparklineCache.clear();
    sparklineFetchedAt = null;
    dailyBarsCache.clear();
    res.json({ success: true, message: "Signals quote cache cleared" });
  });

  // GET /api/signals/daily-bars?tickers=NVDA,MSFT&days=20
  // Bulk fetch of daily OHLC bars for multiple tickers (for true RSI/SMA/MACD)
  app.get("/api/signals/daily-bars", async (req: Request, res: Response) => {
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "Market data service not configured", bars: {} });
      return;
    }

    const tickersParam = (req.query.tickers as string ?? "").trim();
    const days = Math.min(parseInt(req.query.days as string ?? "20", 10) || 20, 200);

    if (!tickersParam) {
      res.status(400).json({ error: "tickers query parameter required" });
      return;
    }

    const symbols = tickersParam.split(",").map(s => s.trim().toUpperCase()).filter(isValidTicker).slice(0, 20);
    if (symbols.length === 0) {
      res.status(400).json({ error: "No valid ticker symbols provided" });
      return;
    }

    // Fetch in batches of 3 to respect rate limits on free tier
    const result: Record<string, DailyBarsEntry["bars"]> = {};
    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 1500;

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async sym => {
          result[sym] = await fetchDailyBars(apiKey, sym, days);
        })
      );
      if (i + BATCH_SIZE < symbols.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    res.json({ bars: result, days, tickers: symbols, timestamp: new Date().toISOString() });
  });

  // GET /api/signals/ticker/:symbol — fetch profile for any ticker
  app.get("/api/signals/ticker/:symbol", async (req: Request, res: Response) => {
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "Market data service not configured", source: "fallback" });
      return;
    }

    const raw = (req.params.symbol ?? "").toUpperCase().trim();
    if (!isValidTicker(raw)) {
      res.status(400).json({ error: `Invalid ticker symbol: "${raw}". Must be 1–5 uppercase letters.` });
      return;
    }

    // Serve from per-ticker cache if fresh
    const cached = tickerCache.get(raw);
    if (cached && Date.now() - cached.fetchedAt < TICKER_CACHE_TTL_MS) {
      res.setHeader("X-Cache", "HIT");
      res.json({ ...cached.profile, cached: true });
      return;
    }

    // Cross-reference the quotes cache for priority tickers (avoids extra API calls)
    if (quotesCache && PRIORITY_TICKERS.includes(raw)) {
      const qr = quotesCache.quotes.find(q => q.ticker === raw);
      if (qr) {
        const profile: TickerProfile = {
          ticker: raw,
          name: raw,  // quotes cache doesn't store name — will be enriched on next fresh fetch
          price: qr.price,
          open: qr.open,
          high: qr.high,
          low: qr.low,
          changePercent: qr.changePercent,
          volume: qr.volume,
          volumeMillions: qr.volumeMillions,
          avgVolume: null,
          marketCap: null,
          sector: null,
          industry: null,
          description: null,
          sparkline: qr.sparkline,
          tradeDate: quotesCache.tradeDate,
          marketStatus: qr.marketStatus,
          isLive: qr.isLive,
          source: "live" as const,
        };
        tickerCache.set(raw, { profile, fetchedAt: Date.now() });
        res.setHeader("X-Cache", "QUOTES-HIT");
        res.json({ ...profile, cached: false });
        return;
      }
    }

    // Check the full grouped daily barMap — populated when any quotes fetch completes.
    // This covers ALL US-listed tickers (not just the 19 priority ones) with zero extra API calls.
    // IMPORTANT: Always try Yahoo Finance first for the live/current price — grouped bar data
    // is yesterday's close and will be stale during active trading sessions.
    if (fullBarMap && fullBarMap.has(raw) && fullBarMapTradeDate) {
      // Try Yahoo Finance first for live price (same source as portfolio/priority tickers)
      try {
        const profile = await fetchTickerProfile(apiKey, raw);
        tickerCache.set(raw, { profile, fetchedAt: Date.now() });
        res.setHeader("X-Cache", "YAHOO-LIVE");
        res.json({ ...profile, cached: false });
        return;
      } catch {
        // Yahoo failed — fall through to grouped bar data as fallback
        log.warn(`[Signals Proxy] Yahoo failed for ${raw}, falling back to grouped bar data`);
      }
      // Fallback: serve from Polygon grouped bar (yesterday's close)
      const bar = fullBarMap.get(raw)!;
      const prevBar = fullPrevBarMap?.get(raw);
      const price = parseFloat((bar.c ?? 0).toFixed(2));
      const prevClose = prevBar?.c ?? bar.o ?? price;
      const changePercent = prevClose > 0
        ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(3))
        : 0;
      const volumeRaw = bar.v ?? 0;
      const marketStatus = deriveMarketStatus(fullBarMapTradeDate);
      const profile: TickerProfile = {
        ticker: raw,
        name: raw,
        price,
        open: parseFloat((bar.o ?? 0).toFixed(2)),
        high: parseFloat((bar.h ?? 0).toFixed(2)),
        low: parseFloat((bar.l ?? 0).toFixed(2)),
        changePercent,
        volume: volumeRaw,
        volumeMillions: parseFloat((volumeRaw / 1_000_000).toFixed(2)),
        avgVolume: null,
        marketCap: null,
        sector: null,
        industry: null,
        description: null,
        sparkline: sparklineCache.get(raw) ?? [],
        tradeDate: fullBarMapTradeDate,
        marketStatus,
        isLive: marketStatus === "open" || marketStatus === "extended",
        source: "live" as const,
      };
      tickerCache.set(raw, { profile, fetchedAt: Date.now() });
      res.setHeader("X-Cache", "GROUPED-FALLBACK");
      res.json({ ...profile, cached: false });
      return;
    }

    try {
      const profile = await fetchTickerProfile(apiKey, raw);
      tickerCache.set(raw, { profile, fetchedAt: Date.now() });
      res.setHeader("X-Cache", "MISS");
      res.json({ ...profile, cached: false });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error(`[Signals Proxy] Ticker lookup error for ${raw}`, { errMsg });

      // Return stale cache if available
      if (cached) {
        res.setHeader("X-Cache", "STALE");
        res.json({ ...cached.profile, source: "stale" as const, cached: true });
        return;
      }

      // Determine if it's a "not found" vs network error
      if (errMsg.includes("No data found") || errMsg.includes("HTTP 404")) {
        res.status(404).json({ error: `Ticker "${raw}" not found. Check the symbol and try again (e.g. AAPL, NVDA, TSLA).` });
      } else if (errMsg.includes("429") || errMsg.includes("rate")) {
        res.status(429).json({ error: "Polygon.io rate limit reached. Please wait a few seconds and try again.", source: "fallback" });
      } else if (errMsg.includes("timeout") || errMsg.includes("abort") || errMsg.includes("AbortError") || errMsg.includes("TimeoutError") || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"))) {
        res.status(504).json({ error: `Polygon.io is responding slowly. Please try again in a moment.`, source: "fallback" });
      } else {
        res.status(502).json({ error: `Could not fetch data for ${raw}. Please try again shortly.`, source: "fallback" });
      }
    }
  });

  // routes registered (startup log removed for production)
}
