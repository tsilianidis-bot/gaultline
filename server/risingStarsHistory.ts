import { desc, eq } from "drizzle-orm";
import { risingStarEvents, risingStarSnapshots } from "../drizzle/schema";
import { getDb } from "./db";
import { log } from "./logger";
import type { RisingStarItem } from "./signalOutlook";

export type RisingStarObservationType = "daily" | "engine";
export type RisingStarEventType =
  | "first_qualification"
  | "score_strengthened"
  | "score_weakened"
  | "confirmation"
  | "risk_threshold"
  | "invalidation"
  | "removed";

export interface RisingStarObservationContext {
  pressureIndex: number;
  regime: string;
  observedAt: number;
  source: "rising_stars_engine";
}

type PriorObservation = {
  id: number;
  qualification: "qualified" | "watchlist";
  risingStarScore: number;
  signalConfidence: string;
  riskLevel: string;
};

const QUALIFICATION_SCORE = 60;
const MATERIAL_SCORE_MOVE = 8;

function utcDate(epochMs: number) {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function toDbDate(epochMs: number | null | undefined) {
  return epochMs && Number.isFinite(epochMs) ? new Date(epochMs) : null;
}

function finiteOrNull(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? value : null;
}

export function isQualifiedRisingStar(item: Pick<RisingStarItem, "risingStarScore">) {
  return item.risingStarScore >= QUALIFICATION_SCORE;
}

export function determineRisingStarEvents(
  previous: PriorObservation | null,
  item: Pick<RisingStarItem, "risingStarScore" | "signalStrength" | "riskLevel" | "ticker">
): Array<{ type: RisingStarEventType; headline: string }> {
  const events: Array<{ type: RisingStarEventType; headline: string }> = [];
  const qualified = isQualifiedRisingStar(item);

  if (qualified && !previous) {
    events.push({ type: "first_qualification", headline: `${item.ticker} first qualified as a Rising Star from live engine evidence.` });
  } else if (qualified && previous?.qualification !== "qualified") {
    events.push({ type: "first_qualification", headline: `${item.ticker} newly qualified as a Rising Star from live engine evidence.` });
  }

  if (previous) {
    const scoreDelta = item.risingStarScore - previous.risingStarScore;
    if (scoreDelta >= MATERIAL_SCORE_MOVE) {
      events.push({ type: "score_strengthened", headline: `${item.ticker} Rising Star Score strengthened by ${scoreDelta} points.` });
    }
    if (scoreDelta <= -MATERIAL_SCORE_MOVE) {
      events.push({ type: "score_weakened", headline: `${item.ticker} Rising Star Score weakened by ${Math.abs(scoreDelta)} points.` });
    }
    if (previous.signalConfidence !== "HIGH" && previous.signalConfidence !== "VERY HIGH" && (item.signalStrength === "HIGH" || item.signalStrength === "VERY HIGH")) {
      events.push({ type: "confirmation", headline: `${item.ticker} reached ${item.signalStrength} cross-signal confirmation.` });
    }
    if (previous.riskLevel !== "ELEVATED" && item.riskLevel === "ELEVATED") {
      events.push({ type: "risk_threshold", headline: `${item.ticker} crossed the live elevated-risk threshold.` });
    }
  }

  // Invalidation and removal require a dedicated source-backed engine state.
  // This service deliberately never infers either from an absent provider result
  // or later price history.
  return events;
}

function snapshotPayload(item: RisingStarItem, context: RisingStarObservationContext) {
  return {
    evidence: item.evidence,
    socialDiscovery: item.socialDiscovery,
    insiderConviction: item.insiderConviction,
    optionsConviction: item.optionsConviction,
    whySeeingItEarly: item.whySeeingItEarly,
    dataNotes: item.dataNotes,
    technical: {
      momentumScore: item.momentumScore,
      relativeStrengthScore: item.relativeStrengthScore,
      volumeParticipationScore: item.volumeParticipationScore,
      riskLevel: item.riskLevel,
      latestPrice: item.latestPrice,
      dailyChange: item.dailyChange,
      dailyChangePercent: item.dailyChangePercent,
      priceStatus: item.priceStatus,
    },
    provenance: {
      historyClass: "live_verified" as const,
      engine: context.source,
      observedAt: context.observedAt,
      marketDataAsOf: item.marketDataAsOf,
      dataAsOf: item.dataAsOf,
      sourceStatus: item.priceStatus,
      note: "This record was captured from the live FAULTLINE Rising Stars engine. It is not a retrospective reconstruction.",
    },
  };
}

async function latestObservation(ticker: string): Promise<PriorObservation | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({
    id: risingStarSnapshots.id,
    qualification: risingStarSnapshots.qualification,
    risingStarScore: risingStarSnapshots.risingStarScore,
    signalConfidence: risingStarSnapshots.crossSignalConfidence,
    riskLevel: risingStarSnapshots.riskLevel,
  }).from(risingStarSnapshots)
    .where(eq(risingStarSnapshots.ticker, ticker))
    .orderBy(desc(risingStarSnapshots.observedAt))
    .limit(1);
  return rows[0] ?? null;
}

async function existingSnapshotId(snapshotKey: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: risingStarSnapshots.id })
    .from(risingStarSnapshots)
    .where(eq(risingStarSnapshots.snapshotKey, snapshotKey))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function recordRisingStarObservation(
  item: RisingStarItem,
  context: RisingStarObservationContext,
  observationType: RisingStarObservationType
): Promise<{ snapshotId: number | null; created: boolean; events: RisingStarEventType[] }> {
  const db = await getDb();
  if (!db) return { snapshotId: null, created: false, events: [] };

  const observationDate = utcDate(context.observedAt);
  const previous = await latestObservation(item.ticker);
  const events = determineRisingStarEvents(previous, item);

  // Daily entries create continuity. Engine entries are written only when the
  // live engine actually saw a material transition worth preserving.
  if (observationType === "engine" && events.length === 0) {
    return { snapshotId: null, created: false, events: [] };
  }

  const fingerprint = observationType === "daily"
    ? observationDate
    : `${context.observedAt}:${item.risingStarScore}:${item.signalStrength}:${item.riskLevel}`;
  const snapshotKey = `${item.ticker}:${observationType}:${fingerprint}`;
  const duplicateId = await existingSnapshotId(snapshotKey);
  if (duplicateId != null) return { snapshotId: duplicateId, created: false, events: [] };

  const payload = snapshotPayload(item, context);
  const result = await db.insert(risingStarSnapshots).values({
    snapshotKey,
    ticker: item.ticker,
    observationType,
    observationDate,
    observedAt: new Date(context.observedAt),
    marketDataAsOf: toDbDate(item.marketDataAsOf),
    sourceFetchedAt: toDbDate(item.dataAsOf),
    qualification: isQualifiedRisingStar(item) ? "qualified" : "watchlist",
    risingStarScore: item.risingStarScore,
    baseScore: item.baseScore,
    crowdingPenalty: item.crowdingPenalty,
    crossSignalConfidence: item.crossSignalConfidence,
    informationLead: item.informationLead,
    crowdingRisk: item.crowdingRisk,
    price: finiteOrNull(item.latestPrice)?.toFixed(6) ?? null,
    dailyChangePercent: finiteOrNull(item.dailyChangePercent)?.toFixed(4) ?? null,
    momentumScore: item.momentumScore,
    relativeStrengthScore: item.relativeStrengthScore,
    volumeParticipationScore: item.volumeParticipationScore,
    riskLevel: item.riskLevel,
    pressureIndex: context.pressureIndex,
    marketRegime: context.regime,
    sector: item.sector,
    industry: item.industry,
    macroContext: item.macroContext,
    evidenceJson: JSON.stringify(payload.evidence),
    technicalJson: JSON.stringify(payload.technical),
    provenanceJson: JSON.stringify(payload.provenance),
  }).$returningId();
  const snapshotId = result[0]?.id ?? null;
  if (snapshotId == null) throw new Error(`Rising Stars snapshot insert did not return an id for ${item.ticker}`);

  for (const event of events) {
    const eventKey = `${snapshotKey}:${event.type}`;
    await db.insert(risingStarEvents).values({
      eventKey,
      ticker: item.ticker,
      snapshotId,
      eventType: event.type,
      eventAt: new Date(context.observedAt),
      headline: event.headline,
      detailsJson: JSON.stringify({
        historyClass: "live_verified",
        previous: previous ? { score: previous.risingStarScore, confidence: previous.signalConfidence, risk: previous.riskLevel } : null,
        current: { score: item.risingStarScore, confidence: item.signalStrength, risk: item.riskLevel, price: item.latestPrice },
      }),
    }).onDuplicateKeyUpdate({ set: { eventKey } });
  }

  return { snapshotId, created: true, events: events.map(event => event.type) };
}

export async function recordDailyRisingStarsContinuity(
  items: RisingStarItem[],
  context: RisingStarObservationContext
) {
  const results = await Promise.allSettled(items.map(item => recordRisingStarObservation(item, context, "daily")));
  const created = results.filter((result): result is PromiseFulfilledResult<{ created: boolean }> => result.status === "fulfilled" && result.value.created).length;
  const failed = results.filter(result => result.status === "rejected").length;
  if (failed) log.warn(`[RisingStarsHistory] Daily continuity partially completed: ${created} created, ${failed} failed`);
  return { attempted: items.length, created, failed };
}

export async function getVerifiedRisingStarHistory(ticker: string) {
  const db = await getDb();
  if (!db) return { snapshots: [], events: [], historyClass: "live_verified" as const };
  const normalized = ticker.trim().toUpperCase();
  const [snapshots, events] = await Promise.all([
    db.select().from(risingStarSnapshots).where(eq(risingStarSnapshots.ticker, normalized)).orderBy(desc(risingStarSnapshots.observedAt)).limit(365),
    db.select().from(risingStarEvents).where(eq(risingStarEvents.ticker, normalized)).orderBy(desc(risingStarEvents.eventAt)).limit(250),
  ]);
  return { snapshots, events, historyClass: "live_verified" as const };
}
