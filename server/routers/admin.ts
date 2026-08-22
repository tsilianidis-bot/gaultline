/**
 * Admin domain router
 * Handles all admin-only operations: user management, platform stats, founding requests,
 * email sending, pressure run inspection, and feature flag management.
 *
 * All procedures use adminProcedure — role check is enforced at the middleware level.
 * No inline `ctx.user.role !== "admin"` checks needed here.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../_core/trpc";
import {
  getAllUsers, getAllUsersWithTier, setUserTier,
  getFoundingRequests, updateFoundingRequestStatus,
  getPlatformStats, getActivityFeed,
  getSignupTimeSeries, getWaitlistTimeSeries, getConversionStats,
  deleteUser,
  getRecentPressureRuns, countPressureRuns,
  getAllFeatureFlags, setFeatureFlag,
} from "../db";
import { sendEmail, buildApprovalEmail } from "../email";
import { getAuthoritativeCrossEngineSynthesis, getLatestCrossEngineSynthesis } from "../crossEngineSynthesis";

export const adminRouter = router({
  // List all registered users
  getUsers: adminProcedure
    .query(async () => {
      try {
        return await getAllUsers();
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch users", cause: err });
      }
    }),

  // List all users with tier info
  getUsersWithTier: adminProcedure
    .query(async () => {
      try {
        return await getAllUsersWithTier();
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch users", cause: err });
      }
    }),

  // Set a user's access tier
  setUserTier: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      tier: z.enum(["free", "core", "premium", "founding"]),
    }))
    .mutation(async ({ input }) => {
      try {
        await setUserTier(input.userId, input.tier);
        return { success: true };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to set tier", cause: err });
      }
    }),

  // List all founding access requests
  getFoundingRequests: adminProcedure
    .query(async () => {
      try {
        return await getFoundingRequests();
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch requests", cause: err });
      }
    }),

  // Platform stats
  getPlatformStats: adminProcedure
    .query(async () => {
      try {
        return await getPlatformStats();
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch stats", cause: err });
      }
    }),

  // Activity feed
  getActivityFeed: adminProcedure
    .query(async () => {
      try {
        return await getActivityFeed(30);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch activity", cause: err });
      }
    }),

  // Update founding request status
  updateFoundingRequestStatus: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: z.enum(["pending", "approved", "rejected"]),
    }))
    .mutation(async ({ input }) => {
      try {
        await updateFoundingRequestStatus(input.id, input.status);
        return { success: true };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update request", cause: err });
      }
    }),

  // Signup/waitlist/conversion time series
  getStats: adminProcedure.query(async () => {
    const [signups, waitlist, conversion] = await Promise.all([
      getSignupTimeSeries(30),
      getWaitlistTimeSeries(30),
      getConversionStats(),
    ]);
    return { signups, waitlist, conversion };
  }),

  // Send founding access approval email
  sendApprovalEmail: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      origin: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const emailPayload = buildApprovalEmail({
        name: input.name ?? "",
        email: input.email,
        siteUrl: input.origin,
      });
      const result = await sendEmail(emailPayload);
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "Failed to send email" });
      }
      return { success: true, sentTo: input.email };
    }),

  // Remove a user account and all their data
  removeUser: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove your own account." });
      try {
        await deleteUser(input.userId);
        return { success: true };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to remove user", cause: err });
      }
    }),

  // Pressure engine audit trail inspection
  getPressureRuns: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      const [runs, total] = await Promise.all([
        getRecentPressureRuns(input.limit),
        countPressureRuns(),
      ]);
      return { runs, total };
    }),

  // Feature flags — read
  getFeatureFlags: adminProcedure
    .query(async () => {
      return getAllFeatureFlags();
    }),

  // Feature flags — toggle
  setFeatureFlag: adminProcedure
    .input(z.object({ key: z.string().min(1).max(80), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await setFeatureFlag(input.key, input.enabled, ctx.user.id);
      return { success: true };
    }),
  // ── V3-H Shadow Model admin procedures ────────────────────────────────────
  getShadowStats: adminProcedure
    .query(async () => {
      const { getDb } = await import("../db");
      const { shadowModelReadings: smr } = await import("../../drizzle/schema");
      const { desc: descOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return null;
      const readings = await db.select().from(smr).orderBy(descOp(smr.readingAt)).limit(500);
      if (readings.length === 0) return { readingCount: 0 };
      const avgDiff = readings.reduce((s: number, r: any) => s + r.scoreDiff, 0) / readings.length;
      const absDiff = readings.reduce((s: number, r: any) => s + r.absScoreDiff, 0) / readings.length;
      const regimeAgreementRate = readings.filter((r: any) => r.regimeAgreement).length / readings.length;
      const latest = readings[0]!;
      return {
        readingCount: readings.length,
        avgDiff: Math.round(avgDiff * 10) / 10,
        avgAbsDiff: Math.round(absDiff * 10) / 10,
        regimeAgreementRate: Math.round(regimeAgreementRate * 1000) / 10,
        divergence10Count: readings.filter((r: any) => r.flagDivergence10).length,
        stlfsiSpikeCount: readings.filter((r: any) => r.flagStlfsiSpike).length,
        fallbackCount: readings.filter((r: any) => r.flagFallback).length,
        latestV1: latest.v1Pressure,
        latestV3H: latest.v3hPressure,
        latestDiff: latest.scoreDiff,
        latestStlfsiRaw: latest.stlfsiRaw ? parseFloat(latest.stlfsiRaw) : null,
        latestStlfsiZ: latest.stlfsiZ ? parseFloat(latest.stlfsiZ) : null,
        latestReadingAt: latest.readingAt,
        shadowPeriodStart: "2026-08-09",
        shadowPeriodEnd: "2026-11-07",
      };
    }),
  getShadowReadings: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { shadowModelReadings: smr } = await import("../../drizzle/schema");
      const { desc: descOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { readings: [], total: 0 };
      const readings = await db.select().from(smr).orderBy(descOp(smr.readingAt)).limit(input.limit);
      return { readings, total: readings.length };
    }),
  getShadowDailySummaries: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(90) }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { shadowDailySummaries: sds } = await import("../../drizzle/schema");
      const { desc: descOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { summaries: [] };
      const summaries = await db.select().from(sds).orderBy(descOp(sds.summaryDate)).limit(input.limit);
      return { summaries };
    }),
  addStressAnnotation: adminProcedure
    .input(z.object({
      eventAt: z.string().datetime(),
      eventType: z.string().min(1).max(50),
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      severity: z.enum(["low", "moderate", "high", "critical"]),
      v1AtEvent: z.number().int().min(0).max(100).optional(),
      v3hAtEvent: z.number().int().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const { shadowStressAnnotations: ssa } = await import("../../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.insert(ssa).values({
        eventAt: new Date(input.eventAt),
        eventType: input.eventType,
        title: input.title,
        description: input.description,
        severity: input.severity,
        v1AtEvent: input.v1AtEvent ?? null,
        v3hAtEvent: input.v3hAtEvent ?? null,
        createdBy: ctx.user.id,
      });
      return { success: true };
    }),
  getStressAnnotations: adminProcedure
    .query(async () => {
      const { getDb } = await import("../db");
      const { shadowStressAnnotations: ssa } = await import("../../drizzle/schema");
      const { desc: descOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { annotations: [] };
      const annotations = await db.select().from(ssa).orderBy(descOp(ssa.eventAt)).limit(100);
      return { annotations };
    }),
  getCrossEngineSynthesisDebug: adminProcedure
    .query(async () => {
      const [current, lastPersisted] = await Promise.all([
        getAuthoritativeCrossEngineSynthesis(),
        getLatestCrossEngineSynthesis(),
      ]);
      return {
        current,
        lastPersisted,
        debugContract: {
          exposesToAdminOnly: true,
          fields: [
            "originatingStateId", "engineObservations", "relationships", "confirmations", "divergences",
            "independenceOfEvidence", "unavailableEngines", "staleEngines", "limitations", "supportingClaimIds",
          ],
        },
      };
    }),
});
