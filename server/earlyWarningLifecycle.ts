import { createHash } from "node:crypto";
import { and, desc, eq, lt } from "drizzle-orm";
import {
  earlyWarningLifecycles,
  earlyWarningLifecycleObservations,
} from "../drizzle/schema";
import {
  LIFECYCLE_CONFIG_VERSION,
  LIFECYCLE_CONTRACT_VERSION,
  LIFECYCLE_GOVERNANCE,
  LIFECYCLE_MODEL_ID,
  LIFECYCLE_MODEL_VERSION,
  type ActivePhase8LifecycleState,
  type LifecycleObservationInput,
  type LifecycleObservationRecord,
  type LifecycleProjection,
  type LifecycleTransitionDecision,
} from "../shared/earlyWarningLifecycle";
import type { ImportanceQualificationEvaluation, ImportanceQualificationRecord } from "../shared/importanceQualification";
import { getDb } from "./db";

function stableId(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

function isDegradedOrUnavailable(evaluation: LifecycleObservationInput["evaluation"]) {
  const reasons = evaluation.suppressionReasons.join(" ").toUpperCase();
  return evaluation.dataQuality === "DEGRADED" || /STALE|UNAVAILABLE|PRELIMINARY|INSUFFICIENT/.test(reasons);
}

function hasConflict(evaluation: LifecycleObservationInput["evaluation"]) {
  return evaluation.suppressionReasons.some(reason => /CONFLICT/i.test(reason));
}

export function decideLifecycleTransition(input: LifecycleObservationInput): LifecycleTransitionDecision {
  const { evaluation, prior } = input;
  const qualified = evaluation.qualificationStatus === "QUALIFIED";
  const degraded = isDegradedOrUnavailable(evaluation);
  const conflicted = hasConflict(evaluation);
  if (!prior) {
    if (!qualified) {
      return { lifecycleId: null, previousLifecycleState: null, newLifecycleState: null, transitionReasonCode: "DUPLICATE_EVALUATION_IGNORED", qualifyingObservationCount: 0, nonQualifyingObservationCount: 0, appendObservation: false, updateProjection: false, limitations: ["No qualified Phase 7 evaluation exists; Phase 8 does not create a lifecycle."] };
    }
    return { lifecycleId: `lc:${stableId([evaluation.candidateId])}`, previousLifecycleState: null, newLifecycleState: "EMERGING", transitionReasonCode: "FIRST_QUALIFICATION", qualifyingObservationCount: 1, nonQualifyingObservationCount: 0, appendObservation: true, updateProjection: true, limitations: [] };
  }
  if (new Date(evaluation.evaluatedAt).getTime() <= new Date(prior.latestObservationAt).getTime()) {
    return { lifecycleId: prior.lifecycleId, previousLifecycleState: prior.currentLifecycleState, newLifecycleState: prior.currentLifecycleState, transitionReasonCode: "OUT_OF_ORDER_IGNORED", qualifyingObservationCount: prior.qualifyingObservationCount, nonQualifyingObservationCount: prior.nonQualifyingObservationCount, appendObservation: false, updateProjection: false, limitations: ["Out-of-order evaluation was ignored and did not alter the current projection."] };
  }
  if (degraded || conflicted) {
    return { lifecycleId: prior.lifecycleId, previousLifecycleState: prior.currentLifecycleState, newLifecycleState: prior.currentLifecycleState, transitionReasonCode: conflicted ? "EVIDENCE_CONFLICT" : "DATA_DEGRADED", qualifyingObservationCount: prior.qualifyingObservationCount, nonQualifyingObservationCount: prior.nonQualifyingObservationCount, appendObservation: true, updateProjection: true, limitations: ["Data/evidence quality prevented lifecycle escalation; current temporal state was held."] };
  }
  if (qualified) {
    const qualifyingObservationCount = prior.currentLifecycleState === "FADING" ? 1 : prior.qualifyingObservationCount + 1;
    const newLifecycleState: ActivePhase8LifecycleState = prior.currentLifecycleState === "FADING"
      ? "EMERGING"
      : qualifyingObservationCount >= LIFECYCLE_GOVERNANCE.persistence.qualifyingObservationsToDevelop
        ? "DEVELOPING"
        : "EMERGING";
    const transitionReasonCode = prior.currentLifecycleState === "FADING"
      ? "REENTRY_AFTER_FADE"
      : newLifecycleState === "DEVELOPING" && prior.currentLifecycleState !== "DEVELOPING"
        ? "PERSISTENCE_REQUIREMENT_MET"
        : "CONTINUED_QUALIFICATION";
    return { lifecycleId: prior.lifecycleId, previousLifecycleState: prior.currentLifecycleState, newLifecycleState, transitionReasonCode, qualifyingObservationCount, nonQualifyingObservationCount: 0, appendObservation: true, updateProjection: true, limitations: [] };
  }
  const nonQualifyingObservationCount = prior.nonQualifyingObservationCount + 1;
  const shouldFade = prior.currentLifecycleState === "EMERGING" || nonQualifyingObservationCount >= LIFECYCLE_GOVERNANCE.persistence.consecutiveNonQualifyingObservationsToFade;
  return {
    lifecycleId: prior.lifecycleId,
    previousLifecycleState: prior.currentLifecycleState,
    newLifecycleState: shouldFade ? "FADING" : prior.currentLifecycleState,
    transitionReasonCode: shouldFade ? "NO_LONGER_QUALIFIED" : "TEMPORARY_NON_QUALIFICATION",
    qualifyingObservationCount: 0,
    nonQualifyingObservationCount,
    appendObservation: true,
    updateProjection: true,
    limitations: shouldFade ? ["FADING reflects current structured non-qualification, not invalidation, resolution, failure, or forecast outcome."] : ["One non-qualifying evaluation is within the governed grace observation and did not trigger premature fading."],
  };
}

function toObservation(evaluation: LifecycleObservationInput["evaluation"], decision: LifecycleTransitionDecision): LifecycleObservationRecord | null {
  if (!decision.appendObservation || !decision.lifecycleId || !decision.newLifecycleState) return null;
  return {
    contractVersion: LIFECYCLE_CONTRACT_VERSION,
    lifecycleObservationId: `lco:${stableId([decision.lifecycleId, evaluation.qualificationId])}`,
    lifecycleId: decision.lifecycleId,
    candidateId: evaluation.candidateId,
    qualificationEvaluationId: evaluation.qualificationId,
    originatingStateId: evaluation.originatingStateId,
    originatingSynthesisId: evaluation.originatingSynthesisId,
    effectiveAt: evaluation.evaluatedAt,
    observedAt: evaluation.evaluatedAt,
    previousLifecycleState: decision.previousLifecycleState,
    newLifecycleState: decision.newLifecycleState,
    importanceScore: evaluation.importanceScore,
    qualificationStatus: evaluation.qualificationStatus,
    evidenceStrength: evaluation.evidenceStrength,
    dataQuality: evaluation.dataQuality,
    persistenceCount: decision.qualifyingObservationCount,
    nonQualifyingCount: decision.nonQualifyingObservationCount,
    transitionReasonCode: decision.transitionReasonCode,
    transitionInputs: { qualificationStatus: evaluation.qualificationStatus, importanceScore: evaluation.importanceScore, suppressionReasons: evaluation.suppressionReasons, governance: LIFECYCLE_GOVERNANCE },
    lifecycleModelId: LIFECYCLE_MODEL_ID,
    lifecycleModelVersion: LIFECYCLE_MODEL_VERSION,
    lifecycleConfigVersion: LIFECYCLE_CONFIG_VERSION,
    limitations: [...evaluation.limitations, ...decision.limitations],
  };
}

function rowProjection(row: typeof earlyWarningLifecycles.$inferSelect): LifecycleProjection {
  return {
    lifecycleId: row.lifecycleId,
    candidateId: row.candidateId,
    currentLifecycleState: row.currentLifecycleState as ActivePhase8LifecycleState,
    openedAt: row.openedAt.toISOString(),
    latestObservationAt: row.latestObservationAt.toISOString(),
    latestQualificationEvaluationId: row.latestQualificationEvaluationId,
    qualifyingObservationCount: row.qualifyingObservationCount,
    nonQualifyingObservationCount: row.nonQualifyingObservationCount,
  };
}

export async function evaluateAndPersistLifecycle(evaluation: ImportanceQualificationEvaluation) {
  const db = await getDb();
  if (!db) return { appendedObservationCount: 0, ignoredCount: evaluation.scoredCandidates.length, unavailable: true, observations: [] as LifecycleObservationRecord[] };
  const observations: LifecycleObservationRecord[] = [];
  let ignoredCount = 0;
  for (const record of evaluation.scoredCandidates) {
    let lifecycle = (await db.select().from(earlyWarningLifecycles).where(eq(earlyWarningLifecycles.candidateId, record.candidateId)).limit(1))[0];
    const decision = decideLifecycleTransition({ evaluation: record, prior: lifecycle ? rowProjection(lifecycle) : null });
    const observation = toObservation(record, decision);
    if (!observation) { ignoredCount += 1; continue; }
    const alreadyRecorded = await db.select({ id: earlyWarningLifecycleObservations.id }).from(earlyWarningLifecycleObservations).where(eq(earlyWarningLifecycleObservations.lifecycleObservationId, observation.lifecycleObservationId)).limit(1);
    if (alreadyRecorded[0]) { ignoredCount += 1; continue; }
    if (!lifecycle) {
      try {
        await db.insert(earlyWarningLifecycles).values({
          lifecycleId: observation.lifecycleId,
          candidateId: observation.candidateId,
          originatingStateId: observation.originatingStateId,
          originatingSynthesisId: observation.originatingSynthesisId,
          openedAt: new Date(observation.effectiveAt),
          currentLifecycleState: observation.newLifecycleState,
          latestObservationAt: new Date(observation.observedAt),
          latestQualificationEvaluationId: observation.qualificationEvaluationId,
          qualifyingObservationCount: observation.persistenceCount,
          nonQualifyingObservationCount: observation.nonQualifyingCount,
          lifecycleModelId: observation.lifecycleModelId,
          lifecycleModelVersion: observation.lifecycleModelVersion,
          lifecycleConfigVersion: observation.lifecycleConfigVersion,
        });
      } catch {
        lifecycle = (await db.select().from(earlyWarningLifecycles).where(eq(earlyWarningLifecycles.candidateId, record.candidateId)).limit(1))[0];
        if (!lifecycle) throw new Error("Unable to establish deterministic lifecycle identity.");
      }
    }
    try {
      await db.insert(earlyWarningLifecycleObservations).values({
        lifecycleObservationId: observation.lifecycleObservationId,
        lifecycleId: observation.lifecycleId,
        candidateId: observation.candidateId,
        qualificationEvaluationId: observation.qualificationEvaluationId,
        originatingStateId: observation.originatingStateId,
        originatingSynthesisId: observation.originatingSynthesisId,
        effectiveAt: new Date(observation.effectiveAt),
        observedAt: new Date(observation.observedAt),
        previousLifecycleState: observation.previousLifecycleState,
        newLifecycleState: observation.newLifecycleState,
        importanceScore: observation.importanceScore,
        qualificationStatus: observation.qualificationStatus,
        evidenceStrength: observation.evidenceStrength,
        dataQuality: observation.dataQuality,
        persistenceCount: observation.persistenceCount,
        nonQualifyingCount: observation.nonQualifyingCount,
        transitionReasonCode: observation.transitionReasonCode,
        transitionInputsJson: JSON.stringify(observation.transitionInputs),
        limitationsJson: JSON.stringify(observation.limitations),
        lifecycleModelId: observation.lifecycleModelId,
        lifecycleModelVersion: observation.lifecycleModelVersion,
        lifecycleConfigVersion: observation.lifecycleConfigVersion,
      });
    } catch {
      // The unique observation identity is the database idempotency boundary.
      // A concurrent duplicate is already represented and must not alter state.
      ignoredCount += 1;
      continue;
    }
    await db.update(earlyWarningLifecycles).set({
      currentLifecycleState: observation.newLifecycleState,
      latestObservationAt: new Date(observation.observedAt),
      latestQualificationEvaluationId: observation.qualificationEvaluationId,
      qualifyingObservationCount: observation.persistenceCount,
      nonQualifyingObservationCount: observation.nonQualifyingCount,
    }).where(and(
      eq(earlyWarningLifecycles.lifecycleId, observation.lifecycleId),
      lt(earlyWarningLifecycles.latestObservationAt, new Date(observation.observedAt)),
    ));
    observations.push(observation);
  }
  return { appendedObservationCount: observations.length, ignoredCount, unavailable: false, observations };
}

export async function getLifecycleHistory(candidateId?: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(earlyWarningLifecycleObservations);
  return candidateId
    ? query.where(eq(earlyWarningLifecycleObservations.candidateId, candidateId)).orderBy(desc(earlyWarningLifecycleObservations.effectiveAt))
    : query.orderBy(desc(earlyWarningLifecycleObservations.effectiveAt));
}
