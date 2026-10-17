/**
 * Live FRED verification, separate from fixture tests.
 *
 * When FRED_API_KEY is unset this file skips the network and says so.
 * When the key is present in the process environment it reads DGS10, DGS2, and
 * BAMLH0A0HYM2 and classifies those observations with the integrity gate.
 * It does not write the evidence store, the track-record ledger, or any database.
 * Do not pass a key on the command line or print one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateIntelligenceEvidence } from "../shared/intelligenceIntegrity";
import { clearFredCache, fetchFredBulk, type FredBulkResult } from "./fredClient";

const SERIES = ["DGS10", "DGS2", "BAMLH0A0HYM2"] as const;
const FRED_MAX_AGE_MS = 96 * 60 * 60_000;
const keyConfigured = Boolean(process.env.FRED_API_KEY?.trim());

interface ClassifiedFredObservation {
  seriesId: string;
  status: "verified" | "stale" | "unavailable";
  canSupportCurrentClaim: boolean;
  observedAt: string | null;
  receivedAt: string | null;
  ageMs: number | null;
}

function classifyFredObservation(seriesId: string, bulk: FredBulkResult, nowMs: number): ClassifiedFredObservation {
  const result = bulk.results[seriesId];
  const unavailable = (observedAt: string | null = null): ClassifiedFredObservation => ({
    seriesId,
    status: "unavailable",
    canSupportCurrentClaim: false,
    observedAt,
    receivedAt: bulk.timestamp ?? null,
    ageMs: null,
  });
  if (!result || result.error) return unavailable();
  const observation = result.observations.find(item => item.value !== "." && Number.isFinite(Number(item.value)));
  if (!observation?.date) return unavailable();
  const observedAt = new Date(`${observation.date}T00:00:00.000Z`).toISOString();
  const receivedAt = bulk.timestamp;
  const gate = evaluateIntelligenceEvidence({
    id: `fred:${seriesId}`,
    source: "Federal Reserve Economic Data (FRED)",
    origin: "observed",
    value: Number(observation.value),
    observedAt,
    receivedAt,
    maxAgeMs: FRED_MAX_AGE_MS,
    sourceHealthy: true,
  }, nowMs);
  return {
    seriesId,
    status: gate.status === "delayed" ? "unavailable" : gate.status,
    canSupportCurrentClaim: gate.canSupportCurrentClaim,
    observedAt,
    receivedAt,
    ageMs: nowMs - Date.parse(observedAt),
  };
}

describe.skipIf(keyConfigured)("FRED live verification skipped: FRED_API_KEY is unset", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearFredCache();
  });

  it("does not request FRED observations", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      throw new Error("FRED must not be called when FRED_API_KEY is unset");
    }) as typeof fetch);
    clearFredCache();
    const result = await fetchFredBulk(SERIES.map(id => ({ id, limit: 1 })));
    expect(calls).toEqual([]);
    for (const id of SERIES) expect(result.results[id]?.error).toBe("FRED_API_KEY not configured");
    expect(JSON.stringify(result)).not.toContain("api_key");
  });
});

describe.skipIf(!keyConfigured)("FRED live integrity gate", () => {
  afterEach(() => {
    clearFredCache();
  });

  it("classifies real DGS10, DGS2, and HY OAS observations without writing a ledger", async () => {
    clearFredCache();
    const nowMs = Date.now();
    const bulk = await fetchFredBulk(SERIES.map(id => ({ id, limit: 5 })));
    const classified = SERIES.map(id => classifyFredObservation(id, bulk, nowMs));
    for (const row of classified) {
      expect(row.seriesId.startsWith("fred:") ? row.seriesId : `fred:${row.seriesId}`).toBe(`fred:${row.seriesId}`);
      expect(["verified", "stale", "unavailable"]).toContain(row.status);
      expect(row.canSupportCurrentClaim).toBe(row.status === "verified");
      if (row.status !== "unavailable") {
        expect(row.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00.000Z$/);
        expect(Date.parse(row.receivedAt ?? "")).not.toBeNaN();
        expect(row.ageMs).toEqual(expect.any(Number));
      }
    }
    for (const id of ["DGS10", "BAMLH0A0HYM2"] as const) {
      const row = classified.find(item => item.seriesId === id)!;
      expect(bulk.results[id]?.error ?? null).toBeNull();
      expect(row.observedAt).toBeTruthy();
      if ((row.ageMs ?? Number.POSITIVE_INFINITY) <= FRED_MAX_AGE_MS) {
        expect(row.status).toBe("verified");
        expect(row.canSupportCurrentClaim).toBe(true);
      } else {
        expect(row.status).toBe("stale");
        expect(row.canSupportCurrentClaim).toBe(false);
      }
    }
    expect(JSON.stringify(classified)).not.toMatch(/api_key|"value"/);
  });
});
