import { createHash } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import {
  PHASE9_CONFIG_VERSION,
  PHASE9_CONTRACT_VERSION,
  PHASE9_GOVERNANCE,
  PHASE9_MODEL_ID,
  PHASE9_MODEL_VERSION,
  PHASE9_RULESET_VERSION,
  type ConditionEvaluation,
  type ConditionRule,
  type ConditionStatus,
  type ConfirmationInvalidationPlan,
  type CurrentDivergenceEvidence,
  type Phase9AuthorityEvent,
  type Phase9EvaluationInput,
  type PlanEvaluation,
  type WarningThesis,
} from "../shared/confirmationInvalidation";
import {
  phase9AuthorityEvents,
  phase9ConditionEvaluations,
  phase9ConfirmationPlans,
  phase9CurrentProjections,
  phase9PlanEvaluations,
  phase9WarningTheses,
} from "../drizzle/schema";
import { consumePhase9LifecycleAuthority } from "./earlyWarningLifecycle";
import { getDb } from "./db";
import type { CrossEngineSynthesis } from "../shared/crossEngineSynthesis";
import type { CandidateDetection } from "../shared/candidateDetection";
import type { ImportanceQualificationEvaluation } from "../shared/importanceQualification";
import type { LifecycleObservationRecord } from "../shared/earlyWarningLifecycle";

function stableId(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

export function buildWarningThesis(input: Phase9EvaluationInput): WarningThesis {
  const { candidate, lifecycleId } = input;
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    thesisId: `th:${stableId([lifecycleId, candidate.candidateId, "cross-engine-divergence-thesis-v1"])}`,
    lifecycleId,
    candidateId: candidate.candidateId,
    candidateType: candidate.candidateType,
    originatingStateId: candidate.originatingStateId,
    originatingSynthesisId: candidate.originatingSynthesisId,
    relationshipIds: candidate.participatingRelationships,
    participatingSignals: candidate.participatingEngines,
    direction: "DIVERGENT",
    thesisType: "CROSS_ENGINE_DIVERGENCE_THESIS",
    thesisStatementCode: "CROSS_ENGINE_DIVERGENCE_PERSISTED_ABNORMAL_RELATIONSHIP",
    supportingEvidenceClaimIds: candidate.evidenceClaimIds,
    createdAt: input.qualification.evaluatedAt,
    thesisModelId: PHASE9_MODEL_ID,
    thesisModelVersion: PHASE9_MODEL_VERSION,
    thesisConfigVersion: PHASE9_CONFIG_VERSION,
    limitations: ["Thesis authority is structural and does not assert a market outcome, probability, target, or forecast horizon."],
  };
}

function rule(conditionId: string, conditionType: ConditionRule["conditionType"], sourceMetric: ConditionRule["sourceMetric"], operator: ConditionRule["operator"], threshold: ConditionRule["threshold"], sourceRelationshipIds: string[], sourceClaimIds: string[]): ConditionRule {
  return {
    conditionId,
    conditionType,
    sourceMetric,
    sourceRelationshipIds,
    sourceClaimIds,
    operator,
    threshold,
    requiredObservations: 1,
    requiredDataQuality: "HEALTHY",
    requiredEvidenceStrength: "MODERATE",
    requiredIndependence: "INDEPENDENT",
    conditionVersion: PHASE9_RULESET_VERSION,
  };
}

export function buildConfirmationInvalidationPlan(thesis: WarningThesis): ConfirmationInvalidationPlan | null {
  if (thesis.candidateType !== "CROSS_ENGINE_DIVERGENCE") return null;
  const planId = `p9p:${stableId([thesis.thesisId, PHASE9_RULESET_VERSION, PHASE9_CONFIG_VERSION])}`;
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    planId,
    thesisId: thesis.thesisId,
    lifecycleId: thesis.lifecycleId,
    candidateId: thesis.candidateId,
    candidateType: thesis.candidateType,
    confirmationRuleSetId: "CROSS_ENGINE_DIVERGENCE_CONFIRM_V1",
    invalidationRuleSetId: "CROSS_ENGINE_DIVERGENCE_INVALIDATE_V1",
    confirmationConditions: [
      rule("confirm-magnitude-expanded", "THRESHOLD_ABOVE", "DIVERGENCE_MAGNITUDE", "GTE", PHASE9_GOVERNANCE.confirmationMagnitudeThreshold, thesis.relationshipIds, thesis.supportingEvidenceClaimIds),
      rule("confirm-divergence-persists", "PERSISTENCE_MET", "DIVERGENCE_PERSISTENCE", "EQ", "PERSISTING", thesis.relationshipIds, thesis.supportingEvidenceClaimIds),
    ],
    invalidationConditions: [
      rule("invalidate-magnitude-normalized", "THRESHOLD_BELOW", "DIVERGENCE_MAGNITUDE", "LTE", PHASE9_GOVERNANCE.invalidationNormalizationThreshold, thesis.relationshipIds, thesis.supportingEvidenceClaimIds),
      rule("invalidate-divergence-persists", "PERSISTENCE_MET", "DIVERGENCE_PERSISTENCE", "EQ", "PERSISTING", thesis.relationshipIds, thesis.supportingEvidenceClaimIds),
    ],
    minimumLifecycleState: "DEVELOPING",
    requiredDataQuality: "HEALTHY",
    requiredEvidenceStrength: "MODERATE",
    createdAt: thesis.createdAt,
    effectiveAt: thesis.createdAt,
    ruleModelVersion: PHASE9_MODEL_VERSION,
    ruleConfigVersion: PHASE9_CONFIG_VERSION,
    ruleSetVersion: PHASE9_RULESET_VERSION,
    limitations: [
      `Confirmation magnitude >= ${PHASE9_GOVERNANCE.confirmationMagnitudeThreshold} and invalidation normalization <= ${PHASE9_GOVERNANCE.invalidationNormalizationThreshold} are new engineering/governance thresholds, not statistically optimized or calibrated forecast levels.`,
      "Confirmation requires additional structural magnitude plus detector-level persistence; lifecycle persistence or importance score alone has no authority.",
    ],
  };
}

function strengthRank(value: string) {
  return ({ PRELIMINARY: 0, LIMITED: 1, MODERATE: 2, STRONG: 3 } as Record<string, number>)[value] ?? 0;
}

function gateStatus(ruleDef: ConditionRule, evidence: CurrentDivergenceEvidence | null): ConditionStatus | null {
  if (!evidence) return "UNEVALUABLE";
  if (evidence.dataQuality !== ruleDef.requiredDataQuality) return "UNEVALUABLE";
  if (strengthRank(evidence.evidenceStrength) < strengthRank(ruleDef.requiredEvidenceStrength)) return "INSUFFICIENT_EVIDENCE";
  if (evidence.evidenceIndependence !== ruleDef.requiredIndependence) return "INSUFFICIENT_EVIDENCE";
  return null;
}

export function evaluateCondition(plan: ConfirmationInvalidationPlan, thesis: WarningThesis, input: Phase9EvaluationInput, ruleDef: ConditionRule): ConditionEvaluation {
  const evidence = input.currentDivergence;
  const gated = gateStatus(ruleDef, evidence);
  let observedValue: number | string | null = null;
  let status: ConditionStatus = gated ?? "NOT_MET";
  const limitations: string[] = [];
  if (gated) {
    limitations.push("Condition did not receive sufficiently governed current structured evidence and therefore has no authority.");
  } else if (ruleDef.sourceMetric === "DIVERGENCE_MAGNITUDE") {
    observedValue = evidence?.magnitude ?? null;
    if (typeof observedValue !== "number") {
      status = "UNEVALUABLE";
      limitations.push("Current governed divergence magnitude is unavailable; unavailable data is not confirmation or invalidation evidence.");
    } else if (ruleDef.operator === "GTE") {
      status = observedValue >= Number(ruleDef.threshold) ? "MET" : "NOT_MET";
    } else if (ruleDef.operator === "LTE") {
      status = observedValue <= Number(ruleDef.threshold) ? "MET" : "NOT_MET";
    }
  } else {
    observedValue = evidence?.persistence ?? null;
    status = observedValue === ruleDef.threshold ? "MET" : "NOT_MET";
  }
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    evaluationId: `p9e:${stableId([plan.planId, ruleDef.conditionId, input.qualification.qualificationId, input.qualification.originatingStateId])}`,
    planId: plan.planId,
    thesisId: thesis.thesisId,
    lifecycleId: thesis.lifecycleId,
    candidateId: thesis.candidateId,
    conditionId: ruleDef.conditionId,
    conditionType: ruleDef.conditionType,
    originatingStateId: input.qualification.originatingStateId,
    originatingSynthesisId: input.qualification.originatingSynthesisId,
    effectiveAt: input.qualification.evaluatedAt,
    observedValue,
    requiredRule: ruleDef,
    status,
    dataQuality: evidence?.dataQuality ?? "UNAVAILABLE",
    evidenceStrength: evidence?.evidenceStrength ?? input.qualification.evidenceStrength,
    evidenceClaimIds: evidence?.evidenceClaimIds ?? [],
    evidenceIndependence: evidence?.evidenceIndependence ?? "UNKNOWN",
    ruleSetVersion: PHASE9_RULESET_VERSION,
    ruleConfigVersion: PHASE9_CONFIG_VERSION,
    limitations,
  };
}

function aggregate(statuses: ConditionStatus[]): ConditionStatus {
  if (statuses.some(item => item === "CONFLICTED")) return "CONFLICTED";
  if (statuses.some(item => item === "EVALUATION_ERROR")) return "EVALUATION_ERROR";
  if (statuses.some(item => item === "UNEVALUABLE")) return "UNEVALUABLE";
  if (statuses.some(item => item === "INSUFFICIENT_EVIDENCE")) return "INSUFFICIENT_EVIDENCE";
  return statuses.every(item => item === "MET") ? "MET" : "NOT_MET";
}

export function evaluatePlan(input: Phase9EvaluationInput, thesis: WarningThesis, plan: ConfirmationInvalidationPlan): { evaluations: ConditionEvaluation[]; planEvaluation: PlanEvaluation; event: Phase9AuthorityEvent | null } {
  const confirmation = plan.confirmationConditions.map(item => evaluateCondition(plan, thesis, input, item));
  const invalidation = plan.invalidationConditions.map(item => evaluateCondition(plan, thesis, input, item));
  const confirmationStatus = aggregate(confirmation.map(item => item.status));
  const invalidationStatus = aggregate(invalidation.map(item => item.status));
  let result: PlanEvaluation["result"] = "CONFIRMATION_PENDING";
  if (confirmationStatus === "MET" && invalidationStatus === "MET") result = "CONFLICTED_CONDITIONS";
  else if (["UNEVALUABLE", "INSUFFICIENT_EVIDENCE", "EVALUATION_ERROR"].includes(confirmationStatus) || ["UNEVALUABLE", "INSUFFICIENT_EVIDENCE", "EVALUATION_ERROR"].includes(invalidationStatus)) result = confirmationStatus === "EVALUATION_ERROR" || invalidationStatus === "EVALUATION_ERROR" ? "EVALUATION_ERROR" : "UNEVALUABLE";
  else if (confirmationStatus === "MET") result = "CONFIRMATION_MET";
  else if (invalidationStatus === "MET") result = "INVALIDATION_MET";
  else result = "CONFIRMATION_PENDING";

  const conditionEvaluationIds = [...confirmation, ...invalidation].map(item => item.evaluationId);
  const evidenceClaimIds = [...new Set([...confirmation, ...invalidation].flatMap(item => item.evidenceClaimIds))];
  const planEvaluation: PlanEvaluation = {
    planEvaluationId: `p9pe:${stableId([plan.planId, input.qualification.qualificationId, input.qualification.originatingStateId])}`,
    planId: plan.planId,
    thesisId: thesis.thesisId,
    lifecycleId: thesis.lifecycleId,
    candidateId: thesis.candidateId,
    originatingStateId: input.qualification.originatingStateId,
    originatingSynthesisId: input.qualification.originatingSynthesisId,
    effectiveAt: input.qualification.evaluatedAt,
    lifecycleState: input.lifecycleState,
    confirmationStatus,
    invalidationStatus,
    result,
    conditionEvaluationIds,
    evidenceClaimIds,
    limitations: result === "CONFLICTED_CONDITIONS" ? ["Both confirmation and invalidation condition sets were met; no authority event is emitted."] : [],
  };
  const eligibleForConfirmation = input.lifecycleState === plan.minimumLifecycleState;
  const eligibleForInvalidation = ["DEVELOPING", "FADING", "CONFIRMING"].includes(input.lifecycleState);
  let event: Phase9AuthorityEvent | null = null;
  if (result === "CONFIRMATION_MET" && eligibleForConfirmation) {
    event = authorityEvent("CONFIRMATION_AUTHORIZED", plan, thesis, planEvaluation);
  } else if (result === "INVALIDATION_MET" && eligibleForInvalidation) {
    event = authorityEvent("INVALIDATION_AUTHORIZED", plan, thesis, planEvaluation);
  } else if ((result === "CONFIRMATION_MET" || result === "INVALIDATION_MET") && !eligibleForConfirmation && !eligibleForInvalidation) {
    planEvaluation.limitations.push("Condition result was held because minimum lifecycle eligibility was not met.");
  }
  return { evaluations: [...confirmation, ...invalidation], planEvaluation, event };
}

function authorityEvent(eventType: Phase9AuthorityEvent["eventType"], plan: ConfirmationInvalidationPlan, thesis: WarningThesis, evaluation: PlanEvaluation): Phase9AuthorityEvent {
  return {
    contractVersion: PHASE9_CONTRACT_VERSION,
    phase9EventId: `p9a:${stableId([plan.planId, evaluation.originatingStateId, eventType])}`,
    planId: plan.planId,
    lifecycleId: thesis.lifecycleId,
    thesisId: thesis.thesisId,
    candidateId: thesis.candidateId,
    eventType,
    originatingStateId: evaluation.originatingStateId,
    effectiveAt: evaluation.effectiveAt,
    conditionEvaluationIds: evaluation.conditionEvaluationIds,
    evidenceClaimIds: evaluation.evidenceClaimIds,
    ruleSetVersion: PHASE9_RULESET_VERSION,
    ruleConfigVersion: PHASE9_CONFIG_VERSION,
    createdAt: evaluation.effectiveAt,
    limitations: ["Authority event changes only structured thesis support state; it creates no probability, forecast horizon, target, outcome result, or public presentation."],
  };
}

/**
 * Persists only append-only Phase 9 evidence. Unique deterministic IDs provide
 * idempotency; the current projection is a derived cache guarded against older
 * effective timestamps. No public or AI-facing behavior is created here.
 */
export async function evaluateAndPersistPhase9(input: Phase9EvaluationInput) {
  const thesis = buildWarningThesis(input);
  const plan = buildConfirmationInvalidationPlan(thesis);
  if (!plan) {
    return { thesis, plan: null, evaluations: [], planEvaluation: null, event: null, unavailable: false, reason: "NO_GOVERNED_CONFIRMATION_PLAN" as const };
  }
  const { evaluations, planEvaluation, event } = evaluatePlan(input, thesis, plan);
  const db = await getDb();
  if (!db) return { thesis, plan, evaluations, planEvaluation, event, unavailable: true };
  const effectiveAt = new Date(input.qualification.evaluatedAt);

  const existingThesis = await db.select({ id: phase9WarningTheses.id }).from(phase9WarningTheses).where(eq(phase9WarningTheses.thesisId, thesis.thesisId)).limit(1);
  if (!existingThesis[0]) {
    try {
      await db.insert(phase9WarningTheses).values({
        thesisId: thesis.thesisId, lifecycleId: thesis.lifecycleId, candidateId: thesis.candidateId, candidateType: thesis.candidateType,
        originatingStateId: thesis.originatingStateId, originatingSynthesisId: thesis.originatingSynthesisId,
        thesisType: thesis.thesisType, thesisStatementCode: thesis.thesisStatementCode,
        thesisPayloadJson: JSON.stringify(thesis), thesisModelId: thesis.thesisModelId, thesisModelVersion: thesis.thesisModelVersion,
        thesisConfigVersion: thesis.thesisConfigVersion, createdAt: new Date(thesis.createdAt),
      });
    } catch { /* concurrent identical thesis creation is already historical truth */ }
  }
  const existingPlan = await db.select({ id: phase9ConfirmationPlans.id }).from(phase9ConfirmationPlans).where(eq(phase9ConfirmationPlans.planId, plan.planId)).limit(1);
  if (!existingPlan[0]) {
    try {
      await db.insert(phase9ConfirmationPlans).values({
        planId: plan.planId, thesisId: plan.thesisId, lifecycleId: plan.lifecycleId, candidateId: plan.candidateId, candidateType: plan.candidateType,
        planPayloadJson: JSON.stringify(plan), ruleModelVersion: plan.ruleModelVersion, ruleConfigVersion: plan.ruleConfigVersion,
        ruleSetVersion: plan.ruleSetVersion, effectiveAt: new Date(plan.effectiveAt), createdAt: new Date(plan.createdAt),
      });
    } catch { /* immutable plan was concurrently created */ }
  }
  for (const condition of evaluations) {
    const existing = await db.select({ id: phase9ConditionEvaluations.id }).from(phase9ConditionEvaluations).where(eq(phase9ConditionEvaluations.evaluationId, condition.evaluationId)).limit(1);
    if (existing[0]) continue;
    try {
      await db.insert(phase9ConditionEvaluations).values({
        evaluationId: condition.evaluationId, planId: condition.planId, thesisId: condition.thesisId, lifecycleId: condition.lifecycleId,
        candidateId: condition.candidateId, conditionId: condition.conditionId, originatingStateId: condition.originatingStateId,
        originatingSynthesisId: condition.originatingSynthesisId, effectiveAt, status: condition.status,
        observedValueJson: JSON.stringify(condition.observedValue), requiredRuleJson: JSON.stringify(condition.requiredRule),
        dataQuality: condition.dataQuality, evidenceStrength: condition.evidenceStrength,
        evidenceClaimIdsJson: JSON.stringify(condition.evidenceClaimIds), evidenceIndependence: condition.evidenceIndependence,
        ruleSetVersion: condition.ruleSetVersion, ruleConfigVersion: condition.ruleConfigVersion, limitationsJson: JSON.stringify(condition.limitations),
      });
    } catch { /* deterministic unique evaluation is already persisted */ }
  }
  const existingPlanEvaluation = await db.select({ id: phase9PlanEvaluations.id }).from(phase9PlanEvaluations).where(eq(phase9PlanEvaluations.planEvaluationId, planEvaluation.planEvaluationId)).limit(1);
  if (!existingPlanEvaluation[0]) {
    try {
      await db.insert(phase9PlanEvaluations).values({
        planEvaluationId: planEvaluation.planEvaluationId, planId: planEvaluation.planId, thesisId: planEvaluation.thesisId,
        lifecycleId: planEvaluation.lifecycleId, candidateId: planEvaluation.candidateId,
        originatingStateId: planEvaluation.originatingStateId, originatingSynthesisId: planEvaluation.originatingSynthesisId,
        effectiveAt, lifecycleState: planEvaluation.lifecycleState, confirmationStatus: planEvaluation.confirmationStatus,
        invalidationStatus: planEvaluation.invalidationStatus, result: planEvaluation.result,
        conditionEvaluationIdsJson: JSON.stringify(planEvaluation.conditionEvaluationIds), evidenceClaimIdsJson: JSON.stringify(planEvaluation.evidenceClaimIds), limitationsJson: JSON.stringify(planEvaluation.limitations),
      });
    } catch { /* deterministic plan evaluation is already persisted */ }
  }
  let persistedEvent = false;
  if (event) {
    const existing = await db.select({ id: phase9AuthorityEvents.id }).from(phase9AuthorityEvents).where(eq(phase9AuthorityEvents.phase9EventId, event.phase9EventId)).limit(1);
    if (!existing[0]) {
      try {
        await db.insert(phase9AuthorityEvents).values({
          phase9EventId: event.phase9EventId, planId: event.planId, thesisId: event.thesisId, lifecycleId: event.lifecycleId,
          candidateId: event.candidateId, eventType: event.eventType, originatingStateId: event.originatingStateId,
          effectiveAt: new Date(event.effectiveAt), conditionEvaluationIdsJson: JSON.stringify(event.conditionEvaluationIds),
          evidenceClaimIdsJson: JSON.stringify(event.evidenceClaimIds), ruleSetVersion: event.ruleSetVersion, ruleConfigVersion: event.ruleConfigVersion,
          limitationsJson: JSON.stringify(event.limitations), createdAt: new Date(event.createdAt),
        });
        persistedEvent = true;
      } catch { /* concurrent deterministic authority event is already persisted */ }
    }
  }
  const projection = (await db.select().from(phase9CurrentProjections).where(eq(phase9CurrentProjections.lifecycleId, planEvaluation.lifecycleId)).limit(1))[0];
  if (!projection) {
    try {
      await db.insert(phase9CurrentProjections).values({
        lifecycleId: planEvaluation.lifecycleId, planId: planEvaluation.planId, latestPlanEvaluationId: planEvaluation.planEvaluationId,
        latestAuthorityEventId: event?.phase9EventId ?? null, latestResult: planEvaluation.result, latestEffectiveAt: effectiveAt,
      });
    } catch { /* concurrent projection created */ }
  } else if (effectiveAt.getTime() > projection.latestEffectiveAt.getTime()) {
    await db.update(phase9CurrentProjections).set({
      planId: planEvaluation.planId, latestPlanEvaluationId: planEvaluation.planEvaluationId,
      latestAuthorityEventId: event?.phase9EventId ?? projection.latestAuthorityEventId,
      latestResult: planEvaluation.result, latestEffectiveAt: effectiveAt,
    }).where(and(eq(phase9CurrentProjections.lifecycleId, planEvaluation.lifecycleId), lt(phase9CurrentProjections.latestEffectiveAt, effectiveAt)));
  }
  let lifecycleConsumption: unknown = null;
  if (event && persistedEvent) {
    lifecycleConsumption = await consumePhase9LifecycleAuthority({
      lifecycleId: event.lifecycleId, currentLifecycleState: input.lifecycleState, authorityEventId: event.phase9EventId,
      authorityEventType: event.eventType, originatingStateId: event.originatingStateId,
      originatingSynthesisId: input.qualification.originatingSynthesisId, effectiveAt: event.effectiveAt,
      qualificationEvaluationId: input.qualification.qualificationId, candidateId: input.candidate.candidateId,
      importanceScore: input.qualification.importanceScore, evidenceStrength: input.qualification.evidenceStrength,
      dataQuality: input.qualification.dataQuality, evidenceClaimIds: event.evidenceClaimIds,
    });
  }
  return { thesis, plan, evaluations, planEvaluation, event, unavailable: false, lifecycleConsumption };
}

/** Global compute-once adapter. It does not reconstruct candidates or qualify new evidence. */
export async function evaluateAndPersistPhase9ForCurrentStream(
  synthesis: CrossEngineSynthesis,
  candidates: CandidateDetection[],
  qualification: ImportanceQualificationEvaluation,
  lifecycleObservations: LifecycleObservationRecord[],
) {
  const candidateById = new Map(candidates.map(candidate => [candidate.candidateId, candidate]));
  const lifecycleByCandidateId = new Map(lifecycleObservations.map(observation => [observation.candidateId, observation]));
  const results = [] as Awaited<ReturnType<typeof evaluateAndPersistPhase9>>[];
  for (const record of qualification.qualifiedCandidates) {
    const candidate = candidateById.get(record.candidateId);
    const lifecycle = lifecycleByCandidateId.get(record.candidateId);
    if (!candidate || !lifecycle) continue;
    const divergence = synthesis.divergences.find(item => candidate.supportingDivergences.includes(item.divergenceId)) ?? null;
    results.push(await evaluateAndPersistPhase9({
      candidate,
      qualification: record,
      lifecycleId: lifecycle.lifecycleId,
      lifecycleState: lifecycle.newLifecycleState,
      currentDivergence: divergence ? {
        divergenceId: divergence.divergenceId,
        magnitude: divergence.magnitude,
        persistence: divergence.persistence,
        dataQuality: divergence.dataQuality,
        evidenceStrength: divergence.dataQuality === "HEALTHY" ? synthesis.evidenceStrength : "PRELIMINARY",
        evidenceIndependence: divergence.evidenceIndependence,
        evidenceClaimIds: divergence.supportingClaimIds,
      } : null,
    }));
  }
  return { evaluatedCount: results.length, authorityEventCount: results.filter(result => result.event != null).length, results };
}
