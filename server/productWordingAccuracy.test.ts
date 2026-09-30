// Guards the customer-facing wording fixes for the Pressure Index vectors and
// historical-validation claims. Display text only: ids, weights and scoring
// are asserted unchanged.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateFaultlinePressure } from "./pressure/engine";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { projectPressureFromCanonical } from "./canonicalPressureProjection";
import { PRESSURE_VECTOR_DISPLAY, pressureVectorLabel } from "../shared/pressureVectorLabels";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
});

describe("Pressure Index vector display labels", () => {
  it("keeps internal vector ids and weights unchanged", async () => {
    const result = await calculateFaultlinePressure();
    expect(result.vectors.map(v => [v.id, v.weight])).toEqual([
      ["liquidity-stress", 0.20],
      ["credit-contagion", 0.20],
      ["volatility-regime", 0.15],
      ["macro-sensitivity", 0.20],
      ["market-breadth", 0.10],
      ["ai-bubble", 0.15],
    ]);
  });

  it("engine labels and descriptions match the shared display map", async () => {
    const result = await calculateFaultlinePressure();
    for (const v of result.vectors) {
      expect(PRESSURE_VECTOR_DISPLAY[v.id], v.id).toBeDefined();
      expect(v.label, v.id).toBe(PRESSURE_VECTOR_DISPLAY[v.id].label);
      expect(v.description, v.id).toBe(PRESSURE_VECTOR_DISPLAY[v.id].description);
    }
  });

  it("names vectors by what they compute", async () => {
    const result = await calculateFaultlinePressure();
    const byId = Object.fromEntries(result.vectors.map(v => [v.id, v]));
    // volatility-regime reads DGS10 and DGS2 only
    expect(Object.keys(byId["volatility-regime"].rawInputs).sort()).toEqual(["tsy10y", "tsy2y"]);
    expect(byId["volatility-regime"].label).toMatch(/Yield Curve \(10Y–2Y\)/);
    expect(byId["volatility-regime"].label).not.toMatch(/volatility/i);
    // market-breadth reads UNRATE and DGS10 only
    expect(Object.keys(byId["market-breadth"].rawInputs).sort()).toEqual(["tsy10y", "unemployment"]);
    expect(byId["market-breadth"].label).not.toMatch(/breadth/i);
    expect(byId["market-breadth"].driver).not.toMatch(/breadth/i);
    // ai-bubble concentration input is static
    expect(byId["ai-bubble"].dataStatus).toBe("static");
    expect(byId["ai-bubble"].label).toMatch(/Static Baseline/);
    expect(byId["ai-bubble"].description).toMatch(/not a live measurement/);
    expect(byId["ai-bubble"].driver).toMatch(/static/i);
  });

  it("canonical projection uses the same display labels", () => {
    const state = buildCanonicalIntelligenceState({
      stateId: "state:wording-test",
      generatedAt: "2026-09-30T00:00:00.000Z",
      championVersion: "champion-v1-frozen",
      modelVersion: "2.0",
      scoringVersion: "faultline-pressure-v1-frozen",
      configurationVersion: "phase1b-governance-v1",
      inputSnapshotId: "input:wording-test",
      stateHash: "hash:wording-test",
      pressureIndex: 45,
      regime: "MODERATE RISK",
      engineValues: {
        "liquidity-stress": 40,
        "credit-contagion": 35,
        "volatility-regime": 50,
        "macro-sensitivity": 38,
        "market-breadth": 42,
        "ai-bubble": 40,
      },
      engineDirections: { "liquidity-stress": "stable" },
      domainValues: {},
      scenarioOutputs: { bull: 43, neutral: 43, bear: 14 },
      probabilityClaimIds: [],
      analogClaimIds: [],
      historicalDatasetVersion: "historical",
      researchDatasetVersion: "research",
      coherenceStatus: "COHERENT",
      coherenceNotes: [],
      dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] },
      staleInputs: [],
      unavailableInputs: [],
      fallbackInputs: [],
      inputQuality: [],
    } as any);
    const pressure = projectPressureFromCanonical(state);
    expect(pressure).not.toBeNull();
    expect(pressure!.vectors).toHaveLength(6);
    for (const v of pressure!.vectors) {
      expect(v.label, v.id).toBe(pressureVectorLabel(v.id));
    }
  });
});

describe("historical validation claims", () => {
  const pages = [
    "client/src/pages/TrustCenter.tsx",
    "client/src/pages/TrackRecord.tsx",
    "client/src/pages/seo/MarketCrashIndicator.tsx",
    "client/src/components/dashboard/IntelligenceMode.tsx",
    "server/seoMeta.ts",
  ];

  it.each(pages)("%s does not claim a 25-year backtest or validated methodology", file => {
    const text = read(file);
    expect(text).not.toMatch(/back-?tested (against|for) 25 years/i);
    expect(text).not.toMatch(/25-year (track record|stress test|backtest)/i);
    expect(text).not.toMatch(/25 Years of/);
    expect(text).not.toMatch(/METHODOLOGY VALIDATED|SAME ENGINE|exact same six-vector engine/);
    expect(text).not.toMatch(/no hindsight, no curve-fitting|no hindsight and no curve-fitting/);
  });

  it("Trust Center lists the six implemented vectors and flags the static baseline", () => {
    const text = read("client/src/pages/TrustCenter.tsx");
    expect(text).toContain("Six Measurement Vectors");
    expect(text).not.toContain("Volatility & Sentiment");
    expect(text).toContain("Yield Curve (10Y–2Y) & 10Y Level");
    expect(text).toContain("Labor & Rates (Unemployment, 10Y)");
    expect(text).toContain("AI / Speculation (Static Baseline)");
    expect(text).toContain("has not been independently validated as a predictive backtest");
  });

  it("public pressure page does not claim VIX or volatility-surface inputs", () => {
    const text = read("client/src/pages/PressureIndex.tsx");
    expect(text).not.toContain("VIX regimes");
    expect(text).not.toContain("volatility surfaces");
    expect(text).toContain("STATIC BASELINE");
    expect(read("server/seoMeta.ts")).not.toContain("aggregates volatility, credit spreads, liquidity, and breadth");
  });
});
