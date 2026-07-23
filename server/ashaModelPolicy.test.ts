import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetAshaModelResolutionCache,
  resolveAshaModelCandidates,
} from "./ashaModelPolicy";

beforeEach(() => {
  resetAshaModelResolutionCache();
});

describe("resolveAshaModelCandidates", () => {
  it("selects only currently available models in institutional preference order", async () => {
    const resolution = await resolveAshaModelCandidates({
      now: () => Date.parse("2026-07-23T13:00:00.000Z"),
      fetchCatalog: async () => ({
        data: [
          { id: "gemini-3-flash-preview" },
          { id: "gpt-5" },
          { id: "claude-sonnet-4-6" },
        ],
      }),
    });

    expect(resolution).toMatchObject({
      candidates: ["claude-sonnet-4-6", "gpt-5", "gemini-3-flash-preview"],
      source: "live-catalog",
    });
  });

  it("uses the catalog itself when preferred model families change", async () => {
    const resolution = await resolveAshaModelCandidates({
      fetchCatalog: async () => ({ data: [{ id: "future-model-a" }, { id: "future-model-b" }] }),
    });

    expect(resolution.candidates).toEqual(["future-model-a", "future-model-b"]);
    expect(resolution.source).toBe("live-catalog");
  });

  it("falls back explicitly when live catalog discovery fails", async () => {
    const resolution = await resolveAshaModelCandidates({
      fetchCatalog: async () => {
        throw new Error("catalog unavailable");
      },
    });

    expect(resolution).toMatchObject({
      candidates: ["gemini-3-flash-preview"],
      source: "transport-fallback",
    });
  });

  it("caches catalog resolution within the bounded TTL", async () => {
    const fetchCatalog = vi.fn().mockResolvedValue({ data: [{ id: "gpt-5" }] });
    let nowMs = Date.parse("2026-07-23T13:00:00.000Z");

    await resolveAshaModelCandidates({ fetchCatalog, now: () => nowMs });
    nowMs += 5 * 60 * 1000;
    await resolveAshaModelCandidates({ fetchCatalog, now: () => nowMs });

    expect(fetchCatalog).toHaveBeenCalledTimes(1);
  });

  it("refreshes the bounded cache on demand and adopts the latest live catalogue", async () => {
    const fetchCatalog = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: "gpt-5" }] })
      .mockResolvedValueOnce({ data: [{ id: "claude-sonnet-4-6" }] });
    let nowMs = Date.parse("2026-07-23T13:00:00.000Z");

    const first = await resolveAshaModelCandidates({ fetchCatalog, now: () => nowMs });
    nowMs += 60_000;
    const refreshed = await resolveAshaModelCandidates({ fetchCatalog, now: () => nowMs, forceRefresh: true });

    expect(first.candidates).toEqual(["gpt-5"]);
    expect(refreshed.candidates).toEqual(["claude-sonnet-4-6"]);
    expect(fetchCatalog).toHaveBeenCalledTimes(2);
  });

  it("uses the explicit transport fallback when the live catalogue is empty", async () => {
    const resolution = await resolveAshaModelCandidates({
      fetchCatalog: async () => ({ data: [] }),
      now: () => Date.parse("2026-07-23T13:00:00.000Z"),
    });

    expect(resolution).toEqual({
      candidates: ["gemini-3-flash-preview"],
      source: "transport-fallback",
      resolvedAt: "2026-07-23T13:00:00.000Z",
    });
  });
});
