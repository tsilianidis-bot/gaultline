// ============================================================
// FAULTLINE — Shared FRED Client  (server/fredClient.ts)
//
// Single canonical implementation for fetching FRED series.
// Used by both the HTTP proxy route (/api/fred/bulk) and the
// pressure engine directly — no localhost self-calls.
//
// Design:
//  • API key read from FRED_API_KEY env var (never hardcoded)
//  • Startup validation: logs a clear warning if key is absent
//  • Per-series retry with exponential backoff (non-retryable 4xx)
//  • In-process LRU cache (15-min TTL, 200 entries)
//  • In-flight deduplication: concurrent requests for the same
//    series share a single upstream fetch
//  • Zero HTTP self-calls — engine imports this module directly
// ============================================================

import { LRUCache } from "./lruCache";
import { log } from "./logger";

// ── API key ──────────────────────────────────────────────────

/**
 * Returns the FRED API key from the environment.
 * Logs a startup warning once if the key is missing.
 */
let _keyWarningLogged = false;
export function getFredApiKey(): string {
  const key = process.env.FRED_API_KEY ?? "";
  if (!key && !_keyWarningLogged) {
    _keyWarningLogged = true;
    log.warn(
      "[FRED Client] FRED_API_KEY environment variable is not set. " +
      "FRED requests will fail. Set FRED_API_KEY in your environment " +
      "or via the Manus secrets panel."
    );
  }
  return key;
}

// ── Types ────────────────────────────────────────────────────

export interface FredObservation {
  date: string;
  value: string;
}

export interface FredSeriesResult {
  observations: FredObservation[];
  cached: boolean;
  error?: string;
}

export interface FredBulkResult {
  results: Record<string, FredSeriesResult>;
  timestamp: string;
}

// ── Cache ────────────────────────────────────────────────────

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const fredCache = new LRUCache<string, FredBulkResult["results"][string]>(200, CACHE_TTL_MS);

// ── In-flight deduplication ──────────────────────────────────

const inFlight = new Map<string, Promise<FredSeriesResult>>();

// ── Helpers ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Core fetch ───────────────────────────────────────────────

/**
 * Fetch a single FRED series with retry + backoff.
 * Returns a FredSeriesResult (never throws).
 */
async function fetchOneSeries(
  seriesId: string,
  limit: number,
  sortOrder = "desc",
  maxAttempts = 2
): Promise<FredSeriesResult> {
  const apiKey = getFredApiKey();
  if (!apiKey) {
    return { observations: [], cached: false, error: "FRED_API_KEY not configured" };
  }

  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", sortOrder);
  url.searchParams.set("limit", String(limit));

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        const errMsg = `HTTP ${res.status}`;
        log.warn(`[FRED Client] ${seriesId} attempt ${attempt}/${maxAttempts}: ${errMsg}`);
        lastErr = new Error(errMsg);
        // 4xx = non-retryable (bad series ID, auth failure, etc.)
        if (res.status >= 400 && res.status < 500) {
          return { observations: [], cached: false, error: errMsg };
        }
        if (attempt < maxAttempts) await sleep(500 * attempt);
        continue;
      }

      const data = await res.json() as { observations: FredObservation[] };

      if (!data.observations || data.observations.length === 0) {
        log.warn(`[FRED Client] ${seriesId}: observations array is empty (series may have no recent data)`);
        return { observations: [], cached: false, error: "empty observations" };
      }

      return { observations: data.observations, cached: false };
    } catch (err) {
      lastErr = err;
      log.warn(`[FRED Client] ${seriesId} attempt ${attempt}/${maxAttempts} failed`, { err: err as Error });
      if (attempt < maxAttempts) await sleep(500 * attempt);
    }
  }

  const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  return { observations: [], cached: false, error: errMsg };
}

// ── Public API ───────────────────────────────────────────────

/**
 * Fetch a single FRED series, with cache and in-flight dedup.
 */
export async function fetchFredSeries(
  seriesId: string,
  limit: number,
  sortOrder = "desc"
): Promise<FredSeriesResult> {
  const cacheKey = `${seriesId}:${limit}:${sortOrder}`;

  // Cache hit
  const cached = fredCache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  // In-flight dedup: if another request is already fetching this key, share it
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = fetchOneSeries(seriesId, limit, sortOrder).then(result => {
    inFlight.delete(cacheKey);
    if (!result.error) {
      fredCache.set(cacheKey, result);
    }
    return result;
  });

  inFlight.set(cacheKey, promise);
  return promise;
}

/**
 * Fetch multiple FRED series concurrently.
 * Returns a FredBulkResult — same shape as the old HTTP response.
 * Never throws; failed series are recorded in result.error.
 */
export async function fetchFredBulk(
  series: Array<{ id: string; limit: number; sortOrder?: string }>
): Promise<FredBulkResult> {
  const entries = await Promise.allSettled(
    series.map(async ({ id, limit, sortOrder = "desc" }) => {
      const result = await fetchFredSeries(id, limit, sortOrder);
      return { id, result };
    })
  );

  const results: FredBulkResult["results"] = {};
  for (const entry of entries) {
    if (entry.status === "fulfilled") {
      results[entry.value.id] = entry.value.result;
    }
    // rejected should never happen because fetchFredSeries never throws
  }

  // Log a summary of failures
  const failed = Object.entries(results)
    .filter(([, v]) => v.error)
    .map(([id, v]) => `${id}(${v.error})`);
  if (failed.length > 0) {
    log.warn(`[FRED Client] Bulk: ${failed.length}/${series.length} series failed: ${failed.join(", ")}`);
  }

  return { results, timestamp: new Date().toISOString() };
}

/**
 * Clear the in-process FRED cache (used by the admin clear-cache endpoint).
 */
export function clearFredCache(): void {
  fredCache.clear();
}
