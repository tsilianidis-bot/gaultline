/**
 * Phase 10 presentation authority. This contract is a read-only projection of
 * governed Phase 5–9 evidence. It has no scoring, lifecycle, qualification,
 * confirmation, invalidation, or interpretation authority.
 */
export const PHASE10_PRESENTATION_CONTRACT_VERSION = "phase10-early-warning-presentation-v1" as const;

export type PresentationFreshness = "CURRENT" | "STALE" | "UNAVAILABLE";
export type PresentationConfidence = "HIGH" | "MODERATE" | "LOW" | "UNAVAILABLE";
export type ConfirmationPresentationStatus = "AUTHORIZED" | "NOT_YET_CONFIRMED" | "CONFLICTED_CONDITIONS" | "NO_GOVERNED_CONFIRMATION_PLAN" | "UNEVALUABLE";
export type InvalidationPresentationStatus = "AUTHORIZED" | "NOT_TRIGGERED" | "CONFLICTED_CONDITIONS" | "NO_GOVERNED_INVALIDATION_PLAN" | "UNEVALUABLE";

export interface PresentationProvenance {
  presentationId: string;
  warningId: string;
  candidateId: string;
  qualificationId: string;
  lifecycleEpisodeId: string;
  synthesisId: string;
  stateId: string;
  thesisId: string | null;
  planId: string | null;
  latestPlanEvaluationId: string | null;
  confirmationAuthorityEventId: string | null;
  invalidationAuthorityEventId: string | null;
  supportingClaimRefs: string[];
  presentationContractVersion: typeof PHASE10_PRESENTATION_CONTRACT_VERSION;
}

export interface EarlyWarningPresentation {
  contractVersion: typeof PHASE10_PRESENTATION_CONTRACT_VERSION;
  kind: "ACTIVE_GOVERNED_WARNING";
  presentationId: string;
  warningId: string;
  candidateId: string;
  qualificationId: string;
  lifecycleEpisodeId: string;
  lifecycleState: string;
  lifecycleStateChangedAt: string;
  synthesisId: string;
  stateId: string;
  warningType: string;
  thesis: { code: string; statement: string };
  conciseTitle: string;
  conciseSummary: string;
  warningScore: number;
  scoreSemantics: "Prioritization score, not probability.";
  firstObservedAt: string;
  latestObservedAt: string;
  durationDays: number;
  trend: "STRENGTHENING" | "STABLE" | "WEAKENING" | "INVALIDATED";
  dataConfidence: PresentationConfidence;
  canonicalQuality: string;
  supportingEvidence: string[];
  participatingEngines: string[];
  supportingClaimRefs: string[];
  confirmationStatus: ConfirmationPresentationStatus;
  confirmationConditions: string[];
  confirmationEvidence: string[];
  confirmationAuthorityEventId: string | null;
  invalidationStatus: InvalidationPresentationStatus;
  invalidationConditions: string[];
  invalidationEvidence: string[];
  invalidationAuthorityEventId: string | null;
  limitations: string[];
  historicalContext: { status: "UNAVAILABLE"; label: "HISTORICAL CONTEXT NOT PRESENTED" };
  analogContext: { status: "UNAVAILABLE"; label: "ANALOG CONTEXT NOT PRESENTED" };
  freshness: PresentationFreshness;
  observedAt: string;
  effectiveAt: string;
  generatedAt: string;
  provenance: PresentationProvenance;
  presentationGeneratedAt: string;
  presentationContractVersion: typeof PHASE10_PRESENTATION_CONTRACT_VERSION;
}

export interface NoMaterialEarlyWarningPresentation {
  contractVersion: typeof PHASE10_PRESENTATION_CONTRACT_VERSION;
  kind: "NO_MATERIAL_EARLY_WARNING";
  presentationId: string;
  stateId: string | null;
  synthesisId: string | null;
  message: "Current governed cross-engine evidence does not meet FAULTLINE’s qualification requirements for a material developing warning.";
  limitations: ["This does not mean markets are safe, bullish, or without downside risk."];
  freshness: PresentationFreshness;
  generatedAt: string;
  presentationContractVersion: typeof PHASE10_PRESENTATION_CONTRACT_VERSION;
}

/**
 * Fail-closed status for a current market moment that cannot complete its
 * governed Early Warning evaluation. This is deliberately distinct from a
 * completed NO_MATERIAL_EARLY_WARNING result.
 */
export interface GovernedEvaluationUnavailablePresentation {
  contractVersion: typeof PHASE10_PRESENTATION_CONTRACT_VERSION;
  kind: "GOVERNED_EVALUATION_UNAVAILABLE";
  presentationId: string;
  stateId: string | null;
  synthesisId: string | null;
  reason: "CANONICAL_STATE_UNAVAILABLE" | "SYNTHESIS_UNAVAILABLE" | "SYNTHESIS_STATE_MISMATCH" | "GOVERNED_LEDGER_UNAVAILABLE";
  message: "FAULTLINE could not complete the governed Early Warning evaluation for the current market state.";
  limitations: ["No conclusion about the absence of a warning, market safety, bullishness, or downside risk is authorized."];
  freshness: "UNAVAILABLE";
  generatedAt: string;
  presentationContractVersion: typeof PHASE10_PRESENTATION_CONTRACT_VERSION;
}

export type GovernedEarlyWarningPresentation = EarlyWarningPresentation | NoMaterialEarlyWarningPresentation | GovernedEvaluationUnavailablePresentation;

export const PRESENTATION_SEMANTICS = {
  score: "EARLY WARNING SCORE is a prioritization score, not probability.",
  confirming: "CONFIRMING means additional governed evidence supports the structural warning thesis.",
  fading: "FADING means the warning remains active but supporting conditions are weakening.",
  invalidated: "INVALIDATED means governed contradictory evidence terminated the lifecycle episode.",
  noMaterial: "NO MATERIAL EARLY WARNING means no current candidate satisfies governed qualification requirements.",
  unavailable: "GOVERNED EVALUATION UNAVAILABLE means the current governed Early Warning evaluation could not be completed.",
} as const;
