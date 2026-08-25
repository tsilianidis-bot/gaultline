import type { CanonicalQualityStatus } from "./canonicalIntelligenceState";
import type { EvidenceStrength } from "./evidenceContract";

export const CROSS_ENGINE_SYNTHESIS_CONTRACT_VERSION = "phase5-cross-engine-synthesis-v1" as const;

export type SynthesisAvailability = "AVAILABLE" | "DEGRADED" | "STALE" | "UNAVAILABLE";
export type SynthesisDirection = "IMPROVING" | "DETERIORATING" | "STABLE" | "UNAVAILABLE";
export type EvidenceIndependence = "INDEPENDENT" | "PARTIALLY_OVERLAPPING" | "HIGHLY_OVERLAPPING" | "UNKNOWN";
export type SynthesisConclusion = "ALIGNED" | "MIXED" | "CONFLICTED" | "INSUFFICIENT_CROSS_ENGINE_EVIDENCE" | "NO_MATERIAL_CROSS_ENGINE_ALIGNMENT";

export interface CrossEngineObservation {
  engineId: string;
  engineName: string;
  availability: SynthesisAvailability;
  observedAt: string | null;
  freshness: string;
  dataQuality: CanonicalQualityStatus;
  evidenceStrength: EvidenceStrength;
  currentState: { value: number | null; unit: string; classification: string | null };
  previousState: null;
  direction: SynthesisDirection;
  magnitude: null;
  changeRate: null;
  evidenceClaimIds: string[];
  historicalClaimIds: string[];
  sourceInputIds: string[];
  limitations: string[];
}

export interface CrossEngineRelationship {
  relationshipId: string;
  relationshipType: "ENGINE_DIRECTION_ALIGNMENT" | "ENGINE_DIRECTION_DIVERGENCE";
  participatingEngines: string[];
  direction: "ALIGNED_IMPROVING" | "ALIGNED_DETERIORATING" | "DIVERGENT";
  magnitude: null;
  firstObservedAt: string;
  latestObservedAt: string;
  persistence: "NEW" | "PERSISTING";
  evidenceClaimIds: string[];
  dataQuality: CanonicalQualityStatus;
  evidenceStrength: EvidenceStrength;
  independence: EvidenceIndependence;
  limitations: string[];
}

export interface CrossEngineConfirmation {
  confirmationId: string;
  participatingEngines: string[];
  relationshipRule: "same_direction_independent_observations";
  supportingClaimIds: string[];
  independenceAssessment: EvidenceIndependence;
  confirmationStrength: "LIMITED" | "MODERATE";
  limitations: string[];
}

export interface CrossEngineDivergence {
  divergenceId: string;
  participatingEngines: string[];
  direction: "DIVERGENT";
  firstObservedAt: string;
  latestObservedAt: string;
  magnitude: null;
  persistence: "NEW" | "PERSISTING";
  acceleration: null;
  supportingClaimIds: string[];
  evidenceIndependence: EvidenceIndependence;
  dataQuality: CanonicalQualityStatus;
  limitations: string[];
}

export interface CrossEngineSynthesisSummary {
  overallSynthesis: SynthesisConclusion;
  dominantRelationship: string | null;
  confirmedAlignments: string[];
  importantDivergences: string[];
  whatChanged: string[];
  conflictingEvidence: string[];
  dataQuality: CanonicalQualityStatus;
  limitations: string[];
}

export interface CrossEngineSynthesis {
  contractVersion: typeof CROSS_ENGINE_SYNTHESIS_CONTRACT_VERSION;
  synthesisId: string;
  originatingStateId: string;
  originatingEffectiveAt: string;
  generatedAt: string;
  modelVersion: string;
  configurationVersion: string;
  inputSnapshotId: string;
  availableEngines: string[];
  unavailableEngines: string[];
  degradedEngines: string[];
  staleEngines: string[];
  engineObservations: CrossEngineObservation[];
  relationships: CrossEngineRelationship[];
  confirmations: CrossEngineConfirmation[];
  divergences: CrossEngineDivergence[];
  conflicts: string[];
  improvingDomains: string[];
  deterioratingDomains: string[];
  stableDomains: string[];
  dominantDrivers: string[];
  secondaryDrivers: string[];
  breadthOfEvidence: { participatingEngineCount: number; independentEngineCount: number; conclusion: "NARROW" | "BROAD" | "INSUFFICIENT" };
  independenceOfEvidence: EvidenceIndependence;
  persistence: "NEW" | "PERSISTING";
  acceleration: null;
  dataQuality: CanonicalQualityStatus;
  evidenceStrength: EvidenceStrength;
  limitations: string[];
  provenance: { canonicalStateSchemaVersion: string; evidencePacketContractVersion: string; deterministic: true };
  supportingClaimIds: string[];
  historicalClaimIds: string[];
  summary: CrossEngineSynthesisSummary;
}
