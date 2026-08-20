import { describe, expect, it } from "vitest";
import { buildCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "./canonicalIntelligenceState";

const base = {
  stateId: "state:test", generatedAt: "2026-08-20T18:10:00.000Z", championVersion: "champion-v1-frozen", modelVersion: "2.0", scoringVersion: "faultline-pressure-v1-frozen", configurationVersion: "phase1b-governance-v1", inputSnapshotId: "input:test", stateHash: "hash:test", pressureIndex: 27, regime: "MODERATE RISK", engineValues: { "liquidity-stress": 16 }, engineDirections: { "liquidity-stress": "stable" }, domainValues: { evidenceConsensus: "weak" }, scenarioOutputs: { bull: 43, bear: 14 }, probabilityClaimIds: ["seismograph.scenario.bull"], analogClaimIds: ["seismograph.analog.0"], historicalDatasetVersion: "legacy-317-unreconciled", researchDatasetVersion: "reconstructed-research", coherenceStatus: "COHERENT", coherenceNotes: [], dataQualitySummary: { totalInputs: 2, delayedInputs: 0, staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] }, staleInputs: [], unavailableInputs: [], fallbackInputs: [], inputQuality: [
    { inputId: "hy", freshnessStatus: "LIVE", contributesTo: ["liquidity-stress"] },
    { inputId: "cpi", freshnessStatus: "DELAYED", contributesTo: [] },
  ],
};

describe("Phase 2 canonical intelligence state", () => {
  it("keeps level, classification, direction, acceleration, and persistence separate", () => {
    const state = buildCanonicalIntelligenceState(base);
    expect(state.pressureIndex).toBe(27); expect(state.regime).toBe("MODERATE RISK");
    expect(state.pressureAcceleration).toBeNull(); expect(state.pressurePersistence).toBeNull();
  });
  it("preserves governed probability and analog categories without conversion", () => {
    const state = buildCanonicalIntelligenceState(base);
    expect(state.probabilityClaimIds).toEqual(["seismograph.scenario.bull"]); expect(state.analogClaimIds).toEqual(["seismograph.analog.0"]);
  });
  it("propagates stale, unavailable, fallback, and mismatch state as explicit conflicts", () => {
    const state = buildCanonicalIntelligenceState({ ...base, coherenceStatus: "EXPLICIT_MISMATCH", coherenceNotes: ["pressure-score-mismatch:27:22"], staleInputs: ["hy"], unavailableInputs: ["cpi"], fallbackInputs: ["hy"] });
    expect(state.confidenceOrEvidenceQuality).toBe("DEGRADED"); expect(state.conflicts).toHaveLength(4);
  });
  it("provides a safe public projection without internal domains", () => {
    const state = buildCanonicalIntelligenceState(base); const publicState = toPublicCanonicalIntelligenceState(state);
    expect("domains" in publicState).toBe(false); expect(publicState.stateId).toBe("state:test"); expect(publicState.dataQualitySummary.delayedInputCount).toBe(1);
  });
});
