import { describe, expect, it } from "vitest";
import { buildCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { buildCanonicalEvidencePacket } from "./evidencePacket";
import { buildCrossEngineSynthesis } from "./crossEngineSynthesis";

function stateFixture(overrides: Record<string, unknown> = {}) {
  return toPublicCanonicalIntelligenceState(buildCanonicalIntelligenceState({
    stateId: "state:phase5", generatedAt: "2026-08-22T18:00:00.000Z", championVersion: "champion-v1-frozen", modelVersion: "model-v1", scoringVersion: "score-v1", configurationVersion: "config-v1", inputSnapshotId: "inputs:phase5", stateHash: "hash:phase5", pressureIndex: 31, regime: "MODERATE", engineValues: { credit: 63, liquidity: 58, breadth: 42 }, engineDirections: { credit: "deteriorating", liquidity: "deteriorating", breadth: "improving" }, domainValues: {}, scenarioOutputs: {}, probabilityClaimIds: [], analogClaimIds: ["analog:phase5"], historicalDatasetVersion: "historical", researchDatasetVersion: "research", coherenceStatus: "COHERENT", coherenceNotes: [], dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] }, staleInputs: [], unavailableInputs: [], fallbackInputs: [], inputQuality: [
      { inputId: "hy", freshnessStatus: "LIVE", contributesTo: ["credit"] },
      { inputId: "funding", freshnessStatus: "LIVE", contributesTo: ["liquidity"] },
      { inputId: "advance-decline", freshnessStatus: "LIVE", contributesTo: ["breadth"] },
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

  it("does not convert historical or analog references into a current probability", () => {
    const state = stateFixture();
    const synthesis = buildCrossEngineSynthesis(state, buildCanonicalEvidencePacket(state));
    expect(synthesis.historicalClaimIds).toEqual([]);
    expect(JSON.stringify(synthesis)).not.toMatch(/probability|forecast score|warning score/i);
  });
});
