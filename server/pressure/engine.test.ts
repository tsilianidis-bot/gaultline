// ============================================================
// FAULTLINE — Pressure Engine Tests
// Phase 1 (2026-10-13): the engine FAILS CLOSED. The former
// "fallback mode" suite (hard-coded constants labelled live/fallback)
// is replaced by fail-closed + verified-input tests.
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import fixture from "./__fixtures__/fred-2026-10-12.json";
import {
  calculateFaultlinePressure,
  computePressureFromVerifiedInputs,
  resolveVerifiedInputs,
  dateMatchedYoY,
  parseFredValue,
  markPreservedReadingStale,
  PressureInputsUnavailableError,
  __resetPressureSnapshotForTests,
  type FredResultsLike,
} from "./engine";

const NOW = new Date("2026-10-12T16:00:00Z");
const base = (): FredResultsLike => JSON.parse(JSON.stringify(fixture.results));

function verifiedOutput(results = base(), now = NOW) {
  const r = resolveVerifiedInputs(results, now);
  expect(r.problems).toEqual([]);
  return computePressureFromVerifiedInputs(r.inputs, r.provenance, now);
}

beforeEach(() => {
  __resetPressureSnapshotForTests();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
});

describe("v1 reproducibility (Oct 12 2026 inputs)", () => {
  it("reproduces vectors 22/22/40/44/29/44, composite 33.1 → 33", () => {
    const out = verifiedOutput();
    expect(out.vectors.map(v => v.score)).toEqual([22, 22, 40, 44, 29, 44]);
    const raw = out.vectors.reduce((s, v) => s + v.score * v.weight, 0);
    expect(raw).toBeCloseTo(33.1, 6);
    expect(out.overallPressure).toBe(33);
    expect(out.level).toBe("Moderate");
    expect(out.dataSource).toBe("live");
    expect(out.verification?.status).toBe("verified");
  });
  it("records per-input observation dates", () => {
    const out = verifiedOutput();
    const by = Object.fromEntries(out.verification!.inputs.map(i => [i.inputId, i]));
    expect(by.hySpread.observationDate).toBe("2026-10-08");
    expect(by.hySpread.value).toBe(315);
    expect(by.cpi).toMatchObject({ value: 3.35, observationDate: "2026-08-01", baseObservationDate: "2025-08-01" });
    expect(by.ppi).toMatchObject({ value: 9.85, observationDate: "2026-08-01" });
    const liq = out.vectors.find(v => v.id === "liquidity-stress")!;
    expect(liq.observationDates).toEqual({ hySpread: "2026-10-08", sofr: "2026-10-08" });
  });
  it("weights sum to 1 and 6 unique vectors", () => {
    const out = verifiedOutput();
    expect(out.vectors.reduce((s, v) => s + v.weight, 0)).toBeCloseTo(1, 9);
    expect(new Set(out.vectors.map(v => v.id)).size).toBe(6);
  });
});

describe("CPI date-matched YoY", () => {
  it("matches the old positional result when no month is missing", () => {
    const cpi = base().CPIAUCSL!.observations;
    expect(dateMatchedYoY(cpi)).toEqual({ value: 3.35, observationDate: "2026-08-01", baseObservationDate: "2025-08-01" });
  });
  it("Oct 2026 CPI release with missing Oct 2025 base: no NaN; uses latest month with a valid base", () => {
    const obs = [{ date: "2026-10-01", value: "336.500" }, { date: "2026-09-01", value: "335.200" }, ...base().CPIAUCSL!.observations];
    // Old positional code: obs[12] would be 2025-10-01 '.' → parseFloat('.') = NaN.
    expect(obs[12]).toEqual({ date: "2025-10-01", value: "." });
    expect(Number.isNaN(parseFloat(obs[12].value))).toBe(true);
    const y = dateMatchedYoY(obs)!;
    expect(y.observationDate).toBe("2026-09-01");
    expect(y.baseObservationDate).toBe("2025-09-01");
    expect(y.value).toBe(parseFloat(((335.2 / 324.245 - 1) * 100).toFixed(2)));
    expect(Number.isFinite(y.value)).toBe(true);
  });
  it("full pipeline with the Oct 2026 release yields a finite score (no NaN reaches the index)", () => {
    const r = base();
    r.CPIAUCSL!.observations = [{ date: "2026-10-01", value: "336.5" }, { date: "2026-09-01", value: "335.2" }, ...r.CPIAUCSL!.observations].slice(0, 15);
    const out = verifiedOutput(r, new Date("2026-10-15T16:00:00Z")); // daily fixture rows stay fresh; CPI rows are the hypothetical Oct-2026 release
    expect(Number.isFinite(out.overallPressure)).toBe(true);
    const cpi = out.verification!.inputs.find(i => i.inputId === "cpi")!;
    expect(cpi.observationDate).toBe("2026-09-01");
  });
  it("irregular order and duplicates are handled by date, not position", () => {
    const obs = [...base().CPIAUCSL!.observations].reverse();
    expect(dateMatchedYoY(obs)?.observationDate).toBe("2026-08-01");
  });
  it("returns null when no month has a valid year-earlier base", () => {
    expect(dateMatchedYoY([{ date: "2026-08-01", value: "334" }, { date: "2025-08-01", value: "." }])).toBeNull();
    expect(dateMatchedYoY([])).toBeNull();
  });
  it("parseFredValue rejects '.', '', NaN, Infinity", () => {
    for (const v of [".", "", "NaN", "Infinity", "-Infinity", "abc", undefined, null]) expect(parseFredValue(v as any)).toBeNull();
    expect(parseFredValue("3.15")).toBe(3.15);
  });
});

describe("FRED fail-closed", () => {
  it("rejects a set with one series missing (no constants substituted)", () => {
    const r = base();
    r.DGS2 = { observations: [], error: "HTTP 500" };
    const res = resolveVerifiedInputs(r, NOW);
    expect(res.ok).toBe(false);
    expect(res.problems.join()).toMatch(/tsy2y \(DGS2\) missing/);
    expect(res.inputs.tsy2y).toBeNull();
  });
  it("rejects invalid values ('.', Infinity, out of range)", () => {
    const r = base();
    r.SOFR!.observations = r.SOFR!.observations.map(o => ({ ...o, value: "." }));
    r.UNRATE!.observations = [{ date: "2026-09-01", value: "Infinity" }];
    r.DGS10!.observations = [{ date: "2026-10-08", value: "99" }];
    const res = resolveVerifiedInputs(r, NOW);
    expect(res.ok).toBe(false);
    expect(res.problems.length).toBe(3);
  });
  it("rejects stale observations", () => {
    const res = resolveVerifiedInputs(base(), new Date("2026-11-30T00:00:00Z"));
    expect(res.ok).toBe(false);
    expect(res.provenance.find(p => p.inputId === "hySpread")!.status).toBe("stale");
  });
  it("rejects a future-dated observation rather than treating it as a newer verified input", () => {
    const r = base();
    r.DGS10!.observations = [{ date: "2026-10-13", value: "4.20" }, ...r.DGS10!.observations];
    const res = resolveVerifiedInputs(r, NOW);
    const tenYear = res.provenance.find(p => p.inputId === "tsy10y")!;
    expect(res.ok).toBe(false);
    expect(tenYear).toMatchObject({ observationDate: "2026-10-13", status: "invalid" });
    expect(tenYear.detail).toMatch(/future-dated/);
    expect(res.inputs.tsy10y).toBeNull();
  });
  it("skips holiday '.' rows for daily series", () => {
    const r = base();
    r.DGS10!.observations = [{ date: "2026-10-09", value: "." }, ...r.DGS10!.observations];
    expect(resolveVerifiedInputs(r, NOW).ok).toBe(true);
  });
  it("computePressureFromVerifiedInputs refuses an incomplete set", () => {
    const r = resolveVerifiedInputs(base(), NOW);
    expect(() => computePressureFromVerifiedInputs({ ...r.inputs, cpi: null }, r.provenance, NOW)).toThrow(PressureInputsUnavailableError);
    expect(() => computePressureFromVerifiedInputs({ ...r.inputs, cpi: NaN }, r.provenance, NOW)).toThrow(PressureInputsUnavailableError);
  });
  it("throws (never fabricates) when FRED is down and no verified reading exists", async () => {
    await expect(calculateFaultlinePressure()).rejects.toBeInstanceOf(PressureInputsUnavailableError);
  });
  it("preserved reading keeps its ORIGINAL timestamps and is labelled stale", () => {
    const out = verifiedOutput();
    const stale = markPreservedReadingStale(out, [], ["DGS2 missing"]);
    expect(stale.timestamp).toBe(out.timestamp);
    expect(stale.lastUpdated).toBe(out.lastUpdated);
    expect(stale.overallPressure).toBe(33);
    expect(stale.dataSource).toBe("fallback");
    expect(stale.verification?.status).toBe("stale");
    expect(stale.vectors.filter(v => v.id !== "ai-bubble").every(v => v.dataStatus === "stale")).toBe(true);
    expect(stale.vectors.find(v => v.id === "ai-bubble")!.dataStatus).toBe("static");
  });
  // The FRED client requires FRED_API_KEY before issuing (mocked) HTTP; skip cleanly without it.
  it.skipIf(!process.env.FRED_API_KEY)("end-to-end: a complete live FRED fetch (mocked HTTP) yields a verified 33", async () => {
    const results = base();
    const fetchMock = vi.fn(async (url: string) => {
      const id = new URL(url).searchParams.get("series_id")!;
      return { ok: true, status: 200, json: async () => ({ observations: results[id]!.observations }) } as any;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    try {
      const first = await calculateFaultlinePressure();
      expect(first.verification?.status).toBe("verified");
      expect(first.overallPressure).toBe(33);
    } finally { vi.useRealTimers(); }
  });
});

describe("static / labelling invariants", () => {
  it("ai-bubble is labelled static with a reason", () => {
    const ai = verifiedOutput().vectors.find(v => v.id === "ai-bubble")!;
    expect(ai.dataStatus).toBe("static");
    expect(ai.fallbackReason).toBeTruthy();
  });
});
