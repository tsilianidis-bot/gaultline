// QA B-3: the request path never fetches FRED; priors come only from the scheduled pipeline cache.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import deep from "./__fixtures__/fred-2026-10-12-deep.json";

const store = new Map<string, unknown>();
vi.mock("../seismographEngine", () => ({
  memoryGetJson: vi.fn(async (k: string, fb: unknown) => (store.has(k) ? store.get(k) : fb)),
  memorySetJson: vi.fn(async (k: string, v: unknown) => { store.set(k, JSON.parse(JSON.stringify(v))); }),
}));
const fredBulk = vi.fn(async () => ({ results: deep.results }));
vi.mock("../fredClient", () => ({ fetchFredBulk: (...a: unknown[]) => (fredBulk as any)(...a) }));

import { readCachedPriorComponents, refreshPriorComponentsAfterVerifiedRun, __resetPriorCacheForTests, PRIOR_COMPONENTS_MEMORY_KEY } from "./priorComponents";

beforeEach(() => { store.clear(); __resetPriorCacheForTests(); fredBulk.mockClear(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("network forbidden in request path"); })); });

describe("prior components cache", () => {
  it("request path with empty cache: no FRED fetch, null (→ Insufficient evidence)", async () => {
    expect(await readCachedPriorComponents("2026-10-11T18:05:24.744Z")).toBeNull();
    expect(fredBulk).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("scheduled refresh computes once; later reads (incl. after restart) use stored copy without fetching", async () => {
    const e = await refreshPriorComponentsAfterVerifiedRun("SCHEDULED_CRON", new Date("2026-10-12T16:00:00Z"));
    expect(e?.components["credit-contagion"]).toBe(17);
    expect(fredBulk).toHaveBeenCalledTimes(1);
    expect(store.has(PRIOR_COMPONENTS_MEMORY_KEY)).toBe(true);
    __resetPriorCacheForTests(); // simulate process restart: in-memory gone, Market Memory remains
    const r = await readCachedPriorComponents("2026-10-11T18:05:24.744Z");
    expect(r?.components).toMatchObject({ "liquidity-stress": 16, "credit-contagion": 17, "macro-sensitivity": 41 });
    expect(fredBulk).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("stale/misaligned cached prior is not used", async () => {
    await refreshPriorComponentsAfterVerifiedRun("SCHEDULED_CRON", new Date("2026-10-12T16:00:00Z"));
    expect(await readCachedPriorComponents("2026-11-30T18:00:00Z")).toBeNull();
  });
  it("request path source never fetches upstream", () => {
    const u = readFileSync("server/seismographUnified.ts", "utf8");
    expect(u).not.toMatch(/getPriorV1Components|refreshPriorComponentsAfterVerifiedRun|fetchFredBulk/);
    expect(u).toContain("readCachedPriorComponents(");
    expect(readFileSync("server/scheduledSeismograph.ts", "utf8")).toContain("refreshPriorComponentsAfterVerifiedRun(runContext.trigger)");
  });
});
