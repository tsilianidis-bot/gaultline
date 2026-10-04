/**
 * Sector Rotation post-close collector (in-process; no cron, no env var).
 *
 *   post-close collector → persisted, versioned snapshot (snapshotStore) → read-only UI
 *
 *  - Builds at most once per completed session (4 PM ET + 60 min, weekdays), plus a
 *    single boot-time check that builds only if the latest completed session has no
 *    saved snapshot. Page loads NEVER build: `served()` reads memory / the store only.
 *  - Bounded, paced fan-out (SECTOR_ROTATION_COLLECTOR_POLICY), an overall build timeout,
 *    finite retries with exponential backoff, and a circuit breaker on HTTP 429.
 *  - A failed or partial build is never saved; the last valid snapshot is served as STALE.
 */
import {
  SECTOR_ROTATION_COLLECTOR_POLICY as POLICY,
  type SectorRotationReading, type SectorRotationServed,
} from "../../shared/sectorRotation";
import { buildSectorRotationReading, etDate, etWallToUtc, sessionCompletedAt, type SectorRotationInputs } from "./calc";
import { SnapshotTooLargeError, encodeSnapshot, type SnapshotStore, type StoredSnapshot } from "./snapshotStore";

const MIN = 60_000;

/** Shared, mutable budget for one fan-out. Workers stop issuing requests once `aborted` is set. */
export interface FanoutBudget {
  deadline: number;
  aborted: boolean;
  abortReason: string | null;
  rateLimited: boolean;
  requests: number;
}
export const newBudget = (now: number): FanoutBudget => ({ deadline: now + POLICY.buildTimeoutMinutes * MIN, aborted: false, abortReason: null, rateLimited: false, requests: 0 });
export function abortBudget(b: FanoutBudget, reason: string, rateLimited = false) {
  if (!b.aborted) { b.aborted = true; b.abortReason = reason; }
  if (rateLimited) b.rateLimited = true;
}

const isWeekday = (d: string) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return w !== 0 && w !== 6; };
const prevDay = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
/** Latest weekday whose session has completed (4 PM ET + 60 min) at `now`. Market holidays are resolved by the provider's bars. */
export function latestCompletedSession(now: number): string {
  let d = etDate(now);
  for (let i = 0; i < 10; i++) { if (isWeekday(d) && sessionCompletedAt(d) <= now) return d; d = prevDay(d); }
  return d;
}
const hm = (s: string) => s.split(":").map(Number) as [number, number];
export function inQuietWindow(now: number): boolean {
  const d = etDate(now);
  if (!isWeekday(d)) return false;
  const [sh, sm] = hm(POLICY.quietWindowEt.start); const [eh, em] = hm(POLICY.quietWindowEt.end);
  return now >= etWallToUtc(d, sh, sm) && now < etWallToUtc(d, eh, em);
}
export const backoffMs = (attempt: number) => Math.min(POLICY.backoffBaseMinutes * 2 ** Math.max(0, attempt - 1), POLICY.backoffCapMinutes) * MIN;

export type TickOutcome = "RUNNING" | "NOT_DUE" | "CIRCUIT_OPEN" | "BACKOFF" | "GAVE_UP" | "QUIET_WINDOW" | "STORE_UNAVAILABLE" | "PERSISTED" | "ALREADY_PERSISTED" | "NO_NEW_SESSION" | "FAILED";

export interface CollectorDeps {
  now: () => number;
  store: SnapshotStore;
  /** Performs the (paced) fan-out under `budget`. Only the collector calls this. */
  collect: (budget: FanoutBudget) => Promise<SectorRotationInputs>;
  build?: (inputs: SectorRotationInputs) => SectorRotationReading;
  log?: { info: (m: string) => void; warn: (m: string) => void };
}

/** Why a built reading is not a valid snapshot (null when it is). A partial ranking is never saved. */
export function invalidReason(reading: SectorRotationReading, budget: FanoutBudget): string | null {
  if (budget.rateLimited) return `Provider rate limit (HTTP 429): ${budget.abortReason ?? "build aborted"}`;
  if (budget.aborted) return `Build aborted: ${budget.abortReason ?? "timeout"}`;
  if (reading.status === "UNAVAILABLE" || !reading.benchmark.latestCompletedSession) return `Benchmark unavailable: ${reading.benchmark.reason ?? "no completed SPY session"}`;
  if (reading.movers.status === "UNAVAILABLE") return `Top movers unavailable: ${reading.movers.reason ?? "unknown"}`;
  return null;
}

export class SectorRotationCollector {
  private latest: StoredSnapshot | null = null;
  private loadedAt = -Infinity;
  private loading: Promise<void> | null = null;
  private storeAvailable: boolean | null = null;
  private confirmedTarget: string | null = null;
  private attempts = new Map<string, number>();
  private nextAttemptAt = 0;
  private circuitOpenUntil = 0;
  private running: Promise<TickOutcome> | null = null;
  private lastRefresh: SectorRotationServed["lastRefresh"] = { attemptedAt: null, outcome: null, detail: null, nextAttemptAfter: null };
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  /** Fan-outs started (instrumentation for tests and logs). */
  fanouts = 0;

  constructor(private readonly deps: CollectorDeps) {}

  private log(level: "info" | "warn", m: string) { this.deps.log?.[level](`[SectorRotation] ${m}`); }

  /** Store read only (never a fan-out). */
  private async loadLatest(force = false): Promise<void> {
    const now = this.deps.now();
    if (!force && now - this.loadedAt < POLICY.storeReloadMinutes * MIN) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        this.storeAvailable = await this.deps.store.isAvailable();
        if (this.storeAvailable) {
          const s = await this.deps.store.loadLatest();
          if (s && (!this.latest || s.meta.sessionDate >= this.latest.meta.sessionDate)) this.latest = s;
        }
      } catch (error) {
        this.log("warn", `Snapshot store read failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this.loadedAt = this.deps.now();
        this.loading = null;
      }
    })();
    return this.loading;
  }

  private record(outcome: "SUCCEEDED" | "FAILED" | "SKIPPED", detail: string, nextAttemptAt: number | null) {
    this.lastRefresh = { attemptedAt: new Date(this.deps.now()).toISOString(), outcome, detail, nextAttemptAfter: nextAttemptAt == null ? null : new Date(nextAttemptAt).toISOString() };
  }

  /** One scheduling decision; builds only when a completed session lacks a snapshot and no guard blocks it. */
  tick(): Promise<TickOutcome> {
    if (this.running) return Promise.resolve("RUNNING");
    this.running = this.runTick().finally(() => { this.running = null; });
    return this.running;
  }

  private async runTick(): Promise<TickOutcome> {
    const now = this.deps.now();
    const target = latestCompletedSession(now);
    await this.loadLatest();
    if (this.latest && this.latest.meta.sessionDate >= target) return "NOT_DUE";
    if (this.confirmedTarget === target) return "NOT_DUE";
    if (now < this.circuitOpenUntil) return "CIRCUIT_OPEN";
    if (now < this.nextAttemptAt) return "BACKOFF";
    const attempt = (this.attempts.get(target) ?? 0) + 1;
    if (attempt > POLICY.maxAttemptsPerSession) return "GAVE_UP";
    if (inQuietWindow(now)) return "QUIET_WINDOW";
    if (!this.storeAvailable) {
      this.nextAttemptAt = now + POLICY.circuitOpenMinutes * MIN;
      this.record("SKIPPED", "Snapshot store unavailable; no build without somewhere to save it.", this.nextAttemptAt);
      return "STORE_UNAVAILABLE";
    }
    // Another instance may have saved it already.
    await this.loadLatest(true);
    if (this.latest && this.latest.meta.sessionDate >= target) return "NOT_DUE";

    this.attempts.set(target, attempt);
    const budget = newBudget(now);
    this.fanouts += 1;
    this.log("info", `Building snapshot for session ${target} (attempt ${attempt}/${POLICY.maxAttemptsPerSession}).`);
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { abortBudget(budget, `overall build timeout (${POLICY.buildTimeoutMinutes} min)`); reject(new Error("timeout")); }, POLICY.buildTimeoutMinutes * MIN); (timer as { unref?: () => void }).unref?.(); });
      const inputs = await Promise.race([this.deps.collect(budget), timeout]);
      const reading = (this.deps.build ?? buildSectorRotationReading)(inputs);
      const invalid = invalidReason(reading, budget);
      if (invalid) return this.fail(target, attempt, invalid, budget.rateLimited);
      const session = reading.benchmark.latestCompletedSession!;
      if (session < target) this.confirmedTarget = target; // provider has no newer completed session (e.g. market holiday)
      if (this.latest && session <= this.latest.meta.sessionDate) {
        this.record("SUCCEEDED", `No newer completed session than ${this.latest.meta.sessionDate} from the provider.`, null);
        return "NO_NEW_SESSION";
      }
      const { snapshot } = encodeSnapshot(reading);
      const result = await this.deps.store.insert(snapshot);
      await this.loadLatest(true);
      if (!this.latest || this.latest.meta.sessionDate < session) this.latest = snapshot;
      this.record("SUCCEEDED", `Saved snapshot for session ${session}.`, null);
      this.log("info", `Snapshot for ${session} ${result === "INSERTED" ? "saved" : "already saved by another instance"} (${budget.requests} provider requests).`);
      return result === "INSERTED" ? "PERSISTED" : "ALREADY_PERSISTED";
    } catch (error) {
      const message = error instanceof SnapshotTooLargeError ? error.message : `Build failed: ${error instanceof Error ? error.message : String(error)}`;
      return this.fail(target, attempt, budget.aborted ? `Build aborted: ${budget.abortReason}` : message, budget.rateLimited);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private fail(target: string, attempt: number, detail: string, rateLimited: boolean): TickOutcome {
    const now = this.deps.now();
    if (rateLimited) this.circuitOpenUntil = now + POLICY.circuitOpenMinutes * MIN;
    const exhausted = attempt >= POLICY.maxAttemptsPerSession;
    this.nextAttemptAt = Math.max(now + backoffMs(attempt), this.circuitOpenUntil);
    this.record("FAILED", `${detail}${exhausted ? ` No further attempts for session ${target}.` : ""}`, exhausted ? null : this.nextAttemptAt);
    this.log("warn", `Snapshot build for ${target} failed (attempt ${attempt}): ${detail}`);
    return "FAILED";
  }

  /** Read-only view for the public query: memory / store only, never a fan-out. */
  async served(): Promise<SectorRotationServed> {
    await this.loadLatest();
    const now = this.deps.now();
    const target = latestCompletedSession(now);
    const base = { expectedSession: target, lastRefresh: this.lastRefresh };
    if (!this.latest) {
      const reason = this.storeAvailable === false
        ? "Snapshot store unavailable. Sector rotation is computed only by the post-close collector and saved; it is never computed from page traffic."
        : `No saved sector rotation snapshot yet. The post-close collector builds one after each completed session (4 PM ET + 60 min).${this.lastRefresh.outcome === "FAILED" ? ` Last attempt: ${this.lastRefresh.detail}` : ""}`;
      return { ...base, freshness: "UNAVAILABLE", freshnessReason: reason, snapshot: null, reading: null };
    }
    const current = this.latest.meta.sessionDate >= target || this.confirmedTarget === target;
    if (current) return { ...base, freshness: "CURRENT", freshnessReason: null, snapshot: this.latest.meta, reading: this.latest.reading };
    const why = this.running ? "refresh in progress"
      : this.lastRefresh.outcome === "FAILED" ? `refresh failed: ${this.lastRefresh.detail}`
      : this.lastRefresh.outcome === "SKIPPED" ? `refresh skipped: ${this.lastRefresh.detail}`
      : "refresh pending (the collector runs after each completed session)";
    return { ...base, freshness: "STALE", freshnessReason: `Showing the last valid snapshot (session ${this.latest.meta.sessionDate}); session ${target}: ${why}`, snapshot: this.latest.meta, reading: this.latest.reading };
  }

  /** Boot: one delayed check, then a check every tickIntervalMinutes. Timers are unref'd. */
  start() {
    if (this.timers.length) return;
    const boot = setTimeout(() => { void this.tick(); }, POLICY.bootDelaySeconds * 1000);
    const every = setInterval(() => { void this.tick(); }, POLICY.tickIntervalMinutes * MIN);
    (boot as { unref?: () => void }).unref?.(); (every as { unref?: () => void }).unref?.();
    this.timers.push(boot, every);
  }
  stop() { for (const t of this.timers) { clearTimeout(t); clearInterval(t); } this.timers = []; }
}
