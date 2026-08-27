import { createHash } from "node:crypto";
import { desc, eq, ne } from "drizzle-orm";
import {
  candidateDetections,
  earlyWarningLifecycleObservations,
  earlyWarningLifecycles,
  importanceQualificationEvaluations,
  phase9AuthorityEvents,
  phase9ConfirmationPlans,
  phase9CurrentProjections,
  phase9PlanEvaluations,
  phase9WarningTheses,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { getAuthoritativeCrossEngineSynthesis } from "./crossEngineSynthesis";
import {
  PHASE10_PRESENTATION_CONTRACT_VERSION,
  type ConfirmationPresentationStatus,
  type EarlyWarningPresentation,
  type GovernedEvaluationUnavailablePresentation,
  type GovernedEarlyWarningPresentation,
  type InvalidationPresentationStatus,
  type NoMaterialEarlyWarningPresentation,
  type PresentationConfidence,
  type PresentationFreshness,
} from "../shared/earlyWarningPresentation";

function stableId(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}
function asArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
}
function safeObject(value: string | null | undefined): Record<string, unknown> {
  try { return value ? JSON.parse(value) as Record<string, unknown> : {}; } catch { return {}; }
}
function freshnessFor(quality: string | null | undefined): PresentationFreshness {
  return quality === "HEALTHY" ? "CURRENT" : quality === "UNAVAILABLE" ? "UNAVAILABLE" : "STALE";
}
function confidenceFor(quality: string | null | undefined): PresentationConfidence {
  return quality === "HEALTHY" ? "HIGH" : quality === "DEGRADED" ? "MODERATE" : quality ? "LOW" : "UNAVAILABLE";
}
function statusFor(planResult: string | null | undefined, confirmation: string | null | undefined): ConfirmationPresentationStatus {
  if (!planResult) return "NO_GOVERNED_CONFIRMATION_PLAN";
  if (planResult === "CONFLICTED_CONDITIONS") return "CONFLICTED_CONDITIONS";
  if (confirmation === "MET") return "AUTHORIZED";
  if (["UNEVALUABLE", "INSUFFICIENT_EVIDENCE", "EVALUATION_ERROR"].includes(confirmation ?? "")) return "UNEVALUABLE";
  return "NOT_YET_CONFIRMED";
}
function invalidationFor(planResult: string | null | undefined, invalidation: string | null | undefined): InvalidationPresentationStatus {
  if (!planResult) return "NO_GOVERNED_INVALIDATION_PLAN";
  if (planResult === "CONFLICTED_CONDITIONS") return "CONFLICTED_CONDITIONS";
  if (invalidation === "MET") return "AUTHORIZED";
  if (["UNEVALUABLE", "INSUFFICIENT_EVIDENCE", "EVALUATION_ERROR"].includes(invalidation ?? "")) return "UNEVALUABLE";
  return "NOT_TRIGGERED";
}

/**
 * Compute once, distribute many. This service only reads Phase 5–9 ledgers;
 * it never calls candidate, scoring, lifecycle, or Phase 9 evaluation code.
 */
export async function getCurrentGovernedEarlyWarningPresentation(): Promise<GovernedEarlyWarningPresentation> {
  const db = await getDb();
  const generatedAt = new Date().toISOString();
  if (!db) return unavailable(null, null, "GOVERNED_LEDGER_UNAVAILABLE", generatedAt);
  const canonicalState = await getAuthoritativeCanonicalIntelligenceState();
  if (!canonicalState) return unavailable(null, null, "CANONICAL_STATE_UNAVAILABLE", generatedAt);
  const synthesis = await getAuthoritativeCrossEngineSynthesis();
  if (!synthesis) return unavailable(canonicalState.stateId, null, "SYNTHESIS_UNAVAILABLE", generatedAt);
  if (synthesis.originatingStateId !== canonicalState.stateId) {
    return unavailable(canonicalState.stateId, synthesis.synthesisId, "SYNTHESIS_STATE_MISMATCH", generatedAt);
  }
  const lifecycle = (await db.select().from(earlyWarningLifecycles)
    .where(ne(earlyWarningLifecycles.currentLifecycleState, "INVALIDATED"))
    .orderBy(desc(earlyWarningLifecycles.latestObservationAt)).limit(1))[0];
  if (!lifecycle) return noMaterial(canonicalState.stateId, synthesis.synthesisId, "CURRENT", generatedAt);
  const [candidate, qualification, observation, thesis, projection] = await Promise.all([
    db.select().from(candidateDetections).where(eq(candidateDetections.candidateId, lifecycle.candidateId)).limit(1),
    db.select().from(importanceQualificationEvaluations).where(eq(importanceQualificationEvaluations.evaluationId, lifecycle.latestQualificationEvaluationId)).limit(1),
    db.select().from(earlyWarningLifecycleObservations).where(eq(earlyWarningLifecycleObservations.lifecycleId, lifecycle.lifecycleId)).orderBy(desc(earlyWarningLifecycleObservations.effectiveAt)).limit(1),
    db.select().from(phase9WarningTheses).where(eq(phase9WarningTheses.lifecycleId, lifecycle.lifecycleId)).limit(1),
    db.select().from(phase9CurrentProjections).where(eq(phase9CurrentProjections.lifecycleId, lifecycle.lifecycleId)).limit(1),
  ]);
  if (!candidate[0] || !qualification[0] || !observation[0]) {
    return unavailable(lifecycle.originatingStateId, lifecycle.originatingSynthesisId, "GOVERNED_LEDGER_UNAVAILABLE", generatedAt);
  }
  const plan = projection[0] ? (await db.select().from(phase9ConfirmationPlans).where(eq(phase9ConfirmationPlans.planId, projection[0].planId)).limit(1))[0] : null;
  const planEvaluation = projection[0] ? (await db.select().from(phase9PlanEvaluations).where(eq(phase9PlanEvaluations.planEvaluationId, projection[0].latestPlanEvaluationId)).limit(1))[0] : null;
  const events = await db.select().from(phase9AuthorityEvents).where(eq(phase9AuthorityEvents.lifecycleId, lifecycle.lifecycleId)).orderBy(desc(phase9AuthorityEvents.effectiveAt));
  const confirmationEvent = events.find(event => event.eventType === "CONFIRMATION_AUTHORIZED") ?? null;
  const invalidationEvent = events.find(event => event.eventType === "INVALIDATION_AUTHORIZED") ?? null;
  const candidatePayload = safeObject(candidate[0].originalPayloadJson);
  const thesisPayload = safeObject(thesis[0]?.thesisPayloadJson);
  const planPayload = safeObject(plan?.planPayloadJson);
  const confirmationRules = Array.isArray(planPayload.confirmationConditions) ? planPayload.confirmationConditions as Array<Record<string, unknown>> : [];
  const invalidationRules = Array.isArray(planPayload.invalidationConditions) ? planPayload.invalidationConditions as Array<Record<string, unknown>> : [];
  const quality = observation[0].dataQuality;
  const score = qualification[0].importanceScore;
  const first = lifecycle.openedAt;
  const latest = lifecycle.latestObservationAt;
  const durationDays = Math.max(0, Math.floor((latest.getTime() - first.getTime()) / 86_400_000));
  const eventSuffix = projection[0]?.latestPlanEvaluationId ?? lifecycle.latestQualificationEvaluationId;
  const warningId = `ew:${lifecycle.lifecycleId}`;
  const presentationId = `p10:${stableId([warningId, lifecycle.currentLifecycleState, eventSuffix, PHASE10_PRESENTATION_CONTRACT_VERSION])}`;
  const claimRefs = asArray(qualification[0].evidenceClaimIdsJson);
  const relationships = asArray(qualification[0].relationshipIdsJson);
  const qualityFreshness = freshnessFor(quality);
  const confirmationStatus = statusFor(planEvaluation?.result, planEvaluation?.confirmationStatus);
  const invalidationStatus = invalidationFor(planEvaluation?.result, planEvaluation?.invalidationStatus);
  const title = candidate[0].title;
  const thesisCode = typeof thesisPayload.thesisStatementCode === "string" ? thesisPayload.thesisStatementCode : "CROSS_ENGINE_DIVERGENCE_PERSISTED_ABNORMAL_RELATIONSHIP";
  const thesisStatement = "Governed cross-engine evidence records a persistent divergence relationship. This is a structural statement, not a forecast.";
  const active: EarlyWarningPresentation = {
    contractVersion: PHASE10_PRESENTATION_CONTRACT_VERSION,
    kind: "ACTIVE_GOVERNED_WARNING",
    presentationId, warningId, candidateId: candidate[0].candidateId, qualificationId: qualification[0].evaluationId,
    lifecycleEpisodeId: lifecycle.lifecycleId, lifecycleState: lifecycle.currentLifecycleState,
    lifecycleStateChangedAt: observation[0].effectiveAt.toISOString(), synthesisId: lifecycle.originatingSynthesisId,
    stateId: lifecycle.originatingStateId, warningType: candidate[0].candidateType,
    thesis: { code: thesisCode, statement: thesisStatement }, conciseTitle: title,
    conciseSummary: "A governed cross-engine divergence remains under structured observation. Presentation does not alter the underlying lifecycle, score, or authority.",
    warningScore: score, scoreSemantics: "Prioritization score, not probability.",
    firstObservedAt: first.toISOString(), latestObservedAt: latest.toISOString(), durationDays,
    trend: lifecycle.currentLifecycleState === "FADING" ? "WEAKENING" : lifecycle.currentLifecycleState === "INVALIDATED" ? "INVALIDATED" : lifecycle.currentLifecycleState === "DEVELOPING" || lifecycle.currentLifecycleState === "CONFIRMING" ? "STRENGTHENING" : "STABLE",
    dataConfidence: confidenceFor(quality), canonicalQuality: quality, supportingEvidence: relationships,
    participatingEngines: Array.isArray(candidatePayload.participatingEngines) ? candidatePayload.participatingEngines as string[] : [],
    supportingClaimRefs: claimRefs, confirmationStatus,
    confirmationConditions: confirmationRules.map(rule => String(rule.conditionId ?? "governed-confirmation-condition")),
    confirmationEvidence: planEvaluation ? asArray(planEvaluation.evidenceClaimIdsJson) : [], confirmationAuthorityEventId: confirmationEvent?.phase9EventId ?? null,
    invalidationStatus, invalidationConditions: invalidationRules.map(rule => String(rule.conditionId ?? "governed-invalidation-condition")),
    invalidationEvidence: planEvaluation ? asArray(planEvaluation.evidenceClaimIdsJson) : [], invalidationAuthorityEventId: invalidationEvent?.phase9EventId ?? null,
    limitations: [
      "Early Warning Score is a prioritization score, not probability.",
      "Confirmation is governed structural support, not a forecast.",
      "Invalidation is not an opposite forecast.",
      "Historical and analog context are not presented unless separately authorized.",
    ],
    historicalContext: { status: "UNAVAILABLE", label: "HISTORICAL CONTEXT NOT PRESENTED" }, analogContext: { status: "UNAVAILABLE", label: "ANALOG CONTEXT NOT PRESENTED" },
    freshness: qualityFreshness, observedAt: observation[0].observedAt.toISOString(), effectiveAt: observation[0].effectiveAt.toISOString(), generatedAt,
    provenance: { presentationId, warningId, candidateId: candidate[0].candidateId, qualificationId: qualification[0].evaluationId, lifecycleEpisodeId: lifecycle.lifecycleId, synthesisId: lifecycle.originatingSynthesisId, stateId: lifecycle.originatingStateId, thesisId: thesis[0]?.thesisId ?? null, planId: plan?.planId ?? null, latestPlanEvaluationId: planEvaluation?.planEvaluationId ?? null, confirmationAuthorityEventId: confirmationEvent?.phase9EventId ?? null, invalidationAuthorityEventId: invalidationEvent?.phase9EventId ?? null, supportingClaimRefs: claimRefs, presentationContractVersion: PHASE10_PRESENTATION_CONTRACT_VERSION },
    presentationGeneratedAt: generatedAt, presentationContractVersion: PHASE10_PRESENTATION_CONTRACT_VERSION,
  };
	  return active;
}

export type GovernedEarlyWarningTimelineEntry = {
  timelineEntryId: string;
  lifecycleId: string;
  lifecycleState: string;
  reasonCode: string;
  effectiveAt: string;
  recordedAt: string;
  dataQuality: string;
  provenance: { stateId: string; synthesisId: string; qualificationId: string };
};

/** Read-only lifecycle history for the current governed presentation. */
export async function getCurrentGovernedEarlyWarningTimeline(limit = 48): Promise<GovernedEarlyWarningTimelineEntry[]> {
  const presentation = await getCurrentGovernedEarlyWarningPresentation();
  if (presentation.kind !== "ACTIVE_GOVERNED_WARNING") return [];
  const db = await getDb();
  if (!db) return [];
  const observations = await db.select().from(earlyWarningLifecycleObservations)
    .where(eq(earlyWarningLifecycleObservations.lifecycleId, presentation.lifecycleEpisodeId))
    .orderBy(desc(earlyWarningLifecycleObservations.effectiveAt)).limit(Math.max(1, Math.min(limit, 96)));
  return observations.map(observation => ({
    timelineEntryId: `p10tl:${observation.lifecycleObservationId}`,
    lifecycleId: observation.lifecycleId,
    lifecycleState: observation.newLifecycleState,
    reasonCode: observation.transitionReasonCode,
    effectiveAt: observation.effectiveAt.toISOString(),
    recordedAt: observation.recordedAt.toISOString(),
    dataQuality: observation.dataQuality,
    provenance: {
      stateId: observation.originatingStateId,
      synthesisId: observation.originatingSynthesisId,
      qualificationId: observation.qualificationEvaluationId,
    },
  }));
}

export function buildEarlyWarningPresentationPromptContract(presentation: GovernedEarlyWarningPresentation): string {
  const payload = JSON.stringify(presentation);
  if (presentation.kind === "GOVERNED_EVALUATION_UNAVAILABLE") {
    return [
      "PHASE 10 GOVERNED EARLY WARNING PRESENTATION (READ ONLY):",
      payload,
      "State only that the governed Early Warning evaluation is unavailable. Do not imply that no warning exists, markets are safe, markets are bullish, or downside risk is absent.",
    ].join("\n");
  }
  return [
    "PHASE 10 GOVERNED EARLY WARNING PRESENTATION (READ ONLY):",
    payload,
    "Use this object verbatim for any early-warning statement. Do not calculate, score, rank, qualify, transition, confirm, invalidate, forecast, or infer another warning.",
    "If kind is NO_MATERIAL_EARLY_WARNING, state only that governed qualification requirements are not currently met; do not imply safety, bullishness, or absence of downside risk.",
    "Early Warning Score is a prioritization score, not probability. Confirmation and invalidation language is allowed only when the supplied authorization status says AUTHORIZED.",
  ].join("\n");
}

export function createSocialReadyWarningPost(presentation: GovernedEarlyWarningPresentation): {
  kind: "GOVERNED_WARNING_SOCIAL_READY" | "NO_MATERIAL_EARLY_WARNING_SOCIAL_READY";
  presentationId: string;
  text: string;
  provenanceLabel: string;
} {
  if (presentation.kind === "GOVERNED_EVALUATION_UNAVAILABLE") {
    return {
      kind: "NO_MATERIAL_EARLY_WARNING_SOCIAL_READY",
      presentationId: presentation.presentationId,
      text: "FAULTLINE EARLY WARNING INTELLIGENCE: The governed current evaluation is temporarily unavailable. This is not a statement that no warning exists or that markets are safe.",
      provenanceLabel: `Governed evaluation unavailable: ${presentation.reason}`,
    };
  }
  if (presentation.kind === "NO_MATERIAL_EARLY_WARNING") {
    return {
      kind: "NO_MATERIAL_EARLY_WARNING_SOCIAL_READY",
      presentationId: presentation.presentationId,
      text: "FAULTLINE EARLY WARNING INTELLIGENCE: No material early warning currently meets governed qualification requirements. This does not mean markets are safe, bullish, or without downside risk.",
      provenanceLabel: `Governed presentation ${presentation.presentationId}`,
    };
  }
  return {
    kind: "GOVERNED_WARNING_SOCIAL_READY",
    presentationId: presentation.presentationId,
    text: `FAULTLINE EARLY WARNING INTELLIGENCE: ${presentation.conciseTitle}. State: ${presentation.lifecycleState}. ${presentation.conciseSummary} Early Warning Score is a prioritization score, not probability.`,
    provenanceLabel: `Governed presentation ${presentation.presentationId} · state ${presentation.stateId}`,
  };
}

export function buildNoMaterialEarlyWarningPresentation(stateId: string, synthesisId: string, freshness: Extract<PresentationFreshness, "CURRENT" | "STALE">, generatedAt: string): NoMaterialEarlyWarningPresentation {
  return { contractVersion: PHASE10_PRESENTATION_CONTRACT_VERSION, kind: "NO_MATERIAL_EARLY_WARNING", presentationId: `p10:none:${stableId([stateId, synthesisId, generatedAt.slice(0, 13)])}`, stateId, synthesisId, message: "Current governed cross-engine evidence does not meet FAULTLINE’s qualification requirements for a material developing warning.", limitations: ["This does not mean markets are safe, bullish, or without downside risk."], freshness, generatedAt, presentationContractVersion: PHASE10_PRESENTATION_CONTRACT_VERSION };
}

export function buildGovernedEvaluationUnavailablePresentation(stateId: string | null, synthesisId: string | null, reason: GovernedEvaluationUnavailablePresentation["reason"], generatedAt: string): GovernedEvaluationUnavailablePresentation {
  return { contractVersion: PHASE10_PRESENTATION_CONTRACT_VERSION, kind: "GOVERNED_EVALUATION_UNAVAILABLE", presentationId: `p10:unavailable:${stableId([stateId, synthesisId, reason, generatedAt.slice(0, 13)])}`, stateId, synthesisId, reason, message: "FAULTLINE could not complete the governed Early Warning evaluation for the current market state.", limitations: ["No conclusion about the absence of a warning, market safety, bullishness, or downside risk is authorized."], freshness: "UNAVAILABLE", generatedAt, presentationContractVersion: PHASE10_PRESENTATION_CONTRACT_VERSION };
}

function noMaterial(stateId: string, synthesisId: string, freshness: Extract<PresentationFreshness, "CURRENT" | "STALE">, generatedAt: string): NoMaterialEarlyWarningPresentation {
  return buildNoMaterialEarlyWarningPresentation(stateId, synthesisId, freshness, generatedAt);
}

function unavailable(stateId: string | null, synthesisId: string | null, reason: GovernedEvaluationUnavailablePresentation["reason"], generatedAt: string): GovernedEvaluationUnavailablePresentation {
  return buildGovernedEvaluationUnavailablePresentation(stateId, synthesisId, reason, generatedAt);
}
