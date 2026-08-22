import type { CanonicalQualityStatus } from "./canonicalIntelligenceState";
import type { EvidenceStrength } from "./evidenceContract";

export const CANDIDATE_DETECTION_CONTRACT_VERSION = "phase6-candidate-detection-v1" as const;
export const CANDIDATE_DETECTOR_ID = "cross-engine-divergence" as const;
export const CANDIDATE_DETECTOR_VERSION = "1.0.0" as const;
export const CANDIDATE_DETECTOR_CONFIG_VERSION = "phase6r-candidate-v1" as const;

export type CandidateDetectionType = "CROSS_ENGINE_DIVERGENCE";
export type CandidateDataConfidence = "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT";
export type CandidateDataFreshness = "FRESH" | "DEGRADED" | "STALE" | "UNAVAILABLE";

/**
 * Phase 6 is candidate detection only. This object deliberately excludes
 * qualification, priority, warning lifecycle, confirmation, invalidation,
 * publication, forecast, and outcome semantics reserved for later phases.
 */
export interface CandidateDetection {
  contractVersion: typeof CANDIDATE_DETECTION_CONTRACT_VERSION;
  candidateId: string;
  candidateType: CandidateDetectionType;
  title: string;
  originatingStateId: string;
  originatingSynthesisId: string;
  effectiveAt: string;
  firstObservedAt: string;
  latestObservedAt: string;
  participatingEngines: string[];
  participatingRelationships: string[];
  supportingDivergences: string[];
  evidenceClaimIds: string[];
  relevantArchiveEventIds: string[];
  magnitude: number | null;
  acceleration: number | null;
  persistence: "NEW" | "PERSISTING";
  dataConfidence: CandidateDataConfidence;
  dataFreshness: CandidateDataFreshness;
  dataQuality: CanonicalQualityStatus;
  evidenceStrength: EvidenceStrength;
  limitations: string[];
  detectorId: typeof CANDIDATE_DETECTOR_ID;
  detectorVersion: typeof CANDIDATE_DETECTOR_VERSION;
  detectorConfigVersion: typeof CANDIDATE_DETECTOR_CONFIG_VERSION;
  provenance: {
    canonicalStateSchemaVersion: string;
    synthesisContractVersion: string;
    deterministic: true;
  };
}

export interface CandidateDetectionEvaluation {
  originatingSynthesisId: string;
  originatingStateId: string;
  effectiveAt: string;
  candidates: CandidateDetection[];
  noCandidates: boolean;
  limitations: string[];
}
