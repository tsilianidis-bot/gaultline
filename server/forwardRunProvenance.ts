/**
 * Forward-ledger run provenance (Validation Foundation A1–A5). Pure helpers, no DB.
 *
 * Every Seismograph run records WHAT triggered it. Only a SCHEDULED_CRON run (the
 * seismograph-cron service calling POST /api/scheduled/seismograph-daily with a start
 * inside [18:00, 18:30) UTC) captures Champion provenance and forward outcomes. A
 * cron-service redeploy hits the same endpoint outside the window (CRON_DEPLOY, ad hoc).
 * Nothing here changes scores, weights, thresholds or the stateHash core.
 */

export type RunTrigger = "SCHEDULED_CRON" | "CRON_DEPLOY" | "MANUAL" | "AD_HOC" | "BACKFILL_RECOVERY";
export type RunSource = "cron-endpoint" | "admin-seedNow" | "backfill-recovery" | "unspecified";

export interface RunContext {
  trigger: RunTrigger;
  triggerSource: RunSource;
  runStartedAt: string;
  /** true when runStartedAt is inside [18:00, 18:30) UTC */
  scheduledWindow: boolean;
}

export const SCHEDULED_WINDOW_UTC = { start: "18:00", endExclusive: "18:30" } as const;
const WINDOW_START_MIN = 18 * 60;
const WINDOW_END_MIN = 18 * 60 + 30;

export const LEDGER_SCHEMA_VERSION = "vf-ledger-v1";
/** stateHash recipe of this build: sha256(canonical core) where the core includes originatingRunId (since id 20). Unchanged here. */
export const STATE_HASH_RECIPE = "core-with-runId-v2";
/** Champion provenance key version (algorithmScoreProvenance.observationKey). Unchanged. */
export const FORWARD_CHAMPION_VERSION = "v1-forward-provenance-2026-08-19";
export const FORWARD_OUTCOME_HORIZONS = [1, 5, 20, 60] as const;

export function isInScheduledWindow(at: Date | string): boolean {
  const d = typeof at === "string" ? new Date(at) : at;
  const t = d.getTime();
  if (!Number.isFinite(t)) return false;
  const minute = d.getUTCHours() * 60 + d.getUTCMinutes();
  return minute >= WINDOW_START_MIN && minute < WINDOW_END_MIN;
}

/** Deterministic trigger classification from the call site and the run start time. */
export function resolveRunContext(source: RunSource, runStartedAt: Date = new Date()): RunContext {
  const scheduledWindow = isInScheduledWindow(runStartedAt);
  const trigger: RunTrigger =
    source === "cron-endpoint" ? (scheduledWindow ? "SCHEDULED_CRON" : "CRON_DEPLOY")
    : source === "admin-seedNow" ? "MANUAL"
    : source === "backfill-recovery" ? "BACKFILL_RECOVERY"
    : "AD_HOC";
  return { trigger, triggerSource: source, runStartedAt: runStartedAt.toISOString(), scheduledWindow };
}

/** A5: only the scheduled daily run captures Champion provenance and forward outcomes. */
export function capturesForwardEvidence(ctx: Pick<RunContext, "trigger"> | null | undefined): boolean {
  return ctx?.trigger === "SCHEDULED_CRON";
}

/** algorithmScoreProvenance.observationKey for a run recorded at `observedAt` (UTC day; format unchanged). */
export function championProvenanceKey(observedAt: Date): string {
  return `champion-forward:${observedAt.toISOString().slice(0, 10)}:${FORWARD_CHAMPION_VERSION}`;
}

/** A3: evaluation plan pre-registered in every new state (record only; not a methodology change). */
export const EVALUATION_PLAN = {
  protocol: "FAULTLINE-VP-1.0",
  horizonsTradingDays: [...FORWARD_OUTCOME_HORIZONS],
  baseConvention: "first completed regular-session close strictly after recordedAt",
  outcomeSeries: ["SPY (Yahoo daily bars, completed sessions only)", "DGS10 (FRED)"],
  outcomeLedger: "algorithmOutcomeObservations",
  outcomeKeyVersion: "v2",
} as const;

// ── Evaluated daily state (QLS, rule vf-qls-v1) ───────────────────────────────

export interface LedgerStateRow {
  stateId: string;
  originatingRunId: string;
  generatedAt: string; // ISO
  createdAt?: string | null; // ISO
  pressureIndex: number | null;
  regime: string | null;
  runProvenance?: {
    trigger?: RunTrigger;
    scheduledWindow?: boolean;
    recordClass?: "LIVE_FORWARD_RECORD" | "LIVE_FORWARD_CORRECTION";
    outcomeLink?: { championProvenanceKey?: string | null; championProvenanceId?: number | null; championProvenanceCreatedByThisRun?: boolean } | null;
  } | null;
}

export type StateOrigin = "SCHEDULED_CRON" | "NON_SCHEDULED" | "LEGACY_SCHEDULED_WINDOW" | "LEGACY_OUTSIDE_WINDOW" | "CORRECTION";

/** How a state row was produced. Rows without runProvenance (pre-#53) are judged by the window alone. */
export function stateOrigin(row: LedgerStateRow): StateOrigin {
  const rp = row.runProvenance;
  if (rp?.recordClass === "LIVE_FORWARD_CORRECTION") return "CORRECTION";
  if (rp?.trigger) return rp.trigger === "SCHEDULED_CRON" ? "SCHEDULED_CRON" : "NON_SCHEDULED";
  return isInScheduledWindow(row.generatedAt) ? "LEGACY_SCHEDULED_WINDOW" : "LEGACY_OUTSIDE_WINDOW";
}

export function etDateOf(at: Date | string | number): string {
  const d = new Date(at);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const MAX_RECORD_LAG_MS = 5 * 60 * 1000;

/**
 * The day's evaluated state per ET date: the EARLIEST scheduled (or legacy in-window)
 * forward record made at the time. Ad-hoc, deploy, manual, backfill and correction rows
 * stay recorded but never become the evaluated state. Deterministic for a given input set.
 * (The UI's "current" reader is unchanged; this selects the evaluation subject only.)
 */
export function selectEvaluatedDailyStates(rows: LedgerStateRow[]): Map<string, LedgerStateRow> {
  const byDay = new Map<string, LedgerStateRow>();
  const sorted = [...rows].sort((a, b) => a.generatedAt.localeCompare(b.generatedAt) || a.stateId.localeCompare(b.stateId));
  for (const row of sorted) {
    const origin = stateOrigin(row);
    if (origin !== "SCHEDULED_CRON" && origin !== "LEGACY_SCHEDULED_WINDOW") continue;
    if (row.createdAt && Date.parse(row.createdAt) - Date.parse(row.generatedAt) > MAX_RECORD_LAG_MS) continue;
    if (row.pressureIndex === null || row.regime === null) continue;
    const day = etDateOf(row.generatedAt);
    if (!byDay.has(day)) byDay.set(day, row);
  }
  return byDay;
}
