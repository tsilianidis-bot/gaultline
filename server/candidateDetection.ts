import { createHash } from "node:crypto";
import type { CrossEngineDivergence, CrossEngineSynthesis } from "../shared/crossEngineSynthesis";
import {
  CANDIDATE_DETECTION_CONTRACT_VERSION,
  CANDIDATE_DETECTOR_CONFIG_VERSION,
  CANDIDATE_DETECTOR_ID,
  CANDIDATE_DETECTOR_VERSION,
  type CandidateDataConfidence,
  type CandidateDetection,
  type CandidateDetectionEvaluation,
} from "../shared/candidateDetection";
import { IMPORTANCE_SCORING_CONFIG } from "../shared/importanceQualification";
import { candidateDetectionObservations, candidateDetections } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { deriveDivergenceMetric, type DerivedDivergenceMetric } from "./crossEngineSynthesis";
import { memoryGetJson, memorySetJson } from "./seismographEngine";

export const CANDIDATE_DETECTION_MIN_MAGNITUDE = 10;
export const CANDIDATE_DETECTION_EVALUATION_MEMORY_KEY = "candidate_detection:evaluation:latest";
export const CANDIDATE_DETECTION_EVALUATION_RECEIPT_VERSION = "phase6-candidate-evaluation-receipt-v1" as const;

function stableId(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

function titleFor(divergence: CrossEngineDivergence) {
  return `${divergence.participatingEngines.join(" / ").toUpperCase()} DIVERGENCE`;
}

/** Stable stream identity deliberately excludes state-specific divergence IDs. */
export function candidateStreamKey(divergence: Pick<CrossEngineDivergence, "participatingEngines">) {
  return `CROSS_ENGINE_DIVERGENCE:${divergence.participatingEngines.slice().sort().join("|")}`;
}

function derivedMetricFor(synthesis: CrossEngineSynthesis, divergence: CrossEngineDivergence): DerivedDivergenceMetric | null {
  const [firstEngineId, secondEngineId] = divergence.participatingEngines.slice().sort();
  const first = synthesis.engineObservations.find(observation => observation.engineId === firstEngineId);
  const second = synthesis.engineObservations.find(observation => observation.engineId === secondEngineId);
  return first && second ? deriveDivergenceMetric(first, second) : null;
}

function confidenceFor(synthesis: CrossEngineSynthesis, divergence: CrossEngineDivergence): CandidateDataConfidence {
  if (synthesis.dataQuality === "UNAVAILABLE" || divergence.evidenceIndependence === "UNKNOWN") return "INSUFFICIENT";
  if (synthesis.staleEngines.some(engine => divergence.participatingEngines.includes(engine))) return "LOW";
  if (synthesis.degradedEngines.some(engine => divergence.participatingEngines.includes(engine))) return "MODERATE";
  return divergence.evidenceIndependence === "INDEPENDENT" ? "HIGH" : "MODERATE";
}

function freshnessFor(synthesis: CrossEngineSynthesis, divergence: CrossEngineDivergence): CandidateDetection["dataFreshness"] {
  if (synthesis.staleEngines.some(engine => divergence.participatingEngines.includes(engine))) return "STALE";
  if (synthesis.degradedEngines.some(engine => divergence.participatingEngines.includes(engine))) return "DEGRADED";
  if (synthesis.dataQuality === "UNAVAILABLE" || divergence.evidenceIndependence === "UNKNOWN") return "UNAVAILABLE";
  return "FRESH";
}

function suppressionReasons(synthesis: CrossEngineSynthesis, divergence: CrossEngineDivergence, confidence: CandidateDataConfidence, metric: DerivedDivergenceMetric | null) {
  const reasons: string[] = [];
  if (divergence.evidenceIndependence !== "INDEPENDENT") reasons.push("Candidate suppressed: governed evidence is not independent.");
  if (synthesis.staleEngines.some(engine => divergence.participatingEngines.includes(engine))) reasons.push("Candidate suppressed: a participating engine is stale.");
  if (confidence === "INSUFFICIENT") reasons.push("Candidate suppressed: current evidence quality is insufficient.");
  if (!metric) reasons.push("Candidate suppressed: finite derived divergence magnitude is unavailable.");
  else if (metric.value < CANDIDATE_DETECTION_MIN_MAGNITUDE) reasons.push("Candidate suppressed: governed derived divergence magnitude is below the candidate detection minimum.");
  if (divergence.persistence !== "PERSISTING") reasons.push("Candidate suppressed: relationship has not persisted under the candidate detector rule.");
  return reasons;
}

function candidateFor(synthesis: CrossEngineSynthesis, divergence: CrossEngineDivergence): CandidateDetection | null {
  const dataConfidence = confidenceFor(synthesis, divergence);
  const metric = derivedMetricFor(synthesis, divergence);
  const suppression = suppressionReasons(synthesis, divergence, dataConfidence, metric);
  if (suppression.length > 0) return null;
  const streamKey = candidateStreamKey(divergence);
  const candidateId = `cd:${stableId([CANDIDATE_DETECTOR_ID, streamKey])}`;
  return {
    contractVersion: CANDIDATE_DETECTION_CONTRACT_VERSION,
    candidateId,
    candidateType: "CROSS_ENGINE_DIVERGENCE",
    title: titleFor(divergence),
    originatingSynthesisId: synthesis.synthesisId,
    originatingStateId: synthesis.originatingStateId,
    effectiveAt: synthesis.originatingEffectiveAt,
    firstObservedAt: divergence.firstObservedAt,
    latestObservedAt: divergence.latestObservedAt,
    participatingEngines: divergence.participatingEngines,
    participatingRelationships: synthesis.relationships
      .filter(item => item.participatingEngines.join("|") === divergence.participatingEngines.join("|"))
      .map(item => item.relationshipId),
    supportingDivergences: [divergence.divergenceId],
    evidenceClaimIds: divergence.supportingClaimIds,
    relevantArchiveEventIds: [],
    magnitude: metric!.value,
    acceleration: divergence.acceleration,
    persistence: divergence.persistence,
    dataConfidence,
    dataFreshness: freshnessFor(synthesis, divergence),
    dataQuality: synthesis.dataQuality,
    evidenceStrength: synthesis.evidenceStrength,
    hasBlockingConflict: (synthesis.conflicts?.length ?? 0) > 0,
    limitations: [
      ...divergence.limitations,
      `Magnitude is ${metric!.evidenceClass}, produced by ${metric!.methodologyId} from finite canonical engine scores; it is not an observed provider measurement.`,
      "Candidate detection is not importance scoring, qualification, publication, lifecycle, confirmation, invalidation, probability, target, or forecast authority.",
    ],
    detectorId: CANDIDATE_DETECTOR_ID,
    detectorVersion: CANDIDATE_DETECTOR_VERSION,
    detectorConfigVersion: CANDIDATE_DETECTOR_CONFIG_VERSION,
    provenance: {
      canonicalStateSchemaVersion: synthesis.provenance.canonicalStateSchemaVersion,
      synthesisContractVersion: synthesis.contractVersion,
      deterministic: true,
    },
  };
}

export function evaluateCandidateDetections(synthesis: CrossEngineSynthesis): CandidateDetectionEvaluation {
  const candidates = synthesis.divergences.flatMap(divergence => {
    const candidate = candidateFor(synthesis, divergence);
    return candidate ? [candidate] : [];
  });
  return {
    originatingSynthesisId: synthesis.synthesisId,
    originatingStateId: synthesis.originatingStateId,
    effectiveAt: synthesis.originatingEffectiveAt,
    candidates,
    noCandidates: candidates.length === 0,
    limitations: synthesis.limitations,
  };
}

export type CandidateQualificationFeasibility = {
  status: "FEASIBLE" | "GOVERNANCE_BLOCKED";
  scoreCeiling: number;
  qualificationThreshold: number;
  limitation: string | null;
};

function systemicMaximum(candidate: CandidateDetection) {
  const domains = new Set(candidate.participatingEngines.map(item => item.toLowerCase()));
  const canonicalTaxonomy = ["credit", "liquidity", "treasury", "macro"];
  const matching = canonicalTaxonomy.filter(item => domains.has(item));
  if (matching.length >= 2) return 1;
  if (matching.length === 1 && domains.size >= 2) return 0.75;
  if (domains.size >= 2) return 0.5;
  return 0.25;
}

/**
 * Checks whether the currently authorized live Phase 5/6 shape could ever
 * cross the frozen Phase 7 threshold. This is a governance diagnostic only:
 * it does not change weights, thresholds, or any candidate score.
 */
export function qualificationFeasibilityFor(candidate: CandidateDetection): CandidateQualificationFeasibility {
  const weights = IMPORTANCE_SCORING_CONFIG.factorWeights;
  const evidenceMaximum = Math.min(1, Math.max(0, (candidate.participatingEngines.length - 1) / 2));
  const dataMaximum = ({ HIGH: 1, MODERATE: 2 / 3, LOW: 1 / 3, INSUFFICIENT: 0 } as const)[candidate.dataConfidence];
  const scoreCeiling = Math.round(
    weights.magnitude
    + (candidate.acceleration === null ? 0 : weights.acceleration)
    + (candidate.persistence === "PERSISTING" ? weights.persistence : 0)
    // Phase 7 explicitly has no governed historical lead adapter.
    + weights.crossEngineConfirmation * evidenceMaximum
    + weights.systemicImportance * systemicMaximum(candidate)
    + weights.novelty
    + weights.dataConfidence * dataMaximum,
  );
  const qualificationThreshold = IMPORTANCE_SCORING_CONFIG.thresholds.qualificationScore;
  const blocked = scoreCeiling < qualificationThreshold;
  return {
    status: blocked ? "GOVERNANCE_BLOCKED" : "FEASIBLE",
    scoreCeiling,
    qualificationThreshold,
    limitation: blocked
      ? `Current authorized live candidate shape has a governed score ceiling of ${scoreCeiling}, below the frozen qualification threshold of ${qualificationThreshold}; weights and thresholds were not changed.`
      : null,
  };
}

export type CandidateDetectionEvaluationReceipt = {
  receiptVersion: typeof CANDIDATE_DETECTION_EVALUATION_RECEIPT_VERSION;
  originatingStateId: string;
  originatingSynthesisId: string;
  effectiveAt: string;
  noCandidates: boolean;
  candidateIds: string[];
  qualificationFeasibility: CandidateQualificationFeasibility[];
};

function evaluationReceipt(evaluation: CandidateDetectionEvaluation): CandidateDetectionEvaluationReceipt {
  return {
    receiptVersion: CANDIDATE_DETECTION_EVALUATION_RECEIPT_VERSION,
    originatingStateId: evaluation.originatingStateId,
    originatingSynthesisId: evaluation.originatingSynthesisId,
    effectiveAt: evaluation.effectiveAt,
    noCandidates: evaluation.noCandidates,
    candidateIds: evaluation.candidates.map(candidate => candidate.candidateId),
    qualificationFeasibility: evaluation.candidates.map(qualificationFeasibilityFor),
  };
}

/** A persisted Phase 6 receipt is the state-bound proof that zero candidates was evaluated, not assumed. */
export async function getPersistedCandidateDetectionEvaluation(): Promise<CandidateDetectionEvaluationReceipt | null> {
  try {
    return await memoryGetJson<CandidateDetectionEvaluationReceipt | null>(CANDIDATE_DETECTION_EVALUATION_MEMORY_KEY, null);
  } catch {
    return null;
  }
}

function candidatePayload(candidate: CandidateDetection) {
  return { ...candidate, historyClass: "live_verified" as const };
}

export async function getPersistedCandidateDetections() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(candidateDetections).orderBy(desc(candidateDetections.createdAt));
}

export async function getCandidateObservationTimeline(candidateId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(candidateDetectionObservations)
    .where(eq(candidateDetectionObservations.candidateId, candidateId))
    .orderBy(candidateDetectionObservations.observedAt);
}

/**
 * Compute once in the scheduled global synthesis path and retain only internal,
 * append-only candidate detection evidence. A later absence is not converted
 * into lifecycle, confirmation, invalidation, ranking, or publication state.
 */
export async function evaluateAndPersistCandidateDetections(synthesis: CrossEngineSynthesis) {
  const evaluation = evaluateCandidateDetections(synthesis);
  const db = await getDb();
  if (!db) return { evaluation, createdCandidateCount: 0, appendedObservationCount: 0, unavailable: true };

  let createdCandidateCount = 0;
  let appendedObservationCount = 0;
  for (const candidate of evaluation.candidates) {
    const existing = await db.select({ id: candidateDetections.id }).from(candidateDetections)
      .where(eq(candidateDetections.candidateId, candidate.candidateId)).limit(1);
    const observedAt = new Date(candidate.effectiveAt);
    if (!existing[0]) {
      await db.insert(candidateDetections).values({
        candidateId: candidate.candidateId,
        candidateType: candidate.candidateType,
        title: candidate.title,
        originalStateId: candidate.originatingStateId,
        originalSynthesisId: candidate.originatingSynthesisId,
        originalEffectiveAt: observedAt,
        originalPayloadJson: JSON.stringify(candidatePayload(candidate)),
        detectorId: candidate.detectorId,
        detectorVersion: candidate.detectorVersion,
        detectorConfigVersion: candidate.detectorConfigVersion,
      });
      createdCandidateCount += 1;
    }
    const observationType = existing[0] ? "candidate_observed" : "candidate_detected";
    const observationKey = `candidate_detection:${candidate.candidateId}:${candidate.originatingSynthesisId}:${observationType}`;
    const recorded = await db.select({ id: candidateDetectionObservations.id }).from(candidateDetectionObservations)
      .where(eq(candidateDetectionObservations.observationKey, observationKey)).limit(1);
    if (!recorded[0]) {
      await db.insert(candidateDetectionObservations).values({
        observationKey,
        candidateId: candidate.candidateId,
        originatingStateId: candidate.originatingStateId,
        originatingSynthesisId: candidate.originatingSynthesisId,
        observedAt,
        observationType,
        observationPayloadJson: JSON.stringify(candidatePayload(candidate)),
        provenanceJson: JSON.stringify(candidate.provenance),
      });
      appendedObservationCount += 1;
    }
  }
  const receipt = evaluationReceipt(evaluation);
  await memorySetJson(
    CANDIDATE_DETECTION_EVALUATION_MEMORY_KEY,
    receipt,
    "Latest state-bound Phase 6 candidate evaluation receipt, including evaluated zero-candidate outcomes",
  );
  return { evaluation, receipt, createdCandidateCount, appendedObservationCount, unavailable: false };
}
