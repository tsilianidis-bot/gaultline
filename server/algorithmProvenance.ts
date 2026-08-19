import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { algorithmOutcomeObservations, algorithmScoreProvenance } from "../drizzle/schema";
import { getDb } from "./db";
import { fetchFredSeries } from "./fredClient";
import type { FaultlinePressureOutput } from "./pressure/engine";
import { getDailyBars } from "./yahooProxy";

const FORWARD_OUTCOME_HORIZONS = [1, 5, 20, 60] as const;
const FORWARD_CHAMPION_VERSION = "v1-forward-provenance-2026-08-19";

type FormulaContract = {
  engine: "faultline_pressure_v1";
  vectorWeights: Array<{ id: string; weight: number }>;
  regimeThresholds: Array<{ minimum: number; level: string }>;
};

function dayKey(observedAt: Date) {
  return observedAt.toISOString().slice(0, 10);
}

function hashFormula(contract: FormulaContract) {
  return createHash("sha256").update(JSON.stringify(contract)).digest("hex");
}

function scoreLevelThresholds(): Array<{ minimum: number; level: string }> {
  return [
    { minimum: 80, level: "Critical" },
    { minimum: 65, level: "High" },
    { minimum: 45, level: "Elevated" },
    { minimum: 25, level: "Moderate" },
    { minimum: 0, level: "Low" },
  ];
}

/** Pure contract builder used by both the persistence path and tests. */
export function buildForwardChampionProvenance(pressure: FaultlinePressureOutput, observedAt = new Date(pressure.timestamp)): {
  observationKey: string;
  engineVersion: string;
  formulaHash: string;
  formulaJson: string;
  inputManifestJson: string;
  availabilityJson: string;
  provenanceStatus: "forward_observed_unvintaged" | "forward_observed_with_release_metadata";
} {
  const formula: FormulaContract = {
    engine: "faultline_pressure_v1",
    vectorWeights: pressure.vectors.map(vector => ({ id: vector.id, weight: vector.weight })),
    regimeThresholds: scoreLevelThresholds(),
  };
  const inputManifest = pressure.vectors.map(vector => ({
    id: vector.id,
    source: vector.source,
    dataStatus: vector.dataStatus,
    rawInputs: vector.rawInputs,
    fallbackReason: vector.fallbackReason ?? null,
  }));
  // Existing provider payloads do not expose release/vintage metadata. Capturing
  // that absence explicitly prevents a future user from mistaking a live pull for
  // a point-in-time historical replay.
  const availability = inputManifest.map(input => ({
    vectorId: input.id,
    source: input.source,
    observationObservedAt: pressure.lastUpdated,
    releaseAt: null,
    vintageAt: null,
    availabilityStatus: "release_metadata_not_captured",
  }));
  return {
    observationKey: `champion-forward:${dayKey(observedAt)}:${FORWARD_CHAMPION_VERSION}`,
    engineVersion: FORWARD_CHAMPION_VERSION,
    formulaHash: hashFormula(formula),
    formulaJson: JSON.stringify(formula),
    inputManifestJson: JSON.stringify(inputManifest),
    availabilityJson: JSON.stringify(availability),
    provenanceStatus: "forward_observed_unvintaged",
  };
}

/**
 * Stores a single idempotent daily provenance observation. This is additive and
 * forward-only: it does not modify pressureRuns, pressureHistory, or any prior
 * institutional-memory record.
 */
export async function recordForwardChampionProvenance(pressure: FaultlinePressureOutput, observedAt = new Date()): Promise<{ id: number | null; created: boolean }> {
  const db = await getDb();
  if (!db) return { id: null, created: false };
  const contract = buildForwardChampionProvenance(pressure, observedAt);
  const existing = await db.select({ id: algorithmScoreProvenance.id })
    .from(algorithmScoreProvenance)
    .where(eq(algorithmScoreProvenance.observationKey, contract.observationKey))
    .limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };
  const inserted = await db.insert(algorithmScoreProvenance).values({
    ...contract,
    observedAt,
    pressureIndex: pressure.overallPressure,
    regime: pressure.regime,
  }).$returningId();
  return { id: inserted[0]?.id ?? null, created: true };
}

function fredValueOnOrBefore(observations: Array<{ date: string; value: string }>, day: string) {
  const eligible = observations.filter(observation => observation.date <= day && observation.value !== ".");
  const latest = eligible[eligible.length - 1];
  const value = latest ? Number(latest.value) : NaN;
  return Number.isFinite(value) ? { date: latest.date, value } : null;
}

/**
 * Appends independent broad-market observations after completed trading-day
 * horizons. These observations remain separate from the original score and do
 * not form a synthetic model-success metric.
 */
export async function collectForwardChampionOutcomes() {
  const db = await getDb();
  if (!db) return { appended: 0, deferred: 0 };
  const [records, spyBars, dgs10] = await Promise.all([
    db.select().from(algorithmScoreProvenance).orderBy(desc(algorithmScoreProvenance.observedAt)).limit(400),
    getDailyBars("SPY", "6mo"),
    fetchFredSeries("DGS10", 180, "asc"),
  ]);
  if (!spyBars.length || dgs10.error) return { appended: 0, deferred: records.length * FORWARD_OUTCOME_HORIZONS.length };
  let appended = 0;
  let deferred = 0;
  for (const record of records) {
    const baseIndex = spyBars.map(bar => bar.timestamp).filter(timestamp => timestamp <= record.observedAt.getTime()).length - 1;
    if (baseIndex < 0) { deferred += FORWARD_OUTCOME_HORIZONS.length; continue; }
    for (const horizonTradingDays of FORWARD_OUTCOME_HORIZONS) {
      const outcomeKey = `champion-provenance:${record.id}:broad:${horizonTradingDays}td`;
      const existing = await db.select({ id: algorithmOutcomeObservations.id }).from(algorithmOutcomeObservations)
        .where(eq(algorithmOutcomeObservations.outcomeKey, outcomeKey)).limit(1);
      if (existing[0]) continue;
      const base = spyBars[baseIndex];
      const target = spyBars[baseIndex + horizonTradingDays];
      if (!base || !target) { deferred++; continue; }
      const baseDay = new Date(base.timestamp).toISOString().slice(0, 10);
      const targetDay = new Date(target.timestamp).toISOString().slice(0, 10);
      const baseYield = fredValueOnOrBefore(dgs10.observations, baseDay);
      const targetYield = fredValueOnOrBefore(dgs10.observations, targetDay);
      if (!baseYield || !targetYield) { deferred++; continue; }
      const laterRecord = records.find(candidate => candidate.observedAt.getTime() >= target.timestamp);
      await db.insert(algorithmOutcomeObservations).values({
        outcomeKey,
        provenanceId: record.id,
        horizonTradingDays,
        observedAt: new Date(target.timestamp),
        outcomeJson: JSON.stringify({
          historyClass: "forward_live_observed",
          score: { base: record.pressureIndex, target: laterRecord?.pressureIndex ?? null, change: laterRecord ? laterRecord.pressureIndex - record.pressureIndex : null },
          regime: { base: record.regime, target: laterRecord?.regime ?? null },
          spy: { baseClose: base.close, targetClose: target.close, returnPercent: ((target.close - base.close) / base.close) * 100, baseObservedAt: baseDay, targetObservedAt: targetDay },
          tenYearTreasury: { baseYieldPercent: baseYield.value, targetYieldPercent: targetYield.value, changeBasisPoints: (targetYield.value - baseYield.value) * 100, sourceSeries: "DGS10", baseObservedAt: baseYield.date, targetObservedAt: targetYield.date },
        }),
        provenanceJson: JSON.stringify({
          outcomePolicy: "separate_observations_no_synthetic_success_score",
          spy: "Yahoo completed daily bars",
          tenYearTreasury: "FRED DGS10",
          scoreAndRegime: "FAUL TLINE forward Champion provenance records",
          tradingDayHorizon: horizonTradingDays,
        }),
      });
      appended++;
    }
  }
  return { appended, deferred };
}
