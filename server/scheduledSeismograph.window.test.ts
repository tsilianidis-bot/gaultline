import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { claimScheduledSeismographSession, type SessionClaimStore } from "./scheduledSessionClaim";
import { runScheduledSeismographForTests } from "./scheduledSeismograph";

function memoryStore(): SessionClaimStore {
  const rows = new Map<string, string>();
  return {
    async read(key) { return rows.get(key) ?? null; },
    async insert(key, value) {
      if (rows.has(key)) throw Object.assign(new Error(`Duplicate entry '${key}'`), { code: "ER_DUP_ENTRY", errno: 1062 });
      rows.set(key, value);
    },
    async cas(key, previous, next) {
      if (rows.get(key) !== previous) return false;
      rows.set(key, next);
      return true;
    },
  };
}

function response() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { json, status, res: { json, status } };
}

describe("scheduled Seismograph NYSE admission", () => {
  afterEach(() => vi.useRealTimers());

  it("returns an explicit non-writing skip outside the valid post-close session window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T21:15:00.000Z")); // Thanksgiving, 16:15 EST
    const { json, status, res } = response();

    await runScheduledSeismographForTests(res as never);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      alert: false,
      skipped: "outside_nyse_post_close_window",
      session: "CLOSED",
      etDate: "2026-11-26",
    }));
  });

  it.each([
    ["EDT admitted hour", "2026-03-09T20:15:00.000Z"],
    ["EST admitted hour", "2026-11-02T21:15:00.000Z"],
  ])("accepts the %s of 15 20,21 UTC", async (_name, iso) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    const store = memoryStore();
    const { json, status, res } = response();
    await runScheduledSeismographForTests(res as never, {
      sessionClaim: etDate => claimScheduledSeismographSession(etDate, async () => store, { nowMs: Date.parse(iso), trigger: "SCHEDULED_CRON" }),
      sessionStore: async () => store,
      runPipeline: async () => ({
        output: {
          pressureScore: 41,
          regime: "MODERATE RISK",
          stressLevel: "Moderate",
          direction: "Stable",
          activeContributors: [],
          evidenceConsensus: null,
          activePatterns: [],
          dataFreshness: "delayed",
        },
        disposition: "executed",
      }),
    });
    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, pressureScore: 41 }));
  });

  it.each([
    ["EDT companion 21:15 UTC", "2026-03-09T21:15:00.000Z"],
    ["EST companion 20:15 UTC", "2026-11-02T20:15:00.000Z"],
  ])("rejects the %s so only one session run is admitted", async (_name, iso) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    const pipeline = vi.fn();
    const { json, status, res } = response();
    await runScheduledSeismographForTests(res as never, { runPipeline: pipeline });
    expect(pipeline).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      alert: false,
      skipped: "dst_companion_outside_window",
    }));
  });

  it("rejects the production 18:00 UTC cron instead of reporting success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T18:00:00.000Z"));
    const { json, status, res } = response();
    await runScheduledSeismographForTests(res as never);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      skipped: "outside_nyse_post_close_window",
    }));
  });

  it("returns 500 when the finished run cannot seal the session claim", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T20:20:00.000Z"));
    const { json, status, res } = response();
    await runScheduledSeismographForTests(res as never, {
      sessionClaim: async () => ({ status: "claimed", generation: 1 }),
      sessionStore: async () => ({
        read: async () => null,
        insert: async () => undefined,
        cas: async () => false,
      }),
      runPipeline: async () => ({
        output: {
          pressureScore: 41,
          regime: "MODERATE RISK",
          stressLevel: "Moderate",
          direction: "Stable",
          activeContributors: [],
          evidenceConsensus: null,
          activePatterns: [],
          dataFreshness: "delayed",
        },
        disposition: "executed",
      }),
    });
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      alert: true,
      error: "Scheduled run finished but the session claim was not marked completed.",
    }));
  });

  it("keeps test hooks off the production request handler", () => {
    const source = readFileSync(new URL("./scheduledSeismograph.ts", import.meta.url), "utf8");
    const start = source.indexOf("export function handleScheduledSeismograph");
    const end = source.indexOf("export function runScheduledSeismographForTests");
    const production = source.slice(start, end);
    expect(production).not.toContain("sessionClaim");
    expect(production).not.toContain("sessionStore");
    expect(production).not.toContain("runPipeline");
  });
});
