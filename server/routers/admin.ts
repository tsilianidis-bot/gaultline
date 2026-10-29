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
  getAllUsers, getAllUsersWithTier,
  getFoundingRequests,
  getPlatformStats, getActivityFeed,
  getSignupTimeSeries, getWaitlistTimeSeries, getConversionStats,
  getRecentPressureRuns, countPressureRuns,
  getAllFeatureFlags,
} from "../db";
import { sendEmail, buildApprovalEmail } from "../email";
import {
  adminAuditStore,
  AdminAuditAmbiguousResultError,
  AdminAuditGuardError,
  AdminAuditNotFoundError,
} from "../adminAuditStore";
import { getAuthoritativeCrossEngineSynthesis, getLatestCrossEngineSynthesis } from "../crossEngineSynthesis";
import { getCandidateObservationTimeline, getPersistedCandidateDetections } from "../candidateDetection";
import { getImportanceQualificationEvaluations } from "../importanceQualification";
import { getLifecycleHistory } from "../earlyWarningLifecycle";

/**
 * Names only: this diagnostic deliberately exposes configuration presence, never
 * environment values. It does not perform outbound provider probes.
 */
export const ADMIN_RUNTIME_CONFIGURATION_KEYS = [
  "JWT_SECRET",
  "DATABASE_URL",
  "BUILT_IN_FORGE_API_KEY",
  "FRED_API_KEY",
  "POLYGON_API_KEY",
  "COINGECKO_API_KEY",
  "VITE_APP_ID",
  "OAUTH_SERVER_URL",
  "SENTRY_DSN",
] as const;

export function getAdminRuntimeDiagnostics() {
  const configuration = ADMIN_RUNTIME_CONFIGURATION_KEYS.map(key => ({
    key,
    configured: Boolean(process.env[key]?.trim()),
  }));
  const sentryConfigured = configuration.find(check => check.key === "SENTRY_DSN")?.configured ?? false;

  return {
    checkedAt: new Date().toISOString(),
    configuration,
    errorMonitoring: {
      provider: "sentry",
      configured: sentryConfigured,
    },
    checksAreConfigurationOnly: true,
    note: "Configuration presence only; this endpoint does not probe providers, the database, OAuth, or Sentry.",
  };
}

function throwAdminAuditRouterError(error: unknown, fallbackMessage: string): never {
  if (error instanceof AdminAuditAmbiguousResultError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message, cause: error });
  }
  if (error instanceof AdminAuditNotFoundError) {
    throw new TRPCError({ code: "NOT_FOUND", message: error.message, cause: error });
  }
  if (error instanceof AdminAuditGuardError) {
    throw new TRPCError({ code: error.code, message: error.message, cause: error });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallbackMessage, cause: error });
}

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
      lifetimeAccess: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { tier } = await adminAuditStore.setUserTier({
          actorUserId: ctx.user.id,
          userId: input.userId,
          tier: input.tier,
          lifetimeAccess: input.lifetimeAccess,
        });
        return { success: true, tier };
      } catch (err) {
        throwAdminAuditRouterError(err, "Failed to set tier and persist its audit event.");
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
    .mutation(async ({ ctx, input }) => {
      try {
        await adminAuditStore.updateFoundingRequestStatus({
          actorUserId: ctx.user.id,
          requestId: input.id,
          status: input.status,
        });
        return { success: true };
      } catch (err) {
        throwAdminAuditRouterError(err, "Failed to update request and persist its audit event.");
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

  // Secret-safe configuration metadata for the owner operations surface.
  getRuntimeDiagnostics: adminProcedure.query(() => getAdminRuntimeDiagnostics()),

  // Send founding access approval email
  sendApprovalEmail: adminProcedure
    .input(z.object({
      requestId: z.number().int().positive(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      let attempt: Awaited<ReturnType<typeof adminAuditStore.prepareApprovalEmailAttempt>>;
      try {
        attempt = await adminAuditStore.prepareApprovalEmailAttempt({
          actorUserId: ctx.user.id,
          requestId: input.requestId,
        });
      } catch (error) {
        throwAdminAuditRouterError(error, "Failed to record approval email attempt before dispatch.");
      }

      const emailPayload = buildApprovalEmail({
        name: attempt.recipient.name,
        email: attempt.recipient.email,
        siteUrl: input.origin,
      });
      let result: Awaited<ReturnType<typeof sendEmail>>;
      try {
        result = await sendEmail(emailPayload);
      } catch (error) {
        // An adapter exception after invocation does not prove non-delivery.
        // The immutable attempt remains available for reconciliation and blocks
        // a blind retry of this request.
        throwAdminAuditRouterError(new AdminAuditAmbiguousResultError(attempt.correlationId, error), "");
      }
      try {
        await adminAuditStore.recordApprovalEmailResult({
          actorUserId: ctx.user.id,
          requestId: input.requestId,
          correlationId: attempt.correlationId,
          accepted: result.success,
        });
      } catch (error) {
        // The adapter has already been called. Do not manufacture a rejection,
        // report success, or invite a duplicate blind retry when its result
        // cannot be durably correlated to the prior attempt.
        throwAdminAuditRouterError(new AdminAuditAmbiguousResultError(attempt.correlationId, error), "");
      }
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "Failed to send email" });
      }
      return { success: true, correlationId: attempt.correlationId };
    }),

  // Remove a user account and all their data
  removeUser: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await adminAuditStore.removeUser({ actorUserId: ctx.user.id, userId: input.userId });
        return { success: true };
      } catch (err) {
        throwAdminAuditRouterError(err, "Failed to remove user and persist its audit event.");
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

  // Durable, append-only evidence for owner/admin mutations. This is admin-only
  // and returns safe state projections, never profile fields or credentials.
  getMutationAuditEvents: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(200).default(50),
      beforeId: z.number().int().positive().optional(),
    }))
    .query(async ({ input }) => {
      try {
        return await adminAuditStore.list(input);
      } catch (err) {
        throwAdminAuditRouterError(err, "Failed to read durable admin audit history.");
      }
    }),

  // Feature flags — toggle
  setFeatureFlag: adminProcedure
    .input(z.object({ key: z.string().min(1).max(80), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await adminAuditStore.setFeatureFlag({
          actorUserId: ctx.user.id,
          key: input.key,
          enabled: input.enabled,
        });
        return { success: true };
      } catch (err) {
        throwAdminAuditRouterError(err, "Failed to update feature flag and persist its audit event.");
      }
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
      try {
        await adminAuditStore.addStressAnnotation({
          actorUserId: ctx.user.id,
          ...input,
        });
        return { success: true };
      } catch (err) {
        throwAdminAuditRouterError(err, "Failed to create stress annotation and persist its audit event.");
      }
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
  getCandidateDetectionDebug: adminProcedure
    .input(z.object({ candidateId: z.string().min(1).max(128).optional() }).optional())
    .query(async ({ input }) => {
      const candidates = await getPersistedCandidateDetections();
      const selected = input?.candidateId ? candidates.filter(item => item.candidateId === input.candidateId) : candidates;
      const timelines = await Promise.all(selected.map(async candidate => ({
        candidateId: candidate.candidateId,
        observations: await getCandidateObservationTimeline(candidate.candidateId),
      })));
      return {
        candidates: selected,
        timelines,
        debugContract: {
          exposesToAdminOnly: true,
          fields: [
            "originalStateId", "originalSynthesisId", "originalPayloadJson", "detectorId",
            "detectorVersion", "detectorConfigVersion", "appendOnlyCandidateObservations",
          ],
        },
      };
    }),
  getImportanceQualificationDebug: adminProcedure
    .input(z.object({ candidateId: z.string().min(1).max(128).optional() }).optional())
    .query(async ({ input }) => {
      const evaluations = await getImportanceQualificationEvaluations(input?.candidateId);
      return {
        evaluations,
        debugContract: {
          exposesToAdminOnly: true,
          fields: [
            "candidateId", "originatingStateId", "originatingSynthesisId", "factorTraceJson",
            "importanceScore", "qualificationStatus", "qualificationRank", "isPrimary",
            "qualificationReasonsJson", "suppressionReasonsJson", "scoringModelId",
            "scoringModelVersion", "scoringConfigVersion",
          ],
        },
      };
    }),
  getLifecycleDebug: adminProcedure
    .input(z.object({ candidateId: z.string().min(1).max(128).optional() }).optional())
    .query(async ({ input }) => {
      const observations = await getLifecycleHistory(input?.candidateId);
      return {
        observations,
        debugContract: {
          exposesToAdminOnly: true,
          fields: [
            "lifecycleId", "candidateId", "qualificationEvaluationId", "previousLifecycleState",
            "newLifecycleState", "transitionReasonCode", "persistenceCount", "importanceScore",
            "evidenceStrength", "dataQuality", "originatingStateId", "lifecycleModelId",
            "lifecycleModelVersion", "lifecycleConfigVersion", "transitionInputsJson",
          ],
        },
      };
    }),
  getPhase9ConfirmationInvalidationDebug: adminProcedure
    .input(z.object({ lifecycleId: z.string().min(1).max(128).optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const {
        phase9AuthorityEvents,
        phase9ConditionEvaluations,
        phase9ConfirmationPlans,
        phase9CurrentProjections,
        phase9PlanEvaluations,
        phase9WarningTheses,
      } = await import("../../drizzle/schema");
      const { desc: descOp, eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { theses: [], plans: [], conditionEvaluations: [], planEvaluations: [], authorityEvents: [], projections: [] };
      const filter = input?.lifecycleId ? eqOp(phase9WarningTheses.lifecycleId, input.lifecycleId) : undefined;
      const theses = filter ? await db.select().from(phase9WarningTheses).where(filter) : await db.select().from(phase9WarningTheses).orderBy(descOp(phase9WarningTheses.recordedAt));
      const lifecycleIds = theses.map(item => item.lifecycleId);
      const [plans, conditionEvaluations, planEvaluations, authorityEvents, projections] = await Promise.all([
        input?.lifecycleId ? db.select().from(phase9ConfirmationPlans).where(eqOp(phase9ConfirmationPlans.lifecycleId, input.lifecycleId)) : db.select().from(phase9ConfirmationPlans).orderBy(descOp(phase9ConfirmationPlans.recordedAt)),
        input?.lifecycleId ? db.select().from(phase9ConditionEvaluations).where(eqOp(phase9ConditionEvaluations.lifecycleId, input.lifecycleId)) : db.select().from(phase9ConditionEvaluations).orderBy(descOp(phase9ConditionEvaluations.recordedAt)),
        input?.lifecycleId ? db.select().from(phase9PlanEvaluations).where(eqOp(phase9PlanEvaluations.lifecycleId, input.lifecycleId)) : db.select().from(phase9PlanEvaluations).orderBy(descOp(phase9PlanEvaluations.recordedAt)),
        input?.lifecycleId ? db.select().from(phase9AuthorityEvents).where(eqOp(phase9AuthorityEvents.lifecycleId, input.lifecycleId)) : db.select().from(phase9AuthorityEvents).orderBy(descOp(phase9AuthorityEvents.recordedAt)),
        input?.lifecycleId ? db.select().from(phase9CurrentProjections).where(eqOp(phase9CurrentProjections.lifecycleId, input.lifecycleId)) : db.select().from(phase9CurrentProjections).orderBy(descOp(phase9CurrentProjections.updatedAt)),
      ]);
      return {
        theses, plans, conditionEvaluations, planEvaluations, authorityEvents, projections,
        debugContract: {
          exposesToAdminOnly: true,
          inactiveLifecycleIds: lifecycleIds,
          fields: ["thesisPayloadJson", "planPayloadJson", "requiredRuleJson", "conditionEvaluationIdsJson", "phase9EventId", "ruleSetVersion", "ruleConfigVersion", "originatingStateId", "latestResult"],
        },
      };
    }),
  getEarlyWarningPresentationDebug: adminProcedure
    .query(async () => {
      const { getCurrentGovernedEarlyWarningPresentation } = await import("../earlyWarningPresentation");
      const presentation = await getCurrentGovernedEarlyWarningPresentation();
      return {
        presentation,
        debugContract: {
          exposesToAdminOnly: true,
          fields: [
            "presentationId", "warningId", "stateId", "synthesisId", "qualificationEvaluationId",
            "lifecycleObservationId", "authorityEventId", "sourceChain", "freshness", "limitations",
          ],
          invariant: "Presentation is read-only and must not calculate or reinterpret Phase 2–9 authority.",
        },
      };
    }),
});
