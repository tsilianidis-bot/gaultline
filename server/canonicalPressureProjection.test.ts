import { describe, expect, it } from "vitest";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import {
  hasRequiredCryptoVectors,
  isCanonicalCurrentUsable,
  projectPressureFromCanonical,
  selectScenarioProbabilities,
} from "./canonicalPressureProjection";

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    stateId: "state:projection-test",
    generatedAt: "2026-09-12T00:00:00.000Z",
    championVersion: "champion-v1-frozen",
    modelVersion: "2.0",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "phase1b-governance-v1",
    inputSnapshotId: "input:projection-test",
    stateHash: "hash:projection-test",
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
    ...overrides,
  };
}

describe("canonical pressure projection", () => {
  it("projects pressure, regime, and engines from a usable canonical state", () => {
    const state = buildCanonicalIntelligenceState(manifest());
    expect(isCanonicalCurrentUsable(state)).toBe(true);
    const pressure = projectPressureFromCanonical(state);
    expect(pressure).not.toBeNull();
    expect(pressure?.overallPressure).toBe(45);
    expect(pressure?.regime).toBe("MODERATE RISK");
    expect(pressure?.vectors.find(v => v.id === "liquidity-stress")?.score).toBe(40);
    expect(hasRequiredCryptoVectors(pressure!)).toBe(true);
  });

  it("keeps bull-continuation and crash/drawdown as separate scenario fields", () => {
    const state = buildCanonicalIntelligenceState(manifest());
    expect(selectScenarioProbabilities(state)).toEqual({ bull: 43, crash: 14, neutral: 43 });
  });

  it("withholds when pressure is missing", () => {
    const state = buildCanonicalIntelligenceState(manifest({ pressureIndex: null }));
    expect(isCanonicalCurrentUsable(state)).toBe(false);
    expect(projectPressureFromCanonical(state)).toBeNull();
  });

  it("withholds when quality or coherence is UNAVAILABLE", () => {
    const unavailable = buildCanonicalIntelligenceState(manifest({
      coherenceStatus: "UNAVAILABLE",
      unavailableInputs: ["fred:hy"],
      inputQuality: [{ inputId: "fred:hy", required: true, freshnessStatus: "UNAVAILABLE" }],
    }));
    expect(isCanonicalCurrentUsable(unavailable)).toBe(false);
    expect(projectPressureFromCanonical(unavailable)).toBeNull();
  });

  it("does not invent scenario probabilities", () => {
    const state = buildCanonicalIntelligenceState(manifest({ scenarioOutputs: {} }));
    expect(selectScenarioProbabilities(state)).toEqual({ bull: null, crash: null, neutral: null });
  });
});
