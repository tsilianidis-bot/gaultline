import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeEvolution } from "./seismographUnified";
import { EngineSnapshotSchema, computeOverallConfidence } from "./routers/dailyBrief";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import { projectCanonicalMarketState, selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";
import { availableDelta, pointsDeltaText } from "../client/src/lib/displayFallbacks";
import { buildEngineSnapshot, canonicalPressure100 } from "../client/src/lib/engineSnapshot";

// QA r7 (#60 at c9c1e5c): display-only, fail-closed fixes. No engine change.
const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const marketState = JSON.parse(read("server/__fixtures__/prod-2026-10-01/market-state-current.json"));
const fallback503 = () => selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
const canonical = () => selectBrowserMarketOutput({ marketState, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });

describe("#2 canonical projection: missing delta renders —, direction from state.now.direction", () => {
  it("overall and domain deltas are marked unavailable (not a real 0)", () => {
    const out = projectCanonicalMarketState(marketState, fallback503().output);
    expect(out.overall.deltaAvailable).toBe(false);
    expect(availableDelta(out.overall)).toBeNull();
    expect(pointsDeltaText(availableDelta(out.overall))).toBe("—");
    expect(pointsDeltaText(availableDelta(out.overall))).not.toMatch(/\d|NaN/);
    expect(out.overall.direction).toBe(marketState.now.direction);
    for (const d of out.domains) {
      expect(availableDelta(d)).toBeNull();
      expect(pointsDeltaText(availableDelta(d))).toBe("—");
    }
  });
  it("an engine delta that is known still renders pts", () => {
    expect(pointsDeltaText(availableDelta({ delta: 0.3 }))).toBe("+3 pts");
    expect(pointsDeltaText(availableDelta({ delta: Number.NaN }))).toBe("—");
  });
  it("Dashboard reads the delta and direction through the fail-closed path", () => {
    const d = read("client/src/pages/Dashboard.tsx");
    expect(d).toContain("{ label: 'DELTA', value: pointsDeltaText(availableDelta(overall)), color }");
    expect(d).toContain("sub: `Δ ${pointsDeltaText(overallDelta)} vs baseline`");
    expect(d).toContain(": canonicalDirectionView(overall.direction);");
    expect(d).not.toMatch(/overall\.delta > 0\.2/);
    expect(d).not.toMatch(/pointsDeltaText\(overall\.delta\)/);
    expect(read("client/src/components/dashboard/PulseMode.tsx")).toContain('direction === "unavailable" ? "— Unavailable"');
  });
});

describe("#8 seismograph evolution: no NaN and no 'Stable' without a prior reading", () => {
  const months = (n: number) => Array.from({ length: n }, (_, i) => ({
    month: `20${String(10 + Math.floor(i / 12)).padStart(2, "0")}-${String((i % 12) + 1).padStart(2, "0")}`,
    score: 30 + (i % 7), regime: i % 2 ? "Moderate" : "Low",
    liquidity: 40, credit: 40, volatility: 40, macro: 40, breadth: 40,
  })) as any;
  for (const n of [1, 7, 24, 120]) {
    it(`history of ${n} months`, () => {
      const evo = computeEvolution(months(n));
      const text = JSON.stringify(evo);
      expect(text).not.toMatch(/NaN/);
      expect(evo.sevenDayTrend).toBe("Unavailable (no prior-week reading)");
      expect(evo.sevenDayTrend).not.toMatch(/Stable/);
    });
  }
  it("the legacy seismograph engine does not claim Stable without a prior week either", () => {
    expect(read("server/seismographEngine.ts")).toContain('prior7.length === 0\n    ? "Unavailable (no prior-week reading)"');
  });
});

describe("#7 SmartDiscovery under a canonical 503 shows no 45 and sends nothing", () => {
  it("deterministic-fallback (503) → no pressure, no snapshot", () => {
    const { output, mode } = fallback503();
    expect(mode).toBe("deterministic-fallback");
    expect(Math.round(output.overall.score * 10)).toBeGreaterThan(0); // demo engine value exists…
    expect(canonicalPressure100(output, mode)).toBeNull();            // …but is never shown
    expect(buildEngineSnapshot(output, mode)).toBeNull();             // …or sent to recordVisit
  });
  it("canonical → snapshot without invented liquidity/credit/ai/vol defaults", () => {
    const { output, mode } = canonical();
    const snap = buildEngineSnapshot(output, mode, 1)!;
    expect(snap.overallPressure).toBe(Math.round(output.overall.score * 10));
    expect(snap.liquidity).toBeNull();
    expect(snap.credit).toBeNull();
    expect(snap.aiConcentration).toBeNull();
    expect(snap.volatility).toBeNull();
    expect(EngineSnapshotSchema.parse(snap)).toBeTruthy();
  });
  it("source: snapshot builders and the market snapshot are fail-closed", () => {
    const s = read("client/src/pages/SmartDiscovery.tsx");
    expect(s).not.toMatch(/overallPressure: pressureScore/);
    expect(s).not.toMatch(/Math\.round\(\(10 - liquidityDomain\.score\) \* 10\) : 50/);
    expect(s).not.toMatch(/Math\.round\(creditDomain\.score \* 10\) : 30/);
    expect(s).not.toMatch(/aiConcentration: 32|volatility: 40/);
    expect(s).toContain("recordVisitMutation.mutate({ snapshot });");
    expect(s).toContain("const pressureScore = canonicalPressure100(output, marketMode);");
    expect(s).toContain("{pressureScore ?? '—'}");
  });
  it("server: missing liquidity → no confidence, no invented risk, prompt says Unavailable", () => {
    expect(computeOverallConfidence({ overallPressure: 33, breadth: 67, liquidity: null, bullProbability: 53 })).toBeNull();
    expect(computeOverallConfidence({ overallPressure: 33, breadth: 67, liquidity: 50, bullProbability: 53 })).toBe(61);
    const r = read("server/routers/dailyBrief.ts");
    expect(r).toContain("- Liquidity: ${readingText(engineSnapshot.liquidity)}");
    expect(r).toContain('if (liquidity === null || !Number.isFinite(liquidity)) return "UNAVAILABLE";');
  });
});

describe("#3/#4/#5 copy", () => {
  it("Guide has no 0–10 score copy except the Regime Fit entries, and no scenario probability estimate", () => {
    const lines = read("client/src/pages/Guide.tsx").split("\n").filter(l => /0[–-]10(?!\d)/.test(l));
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l).toMatch(/Regime Fit/);
    expect(read("client/src/pages/Guide.tsx")).not.toMatch(/probability estimate derived from the current regime score/);
  });
  it("Onboarding has no 0–10 copy or 0–10 band thresholds", () => {
    const o = read("client/src/components/Onboarding.tsx");
    expect(o).not.toMatch(/0[–-]10(?!\d)/);
    expect(o).not.toMatch(/3\.0–5\.0|8\.5\+/);
    expect(o).toContain("0–100 scale");
  });
  it("CryptoSignals labels its native 0–10 ratings explicitly", () => {
    const c = read("client/src/pages/CryptoSignals.tsx");
    expect(c).toContain('label: "ASSET VOLUME LIQUIDITY"');
    expect(c).toContain(">REGIME ALIGNMENT:</span>");
    expect(c).not.toContain('"LIQUIDITY SCORE"');
  });
});

describe("#9 C: MobileRotation has no invented 40 score or regime", () => {
  it("source", () => {
    const m = read("client/src/pages/mobile/MobileRotation.tsx");
    expect(m).not.toMatch(/rotation\?\.score \?\? (40|0)/);
    expect(m).not.toContain('?? "BTC DOMINANCE"');
    expect(m).toContain('label: "UNAVAILABLE"');
  });
});
