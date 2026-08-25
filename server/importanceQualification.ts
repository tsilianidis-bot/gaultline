import { createHash } from "node:crypto";
import {
  IMPORTANCE_SCORING_CONFIG,
  IMPORTANCE_SCORING_CONTRACT_VERSION,
  IMPORTANCE_SCORING_MODEL_ID,
  IMPORTANCE_SCORING_MODEL_VERSION,
  IMPORTANCE_SCORING_CONFIG_VERSION,
  type CandidateScoringContext,
  type FactorAvailability,
  type ImportanceFactorName,
  type ImportanceFactorTrace,
  type ImportanceQualificationEvaluation,
  type ImportanceQualificationRecord,
  type QualificationStatus,
  type SystemicRelevance,
} from "../shared/importanceQualification";
import type { CandidateDetection } from "../shared/candidateDetection";
import { candidateDetectionObservations, importanceQualificationEvaluations } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";

function stableId(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function confidenceRank(value: CandidateDetection["dataConfidence"]) {
  return ({ HIGH: 3, MODERATE: 2, LOW: 1, INSUFFICIENT: 0 } as const)[value];
}

function systemicRelevance(candidate: CandidateDetection): SystemicRelevance {
  const domains = new Set(candidate.participatingEngines.map(item => item.toLowerCase()));
  if (["credit", "liquidity", "treasury", "macro"].filter(item => domains.has(item)).length >= 2) return "MACRO_SYSTEMIC";
  if (["credit", "liquidity", "treasury", "macro"].some(item => domains.has(item)) && domains.size >= 2) return "CROSS_ASSET";
  if (domains.size >= 2) return "SECTOR";
  return "LOCAL";
}

function systemicNormalized(value: SystemicRelevance) {
  return ({ LOCAL: 0.25, SECTOR: 0.5, CROSS_ASSET: 0.75, MACRO_SYSTEMIC: 1 } as const)[value];
}

function factor(
  name: ImportanceFactorName,
  availability: FactorAvailability,
  rawValue: number | string | boolean | null,
  normalizedValue: number | null,
  rationale: string,
): ImportanceFactorTrace {
  const weight = IMPORTANCE_SCORING_CONFIG.factorWeights[name];
  return {
    factor: name,
    availability,
    rawValue,
    normalizedValue,
    weight,
    contribution: normalizedValue === null ? null : Number((weight * clamp(normalizedValue)).toFixed(4)),
    rationale,
  };
}

export function factorTraces(context: CandidateScoringContext): ImportanceFactorTrace[] {
  const { candidate, priorCandidateObservationCount, historicalLead } = context;
  const historicalAvailability = historicalLead.availability;
  const systemic = systemicRelevance(candidate);
  const evidenceCountNormalized = clamp((candidate.participatingEngines.length - 1) / 2);
  const noveltyNormalized = clamp(1 / (1 + Math.max(0, priorCandidateObservationCount) * 0.25));
  const dataNormalized = confidenceRank(candidate.dataConfidence) / 3;
  return [
    factor("magnitude", candidate.magnitude === null ? "UNAVAILABLE" : "AVAILABLE", candidate.magnitude, candidate.magnitude === null ? null : clamp(candidate.magnitude / 100), "Governed Phase 6 magnitude; no prose-derived magnitude."),
    factor("acceleration", candidate.acceleration === null ? "UNAVAILABLE" : "AVAILABLE", candidate.acceleration, candidate.acceleration === null ? null : clamp(candidate.acceleration / 100), "Governed Phase 6 acceleration distinct from magnitude."),
    factor("persistence", "AVAILABLE", candidate.persistence, candidate.persistence === "PERSISTING" ? 1 : 0, "Phase 6 persistence input only; not a lifecycle state."),
    factor("historicalLeadStrength", historicalAvailability, historicalLead.value, historicalAvailability === "AVAILABLE" && historicalLead.value !== null ? clamp(historicalLead.value) : null, historicalLead.availability === "AVAILABLE" ? `Governed historical context: ${historicalLead.provenance ?? "provenance retained separately"}.` : "Historical lead support is explicitly unavailable; it is not imputed as neutral or zero evidence."),
    factor("crossEngineConfirmation", "AVAILABLE", candidate.participatingEngines.length, evidenceCountNormalized, "Structural independent cross-engine support; this is not Phase 9 warning confirmation."),
    factor("systemicImportance", "AVAILABLE", systemic, systemicNormalized(systemic), "Central deterministic taxonomy based on participating domains."),
    factor("novelty", "AVAILABLE", priorCandidateObservationCount, noveltyNormalized, "Novelty declines deterministically with unchanged prior candidate observations; it does not reward random noise."),
    factor("dataConfidence", candidate.dataConfidence === "INSUFFICIENT" ? "INSUFFICIENT_EVIDENCE" : "AVAILABLE", candidate.dataConfidence, candidate.dataConfidence === "INSUFFICIENT" ? null : dataNormalized, "Governed data confidence is distinct from model probability."),
  ];
}

function score(traces: ImportanceFactorTrace[]) {
  return Math.round(traces.reduce((total, item) => total + (item.contribution ?? 0), 0));
}

function qualification(context: CandidateScoringContext, importanceScore: number, traces: ImportanceFactorTrace[]): { status: QualificationStatus; reasons: string[]; suppression: string[] } {
  const { candidate, blockingConflict } = context;
  const reasons: string[] = [];
  const suppression: string[] = [];
  const historical = traces.find(item => item.factor === "historicalLeadStrength");
  if (candidate.dataFreshness === "STALE" || candidate.dataFreshness === "UNAVAILABLE") suppression.push("Current candidate input fails the governed freshness floor.");
  if (candidate.dataConfidence === "LOW" || candidate.dataConfidence === "INSUFFICIENT") suppression.push("Current candidate input fails the governed confidence floor.");
  if (candidate.evidenceStrength === "PRELIMINARY") suppression.push("Current candidate input fails the governed evidence-strength floor.");
  if (blockingConflict) suppression.push("A supplied structured evidence conflict blocks qualification.");
  if (suppression.length > 0) return { status: candidate.dataConfidence === "INSUFFICIENT" ? "INSUFFICIENT_EVIDENCE" : "SUPPRESSED", reasons, suppression };
  if (candidate.dataFreshness === "DEGRADED" && importanceScore > IMPORTANCE_SCORING_CONFIG.thresholds.dataQualityCeilingForDegraded) {
    suppression.push(`Degraded data quality applies the governed ${IMPORTANCE_SCORING_CONFIG.thresholds.dataQualityCeilingForDegraded} qualification ceiling.`);
    return { status: "SUPPRESSED", reasons, suppression };
  }
  if (importanceScore < IMPORTANCE_SCORING_CONFIG.thresholds.qualificationScore) {
    reasons.push(`Importance score ${importanceScore}/100 is below the governed qualification threshold of ${IMPORTANCE_SCORING_CONFIG.thresholds.qualificationScore}.`);
    if (historical?.availability !== "AVAILABLE") reasons.push("Historical lead strength is unavailable and was explicitly not imputed.");
    return { status: "NOT_QUALIFIED", reasons, suppression };
  }
  reasons.push(`Importance score ${importanceScore}/100 meets the governed qualification threshold.`);
  reasons.push("Qualification is internal materiality classification only, not probability, target, timing, lifecycle, confirmation, invalidation, or forecast authority.");
  return { status: "QUALIFIED", reasons, suppression };
}

function relationshipFamily(candidate: CandidateDetection) {
  return candidate.participatingEngines.slice().sort().join("|");
}

function compareImportance(a: ImportanceQualificationRecord, b: ImportanceQualificationRecord) {
  if (b.importanceScore !== a.importanceScore) return b.importanceScore - a.importanceScore;
  const dataRank = (record: ImportanceQualificationRecord) => ({ HIGH: 3, MODERATE: 2, LOW: 1, INSUFFICIENT: 0 } as const)[record.factors.find(item => item.factor === "dataConfidence")?.rawValue as CandidateDetection["dataConfidence"] ?? "INSUFFICIENT"];
  if (dataRank(b) !== dataRank(a)) return dataRank(b) - dataRank(a);
  const systemic = (record: ImportanceQualificationRecord) => Number(record.factors.find(item => item.factor === "systemicImportance")?.normalizedValue ?? 0);
  if (systemic(b) !== systemic(a)) return systemic(b) - systemic(a);
  const persistence = (record: ImportanceQualificationRecord) => Number(record.factors.find(item => item.factor === "persistence")?.normalizedValue ?? 0);
  if (persistence(b) !== persistence(a)) return persistence(b) - persistence(a);
  return a.candidateId.localeCompare(b.candidateId);
}

export function evaluateImportanceQualification(contexts: CandidateScoringContext[]): ImportanceQualificationEvaluation {
  const records = contexts.map(context => {
    const factors = factorTraces(context);
    const importanceScore = score(factors);
    const gate = qualification(context, importanceScore, factors);
    const candidate = context.candidate;
    return {
      contractVersion: IMPORTANCE_SCORING_CONTRACT_VERSION,
      qualificationId: `iq:${stableId([candidate.candidateId, candidate.originatingStateId, IMPORTANCE_SCORING_MODEL_VERSION, IMPORTANCE_SCORING_CONFIG_VERSION])}`,
      candidateId: candidate.candidateId,
      originatingStateId: candidate.originatingStateId,
      originatingSynthesisId: candidate.originatingSynthesisId,
      evaluatedAt: candidate.effectiveAt,
      importanceScore,
      factors,
      qualificationStatus: gate.status,
      qualificationReasons: gate.reasons,
      suppressionReasons: gate.suppression,
      evidenceClaimIds: candidate.evidenceClaimIds,
      relationshipIds: candidate.participatingRelationships,
      evidenceStrength: candidate.evidenceStrength,
      dataQuality: candidate.dataQuality,
      scoringModelId: IMPORTANCE_SCORING_MODEL_ID,
      scoringModelVersion: IMPORTANCE_SCORING_MODEL_VERSION,
      scoringConfigVersion: IMPORTANCE_SCORING_CONFIG_VERSION,
      relationshipFamily: relationshipFamily(candidate),
      rank: null,
      isPrimary: false,
      limitations: candidate.limitations,
    } satisfies ImportanceQualificationRecord;
  });

  const bestPerFamily = new Map<string, ImportanceQualificationRecord>();
  records.filter(item => item.qualificationStatus === "QUALIFIED").sort(compareImportance).forEach(item => {
    if (!bestPerFamily.has(item.relationshipFamily)) bestPerFamily.set(item.relationshipFamily, item);
  });
  const qualified = [...bestPerFamily.values()].sort(compareImportance);
  const selected = qualified.slice(0, 1 + IMPORTANCE_SCORING_CONFIG.thresholds.maximumSecondaryQualifiedCandidates).map((item, index) => ({ ...item, rank: index + 1, isPrimary: index === 0 }));
  const selectedById = new Map(selected.map(item => [item.qualificationId, item]));
  const scoredCandidates = records.map(item => selectedById.get(item.qualificationId) ?? item);
  const primaryQualifiedWarning = selected[0] ?? null;
  const secondaryQualifiedCandidates = selected.slice(1);
  return {
    originatingStateId: contexts[0]?.candidate.originatingStateId ?? null,
    originatingSynthesisId: contexts[0]?.candidate.originatingSynthesisId ?? null,
    evaluatedAt: contexts[0]?.candidate.effectiveAt ?? new Date(0).toISOString(),
    scoredCandidates,
    qualifiedCandidates: selected,
    primaryQualifiedWarning,
    secondaryQualifiedCandidates,
    noMaterialEarlyWarning: selected.length === 0,
    configuration: {
      scoringModelId: IMPORTANCE_SCORING_MODEL_ID,
      scoringModelVersion: IMPORTANCE_SCORING_MODEL_VERSION,
      scoringConfigVersion: IMPORTANCE_SCORING_CONFIG_VERSION,
      scoreRange: IMPORTANCE_SCORING_CONFIG.scoreRange,
    },
    limitations: contexts.flatMap(context => context.candidate.limitations),
  };
}

/**
 * Persists a global, state-locked Phase 7 scoring transaction. Historical lead
 * remains explicitly unavailable unless a future governed historical model
 * supplies a qualified value; Phase 7 never manufactures that evidence.
 */
export async function evaluateAndPersistImportanceQualification(candidates: CandidateDetection[]) {
  const db = await getDb();
  const contexts = await Promise.all(candidates.map(async candidate => {
    const observations = db
      ? await db.select({ id: candidateDetectionObservations.id }).from(candidateDetectionObservations).where(eq(candidateDetectionObservations.candidateId, candidate.candidateId))
      : [];
    return {
      candidate,
      priorCandidateObservationCount: Math.max(0, observations.length - 1),
      historicalLead: { availability: "UNAVAILABLE" as const, value: null, provenance: null },
      blockingConflict: candidate.hasBlockingConflict,
    } satisfies CandidateScoringContext;
  }));
  const evaluation = evaluateImportanceQualification(contexts);
  if (!db) return { evaluation, appendedEvaluationCount: 0, unavailable: true };
  let appendedEvaluationCount = 0;
  for (const record of evaluation.scoredCandidates) {
    const existing = await db.select({ id: importanceQualificationEvaluations.id }).from(importanceQualificationEvaluations)
      .where(eq(importanceQualificationEvaluations.evaluationId, record.qualificationId)).limit(1);
    if (existing[0]) continue;
    await db.insert(importanceQualificationEvaluations).values({
      evaluationId: record.qualificationId,
      candidateId: record.candidateId,
      originatingStateId: record.originatingStateId,
      originatingSynthesisId: record.originatingSynthesisId,
      evaluatedAt: new Date(record.evaluatedAt),
      importanceScore: record.importanceScore,
      qualificationStatus: record.qualificationStatus,
      qualificationRank: record.rank,
      isPrimary: record.isPrimary,
      factorTraceJson: JSON.stringify(record.factors),
      qualificationReasonsJson: JSON.stringify(record.qualificationReasons),
      suppressionReasonsJson: JSON.stringify(record.suppressionReasons),
      evidenceClaimIdsJson: JSON.stringify(record.evidenceClaimIds),
      relationshipIdsJson: JSON.stringify(record.relationshipIds),
      limitationsJson: JSON.stringify(record.limitations),
      scoringModelId: record.scoringModelId,
      scoringModelVersion: record.scoringModelVersion,
      scoringConfigVersion: record.scoringConfigVersion,
    });
    appendedEvaluationCount += 1;
  }
  return { evaluation, appendedEvaluationCount, unavailable: false };
}

export async function getImportanceQualificationEvaluations(candidateId?: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(importanceQualificationEvaluations);
  return candidateId
    ? query.where(eq(importanceQualificationEvaluations.candidateId, candidateId)).orderBy(desc(importanceQualificationEvaluations.evaluatedAt))
    : query.orderBy(desc(importanceQualificationEvaluations.evaluatedAt));
}
