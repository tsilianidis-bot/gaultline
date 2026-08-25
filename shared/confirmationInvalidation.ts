import type { CandidateDetection, CandidateDetectionType } from "./candidateDetection";
import type { EvidenceStrength } from "./evidenceContract";
import type { LifecycleState } from "./earlyWarningLifecycle";
import type { ImportanceQualificationRecord } from "./importanceQualification";

export const PHASE9_CONTRACT_VERSION = "phase9-confirmation-invalidation-v1" as const;
export const PHASE9_MODEL_ID = "faultline-structural-thesis-condition-engine" as const;
export const PHASE9_MODEL_VERSION = "1.0.0" as const;
export const PHASE9_CONFIG_VERSION = "phase9-governance-v1" as const;
export const PHASE9_RULESET_VERSION = "cross-engine-divergence-rules-v1" as const;

export type WarningThesisType = "CROSS_ENGINE_DIVERGENCE_THESIS";
export type ConditionPrimitive = "THRESHOLD_ABOVE" | "THRESHOLD_BELOW" | "PERSISTENCE_MET" | "COMPOSITE_AND";
export type ConditionStatus = "PENDING" | "MET" | "NOT_MET" | "UNEVALUABLE" | "INSUFFICIENT_EVIDENCE" | "CONFLICTED" | "EVALUATION_ERROR";
export type PlanEvaluationState = "CONFIRMATION_PENDING" | "CONFIRMATION_MET" | "INVALIDATION_PENDING" | "INVALIDATION_MET" | "NO_GOVERNED_CONFIRMATION_PLAN" | "UNEVALUABLE" | "CONFLICTED_CONDITIONS" | "EVALUATION_ERROR";
export type Phase9AuthorityEventType = "CONFIRMATION_AUTHORIZED" | "INVALIDATION_AUTHORIZED";

export interface WarningThesis {
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  thesisId: string;
  lifecycleId: string;
  candidateId: string;
  candidateType: CandidateDetectionType;
  originatingStateId: string;
  originatingSynthesisId: string;
  relationshipIds: string[];
  participatingSignals: string[];
  direction: "DIVERGENT";
  thesisType: WarningThesisType;
  thesisStatementCode: "CROSS_ENGINE_DIVERGENCE_PERSISTED_ABNORMAL_RELATIONSHIP";
  supportingEvidenceClaimIds: string[];
  createdAt: string;
  thesisModelId: typeof PHASE9_MODEL_ID;
  thesisModelVersion: typeof PHASE9_MODEL_VERSION;
  thesisConfigVersion: typeof PHASE9_CONFIG_VERSION;
  limitations: string[];
}

export interface ConditionRule {
  conditionId: string;
  conditionType: ConditionPrimitive;
  sourceMetric: "DIVERGENCE_MAGNITUDE" | "DIVERGENCE_PERSISTENCE";
  sourceRelationshipIds: string[];
  sourceClaimIds: string[];
  operator: "GTE" | "LTE" | "EQ" | "ALL";
  threshold: number | "PERSISTING" | null;
  requiredObservations: number;
  requiredDataQuality: "HEALTHY";
  requiredEvidenceStrength: "MODERATE";
  requiredIndependence: "INDEPENDENT";
  conditionVersion: typeof PHASE9_RULESET_VERSION;
}

export interface ConfirmationInvalidationPlan {
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  planId: string;
  thesisId: string;
  lifecycleId: string;
  candidateId: string;
  candidateType: CandidateDetectionType;
  confirmationRuleSetId: "CROSS_ENGINE_DIVERGENCE_CONFIRM_V1";
  invalidationRuleSetId: "CROSS_ENGINE_DIVERGENCE_INVALIDATE_V1";
  confirmationConditions: ConditionRule[];
  invalidationConditions: ConditionRule[];
  minimumLifecycleState: "DEVELOPING";
  requiredDataQuality: "HEALTHY";
  requiredEvidenceStrength: "MODERATE";
  createdAt: string;
  effectiveAt: string;
  ruleModelVersion: typeof PHASE9_MODEL_VERSION;
  ruleConfigVersion: typeof PHASE9_CONFIG_VERSION;
  ruleSetVersion: typeof PHASE9_RULESET_VERSION;
  limitations: string[];
}

export interface ConditionEvaluation {
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  evaluationId: string;
  planId: string;
  thesisId: string;
  lifecycleId: string;
  candidateId: string;
  conditionId: string;
  conditionType: ConditionPrimitive;
  originatingStateId: string;
  originatingSynthesisId: string;
  effectiveAt: string;
  observedValue: number | string | null;
  requiredRule: ConditionRule;
  status: ConditionStatus;
  dataQuality: string;
  evidenceStrength: EvidenceStrength;
  evidenceClaimIds: string[];
  evidenceIndependence: string;
  ruleSetVersion: typeof PHASE9_RULESET_VERSION;
  ruleConfigVersion: typeof PHASE9_CONFIG_VERSION;
  limitations: string[];
}

export interface PlanEvaluation {
  planEvaluationId: string;
  planId: string;
  thesisId: string;
  lifecycleId: string;
  candidateId: string;
  originatingStateId: string;
  originatingSynthesisId: string;
  effectiveAt: string;
  lifecycleState: LifecycleState;
  confirmationStatus: ConditionStatus;
  invalidationStatus: ConditionStatus;
  result: PlanEvaluationState;
  conditionEvaluationIds: string[];
  evidenceClaimIds: string[];
  limitations: string[];
}

export interface Phase9AuthorityEvent {
  contractVersion: typeof PHASE9_CONTRACT_VERSION;
  phase9EventId: string;
  planId: string;
  lifecycleId: string;
  thesisId: string;
  candidateId: string;
  eventType: Phase9AuthorityEventType;
  originatingStateId: string;
  effectiveAt: string;
  conditionEvaluationIds: string[];
  evidenceClaimIds: string[];
  ruleSetVersion: typeof PHASE9_RULESET_VERSION;
  ruleConfigVersion: typeof PHASE9_CONFIG_VERSION;
  createdAt: string;
  limitations: string[];
}

export interface CurrentDivergenceEvidence {
  divergenceId: string;
  magnitude: number | null;
  persistence: "NEW" | "PERSISTING";
  dataQuality: string;
  evidenceStrength: EvidenceStrength;
  evidenceIndependence: string;
  evidenceClaimIds: string[];
}

export interface Phase9EvaluationInput {
  candidate: CandidateDetection;
  qualification: ImportanceQualificationRecord;
  lifecycleState: LifecycleState;
  lifecycleId: string;
  currentDivergence: CurrentDivergenceEvidence | null;
}

export const PHASE9_GOVERNANCE = {
  confirmationMagnitudeThreshold: 15,
  invalidationNormalizationThreshold: 5,
  minimumLifecycleState: "DEVELOPING" as const,
  requiredDataQuality: "HEALTHY" as const,
  requiredEvidenceStrength: "MODERATE" as const,
  requiredIndependence: "INDEPENDENT" as const,
  thresholdLabel: "NEW_ENGINEERING_GOVERNANCE_THRESHOLD_NOT_STATISTICALLY_CALIBRATED",
  conflictPrecedence: "CONFLICTED_CONDITIONS_NO_AUTHORITY_EVENT" as const,
  semantics: "THESIS_SUPPORT_OR_CONTRADICTION_NOT_PROBABILITY_FORECAST_TARGET_OR_OUTCOME" as const,
};
