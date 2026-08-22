import { describe, expect, it } from "vitest";
import { evaluateEarlyWarnings } from "./earlyWarningIntelligence";
import type { CrossEngineSynthesis } from "../shared/crossEngineSynthesis";

function synthesis(overrides: Partial<CrossEngineSynthesis> = {}): CrossEngineSynthesis {
  const divergence = { divergenceId: "divergence", participatingEngines: ["credit", "equities"], direction: "DIVERGENT" as const, firstObservedAt: "2026-08-20T00:00:00.000Z", latestObservedAt: "2026-08-22T00:00:00.000Z", magnitude: 15, persistence: "PERSISTING" as const, acceleration: null, supportingClaimIds: ["state:engine:credit", "state:engine:equities"], evidenceIndependence: "INDEPENDENT" as const, dataQuality: "HEALTHY" as const, limitations: [] };
  const relationship = { relationshipId: "relationship", relationshipType: "ENGINE_DIRECTION_DIVERGENCE" as const, participatingEngines: divergence.participatingEngines, direction: "DIVERGENT" as const, magnitude: null, firstObservedAt: divergence.firstObservedAt, latestObservedAt: divergence.latestObservedAt, persistence: "PERSISTING" as const, evidenceClaimIds: divergence.supportingClaimIds, dataQuality: "HEALTHY" as const, evidenceStrength: "MODERATE" as const, independence: "INDEPENDENT" as const, limitations: [] };
  return { contractVersion: "phase5-cross-engine-synthesis-v1", synthesisId: "synthesis", originatingStateId: "state", originatingEffectiveAt: "2026-08-22T00:00:00.000Z", generatedAt: "2026-08-22T00:01:00.000Z", modelVersion: "model", configurationVersion: "config", inputSnapshotId: "snapshot", availableEngines: ["credit", "equities"], unavailableEngines: [], degradedEngines: [], staleEngines: [], engineObservations: [], relationships: [relationship], confirmations: [], divergences: [divergence], conflicts: ["conflict"], improvingDomains: ["equities"], deterioratingDomains: ["credit"], stableDomains: [], dominantDrivers: ["credit"], secondaryDrivers: [], breadthOfEvidence: { participatingEngineCount: 2, independentEngineCount: 0, conclusion: "NARROW" }, independenceOfEvidence: "INDEPENDENT", persistence: "PERSISTING", acceleration: null, dataQuality: "HEALTHY", evidenceStrength: "MODERATE", limitations: [], provenance: { canonicalStateSchemaVersion: "phase2-canonical-state-v1", evidencePacketContractVersion: "phase3-evidence-packet-v1", deterministic: true }, supportingClaimIds: divergence.supportingClaimIds, historicalClaimIds: [], summary: { overallSynthesis: "CONFLICTED", dominantRelationship: "divergence", confirmedAlignments: [], importantDivergences: [], whatChanged: [], conflictingEvidence: [], dataQuality: "HEALTHY", limitations: [] }, ...overrides };
}

describe("Phase 6 Early Warning adversarial integrity", () => {
  it("does not turn a single-engine, overlapping, new, stale, or unavailable condition into a material warning", () => {
    const base = synthesis();
    const single = synthesis({ divergences: [{ ...base.divergences[0], participatingEngines: ["credit"], evidenceIndependence: "INDEPENDENT" }], relationships: [{ ...base.relationships[0], participatingEngines: ["credit"] }] });
    const overlapping = synthesis({ divergences: [{ ...base.divergences[0], evidenceIndependence: "HIGHLY_OVERLAPPING" }], relationships: [{ ...base.relationships[0], independence: "HIGHLY_OVERLAPPING" }] });
    const freshOnly = synthesis({ divergences: [{ ...base.divergences[0], persistence: "NEW" }], relationships: [{ ...base.relationships[0], persistence: "NEW" }] });
    const stale = synthesis({ staleEngines: ["credit"] });
    const unavailable = synthesis({ dataQuality: "UNAVAILABLE" });
    [single, overlapping, freshOnly, stale, unavailable].forEach(input => expect(evaluateEarlyWarnings(input).qualifiedWarnings).toHaveLength(0));
  });

  it("does not create a probability, target, historical outcome, causal claim, or warning from an absent governed divergence", () => {
    const none = evaluateEarlyWarnings(synthesis({ divergences: [], relationships: [], conflicts: [], availableEngines: [], dataQuality: "UNAVAILABLE" }));
    expect(none).toMatchObject({ noMaterialEarlyWarning: true, qualifiedWarnings: [] });
    expect(JSON.stringify(none)).not.toMatch(/probability|target|guaranteed|caused/i);
  });

  it("keeps candidate state and synthesis provenance together across regeneration", () => {
    const first = evaluateEarlyWarnings(synthesis()).candidates[0];
    const later = evaluateEarlyWarnings(synthesis({ synthesisId: "synthesis-next", originatingStateId: "state-next" }), [{ warningId: first.warningId, compositeWarningScore: first.compositeWarningScore, lifecycleState: "EMERGING" }]).candidates[0];
    expect(later.warningId).toBe(first.warningId);
    expect(later.originatingStateId).toBe("state-next");
    expect(later.originatingSynthesisId).toBe("synthesis-next");
    expect(later.provenance.deterministic).toBe(true);
  });
});
