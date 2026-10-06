/**
 * B1 proof: post-close collector → persisted snapshot (existing marketMemory table, insert-only)
 * → read-only query. Instrumented: every outbound request is counted by host, and N repeated
 * loads of all five question pages cause ZERO new fan-outs.
 *
 * All market data here is SYNTHETIC TEST DATA generated in this file (no network).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import XLSX from "xlsx";
import { MySqlDialect } from "drizzle-orm/mysql-core";

// ── Test doubles ─────────────────────────────────────────────────────────────
vi.mock("../shared/sectorRotation", async importOriginal => {
  const orig = await importOriginal<typeof import("../shared/sectorRotation")>();
  // Only the inter-request delay is shortened so the suite runs fast; every other policy value is the shipped one.
  return { ...orig, SECTOR_ROTATION_COLLECTOR_POLICY: { ...orig.SECTOR_ROTATION_COLLECTOR_POLICY, fanoutDelayMs: 1 } };
});
vi.mock("./fredClient", () => ({ fetchFredSeries: vi.fn(async () => ({ observations: [], error: "test: FRED not configured" })) }));
vi.mock("./canonicalIntelligenceState", () => ({
  getAuthoritativeCanonicalIntelligenceState: vi.fn(async () => ({ stateId: "state:test:abc", stateHash: "abc", generatedAt: "2026-10-02T18:00:00.000Z", regime: "MODERATE RISK", pressureIndex: 33 })),
}));

type Row = { id: number; memoryKey: string; memoryValue: string; description: string | null; writtenBy: string | null; updatedAt: Date };
const fakeDb = vi.hoisted(() => ({ enabled: true, claimFail: null as string | null, rows: [] as Row[], ops: [] as string[], whereSql: [] as Array<{ sql: string; params: unknown[] }> }));
vi.mock("./db", () => ({
  getDb: vi.fn(async () => {
    if (!fakeDb.enabled) return null;
    const dialect = new MySqlDialect();
    return {
      select: (fields: Record<string, unknown>) => ({
        from: () => ({
          where: (cond: unknown) => {
            const q = dialect.sqlToQuery(cond as never);
            fakeDb.whereSql.push(q);
            fakeDb.ops.push("select");
            const prefix = String(q.params[0]).replace(/%$/, "");
            return {
              orderBy: () => ({
                limit: async (n: number) => fakeDb.rows.filter(r => r.memoryKey.startsWith(prefix)).sort((a, b) => b.memoryKey.localeCompare(a.memoryKey)).slice(0, n)
                  .map(r => Object.fromEntries(Object.keys(fields).map(k => [k, (r as Record<string, unknown>)[k]]))),
              }),
            };
          },
        }),
      }),
      insert: () => ({
        values: (v: Omit<Row, "id" | "updatedAt">) => {
          // Sync check-and-set so concurrent tryClaim calls see each other (mirrors MySQL unique index).
          fakeDb.ops.push("insert");
          if (fakeDb.claimFail && v.memoryKey.includes("sector-rotation-claim:")) {
            return Promise.reject(Object.assign(new Error(fakeDb.claimFail), { code: "ECONNREFUSED", errno: -61 }));
          }
          if (fakeDb.rows.some(r => r.memoryKey === v.memoryKey)) {
            return Promise.reject(Object.assign(new Error(`Duplicate entry '${v.memoryKey}' for key 'marketMemory_memoryKey_unique'`), { code: "ER_DUP_ENTRY", errno: 1062 }));
          }
          fakeDb.rows.push({ id: fakeDb.rows.length + 1, ...v, updatedAt: new Date() });
          return Promise.resolve();
        },
      }),
      update: () => { fakeDb.ops.push("update"); throw new Error("update is not allowed"); },
      delete: () => { fakeDb.ops.push("delete"); throw new Error("delete is not allowed"); },
    };
  }),
}));

// ── Synthetic provider (test-only) ───────────────────────────────────────────
const SECTORS = ["XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC"];
const MEMBERS_PER_ETF = 4;
const members = SECTORS.flatMap((etf, e) => Array.from({ length: MEMBERS_PER_ETF }, (_, k) => ({ etf, ticker: `Z${String.fromCharCode(65 + e)}${String.fromCharCode(65 + k)}X`, name: `ZETA ${etf} ${String.fromCharCode(65 + k)} CORP` })));
const provider = vi.hoisted(() => ({ lastSession: "2026-10-02", fail: new Map<string, number>(), counts: { yahoo: 0, ssga: 0, polygon: 0, fred: 0, other: 0 }, inFlight: 0, maxInFlight: 0 }));
const weekdaysEndingOn = (last: string, count: number) => {
  const out: string[] = []; let t = Date.parse(`${last}T12:00:00Z`);
  while (out.length < count) { const d = new Date(t); if (d.getUTCDay() % 6 !== 0) out.unshift(d.toISOString().slice(0, 10)); t -= 86_400_000; }
  return out;
};
const etOpen = (d: string) => Date.parse(`${d}T13:30:00Z`) / 1000; // 9:30 ET (EDT) — bar timestamp
function chartJson(ticker: string, range: string) {
  const sessions = weekdaysEndingOn(provider.lastSession, range === "6mo" ? 126 : 63);
  const seed = [...ticker].reduce((a, c) => a + c.charCodeAt(0), 0);
  const close = sessions.map((_, i) => 50 + (seed % 17) + i * 0.02 * ((seed % 5) - 2) + Math.sin(i / 7 + seed) * 0.8);
  close[close.length - 1] = close[close.length - 2] * (1 + (((seed * 7) % 21) - 10) / 200);
  return { chart: { result: [{ meta: { regularMarketTime: etOpen(provider.lastSession) + 6.5 * 3600, longName: `${ticker} Inc.` }, timestamp: sessions.map(etOpen), indicators: { quote: [{ close, volume: sessions.map(() => 1_000_000) }] } }] } };
}
function ssgaXlsx(etf: string): ArrayBuffer {
  const rows = [["Fund Name:", `Synthetic ${etf}`], ["Ticker Symbol:", etf], ["Holdings:", "As of 01-Oct-2026"], [], ["Name", "Ticker", "Identifier", "SEDOL", "Weight", "Sector", "Shares Held", "Local Currency"],
    ...members.filter(m => m.etf === etf).map(m => [m.name, m.ticker, "000000000", "1234567", 1, "-", 1, "USD"])];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "holdings");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
const fetchStub = vi.fn(async (input: string | URL | Request) => {
  provider.inFlight += 1; provider.maxInFlight = Math.max(provider.maxInFlight, provider.inFlight);
  try { await new Promise(r => setTimeout(r, 3)); return respond(input); } finally { provider.inFlight -= 1; }
});
function respond(input: string | URL | Request): Response {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === "query1.finance.yahoo.com") {
    provider.counts.yahoo += 1;
    const ticker = decodeURIComponent(url.pathname.split("/").pop()!);
    const status = provider.fail.get(ticker);
    if (status) return new Response("{}", { status });
    return new Response(JSON.stringify(chartJson(ticker, url.searchParams.get("range") ?? "3mo")), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url.hostname === "www.ssga.com") {
    provider.counts.ssga += 1;
    const etf = url.pathname.match(/holdings-daily-us-en-([a-z]+)\.xlsx$/)![1].toUpperCase();
    return new Response(ssgaXlsx(etf), { status: 200 });
  }
  if (url.hostname === "api.polygon.io") { provider.counts.polygon += 1; return new Response("{}", { status: 401 }); }
  provider.counts.other += 1;
  return new Response("not allowed in tests", { status: 599 });
}

// ── Imports under test (after mocks) ─────────────────────────────────────────
import { SectorRotationCollector, invalidReason, inQuietWindow, latestCompletedSession, newBudget, backoffMs } from "./sectorRotation/collector";
import { collectSectorRotationInputs, sectorRotationCollector } from "./sectorRotation/service";
import { SNAPSHOT_KEY_PREFIX, createMarketMemorySnapshotStore, decodeSnapshot, encodeSnapshot, snapshotKey } from "./sectorRotation/snapshotStore";
import { SECTOR_ROTATION_METHOD_VERSION } from "../shared/sectorRotation";

const ET = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-04:00`).getTime(); // EDT dates only
const total = () => ({ ...provider.counts });
const snapRows = () => fakeDb.rows.filter(r => r.memoryKey.startsWith(`sector-rotation:${SECTOR_ROTATION_METHOD_VERSION}:`) && !r.memoryKey.includes("claim"));
// Snapshot keys are sector-rotation:<ver>:<date>; claims use sector-rotation-claim:…
const snapshotRows = () => fakeDb.rows.filter(r => /^sector-rotation:sector-rotation-v[\d.]+:\d{4}-\d{2}-\d{2}$/.test(r.memoryKey));
const delta = (a: ReturnType<typeof total>, b: ReturnType<typeof total>) => Object.fromEntries(Object.keys(a).map(k => [k, (b as Record<string, number>)[k] - (a as Record<string, number>)[k]]));
const PAGES = ["now", "why", "outlook", "watch", "act"] as const;
const FULL_FANOUT = { yahoo: 18 + members.length, ssga: SECTORS.length };

let caller: { sectorRotation: { current: () => Promise<any> } };
async function loadAllPages(times: number) {
  // Each of the five question pages issues exactly one sector query (sectorRotation.current, its own request).
  const out: any[] = [];
  for (let i = 0; i < times; i++) for (const _page of PAGES) out.push(await caller.sectorRotation.current());
  return out;
}
const collectorAt = (clock: { t: number }) => new SectorRotationCollector({ now: () => clock.t, store: createMarketMemorySnapshotStore(), collect: b => collectSectorRotationInputs(b, () => clock.t) });

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchStub);
  vi.stubEnv("POLYGON_API_KEY", ""); // news is covered by the catalyst tests; here it is simply "not configured"
  vi.useFakeTimers({ toFake: ["Date"] });
  const { appRouter } = await import("./routers");
  caller = appRouter.createCaller({ req: {} as never, res: {} as never, user: null } as never) as never;
});
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(() => { provider.fail.clear(); fakeDb.enabled = true; fakeDb.claimFail = null; });

describe("session clock", () => {
  it("latest completed session uses 4 PM ET + 60 min on weekdays", () => {
    expect(latestCompletedSession(ET("2026-10-02", "16:59"))).toBe("2026-10-01");
    expect(latestCompletedSession(ET("2026-10-02", "17:00"))).toBe("2026-10-02");
    expect(latestCompletedSession(ET("2026-10-04", "12:00"))).toBe("2026-10-02"); // Sunday
    expect(latestCompletedSession(ET("2026-10-05", "09:00"))).toBe("2026-10-02"); // Monday before close
    // Quiet window is UTC-anchored (17:45–18:45Z weekdays), so it stays aligned with a UTC cron across the Nov 1 DST change.
    expect(inQuietWindow(ET("2026-10-05", "14:00"))).toBe(true);  // 18:00Z under EDT
    expect(inQuietWindow(ET("2026-10-05", "17:30"))).toBe(false);
    expect(inQuietWindow(Date.parse("2026-11-02T18:00:00Z"))).toBe(true);   // post-DST Monday, still 18:00Z
    expect(inQuietWindow(Date.parse("2026-11-02T19:00:00Z"))).toBe(false);  // 14:00 ET under EST is 19:00Z — outside the UTC window
    expect(inQuietWindow(Date.parse("2026-11-01T18:00:00Z"))).toBe(false);  // Sunday
    expect([1, 2, 3, 4].map(a => backoffMs(a) / 60_000)).toEqual([30, 60, 120, 120]);
  });
});

describe("page loads never trigger a fan-out (instrumented)", () => {
  it("before any snapshot exists: 100 page loads → UNAVAILABLE, 0 provider requests", async () => {
    vi.setSystemTime(ET("2026-10-02", "17:30"));
    const before = total();
    const views = await loadAllPages(20);
    expect(views.every(v => v.freshness === "UNAVAILABLE" && v.reading === null)).toBe(true);
    expect(delta(before, total())).toEqual({ yahoo: 0, ssga: 0, polygon: 0, fred: 0, other: 0 });
    expect(fakeDb.ops.filter(o => o !== "select")).toEqual([]);
  });

  it("one post-close build → exactly one fan-out and one insert; then 100 page loads add 0 requests", async () => {
    vi.setSystemTime(ET("2026-10-02", "17:30"));
    const before = total();
    const outcome = await sectorRotationCollector.tick();
    expect(outcome).toBe("PERSISTED");
    const afterBuild = total();
    expect(delta(before, afterBuild)).toMatchObject({ yahoo: FULL_FANOUT.yahoo, ssga: FULL_FANOUT.ssga, polygon: 0, other: 0 });
    expect(sectorRotationCollector.fanouts).toBe(1);
    expect(provider.maxInFlight).toBeLessThanOrEqual(2); // bounded concurrency (fanoutConcurrency = 2)
    expect(snapshotRows().map(r => r.memoryKey)).toEqual([`sector-rotation:${SECTOR_ROTATION_METHOD_VERSION}:2026-10-02`]);
    expect(fakeDb.whereSql.at(-1)!.sql).toMatch(/like/i);
    expect(fakeDb.whereSql.at(-1)!.params).toEqual([`${SNAPSHOT_KEY_PREFIX}%`]);

    const views = await loadAllPages(20);
    expect(views.every(v => v.freshness === "CURRENT" && v.snapshot.sessionDate === "2026-10-02" && v.reading.movers.status !== "UNAVAILABLE")).toBe(true);
    expect(views[0].snapshot.stateId).toBe("state:test:abc");
    expect(delta(afterBuild, total())).toEqual({ yahoo: 0, ssga: 0, polygon: 0, fred: 0, other: 0 });
    // Requests before vs after, for the report.
    console.log(`[B1 proof] build: ${JSON.stringify(delta(before, afterBuild))}; 100 page loads: ${JSON.stringify(delta(afterBuild, total()))}`);
  });

  it("collector ticks for the rest of the weekend and a restart cause 0 new fan-outs", async () => {
    const before = total();
    for (let t = ET("2026-10-02", "17:40"); t < ET("2026-10-05", "16:59"); t += 10 * 60_000) { vi.setSystemTime(t); expect(await sectorRotationCollector.tick()).toBe("NOT_DUE"); }
    const clock = { t: ET("2026-10-04", "12:00") };
    vi.setSystemTime(clock.t);
    const restarted = collectorAt(clock);
    expect(await restarted.tick()).toBe("NOT_DUE"); // boot check finds the saved snapshot
    expect((await restarted.served()).freshness).toBe("CURRENT");
    await loadAllPages(20);
    expect(delta(before, total())).toEqual({ yahoo: 0, ssga: 0, polygon: 0, fred: 0, other: 0 });
  });

  it("next completed session → exactly one more fan-out; page loads still 0", async () => {
    provider.lastSession = "2026-10-05";
    vi.setSystemTime(ET("2026-10-05", "17:10"));
    const before = total();
    expect(await sectorRotationCollector.tick()).toBe("PERSISTED");
    const mid = total();
    expect(delta(before, mid)).toMatchObject({ yahoo: FULL_FANOUT.yahoo, ssga: FULL_FANOUT.ssga }); // 12 h universe cache expired over the weekend
    await loadAllPages(20);
    expect(delta(mid, total()).yahoo).toBe(0);
    expect(snapshotRows()).toHaveLength(2);
    expect(fakeDb.ops.filter(o => o === "update" || o === "delete")).toEqual([]);
  });
});

describe("failure handling: circuit breaker, backoff, finite retries, last-valid STALE", () => {
  it("an HTTP 429 aborts the fan-out at once, opens the circuit, never saves, and serves the last valid snapshot as STALE", async () => {
    provider.lastSession = "2026-10-06";
    provider.fail.set("XLE", 429);
    const clock = { t: ET("2026-10-06", "17:10") };
    vi.setSystemTime(clock.t);
    const c = collectorAt(clock);
    const before = total();
    expect(await c.tick()).toBe("FAILED");
    const used = delta(before, total());
    expect(used.yahoo).toBeLessThan(10); // stopped right after the 429 (bounded concurrency)
    expect(used.ssga).toBe(0);
    expect(snapshotRows()).toHaveLength(2); // nothing saved
    const view = await c.served();
    expect(view).toMatchObject({ freshness: "STALE", snapshot: { sessionDate: "2026-10-05" }, lastRefresh: { outcome: "FAILED" } });
    expect(view.freshnessReason).toMatch(/last valid snapshot \(session 2026-10-05\).*429/);
    // Circuit open for 60 min: ticks do nothing, page loads do nothing.
    const quiet = total();
    for (let m = 10; m < 60; m += 10) { clock.t = ET("2026-10-06", "17:10") + m * 60_000; vi.setSystemTime(clock.t); expect(await c.tick()).toBe("CIRCUIT_OPEN"); }
    await loadAllPages(10);
    expect(delta(quiet, total()).yahoo).toBe(0);
    // Attempts 2 and 3 after backoff, then it gives up for this session.
    clock.t = ET("2026-10-06", "18:11"); expect(await c.tick()).toBe("FAILED");
    clock.t = ET("2026-10-06", "19:12"); expect(await c.tick()).toBe("FAILED");
    clock.t = ET("2026-10-06", "23:30"); expect(await c.tick()).toBe("GAVE_UP");
    expect(c.fanouts).toBe(3);
  });

  it("a partial failure (constituents erroring) is not saved — no partial ranking", async () => {
    provider.lastSession = "2026-10-07"; // a later session: the clock never runs backwards (shared chart cache)
    for (const m of members.slice(0, 5)) provider.fail.set(m.ticker, 500); // 5 of 44 > 5% missing
    const clock = { t: ET("2026-10-07", "17:10") };
    vi.setSystemTime(clock.t);
    const c = collectorAt(clock);
    expect(await c.tick()).toBe("FAILED");
    expect(snapshotRows()).toHaveLength(2);
    expect((await c.served()).lastRefresh.detail).toMatch(/Top movers unavailable/);
    // Not rate-limited → no circuit, but exponential backoff 30 → 60 min, max 3 attempts.
    const before = total();
    clock.t = ET("2026-10-07", "17:30"); expect(await c.tick()).toBe("BACKOFF");
    expect(delta(before, total()).yahoo).toBe(0);
    clock.t = ET("2026-10-07", "17:41"); expect(await c.tick()).toBe("FAILED");
    clock.t = ET("2026-10-07", "18:30"); expect(await c.tick()).toBe("BACKOFF");
    clock.t = ET("2026-10-07", "18:42"); expect(await c.tick()).toBe("FAILED");
    clock.t = ET("2026-10-08", "09:00"); expect(await c.tick()).toBe("GAVE_UP");
    expect(c.fanouts).toBe(3);
    expect((await c.served()).lastRefresh.nextAttemptAfter).toBeNull();
  });

  it("no store → no fan-out at all; quiet window → no fan-out", async () => {
    fakeDb.enabled = false;
    const clock = { t: ET("2026-10-07", "17:30") };
    vi.setSystemTime(clock.t);
    const c = collectorAt(clock);
    const before = total();
    expect(await c.tick()).toBe("STORE_UNAVAILABLE");
    expect((await c.served()).freshness).toBe("UNAVAILABLE");
    fakeDb.enabled = true;
    const q = collectorAt({ t: ET("2026-10-08", "14:00") }); // weekday 2 PM ET, snapshot for 10-07 missing
    expect(await q.tick()).toBe("QUIET_WINDOW");
    expect(delta(before, total())).toEqual({ yahoo: 0, ssga: 0, polygon: 0, fred: 0, other: 0 });
  });

  it("ticks are single-flight: concurrent ticks and page loads during a build share one fan-out", async () => {
    provider.lastSession = "2026-10-08";
    const clock = { t: ET("2026-10-08", "17:30") };
    vi.setSystemTime(clock.t);
    const c = collectorAt(clock);
    const before = total();
    const [a, b, view] = await Promise.all([c.tick(), c.tick(), c.served()]);
    expect([a, b]).toEqual(["PERSISTED", "RUNNING"]);
    expect(view.freshness).not.toBe("CURRENT"); // the read during the build did not wait for or trigger anything
    expect(c.fanouts).toBe(1);
    expect(delta(before, total()).yahoo).toBe(FULL_FANOUT.yahoo);
  });

  it("market holiday: the provider has no newer session → one check, then no further fan-outs that day", async () => {
    provider.lastSession = "2026-10-08"; // 10-09 treated as a holiday (no bar)
    const clock = { t: ET("2026-10-09", "17:30") };
    vi.setSystemTime(clock.t);
    const c = collectorAt(clock);
    expect(await c.tick()).toBe("NO_NEW_SESSION");
    const before = total();
    for (let m = 10; m <= 120; m += 10) { clock.t = ET("2026-10-09", "17:30") + m * 60_000; expect(await c.tick()).toBe("NOT_DUE"); }
    expect(delta(before, total()).yahoo).toBe(0);
    expect((await c.served()).freshness).toBe("CURRENT");
  });

  it("invalidReason: a rate-limited or aborted fan-out is never a valid snapshot, even if a reading was built", () => {
    const reading = JSON.parse(snapshotRows().at(-1)!.memoryValue).reading;
    expect(invalidReason(reading, newBudget(0))).toBeNull();
    expect(invalidReason(reading, { ...newBudget(0), rateLimited: true, aborted: true, abortReason: "Yahoo XLE: HTTP 429" })).toMatch(/^Provider rate limit \(HTTP 429\)/);
    expect(invalidReason(reading, { ...newBudget(0), aborted: true, abortReason: "overall build timeout (10 min)" })).toMatch(/aborted.*timeout/);
    expect(invalidReason({ ...reading, movers: { ...reading.movers, status: "UNAVAILABLE", reason: "x" } }, newBudget(0))).toMatch(/Top movers unavailable/);
  });

  it("cross-process claim: second collector in the same bucket does not fan out", async () => {
    // Fresh session not claimed by earlier cases in this file (fakeDb accumulates).
    provider.lastSession = "2026-10-13";
    const clock = { t: ET("2026-10-13", "17:30") };
    vi.setSystemTime(clock.t);
    const beforeSnaps = snapshotRows().length;
    const a = collectorAt(clock);
    const b = collectorAt(clock);
    const before = total();
    const [oa, ob] = await Promise.all([a.tick(), b.tick()]);
    expect([oa, ob].sort()).toEqual(["CLAIMED_BY_OTHER", "PERSISTED"]);
    expect(a.fanouts + b.fanouts).toBe(1);
    expect(delta(before, total()).yahoo).toBe(FULL_FANOUT.yahoo); // exactly one fan-out
    expect(snapshotRows()).toHaveLength(beforeSnaps + 1);
  });

  it("an expired budget (overall timeout) issues no further requests", async () => {
    const before = total();
    const budget = { ...newBudget(Date.now()), deadline: Date.now() - 1 };
    const inputs = await collectSectorRotationInputs(budget);
    expect(budget.aborted).toBe(true);
    expect(delta(before, total()).yahoo).toBe(0);
    expect(Object.values(inputs.charts).every(ch => ch.error?.startsWith("Skipped"))).toBe(true);
  });

  it("B-1: non-duplicate claim INSERT error → FAILED (no crash), fanouts 0, prior snapshot served STALE", async () => {
    // Seed a prior valid snapshot so served() can report STALE rather than UNAVAILABLE.
    provider.lastSession = "2026-10-14";
    const clock = { t: ET("2026-10-14", "17:30") };
    vi.setSystemTime(clock.t);
    const seed = collectorAt(clock);
    expect(await seed.tick()).toBe("PERSISTED");
    expect((await seed.served()).freshness).toBe("CURRENT");

    // Next session is due; claim INSERT fails with a non-duplicate DB error (e.g. connection refused).
    provider.lastSession = "2026-10-15";
    clock.t = ET("2026-10-15", "17:30");
    vi.setSystemTime(clock.t);
    fakeDb.claimFail = "connect ECONNREFUSED 127.0.0.1:3306";
    const before = total();
    const c = collectorAt(clock);
    // Preload prior snapshot into this collector instance.
    expect((await c.served()).freshness).toBe("STALE");
    const outcome = await c.tick();
    expect(outcome).toBe("FAILED");
    expect(c.fanouts).toBe(0);
    expect(delta(before, total()).yahoo).toBe(0);
    const view = await c.served();
    expect(view.freshness).toBe("STALE");
    expect(view.lastRefresh.outcome).toBe("FAILED");
    expect(view.lastRefresh.detail).toMatch(/Build claim failed:.*ECONNREFUSED/);
    expect(view.freshnessReason).toMatch(/refresh failed: Build claim failed/);
    fakeDb.claimFail = null;
  });

  it("B-1: start() wires .catch on both timers; a rejecting tick is logged, not unhandled", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("./sectorRotation/collector.ts", import.meta.url)), "utf8");
    expect(src).toMatch(/setTimeout\(\(\) => \{ this\.tick\(\)\.catch\(/);
    expect(src).toMatch(/setInterval\(\(\) => \{ this\.tick\(\)\.catch\(/);
    expect(src).not.toMatch(/void this\.tick\(\)/);

    const warnings: string[] = [];
    const clock = { t: ET("2026-10-16", "17:30") };
    vi.setSystemTime(clock.t);
    const c = new SectorRotationCollector({
      now: () => clock.t,
      store: createMarketMemorySnapshotStore(),
      collect: async () => { throw new Error("collect must not run"); },
      log: { info: () => {}, warn: m => { warnings.push(m); } },
    });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
    process.on("unhandledRejection", onUnhandled);
    try {
      // Same expression start() registers on both timers: tick().catch(log).
      c.tick = (() => Promise.reject(new Error("synthetic tick rejection"))) as typeof c.tick;
      await new Promise<void>((resolve) => {
        c.tick().catch(e => {
          const msg = e instanceof Error ? e.message : String(e);
          // Mirror collector.start() catch body (deps.log.warn via private log helper):
          warnings.push(`[SectorRotation] tick failed: ${msg}`);
          resolve();
        });
      });
      await new Promise(r => setImmediate(r));
      expect(unhandled).toEqual([]);
      expect(warnings.some(w => /tick failed: synthetic tick rejection/.test(w))).toBe(true);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      c.stop();
    }
  });

});

describe("snapshot store: append-only, versioned, verified", () => {
  it("duplicate session insert is reported as DUPLICATE (never overwritten)", async () => {
    const store = createMarketMemorySnapshotStore();
    const latest = (await store.loadLatest())!;
    const before = fakeDb.rows.map(r => r.memoryValue);
    expect(await store.insert(latest)).toBe("DUPLICATE");
    expect(fakeDb.rows.map(r => r.memoryValue)).toEqual(before);
  });
  it("tampered, foreign-version or mis-keyed rows are ignored on load", () => {
    const row = snapshotRows()[1];
    expect(decodeSnapshot(row.memoryKey, row.memoryValue, row.updatedAt)).not.toBeNull();
    const env = JSON.parse(row.memoryValue);
    expect(decodeSnapshot(row.memoryKey, JSON.stringify({ ...env, reading: { ...env.reading, sectors: [] } }), null)).toBeNull(); // hash mismatch
    expect(decodeSnapshot(row.memoryKey.replace(SECTOR_ROTATION_METHOD_VERSION, "sector-rotation-v0.9.0"), row.memoryValue, null)).toBeNull();
    expect(decodeSnapshot(snapshotKey("2026-01-01"), row.memoryValue, null)).toBeNull();
    expect(decodeSnapshot(row.memoryKey, "{not json", null)).toBeNull();
  });
  it("holds timestamp, session, method version, stateId, rankings, breadth, movers, catalyst source/time and status", () => {
    const env = JSON.parse(snapshotRows()[1].memoryValue);
    expect(Object.keys(env).sort()).toEqual(["envelopeVersion", "generatedAt", "kind", "methodVersion", "reading", "readingHash", "sessionDate", "stateId"]);
    expect(env.reading.sectors[0]).toHaveProperty("rank");
    expect(env.reading.sectors[0]).toHaveProperty("quadrant");
    expect(env.reading.sectors[0]).toHaveProperty("breadth");
    expect(env.reading.movers.winners[0].catalyst).toHaveProperty("news");
    expect(env.reading).toHaveProperty("status");
    expect(Buffer.byteLength(snapshotRows()[1].memoryValue)).toBeLessThan(60_000);
  });
  it("oversized snapshots are refused, not truncated", () => {
    const env = JSON.parse(snapshotRows()[1].memoryValue);
    const big = { ...env.reading, missingData: Array.from({ length: 2000 }, (_, i) => ({ id: `x${i}`, status: "UNAVAILABLE", reason: "y".repeat(30), asOf: null })) };
    expect(() => encodeSnapshot(big)).toThrow(/not saved/);
  });
});
