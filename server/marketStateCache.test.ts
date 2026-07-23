import { describe, expect, it, vi } from "vitest";
import { MarketStateCache } from "./marketStateCache";

describe("MarketStateCache", () => {
  it("serves a fresh cached value without reloading", async () => {
    let now = 1_000;
    const cache = new MarketStateCache<string>(100, 1_000);
    const loader = vi.fn(async () => "first");

    expect((await cache.getOrLoad(loader, { now: () => now })).status).toBe("refreshed");
    now += 50;
    const result = await cache.getOrLoad(loader, { now: () => now });

    expect(result).toMatchObject({ value: "first", status: "fresh-cache", ageMs: 50 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent refreshes", async () => {
    const cache = new MarketStateCache<string>(100, 1_000);
    let resolve!: (value: string) => void;
    const loader = vi.fn(() => new Promise<string>(done => { resolve = done; }));

    const first = cache.getOrLoad(loader);
    const second = cache.getOrLoad(loader);
    resolve("shared");

    await expect(Promise.all([first, second])).resolves.toEqual([
      { value: "shared", status: "refreshed", ageMs: 0 },
      { value: "shared", status: "refreshed", ageMs: 0 },
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("serves a bounded stale value when refresh fails", async () => {
    let now = 1_000;
    const cache = new MarketStateCache<string>(100, 1_000);
    await cache.getOrLoad(async () => "last-known-good", { now: () => now });
    now += 150;

    const error = new Error("provider unavailable");
    const result = await cache.getOrLoad(async () => { throw error; }, { now: () => now });

    expect(result).toMatchObject({ value: "last-known-good", status: "stale-if-error", ageMs: 150, error });
  });

  it("throws when both refresh and the stale window are exhausted", async () => {
    let now = 1_000;
    const cache = new MarketStateCache<string>(100, 200);
    await cache.getOrLoad(async () => "expired", { now: () => now });
    now += 201;

    await expect(cache.getOrLoad(async () => { throw new Error("down"); }, { now: () => now }))
      .rejects.toThrow("down");
  });

  it("invalidates stored values and prevents an older in-flight refresh from repopulating the cache", async () => {
    const cache = new MarketStateCache<string>(100, 1_000);
    let resolve!: (value: string) => void;
    const pending = cache.getOrLoad(() => new Promise<string>(done => { resolve = done; }));
    cache.invalidate();
    resolve("obsolete");
    await pending;

    expect(cache.peek()).toBeNull();
  });
});
