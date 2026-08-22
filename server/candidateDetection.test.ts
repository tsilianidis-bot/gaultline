import { describe, expect, it } from "vitest";
import type { CrossEngineSynthesis } from "../shared/crossEngineSynthesis";
import {
  CANDIDATE_DETECTOR_CONFIG_VERSION,
  CANDIDATE_DETECTOR_ID,
  CANDIDATE_DETECTOR_VERSION,
} from "../shared/candidateDetection";
import { evaluateCandidateDetections } from "./candidateDetection";

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
    relationships: [{ relationshipId: "relationship-a", participatingEngines: ["credit", "equities"] }],
    confirmations: [],
    divergences: [{
      divergenceId: "divergence-a",
      participatingEngines: ["credit", "equities"],
      evidenceIndependence: "INDEPENDENT",
      magnitude: 15,
      acceleration: 3,
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
    const missingMagnitude = synthesis({ divergences: [{ ...(synthesis() as any).divergences[0], magnitude: null }] });
    const newRelationship = synthesis({ divergences: [{ ...(synthesis() as any).divergences[0], persistence: "NEW" }] });
    [stale, overlapping, missingMagnitude, newRelationship].forEach(input => expect(evaluateCandidateDetections(input).candidates).toHaveLength(0));
  });

  it("never adds forecast, importance, qualification, lifecycle, confirmation, invalidation, or publication semantics", () => {
    const candidate = evaluateCandidateDetections(synthesis()).candidates[0] as Record<string, unknown>;
    ["compositeWarningScore", "qualificationState", "lifecycleState", "confirmationConditions", "invalidationConditions", "warningId"].forEach(field => {
      expect(candidate).not.toHaveProperty(field);
    });
  });
});
