import type { CanonicalQualityStatus } from "./canonicalIntelligenceState";
import type { EvidenceStrength } from "./evidenceContract";

export const EARLY_WARNING_CONTRACT_VERSION = "phase6-early-warning-intelligence-v1" as const;

export type EarlyWarningCandidateType = "CROSS_ENGINE_DIVERGENCE";
export type EarlyWarningQualificationState = "QUALIFIED" | "NOT_QUALIFIED" | "INSUFFICIENT_EVIDENCE";
export type EarlyWarningLifecycleState = "EMERGING" | "DEVELOPING" | "CONFIRMING" | "ELEVATED" | "FADING" | "INVALIDATED";
export type EarlyWarningDataConfidence = "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT";

export interface EarlyWarningScoreComponents {
  /** Deterministic prioritization components. None is an outcome probability. */
  magnitude: number;
  acceleration: number;
  persistence: number;
  historicalLeadStrength: number;
  crossEngineConfirmation: number;
  systemicImportance: number;
  novelty: number;
  dataConfidence: number;
}

export interface EarlyWarningCandidate {
  contractVersion: typeof EARLY_WARNING_CONTRACT_VERSION;
  candidateId: string;
  warningId: string;
  candidateType: EarlyWarningCandidateType;
  title: string;
  originatingSynthesisId: string;
  originatingStateId: string;
  effectiveAt: string;
  firstObservedAt: string;
  latestObservedAt: string;
  participatingEngines: string[];
  participatingRelationships: string[];
  supportingDivergences: string[];
  supportingConfirmations: string[];
  magnitude: number | null;
  acceleration: number | null;
  persistence: "NEW" | "PERSISTING";
  /** Unavailable until a separately governed historical lead study exists. */
  historicalLeadStrength: null;
  /** Cross-engine support, not an outcome probability. */
  crossEngineConfirmation: "NONE" | "LIMITED" | "GOVERNED";
  systemicImportance: "LIMITED" | "MATERIAL";
  novelty: "NEW" | "PERSISTING";
  dataConfidence: EarlyWarningDataConfidence;
  dataFreshness: "FRESH" | "DEGRADED" | "STALE" | "UNAVAILABLE";
  marketContext: {
    pressureIndex: number | null;
    regime: string | null;
    pressureLevel: string | null;
  } | null;
  scoreComponents: EarlyWarningScoreComponents;
  compositeWarningScore: number;
  qualificationState: EarlyWarningQualificationState;
  lifecycleState: EarlyWarningLifecycleState | null;
  evidenceClaimIds: string[];
  relevantArchiveEventIds: string[];
  dataQuality: CanonicalQualityStatus;
  evidenceStrength: EvidenceStrength;
  limitations: string[];
  confirmationConditions: string[];
  invalidationConditions: string[];
  provenance: {
    canonicalStateSchemaVersion: string;
    synthesisContractVersion: string;
    deterministic: true;
    scoreMeaning: "PRIORITIZATION_ONLY_NOT_OUTCOME_PROBABILITY";
  };
}

export interface EarlyWarningEvaluation {
  originatingSynthesisId: string;
  originatingStateId: string;
  effectiveAt: string;
  candidates: EarlyWarningCandidate[];
  qualifiedWarnings: EarlyWarningCandidate[];
  noMaterialEarlyWarning: boolean;
  limitations: string[];
}
