/**
 * Seismograph tRPC Router
 * Exposes the FAULTLINE Seismograph Intelligence Engine to the frontend.
 */

import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getSeismographState,
  recordSeismographReading,
  runPatternAnalysis,
  memoryGet,
  memoryGetJson,
} from "../seismographEngine";
import { getDb } from "../db";
import {
  seismographReadings,
  seismographPatterns,
  seismographTransitions,
  marketMemory,
} from "../../drizzle/schema";
import { desc, eq, and } from "drizzle-orm";
import { getLatestSeismographOutput, runSeismographPipeline } from "../scheduledSeismograph";
import { runSeismographBackfill } from "../seismographBackfill";
import { getUnifiedSeismographIntelligence } from "../seismographUnified";

export const seismographRouter = router({
  /**
   * Get the full current Seismograph state.
   * Returns null if no readings have been recorded yet.
   */
  getState: publicProcedure.query(async () => {
    return getSeismographState();
  }),

  /**
   * Get recent daily readings (up to 90 days).
   */
  getReadingHistory: publicProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(seismographReadings)
        .orderBy(desc(seismographReadings.readingDate))
        .limit(input.days);
    }),

  /**
   * Get active patterns detected today.
   */
  getActivePatterns: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const today = new Date().toISOString().split("T")[0];
    return db
      .select()
      .from(seismographPatterns)
      .where(
        and(
          eq(seismographPatterns.isActive, true),
          eq(seismographPatterns.detectedAt, today)
        )
      )
      .orderBy(desc(seismographPatterns.confidence));
  }),

  /**
   * Get recent regime transitions.
   */
  getRegimeTransitions: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(seismographTransitions)
        .orderBy(desc(seismographTransitions.transitionDate))
        .limit(input.limit);
    }),

  /**
   * Get the Market Memory store (all keys).
   */
  getMarketMemory: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(marketMemory)
      .orderBy(desc(marketMemory.updatedAt));
  }),

  /**
   * Get a specific Market Memory value by key.
   */
  getMemoryKey: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      return memoryGet(input.key);
    }),

  /**
   * Get the fully assembled SeismographOutput (the canonical Market OS output).
   * This is what all consumer surfaces (dashboard, ASHA, stock pages, crypto pages) should read.
   * Returns null if no daily job has run yet.
   */
  getAssembledOutput: publicProcedure.query(async () => {
    return getLatestSeismographOutput();
  }),

  /**
   * Seed the Seismograph on-demand by running the full pipeline immediately.
   * Use this when no daily readings exist yet (first run / new deployment).
   * This is the same pipeline the Heartbeat job runs daily at market close.
   */
  seedNow: publicProcedure.mutation(async () => {
    const output = await runSeismographPipeline();
    return {
      success: true,
      pressureScore: output.pressureScore,
      regime: output.regime,
      stressLevel: output.stressLevel,
      direction: output.direction,
      evidenceConsensus: output.evidenceConsensus,
      activePatterns: output.activePatterns.length,
    };
  }),

  /**
   * Backfill seismograph readings from pressureHistory (317 months of data).
   * Safe to call multiple times — uses ON DUPLICATE KEY UPDATE.
   */
  backfillHistory: publicProcedure.mutation(async () => {
    const result = await runSeismographBackfill();
    return result;
  }),

  /**
   * Get unified seismograph intelligence synthesized from ALL historical data.
   * Primary data source for the Seismograph Intelligence page.
   * Consumes pressureHistory (317+ months), pressureRuns, dailyReadingSnapshots,
   * and the latest assembled SeismographOutput.
   * Never returns placeholder states — always has full institutional memory.
   */
  getUnifiedIntelligence: publicProcedure.query(async () => {
    return getUnifiedSeismographIntelligence();
  }),

  /**
   * Manually trigger a pattern analysis run (admin use).
   */
  triggerPatternAnalysis: publicProcedure.mutation(async () => {
    await runPatternAnalysis();
    return { success: true };
  }),
});
