import { beforeEach, describe, expect, it, vi } from "vitest";

// Recording db + FRED that behaves like the API (no observation_start: limit applies after sort_order).
const h = vi.hoisted(() => ({ db: null as any, bars: [] as Array<{ close: number; timestamp: number }>, fred: [] as Array<{ date: string; value: string }> }));
vi.mock("./db", () => ({ getDb: async () => h.db }));
vi.mock("./yahooProxy", () => ({ getDailyBars: async () => h.bars }));
vi.mock("./fredClient", () => ({
  fetchFredSeries: async (_id: string, limit: number, sortOrder = "desc") => {
    const asc = [...h.fred].sort((a, b) => a.date.localeCompare(b.date));
    return { observations: sortOrder === "asc" ? asc.slice(0, limit) : asc.reverse().slice(0, limit), cached: false };
  },
}));
// Query-builder markers so the mocked db can answer `where(eq(outcomeKey, key))` lookups.
vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  eq: (column: unknown, value: unknown) => ({ op: "eq", column, value }),
  and: (...parts: unknown[]) => ({ op: "and", parts }),
  or: (...parts: unknown[]) => ({ op: "or", parts }),
  desc: (column: unknown) => ({ op: "desc", column }),
}));

import { institutionalEventOutcomes, institutionalEvents } from "../drizzle/schema";
import { regularSessionCloseMs } from "./algorithmProvenance";
import { collectBroadInstitutionalEventOutcomes } from "./institutionalMemory";

const at = (iso: string) => new Date(iso);
const bar = (etDate: string, close: number) => ({ close, timestamp: regularSessionCloseMs(etDate) - 6.5 * 3600_000 });

function fullDgs10() {
  const out: Array<{ date: string; value: string }> = [];
  for (let d = new Date("1962-01-02T12:00:00Z"); d <= new Date("2026-09-25T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const date = d.toISOString().slice(0, 10);
    out.push({ date, value: date < "2000-01-01" ? "4.06" : (4 + (d.getUTCDate() % 7) / 100).toFixed(2) });
  }
  return out;
}

type Row = Record<string, any>;
function recordingDb(state: { events: Row[]; snapshots: Row[]; outcomes: Row[] }, opts: { insertError?: unknown } = {}) {
  const calls: string[] = [];
  const inserted: Row[] = [];
  const chain = (rows: () => Row[]) => {
    let filter: ((r: Row) => boolean) | null = null;
    const q: any = {
      where: (w: any) => { if (w?.op === "eq" && w.column === institutionalEventOutcomes.outcomeKey) filter = r => r.outcomeKey === w.value; return q; },
      orderBy: () => q, limit: () => q,
      then: (res: any, rej: any) => Promise.resolve(filter ? rows().filter(filter) : rows()).then(res, rej),
    };
    return q;
  };
  const target = {
    select: (fields?: Record<string, unknown>) => {
      calls.push("select");
      return { from: (table: unknown) => {
        if (table === institutionalEventOutcomes) return chain(() => state.outcomes);
        if (table === institutionalEvents) return chain(() => (fields && "newStateJson" in fields ? state.snapshots : state.events));
        throw new Error("unexpected table");
      } };
    },
    insert: (table: unknown) => {
      calls.push("insert");
      return { values: async (row: Row) => { if (opts.insertError) throw opts.insertError; expect(table).toBe(institutionalEventOutcomes); inserted.push(row); state.outcomes.push(row); return [{ insertId: 1 }]; } };
    },
  };
  const db = new Proxy(target, { get(t, prop) { if (prop === "then") return undefined; if (!(prop in t)) { calls.push(String(prop)); return () => { throw new Error(`forbidden db.${String(prop)}`); }; } return (t as any)[prop]; } });
  return { db, calls, inserted };
}

const snapshot = (iso: string, pressureIndex: number, regime = "MODERATE RISK") => ({ eventAt: at(iso), newStateJson: JSON.stringify({ observedAt: iso, pressureIndex, regime, stressLevel: "Moderate", direction: "Stable", dataFreshness: "live" }) });

describe("broad institutional-event outcomes v2 (F2)", () => {
  let state: { events: Row[]; snapshots: Row[]; outcomes: Row[] };
  const legacyRow = { id: 3, outcomeKey: "institutional-event:9:broad-benchmark:1td", eventId: 9, horizonTradingDays: 1, observedAt: at("2026-09-23T13:30:00Z"), outcomeJson: JSON.stringify({ historyClass: "live_verified", spy: { targetClose: 999 }, tenYearTreasury: { changeBasisPoints: 0, baseObservedAt: "1962-09-28" } }), provenanceJson: "{}" };
  let legacySnapshot: string;

  beforeEach(() => {
    state = {
      // ordered desc by eventAt like the real query
      events: [
        { id: 12, eventAt: at("2026-09-19T18:00:30Z"), pressureIndex: 31, marketRegime: "MODERATE RISK" }, // Saturday
        { id: 10, eventAt: at("2026-09-22T18:00:30Z"), pressureIndex: 30, marketRegime: "MODERATE RISK" },
        { id: 9, eventAt: at("2026-09-22T18:00:20Z"), pressureIndex: 30, marketRegime: "MODERATE RISK" },
      ],
      snapshots: [snapshot("2026-09-25T18:00:00Z", 35), snapshot("2026-09-24T18:00:00Z", 34), snapshot("2026-09-23T18:00:00Z", 33), snapshot("2026-09-22T18:00:00Z", 30)],
      outcomes: [legacyRow],
    };
    legacySnapshot = JSON.stringify(legacyRow);
    h.bars = [bar("2026-09-18", 99), bar("2026-09-21", 100), bar("2026-09-22", 101), bar("2026-09-23", 102), bar("2026-09-24", 103), bar("2026-09-25", 104)];
    h.fred = fullDgs10();
  });

  it("at the 2 PM ET run the target day's open bar is never written", async () => {
    state.outcomes = [];
    const rec = recordingDb(state);
    h.db = rec.db;
    const result = await collectBroadInstitutionalEventOutcomes(at("2026-09-23T18:00:40Z"));
    expect(rec.inserted.map(r => r.outcomeKey)).toEqual(["institutional-event:12:broad-benchmark:1td"]); // Sat event: Mon 09-21 → Tue 09-22, both closed
    expect(result.appended).toBe(1);
  });

  it("appends completed-bar rows with the latest DGS10 yields; existing rows untouched; select/insert only", async () => {
    const rec = recordingDb(state);
    h.db = rec.db;
    const result = await collectBroadInstitutionalEventOutcomes(at("2026-09-25T21:30:00Z"));
    expect(rec.calls.every(c => c === "select" || c === "insert")).toBe(true);
    expect(rec.inserted.map(r => r.outcomeKey).sort()).toEqual([
      "institutional-event:10:broad-benchmark:1td",
      "institutional-event:12:broad-benchmark:1td",
    ]);
    expect(result).toEqual({ appended: 2, deferred: 9 }); // 1 slot already written (legacy, skipped)
    const row = rec.inserted.find(r => r.outcomeKey === "institutional-event:10:broad-benchmark:1td")!;
    expect(row.observedAt.toISOString()).toBe("2026-09-23T20:00:00.000Z");
    const json = JSON.parse(row.outcomeJson);
    expect(json.spy).toMatchObject({ baseClose: 101, targetClose: 102, baseObservedAt: "2026-09-22", observedAt: "2026-09-23", baseBarComplete: true, targetBarComplete: true });
    expect(json.tenYearTreasury).toMatchObject({ baseObservedAt: "2026-09-22", targetObservedAt: "2026-09-23", baseYieldPercent: 4.01, targetYieldPercent: 4.02 });
    expect(json.tenYearTreasury.changeBasisPoints).toBeCloseTo(1, 6);
    expect(json.pressureIndex).toEqual({ base: 30, target: 33, change: 3 });
    expect(json.outcomeVersion).toBe("v2-completed-bar");
    const weekend = JSON.parse(rec.inserted.find(r => r.outcomeKey === "institutional-event:12:broad-benchmark:1td")!.outcomeJson);
    expect([weekend.spy.baseObservedAt, weekend.spy.observedAt]).toEqual(["2026-09-21", "2026-09-22"]);
    expect(JSON.stringify(legacyRow)).toBe(legacySnapshot);
    expect(rec.inserted.some(r => r.outcomeKey === legacyRow.outcomeKey)).toBe(false);
  });

  it("is idempotent and never overwrites on a duplicate key", async () => {
    h.db = recordingDb(state).db;
    await collectBroadInstitutionalEventOutcomes(at("2026-09-25T21:30:00Z"));
    const again = recordingDb(state);
    h.db = again.db;
    expect((await collectBroadInstitutionalEventOutcomes(at("2026-09-25T21:30:00Z"))).appended).toBe(0);
    expect(again.calls.includes("insert")).toBe(false);
    state.outcomes = [legacyRow];
    const dup = recordingDb(state, { insertError: Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" }) });
    h.db = dup.db;
    await expect(collectBroadInstitutionalEventOutcomes(at("2026-09-25T21:30:00Z"))).resolves.toMatchObject({ appended: 0 });
  });

  it("defers when FRED has not yet published the target date", async () => {
    h.fred = h.fred.filter(o => o.date < "2026-09-23");
    const rec = recordingDb(state);
    h.db = rec.db;
    const result = await collectBroadInstitutionalEventOutcomes(at("2026-09-25T21:30:00Z"));
    expect(rec.inserted.map(r => r.outcomeKey)).toEqual(["institutional-event:12:broad-benchmark:1td"]);
    expect(result.appended).toBe(1);
  });
});
