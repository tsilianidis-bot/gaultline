import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { capturesForwardEvidence, isInScheduledWindow, resolveRunContext, selectEvaluatedDailyStates, stateOrigin, type LedgerStateRow } from "./forwardRunProvenance";
import { captureChampionProvenanceForRun, collectForwardOutcomesForRun } from "./scheduledSeismograph";

describe("run trigger provenance (A1)", () => {
  it("uses a DST-aware, post-close NYSE trigger matrix", () => {
    const inWindow = new Date("2026-10-05T20:15:03Z"); // 16:15 EDT
    const outsideWindow = new Date("2026-10-05T17:06:00Z");
    expect(resolveRunContext("cron-endpoint", inWindow)).toEqual({ trigger: "SCHEDULED_CRON", triggerSource: "cron-endpoint", runStartedAt: "2026-10-05T20:15:03.000Z", scheduledWindow: true });
    expect(resolveRunContext("cron-endpoint", outsideWindow).trigger).toBe("CRON_DEPLOY");
    expect(resolveRunContext("admin-seedNow", inWindow).trigger).toBe("MANUAL");
    expect(resolveRunContext("backfill-recovery", inWindow).trigger).toBe("BACKFILL_RECOVERY");
    expect(resolveRunContext("unspecified", inWindow).trigger).toBe("AD_HOC");
  });

  it("admits only the 4:15–4:45 PM New York market-session window", () => {
    expect(isInScheduledWindow("2026-10-05T20:14:59Z")).toBe(false); // 16:14:59 EDT
    expect(isInScheduledWindow("2026-10-05T20:15:00Z")).toBe(true);
    expect(isInScheduledWindow("2026-10-05T20:44:59Z")).toBe(true);
    expect(isInScheduledWindow("2026-10-05T20:45:00Z")).toBe(false);
    expect(isInScheduledWindow("2026-10-05T18:00:00Z")).toBe(false); // old pre-close callback
    expect(isInScheduledWindow("not a date")).toBe(false);
  });

  it("only SCHEDULED_CRON captures forward evidence", () => {
    for (const trigger of ["CRON_DEPLOY", "MANUAL", "AD_HOC", "BACKFILL_RECOVERY"] as const) expect(capturesForwardEvidence({ trigger })).toBe(false);
    expect(capturesForwardEvidence({ trigger: "SCHEDULED_CRON" })).toBe(true);
    expect(capturesForwardEvidence(null)).toBe(false);
  });
});

describe("scheduled vs ad-hoc on the same day (A5)", () => {
  const pressure = { overallPressure: 30, regime: "MODERATE RISK" } as any;

  it("only the scheduled run records Champion provenance and collects outcomes", async () => {
    const record = vi.fn(async () => ({ id: 21, created: true }));
    const collect = vi.fn(async () => ({ appended: 0, deferred: 0, reasons: {} }));
    const collectBroad = vi.fn(async () => ({ appended: 0, deferred: 0 }));
    const scheduled = resolveRunContext("cron-endpoint", new Date("2026-10-05T20:15:02Z"));
    const adhoc = resolveRunContext("admin-seedNow", new Date("2026-10-05T15:00:00Z"));
    const deploy = resolveRunContext("cron-endpoint", new Date("2026-10-05T17:06:00Z"));

    for (const ctx of [adhoc, deploy, resolveRunContext("unspecified", new Date("2026-10-05T18:05:00Z"))]) {
      expect(await captureChampionProvenanceForRun(ctx, pressure, "2026-10-05T18:05:00.000Z", record)).toMatchObject({ status: "NOT_CAPTURED_NON_SCHEDULED_RUN", championProvenanceId: null });
      expect(await collectForwardOutcomesForRun(ctx, collect, collectBroad)).toEqual({ collected: false });
    }
    expect(record).not.toHaveBeenCalled();
    expect(collect).not.toHaveBeenCalled();
    expect(collectBroad).not.toHaveBeenCalled();

    const link = await captureChampionProvenanceForRun(scheduled, pressure, "2026-10-05T20:15:09.000Z", record);
    expect(link).toEqual({ status: "CAPTURED", championProvenanceKey: "champion-forward:2026-10-05:v1-forward-provenance-2026-08-19", championProvenanceId: 21, championProvenanceCreatedByThisRun: true, outcomeKeyVersion: "v2" });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][1]).toEqual(new Date("2026-10-05T20:15:09.000Z"));
    expect(await collectForwardOutcomesForRun(scheduled, collect, collectBroad)).toEqual({ collected: true });
    expect(collect).toHaveBeenCalledTimes(1);
    expect(collectBroad).toHaveBeenCalledTimes(1);

    const failing = vi.fn(async () => { throw new Error("broad down"); });
    expect(await collectForwardOutcomesForRun(scheduled, collect, failing)).toEqual({ collected: true });
    expect(collect).toHaveBeenCalledTimes(2);
  });

  it("provenance failures are non-blocking and recorded on the link", async () => {
    const scheduled = resolveRunContext("cron-endpoint", new Date("2026-10-05T20:15:02Z"));
    const link = await captureChampionProvenanceForRun(scheduled, pressure, "2026-10-05T20:15:09.000Z", async () => { throw new Error("db down"); });
    expect(link).toMatchObject({ status: "PROVENANCE_CAPTURE_FAILED", championProvenanceId: null, championProvenanceCreatedByThisRun: false });
    const existing = await captureChampionProvenanceForRun(scheduled, pressure, "2026-10-05T20:15:09.000Z", async () => ({ id: 20, created: false }));
    expect(existing).toMatchObject({ status: "DAY_ALREADY_CAPTURED", championProvenanceCreatedByThisRun: false });
  });

  it("preserves the legacy UTC classifier for historical rows without run provenance", () => {
    const rows: LedgerStateRow[] = [
      { stateId: "adhoc-morning", originatingRunId: "a", generatedAt: "2026-10-05T15:00:00.000Z", pressureIndex: 31, regime: "MODERATE RISK", runProvenance: { trigger: "MANUAL" } },
      { stateId: "sched", originatingRunId: "s", generatedAt: "2026-10-05T20:15:10.000Z", pressureIndex: 30, regime: "MODERATE RISK", runProvenance: { trigger: "SCHEDULED_CRON" } },
      { stateId: "deploy-later", originatingRunId: "d", generatedAt: "2026-10-05T20:20:00.000Z", pressureIndex: 32, regime: "MODERATE RISK", runProvenance: { trigger: "CRON_DEPLOY" } },
      { stateId: "legacy-adhoc", originatingRunId: "l1", generatedAt: "2026-09-15T00:26:00.000Z", pressureIndex: 28, regime: "MODERATE RISK" },
      { stateId: "legacy-cron", originatingRunId: "l2", generatedAt: "2026-09-15T18:00:20.000Z", pressureIndex: 33, regime: "MODERATE RISK" },
      { stateId: "late-insert", originatingRunId: "l3", generatedAt: "2026-09-16T18:00:20.000Z", createdAt: "2026-09-16T19:00:00.000Z", pressureIndex: 33, regime: "MODERATE RISK" },
      { stateId: "correction", originatingRunId: "c", generatedAt: "2026-09-17T18:00:20.000Z", pressureIndex: 33, regime: "MODERATE RISK", runProvenance: { recordClass: "LIVE_FORWARD_CORRECTION" } },
    ];
    const evaluated = selectEvaluatedDailyStates(rows);
    expect(evaluated.get("2026-10-05")?.stateId).toBe("sched");
    expect(evaluated.get("2026-09-15")?.stateId).toBe("legacy-cron");
    expect(evaluated.has("2026-09-14")).toBe(false);
    expect(evaluated.has("2026-09-16")).toBe(false);
    expect(evaluated.has("2026-09-17")).toBe(false);
    expect(stateOrigin(rows[0])).toBe("NON_SCHEDULED");
    expect(stateOrigin(rows[4])).toBe("LEGACY_SCHEDULED_WINDOW");
  });
});

describe("trigger wiring at the call sites (A1)", () => {
  const source = (path: string) => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
  it("protects the cron path without restricting the separate admin path", () => {
    const scheduled = source("server/scheduledSeismograph.ts");
    const router = source("server/routers/seismograph.ts");
    expect(scheduled).toMatch(/const runWindow = nyseSeismographRunWindow\(now\);/);
    expect(scheduled).toMatch(/if \(!runWindow\.isScheduledWindow\)/);
    expect(scheduled).toMatch(/const runContext = resolveRunContext\("cron-endpoint", now\);/);
    expect(router).toMatch(/seedNow:\s*adminProcedure\.mutation\(async \(\) => \{[\s\S]{0,200}runSeismographPipeline\(\{ runContext: resolveRunContext\("admin-seedNow"\) \}\)/);
    expect(scheduled).not.toMatch(/collectForwardChampionOutcomes\(/);
    expect(scheduled).not.toMatch(/collectBroadInstitutionalEventOutcomes\(/);
    expect(scheduled).toMatch(/const runContext = options\.runContext \?\? resolveRunContext\("unspecified"\);/);
  });
});
