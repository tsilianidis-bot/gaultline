import { createHash } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { algorithmOutcomeObservations, algorithmScoreProvenance, intelligenceStateManifests } from "../drizzle/schema";
import { getDb } from "./db";
import { fetchFredSeries } from "./fredClient";
import type { FaultlinePressureOutput } from "./pressure/engine";
import { getDailyBars } from "./yahooProxy";
import { isNonTradingDay } from "./signalsProxy";
import {
  FORWARD_CHAMPION_VERSION,
  FORWARD_OUTCOME_HORIZONS,
  championProvenanceKey,
  etDateOf,
  selectEvaluatedDailyStates,
  stateOrigin,
  type LedgerStateRow,
} from "./forwardRunProvenance";

type FormulaContract = {
  engine: "faultline_pressure_v1";
  vectorWeights: Array<{ id: string; weight: number }>;
  regimeThresholds: Array<{ minimum: number; level: string }>;
};

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
    observationKey: championProvenanceKey(observedAt),
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

// ── Forward outcomes v2: completed daily bars only (Validation Foundation A3/A6) ──
//
// v1 (`champion-provenance:<id>:broad:<h>td`) read Yahoo daily bars at the 2 PM ET run,
// when the target day's bar was still open, so `targetClose` was an intraday price; it
// also counted horizons by array index (a dropped bar shifted the horizon), used the
// bar OPENING timestamp for the base, and took `score.target` from the latest record.
// v1 rows are never updated or deleted. v2 rows are NEW rows under `…:<h>td:v2`.

export const OUTCOME_COLLECTOR_VERSION = "forward-outcome-collector-v2-2026-10-04";
/** A session counts as complete only this long after its regular 16:00 ET close (conservative; early closes are earlier). */
export const OUTCOME_CLOSE_BUFFER_MINUTES = 60;
export const OUTCOME_BAR_SOURCE = "Yahoo chart v8 interval=1d range=6mo includePrePost=false (completed regular sessions only)";

export type OutcomeBar = { close: number; timestamp: number };
export interface CompletedSessionBar { etDate: string; close: number; timestamp: number; sessionCloseAt: string; sessionCloseMs: number }

/** 16:00 America/New_York on an ET calendar date, as a UTC instant (DST-aware). */
export function regularSessionCloseMs(etDate: string): number {
  const [y, m, d] = etDate.split("-").map(Number);
  for (const utcHour of [20, 21]) {
    const t = Date.UTC(y, m - 1, d, utcHour, 0, 0);
    const hour = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(new Date(t));
    if (Number(hour) === 16 && etDateOf(t) === etDate) return t;
  }
  throw new Error(`Cannot resolve the 16:00 ET close for ${etDate}`);
}

export function isTradingDay(etDate: string): boolean {
  return !isNonTradingDay(etDate);
}

/** True only when the bar's regular session has closed (plus buffer) at `collectedAt`. */
export function isSessionComplete(etDate: string, collectedAt: Date): boolean {
  return isTradingDay(etDate) && collectedAt.getTime() >= regularSessionCloseMs(etDate) + OUTCOME_CLOSE_BUFFER_MINUTES * 60_000;
}

/**
 * Completed regular-session bars, ascending, one per ET trading date. An in-progress bar
 * (e.g. today's bar at the 2 PM ET run) and any bar dated on a weekend/holiday are dropped.
 */
export function completedSessionBars(bars: OutcomeBar[], collectedAt: Date): CompletedSessionBar[] {
  const byDate = new Map<string, OutcomeBar>();
  for (const bar of [...bars].sort((a, b) => a.timestamp - b.timestamp)) {
    if (!Number.isFinite(bar.close) || !Number.isFinite(bar.timestamp)) continue;
    byDate.set(etDateOf(bar.timestamp), bar); // last bar per date wins
  }
  const out: CompletedSessionBar[] = [];
  for (const [etDate, bar] of Array.from(byDate.entries())) {
    if (!isSessionComplete(etDate, collectedAt)) continue;
    const sessionCloseMs = regularSessionCloseMs(etDate);
    out.push({ etDate, close: bar.close, timestamp: bar.timestamp, sessionCloseMs, sessionCloseAt: new Date(sessionCloseMs).toISOString() });
  }
  return out.sort((a, b) => a.etDate.localeCompare(b.etDate));
}

function nextTradingDay(etDate: string): string {
  const d = new Date(`${etDate}T12:00:00Z`);
  do { d.setUTCDate(d.getUTCDate() + 1); } while (isNonTradingDay(d.toISOString().slice(0, 10)));
  return d.toISOString().slice(0, 10);
}

/** Calendar base: the first trading session whose regular close is strictly after recordedAt. */
export function expectedBaseSessionDate(recordedAt: Date): string {
  let day = etDateOf(recordedAt);
  if (!isTradingDay(day) || regularSessionCloseMs(day) <= recordedAt.getTime()) day = nextTradingDay(day);
  return day;
}

export function addTradingDays(etDate: string, n: number): string {
  let day = etDate;
  for (let i = 0; i < n; i++) day = nextTradingDay(day);
  return day;
}

export type OutcomeWindow =
  | { status: "READY"; base: CompletedSessionBar; target: CompletedSessionBar; baseBarComplete: true; targetBarComplete: true }
  | { status: "DEFERRED"; reason: "BASE_SESSION_NOT_COMPLETE" | "TARGET_SESSION_NOT_COMPLETE" | "BASE_BAR_MISSING" | "TARGET_BAR_MISSING" };

/**
 * Base = first completed close strictly after recordedAt; target = the completed close
 * exactly `horizon` trading days later by the exchange calendar. Never an open session.
 */
export function computeOutcomeWindowV2(recordedAt: Date, horizon: number, completed: CompletedSessionBar[], collectedAt: Date): OutcomeWindow {
  const baseDate = expectedBaseSessionDate(recordedAt);
  if (!isSessionComplete(baseDate, collectedAt)) return { status: "DEFERRED", reason: "BASE_SESSION_NOT_COMPLETE" };
  const base = completed.find(bar => bar.etDate === baseDate);
  if (!base) return { status: "DEFERRED", reason: "BASE_BAR_MISSING" };
  const targetDate = addTradingDays(baseDate, horizon);
  if (!isSessionComplete(targetDate, collectedAt)) return { status: "DEFERRED", reason: "TARGET_SESSION_NOT_COMPLETE" };
  const target = completed.find(bar => bar.etDate === targetDate);
  if (!target) return { status: "DEFERRED", reason: "TARGET_BAR_MISSING" };
  return { status: "READY", base, target, baseBarComplete: true, targetBarComplete: true };
}

export function outcomeKeyV1(provenanceId: number, horizon: number): string {
  return `champion-provenance:${provenanceId}:broad:${horizon}td`;
}
export function outcomeKeyV2(provenanceId: number, horizon: number): string {
  return `champion-provenance:${provenanceId}:broad:${horizon}td:v2`;
}

export type ProvenanceRecord = { id: number; observationKey: string; observedAt: Date; pressureIndex: number; regime: string };

export type StateLink = {
  status: "EXPLICIT_RUN_PROVENANCE" | "LEGACY_SAME_RUN_INFERRED" | "UNRESOLVED";
  stateId: string | null;
  originatingRunId: string | null;
  championProvenanceKey: string;
  stateOrigin: ReturnType<typeof stateOrigin> | null;
  /** true only when the linked state is the day's evaluated (scheduled) state and its PI/regime equal the provenance row's */
  evaluationEligible: boolean;
  notes: string[];
};

const LEGACY_LINK_MAX_LAG_MS = 5 * 60 * 1000;

/**
 * Outcome → state link. New rows: the manifest's runProvenance.outcomeLink names the exact
 * provenance row this run created. Legacy rows: the same run's manifest, i.e. the latest state
 * generated ≤ 5 min before the provenance row with the same Pressure Index and regime.
 * Deterministic: same inputs → same link.
 */
export function resolveProvenanceStateLink(record: ProvenanceRecord, states: LedgerStateRow[]): StateLink {
  const evaluated = selectEvaluatedDailyStates(states);
  const finish = (state: LedgerStateRow | null, status: StateLink["status"], notes: string[]): StateLink => {
    if (!state) return { status, stateId: null, originatingRunId: null, championProvenanceKey: record.observationKey, stateOrigin: null, evaluationEligible: false, notes };
    const origin = stateOrigin(state);
    const samePi = state.pressureIndex === record.pressureIndex && state.regime === record.regime;
    if (!samePi) notes.push(`state PI/regime ${state.pressureIndex}/${state.regime} ≠ provenance ${record.pressureIndex}/${record.regime}`);
    const isEvaluated = evaluated.get(etDateOf(state.generatedAt))?.stateId === state.stateId;
    if (!isEvaluated) notes.push(`linked state is not the evaluated daily state (${origin})`);
    return { status, stateId: state.stateId, originatingRunId: state.originatingRunId, championProvenanceKey: record.observationKey, stateOrigin: origin, evaluationEligible: samePi && isEvaluated, notes };
  };
  const explicit = states
    .filter(s => s.runProvenance?.outcomeLink?.championProvenanceId === record.id && s.runProvenance?.outcomeLink?.championProvenanceCreatedByThisRun === true)
    .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
  if (explicit.length === 1) return finish(explicit[0], "EXPLICIT_RUN_PROVENANCE", []);
  if (explicit.length > 1) return finish(null, "UNRESOLVED", [`${explicit.length} states claim provenance ${record.id}`]);
  const t = record.observedAt.getTime();
  const legacy = states
    .filter(s => !s.runProvenance?.outcomeLink)
    .filter(s => { const g = Date.parse(s.generatedAt); return g <= t && t - g <= LEGACY_LINK_MAX_LAG_MS; })
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  if (legacy[0]) return finish(legacy[0], "LEGACY_SAME_RUN_INFERRED", []);
  return finish(null, "UNRESOLVED", ["no state generated within 5 min before the provenance row"]);
}

/**
 * The most recent `limit` FRED observations, returned in ascending date order.
 * fredClient sends no observation_start, so `sort_order=asc` + `limit` returns the FIRST
 * `limit` observations of the series (DGS10: Jan–Sep 1962). Always request `desc` and sort.
 */
export async function fetchRecentFredObservationsAscending(seriesId: string, limit: number) {
  const result = await fetchFredSeries(seriesId, limit, "desc");
  return { ...result, observations: [...result.observations].sort((a, b) => a.date.localeCompare(b.date)) };
}

export function fredYieldAt(observations: Array<{ date: string; value: string }>, day: string) {
  const value = fredValueOnOrBefore(observations, day);
  // Final only once FRED has published a row dated on/after the day (incl. "." holiday rows).
  const published = observations.some(observation => observation.date >= day);
  return value && published ? value : null;
}

export type V1OutcomeClass = "INTRADAY_TARGET_V1" | "SUPERSEDED_V1_COMPLETED_TARGET";

/**
 * Read-time classification of a legacy v1 row (rows are never modified). A v1 row whose
 * target session had not closed (+buffer) when the row was created holds an intraday price.
 */
export function classifyV1OutcomeRow(row: { outcomeKey: string; createdAt: Date; outcomeJson: string }): V1OutcomeClass | null {
  if (row.outcomeKey.endsWith(":v2")) return null;
  let targetDay: string | null = null;
  try { targetDay = JSON.parse(row.outcomeJson)?.spy?.targetObservedAt ?? null; } catch { targetDay = null; }
  if (!targetDay || !/^\d{4}-\d{2}-\d{2}$/.test(targetDay)) return "INTRADAY_TARGET_V1"; // cannot prove completeness
  return isSessionComplete(targetDay, row.createdAt) ? "SUPERSEDED_V1_COMPLETED_TARGET" : "INTRADAY_TARGET_V1";
}

export interface OutcomeV2Input {
  record: ProvenanceRecord;
  horizon: number;
  window: Extract<OutcomeWindow, { status: "READY" }>;
  collectedAt: Date;
  stateLink: StateLink;
  laterRecord: ProvenanceRecord | null;
  baseYield: { date: string; value: number };
  targetYield: { date: string; value: number };
  supersedes: { id: number; classification: V1OutcomeClass | null } | null;
}

/** Pure, deterministic v2 row (same inputs → byte-identical row). */
export function buildOutcomeV2Row(input: OutcomeV2Input) {
  const { record, horizon, window, collectedAt, stateLink, laterRecord, baseYield, targetYield, supersedes } = input;
  const { base, target } = window;
  return {
    outcomeKey: outcomeKeyV2(record.id, horizon),
    provenanceId: record.id,
    horizonTradingDays: horizon,
    observedAt: new Date(target.sessionCloseMs),
    outcomeJson: JSON.stringify({
      historyClass: "forward_live_observed",
      outcomeVersion: "v2",
      collectorVersion: OUTCOME_COLLECTOR_VERSION,
      collectedAt: collectedAt.toISOString(),
      baseConvention: "first completed regular-session close strictly after recordedAt",
      recordedAt: record.observedAt.toISOString(),
      stateLink,
      score: { base: record.pressureIndex, target: laterRecord?.pressureIndex ?? null, change: laterRecord ? laterRecord.pressureIndex - record.pressureIndex : null, targetProvenanceId: laterRecord?.id ?? null },
      regime: { base: record.regime, target: laterRecord?.regime ?? null },
      spy: {
        baseClose: base.close, targetClose: target.close, returnPercent: ((target.close - base.close) / base.close) * 100,
        baseObservedAt: base.etDate, targetObservedAt: target.etDate,
        baseBarDate: base.etDate, targetBarDate: target.etDate,
        baseSessionCloseAt: base.sessionCloseAt, targetSessionCloseAt: target.sessionCloseAt,
        baseBarComplete: window.baseBarComplete, targetBarComplete: window.targetBarComplete,
        barSource: OUTCOME_BAR_SOURCE,
      },
      tenYearTreasury: { baseYieldPercent: baseYield.value, targetYieldPercent: targetYield.value, changeBasisPoints: (targetYield.value - baseYield.value) * 100, sourceSeries: "DGS10", baseObservedAt: baseYield.date, targetObservedAt: targetYield.date },
      supersedesV1OutcomeId: supersedes?.id ?? null,
      supersedesV1Classification: supersedes?.classification ?? null,
    }),
    provenanceJson: JSON.stringify({
      outcomePolicy: "separate_observations_no_synthetic_success_score",
      collectorVersion: OUTCOME_COLLECTOR_VERSION,
      completenessRule: `bar session closed: collectedAt ≥ 16:00 ET close + ${OUTCOME_CLOSE_BUFFER_MINUTES} min, trading days only`,
      closeBufferMinutes: OUTCOME_CLOSE_BUFFER_MINUTES,
      spy: OUTCOME_BAR_SOURCE,
      tenYearTreasury: "FRED DGS10 (value on/before the bar date, only once FRED has published that date)",
      scoreAndRegime: "FAULTLINE forward Champion provenance records (earliest record on/after the target session)",
      tradingDayHorizon: horizon,
      writePolicy: "APPEND_ONLY_INSERT_IF_ABSENT",
      supersedesV1OutcomeKey: supersedes ? outcomeKeyV1(record.id, horizon) : null,
    }),
  };
}

/** Score/regime at the target: the earliest provenance record made on/after the target ET trading date. */
export function targetDayRecord(ascending: ProvenanceRecord[], targetEtDate: string): ProvenanceRecord | null {
  return ascending.find(candidate => etDateOf(candidate.observedAt) >= targetEtDate) ?? null;
}

export function isDuplicateKeyError(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } } | null;
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || e?.cause?.code === "ER_DUP_ENTRY" || e?.cause?.errno === 1062;
}

function parseLedgerState(row: { stateId: string; originatingRunId: string; generatedAt: Date; createdAt: Date; manifestJson: string }): LedgerStateRow {
  let m: any = {};
  try { m = JSON.parse(row.manifestJson); } catch { m = {}; }
  return {
    stateId: row.stateId,
    originatingRunId: row.originatingRunId,
    generatedAt: typeof m.generatedAt === "string" ? m.generatedAt : row.generatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    pressureIndex: typeof m.pressureIndex === "number" ? m.pressureIndex : null,
    regime: typeof m.regime === "string" ? m.regime : null,
    runProvenance: m.runProvenance ?? null,
  };
}

/**
 * Append-only v2 outcome collector. Runs on the scheduled cycle only (A5). Reads the
 * ledger, never issues UPDATE/DELETE, inserts a v2 row only when its key is absent, and
 * backfills v2 for past provenance rows on the next scheduled run. v1 rows stay as they are.
 */
export async function collectForwardChampionOutcomesV2(collectedAt: Date = new Date()) {
  const db = await getDb();
  if (!db) return { appended: 0, deferred: 0, reasons: {} as Record<string, number> };
  const [records, stateRows, spyBars, dgs10] = await Promise.all([
    db.select().from(algorithmScoreProvenance).orderBy(desc(algorithmScoreProvenance.observedAt)).limit(400),
    db.select({ stateId: intelligenceStateManifests.stateId, originatingRunId: intelligenceStateManifests.originatingRunId, generatedAt: intelligenceStateManifests.generatedAt, createdAt: intelligenceStateManifests.createdAt, manifestJson: intelligenceStateManifests.manifestJson })
      .from(intelligenceStateManifests).orderBy(desc(intelligenceStateManifests.generatedAt)).limit(1000),
    getDailyBars("SPY", "6mo"),
    fetchRecentFredObservationsAscending("DGS10", 180),
  ]);
  const reasons: Record<string, number> = {};
  const defer = (reason: string, n = 1) => { reasons[reason] = (reasons[reason] ?? 0) + n; };
  if (!spyBars.length || dgs10.error) { defer("SOURCE_UNAVAILABLE", records.length * FORWARD_OUTCOME_HORIZONS.length); return { appended: 0, deferred: records.length * FORWARD_OUTCOME_HORIZONS.length, reasons }; }
  const states = stateRows.map(parseLedgerState);
  const completed = completedSessionBars(spyBars, collectedAt);
  const ascending = [...records].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime() || a.id - b.id);
  const ids = records.map(r => r.id);
  const existing = ids.length
    ? await db.select({ id: algorithmOutcomeObservations.id, outcomeKey: algorithmOutcomeObservations.outcomeKey, createdAt: algorithmOutcomeObservations.createdAt, outcomeJson: algorithmOutcomeObservations.outcomeJson })
        .from(algorithmOutcomeObservations).where(inArray(algorithmOutcomeObservations.provenanceId, ids))
    : [];
  const byKey = new Map(existing.map(row => [row.outcomeKey, row]));
  let appended = 0;
  let deferred = 0;
  for (const record of ascending) {
    const stateLink = resolveProvenanceStateLink(record, states);
    for (const horizon of FORWARD_OUTCOME_HORIZONS) {
      const key = outcomeKeyV2(record.id, horizon);
      if (byKey.has(key)) continue; // insert-if-absent
      const window = computeOutcomeWindowV2(record.observedAt, horizon, completed, collectedAt);
      if (window.status !== "READY") { deferred++; defer(window.reason); continue; }
      const baseYield = fredYieldAt(dgs10.observations, window.base.etDate);
      const targetYield = fredYieldAt(dgs10.observations, window.target.etDate);
      if (!baseYield || !targetYield) { deferred++; defer("DGS10_NOT_PUBLISHED"); continue; }
      const laterRecord = targetDayRecord(ascending, window.target.etDate);
      const v1 = byKey.get(outcomeKeyV1(record.id, horizon));
      const row = buildOutcomeV2Row({ record, horizon, window, collectedAt, stateLink, laterRecord, baseYield, targetYield, supersedes: v1 ? { id: v1.id, classification: classifyV1OutcomeRow(v1) } : null });
      try {
        await db.insert(algorithmOutcomeObservations).values(row);
      } catch (error) {
        // outcomeKey is UNIQUE: a concurrent collector already appended this key. Never overwrite.
        if (isDuplicateKeyError(error)) { byKey.set(key, { id: -1, outcomeKey: key, createdAt: collectedAt, outcomeJson: row.outcomeJson }); continue; }
        throw error;
      }
      byKey.set(key, { id: -1, outcomeKey: key, createdAt: collectedAt, outcomeJson: row.outcomeJson });
      appended++;
    }
  }
  return { appended, deferred, reasons };
}
