import { describe, expect, it } from "vitest";
import { buildCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { buildCanonicalEvidencePacket } from "./evidencePacket";
import { buildCrossEngineSynthesis, buildCrossEngineSynthesisPromptContract } from "./crossEngineSynthesis";

function state(overrides: Record<string, unknown> = {}) {
  return toPublicCanonicalIntelligenceState(buildCanonicalIntelligenceState({
    stateId: "phase5:state", generatedAt: "2026-08-22T18:00:00.000Z", championVersion: "champion-v1-frozen", modelVersion: "model", scoringVersion: "score", configurationVersion: "config", inputSnapshotId: "input", stateHash: "hash", pressureIndex: 30, regime: "MODERATE", engineValues: { credit: 60, liquidity: 55, breadth: 45 }, engineDirections: { credit: "deteriorating", liquidity: "deteriorating", breadth: "improving" }, domainValues: {}, scenarioOutputs: {}, probabilityClaimIds: [], analogClaimIds: ["analog:93%"], historicalDatasetVersion: "historical", researchDatasetVersion: "research", coherenceStatus: "COHERENT", coherenceNotes: [], dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] }, staleInputs: [], unavailableInputs: [], fallbackInputs: [], inputQuality: [
      { inputId: "hy", freshnessStatus: "LIVE", contributesTo: ["credit"] },
      { inputId: "funding", freshnessStatus: "LIVE", contributesTo: ["liquidity"] },
      { inputId: "breadth", freshnessStatus: "LIVE", contributesTo: ["breadth"] },
    ],
    ...overrides,
  }));
}

const synth = (overrides: Record<string, unknown> = {}) => {
  const current = state(overrides);
  return buildCrossEngineSynthesis(current, buildCanonicalEvidencePacket(current));
};

describe("Phase 5 adversarial governed synthesis", () => {
  it("A: two metrics from one source cannot become two-engine confirmation", () => {
    const result = synth({ engineValues: { creditA: 60, creditB: 55 }, engineDirections: { creditA: "deteriorating", creditB: "deteriorating" }, inputQuality: [{ inputId: "hy", freshnessStatus: "LIVE", contributesTo: ["creditA", "creditB"] }] });
    expect(result.confirmations).toHaveLength(0);
  });
  it("B: three downstream metrics sharing one source cannot masquerade as independent confirmation", () => {
    const result = synth({ engineValues: { a: 60, b: 55, c: 50 }, engineDirections: { a: "deteriorating", b: "deteriorating", c: "deteriorating" }, inputQuality: [{ inputId: "hy", freshnessStatus: "LIVE", contributesTo: ["a", "b", "c"] }] });
    expect(result.confirmations).toHaveLength(0);
    expect(result.independenceOfEvidence).toBe("HIGHLY_OVERLAPPING");
  });
  it("C: one deteriorating engine cannot become system-wide deterioration", () => {
    const result = synth({ engineValues: { credit: 60 }, engineDirections: { credit: "deteriorating" }, inputQuality: [{ inputId: "hy", freshnessStatus: "LIVE", contributesTo: ["credit"] }] });
    expect(result.summary.overallSynthesis).toBe("NO_MATERIAL_CROSS_ENGINE_ALIGNMENT");
    expect(JSON.stringify(result.summary)).not.toMatch(/system-wide/i);
  });
  it("D: State A observations cannot mix with State B", () => {
    const first = state({ stateId: "state:A" }); const second = state({ stateId: "state:B" });
    expect(() => buildCrossEngineSynthesis(second, buildCanonicalEvidencePacket(first))).toThrow();
  });
  it("E: analog similarity cannot become probability", () => {
    expect(JSON.stringify(synth())).not.toMatch(/probability|recurrence/i);
  });
  it("F: historical frequency cannot become probability", () => {
    expect(synth().historicalClaimIds).toEqual([]);
  });
  it("G: conflicting engines remain explicitly conflicted", () => {
    const result = synth(); expect(result.summary.overallSynthesis).toBe("CONFLICTED"); expect(result.conflicts.length).toBeGreaterThan(0);
  });
  it("H: unavailable engines are unavailable rather than neutral", () => {
    const result = synth({ engineValues: { credit: null }, engineDirections: { credit: "unknown" }, unavailableInputs: ["hy"], inputQuality: [{ inputId: "hy", freshnessStatus: "UNAVAILABLE", contributesTo: ["credit"] }] });
    expect(result.engineObservations[0]?.availability).toBe("UNAVAILABLE"); expect(result.engineObservations[0]?.direction).toBe("UNAVAILABLE");
  });
  it("I: stale engines are excluded from current confirmation", () => {
    const result = synth({ inputQuality: [{ inputId: "hy", freshnessStatus: "STALE", contributesTo: ["credit"] }, { inputId: "funding", freshnessStatus: "LIVE", contributesTo: ["liquidity"] }] });
    expect(result.staleEngines).toContain("credit"); expect(result.confirmations).toHaveLength(0);
  });
  it("J: one engine’s magnitude cannot mechanically override others", () => {
    const result = synth(); expect(result.engineObservations.every(item => item.magnitude === null)).toBe(true); expect(result.acceleration).toBeNull();
  });
  it("K: relationship contract does not establish causal language", () => {
    expect(JSON.stringify(synth())).not.toMatch(/caused|causes|because of/i);
  });
  it("L: missing current evidence produces insufficiency", () => {
    const result = synth({ engineValues: {}, engineDirections: {}, inputQuality: [] }); expect(result.summary.overallSynthesis).toBe("INSUFFICIENT_CROSS_ENGINE_EVIDENCE");
  });
  it("M: confirmation requires an explicit structured independent relationship", () => {
    const result = synth({ engineValues: { credit: 60, liquidity: 55 }, engineDirections: { credit: "deteriorating", liquidity: "deteriorating" }, inputQuality: [{ inputId: "hy", freshnessStatus: "LIVE", contributesTo: ["credit"] }, { inputId: "funding", freshnessStatus: "LIVE", contributesTo: ["liquidity"] }] });
    expect(result.confirmations[0]).toMatchObject({ relationshipRule: "same_direction_independent_observations", independenceAssessment: "INDEPENDENT" });
  });
  it("N: divergence retains participating-engine and claim provenance", () => {
    const result = synth(); expect(result.divergences[0]?.participatingEngines.length).toBe(2); expect(result.divergences[0]?.supportingClaimIds.length).toBeGreaterThan(0);
  });
  it("O: shared underlying data is not double-counted as independent evidence", () => {
    const result = synth({ engineValues: { x: 50, y: 40 }, engineDirections: { x: "improving", y: "deteriorating" }, inputQuality: [{ inputId: "shared", freshnessStatus: "LIVE", contributesTo: ["x", "y"] }] });
    expect(result.divergences[0]?.evidenceIndependence).toBe("HIGHLY_OVERLAPPING");
  });
  it("P: the synthesis prompt forbids narrative-only relationships", () => {
    expect(buildCrossEngineSynthesisPromptContract(synth())).toContain("Do not invent additional cross-engine confirmation, divergence, causality");
  });
  it("Q: governed synthesis identity is deterministic for the same canonical state", () => {
    expect(synth().synthesisId).toBe(synth().synthesisId);
  });
  it("R: a different state produces a different synthesis identity", () => {
    expect(synth({ stateId: "state:one" }).synthesisId).not.toBe(synth({ stateId: "state:two" }).synthesisId);
  });
});
