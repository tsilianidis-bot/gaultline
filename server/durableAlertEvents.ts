import { and, desc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { userAlertEventAcknowledgements, userAlertEvents, userAlertMonitorStates } from "./durableAlertEventsSchema";

export const DURABLE_ALERT_THRESHOLD_RULES = [
  { id: "hy-spread-500", label: "HY Credit Spread > 500bps", metric: "hySpread", threshold: 500, direction: "above", severity: "critical" },
  { id: "hy-spread-400", label: "HY Credit Spread > 400bps", metric: "hySpread", threshold: 400, direction: "above", severity: "high" },
  { id: "vix-35", label: "VIX > 35 — Volatility Spike", metric: "vix", threshold: 35, direction: "above", severity: "critical" },
  { id: "vix-25", label: "VIX > 25 — Elevated Volatility", metric: "vix", threshold: 25, direction: "above", severity: "elevated" },
  { id: "yield-curve-inversion-50", label: "Yield Curve Inverted > 50bps", metric: "yieldCurveSpread", threshold: -50, direction: "below", severity: "high" },
  { id: "cpi-above-4", label: "CPI > 4% — Inflation Re-acceleration", metric: "cpi", threshold: 4, direction: "above", severity: "high" },
  { id: "unemployment-rise-5", label: "Unemployment > 5%", metric: "unemployment", threshold: 5, direction: "above", severity: "elevated" },
  { id: "auction-bid-cover-low", label: "Treasury Auction Demand Weak", metric: "auctionBidCover", threshold: 2.2, direction: "below", severity: "high" },
] as const;

export type DurableAlertRuleId = (typeof DURABLE_ALERT_THRESHOLD_RULES)[number]["id"];
type DurableAlertRule = (typeof DURABLE_ALERT_THRESHOLD_RULES)[number];
export type DurableAlertFreshness = "CURRENT" | "DELAYED" | "LAST CLOSE" | "STALE" | "UNAVAILABLE" | "UNKNOWN";

export type DurableAlertObservation = {
  ruleId: DurableAlertRuleId;
  value: number | null;
  freshness: DurableAlertFreshness;
  source: string | null;
  observedAt: Date;
};

type AlertDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type DurableAlertSkip = {
  ruleId: DurableAlertRuleId;
  reason: "unavailable_or_stale" | "invalid_observation";
  freshness: DurableAlertFreshness;
};

export type DurableAlertEvent = typeof userAlertEvents.$inferSelect & {
  acknowledgedAt: Date | null;
};

export type DurableAlertSyncResult = {
  created: DurableAlertEvent[];
  skipped: DurableAlertSkip[];
};

export type DurableAlertPage = {
  events: DurableAlertEvent[];
  nextCursor: number | null;
};

const RULE_BY_ID = new Map<string, DurableAlertRule>(
  DURABLE_ALERT_THRESHOLD_RULES.map(rule => [rule.id, rule]),
);
const EVALUABLE_FRESHNESS = new Set<DurableAlertFreshness>(["CURRENT", "DELAYED", "LAST CLOSE"]);

function isBreached(rule: DurableAlertRule, value: number): boolean {
  return rule.direction === "above" ? value > rule.threshold : value < rule.threshold;
}

function decimal(value: number): string {
  return value.toFixed(6);
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  if (!header || typeof header !== "object") return 0;
  const value = (header as { affectedRows?: unknown }).affectedRows;
  return typeof value === "number" ? value : 0;
}

function isDuplicateKeyError(error: unknown): boolean {
  const candidates = [
    error,
    typeof error === "object" && error != null ? (error as { cause?: unknown }).cause : undefined,
  ];
  return candidates.some(candidate => typeof candidate === "object" && candidate != null && (
    (candidate as { errno?: unknown }).errno === 1062
    || (candidate as { code?: unknown }).code === "ER_DUP_ENTRY"
  ));
}

function validateObservations(observations: readonly DurableAlertObservation[]): void {
  const seen = new Set<string>();
  for (const observation of observations) {
    if (!RULE_BY_ID.has(observation.ruleId)) {
      throw new Error(`Unknown durable alert rule: ${observation.ruleId}`);
    }
    if (seen.has(observation.ruleId)) {
      throw new Error(`Duplicate durable alert rule observation: ${observation.ruleId}`);
    }
    seen.add(observation.ruleId);
    if (!(observation.observedAt instanceof Date) || !Number.isFinite(observation.observedAt.getTime())) {
      throw new Error(`Invalid durable alert observation time for ${observation.ruleId}`);
    }
  }
}

/**
 * SQL-backed, user-scoped threshold monitor. The caller injects the DB for
 * isolated tests; production callers supply the existing getDb result. It never
 * invokes a provider or any notification channel.
 */
export function createDurableAlertEventStore(database: AlertDatabase) {
  return {
    async synchronize(userId: number, observations: readonly DurableAlertObservation[]): Promise<DurableAlertSyncResult> {
      validateObservations(observations);
      return database.transaction(async (tx) => {
        const created: DurableAlertEvent[] = [];
        const skipped: DurableAlertSkip[] = [];

        for (const observation of observations) {
          const rule = RULE_BY_ID.get(observation.ruleId)!;
          const source = observation.source?.trim() ?? "";
          const evaluable = EVALUABLE_FRESHNESS.has(observation.freshness)
            && typeof observation.value === "number"
            && Number.isFinite(observation.value)
            && source.length > 0;

          // Missing, stale, unknown, or malformed provider evidence does not
          // create an event and does not clear an existing breach baseline.
          if (!evaluable) {
            skipped.push({
              ruleId: observation.ruleId,
              reason: observation.freshness === "STALE" || observation.freshness === "UNAVAILABLE" ? "unavailable_or_stale" : "invalid_observation",
              freshness: observation.freshness,
            });
            continue;
          }

          const value = observation.value!;
          const breached = isBreached(rule, value);
          // Claim the unique baseline before locking it. Unlike a missing-row
          // SELECT ... FOR UPDATE, this makes overlapping first reads converge
          // on exactly one baseline row instead of racing two inserts.
          const baselineClaim = await tx.execute(sql`
            INSERT IGNORE INTO \`userAlertMonitorStates\`
              (\`userId\`, \`ruleId\`, \`lastBreached\`, \`lastValue\`, \`lastFreshness\`, \`lastSource\`, \`lastObservedAt\`, \`transitionSequence\`)
            VALUES
              (${userId}, ${rule.id}, ${breached}, ${decimal(value)}, ${observation.freshness}, ${source}, ${observation.observedAt}, 0)
          `);
          const initializedNow = affectedRows(baselineClaim) === 1;
          const [previous] = await tx.select({
            lastBreached: userAlertMonitorStates.lastBreached,
            transitionSequence: userAlertMonitorStates.transitionSequence,
          }).from(userAlertMonitorStates).where(and(
            eq(userAlertMonitorStates.userId, userId),
            eq(userAlertMonitorStates.ruleId, rule.id),
          )).limit(1).for("update");
          if (!previous) throw new Error("Durable alert baseline claim was not readable");
          // First fresh reading creates a baseline only. It does not
          // retrospectively manufacture an alert for a pre-existing breach.
          if (initializedNow) continue;

          const wasBreached = previous.lastBreached === true || Number(previous.lastBreached) === 1;
          const transitionSequence = Number(previous.transitionSequence) + (breached && !wasBreached ? 1 : 0);
          await tx.update(userAlertMonitorStates)
            .set({
              lastBreached: breached,
              lastValue: decimal(value),
              lastFreshness: observation.freshness,
              lastSource: source,
              lastObservedAt: observation.observedAt,
              transitionSequence,
            })
            .where(and(
              eq(userAlertMonitorStates.userId, userId),
              eq(userAlertMonitorStates.ruleId, rule.id),
            ));

          if (!breached || wasBreached) continue;

          const eventKey = `${rule.id}:transition:${transitionSequence}`;
          const insertResult = await tx.insert(userAlertEvents).values({
            userId,
            eventKey,
            ruleId: rule.id,
            transitionSequence,
            category: "threshold_breach",
            severity: rule.severity,
            metric: rule.metric,
            direction: rule.direction,
            threshold: decimal(rule.threshold),
            observedValue: decimal(value),
            source,
            sourceObservedAt: observation.observedAt,
            dataFreshness: observation.freshness,
            evidenceKind: "client_observed",
            deliveryStatus: "not_sent",
            eventAt: observation.observedAt,
          }).$returningId();
          const id = insertResult[0]?.id;
          if (id == null) throw new Error("Durable alert event insert did not return an id");
          const rows = await tx.select().from(userAlertEvents).where(and(
            eq(userAlertEvents.id, id),
            eq(userAlertEvents.userId, userId),
          )).limit(1);
          if (!rows[0]) throw new Error("Durable alert event insert was not readable");
          created.push({ ...rows[0], acknowledgedAt: null });
        }

        return { created, skipped };
      });
    },

    async list(userId: number, input: { limit: number; cursor?: number }): Promise<DurableAlertPage> {
      const limit = Math.max(1, Math.min(100, Math.floor(input.limit)));
      const conditions = [eq(userAlertEvents.userId, userId)];
      if (input.cursor != null) conditions.push(lt(userAlertEvents.id, input.cursor));
      const rows = await database.select().from(userAlertEvents)
        .leftJoin(userAlertEventAcknowledgements, eq(userAlertEventAcknowledgements.eventId, userAlertEvents.id))
        .where(and(...conditions))
        .orderBy(desc(userAlertEvents.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);
      return {
        events: page.map(row => ({
          ...row.userAlertEvents,
          acknowledgedAt: row.userAlertEventAcknowledgements?.acknowledgedAt ?? null,
        })),
        nextCursor: rows.length > limit ? page[page.length - 1]?.userAlertEvents.id ?? null : null,
      };
    },

    async acknowledge(userId: number, eventId: number, acknowledgedAt: Date = new Date()): Promise<boolean> {
      try {
        // The event-owner predicate is evaluated inside the INSERT ... SELECT,
        // and the acknowledgement table's unique eventId is the one-way,
        // concurrent-safe acknowledgement transition.
        const result = await database.execute(sql`
          INSERT INTO \`userAlertEventAcknowledgements\` (\`eventId\`, \`acknowledgedAt\`)
          SELECT \`id\`, ${acknowledgedAt}
          FROM \`userAlertEvents\`
          WHERE \`id\` = ${eventId} AND \`userId\` = ${userId}
        `);
        return affectedRows(result) === 1;
      } catch (error) {
        if (isDuplicateKeyError(error)) return false;
        throw error;
      }
    },
  };
}
