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

const FRED_API_KEY = "458f0a0564e325c70e60f016f6f85f79";
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

// In-memory LRU cache per series (TTL: 15 minutes, max 200 entries)
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new LRUCache<string, unknown>(200, CACHE_TTL_MS);

export function registerFredProxy(app: Express) {
  app.get("/api/fred", async (req: Request, res: Response) => {
    const seriesId = req.query.series_id as string;
    const limit = req.query.limit as string ?? "2";
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
      const url = new URL(FRED_BASE);
      url.searchParams.set("series_id", seriesId);
      url.searchParams.set("api_key", FRED_API_KEY);
      url.searchParams.set("file_type", "json");
      url.searchParams.set("sort_order", sortOrder);
      url.searchParams.set("limit", limit);

      const fredRes = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });

      if (!fredRes.ok) {
        log.error(`[FRED Proxy] HTTP ${fredRes.status} for ${seriesId}`);
        res.status(fredRes.status).json({ error: `FRED returned HTTP ${fredRes.status}` });
        return;
      }

      const data = await fredRes.json();
      cache.set(cacheKey, data);

      res.setHeader("X-Cache", "MISS");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json(data);
    } catch (err) {
      log.error(`[FRED Proxy] Error fetching ${seriesId}`, { err: err as Error });
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
          const url = new URL(FRED_BASE);
          url.searchParams.set("series_id", id);
          url.searchParams.set("api_key", FRED_API_KEY);
          url.searchParams.set("file_type", "json");
          url.searchParams.set("sort_order", "desc");
          url.searchParams.set("limit", String(limit));

          const fredRes = await fetch(url.toString(), {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(12000),
          });

          if (!fredRes.ok) {
            results[id] = { observations: [], cached: false, error: `HTTP ${fredRes.status}` };
            return;
          }

          const data = await fredRes.json() as { observations: { date: string; value: string }[] };
          cache.set(cacheKey, data);
          results[id] = { observations: data.observations ?? [], cached: false };
        } catch (err) {
          results[id] = { observations: [], cached: false, error: String(err) };
        }
      })
    );

    res.json({ results, timestamp: new Date().toISOString() });
  });

  // Cache clear endpoint
  app.post("/api/fred/clear-cache", (_req: Request, res: Response) => {
    cache.clear();
    res.json({ success: true, message: "FRED cache cleared" });
  });

  // routes registered (startup log removed for production)
}
