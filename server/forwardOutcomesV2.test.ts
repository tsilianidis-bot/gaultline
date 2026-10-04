import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocked I/O: a recording db and fixed market data. The collector may only SELECT and INSERT. ──
const h = vi.hoisted(() => ({ db: null as any, bars: [] as Array<{ close: number; timestamp: number }>, fred: [] as Array<{ date: string; value: string }> }));
vi.mock("./db", () => ({ getDb: async () => h.db }));
vi.mock("./yahooProxy", () => ({ getDailyBars: async () => h.bars }));
vi.mock("./fredClient", () => ({ fetchFredSeries: async () => ({ observations: h.fred, cached: false }) }));

import { algorithmOutcomeObservations, algorithmScoreProvenance, intelligenceStateManifests } from "../drizzle/schema";
import {
  buildOutcomeV2Row,
  classifyV1OutcomeRow,
  collectForwardChampionOutcomesV2,
  completedSessionBars,
  computeOutcomeWindowV2,
  expectedBaseSessionDate,
  isSessionComplete,
  outcomeKeyV1,
  outcomeKeyV2,
  regularSessionCloseMs,
  resolveProvenanceStateLink,
  targetDayRecord,
  type ProvenanceRecord,
} from "./algorithmProvenance";
import type { LedgerStateRow } from "./forwardRunProvenance";

/** Yahoo daily bars carry the session OPEN timestamp (09:30 ET). */
const openTs = (etDate: string) => regularSessionCloseMs(etDate) - 6.5 * 3600_000;
const bar = (etDate: string, close: number) => ({ close, timestamp: openTs(etDate) });
const at = (iso: string) => new Date(iso);

describe("v2 outcomes use completed bars only (A6)", () => {
  it("DST-aware 16:00 ET close", () => {
    expect(new Date(regularSessionCloseMs("2026-09-23")).toISOString()).toBe("2026-09-23T20:00:00.000Z");
    expect(new Date(regularSessionCloseMs("2026-11-02")).toISOString()).toBe("2026-11-02T21:00:00.000Z");
  });

  it("2 PM ET: the target day's in-progress bar is never an outcome", () => {
    const recordedAt = at("2026-09-22T18:00:30Z"); // Tue 2 PM ET scheduled run
    const collectedAt = at("2026-09-23T18:00:30Z"); // next scheduled run, Wed 2 PM ET
    const bars = [bar("2026-09-21", 100), bar("2026-09-22", 101), bar("2026-09-23", 999)]; // 09-23 still open
    const completed = completedSessionBars(bars, collectedAt);
    expect(completed.map(b => b.etDate)).toEqual(["2026-09-21", "2026-09-22"]);
    expect(computeOutcomeWindowV2(recordedAt, 1, completed, collectedAt)).toEqual({ status: "DEFERRED", reason: "TARGET_SESSION_NOT_COMPLETE" });
    // base = the 09-22 close (strictly after the 2 PM record), not the 09-21 close or the 09-22 open
    expect(expectedBaseSessionDate(recordedAt)).toBe("2026-09-22");
    // same-day collection at 2 PM: the base session itself is still open
    expect(computeOutcomeWindowV2(recordedAt, 1, completed, at("2026-09-22T18:00:40Z"))).toEqual({ status: "DEFERRED", reason: "BASE_SESSION_NOT_COMPLETE" });
  });

  it("just after the close: excluded inside the buffer, included after it", () => {
    const recordedAt = at("2026-09-22T18:00:30Z");
    const bars = [bar("2026-09-22", 101), bar("2026-09-23", 102)];
    for (const iso of ["2026-09-23T20:00:00Z", "2026-09-23T20:05:00Z", "2026-09-23T20:59:59Z"]) {
      const c = at(iso);
      expect(isSessionComplete("2026-09-23", c)).toBe(false);
      expect(computeOutcomeWindowV2(recordedAt, 1, completedSessionBars(bars, c), c)).toMatchObject({ status: "DEFERRED", reason: "TARGET_SESSION_NOT_COMPLETE" });
    }
    const c = at("2026-09-23T21:00:00Z");
    const w = computeOutcomeWindowV2(recordedAt, 1, completedSessionBars(bars, c), c);
    expect(w).toMatchObject({ status: "READY", baseBarComplete: true, targetBarComplete: true });
    if (w.status !== "READY") throw new Error("unreachable");
    expect([w.base.etDate, w.base.close, w.target.etDate, w.target.close]).toEqual(["2026-09-22", 101, "2026-09-23", 102]);
    expect(w.target.sessionCloseAt).toBe("2026-09-23T20:00:00.000Z");
  });

  it("a record at/after the close uses the next session as base (strictly after)", () => {
    expect(expectedBaseSessionDate(at("2026-09-22T20:00:00Z"))).toBe("2026-09-23");
    expect(expectedBaseSessionDate(at("2026-09-22T19:59:59Z"))).toBe("2026-09-22");
    expect(expectedBaseSessionDate(at("2026-10-02T23:00:00Z"))).toBe("2026-10-05"); // Fri evening → Mon
  });

  it("weekend/holiday: no bar on a non-trading day, horizons count exchange sessions", () => {
    const recordedAt = at("2026-09-05T18:00:00Z"); // Saturday
    expect(expectedBaseSessionDate(recordedAt)).toBe("2026-09-08"); // Mon 09-07 is Labor Day
    const collectedAt = at("2026-09-12T12:00:00Z");
    const bars = [bar("2026-09-04", 90), bar("2026-09-07", 777), bar("2026-09-08", 91), bar("2026-09-09", 92), bar("2026-09-10", 93), bar("2026-09-11", 94)];
    const completed = completedSessionBars(bars, collectedAt);
    expect(completed.map(b => b.etDate)).not.toContain("2026-09-07");
    const w = computeOutcomeWindowV2(recordedAt, 1, completed, collectedAt);
    expect(w).toMatchObject({ status: "READY", base: { etDate: "2026-09-08" }, target: { etDate: "2026-09-09" } });
    expect(isSessionComplete("2026-09-07", at("2026-09-08T12:00:00Z"))).toBe(false);
    expect(isSessionComplete("2026-09-05", at("2026-09-08T12:00:00Z"))).toBe(false);
  });

  it("a missing bar defers instead of shifting the horizon (v1 counted array positions)", () => {
    const recordedAt = at("2026-09-22T18:00:30Z");
    const c = at("2026-09-26T12:00:00Z");
    const completed = completedSessionBars([bar("2026-09-22", 1), bar("2026-09-24", 3), bar("2026-09-25", 4)], c);
    expect(computeOutcomeWindowV2(recordedAt, 1, completed, c)).toEqual({ status: "DEFERRED", reason: "TARGET_BAR_MISSING" });
    expect(computeOutcomeWindowV2(at("2026-09-22T20:30:00Z"), 1, completed, c)).toEqual({ status: "DEFERRED", reason: "BASE_BAR_MISSING" }); // base 09-23 missing
  });

  it("classifies v1 rows at read time without modifying them", () => {
    const json = (targetObservedAt: string) => JSON.stringify({ spy: { targetObservedAt } });
    expect(classifyV1OutcomeRow({ outcomeKey: "champion-provenance:3:broad:1td", createdAt: at("2026-09-17T18:01:00Z"), outcomeJson: json("2026-09-17") })).toBe("INTRADAY_TARGET_V1");
    expect(classifyV1OutcomeRow({ outcomeKey: "champion-provenance:3:broad:1td", createdAt: at("2026-09-18T18:01:00Z"), outcomeJson: json("2026-09-17") })).toBe("SUPERSEDED_V1_COMPLETED_TARGET");
    expect(classifyV1OutcomeRow({ outcomeKey: "champion-provenance:3:broad:1td", createdAt: at("2026-09-18T18:01:00Z"), outcomeJson: "{}" })).toBe("INTRADAY_TARGET_V1");
    expect(classifyV1OutcomeRow({ outcomeKey: "champion-provenance:3:broad:1td:v2", createdAt: at("2026-09-18T18:01:00Z"), outcomeJson: json("2026-09-17") })).toBeNull();
  });
});

// ── fixtures for the collector ──
const prov = (id: number, iso: string, pressureIndex: number, regime = "MODERATE RISK"): ProvenanceRecord => ({ id, observationKey: `champion-forward:${iso.slice(0, 10)}:v1-forward-provenance-2026-08-19`, observedAt: at(iso), pressureIndex, regime });
const manifestRow = (stateId: string, generatedAtIso: string, pressureIndex: number, runProvenance: unknown = null, regime = "MODERATE RISK") => ({
  stateId, originatingRunId: `seismograph:${stateId}`, generatedAt: at(generatedAtIso), createdAt: at(generatedAtIso),
  manifestJson: JSON.stringify({ generatedAt: generatedAtIso, pressureIndex, regime, runProvenance }),
});

function recordingDb(tables: Map<unknown, unknown[]>, opts: { insertError?: unknown } = {}) {
  const calls: string[] = [];
  const inserted: any[] = [];
  const chain = (rows: unknown[]) => {
    const q: any = { orderBy: () => q, limit: () => q, where: () => q, then: (res: any, rej: any) => Promise.resolve(rows).then(res, rej) };
    return q;
  };
  const target = {
    select: (_fields?: unknown) => { calls.push("select"); return { from: (table: unknown) => chain(tables.get(table) ?? []) }; },
    insert: (table: unknown) => { calls.push("insert"); return { values: async (row: any) => { if (opts.insertError) throw opts.insertError; expect(table).toBe(algorithmOutcomeObservations); inserted.push(row); return [{ insertId: 1 }]; } }; },
  };
  const db = new Proxy(target, { get(t, prop) { if (prop === "then") return undefined; if (!(prop in t)) { calls.push(String(prop)); return () => { throw new Error(`forbidden db.${String(prop)}`); }; } return (t as any)[prop]; } });
  return { db, calls, inserted };
}

describe("append-only v2 collector (A2): select + insert-if-absent only", () => {
  const v1Row = { id: 7, outcomeKey: outcomeKeyV1(1, 1), provenanceId: 1, horizonTradingDays: 1, createdAt: at("2026-09-23T18:01:00Z"), observedAt: at("2026-09-23T13:30:00Z"), outcomeJson: JSON.stringify({ spy: { targetClose: 999, targetObservedAt: "2026-09-23" } }), provenanceJson: "{}" };
  const v2Existing = { id: 8, outcomeKey: outcomeKeyV2(2, 1), provenanceId: 2, horizonTradingDays: 1, createdAt: at("2026-09-24T21:30:00Z"), observedAt: at("2026-09-24T20:00:00Z"), outcomeJson: "{\"existing\":true}", provenanceJson: "{}" };
  let tables: Map<unknown, unknown[]>;
  let v1Snapshot: string;

  beforeEach(() => {
    tables = new Map<unknown, unknown[]>([
      [algorithmScoreProvenance, [prov(2, "2026-09-23T18:00:30Z", 32), prov(1, "2026-09-22T18:00:30Z", 30)]],
      [intelligenceStateManifests, [
        manifestRow("s-0922-adhoc", "2026-09-22T23:00:00Z", 30, { trigger: "MANUAL", outcomeLink: { status: "NOT_CAPTURED_NON_SCHEDULED_RUN", championProvenanceId: null, championProvenanceCreatedByThisRun: false } }),
        manifestRow("s-0923", "2026-09-23T18:00:10Z", 32),
        manifestRow("s-0922", "2026-09-22T18:00:10Z", 30),
      ]],
      [algorithmOutcomeObservations, [v1Row, v2Existing]],
    ]);
    v1Snapshot = JSON.stringify(v1Row);
    h.bars = [bar("2026-09-21", 100), bar("2026-09-22", 101), bar("2026-09-23", 102), bar("2026-09-24", 103), bar("2026-09-25", 104)];
    h.fred = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"].map((date, i) => ({ date, value: (4 + i / 100).toFixed(2) }));
  });

  it("appends only absent v2 keys, never UPDATE/DELETE, leaves v1 rows byte-identical", async () => {
    const rec = recordingDb(tables);
    h.db = rec.db;
    const result = await collectForwardChampionOutcomesV2(at("2026-09-25T21:30:00Z"));
    expect(rec.calls.every(c => c === "select" || c === "insert")).toBe(true);
    expect(rec.calls.filter(c => c === "insert")).toHaveLength(1);
    expect(result.appended).toBe(1);
    expect(result.deferred).toBe(6); // 5/20/60td for both records are not yet complete
    expect(result.reasons).toEqual({ TARGET_SESSION_NOT_COMPLETE: 6 });
    const [row] = rec.inserted;
    expect(row.outcomeKey).toBe("champion-provenance:1:broad:1td:v2");
    expect(row.observedAt.toISOString()).toBe("2026-09-23T20:00:00.000Z");
    const json = JSON.parse(row.outcomeJson);
    expect(json.spy).toMatchObject({ baseClose: 101, targetClose: 102, baseBarDate: "2026-09-22", targetBarDate: "2026-09-23", baseBarComplete: true, targetBarComplete: true });
    expect(json.supersedesV1OutcomeId).toBe(7);
    expect(json.supersedesV1Classification).toBe("INTRADAY_TARGET_V1");
    expect(json.score).toMatchObject({ base: 30, target: 32, change: 2, targetProvenanceId: 2 });
    expect(json.stateLink).toMatchObject({ status: "LEGACY_SAME_RUN_INFERRED", stateId: "s-0922", originatingRunId: "seismograph:s-0922", evaluationEligible: true });
    expect(JSON.stringify(v1Row)).toBe(v1Snapshot);
    expect(v2Existing.outcomeJson).toBe("{\"existing\":true}");
  });

  it("is idempotent: a second cycle with the row present appends nothing", async () => {
    const first = recordingDb(tables);
    h.db = first.db;
    await collectForwardChampionOutcomesV2(at("2026-09-25T21:30:00Z"));
    tables.set(algorithmOutcomeObservations, [v1Row, v2Existing, { id: 9, createdAt: at("2026-09-25T21:30:00Z"), ...first.inserted[0] }]);
    const second = recordingDb(tables);
    h.db = second.db;
    const again = await collectForwardChampionOutcomesV2(at("2026-09-25T21:30:00Z"));
    expect(again.appended).toBe(0);
    expect(second.calls.includes("insert")).toBe(false);
  });

  it("a concurrent duplicate key is skipped, never overwritten", async () => {
    const rec = recordingDb(tables, { insertError: Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 }) });
    h.db = rec.db;
    await expect(collectForwardChampionOutcomesV2(at("2026-09-25T21:30:00Z"))).resolves.toMatchObject({ appended: 0 });
    expect(rec.calls.every(c => c === "select" || c === "insert")).toBe(true);
  });

  it("at the 2 PM ET run nothing for that day is appended", async () => {
    const rec = recordingDb(tables);
    h.db = rec.db;
    const result = await collectForwardChampionOutcomesV2(at("2026-09-23T18:00:40Z"));
    expect(result.appended).toBe(0);
    expect(rec.inserted).toHaveLength(0);
  });

  it("defers when FRED has not published the target date", async () => {
    h.fred = h.fred.filter(o => o.date < "2026-09-23");
    const rec = recordingDb(tables);
    h.db = rec.db;
    const result = await collectForwardChampionOutcomesV2(at("2026-09-25T21:30:00Z"));
    expect(result.appended).toBe(0);
    expect(result.reasons.DGS10_NOT_PUBLISHED).toBe(1);
  });
});

describe("deterministic key and state link (A4)", () => {
  const states: LedgerStateRow[] = [
    { stateId: "sched", originatingRunId: "seismograph:sched", generatedAt: "2026-10-05T18:00:10.000Z", pressureIndex: 30, regime: "MODERATE RISK", runProvenance: { trigger: "SCHEDULED_CRON", outcomeLink: { championProvenanceKey: "k", championProvenanceId: 21, championProvenanceCreatedByThisRun: true } } },
    { stateId: "adhoc", originatingRunId: "seismograph:adhoc", generatedAt: "2026-10-05T18:01:00.000Z", pressureIndex: 31, regime: "MODERATE RISK", runProvenance: { trigger: "AD_HOC", outcomeLink: { championProvenanceKey: null, championProvenanceId: null, championProvenanceCreatedByThisRun: false } } },
    { stateId: "deploy", originatingRunId: "seismograph:deploy", generatedAt: "2026-10-05T18:01:30.000Z", pressureIndex: 30, regime: "MODERATE RISK", runProvenance: { trigger: "CRON_DEPLOY", outcomeLink: { championProvenanceKey: "k", championProvenanceId: 21, championProvenanceCreatedByThisRun: false } } },
  ];
  const record = prov(21, "2026-10-05T18:00:05Z", 30);

  it("keys", () => {
    expect(outcomeKeyV2(21, 5)).toBe("champion-provenance:21:broad:5td:v2");
    expect(outcomeKeyV1(21, 5)).toBe("champion-provenance:21:broad:5td");
  });

  it("explicit link names the scheduled run that created the provenance row, independent of input order", () => {
    const a = resolveProvenanceStateLink(record, states);
    const b = resolveProvenanceStateLink(record, [...states].reverse());
    expect(a).toEqual(b);
    expect(a).toMatchObject({ status: "EXPLICIT_RUN_PROVENANCE", stateId: "sched", originatingRunId: "seismograph:sched", stateOrigin: "SCHEDULED_CRON", evaluationEligible: true });
  });

  it("legacy link with a PI mismatch is not evaluation-eligible", () => {
    const legacy: LedgerStateRow[] = [{ stateId: "l", originatingRunId: "r", generatedAt: "2026-09-15T00:26:00.000Z", pressureIndex: 33, regime: "MODERATE RISK" }];
    const link = resolveProvenanceStateLink(prov(2, "2026-09-15T00:26:20Z", 28), legacy);
    expect(link).toMatchObject({ status: "LEGACY_SAME_RUN_INFERRED", stateId: "l", evaluationEligible: false });
    expect(resolveProvenanceStateLink(prov(2, "2026-09-15T00:40:00Z", 33), legacy)).toMatchObject({ status: "UNRESOLVED", stateId: null, evaluationEligible: false });
    // the evaluated (in-window) state itself, but with a different PI than the provenance row
    const inWindow: LedgerStateRow[] = [{ stateId: "w", originatingRunId: "rw", generatedAt: "2026-09-18T18:00:10.000Z", pressureIndex: 28, regime: "MODERATE RISK" }];
    expect(resolveProvenanceStateLink(prov(6, "2026-09-18T18:00:30Z", 28), inWindow)).toMatchObject({ stateId: "w", evaluationEligible: true });
    expect(resolveProvenanceStateLink(prov(6, "2026-09-18T18:00:30Z", 30), inWindow)).toMatchObject({ stateId: "w", evaluationEligible: false });
    expect(resolveProvenanceStateLink(prov(6, "2026-09-18T18:00:30Z", 28, "ELEVATED RISK"), inWindow)).toMatchObject({ stateId: "w", evaluationEligible: false });
    // same PI/regime, but the linked state is an ad-hoc (outside-window) run → not eligible
    expect(resolveProvenanceStateLink(prov(2, "2026-09-15T00:26:20Z", 33), legacy)).toMatchObject({ stateId: "l", stateOrigin: "LEGACY_OUTSIDE_WINDOW", evaluationEligible: false });
  });

  it("same inputs → byte-identical v2 row", () => {
    const c = at("2026-10-06T21:30:00Z");
    const completed = completedSessionBars([bar("2026-10-05", 600), bar("2026-10-06", 606)], c);
    const window = computeOutcomeWindowV2(record.observedAt, 1, completed, c);
    if (window.status !== "READY") throw new Error("expected READY");
    const input = { record, horizon: 1, window, collectedAt: c, stateLink: resolveProvenanceStateLink(record, states), laterRecord: null, baseYield: { date: "2026-10-05", value: 4.1 }, targetYield: { date: "2026-10-06", value: 4.2 }, supersedes: null };
    expect(JSON.stringify(buildOutcomeV2Row(input))).toBe(JSON.stringify(buildOutcomeV2Row({ ...input })));
    expect(buildOutcomeV2Row(input).outcomeKey).toBe("champion-provenance:21:broad:1td:v2");
  });

  it("target score comes from the target trading day's record, not the latest record", () => {
    const asc = [prov(1, "2026-09-22T18:00:00Z", 30), prov(2, "2026-09-23T18:00:00Z", 32), prov(3, "2026-09-24T18:00:00Z", 28)];
    expect(targetDayRecord(asc, "2026-09-23")?.id).toBe(2);
    expect(targetDayRecord(asc, "2026-09-25")).toBeNull();
  });
});
