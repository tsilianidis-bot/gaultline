import { describe, expect, it } from "vitest";
import type { CrossEngineSynthesis } from "../shared/crossEngineSynthesis";
import { evaluateEarlyWarnings, MAX_MATERIAL_EARLY_WARNINGS } from "./earlyWarningIntelligence";

function synthesis(overrides: Partial<CrossEngineSynthesis> = {}): CrossEngineSynthesis {
  return {
    contractVersion: "phase5-cross-engine-synthesis-v1",
    synthesisId: "synthesis-a",
    originatingStateId: "state-a",
    originatingEffectiveAt: "2026-08-22T12:00:00.000Z",
    generatedAt: "2026-08-22T12:01:00.000Z",
    modelVersion: "model-v1",
    configurationVersion: "config-v1",
    inputSnapshotId: "snapshot-a",
    availableEngines: ["credit", "equities"],
    unavailableEngines: [],
    degradedEngines: [],
    staleEngines: [],
    engineObservations: [],
    relationships: [{ relationshipId: "relationship-a", relationshipType: "ENGINE_DIRECTION_DIVERGENCE", participatingEngines: ["credit", "equities"], direction: "DIVERGENT", magnitude: null, firstObservedAt: "2026-08-20T12:00:00.000Z", latestObservedAt: "2026-08-22T12:00:00.000Z", persistence: "PERSISTING", evidenceClaimIds: ["state-a:engine:credit", "state-a:engine:equities"], dataQuality: "HEALTHY", evidenceStrength: "MODERATE", independence: "INDEPENDENT", limitations: [] }],
    confirmations: [],
    divergences: [{ divergenceId: "divergence-a", participatingEngines: ["credit", "equities"], direction: "DIVERGENT", firstObservedAt: "2026-08-20T12:00:00.000Z", latestObservedAt: "2026-08-22T12:00:00.000Z", magnitude: 15, persistence: "PERSISTING", acceleration: null, supportingClaimIds: ["state-a:engine:credit", "state-a:engine:equities"], evidenceIndependence: "INDEPENDENT", dataQuality: "HEALTHY", limitations: [] }],
    conflicts: ["Direction conflict: credit vs equities."],
    improvingDomains: ["equities"],
    deterioratingDomains: ["credit"],
    stableDomains: [],
    dominantDrivers: ["credit", "equities"],
    secondaryDrivers: [],
    breadthOfEvidence: { participatingEngineCount: 2, independentEngineCount: 0, conclusion: "NARROW" },
    independenceOfEvidence: "INDEPENDENT",
    persistence: "PERSISTING",
    acceleration: null,
    dataQuality: "HEALTHY",
    evidenceStrength: "MODERATE",
    limitations: [],
    provenance: { canonicalStateSchemaVersion: "phase2-canonical-state-v1", evidencePacketContractVersion: "phase3-evidence-packet-v1", deterministic: true },
    supportingClaimIds: ["state-a:engine:credit", "state-a:engine:equities"],
    historicalClaimIds: [],
    summary: { overallSynthesis: "CONFLICTED", dominantRelationship: "divergence-a", confirmedAlignments: [], importantDivergences: ["credit vs equities are directionally divergent."], whatChanged: ["Initial"], conflictingEvidence: ["Direction conflict"], dataQuality: "HEALTHY", limitations: [] },
    ...overrides,
  };
}

describe("Phase 6 Early Warning Intelligence", () => {
  it("derives a qualified warning only from a persistent, independent Phase 5 divergence", () => {
    const evaluation = evaluateEarlyWarnings(synthesis());
    expect(evaluation.originatingSynthesisId).toBe("synthesis-a");
    expect(evaluation.originatingStateId).toBe("state-a");
    expect(evaluation.qualifiedWarnings).toHaveLength(1);
    expect(evaluation.qualifiedWarnings[0]).toMatchObject({
      candidateType: "CROSS_ENGINE_DIVERGENCE",
      qualificationState: "QUALIFIED",
      lifecycleState: "EMERGING",
      compositeWarningScore: 90,
      crossEngineConfirmation: "LIMITED",
    });
  });

  it("labels the score as prioritization and never an outcome probability", () => {
    const candidate = evaluateEarlyWarnings(synthesis()).candidates[0];
    expect(candidate.provenance.scoreMeaning).toBe("PRIORITIZATION_ONLY_NOT_OUTCOME_PROBABILITY");
    expect(candidate.historicalLeadStrength).toBeNull();
    expect(candidate.limitations.join(" ")).toMatch(/not an outcome probability/i);
  });

  it("withholds a new or stale divergence instead of forcing a material warning", () => {
    const newDivergence = synthesis({ divergences: [{ ...synthesis().divergences[0], persistence: "NEW" }], relationships: [{ ...synthesis().relationships[0], persistence: "NEW" }] });
    const staleDivergence = synthesis({ staleEngines: ["credit"] });
    expect(evaluateEarlyWarnings(newDivergence).noMaterialEarlyWarning).toBe(true);
    expect(evaluateEarlyWarnings(staleDivergence).candidates[0]).toMatchObject({ qualificationState: "NOT_QUALIFIED", dataConfidence: "LOW" });
  });

  it("cannot mix state identity and preserves a warning identity across later evaluation", () => {
    const initial = evaluateEarlyWarnings(synthesis()).qualifiedWarnings[0];
    const later = evaluateEarlyWarnings(synthesis({ synthesisId: "synthesis-b", originatingStateId: "state-b" }), [{ warningId: initial.warningId, compositeWarningScore: initial.compositeWarningScore, lifecycleState: initial.lifecycleState }]).candidates[0];
    expect(later.warningId).toBe(initial.warningId);
    expect(later.originatingStateId).toBe("state-b");
    expect(later.originatingSynthesisId).toBe("synthesis-b");
  });

  it("caps user-facing qualified warnings at the governed maximum", () => {
    const base = synthesis();
    const divergences = Array.from({ length: 5 }, (_, index) => ({ ...base.divergences[0], divergenceId: `divergence-${index}`, participatingEngines: [`credit-${index}`, `equities-${index}`] }));
    const relationships = Array.from({ length: 5 }, (_, index) => ({ ...base.relationships[0], relationshipId: `relationship-${index}`, participatingEngines: [`credit-${index}`, `equities-${index}`] }));
    expect(evaluateEarlyWarnings(synthesis({ divergences, relationships })).qualifiedWarnings).toHaveLength(MAX_MATERIAL_EARLY_WARNINGS);
  });
});
