import { describe, expect, it } from "vitest";
import { buildCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { buildCanonicalEvidencePacket } from "./evidencePacket";
import { buildCrossEngineSynthesis, deriveDivergenceMetric } from "./crossEngineSynthesis";

// Mock fixture provenance only — no provider or production call is made in this suite.
const MOCK_PROVIDER = { provider: "fixture-canonical-state", observedAt: "2026-08-22T00:00:00.000Z" } as const;

function stateFixture(overrides: Record<string, unknown> = {}) {
  return toPublicCanonicalIntelligenceState(buildCanonicalIntelligenceState({
    stateId: "state:phase5", generatedAt: "2026-08-22T18:00:00.000Z", championVersion: "champion-v1-frozen", modelVersion: "model-v1", scoringVersion: "score-v1", configurationVersion: "config-v1", inputSnapshotId: "inputs:phase5", stateHash: "hash:phase5", pressureIndex: 31, regime: "MODERATE", engineValues: { credit: 63, liquidity: 58, breadth: 42 }, engineDirections: { credit: "deteriorating", liquidity: "deteriorating", breadth: "improving" }, domainValues: {}, scenarioOutputs: {}, probabilityClaimIds: [], analogClaimIds: ["analog:phase5"], historicalDatasetVersion: "historical", researchDatasetVersion: "research", coherenceStatus: "COHERENT", coherenceNotes: [], dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] }, staleInputs: [], unavailableInputs: [], fallbackInputs: [], inputQuality: [
      { inputId: "hy", freshnessStatus: "LIVE", contributesTo: ["credit"], ...MOCK_PROVIDER },
      { inputId: "funding", freshnessStatus: "LIVE", contributesTo: ["liquidity"], ...MOCK_PROVIDER },
      { inputId: "advance-decline", freshnessStatus: "LIVE", contributesTo: ["breadth"], ...MOCK_PROVIDER },
    ],
    ...overrides,
  }));
}

describe("Phase 5 governed cross-engine synthesis", () => {
  it("locks synthesis identity to one canonical state and derives deterministic engine observations", () => {
    const state = stateFixture();
    const packet = buildCanonicalEvidencePacket(state);
    const first = buildCrossEngineSynthesis(state, packet);
    const second = buildCrossEngineSynthesis(state, packet);
    expect(first.synthesisId).toBe(second.synthesisId);
    expect(first.originatingStateId).toBe("state:phase5");
    expect(first.engineObservations).toHaveLength(3);
    expect(first.summary.overallSynthesis).toBe("CONFLICTED");
    expect(first.divergences).toHaveLength(2);
  });

  it("rejects State A packet and State B synthesis mixing", () => {
    const stateA = stateFixture({ stateId: "state:A", inputSnapshotId: "inputs:A" });
    const stateB = stateFixture({ stateId: "state:B", inputSnapshotId: "inputs:B" });
    expect(() => buildCrossEngineSynthesis(stateB, buildCanonicalEvidencePacket(stateA))).toThrow("does not match canonical state");
  });

  it("does not double-count highly overlapping source data as independent confirmation", () => {
    const state = stateFixture({
      engineValues: { credit: 63, liquidity: 58 },
      engineDirections: { credit: "deteriorating", liquidity: "deteriorating" },
      inputQuality: [
        { inputId: "hy", freshnessStatus: "LIVE", contributesTo: ["credit", "liquidity"] },
      ],
    });
    const synthesis = buildCrossEngineSynthesis(state, buildCanonicalEvidencePacket(state));
    expect(synthesis.relationships[0]?.independence).toBe("HIGHLY_OVERLAPPING");
    expect(synthesis.confirmations).toHaveLength(0);
    expect(synthesis.summary.overallSynthesis).toBe("NO_MATERIAL_CROSS_ENGINE_ALIGNMENT");
  });

  it("keeps unavailable engines unavailable rather than neutral and preserves insufficiency", () => {
    const state = stateFixture({
      engineValues: { credit: null, liquidity: null },
      engineDirections: { credit: "unknown", liquidity: "unknown" },
      unavailableInputs: ["hy", "funding"],
      dataQualitySummary: { staleInputs: [], unavailableInputs: ["hy", "funding"], fallbackInputs: [], staticInputs: [] },
      inputQuality: [
        { inputId: "hy", freshnessStatus: "UNAVAILABLE", contributesTo: ["credit"] },
        { inputId: "funding", freshnessStatus: "UNAVAILABLE", contributesTo: ["liquidity"] },
      ],
    });
    const synthesis = buildCrossEngineSynthesis(state, buildCanonicalEvidencePacket(state));
    expect(synthesis.unavailableEngines).toEqual(["credit", "liquidity"]);
    expect(synthesis.summary.overallSynthesis).toBe("INSUFFICIENT_CROSS_ENGINE_EVIDENCE");
    expect(synthesis.engineObservations.every(item => item.direction === "UNAVAILABLE")).toBe(true);
  });

  it("keeps delayed evidence distinct from stale evidence and excludes it from current confirmation", () => {
    const state = stateFixture({
      engineValues: { credit: 63, liquidity: 58 },
      engineDirections: { credit: "deteriorating", liquidity: "deteriorating" },
      inputQuality: [
        { inputId: "hy", freshnessStatus: "DELAYED", contributesTo: ["credit"] },
        { inputId: "funding", freshnessStatus: "LIVE", contributesTo: ["liquidity"] },
      ],
    });
    const synthesis = buildCrossEngineSynthesis(state, buildCanonicalEvidencePacket(state));
    expect(synthesis.delayedEngines).toEqual(["credit"]);
    expect(synthesis.staleEngines).toEqual([]);
    expect(synthesis.relationships).toEqual([]);
    expect(synthesis.confirmations).toEqual([]);
  });

  it("does not convert historical or analog references into a current probability", () => {
    const state = stateFixture();
    const synthesis = buildCrossEngineSynthesis(state, buildCanonicalEvidencePacket(state));
    expect(synthesis.historicalClaimIds).toEqual([]);
    expect(JSON.stringify(synthesis)).not.toMatch(/probability|forecast score|warning score/i);
  });

  it("MOCK fixture: derives a finite gap as DERIVED and retains relationship persistence across canonical states", () => {
    const firstState = stateFixture({ stateId: "state:gap-1", inputSnapshotId: "inputs:gap-1" });
    const first = buildCrossEngineSynthesis(firstState, buildCanonicalEvidencePacket(firstState));
    const secondState = stateFixture({ stateId: "state:gap-2", inputSnapshotId: "inputs:gap-2" });
    const second = buildCrossEngineSynthesis(secondState, buildCanonicalEvidencePacket(secondState), first);
    const firstGap = first.divergences.find(item => item.participatingEngines.join("|") === "breadth|credit")!;
    const secondGap = second.divergences.find(item => item.participatingEngines.join("|") === "breadth|credit")!;
    const credit = second.engineObservations.find(item => item.engineId === "credit")!;
    const breadth = second.engineObservations.find(item => item.engineId === "breadth")!;
    const metric = deriveDivergenceMetric(credit, breadth);

    expect(metric).toMatchObject({ value: 21, evidenceClass: "DERIVED", methodologyId: "canonical-engine-score-gap-v1" });
    expect(firstGap.persistence).toBe("NEW");
    expect(secondGap.persistence).toBe("PERSISTING");
    expect(secondGap.limitations.join(" ")).toContain("not an observed provider measurement");
  });

  it("MOCK fixture: refuses a gap when either canonical score is null or non-finite", () => {
    const state = stateFixture();
    const base = buildCrossEngineSynthesis(state, buildCanonicalEvidencePacket(state)).engineObservations[0]!;
    expect(deriveDivergenceMetric({ ...base, currentState: { ...base.currentState, value: null } }, base)).toBeNull();
    expect(deriveDivergenceMetric({ ...base, currentState: { ...base.currentState, value: Number.NaN } }, base)).toBeNull();
  });
});
