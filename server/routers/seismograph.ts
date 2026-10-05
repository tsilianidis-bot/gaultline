/**
 * Seismograph tRPC Router
 * Exposes the FAULTLINE Seismograph Intelligence Engine to the frontend.
 */

import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
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
import { desc, eq, and, notLike } from "drizzle-orm";
import { getLatestSeismographOutput, runSeismographPipeline } from "../scheduledSeismograph";
import { resolveRunContext } from "../forwardRunProvenance";
import { runSeismographBackfill, RECONSTRUCTED_RECORD_CLASS } from "../seismographBackfill";
import { getUnifiedSeismographIntelligence } from "../seismographUnified";
import { overlayAssembledSeismographOutput, overlayUnifiedSeismographIntelligence } from "../probabilityContract";
import type { CanonicalProbabilityContract } from "../../shared/probabilityContract";
import { applySeismographDisplayContext, type CanonicalDataQualityInput } from "../seismographDisplayContext";

/**
 * The stateId-bound probability contract from the authoritative canonical
 * state. Any failure returns null, which withholds every number (fail closed).
 */
async function loadProbabilityContract(): Promise<CanonicalProbabilityContract | null> {
  return (await loadCanonicalForDisplay()).contract;
}

/**
 * One read of the authoritative canonical state for the response overlays:
 * the probability contract and the input data quality. Fail closed: null.
 */
async function loadCanonicalForDisplay(): Promise<{
  contract: CanonicalProbabilityContract | null;
  dataQuality: CanonicalDataQualityInput | null;
}> {
  try {
    const { getAuthoritativeCanonicalIntelligenceState } = await import("../canonicalIntelligenceState");
    const state = await getAuthoritativeCanonicalIntelligenceState();
    if (!state) return { contract: null, dataQuality: null };
    return {
      contract: state.probabilityContract ?? null,
      dataQuality: {
        generatedAt: state.generatedAt ?? null,
        confidenceOrEvidenceQuality: state.confidenceOrEvidenceQuality ?? null,
        delayedInputs: state.delayedInputs ?? [],
        staleInputs: state.staleInputs ?? [],
        unavailableInputs: state.unavailableInputs ?? [],
        fallbackInputs: state.fallbackInputs ?? [],
        engineInputIds: Array.from(new Set(state.engines.flatMap(engine => engine.sourceInputIds ?? []))),
      },
    };
  } catch {
    return { contract: null, dataQuality: null };
  }
}

/** True only when the canonical outlook (MarketState) has a top analog. Fail closed: false. */
async function canonicalTopAnalogAvailable(): Promise<boolean> {
  try {
    const { getCanonicalMarketState } = await import("../marketStateService");
    return (await getCanonicalMarketState()).outlook.topAnalog != null;
  } catch {
    return false;
  }
}

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
      // Live daily readings only: rows reconstructed by the admin backfill are
      // tagged in subScoresJson and never presented as readings made at the time.
      return db
        .select()
        .from(seismographReadings)
        .where(notLike(seismographReadings.subScoresJson, `%${RECONSTRUCTED_RECORD_CLASS}%`))
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
    const output = await getLatestSeismographOutput();
    if (!output) return null;
    // Display context (FRED status and freshness from canonical data quality;
    // analog only when the canonical outlook has one), then the probability
    // contract overlay (null unless AVAILABLE). Calculation is unchanged.
    const [{ contract, dataQuality }, topAnalogAvailable] = await Promise.all([
      loadCanonicalForDisplay(),
      canonicalTopAnalogAvailable(),
    ]);
    const display = applySeismographDisplayContext(output, { dataQuality, canonicalTopAnalogAvailable: topAnalogAvailable });
    return overlayAssembledSeismographOutput(display, contract);
  }),

  /**
   * Seed the Seismograph on-demand by running the full pipeline immediately.
   * Use this when no daily readings exist yet (first run / new deployment).
   * This is the same pipeline the Heartbeat job runs daily at market close.
   */
  seedNow: adminProcedure.mutation(async () => {
    // MANUAL run: recorded as its own state; never captures Champion provenance/outcomes.
    const output = await runSeismographPipeline({ runContext: resolveRunContext("admin-seedNow") });
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
  backfillHistory: adminProcedure.mutation(async () => {
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
    try {
      const intel = await getUnifiedSeismographIntelligence();
      // Probability contract: bull/neutral/bear, the retired 5-way split and the
      // transition components are overlaid before returning (null unless the
      // contract claim is AVAILABLE). How they are calculated is unchanged.
      return overlayUnifiedSeismographIntelligence(intel, await loadProbabilityContract());
    } catch (err) {
      // Return null so the client renders an empty-state instead of crashing
      console.warn('[SeismographRouter] getUnifiedIntelligence failed — no historical data yet:', err);
      return null;
    }
  }),

  /**
   * Manually trigger a pattern analysis run (admin use).
   */
  triggerPatternAnalysis: adminProcedure.mutation(async () => {
    try {
      await runPatternAnalysis();
      return { success: true };
    } catch (err) {
      console.error('[SeismographRouter] triggerPatternAnalysis failed:', err);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Pattern analysis failed', cause: err });
    }
  }),
});
