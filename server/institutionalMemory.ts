import { desc, eq } from "drizzle-orm";
import { institutionalEvents } from "../drizzle/schema";
import { getDb } from "./db";

export type InstitutionalSeverity = "info" | "low" | "moderate" | "high" | "critical";
export type InstitutionalDirection = "improving" | "deteriorating" | "stable" | "neutral";

export interface VerifiedInstitutionalEvent {
  eventKey: string;
  eventType: string;
  sourceEngine: string;
  entityType?: string;
  entityId?: string | null;
  assetClass?: string | null;
  severity: InstitutionalSeverity;
  direction: InstitutionalDirection;
  eventAt: Date;
  sourceObservedAt?: Date | null;
  dataFreshness: string;
  pressureIndex?: number | null;
  marketRegime?: string | null;
  magnitude?: number | null;
  relevantValue?: number | null;
  headline: string;
  explanation: string;
  previousState?: Record<string, unknown> | null;
  newState: Record<string, unknown>;
  supportingState: Record<string, unknown>;
}

export type MarketEvidenceState = {
  observedAt: Date;
  pressureIndex: number;
  regime: string;
  stressLevel: string;
  direction: string;
  dataFreshness: string;
  probabilities?: Record<string, number>;
  sourceState?: Record<string, unknown>;
};

const PRESSURE_THRESHOLDS = [25, 50, 75] as const;
const MATERIAL_PRESSURE_VARIANCE = 10;

function utcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function asDbDecimal(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? value.toFixed(6) : null;
}

function normalizeDirection(previous: number, next: number): InstitutionalDirection {
  if (next > previous) return "deteriorating";
  if (next < previous) return "improving";
  return "stable";
}

function severityForPressure(value: number): InstitutionalSeverity {
  if (value >= 75) return "critical";
  if (value >= 50) return "high";
  if (value >= 25) return "moderate";
  return "low";
}

/**
 * Persists once per stable event key. This function never updates original
 * observations; an already-recorded event remains byte-for-byte intact.
 */
export async function recordVerifiedInstitutionalEvent(input: VerifiedInstitutionalEvent) {
  const db = await getDb();
  if (!db) return { id: null, created: false };
  const existing = await db.select({ id: institutionalEvents.id })
    .from(institutionalEvents)
    .where(eq(institutionalEvents.eventKey, input.eventKey))
    .limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };

  const result = await db.insert(institutionalEvents).values({
    eventKey: input.eventKey,
    eventType: input.eventType,
    sourceEngine: input.sourceEngine,
    entityType: input.entityType ?? "market",
    entityId: input.entityId ?? null,
    assetClass: input.assetClass ?? null,
    severity: input.severity,
    direction: input.direction,
    eventAt: input.eventAt,
    sourceObservedAt: input.sourceObservedAt ?? null,
    dataFreshness: input.dataFreshness,
    pressureIndex: input.pressureIndex ?? null,
    marketRegime: input.marketRegime ?? null,
    magnitude: asDbDecimal(input.magnitude),
    relevantValue: asDbDecimal(input.relevantValue),
    headline: input.headline,
    explanation: input.explanation,
    previousStateJson: input.previousState ? JSON.stringify(input.previousState) : null,
    newStateJson: JSON.stringify(input.newState),
    supportingStateJson: JSON.stringify(input.supportingState),
  }).$returningId();
  return { id: result[0]?.id ?? null, created: true };
}

async function latestDailyMarketState() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({
    id: institutionalEvents.id,
    eventAt: institutionalEvents.eventAt,
    newStateJson: institutionalEvents.newStateJson,
  }).from(institutionalEvents)
    .where(eq(institutionalEvents.eventType, "daily_market_snapshot"))
    .orderBy(desc(institutionalEvents.eventAt))
    .limit(1);
  if (!rows[0]) return null;
  try {
    return { ...rows[0], state: JSON.parse(rows[0].newStateJson) as MarketEvidenceState };
  } catch {
    return null;
  }
}

/**
 * Writes one daily continuity observation plus only material changes actually
 * present in consecutive captured states. It never reconstructs prior events.
 */
export async function recordDailyMarketEvidence(current: MarketEvidenceState) {
  const previous = await latestDailyMarketState();
  const date = utcDate(current.observedAt);
  const baseState = { ...current, historyClass: "live_verified" as const };
  const writes = [recordVerifiedInstitutionalEvent({
    eventKey: `market_state:daily:${date}`,
    eventType: "daily_market_snapshot",
    sourceEngine: "seismograph_pipeline",
    severity: severityForPressure(current.pressureIndex),
    direction: current.direction === "Improving" ? "improving" : current.direction === "Deteriorating" || current.direction === "Accelerating" ? "deteriorating" : "stable",
    eventAt: current.observedAt,
    sourceObservedAt: current.observedAt,
    dataFreshness: current.dataFreshness,
    pressureIndex: current.pressureIndex,
    marketRegime: current.regime,
    relevantValue: current.pressureIndex,
    headline: `Daily verified market state: ${current.regime}`,
    explanation: "A daily continuity snapshot captured from the live FAULTLINE Seismograph pipeline. This is an observed state record, not a retrospective reconstruction.",
    previousState: previous?.state ?? null,
    newState: baseState,
    supportingState: current.sourceState ?? {},
  })];

  if (previous?.state && typeof previous.state.pressureIndex === "number") {
    const prior = previous.state.pressureIndex;
    const delta = current.pressureIndex - prior;
    const direction = normalizeDirection(prior, current.pressureIndex);
    if (previous.state.regime !== current.regime) {
      writes.push(recordVerifiedInstitutionalEvent({
        eventKey: `market_state:regime:${previous.id}:${current.regime}`,
        eventType: "market_regime_change",
        sourceEngine: "seismograph_pipeline",
        severity: severityForPressure(current.pressureIndex),
        direction,
        eventAt: current.observedAt,
        sourceObservedAt: current.observedAt,
        dataFreshness: current.dataFreshness,
        pressureIndex: current.pressureIndex,
        marketRegime: current.regime,
        magnitude: delta,
        relevantValue: current.pressureIndex,
        headline: `Market regime changed from ${previous.state.regime} to ${current.regime}.`,
        explanation: "The canonical daily pipeline observed a changed regime label in consecutive verified market states.",
        previousState: previous.state,
        newState: baseState,
        supportingState: current.sourceState ?? {},
      }));
    }
    if (Math.abs(delta) >= MATERIAL_PRESSURE_VARIANCE) {
      writes.push(recordVerifiedInstitutionalEvent({
        eventKey: `market_state:pressure_variance:${previous.id}:${current.pressureIndex}`,
        eventType: "material_pressure_variance",
        sourceEngine: "seismograph_pipeline",
        severity: severityForPressure(current.pressureIndex),
        direction,
        eventAt: current.observedAt,
        sourceObservedAt: current.observedAt,
        dataFreshness: current.dataFreshness,
        pressureIndex: current.pressureIndex,
        marketRegime: current.regime,
        magnitude: delta,
        relevantValue: current.pressureIndex,
        headline: `Pressure Index moved ${delta > 0 ? "higher" : "lower"} by ${Math.abs(delta)} points.`,
        explanation: "The move exceeded the pre-defined 10-point materiality threshold between consecutive captured daily states.",
        previousState: previous.state,
        newState: baseState,
        supportingState: current.sourceState ?? {},
      }));
    }
    for (const threshold of PRESSURE_THRESHOLDS) {
      const crossedUp = prior < threshold && current.pressureIndex >= threshold;
      const crossedDown = prior >= threshold && current.pressureIndex < threshold;
      if (crossedUp || crossedDown) {
        writes.push(recordVerifiedInstitutionalEvent({
          eventKey: `market_state:pressure_threshold:${previous.id}:${threshold}:${crossedUp ? "up" : "down"}`,
          eventType: "pressure_threshold_crossing",
          sourceEngine: "seismograph_pipeline",
          severity: severityForPressure(current.pressureIndex),
          direction,
          eventAt: current.observedAt,
          sourceObservedAt: current.observedAt,
          dataFreshness: current.dataFreshness,
          pressureIndex: current.pressureIndex,
          marketRegime: current.regime,
          magnitude: delta,
          relevantValue: threshold,
          headline: `Pressure Index ${crossedUp ? "crossed above" : "moved below"} ${threshold}.`,
          explanation: "A consecutive verified state crossed a predefined Pressure Index threshold.",
          previousState: previous.state,
          newState: baseState,
          supportingState: current.sourceState ?? {},
        }));
      }
    }
  }
  const results = await Promise.all(writes);
  return { created: results.filter(result => result.created).length, ids: results.map(result => result.id).filter((id): id is number => id != null) };
}
