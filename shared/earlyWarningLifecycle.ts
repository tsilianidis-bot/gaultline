import type { ImportanceQualificationRecord, QualificationStatus } from "./importanceQualification";

export const LIFECYCLE_CONTRACT_VERSION = "phase8-lifecycle-v1" as const;
export const LIFECYCLE_MODEL_ID = "faultline-qualified-candidate-lifecycle" as const;
export const LIFECYCLE_MODEL_VERSION = "1.0.0" as const;
export const LIFECYCLE_CONFIG_VERSION = "phase8-governance-v1" as const;

export type LifecycleState =
  | "EMERGING"
  | "DEVELOPING"
  | "ELEVATED"
  | "FADING"
  | "CONFIRMING"
  | "INVALIDATED"
  | "RESOLVED";

export type ActivePhase8LifecycleState = "EMERGING" | "DEVELOPING" | "FADING";
export type DormantLaterAuthorityLifecycleState = "ELEVATED" | "CONFIRMING" | "INVALIDATED" | "RESOLVED";

export type LifecycleTransitionReasonCode =
  | "FIRST_QUALIFICATION"
  | "CONTINUED_QUALIFICATION"
  | "PERSISTENCE_REQUIREMENT_MET"
  | "TEMPORARY_NON_QUALIFICATION"
  | "NO_LONGER_QUALIFIED"
  | "DATA_DEGRADED"
  | "EVALUATION_UNAVAILABLE"
  | "EVIDENCE_CONFLICT"
  | "REENTRY_AFTER_FADE"
  | "OUT_OF_ORDER_IGNORED"
  | "DUPLICATE_EVALUATION_IGNORED"
  | "TERMINAL_STATE_HELD"
  | "PHASE9_CONFIRMATION_AUTHORIZED"
  | "PHASE9_INVALIDATION_AUTHORIZED";

export interface LifecycleGovernanceConfiguration {
  contractVersion: typeof LIFECYCLE_CONTRACT_VERSION;
  lifecycleModelId: typeof LIFECYCLE_MODEL_ID;
  lifecycleModelVersion: typeof LIFECYCLE_MODEL_VERSION;
  lifecycleConfigVersion: typeof LIFECYCLE_CONFIG_VERSION;
  activeStates: readonly ActivePhase8LifecycleState[];
  dormantLaterAuthorityStates: readonly DormantLaterAuthorityLifecycleState[];
  persistence: {
    qualifyingObservationsToDevelop: number;
    consecutiveNonQualifyingObservationsToFade: number;
    reentryQualifiedObservations: number;
  };
  elevatedDecision: "DORMANT_UNTIL_LATER_AUTHORITY";
  outOfOrderPolicy: "IGNORE_WITHOUT_CHANGING_CURRENT_PROJECTION";
  missingEvaluationPolicy: "HOLD_CURRENT_STATE_WITH_LIMITATION";
  semantics: "TEMPORAL_QUALIFICATION_STATE_NOT_PROBABILITY_OR_FORECAST";
}

export const LIFECYCLE_GOVERNANCE: LifecycleGovernanceConfiguration = {
  contractVersion: LIFECYCLE_CONTRACT_VERSION,
  lifecycleModelId: LIFECYCLE_MODEL_ID,
  lifecycleModelVersion: LIFECYCLE_MODEL_VERSION,
  lifecycleConfigVersion: LIFECYCLE_CONFIG_VERSION,
  activeStates: ["EMERGING", "DEVELOPING", "FADING"],
  dormantLaterAuthorityStates: ["ELEVATED", "CONFIRMING", "INVALIDATED", "RESOLVED"],
  persistence: {
    qualifyingObservationsToDevelop: 2,
    consecutiveNonQualifyingObservationsToFade: 2,
    reentryQualifiedObservations: 2,
  },
  elevatedDecision: "DORMANT_UNTIL_LATER_AUTHORITY",
  outOfOrderPolicy: "IGNORE_WITHOUT_CHANGING_CURRENT_PROJECTION",
  missingEvaluationPolicy: "HOLD_CURRENT_STATE_WITH_LIMITATION",
  semantics: "TEMPORAL_QUALIFICATION_STATE_NOT_PROBABILITY_OR_FORECAST",
};

export interface LifecycleProjection {
  lifecycleId: string;
  candidateId: string;
  currentLifecycleState: LifecycleState;
  openedAt: string;
  latestObservationAt: string;
  latestQualificationEvaluationId: string;
  qualifyingObservationCount: number;
  nonQualifyingObservationCount: number;
}

export interface LifecycleObservationInput {
  evaluation: Pick<ImportanceQualificationRecord,
    "qualificationId" | "candidateId" | "originatingStateId" | "originatingSynthesisId" | "evaluatedAt" |
    "importanceScore" | "qualificationStatus" | "evidenceStrength" | "dataQuality" | "suppressionReasons" |
    "scoringModelId" | "scoringModelVersion" | "scoringConfigVersion" | "limitations">;
  prior: LifecycleProjection | null;
}

export interface LifecycleTransitionDecision {
  lifecycleId: string | null;
  previousLifecycleState: LifecycleState | null;
  newLifecycleState: LifecycleState | null;
  transitionReasonCode: LifecycleTransitionReasonCode;
  qualifyingObservationCount: number;
  nonQualifyingObservationCount: number;
  appendObservation: boolean;
  updateProjection: boolean;
  limitations: string[];
}

export interface LifecycleObservationRecord {
  contractVersion: typeof LIFECYCLE_CONTRACT_VERSION;
  lifecycleObservationId: string;
  lifecycleId: string;
  candidateId: string;
  qualificationEvaluationId: string;
  originatingStateId: string;
  originatingSynthesisId: string;
  effectiveAt: string;
  observedAt: string;
  previousLifecycleState: LifecycleState | null;
  newLifecycleState: LifecycleState;
  importanceScore: number;
  qualificationStatus: QualificationStatus;
  evidenceStrength: ImportanceQualificationRecord["evidenceStrength"];
  dataQuality: ImportanceQualificationRecord["dataQuality"];
  persistenceCount: number;
  nonQualifyingCount: number;
  transitionReasonCode: LifecycleTransitionReasonCode;
  transitionInputs: Record<string, unknown>;
  lifecycleModelId: typeof LIFECYCLE_MODEL_ID;
  lifecycleModelVersion: typeof LIFECYCLE_MODEL_VERSION;
  lifecycleConfigVersion: typeof LIFECYCLE_CONFIG_VERSION;
  limitations: string[];
}

export const ACTIVE_PHASE8_TRANSITIONS: Record<"NO_ACTIVE" | ActivePhase8LifecycleState, readonly ActivePhase8LifecycleState[]> = {
  NO_ACTIVE: ["EMERGING"],
  EMERGING: ["EMERGING", "DEVELOPING", "FADING"],
  DEVELOPING: ["DEVELOPING", "FADING"],
  FADING: ["FADING", "EMERGING"],
};

export function lifecycleCanAutonomouslyEnter(state: LifecycleState): state is ActivePhase8LifecycleState {
  return (LIFECYCLE_GOVERNANCE.activeStates as readonly string[]).includes(state);
}

/** The only typed extension Phase 9 may ask Phase 8 to consume. */
export interface Phase9LifecycleAuthorityInput {
  lifecycleId: string;
  currentLifecycleState: LifecycleState;
  authorityEventId: string;
  authorityEventType: "CONFIRMATION_AUTHORIZED" | "INVALIDATION_AUTHORIZED";
}

export function decidePhase9LifecycleAuthorityTransition(input: Phase9LifecycleAuthorityInput): Pick<LifecycleTransitionDecision, "previousLifecycleState" | "newLifecycleState" | "transitionReasonCode" | "appendObservation" | "updateProjection" | "limitations"> {
  if (input.authorityEventType === "CONFIRMATION_AUTHORIZED" && input.currentLifecycleState === "DEVELOPING") {
    return { previousLifecycleState: "DEVELOPING", newLifecycleState: "CONFIRMING", transitionReasonCode: "PHASE9_CONFIRMATION_AUTHORIZED", appendObservation: true, updateProjection: true, limitations: ["CONFIRMING reflects a valid typed Phase 9 thesis-support event, not probability, forecast, target, outcome, or resolution."] };
  }
  if (input.authorityEventType === "INVALIDATION_AUTHORIZED" && ["DEVELOPING", "FADING", "CONFIRMING"].includes(input.currentLifecycleState)) {
    return { previousLifecycleState: input.currentLifecycleState, newLifecycleState: "INVALIDATED", transitionReasonCode: "PHASE9_INVALIDATION_AUTHORIZED", appendObservation: true, updateProjection: true, limitations: ["INVALIDATED reflects a valid typed Phase 9 thesis-contradiction event, not outcome failure or opposite forecast authority."] };
  }
  return { previousLifecycleState: input.currentLifecycleState, newLifecycleState: input.currentLifecycleState, transitionReasonCode: "TERMINAL_STATE_HELD", appendObservation: false, updateProjection: false, limitations: ["Typed Phase 9 authority did not meet the governed lifecycle transition matrix and therefore did not alter lifecycle state."] };
}
