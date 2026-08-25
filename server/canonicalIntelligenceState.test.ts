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
    expect(state.confidenceOrEvidenceQuality).toBe("UNAVAILABLE"); expect(state.conflicts).toHaveLength(4);
  });
  it("provides a safe public projection without internal domains", () => {
    const state = buildCanonicalIntelligenceState(base); const publicState = toPublicCanonicalIntelligenceState(state);
    expect("domains" in publicState).toBe(false); expect(publicState.stateId).toBe("state:test"); expect(publicState.dataQualitySummary.delayedInputCount).toBe(1);
  });

  it("TEST B: detects incompatible component timing as conflicted rather than coherent", () => {
    const state = buildCanonicalIntelligenceState({ ...base, coherenceStatus: "EXPLICIT_MISMATCH", coherenceNotes: ["temporal-mismatch:engine-a:engine-b"] });
    expect(state.provenance.coherenceStatus).toBe("DEGRADED");
    expect(state.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ conflictType: "TEMPORAL_MISMATCH", resolutionStatus: "UNRESOLVED" })]));
  });

  it("TEST C: propagates a stale required input as non-healthy", () => {
    const state = buildCanonicalIntelligenceState({ ...base, staleInputs: ["hy"], dataQualitySummary: { ...base.dataQualitySummary, staleInputs: ["hy"] } });
    expect(state.confidenceOrEvidenceQuality).toBe("PARTIAL");
    expect(state.staleInputs).toEqual(["hy"]);
    expect(state.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ conflictType: "STALE_INPUT" })]));
  });

  it("retains stale freshness on the affected engine rather than treating its observation as current", () => {
    const state = buildCanonicalIntelligenceState({ ...base, staleInputs: ["hy"], dataQualitySummary: { ...base.dataQualitySummary, staleInputs: ["hy"] } });
    expect(state.engines[0]).toMatchObject({ engineId: "liquidity-stress", freshnessStatus: "STALE", qualityStatus: "PARTIAL" });
  });

  it("TEST D: preserves an optional unavailable input as unavailable without converting it to zero or healthy input", () => {
    const state = buildCanonicalIntelligenceState({
      ...base,
      unavailableInputs: ["optional-credit"],
      inputQuality: [...base.inputQuality, { inputId: "optional-credit", required: false, freshnessStatus: "UNAVAILABLE", contributesTo: [] }],
    });
    expect(state.confidenceOrEvidenceQuality).toBe("PARTIAL");
    expect(state.unavailableInputs).toEqual(["optional-credit"]);
    expect(state.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ conflictType: "UNAVAILABLE_INPUT", components: ["optional-credit"] })]));
  });

  it("TEST E: preserves governed fallback origin, target, reason, quality impact, and audit conflict", () => {
    const state = buildCanonicalIntelligenceState({
      ...base,
      fallbackInputs: ["hy"],
      inputQuality: [{ inputId: "hy", required: true, freshnessStatus: "FALLBACK", contributesTo: ["liquidity-stress"], originalSource: "FRED:BAMLH0A0HYM2", fallbackSource: "cached:verified-observation", fallbackReason: "provider-timeout" }],
    });
    expect(state.confidenceOrEvidenceQuality).toBe("DEGRADED");
    expect(state.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({
      conflictType: "FALLBACK_INPUT", originalSource: "FRED:BAMLH0A0HYM2", fallbackSource: "cached:verified-observation", fallbackReason: "provider-timeout",
    })]));
  });

  it("TEST F and G: retains probability claim references and analog similarity references without semantic conversion", () => {
    const state = buildCanonicalIntelligenceState(base);
    expect(state.probabilityClaimIds).toEqual(["seismograph.scenario.bull"]);
    expect(state.analogClaimIds).toEqual(["seismograph.analog.0"]);
    expect(JSON.stringify(state)).not.toMatch(/recurrence probability|outcome probability|forecast confidence/i);
  });

  it("TEST H: retains each historical canonical state version identity independently", () => {
    const prior = buildCanonicalIntelligenceState({ ...base, stateId: "state:prior", modelVersion: "model-prior", configurationVersion: "config-prior", inputSnapshotId: "inputs-prior" });
    const current = buildCanonicalIntelligenceState({ ...base, stateId: "state:current", modelVersion: "model-current", configurationVersion: "config-current", inputSnapshotId: "inputs-current" });
    expect(prior).toMatchObject({ stateId: "state:prior", modelVersion: "model-prior", configurationVersion: "config-prior", inputSnapshotId: "inputs-prior" });
    expect(current.stateId).toBe("state:current");
  });

  it("TEST I: preserves deterministic identity and hash when supplied stable inputs and versions are identical", () => {
    const first = buildCanonicalIntelligenceState(base);
    const second = buildCanonicalIntelligenceState({ ...base, engineValues: { ...base.engineValues }, inputQuality: [...base.inputQuality] });
    expect(second.stateId).toBe(first.stateId);
    expect(second.stateHash).toBe(first.stateHash);
    expect(second).toEqual(first);
  });
});
