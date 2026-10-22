/**
 * Once-per-NYSE-session claim for the scheduled seismograph run.
 *
 * Reuses `marketMemory.memoryKey` (unique). No new table and no journal entry.
 *
 * State machine on `seismograph-scheduled-session:YYYY-MM-DD`:
 *   absent → leased → completed
 *                 └→ failed → leased (recovery) → completed
 *   An expired lease (process died without fail/complete) may also return to leased.
 *
 * Recovery is a compare-and-swap on the exact stored JSON. It is allowed only when
 * all of these are true: the caller is SCHEDULED_CRON, `now` is inside that
 * session's NYSE post-close window, the claim is failed or the lease has expired,
 * and no scored outcome row exists. Generation 1 is the initial lease. Generation 2
 * is the one allowed recovery (`MAX_SCHEDULED_SESSION_RECOVERIES = 1`). A further
 * attempt is compare-and-swapped to `exhausted` and stays fail-closed.
 *
 * The outcome row is inserted as `pending_score` after pressure verification and
 * before the daily score upsert, then compare-and-swapped to `scored` after the
 * score write. A crash between those two steps is finished by `reconcile` exactly
 * once, and only while the evidence is still verified and the NYSE window is open.
 * That path writes the missing score and does not capture a second forward record.
 * After the window, or when verification fails, the outcome becomes
 * `skipped: unrecoverable`. A scored outcome never starts another pipeline.
 * The out-of-window dual-cron fire, and the next session's in-window fire,
 * finalize stale pending or scoring rows for sessions that are not inside
 * the NYSE window. That step does not write a score or a forward record.
 * Claim, reconcile, and finalize all refuse a trigger other than SCHEDULED_CRON.
 *
 * Fail-closed: a missing database, a missing table, or any error other than a
 * duplicate key returns `unavailable` and the caller must not run the pipeline.
 */
import { and, eq, like } from "drizzle-orm";
import { marketMemory } from "../drizzle/schema";
import { getDb } from "./db";
import { nyseSeismographRunWindow } from "../shared/nyseSession";

export const SCHEDULED_SEISMOGRAPH_CLAIM_PREFIX = "seismograph-scheduled-session:";
export const SCHEDULED_SEISMOGRAPH_OUTCOME_PREFIX = "seismograph-scheduled-outcome:";
export const SCHEDULED_SESSION_LEASE_MS = 3 * 60 * 1000;
/** Initial claim is generation 1. One recovery reaches generation 2. Generation 3 is refused. */
export const MAX_SCHEDULED_SESSION_RECOVERIES = 1;
export const MAX_SCHEDULED_SESSION_GENERATION = 1 + MAX_SCHEDULED_SESSION_RECOVERIES;

export type ScheduledSessionClaimStatus = "claimed" | "already_claimed" | "unavailable" | "reconcile" | "exhausted";

export interface ScheduledSessionClaimResult {
  status: ScheduledSessionClaimStatus;
  generation?: number;
  mode?: "initial" | "recovered" | "reconcile";
}

/** Handler tests inject the historical string. Generation is present only for a real claim. */
export function normalizeSessionClaim(
  value: ScheduledSessionClaimStatus | ScheduledSessionClaimResult,
): ScheduledSessionClaimResult {
  return typeof value === "string" ? { status: value } : value;
}

type ClaimDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export interface SessionClaimStore {
  read(key: string): Promise<string | null>;
  insert(key: string, value: string, description: string): Promise<void>;
  cas(key: string, previous: string, next: string): Promise<boolean>;
  /** Outcome rows for prior sessions. Absent on older test doubles; finalize then fails closed. */
  listByPrefix?(prefix: string): Promise<Array<{ key: string; value: string }>>;
}

type ClaimState = "leased" | "completed" | "failed" | "exhausted";
type OutcomeState = "pending_score" | "scoring" | "scored" | "unrecoverable";

interface OutcomeBody {
  kind: "seismograph-scheduled-outcome";
  etDate: string;
  pressureScore: number;
  regime: string;
  admittedAt: string;
  state: OutcomeState;
  reason?: string;
  scoreLeaseExpiresAt?: string;
}

interface ClaimBody {
  kind: "seismograph-scheduled-session";
  etDate: string;
  state: ClaimState;
  generation: number;
  claimedAt: string;
  leaseExpiresAt: string;
  heartbeatAt: string;
}

export function scheduledSeismographClaimKey(etDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etDate)) {
    throw new Error("Scheduled session date must be YYYY-MM-DD");
  }
  return `${SCHEDULED_SEISMOGRAPH_CLAIM_PREFIX}${etDate}`;
}

export function scheduledSeismographOutcomeKey(etDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etDate)) {
    throw new Error("Scheduled session date must be YYYY-MM-DD");
  }
  return `${SCHEDULED_SEISMOGRAPH_OUTCOME_PREFIX}${etDate}`;
}

export function isHiddenSessionMemoryKey(key: string): boolean {
  return key.startsWith(SCHEDULED_SEISMOGRAPH_CLAIM_PREFIX)
    || key.startsWith(SCHEDULED_SEISMOGRAPH_OUTCOME_PREFIX);
}

function isStore(value: unknown): value is SessionClaimStore {
  if (!value || typeof value !== "object") return false;
  const candidate = value as SessionClaimStore;
  return typeof candidate.read === "function"
    && typeof candidate.insert === "function"
    && typeof candidate.cas === "function";
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  if (!header || typeof header !== "object") return 0;
  const row = header as { affectedRows?: number; rowsAffected?: number };
  return row.affectedRows ?? row.rowsAffected ?? 0;
}

async function drizzleStore(db: ClaimDb): Promise<SessionClaimStore> {
  return {
    async read(key) {
      const rows = await db
        .select({ memoryValue: marketMemory.memoryValue })
        .from(marketMemory)
        .where(eq(marketMemory.memoryKey, key))
        .limit(1);
      return rows[0]?.memoryValue ?? null;
    },
    async insert(key, value, description) {
      await db.insert(marketMemory).values({
        memoryKey: key,
        memoryValue: value,
        description,
        writtenBy: "scheduledSeismograph",
      });
    },
    async cas(key, previous, next) {
      const result = await db
        .update(marketMemory)
        .set({ memoryValue: next })
        .where(and(eq(marketMemory.memoryKey, key), eq(marketMemory.memoryValue, previous)));
      return affectedRows(result) === 1;
    },
    async listByPrefix(prefix) {
      const rows = await db
        .select({ key: marketMemory.memoryKey, value: marketMemory.memoryValue })
        .from(marketMemory)
        .where(like(marketMemory.memoryKey, `${prefix}%`));
      return rows;
    },
  };
}

function isDuplicateKey(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { code?: string; errno?: number; message?: string; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062 || /Duplicate entry/i.test(candidate.message ?? "")) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

function encodeClaim(body: ClaimBody): string {
  return JSON.stringify({
    kind: body.kind,
    etDate: body.etDate,
    state: body.state,
    generation: body.generation,
    claimedAt: body.claimedAt,
    leaseExpiresAt: body.leaseExpiresAt,
    heartbeatAt: body.heartbeatAt,
  });
}

function parseClaim(raw: string): ClaimBody | null {
  try {
    const value = JSON.parse(raw) as ClaimBody;
    if (value?.kind !== "seismograph-scheduled-session") return null;
    if (value.state !== "leased" && value.state !== "completed" && value.state !== "failed" && value.state !== "exhausted") return null;
    if (!Number.isInteger(value.generation)) return null;
    return value;
  } catch {
    return null;
  }
}

function leasedClaim(etDate: string, generation: number, nowMs: number, claimedAt: string): string {
  const nowIso = new Date(nowMs).toISOString();
  return encodeClaim({
    kind: "seismograph-scheduled-session",
    etDate,
    state: "leased",
    generation,
    claimedAt,
    leaseExpiresAt: new Date(nowMs + SCHEDULED_SESSION_LEASE_MS).toISOString(),
    heartbeatAt: nowIso,
  });
}

async function resolveStore(dbProvider: () => Promise<ClaimDb | SessionClaimStore | null>): Promise<SessionClaimStore | null> {
  const db = await dbProvider().catch(() => null);
  if (!db) return null;
  if (isStore(db)) return db;
  return drizzleStore(db).catch(() => null);
}

export interface ScheduledSessionClaimOptions {
  nowMs?: number;
  trigger?: string;
}

export async function claimScheduledSeismographSession(
  etDate: string,
  dbProvider: () => Promise<ClaimDb | SessionClaimStore | null> = getDb,
  options: ScheduledSessionClaimOptions = {},
): Promise<ScheduledSessionClaimResult> {
  let key: string;
  try {
    key = scheduledSeismographClaimKey(etDate);
  } catch {
    return { status: "unavailable" };
  }
  if (options.trigger !== "SCHEDULED_CRON") return { status: "unavailable" };
  const store = await resolveStore(dbProvider);
  if (!store) return { status: "unavailable" };
  const nowMs = options.nowMs ?? Date.now();
  const initial = leasedClaim(etDate, 1, nowMs, new Date(nowMs).toISOString());
  try {
    await store.insert(key, initial, `Scheduled seismograph once-per-session claim ${etDate}`);
    return { status: "claimed", generation: 1, mode: "initial" };
  } catch (error) {
    if (!isDuplicateKey(error)) return { status: "unavailable" };
  }
  return recoverExistingClaim(store, key, etDate, nowMs, options.trigger);
}

function encodeOutcome(body: OutcomeBody): string {
  return JSON.stringify({
    kind: body.kind,
    etDate: body.etDate,
    state: body.state,
    pressureScore: body.pressureScore,
    regime: body.regime,
    admittedAt: body.admittedAt,
    reason: body.reason ?? null,
    scoreLeaseExpiresAt: body.scoreLeaseExpiresAt ?? null,
  });
}

function parseOutcome(raw: string): OutcomeBody | null {
  try {
    const value = JSON.parse(raw) as OutcomeBody;
    if (value?.kind !== "seismograph-scheduled-outcome") return null;
    if (!Number.isFinite(value.pressureScore) || typeof value.regime !== "string") return null;
    const state = value.state ?? "pending_score";
    if (state !== "pending_score" && state !== "scoring" && state !== "scored" && state !== "unrecoverable") return null;
    return { ...value, state };
  } catch {
    return null;
  }
}

function outcomeNeedsScore(outcome: OutcomeBody, nowMs: number): boolean {
  if (outcome.state === "pending_score") return true;
  if (outcome.state !== "scoring") return false;
  const lease = Date.parse(outcome.scoreLeaseExpiresAt ?? "");
  return !Number.isFinite(lease) || lease <= nowMs;
}

async function writeOutcome(store: SessionClaimStore, etDate: string, previous: string, next: OutcomeBody): Promise<boolean> {
  return store.cas(scheduledSeismographOutcomeKey(etDate), previous, encodeOutcome(next));
}

async function recoverExistingClaim(
  store: SessionClaimStore,
  key: string,
  etDate: string,
  nowMs: number,
  trigger: string | undefined,
): Promise<ScheduledSessionClaimResult> {
  let current: string | null;
  try {
    current = await store.read(key);
  } catch {
    return { status: "already_claimed" };
  }
  if (!current) return { status: "already_claimed" };
  const parsed = parseClaim(current);
  if (!parsed || parsed.state === "completed") return { status: "already_claimed" };
  if (parsed.state === "exhausted") return { status: "exhausted", generation: parsed.generation };
  const leaseExpiresAt = Date.parse(parsed.leaseExpiresAt);
  const leaseHeld = parsed.state === "leased" && Number.isFinite(leaseExpiresAt) && leaseExpiresAt > nowMs;
  if (leaseHeld) return { status: "already_claimed" };
  const recoverable = parsed.state === "failed" || (Number.isFinite(leaseExpiresAt) && leaseExpiresAt <= nowMs);
  if (!recoverable || trigger !== "SCHEDULED_CRON") return { status: "already_claimed" };
  const window = nyseSeismographRunWindow(new Date(nowMs));
  const inWindow = window.isScheduledWindow && window.etDate === etDate;
  let outcomeRaw: string | null;
  try {
    outcomeRaw = await store.read(scheduledSeismographOutcomeKey(etDate));
  } catch {
    return { status: "already_claimed" };
  }
  const outcome = outcomeRaw ? parseOutcome(outcomeRaw) : null;
  if (outcome && outcomeNeedsScore(outcome, nowMs)) {
    if (!inWindow) {
      try {
        await writeOutcome(store, etDate, outcomeRaw!, {
          ...outcome,
          state: "unrecoverable",
          reason: "skipped: unrecoverable",
        });
      } catch {
        return { status: "unavailable" };
      }
      return { status: "already_claimed" };
    }
    return { status: "reconcile", generation: parsed.generation, mode: "reconcile" };
  }
  if (outcomeRaw) return { status: "already_claimed" };
  if (!inWindow) return { status: "already_claimed" };
  if (parsed.generation >= MAX_SCHEDULED_SESSION_GENERATION) {
    const exhausted = encodeClaim({
      ...parsed,
      state: "exhausted",
      heartbeatAt: new Date(nowMs).toISOString(),
    });
    try {
      await store.cas(key, current, exhausted);
    } catch {
      return { status: "unavailable" };
    }
    return { status: "exhausted", generation: parsed.generation };
  }
  const nextGeneration = parsed.generation + 1;
  const next = leasedClaim(etDate, nextGeneration, nowMs, parsed.claimedAt);
  let won = false;
  try {
    won = await store.cas(key, current, next);
  } catch {
    return { status: "unavailable" };
  }
  if (!won) return { status: "already_claimed" };
  return { status: "claimed", generation: nextGeneration, mode: "recovered" };
}

async function transitionClaim(
  etDate: string,
  generation: number,
  nextState: "completed" | "failed" | "leased",
  dbProvider: () => Promise<ClaimDb | SessionClaimStore | null>,
  nowMs: number,
): Promise<boolean> {
  const store = await resolveStore(dbProvider);
  if (!store) return false;
  const key = scheduledSeismographClaimKey(etDate);
  const current = await store.read(key);
  if (!current) return false;
  const parsed = parseClaim(current);
  if (!parsed || parsed.generation !== generation || parsed.state === "completed") return false;
  const nowIso = new Date(nowMs).toISOString();
  const next = encodeClaim({
    ...parsed,
    state: nextState,
    leaseExpiresAt: nextState === "leased"
      ? new Date(nowMs + SCHEDULED_SESSION_LEASE_MS).toISOString()
      : nextState === "failed"
        ? new Date(0).toISOString()
        : parsed.leaseExpiresAt,
    heartbeatAt: nowIso,
  });
  return store.cas(key, current, next);
}

export async function heartbeatScheduledSession(
  etDate: string,
  generation: number,
  dbProvider: () => Promise<ClaimDb | SessionClaimStore | null> = getDb,
  nowMs = Date.now(),
): Promise<boolean> {
  return transitionClaim(etDate, generation, "leased", dbProvider, nowMs);
}

export async function completeScheduledSession(
  etDate: string,
  generation: number,
  dbProvider: () => Promise<ClaimDb | SessionClaimStore | null> = getDb,
  nowMs = Date.now(),
): Promise<boolean> {
  return transitionClaim(etDate, generation, "completed", dbProvider, nowMs);
}

export async function failScheduledSession(
  etDate: string,
  generation: number,
  dbProvider: () => Promise<ClaimDb | SessionClaimStore | null> = getDb,
  nowMs = Date.now(),
): Promise<boolean> {
  return transitionClaim(etDate, generation, "failed", dbProvider, nowMs);
}

export async function admitScheduledSessionOutcome(
  etDate: string,
  payload: { pressureScore: number; regime: string },
  dbProvider: () => Promise<ClaimDb | SessionClaimStore | null> = getDb,
  nowMs = Date.now(),
): Promise<"admitted" | "already_recorded" | "unavailable"> {
  let key: string;
  try {
    key = scheduledSeismographOutcomeKey(etDate);
  } catch {
    return "unavailable";
  }
  const store = await resolveStore(dbProvider);
  if (!store) return "unavailable";
  const value = encodeOutcome({
    kind: "seismograph-scheduled-outcome",
    etDate,
    state: "pending_score",
    pressureScore: payload.pressureScore,
    regime: payload.regime,
    admittedAt: new Date(nowMs).toISOString(),
  });
  try {
    await store.insert(key, value, `Scheduled seismograph once-per-session outcome ${etDate}`);
    return "admitted";
  } catch (error) {
    if (isDuplicateKey(error)) return "already_recorded";
    return "unavailable";
  }
}

export async function markScheduledSessionOutcomeScored(
  etDate: string,
  dbProvider: () => Promise<ClaimDb | SessionClaimStore | null> = getDb,
  nowMs = Date.now(),
): Promise<boolean> {
  const store = await resolveStore(dbProvider);
  if (!store) return false;
  const key = scheduledSeismographOutcomeKey(etDate);
  const current = await store.read(key);
  if (!current) return false;
  const parsed = parseOutcome(current);
  if (!parsed || parsed.state === "scored") return parsed?.state === "scored";
  if (parsed.state === "unrecoverable") return false;
  return writeOutcome(store, etDate, current, {
    ...parsed,
    state: "scored",
    reason: undefined,
    scoreLeaseExpiresAt: new Date(nowMs).toISOString(),
  });
}

export interface SessionScoreReconcileOptions {
  nowMs?: number;
  trigger?: string;
  evidenceVerified: boolean;
  readingExists: () => Promise<boolean>;
  recordScore: () => Promise<void>;
}

/**
 * Finish a score that was admitted and then lost before persistence.
 * The outcome compare-and-swap admits exactly one writer. A reading that
 * already exists is marked scored and is not written again. Forward capture
 * is not part of this function.
 */
export async function reconcileScheduledSessionScore(
  etDate: string,
  dbProvider: () => Promise<ClaimDb | SessionClaimStore | null> = getDb,
  options: SessionScoreReconcileOptions,
): Promise<"scored" | "already_scored" | "unrecoverable" | "unavailable"> {
  if (options.trigger !== "SCHEDULED_CRON") return "unavailable";
  const store = await resolveStore(dbProvider);
  if (!store) return "unavailable";
  const nowMs = options.nowMs ?? Date.now();
  const key = scheduledSeismographOutcomeKey(etDate);
  const current = await store.read(key).catch(() => null);
  if (!current) return "unavailable";
  const parsed = parseOutcome(current);
  if (!parsed) return "unavailable";
  if (parsed.state === "scored") return "already_scored";
  if (parsed.state === "unrecoverable") return "unrecoverable";
  if (!outcomeNeedsScore(parsed, nowMs)) return "already_scored";
  const window = nyseSeismographRunWindow(new Date(nowMs));
  const inWindow = window.isScheduledWindow && window.etDate === etDate && options.trigger === "SCHEDULED_CRON";
  if (!inWindow || !options.evidenceVerified) {
    const marked = await writeOutcome(store, etDate, current, {
      ...parsed,
      state: "unrecoverable",
      reason: "skipped: unrecoverable",
    }).catch(() => false);
    return marked ? "unrecoverable" : "unavailable";
  }
  const scoring: OutcomeBody = {
    ...parsed,
    state: "scoring",
    scoreLeaseExpiresAt: new Date(nowMs + SCHEDULED_SESSION_LEASE_MS).toISOString(),
  };
  const won = await writeOutcome(store, etDate, current, scoring).catch(() => false);
  if (!won) return "already_scored";
  const scoringRaw = encodeOutcome(scoring);
  try {
    const exists = await options.readingExists();
    if (!exists) await options.recordScore();
    await writeOutcome(store, etDate, scoringRaw, { ...scoring, state: "scored", reason: undefined });
    return "scored";
  } catch {
    return "unavailable";
  }
}

export interface StaleSessionFinalizeResult {
  status: "finalized" | "unavailable";
  marked: number;
}

/**
 * Mark pending or scoring outcomes `skipped: unrecoverable` when their ET
 * session is not inside the NYSE post-close window at `now`. Today's
 * in-window row is left for reconcile. No score and no forward record.
 * Compare-and-swap makes concurrent finalizers mark each row once.
 */
export async function finalizeStaleScheduledSessionOutcomes(
  dbProvider: () => Promise<ClaimDb | SessionClaimStore | null> = getDb,
  options: { nowMs?: number; trigger?: string } = {},
): Promise<StaleSessionFinalizeResult> {
  if (options.trigger !== "SCHEDULED_CRON") return { status: "unavailable", marked: 0 };
  const store = await resolveStore(dbProvider);
  if (!store || typeof store.listByPrefix !== "function") return { status: "unavailable", marked: 0 };
  const nowMs = options.nowMs ?? Date.now();
  let rows: Array<{ key: string; value: string }>;
  try {
    rows = await store.listByPrefix(SCHEDULED_SEISMOGRAPH_OUTCOME_PREFIX);
  } catch {
    return { status: "unavailable", marked: 0 };
  }
  const window = nyseSeismographRunWindow(new Date(nowMs));
  let marked = 0;
  for (const row of rows) {
    const parsed = parseOutcome(row.value);
    if (!parsed || (parsed.state !== "pending_score" && parsed.state !== "scoring")) continue;
    const open = window.isScheduledWindow && window.etDate === parsed.etDate;
    if (open) continue;
    const next = encodeOutcome({
      ...parsed,
      state: "unrecoverable",
      reason: "skipped: unrecoverable",
    });
    const won = await store.cas(row.key, row.value, next).catch(() => false);
    if (won) marked += 1;
  }
  return { status: "finalized", marked };
}
