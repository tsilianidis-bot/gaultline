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
import { candidateDetectionObservations, candidateDetections } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";

export const CANDIDATE_DETECTION_MIN_MAGNITUDE = 10;

function stableId(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

function titleFor(divergence: CrossEngineDivergence) {
  return `${divergence.participatingEngines.join(" / ").toUpperCase()} DIVERGENCE`;
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

function suppressionReasons(synthesis: CrossEngineSynthesis, divergence: CrossEngineDivergence, confidence: CandidateDataConfidence) {
  const reasons: string[] = [];
  if (divergence.evidenceIndependence !== "INDEPENDENT") reasons.push("Candidate suppressed: governed evidence is not independent.");
  if (synthesis.staleEngines.some(engine => divergence.participatingEngines.includes(engine))) reasons.push("Candidate suppressed: a participating engine is stale.");
  if (confidence === "INSUFFICIENT") reasons.push("Candidate suppressed: current evidence quality is insufficient.");
  if (divergence.magnitude == null) reasons.push("Candidate suppressed: governed divergence magnitude is unavailable.");
  else if (divergence.magnitude < CANDIDATE_DETECTION_MIN_MAGNITUDE) reasons.push("Candidate suppressed: governed divergence magnitude is below the candidate detection minimum.");
  if (divergence.persistence !== "PERSISTING") reasons.push("Candidate suppressed: relationship has not persisted under the candidate detector rule.");
  return reasons;
}

function candidateFor(synthesis: CrossEngineSynthesis, divergence: CrossEngineDivergence): CandidateDetection | null {
  const dataConfidence = confidenceFor(synthesis, divergence);
  const suppression = suppressionReasons(synthesis, divergence, dataConfidence);
  if (suppression.length > 0) return null;
  const candidateId = `cd:${stableId([CANDIDATE_DETECTOR_ID, divergence.participatingEngines.slice().sort(), divergence.divergenceId])}`;
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
    magnitude: divergence.magnitude,
    acceleration: divergence.acceleration,
    persistence: divergence.persistence,
    dataConfidence,
    dataFreshness: freshnessFor(synthesis, divergence),
    dataQuality: synthesis.dataQuality,
    evidenceStrength: synthesis.evidenceStrength,
    hasBlockingConflict: (synthesis.conflicts?.length ?? 0) > 0,
    limitations: [
      ...divergence.limitations,
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
  return { evaluation, createdCandidateCount, appendedObservationCount, unavailable: false };
}
