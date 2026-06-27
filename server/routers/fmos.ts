// ============================================================
// FMOS — Universal Intelligence Pipeline tRPC Router
// server/routers/fmos.ts
//
// Exposes the FMOS pipeline as tRPC procedures.
// ============================================================

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  runFMOSPipeline,
  runFMOSPipelineFast,
  FMOS_VERSION,
} from "../fmos/pipeline";
import {
  computeCalibrationMetrics,
  computeBrierScore,
  generateCalibrationChartData,
  type PressureRunRecord,
} from "../fmos/engines/calibration";
import {
  computeLearningInsights,
} from "../fmos/engines/learning";
import { getDb } from "../db";
import { pressureRuns } from "../../drizzle/schema";
import { desc, gte, sql } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────

function sanitizeNumbers(v: unknown): unknown {
  if (typeof v === "number") return isFinite(v) && !isNaN(v) ? v : 0;
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(sanitizeNumbers);
  if (typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, sanitizeNumbers(val)])
    );
  }
  return v;
}

// ── Router ────────────────────────────────────────────────────

export const fmosRouter = router({
  /**
   * Run the full FMOS Universal Intelligence Pipeline.
   * Returns all 14 engine outputs in a single response.
   * Includes AI interpretation (slower — ~5-15s).
   */
  runPipeline: publicProcedure
    .input(z.object({
      symbol: z.string().min(1).max(20).toUpperCase().optional(),
      skipAIInterpretation: z.boolean().default(false),
    }).optional())
    .query(async ({ input }) => {
      try {
        const options = {
          symbol: input?.symbol,
          skipAIInterpretation: input?.skipAIInterpretation ?? false,
        };
        const result = input?.skipAIInterpretation
          ? await runFMOSPipelineFast(options)
          : await runFMOSPipeline(options);
        return sanitizeNumbers(result) as typeof result;
      } catch (err) {
        console.error("[fmos.runPipeline] Error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "FMOS pipeline unavailable. Market data may be temporarily unavailable.",
        });
      }
    }),

  /**
   * Run the FMOS pipeline without AI interpretation (faster).
   * Returns all engine outputs except AI narrative.
   * Typical latency: 2-5s.
   */
  runPipelineFast: publicProcedure
    .input(z.object({
      symbol: z.string().min(1).max(20).toUpperCase().optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const result = await runFMOSPipelineFast({ symbol: input?.symbol });
        return sanitizeNumbers(result) as typeof result;
      } catch (err) {
        console.error("[fmos.runPipelineFast] Error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "FMOS pipeline unavailable.",
        });
      }
    }),

  /**
   * Get FMOS engine version and metadata.
   */
  getVersion: publicProcedure
    .query(() => ({
      version: FMOS_VERSION,
      engines: [
        "DataAcquisition",
        "MarketDNA",
        "MarketWeather",
        "Regime",
        "Transition",
        "Evidence",
        "Probability",
        "Confidence",
        "HistoricalAnalog",
        "Decision",
        "AIInterpretation",
        "Calibration",
        "Learning",
        "UniversalPipeline",
      ],
      engineCount: 14,
      buildDate: new Date().toISOString(),
    })),

  /**
   * Validation Lab — Calibration metrics for FMOS predictions.
   * Computes Brier score, calibration error, accuracy metrics.
   * Requires historical pressureRuns data.
   */
  getCalibrationMetrics: publicProcedure
    .input(z.object({
      days: z.number().int().min(7).max(365).default(90),
    }).optional())
    .query(async ({ input }) => {
      try {
        const days = input?.days ?? 90;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const db = await getDb();
        if (!db) return { available: false, reason: "Database unavailable.", sampleSize: 0, days };

        const runs = await db
          .select()
          .from(pressureRuns)
          .where(gte(pressureRuns.computedAt, cutoff))
          .orderBy(desc(pressureRuns.computedAt))
          .limit(500);

        if (runs.length < 5) {
          return {
            available: false,
            reason: "Insufficient historical data. At least 5 pressure runs required.",
            sampleSize: runs.length,
            days,
          };
        }

        // Map DB rows to PressureRunRecord format
        const records: PressureRunRecord[] = runs.map(r => ({
          id: r.id,
          overallPressure: r.overallPressure,
          regime: r.regime,
          snapshotAt: r.computedAt,
          engineVersion: r.engineVersion,
        }));

        // Build Brier score forecasts from consecutive runs
        const forecasts: Array<{ probability: number; outcome: 0 | 1 }> = [];
        for (let i = 0; i < records.length - 1; i++) {
          const current = records[i]!;
          const next = records[i + 1]!;
          const predictedBull = current.bullProbability ?? (100 - current.overallPressure);
          const actualBull: 0 | 1 = next.overallPressure < 50 ? 1 : 0;
          forecasts.push({ probability: predictedBull / 100, outcome: actualBull });
        }

        const brierScore = computeBrierScore(forecasts);
        const metrics = computeCalibrationMetrics(records, []);
        const chartData = generateCalibrationChartData(records);

        return sanitizeNumbers({
          available: true,
          sampleSize: records.length,
          days,
          brierScore,
          metrics,
          chartData,
        });
      } catch (err) {
        console.error("[fmos.getCalibrationMetrics] Error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Calibration metrics unavailable.",
        });
      }
    }),

  /**
   * Validation Lab — Learning insights from historical performance.
   */
  getLearningInsights: publicProcedure
    .input(z.object({
      days: z.number().int().min(7).max(365).default(90),
    }).optional())
    .query(async ({ input }) => {
      try {
        const days = input?.days ?? 90;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const db = await getDb();
        if (!db) return { available: false, reason: "Database unavailable.", sampleSize: 0 };

        const runs = await db
          .select()
          .from(pressureRuns)
          .where(gte(pressureRuns.computedAt, cutoff))
          .orderBy(desc(pressureRuns.computedAt))
          .limit(200);

        if (runs.length < 5) {
          return {
            available: false,
            reason: "Insufficient historical data.",
            sampleSize: runs.length,
          };
        }

        const records: PressureRunRecord[] = runs.map(r => ({
          id: r.id,
          overallPressure: r.overallPressure,
          regime: r.regime,
          snapshotAt: r.computedAt,
          engineVersion: r.engineVersion,
        }));

        // Build metrics first, then learning insights
        const metrics = computeCalibrationMetrics(records, []);
        const insights = computeLearningInsights(metrics, records);

        return sanitizeNumbers({
          available: true,
          sampleSize: records.length,
          days,
          insights,
        });
      } catch (err) {
        console.error("[fmos.getLearningInsights] Error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Learning insights unavailable.",
        });
      }
    }),

  /**
   * Validation Lab — Historical run statistics.
   * Aggregate stats: avg pressure, regime distribution, data source breakdown.
   */
  getRunStats: publicProcedure
    .input(z.object({
      days: z.number().int().min(7).max(365).default(30),
    }).optional())
    .query(async ({ input }) => {
      try {
        const days = input?.days ?? 30;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const db = await getDb();
        if (!db) return sanitizeNumbers({ totalRuns: 0, periodRuns: 0, days, avgPressure: 0, regimeDistribution: {}, dataSourceBreakdown: { live: 0, fallback: 0, livePercent: 0 }, latestRun: null });

        const [countResult, recentRuns] = await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(pressureRuns),
          db
            .select()
            .from(pressureRuns)
            .where(gte(pressureRuns.computedAt, cutoff))
            .orderBy(desc(pressureRuns.computedAt))
            .limit(100),
        ]);

        const totalRuns = Number(countResult[0]?.count ?? 0);

        // Regime distribution
        const regimeCounts: Record<string, number> = {};
        let avgPressure = 0;
        let liveCount = 0;
        let fallbackCount = 0;

        for (const run of recentRuns) {
          const regime = run.regime ?? "Unknown";
          regimeCounts[regime] = (regimeCounts[regime] ?? 0) + 1;
          avgPressure += run.overallPressure ?? 0;
          if (run.dataSource === "live") liveCount++;
          else fallbackCount++;
        }

        avgPressure = recentRuns.length > 0 ? avgPressure / recentRuns.length : 0;

        return sanitizeNumbers({
          totalRuns,
          periodRuns: recentRuns.length,
          days,
          avgPressure: Math.round(avgPressure * 10) / 10,
          regimeDistribution: regimeCounts,
          dataSourceBreakdown: {
            live: liveCount,
            fallback: fallbackCount,
            livePercent: recentRuns.length > 0 ? Math.round(liveCount / recentRuns.length * 100) : 0,
          },
          latestRun: recentRuns[0] ? {
            computedAt: recentRuns[0].computedAt,
            overallPressure: recentRuns[0].overallPressure,
            regime: recentRuns[0].regime,
            dataSource: recentRuns[0].dataSource,
          } : null,
        });
      } catch (err) {
        console.error("[fmos.getRunStats] Error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Run statistics unavailable.",
        });
      }
    }),

  /**
   * Admin: clear FMOS caches (forces fresh computation on next request).
   */
  clearCaches: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      // Pipeline is stateless — no caches to clear currently
      return { success: true, message: "FMOS pipeline is stateless; no caches to clear." };
    }),
});
