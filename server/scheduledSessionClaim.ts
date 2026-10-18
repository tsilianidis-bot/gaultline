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
 * and no `seismograph-scheduled-outcome:YYYY-MM-DD` row exists. The outcome row is
 * insert-only and is written after pressure verification and before the daily
 * score upsert. Two recoverers cannot both win the swap. A second pipeline cannot
 * pass the outcome insert, so it cannot write a second score or a second forward
 * record for that session. Champion provenance stays unique on its own key.
 *
 * Fail-closed: a missing database, a missing table, or any error other than a
 * duplicate key returns `unavailable` and the caller must not run the pipeline.
 */
import { and, eq } from "drizzle-orm";
import { marketMemory } from "../drizzle/schema";
import { getDb } from "./db";
import { nyseSeismographRunWindow } from "../shared/nyseSession";

export const SCHEDULED_SEISMOGRAPH_CLAIM_PREFIX = "seismograph-scheduled-session:";
export const SCHEDULED_SEISMOGRAPH_OUTCOME_PREFIX = "seismograph-scheduled-outcome:";
export const SCHEDULED_SESSION_LEASE_MS = 3 * 60 * 1000;

export type ScheduledSessionClaimStatus = "claimed" | "already_claimed" | "unavailable";

export interface ScheduledSessionClaimResult {
  status: ScheduledSessionClaimStatus;
  generation?: number;
  mode?: "initial" | "recovered";
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
}

type ClaimState = "leased" | "completed" | "failed";

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
    if (value.state !== "leased" && value.state !== "completed" && value.state !== "failed") return null;
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
  const leaseExpiresAt = Date.parse(parsed.leaseExpiresAt);
  const leaseHeld = parsed.state === "leased" && Number.isFinite(leaseExpiresAt) && leaseExpiresAt > nowMs;
  if (leaseHeld) return { status: "already_claimed" };
  const recoverable = parsed.state === "failed" || (Number.isFinite(leaseExpiresAt) && leaseExpiresAt <= nowMs);
  if (!recoverable || trigger !== "SCHEDULED_CRON") return { status: "already_claimed" };
  const window = nyseSeismographRunWindow(new Date(nowMs));
  if (!window.isScheduledWindow || window.etDate !== etDate) return { status: "already_claimed" };
  let outcome: string | null;
  try {
    outcome = await store.read(scheduledSeismographOutcomeKey(etDate));
  } catch {
    return { status: "already_claimed" };
  }
  if (outcome) return { status: "already_claimed" };
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
  const value = JSON.stringify({
    kind: "seismograph-scheduled-outcome",
    etDate,
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
