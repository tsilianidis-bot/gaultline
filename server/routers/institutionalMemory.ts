import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { institutionalEventOutcomes, institutionalEvents } from "../../drizzle/schema";
import { getDb } from "../db";
import { buildInstitutionalOutcomeView, isBroadOutcomeEligibleEvent } from "../../shared/institutionalOutcomeDisplay";
import { createDurableAlertEventStore, DURABLE_ALERT_THRESHOLD_RULES, type DurableAlertFreshness, type DurableAlertObservation } from "../durableAlertEvents";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const archiveInput = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sourceEngine: z.string().max(96).optional(),
  eventType: z.string().max(96).optional(),
  regime: z.string().max(96).optional(),
  severity: z.enum(["info", "low", "moderate", "high", "critical"]).optional(),
  direction: z.enum(["improving", "deteriorating", "stable", "neutral"]).optional(),
  assetClass: z.string().max(48).optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

const durableFreshness = z.enum(["CURRENT", "DELAYED", "LAST CLOSE", "STALE", "UNAVAILABLE", "UNKNOWN"]);
const durableAlertMonitorInput = z.object({
  observations: z.array(z.object({
    ruleId: z.enum(DURABLE_ALERT_THRESHOLD_RULES.map(rule => rule.id) as [string, ...string[]]),
    value: z.number().finite().nullable(),
    freshness: durableFreshness,
    source: z.string().trim().min(1).max(255).nullable(),
    observedAt: z.string().datetime(),
  })).min(1).max(DURABLE_ALERT_THRESHOLD_RULES.length),
}).superRefine(({ observations }, context) => {
  const seen = new Set<string>();
  for (let index = 0; index < observations.length; index += 1) {
    const observation = observations[index]!;
    if (seen.has(observation.ruleId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["observations", index, "ruleId"], message: "Each durable alert rule may be observed once per sync." });
    }
    seen.add(observation.ruleId);
  }
});

const durableAlertHistoryInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.number().int().positive().optional(),
});

function durableStorageUnavailable<T extends Record<string, unknown>>(extra: T) {
  return { status: "unavailable" as const, reason: "DURABLE_ALERT_STORAGE_UNAVAILABLE", ...extra };
}

export const institutionalMemoryRouter = router({
  /**
   * Personal threshold-monitor state and history. These are deliberately
   * separate from the public institutional archive: source readings are
   * client-observed, user-scoped, and carry no sent-notification claim.
   */
  syncMyAlertMonitor: protectedProcedure.input(durableAlertMonitorInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return durableStorageUnavailable({ created: [], skipped: [] as Array<{ ruleId: string; reason: string; freshness: string }> });
    try {
      const store = createDurableAlertEventStore(db);
      const observations: DurableAlertObservation[] = input.observations.map(observation => ({
        ruleId: observation.ruleId as DurableAlertObservation["ruleId"],
        value: observation.value,
        freshness: observation.freshness as DurableAlertFreshness,
        source: observation.source,
        observedAt: new Date(observation.observedAt),
      }));
      const result = await store.synchronize(ctx.user.id, observations);
      return { status: "available" as const, ...result };
    } catch {
      // A missing migration/database is not a reason to fall back to browser
      // history and call it durable. The caller receives an explicit status.
      return durableStorageUnavailable({ created: [], skipped: [] as Array<{ ruleId: string; reason: string; freshness: string }> });
    }
  }),
  listMyAlertEvents: protectedProcedure.input(durableAlertHistoryInput).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return durableStorageUnavailable({ events: [], nextCursor: null as number | null });
    try {
      const result = await createDurableAlertEventStore(db).list(ctx.user.id, input);
      return { status: "available" as const, ...result };
    } catch {
      return durableStorageUnavailable({ events: [], nextCursor: null as number | null });
    }
  }),
  acknowledgeMyAlertEvent: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return durableStorageUnavailable({ acknowledged: false });
    try {
      const acknowledged = await createDurableAlertEventStore(db).acknowledge(ctx.user.id, input.id);
      return { status: "available" as const, acknowledged };
    } catch {
      return durableStorageUnavailable({ acknowledged: false });
    }
  }),
  listEvents: publicProcedure.input(archiveInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { events: [], total: 0, historyClass: "live_verified" as const };
    const filters = [];
    if (input.from) filters.push(gte(institutionalEvents.eventAt, new Date(input.from)));
    if (input.to) filters.push(lte(institutionalEvents.eventAt, new Date(input.to)));
    if (input.sourceEngine) filters.push(eq(institutionalEvents.sourceEngine, input.sourceEngine));
    if (input.eventType) filters.push(eq(institutionalEvents.eventType, input.eventType));
    if (input.regime) filters.push(eq(institutionalEvents.marketRegime, input.regime));
    if (input.severity) filters.push(eq(institutionalEvents.severity, input.severity));
    if (input.direction) filters.push(eq(institutionalEvents.direction, input.direction));
    if (input.assetClass) filters.push(eq(institutionalEvents.assetClass, input.assetClass));
    const where = filters.length ? and(...filters) : undefined;
    const [events, countRows] = await Promise.all([
      db.select().from(institutionalEvents).where(where).orderBy(desc(institutionalEvents.eventAt)).limit(input.limit),
      db.select({ count: sql<number>`count(*)` }).from(institutionalEvents).where(where),
    ]);
    const eventIds = events.map((event) => event.id);
    const outcomes = eventIds.length
      ? await db.select().from(institutionalEventOutcomes).where(inArray(institutionalEventOutcomes.eventId, eventIds)).orderBy(desc(institutionalEventOutcomes.horizonTradingDays))
      : [];
    const outcomesByEvent = new Map<number, typeof outcomes>();
    for (const outcome of outcomes) {
      const list = outcomesByEvent.get(outcome.eventId) ?? [];
      list.push(outcome);
      outcomesByEvent.set(outcome.eventId, list);
    }
    // Only corrected v2 completed-session rows are returned as outcomes; legacy rows
    // (intraday targets, 1962 DGS10) never leave the server and mark their horizon SUPERSEDED.
    return {
      events: events.map((event) => {
        const rows = outcomesByEvent.get(event.id) ?? [];
        const view = buildInstitutionalOutcomeView(rows);
        const measured = rows.length > 0 || isBroadOutcomeEligibleEvent(event);
        return { ...event, outcomes: view.outcomes, outcomeStatus: measured ? view.outcomeStatus : [] };
      }),
      total: Number(countRows[0]?.count ?? 0),
      historyClass: "live_verified" as const,
    };
  }),
  getEvent: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(institutionalEvents).where(eq(institutionalEvents.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
});
