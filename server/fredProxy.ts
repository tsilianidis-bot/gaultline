// ============================================================
// FAULTLINE — FRED HTTP Route  (server/fredProxy.ts)
//
// Thin Express wrapper around the shared fredClient module.
// All fetch logic, caching, retry, and key handling live in
// server/fredClient.ts — this file only wires HTTP routes.
//
// Endpoints:
//   GET  /api/fred          — single series
//   POST /api/fred/bulk     — multiple series
//   POST /api/fred/clear-cache
// ============================================================

import type { Express, Request, Response } from "express";
import { fetchFredSeries, fetchFredBulk, clearFredCache } from "./fredClient";
import { log } from "./logger";
import { captureError } from "./errorTracking";

export function registerFredProxy(app: Express) {
  // ── GET /api/fred — single series ──────────────────────────
  app.get("/api/fred", async (req: Request, res: Response) => {
    const seriesId = req.query.series_id as string;
    const limit = parseInt((req.query.limit as string) ?? "2", 10);
    const sortOrder = (req.query.sort_order as string) ?? "desc";

    if (!seriesId) {
      res.status(400).json({ error: "series_id is required" });
      return;
    }

    try {
      const result = await fetchFredSeries(seriesId, limit, sortOrder);

      if (result.error) {
        log.error(`[FRED Proxy] ${seriesId}: ${result.error}`);
        captureError(new Error(result.error), { source: "fredProxy", seriesId }).catch(() => {});
        res.status(502).json({ error: "Failed to fetch from FRED API" });
        return;
      }

      res.setHeader("X-Cache", result.cached ? "HIT" : "MISS");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json({ observations: result.observations });
    } catch (err) {
      log.error(`[FRED Proxy] Unexpected error for ${seriesId}`, { err: err as Error });
      captureError(err as Error, { source: "fredProxy", seriesId }).catch(() => {});
      res.status(502).json({ error: "Failed to fetch from FRED API" });
    }
  });

  // ── POST /api/fred/bulk — multiple series ──────────────────
  app.post("/api/fred/bulk", async (req: Request, res: Response) => {
    const { series } = req.body as { series: Array<{ id: string; limit: number }> };

    if (!Array.isArray(series) || series.length === 0) {
      res.status(400).json({ error: "series array is required" });
      return;
    }

    try {
      const bulk = await fetchFredBulk(series);
      res.json(bulk);
    } catch (err) {
      log.error("[FRED Proxy] Bulk fetch unexpected error", { err: err as Error });
      res.status(502).json({ error: "Bulk FRED fetch failed" });
    }
  });

  // ── POST /api/fred/clear-cache ─────────────────────────────
  app.post("/api/fred/clear-cache", (_req: Request, res: Response) => {
    clearFredCache();
    res.json({ success: true, message: "FRED cache cleared" });
  });

  log.info("[FRED Proxy] Routes registered: GET /api/fred, POST /api/fred/bulk, POST /api/fred/clear-cache");
}
