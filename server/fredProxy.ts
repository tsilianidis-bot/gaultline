// ============================================================
// FAULTLINE — FRED Proxy Server Route
//
// Fetches FRED macroeconomic data server-side (no CORS issues)
// and returns it to the frontend. The API key stays on the server.
//
// Endpoint: GET /api/fred?series_id=DGS10&limit=2
// ============================================================
import type { Express, Request, Response } from "express";
import { LRUCache } from "./lruCache";
import { log } from "./logger";
import { captureError } from "./errorTracking";

const FRED_API_KEY = "458f0a0564e325c70e60f016f6f85f79";
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

// In-memory LRU cache per series (TTL: 15 minutes, max 200 entries)
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new LRUCache<string, unknown>(200, CACHE_TTL_MS);

// ── Retry helper ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch a FRED series with up to `maxAttempts` retries and
 * exponential backoff. Returns the parsed JSON or throws.
 */
async function fetchFredSeries(
  seriesId: string,
  limit: number,
  sortOrder = "desc",
  maxAttempts = 2
): Promise<{ observations: { date: string; value: string }[] }> {
  const url = new URL(FRED_BASE);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", FRED_API_KEY);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", sortOrder);
  url.searchParams.set("limit", String(limit));

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const fredRes = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });

      if (!fredRes.ok) {
        const errMsg = `HTTP ${fredRes.status}`;
        log.warn(`[FRED Proxy] ${seriesId} attempt ${attempt}/${maxAttempts}: ${errMsg}`);
        lastErr = new Error(errMsg);
        // 4xx errors are non-retryable (bad series ID, auth failure, etc.)
        if (fredRes.status >= 400 && fredRes.status < 500) throw lastErr;
        if (attempt < maxAttempts) await sleep(500 * attempt);
        continue;
      }

      const data = await fredRes.json() as { observations: { date: string; value: string }[] };

      // Warn if FRED returned an empty observations array — valid for new
      // series but unusual for established macro series.
      if (!data.observations || data.observations.length === 0) {
        log.warn(`[FRED Proxy] ${seriesId}: observations array is empty (series may have no recent data)`);
      }

      return data;
    } catch (err) {
      lastErr = err;
      log.warn(`[FRED Proxy] ${seriesId} attempt ${attempt}/${maxAttempts} failed`, { err: err as Error });
      if (attempt < maxAttempts) await sleep(500 * attempt);
    }
  }
  throw lastErr;
}

export function registerFredProxy(app: Express) {
  app.get("/api/fred", async (req: Request, res: Response) => {
    const seriesId = req.query.series_id as string;
    const limit = parseInt((req.query.limit as string) ?? "2", 10);
    const sortOrder = (req.query.sort_order as string) ?? "desc";

    if (!seriesId) {
      res.status(400).json({ error: "series_id is required" });
      return;
    }

    const cacheKey = `${seriesId}:${limit}:${sortOrder}`;
    const cachedEntry = cache.peek(cacheKey);
    if (cachedEntry) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-Age", String(Math.round((Date.now() - cachedEntry.fetchedAt) / 1000)));
      res.json(cachedEntry.value);
      return;
    }

    try {
      const data = await fetchFredSeries(seriesId, limit, sortOrder);
      cache.set(cacheKey, data);

      res.setHeader("X-Cache", "MISS");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json(data);
    } catch (err) {
      log.error(`[FRED Proxy] Error fetching ${seriesId} after retries`, { err: err as Error });
      captureError(err as Error, { source: "fredProxy", seriesId }).catch(() => {});
      res.status(502).json({ error: "Failed to fetch from FRED API" });
    }
  });

  // Bulk endpoint: POST /api/fred/bulk — fetch multiple series at once
  app.post("/api/fred/bulk", async (req: Request, res: Response) => {
    const { series } = req.body as { series: Array<{ id: string; limit: number }> };

    if (!Array.isArray(series) || series.length === 0) {
      res.status(400).json({ error: "series array is required" });
      return;
    }

    const results: Record<string, { observations: { date: string; value: string }[]; cached: boolean; error?: string }> = {};

    await Promise.allSettled(
      series.map(async ({ id, limit }) => {
        const cacheKey = `${id}:${limit}:desc`;
        const cachedBulk = cache.get(cacheKey);
        if (cachedBulk) {
          const d = cachedBulk as { observations: { date: string; value: string }[] };
          results[id] = { observations: d.observations ?? [], cached: true };
          return;
        }

        try {
          const data = await fetchFredSeries(id, limit, "desc");
          cache.set(cacheKey, data);

          if (!data.observations || data.observations.length === 0) {
            log.warn(`[FRED Proxy] Bulk: ${id} returned 0 observations — marking as error`);
            results[id] = { observations: [], cached: false, error: "empty observations" };
          } else {
            results[id] = { observations: data.observations, cached: false };
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error(`[FRED Proxy] Bulk: ${id} failed after retries: ${errMsg}`);
          results[id] = { observations: [], cached: false, error: errMsg };
        }
      })
    );

    // Log a summary of which series succeeded vs failed
    const failed = Object.entries(results)
      .filter(([, v]) => v.error)
      .map(([id, v]) => `${id}(${v.error})`);
    if (failed.length > 0) {
      log.warn(`[FRED Proxy] Bulk: ${failed.length}/${series.length} series failed: ${failed.join(", ")}`);
    }

    res.json({ results, timestamp: new Date().toISOString() });
  });

  // Cache clear endpoint
  app.post("/api/fred/clear-cache", (_req: Request, res: Response) => {
    cache.clear();
    res.json({ success: true, message: "FRED cache cleared" });
  });

  // routes registered (startup log removed for production)
}
