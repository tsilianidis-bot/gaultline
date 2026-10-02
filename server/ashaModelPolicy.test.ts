import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetAshaModelResolutionCache,
  resolveAshaModelCandidates,
} from "./ashaModelPolicy";

beforeEach(() => {
  resetAshaModelResolutionCache();
  delete process.env.FAULTLINE_PLATO_MODEL;
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

  it("reproduces the pre-migration exact-id mismatch, then selects the bare chat model", async () => {
    const catalogIds = [
      "models/gemini-embedding-001",
      "models/imagen-3.0-generate-002",
      "models/text-embedding-004",
      "models/gemini-3.1-pro-preview",
      "models/gemini-3-flash-preview",
    ];
    const legacyPreference = [
      "claude-sonnet-4-6",
      "gpt-5",
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
    ];
    const legacyAvailable = new Set(catalogIds);
    const legacyPreferred = legacyPreference.filter(model => legacyAvailable.has(model));
    const legacyCandidates = legacyPreferred.length > 0
      ? legacyPreferred
      : catalogIds.filter(Boolean).slice(0, 3);

    expect(legacyCandidates).toEqual([
      "models/gemini-embedding-001",
      "models/imagen-3.0-generate-002",
      "models/text-embedding-004",
    ]);

    const resolution = await resolveAshaModelCandidates({
      fetchCatalog: async () => ({ data: catalogIds.map(id => ({ id })) }),
    });

    expect(resolution).toMatchObject({
      candidates: ["gemini-3-flash-preview"],
      source: "live-catalog",
    });
    expect(resolution.candidates).not.toContain("gemini-3.1-pro-preview");
  });

  it("uses FAULTLINE_PLATO_MODEL when set, including a no-free-tier model, and strips models/", async () => {
    process.env.FAULTLINE_PLATO_MODEL = "models/gemini-3.1-pro-preview";
    const fetchCatalog = vi.fn();

    const resolution = await resolveAshaModelCandidates({ fetchCatalog });

    expect(resolution).toMatchObject({
      candidates: ["gemini-3.1-pro-preview"],
      source: "configured",
    });
    expect(fetchCatalog).not.toHaveBeenCalled();
  });

  it("keeps bare Forge catalog ids in institutional preference order", async () => {
    const resolution = await resolveAshaModelCandidates({
      fetchCatalog: async () => ({
        data: [
          { id: "gemini-3-flash-preview" },
          { id: "gpt-5" },
          { id: "claude-sonnet-4-6" },
        ],
      }),
    });

    expect(resolution.candidates).toEqual([
      "claude-sonnet-4-6",
      "gpt-5",
      "gemini-3-flash-preview",
    ]);
  });

  it("does not cache a non-chat catalog miss for the long TTL", async () => {
    const fetchCatalog = vi.fn()
      .mockResolvedValueOnce({
        data: [
          { id: "models/gemini-embedding-001" },
          { id: "models/imagen-3.0-generate-002" },
        ],
      })
      .mockResolvedValueOnce({
        data: [{ id: "models/gemini-3-flash-preview" }],
      });
    let nowMs = Date.parse("2026-07-23T13:00:00.000Z");

    const first = await resolveAshaModelCandidates({ fetchCatalog, now: () => nowMs });
    nowMs += 60_000;
    const second = await resolveAshaModelCandidates({ fetchCatalog, now: () => nowMs });

    expect(first).toMatchObject({
      candidates: ["gemini-3-flash-preview"],
      source: "transport-fallback",
    });
    expect(second).toMatchObject({
      candidates: ["gemini-3-flash-preview"],
      source: "live-catalog",
    });
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
