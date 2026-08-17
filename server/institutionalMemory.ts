import { desc, eq, lte } from "drizzle-orm";
import { institutionalEventOutcomes, institutionalEvents } from "../drizzle/schema";
import { getDb } from "./db";
import { fetchFredSeries } from "./fredClient";
import { getDailyBars } from "./yahooProxy";

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
const MATERIAL_VECTOR_VARIANCE = 15;
const MATERIAL_PROBABILITY_VARIANCE = 15;

function numericStateRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, candidate]) => typeof candidate === "number" && Number.isFinite(candidate))) as Record<string, number>;
}

function observedLabel(id: string) {
  return id.replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

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

    const priorVectors = numericStateRecord(previous.state.sourceState?.vectorScores);
    const currentVectors = numericStateRecord(current.sourceState?.vectorScores);
    for (const [vectorId, currentScore] of Object.entries(currentVectors)) {
      const priorScore = priorVectors[vectorId];
      if (priorScore == null) continue;
      const vectorDelta = currentScore - priorScore;
      if (Math.abs(vectorDelta) < MATERIAL_VECTOR_VARIANCE) continue;
      writes.push(recordVerifiedInstitutionalEvent({
        eventKey: `market_state:vector_variance:${previous.id}:${vectorId}:${currentScore}`,
        eventType: "pressure_vector_material_change",
        sourceEngine: "seismograph_pipeline",
        entityType: "market_vector",
        entityId: vectorId,
        severity: severityForPressure(currentScore),
        direction: normalizeDirection(priorScore, currentScore),
        eventAt: current.observedAt,
        sourceObservedAt: current.observedAt,
        dataFreshness: current.dataFreshness,
        pressureIndex: current.pressureIndex,
        marketRegime: current.regime,
        magnitude: vectorDelta,
        relevantValue: currentScore,
        headline: `${observedLabel(vectorId)} moved ${vectorDelta > 0 ? "higher" : "lower"} by ${Math.abs(vectorDelta)} points.`,
        explanation: `A canonical observed pressure vector moved by at least ${MATERIAL_VECTOR_VARIANCE} points between consecutive verified daily market states.`,
        previousState: previous.state,
        newState: baseState,
        supportingState: { vectorId, priorScore, currentScore, threshold: MATERIAL_VECTOR_VARIANCE },
      }));
    }

    const priorProbabilities = numericStateRecord(previous.state.probabilities);
    const currentProbabilities = numericStateRecord(current.probabilities);
    for (const [regimeId, currentProbability] of Object.entries(currentProbabilities)) {
      const priorProbability = priorProbabilities[regimeId];
      if (priorProbability == null) continue;
      const probabilityDelta = currentProbability - priorProbability;
      if (Math.abs(probabilityDelta) < MATERIAL_PROBABILITY_VARIANCE) continue;
      writes.push(recordVerifiedInstitutionalEvent({
        eventKey: `market_state:regime_probability:${previous.id}:${regimeId}:${currentProbability}`,
        eventType: "regime_probability_material_change",
        sourceEngine: "seismograph_pipeline",
        entityType: "regime_probability",
        entityId: regimeId,
        severity: severityForPressure(current.pressureIndex),
        direction: probabilityDelta > 0 ? "deteriorating" : "improving",
        eventAt: current.observedAt,
        sourceObservedAt: current.observedAt,
        dataFreshness: current.dataFreshness,
        pressureIndex: current.pressureIndex,
        marketRegime: current.regime,
        magnitude: probabilityDelta,
        relevantValue: currentProbability,
        headline: `${observedLabel(regimeId)} regime probability moved ${probabilityDelta > 0 ? "higher" : "lower"} by ${Math.abs(probabilityDelta)} points.`,
        explanation: `A canonical regime-probability reading moved by at least ${MATERIAL_PROBABILITY_VARIANCE} points between consecutive verified daily market states.`,
        previousState: previous.state,
        newState: baseState,
        supportingState: { regimeId, priorProbability, currentProbability, threshold: MATERIAL_PROBABILITY_VARIANCE },
      }));
    }
  }
  const results = await Promise.all(writes);
  return { created: results.filter(result => result.created).length, ids: results.map(result => result.id).filter((id): id is number => id != null) };
}

const BROAD_OUTCOME_HORIZONS = [1, 5, 20, 60] as const;

function isoDay(timestamp: number | Date) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function fredValueOnOrBefore(observations: Array<{ date: string; value: string }>, day: string) {
  const eligible = observations.filter((observation) => observation.date <= day && observation.value !== ".");
  const latest = eligible[eligible.length - 1];
  const value = latest ? Number(latest.value) : NaN;
  return Number.isFinite(value) ? { date: latest.date, value } : null;
}

/**
 * Appends completed trading-day outcomes for broad, market-level institutional
 * events. The original event is never updated. SPY, DGS10, Pressure Index and
 * regime are intentionally stored as separate observations—not a synthetic
 * performance score. Missing source observations defer a horizon rather than
 * inserting a partial or inferred result.
 */
export async function collectBroadInstitutionalEventOutcomes() {
  const db = await getDb();
  if (!db) return { appended: 0, deferred: 0 };

  const [events, spyBars, dgs10] = await Promise.all([
    db.select({ id: institutionalEvents.id, eventAt: institutionalEvents.eventAt, pressureIndex: institutionalEvents.pressureIndex, marketRegime: institutionalEvents.marketRegime })
      .from(institutionalEvents)
      .where(eq(institutionalEvents.entityType, "market"))
      .orderBy(desc(institutionalEvents.eventAt))
      .limit(250),
    getDailyBars("SPY", "6mo"),
    fetchFredSeries("DGS10", 180, "asc"),
  ]);
  if (!spyBars.length || dgs10.error) return { appended: 0, deferred: events.length * BROAD_OUTCOME_HORIZONS.length };

  const dailyStates = await db.select({ eventAt: institutionalEvents.eventAt, newStateJson: institutionalEvents.newStateJson })
    .from(institutionalEvents)
    .where(eq(institutionalEvents.eventType, "daily_market_snapshot"))
    .orderBy(desc(institutionalEvents.eventAt))
    .limit(400);

  let appended = 0;
  let deferred = 0;
  for (const event of events) {
    const baseIndex = spyBars.map((bar) => bar.timestamp).filter((timestamp) => timestamp <= event.eventAt.getTime()).length - 1;
    if (baseIndex < 0) { deferred += BROAD_OUTCOME_HORIZONS.length; continue; }
    for (const horizonTradingDays of BROAD_OUTCOME_HORIZONS) {
      const outcomeKey = `institutional-event:${event.id}:broad-benchmark:${horizonTradingDays}td`;
      const existing = await db.select({ id: institutionalEventOutcomes.id }).from(institutionalEventOutcomes).where(eq(institutionalEventOutcomes.outcomeKey, outcomeKey)).limit(1);
      if (existing[0]) continue;
      const target = spyBars[baseIndex + horizonTradingDays];
      const base = spyBars[baseIndex];
      if (!target || !base) { deferred++; continue; }
      const baseYield = fredValueOnOrBefore(dgs10.observations, isoDay(base.timestamp));
      const targetYield = fredValueOnOrBefore(dgs10.observations, isoDay(target.timestamp));
      const laterState = dailyStates.find((state) => state.eventAt.getTime() <= target.timestamp);
      if (!baseYield || !targetYield || !laterState) { deferred++; continue; }
      let state: MarketEvidenceState;
      try { state = JSON.parse(laterState.newStateJson) as MarketEvidenceState; } catch { deferred++; continue; }
      await db.insert(institutionalEventOutcomes).values({
        outcomeKey,
        eventId: event.id,
        horizonTradingDays,
        observedAt: new Date(target.timestamp),
        outcomeJson: JSON.stringify({
          historyClass: "live_verified",
          spy: { baseClose: base.close, targetClose: target.close, returnPercent: ((target.close - base.close) / base.close) * 100, observedAt: isoDay(target.timestamp) },
          tenYearTreasury: { baseYieldPercent: baseYield.value, targetYieldPercent: targetYield.value, changeBasisPoints: (targetYield.value - baseYield.value) * 100, sourceSeries: "DGS10", baseObservedAt: baseYield.date, targetObservedAt: targetYield.date },
          pressureIndex: { base: event.pressureIndex, target: state.pressureIndex, change: event.pressureIndex == null ? null : state.pressureIndex - event.pressureIndex },
          regime: { base: event.marketRegime, target: state.regime },
        }),
        provenanceJson: JSON.stringify({ spy: "Yahoo completed daily bars", tenYearTreasury: "FRED DGS10", pressureAndRegime: "FAUL TLINE canonical daily Seismograph snapshots", tradingDayHorizon: horizonTradingDays }),
      });
      appended++;
    }
  }
  return { appended, deferred };
}
