import { afterEach, describe, expect, it, vi } from "vitest";
import { runScheduledSeismographForTests } from "./scheduledSeismograph";
import {
  admitScheduledSessionOutcome,
  claimScheduledSeismographSession,
  completeScheduledSession,
  failScheduledSession,
  markScheduledSessionOutcomeScored,
  isHiddenSessionMemoryKey,
  scheduledSeismographClaimKey,
  type SessionClaimStore,
} from "./scheduledSessionClaim";

function memoryStore(): SessionClaimStore & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    async read(key) {
      return rows.get(key) ?? null;
    },
    async insert(key, value) {
      if (rows.has(key)) {
        throw Object.assign(new Error(`Duplicate entry '${key}'`), { code: "ER_DUP_ENTRY", errno: 1062 });
      }
      rows.set(key, value);
    },
    async cas(key, previous, next) {
      if (rows.get(key) !== previous) return false;
      rows.set(key, next);
      return true;
    },
  };
}

const inWindow = Date.parse("2026-10-05T20:20:00.000Z");
const outsideWindow = Date.parse("2026-10-05T21:00:00.000Z");

describe("scheduled seismograph database claim", () => {
  afterEach(() => vi.useRealTimers());

  it("lets exactly one of many parallel callers claim a session", async () => {
    const store = memoryStore();
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      claimScheduledSeismographSession("2026-10-05", async () => store, { trigger: "SCHEDULED_CRON" })));
    expect(results.filter(result => result.status === "claimed")).toHaveLength(1);
    expect(results.filter(result => result.status === "incomplete")).toHaveLength(7);
    expect(store.rows.has(scheduledSeismographClaimKey("2026-10-05"))).toBe(true);
  });

  it("fails closed when the database is absent and does not start the run", async () => {
    await expect(claimScheduledSeismographSession("2026-10-05", async () => null)).resolves.toEqual({ status: "unavailable" });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T20:15:00.000Z"));
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await runScheduledSeismographForTests({ json, status } as never, { sessionClaim: async () => "unavailable" });
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, skipped: "session_claim_unavailable" }));
  });

  it("treats a restarted caller with a live lease as incomplete, not completed", async () => {
    const store = memoryStore();
    await claimScheduledSeismographSession("2026-11-02", async () => store, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    await expect(claimScheduledSeismographSession("2026-11-02", async () => store, {
      nowMs: inWindow + 1000,
      trigger: "SCHEDULED_CRON",
    })).resolves.toEqual({ status: "incomplete", generation: 1 });
    const stored = [...store.rows.values()].join("\n");
    expect(stored).toContain("\"disposition\":\"incomplete\"");
    expect(stored).not.toContain("\"state\":\"completed\"");
  });

  it("recovers a failed claim once inside the window and refuses a second recoverer", async () => {
    const store = memoryStore();
    const first = await claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    expect(first).toEqual({ status: "claimed", generation: 1, mode: "initial" });
    await expect(failScheduledSession("2026-10-05", 1, async () => store, inWindow)).resolves.toBe(true);

    const recovered = await Promise.all([
      claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow + 1000, trigger: "SCHEDULED_CRON" }),
      claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow + 1000, trigger: "SCHEDULED_CRON" }),
    ]);
    expect(recovered.filter(result => result.status === "claimed" && result.mode === "recovered")).toHaveLength(1);
    expect(recovered.filter(result => result.status === "incomplete")).toHaveLength(1);
  });

  it("refuses recovery outside the window, after completion, and after an outcome exists", async () => {
    const expired = memoryStore();
    const claimed = await claimScheduledSeismographSession("2026-10-05", async () => expired, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    await failScheduledSession("2026-10-05", claimed.generation!, async () => expired, inWindow);
    await expect(claimScheduledSeismographSession("2026-10-05", async () => expired, {
      nowMs: outsideWindow,
      trigger: "SCHEDULED_CRON",
    })).resolves.toEqual({ status: "incomplete", generation: 1 });

    const done = memoryStore();
    const won = await claimScheduledSeismographSession("2026-10-05", async () => done, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    await completeScheduledSession("2026-10-05", won.generation!, async () => done, inWindow);
    await expect(claimScheduledSeismographSession("2026-10-05", async () => done, {
      nowMs: inWindow + 1000,
      trigger: "SCHEDULED_CRON",
    })).resolves.toEqual({ status: "already_claimed" });

    const recorded = memoryStore();
    const open = await claimScheduledSeismographSession("2026-10-05", async () => recorded, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    await admitScheduledSessionOutcome("2026-10-05", { pressureScore: 42, regime: "MODERATE RISK" }, async () => recorded, inWindow);
    await failScheduledSession("2026-10-05", open.generation!, async () => recorded, inWindow);
    await expect(claimScheduledSeismographSession("2026-10-05", async () => recorded, {
      nowMs: inWindow + 1000,
      trigger: "SCHEDULED_CRON",
    })).resolves.toMatchObject({ status: "reconcile", mode: "reconcile" });
    await expect(admitScheduledSessionOutcome("2026-10-05", { pressureScore: 99, regime: "OTHER" }, async () => recorded, inWindow))
      .resolves.toBe("already_recorded");

    const scored = memoryStore();
    const scoredClaim = await claimScheduledSeismographSession("2026-10-05", async () => scored, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    await admitScheduledSessionOutcome("2026-10-05", { pressureScore: 42, regime: "MODERATE RISK" }, async () => scored, inWindow);
    await markScheduledSessionOutcomeScored("2026-10-05", async () => scored, inWindow);
    await failScheduledSession("2026-10-05", scoredClaim.generation!, async () => scored, inWindow);
    await expect(claimScheduledSeismographSession("2026-10-05", async () => scored, {
      nowMs: inWindow + 1000,
      trigger: "SCHEDULED_CRON",
    })).resolves.toEqual({ status: "already_claimed" });
  });

  it("marks a claim failed when the pipeline returns 500, then allows one recovery", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(inWindow));
    const store = memoryStore();
    const claimed = await claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await runScheduledSeismographForTests({ json, status } as never, {
      sessionClaim: async () => claimed,
      sessionStore: async () => store,
      runPipeline: async () => {
        throw new Error("pipeline crashed after claim");
      },
    });
    expect(status).toHaveBeenCalledWith(500);
    const recovered = await claimScheduledSeismographSession("2026-10-05", async () => store, {
      nowMs: inWindow + 1000,
      trigger: "SCHEDULED_CRON",
    });
    expect(recovered).toEqual({ status: "claimed", generation: 2, mode: "recovered" });
  });

  it("does not report a crash mid-run as already completed, then allows one retry after the lease expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(inWindow));
    const store = memoryStore();
    const claimed = await claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    expect(claimed).toMatchObject({ status: "claimed", generation: 1 });
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await runScheduledSeismographForTests({ json, status } as never, {
      sessionClaim: async () => ({ status: "incomplete" as const, generation: 1 }),
      sessionStore: async () => store,
      runPipeline: async () => {
        throw new Error("pipeline must not run for an incomplete claim");
      },
    });
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      skipped: "session_incomplete",
      execution: "in_progress",
    }));
    expect(json).not.toHaveBeenCalledWith(expect.objectContaining({ execution: "already_completed" }));

    const stillHeld = await claimScheduledSeismographSession("2026-10-05", async () => store, {
      nowMs: inWindow + 1000,
      trigger: "SCHEDULED_CRON",
    });
    expect(stillHeld).toEqual({ status: "incomplete", generation: 1 });

    const expiredLease = inWindow + 3 * 60 * 1000 + 1;
    const retried = await claimScheduledSeismographSession("2026-10-05", async () => store, {
      nowMs: expiredLease,
      trigger: "SCHEDULED_CRON",
    });
    expect(retried).toEqual({ status: "claimed", generation: 2, mode: "recovered" });
  });

  it("keeps a completed duplicate idempotent and refuses a second concurrent pipeline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(inWindow));
    const store = memoryStore();
    const won = await claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    await completeScheduledSession("2026-10-05", won.generation!, async () => store, inWindow);
    const pipeline = vi.fn();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await runScheduledSeismographForTests({ json, status } as never, {
      sessionClaim: async () => claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow + 1000, trigger: "SCHEDULED_CRON" }),
      sessionStore: async () => store,
      runPipeline: pipeline,
    });
    expect(pipeline).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      skipped: "session_already_claimed",
      execution: "already_completed",
    }));
  });

  it("hides claim and outcome keys from public market memory", () => {
    expect(isHiddenSessionMemoryKey("seismograph-scheduled-session:2026-10-05")).toBe(true);
    expect(isHiddenSessionMemoryKey("seismograph-scheduled-outcome:2026-10-05")).toBe(true);
    expect(isHiddenSessionMemoryKey("seismograph:latest_output")).toBe(false);
  });
});
