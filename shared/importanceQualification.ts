import type { CandidateDetection } from "./candidateDetection";

export const IMPORTANCE_SCORING_CONTRACT_VERSION = "phase7-importance-qualification-v1" as const;
export const IMPORTANCE_SCORING_MODEL_ID = "faultline-candidate-materiality" as const;
export const IMPORTANCE_SCORING_MODEL_VERSION = "1.0.0" as const;
export const IMPORTANCE_SCORING_CONFIG_VERSION = "phase7-governance-v1" as const;

export type FactorAvailability = "AVAILABLE" | "UNAVAILABLE" | "INSUFFICIENT_EVIDENCE" | "NOT_APPLICABLE";
export type QualificationStatus = "QUALIFIED" | "NOT_QUALIFIED" | "SUPPRESSED" | "INSUFFICIENT_EVIDENCE";
export type SystemicRelevance = "LOCAL" | "SECTOR" | "CROSS_ASSET" | "MACRO_SYSTEMIC";
export type ImportanceFactorName =
  | "magnitude"
  | "acceleration"
  | "persistence"
  | "historicalLeadStrength"
  | "crossEngineConfirmation"
  | "systemicImportance"
  | "novelty"
  | "dataConfidence";

export interface ImportanceFactorTrace {
  factor: ImportanceFactorName;
  availability: FactorAvailability;
  rawValue: number | string | boolean | null;
  normalizedValue: number | null;
  weight: number;
  contribution: number | null;
  rationale: string;
}

export interface ImportanceScoringConfiguration {
  contractVersion: typeof IMPORTANCE_SCORING_CONTRACT_VERSION;
  scoringModelId: typeof IMPORTANCE_SCORING_MODEL_ID;
  scoringModelVersion: typeof IMPORTANCE_SCORING_MODEL_VERSION;
  scoringConfigVersion: typeof IMPORTANCE_SCORING_CONFIG_VERSION;
  scoreRange: { minimum: 0; maximum: 100; meaning: "IMPORTANCE_MATERIALITY_NOT_PROBABILITY" };
  factorWeights: Record<ImportanceFactorName, number>;
  thresholds: {
    qualificationScore: number;
    maximumSecondaryQualifiedCandidates: 2;
    dataQualityCeilingForDegraded: number;
    minimumEvidenceStrength: "MODERATE";
  };
  missingValuePolicy: "EXPLICIT_UNAVAILABLE_NO_IMPUTATION";
  suppressionPolicy: "STALE_UNAVAILABLE_LOW_CONFIDENCE_PRELIMINARY_OR_CONFLICTED";
  tieBreakOrder: ["importanceScore", "dataConfidence", "systemicImportance", "persistence", "candidateId"];
}

export const IMPORTANCE_SCORING_CONFIG: ImportanceScoringConfiguration = {
  contractVersion: IMPORTANCE_SCORING_CONTRACT_VERSION,
  scoringModelId: IMPORTANCE_SCORING_MODEL_ID,
  scoringModelVersion: IMPORTANCE_SCORING_MODEL_VERSION,
  scoringConfigVersion: IMPORTANCE_SCORING_CONFIG_VERSION,
  scoreRange: { minimum: 0, maximum: 100, meaning: "IMPORTANCE_MATERIALITY_NOT_PROBABILITY" },
  factorWeights: {
    magnitude: 20,
    acceleration: 10,
    persistence: 10,
    historicalLeadStrength: 10,
    crossEngineConfirmation: 15,
    systemicImportance: 15,
    novelty: 10,
    dataConfidence: 10,
  },
  thresholds: {
    qualificationScore: 72,
    maximumSecondaryQualifiedCandidates: 2,
    dataQualityCeilingForDegraded: 69,
    minimumEvidenceStrength: "MODERATE",
  },
  missingValuePolicy: "EXPLICIT_UNAVAILABLE_NO_IMPUTATION",
  suppressionPolicy: "STALE_UNAVAILABLE_LOW_CONFIDENCE_PRELIMINARY_OR_CONFLICTED",
  tieBreakOrder: ["importanceScore", "dataConfidence", "systemicImportance", "persistence", "candidateId"],
};

export interface CandidateScoringContext {
  candidate: CandidateDetection;
  priorCandidateObservationCount: number;
  historicalLead: { availability: FactorAvailability; value: number | null; provenance: string | null };
  blockingConflict: boolean;
}

export interface ImportanceQualificationRecord {
  contractVersion: typeof IMPORTANCE_SCORING_CONTRACT_VERSION;
  qualificationId: string;
  candidateId: string;
  originatingStateId: string;
  originatingSynthesisId: string;
  evaluatedAt: string;
  importanceScore: number;
  factors: ImportanceFactorTrace[];
  qualificationStatus: QualificationStatus;
  qualificationReasons: string[];
  suppressionReasons: string[];
  evidenceClaimIds: string[];
  relationshipIds: string[];
  evidenceStrength: CandidateDetection["evidenceStrength"];
  dataQuality: CandidateDetection["dataQuality"];
  scoringModelId: typeof IMPORTANCE_SCORING_MODEL_ID;
  scoringModelVersion: typeof IMPORTANCE_SCORING_MODEL_VERSION;
  scoringConfigVersion: typeof IMPORTANCE_SCORING_CONFIG_VERSION;
  relationshipFamily: string;
  rank: number | null;
  isPrimary: boolean;
  limitations: string[];
}

export interface ImportanceQualificationEvaluation {
  originatingStateId: string | null;
  originatingSynthesisId: string | null;
  evaluatedAt: string;
  scoredCandidates: ImportanceQualificationRecord[];
  qualifiedCandidates: ImportanceQualificationRecord[];
  primaryQualifiedWarning: ImportanceQualificationRecord | null;
  secondaryQualifiedCandidates: ImportanceQualificationRecord[];
  noMaterialEarlyWarning: boolean;
  configuration: Pick<ImportanceScoringConfiguration, "scoringModelId" | "scoringModelVersion" | "scoringConfigVersion" | "scoreRange">;
  limitations: string[];
}
