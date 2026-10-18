import { describe, expect, it } from "vitest";
import type { CrossEngineSynthesis } from "../shared/crossEngineSynthesis";
import {
  CANDIDATE_DETECTOR_CONFIG_VERSION,
  CANDIDATE_DETECTOR_ID,
  CANDIDATE_DETECTOR_VERSION,
} from "../shared/candidateDetection";
import { candidateStreamKey, evaluateCandidateDetections, qualificationFeasibilityFor } from "./candidateDetection";

// Mock fixture provenance only — no provider or production call is made in this suite.
const MOCK_PROVIDER = { provider: "fixture-canonical-engine", observedAt: "2026-08-22T00:00:00.000Z" } as const;

function synthesis(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: "phase5-cross-engine-synthesis-v1",
    synthesisId: "synthesis-a",
    originatingStateId: "state-a",
    originatingEffectiveAt: "2026-08-22T00:00:00.000Z",
    dataQuality: "VERIFIED",
    evidenceStrength: "STRONG",
    staleEngines: [],
    degradedEngines: [],
    limitations: [],
    fixtureProvenance: MOCK_PROVIDER,
    engineObservations: [
      { engineId: "credit", currentState: { value: 65, unit: "score_0_to_100", classification: null }, sourceInputIds: ["fixture-credit"], fixtureProvenance: MOCK_PROVIDER },
      { engineId: "equities", currentState: { value: 50, unit: "score_0_to_100", classification: null }, sourceInputIds: ["fixture-equities"], fixtureProvenance: MOCK_PROVIDER },
    ],
    relationships: [{ relationshipId: "relationship-a", participatingEngines: ["credit", "equities"] }],
    confirmations: [],
    divergences: [{
      divergenceId: "divergence-a",
      participatingEngines: ["credit", "equities"],
      evidenceIndependence: "INDEPENDENT",
      magnitude: null,
      acceleration: null,
      persistence: "PERSISTING",
      firstObservedAt: "2026-08-21T00:00:00.000Z",
      latestObservedAt: "2026-08-22T00:00:00.000Z",
      supportingClaimIds: ["claim-a"],
      limitations: [],
    }],
    provenance: { canonicalStateSchemaVersion: "phase2-canonical-state-v1" },
    ...overrides,
  } as unknown as CrossEngineSynthesis;
}

describe("Phase 6 candidate-only detection", () => {
  it("creates a deterministic machine-readable candidate from a governed Phase 5 divergence", () => {
    const candidate = evaluateCandidateDetections(synthesis()).candidates[0];
    expect(candidate).toMatchObject({
      candidateType: "CROSS_ENGINE_DIVERGENCE",
      originatingStateId: "state-a",
      originatingSynthesisId: "synthesis-a",
      detectorId: CANDIDATE_DETECTOR_ID,
      detectorVersion: CANDIDATE_DETECTOR_VERSION,
      detectorConfigVersion: CANDIDATE_DETECTOR_CONFIG_VERSION,
      magnitude: 15,
      persistence: "PERSISTING",
    });
    expect(candidate.candidateId).toMatch(/^cd:/);
  });

  it("returns a legitimate zero-candidate state without inventing a candidate", () => {
    const result = evaluateCandidateDetections(synthesis({ divergences: [] }));
    expect(result.candidates).toEqual([]);
    expect(result.noCandidates).toBe(true);
  });

  it("suppresses stale, non-independent, missing-magnitude, and non-persisting inputs", () => {
    const stale = synthesis({ staleEngines: ["credit"] });
    const overlapping = synthesis({ divergences: [{ ...(synthesis() as any).divergences[0], evidenceIndependence: "OVERLAPPING" }] });
    const missingMagnitude = synthesis({ engineObservations: [{ ...(synthesis() as any).engineObservations[0], currentState: { value: null, unit: "score_0_to_100", classification: null } }, (synthesis() as any).engineObservations[1]] });
    const newRelationship = synthesis({ divergences: [{ ...(synthesis() as any).divergences[0], persistence: "NEW" }] });
    [stale, overlapping, missingMagnitude, newRelationship].forEach(input => expect(evaluateCandidateDetections(input).candidates).toHaveLength(0));
  });

  it("MOCK fixture: retains one stable candidate stream across state-specific divergence IDs", () => {
    const first = evaluateCandidateDetections(synthesis()).candidates[0]!;
    const next = evaluateCandidateDetections(synthesis({
      synthesisId: "synthesis-b",
      originatingStateId: "state-b",
      originatingEffectiveAt: "2026-08-23T00:00:00.000Z",
      divergences: [{ ...(synthesis() as any).divergences[0], divergenceId: "divergence-b", latestObservedAt: "2026-08-23T00:00:00.000Z" }],
    })).candidates[0]!;

    expect(candidateStreamKey((synthesis() as any).divergences[0])).toBe("CROSS_ENGINE_DIVERGENCE:credit|equities");
    expect(next.candidateId).toBe(first.candidateId);
    expect(next.originatingStateId).toBe("state-b");
  });

  it("MOCK fixture: reports the 65-point live-shape ceiling as a governance blocker without changing frozen weights", () => {
    const candidate = evaluateCandidateDetections(synthesis({
      engineObservations: [
        { engineId: "credit-contagion", currentState: { value: 65, unit: "score_0_to_100", classification: null }, sourceInputIds: ["fixture-credit"], fixtureProvenance: MOCK_PROVIDER },
        { engineId: "liquidity-stress", currentState: { value: 50, unit: "score_0_to_100", classification: null }, sourceInputIds: ["fixture-liquidity"], fixtureProvenance: MOCK_PROVIDER },
      ],
      relationships: [{ relationshipId: "relationship-live", participatingEngines: ["credit-contagion", "liquidity-stress"] }],
      divergences: [{ ...(synthesis() as any).divergences[0], divergenceId: "divergence-live", participatingEngines: ["credit-contagion", "liquidity-stress"] }],
    })).candidates[0]!;
    expect(qualificationFeasibilityFor(candidate)).toMatchObject({ status: "GOVERNANCE_BLOCKED", scoreCeiling: 65, qualificationThreshold: 72 });
  });

  it("never adds forecast, importance, qualification, lifecycle, confirmation, invalidation, or publication semantics", () => {
    const candidate = evaluateCandidateDetections(synthesis()).candidates[0] as Record<string, unknown>;
    ["compositeWarningScore", "qualificationState", "lifecycleState", "confirmationConditions", "invalidationConditions", "warningId"].forEach(field => {
      expect(candidate).not.toHaveProperty(field);
    });
  });
});
