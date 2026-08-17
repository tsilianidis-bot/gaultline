import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { institutionalEventOutcomes, institutionalEvents } from "../../drizzle/schema";
import { getDb } from "../db";
import { publicProcedure, router } from "../_core/trpc";

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

export const institutionalMemoryRouter = router({
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
    return {
      events: events.map((event) => ({ ...event, outcomes: outcomesByEvent.get(event.id) ?? [] })),
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
