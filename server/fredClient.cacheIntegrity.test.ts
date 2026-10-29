import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFredCache, fetchFredBulk, fetchFredSeries } from "./fredClient";

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const observations = [{ date: "2026-10-28", value: "4.25" }];
const okResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({ observations }),
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  // The client reads the key dynamically. This synthetic key is only paired
  // with the mocked fetch below; these tests never contact FRED.
  vi.stubEnv("FRED_API_KEY", "fred-client-unit-test-key");
  clearFredCache();
});

afterEach(() => {
  clearFredCache();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("FRED series receipt provenance", () => {
  it("records receipt only after a successful response and preserves it across cache hits and bulk composition", async () => {
    const upstream = vi.fn(async () => okResponse());
    vi.stubGlobal("fetch", upstream as unknown as typeof fetch);

    const first = await fetchFredBulk([{ id: "DGS10", limit: 1 }]);
    const receivedAt = first.results.DGS10?.fetchedAt;
    expect(first.results.DGS10).toMatchObject({ cached: false, observations, fetchedAt: NOW });
    expect(receivedAt).toBe(NOW);

    vi.setSystemTime(NOW + 1_000);
    const second = await fetchFredBulk([{ id: "DGS10", limit: 1 }]);
    expect(second.timestamp).toBe(new Date(NOW + 1_000).toISOString());
    expect(second.results.DGS10).toMatchObject({ cached: true, observations, fetchedAt: receivedAt });
    expect(second.results.DGS10?.fetchedAt).not.toBe(Date.parse(second.timestamp));
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("shares the same actual receipt through an in-flight request", async () => {
    let resolveResponse: ((value: ReturnType<typeof okResponse>) => void) | undefined;
    const upstream = vi.fn(() => new Promise<ReturnType<typeof okResponse>>(resolve => { resolveResponse = resolve; }));
    vi.stubGlobal("fetch", upstream as unknown as typeof fetch);

    const first = fetchFredSeries("DGS2", 1);
    const second = fetchFredSeries("DGS2", 1);
    expect(upstream).toHaveBeenCalledTimes(1);

    resolveResponse?.(okResponse());
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toMatchObject({ cached: false, observations, fetchedAt: NOW });
    expect(secondResult).toMatchObject({ cached: false, observations, fetchedAt: NOW });
    expect(firstResult.fetchedAt).toBe(secondResult.fetchedAt);
  });

  it("does not manufacture a receipt for failed or empty responses", async () => {
    const upstream = vi.fn(async (url: RequestInfo | URL) => {
      const series = new URL(String(url)).searchParams.get("series_id");
      return series === "DGS10"
        ? { ok: false, status: 404, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ observations: [] }) };
    });
    vi.stubGlobal("fetch", upstream as unknown as typeof fetch);

    const bulk = await fetchFredBulk([{ id: "DGS10", limit: 1 }, { id: "DGS2", limit: 1 }]);
    expect(bulk.results.DGS10).toMatchObject({ cached: false, observations: [], error: "HTTP 404" });
    expect(bulk.results.DGS2).toMatchObject({ cached: false, observations: [], error: "empty observations" });
    expect(bulk.results.DGS10).not.toHaveProperty("fetchedAt");
    expect(bulk.results.DGS2).not.toHaveProperty("fetchedAt");
  });
});
