import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { capturesForwardEvidence, isInScheduledWindow, resolveRunContext, selectEvaluatedDailyStates, stateOrigin, type LedgerStateRow } from "./forwardRunProvenance";
import { captureChampionProvenanceForRun, collectForwardOutcomesForRun } from "./scheduledSeismograph";

describe("run trigger provenance (A1)", () => {
  it("trigger matrix", () => {
    const inWin = new Date("2026-10-05T18:00:03Z");
    const outWin = new Date("2026-10-05T17:06:00Z");
    expect(resolveRunContext("cron-endpoint", inWin)).toEqual({ trigger: "SCHEDULED_CRON", triggerSource: "cron-endpoint", runStartedAt: "2026-10-05T18:00:03.000Z", scheduledWindow: true });
    expect(resolveRunContext("cron-endpoint", outWin).trigger).toBe("CRON_DEPLOY");
    expect(resolveRunContext("admin-seedNow", inWin).trigger).toBe("MANUAL");
    expect(resolveRunContext("backfill-recovery", inWin).trigger).toBe("BACKFILL_RECOVERY");
    expect(resolveRunContext("unspecified", inWin).trigger).toBe("AD_HOC");
  });

  it("window is [18:00, 18:30) UTC", () => {
    expect(isInScheduledWindow("2026-10-05T17:59:59Z")).toBe(false);
    expect(isInScheduledWindow("2026-10-05T18:00:00Z")).toBe(true);
    expect(isInScheduledWindow("2026-10-05T18:29:59Z")).toBe(true);
    expect(isInScheduledWindow("2026-10-05T18:30:00Z")).toBe(false);
    expect(isInScheduledWindow("not a date")).toBe(false);
  });

  it("only SCHEDULED_CRON captures forward evidence", () => {
    for (const t of ["CRON_DEPLOY", "MANUAL", "AD_HOC", "BACKFILL_RECOVERY"] as const) expect(capturesForwardEvidence({ trigger: t })).toBe(false);
    expect(capturesForwardEvidence({ trigger: "SCHEDULED_CRON" })).toBe(true);
    expect(capturesForwardEvidence(null)).toBe(false);
  });
});

describe("scheduled vs ad-hoc on the same day (A5)", () => {
  const pressure = { overallPressure: 30, regime: "MODERATE RISK" } as any;

  it("only the scheduled run records Champion provenance and collects outcomes", async () => {
    const record = vi.fn(async () => ({ id: 21, created: true }));
    const collect = vi.fn(async () => ({ appended: 0, deferred: 0, reasons: {} }));
    const scheduled = resolveRunContext("cron-endpoint", new Date("2026-10-05T18:00:02Z"));
    const adhoc = resolveRunContext("admin-seedNow", new Date("2026-10-05T15:00:00Z"));
    const deploy = resolveRunContext("cron-endpoint", new Date("2026-10-05T17:06:00Z"));

    for (const ctx of [adhoc, deploy, resolveRunContext("unspecified", new Date("2026-10-05T18:05:00Z"))]) {
      expect(await captureChampionProvenanceForRun(ctx, pressure, "2026-10-05T18:05:00.000Z", record)).toMatchObject({ status: "NOT_CAPTURED_NON_SCHEDULED_RUN", championProvenanceId: null });
      expect(await collectForwardOutcomesForRun(ctx, collect)).toEqual({ collected: false });
    }
    expect(record).not.toHaveBeenCalled();
    expect(collect).not.toHaveBeenCalled();

    const link = await captureChampionProvenanceForRun(scheduled, pressure, "2026-10-05T18:00:09.000Z", record);
    expect(link).toEqual({ status: "CAPTURED", championProvenanceKey: "champion-forward:2026-10-05:v1-forward-provenance-2026-08-19", championProvenanceId: 21, championProvenanceCreatedByThisRun: true, outcomeKeyVersion: "v2" });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][1]).toEqual(new Date("2026-10-05T18:00:09.000Z"));
    expect(await collectForwardOutcomesForRun(scheduled, collect)).toEqual({ collected: true });
    expect(collect).toHaveBeenCalledTimes(1);
  });

  it("provenance failures are non-blocking and recorded on the link", async () => {
    const scheduled = resolveRunContext("cron-endpoint", new Date("2026-10-05T18:00:02Z"));
    const link = await captureChampionProvenanceForRun(scheduled, pressure, "2026-10-05T18:00:09.000Z", async () => { throw new Error("db down"); });
    expect(link).toMatchObject({ status: "PROVENANCE_CAPTURE_FAILED", championProvenanceId: null, championProvenanceCreatedByThisRun: false });
    const existing = await captureChampionProvenanceForRun(scheduled, pressure, "2026-10-05T18:00:09.000Z", async () => ({ id: 20, created: false }));
    expect(existing).toMatchObject({ status: "DAY_ALREADY_CAPTURED", championProvenanceCreatedByThisRun: false });
  });

  it("the evaluated daily state is the scheduled one even when an ad-hoc run came first or later", () => {
    const rows: LedgerStateRow[] = [
      { stateId: "adhoc-morning", originatingRunId: "a", generatedAt: "2026-10-05T15:00:00.000Z", pressureIndex: 31, regime: "MODERATE RISK", runProvenance: { trigger: "MANUAL" } },
      { stateId: "sched", originatingRunId: "s", generatedAt: "2026-10-05T18:00:10.000Z", pressureIndex: 30, regime: "MODERATE RISK", runProvenance: { trigger: "SCHEDULED_CRON" } },
      { stateId: "deploy-later", originatingRunId: "d", generatedAt: "2026-10-05T18:10:00.000Z", pressureIndex: 32, regime: "MODERATE RISK", runProvenance: { trigger: "CRON_DEPLOY" } },
      { stateId: "legacy-adhoc", originatingRunId: "l1", generatedAt: "2026-09-15T00:26:00.000Z", pressureIndex: 28, regime: "MODERATE RISK" },
      { stateId: "legacy-cron", originatingRunId: "l2", generatedAt: "2026-09-15T18:00:20.000Z", pressureIndex: 33, regime: "MODERATE RISK" },
      { stateId: "late-insert", originatingRunId: "l3", generatedAt: "2026-09-16T18:00:20.000Z", createdAt: "2026-09-16T19:00:00.000Z", pressureIndex: 33, regime: "MODERATE RISK" },
      { stateId: "correction", originatingRunId: "c", generatedAt: "2026-09-17T18:00:20.000Z", pressureIndex: 33, regime: "MODERATE RISK", runProvenance: { recordClass: "LIVE_FORWARD_CORRECTION" } },
    ];
    const evaluated = selectEvaluatedDailyStates(rows);
    expect(evaluated.get("2026-10-05")?.stateId).toBe("sched");
    expect(evaluated.get("2026-09-15")?.stateId).toBe("legacy-cron");
    expect(evaluated.has("2026-09-14")).toBe(false); // 09-15T00:26Z is 09-14 ET: ad hoc, not evaluated
    expect(evaluated.has("2026-09-16")).toBe(false);
    expect(evaluated.has("2026-09-17")).toBe(false);
    expect(stateOrigin(rows[0])).toBe("NON_SCHEDULED");
    // two in-window rows on one ET day (e.g. scheduled + a CRON_DEPLOY indistinguishable in legacy rows): first wins
    const twin = selectEvaluatedDailyStates([
      { stateId: "second", originatingRunId: "2", generatedAt: "2026-09-22T18:10:00.000Z", pressureIndex: 30, regime: "MODERATE RISK" },
      { stateId: "first", originatingRunId: "1", generatedAt: "2026-09-22T18:00:10.000Z", pressureIndex: 29, regime: "MODERATE RISK" },
    ]);
    expect(twin.get("2026-09-22")?.stateId).toBe("first");
    expect(stateOrigin(rows[3])).toBe("LEGACY_OUTSIDE_WINDOW");
  });
});

describe("trigger wiring at the call sites (A1)", () => {
  const source = (p: string) => readFileSync(resolve(import.meta.dirname, "..", p), "utf8");
  it("cron endpoint, admin seedNow and the v1 collector retirement", () => {
    const ss = source("server/scheduledSeismograph.ts");
    const router = source("server/routers/seismograph.ts");
    expect(ss).toMatch(/const runContext = resolveRunContext\("cron-endpoint", new Date\(\)\);\s*try \{\s*const seismographOutput = await runSeismographPipeline\(\{ runContext \}\);/);
    expect(router).toMatch(/seedNow:\s*adminProcedure\.mutation\(async \(\) => \{[\s\S]{0,200}runSeismographPipeline\(\{ runContext: resolveRunContext\("admin-seedNow"\) \}\)/);
    expect(ss).not.toMatch(/collectForwardChampionOutcomes\(/);
    expect(ss).toMatch(/const runContext = options\.runContext \?\? resolveRunContext\("unspecified"\);/);
  });
});
