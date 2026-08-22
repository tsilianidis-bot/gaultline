import { createHash } from "node:crypto";
import type { CrossEngineDivergence, CrossEngineSynthesis } from "../shared/crossEngineSynthesis";
import {
  EARLY_WARNING_CONTRACT_VERSION,
  type EarlyWarningCandidate,
  type EarlyWarningDataConfidence,
  type EarlyWarningEvaluation,
  type EarlyWarningLifecycleState,
  type EarlyWarningScoreComponents,
} from "../shared/earlyWarningIntelligence";
import { earlyWarningObservations, earlyWarnings } from "../drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { recordVerifiedInstitutionalEvent, type InstitutionalSeverity } from "./institutionalMemory";
import { getAuthoritativeCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "./canonicalIntelligenceState";

export const MAX_MATERIAL_EARLY_WARNINGS = 3;
export const EARLY_WARNING_QUALIFICATION_SCORE = 70;

export type PriorEarlyWarning = Pick<EarlyWarningCandidate, "warningId" | "compositeWarningScore" | "lifecycleState">;
type GovernedMarketContext = EarlyWarningCandidate["marketContext"];

function stableId(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

function titleFor(divergence: CrossEngineDivergence) {
  return `${divergence.participatingEngines.join(" / ").toUpperCase()} DIVERGENCE`;
}

function confidenceFor(synthesis: CrossEngineSynthesis, divergence: CrossEngineDivergence): EarlyWarningDataConfidence {
  if (synthesis.dataQuality === "UNAVAILABLE" || divergence.evidenceIndependence === "UNKNOWN") return "INSUFFICIENT";
  if (synthesis.staleEngines.some(engine => divergence.participatingEngines.includes(engine))) return "LOW";
  if (synthesis.degradedEngines.some(engine => divergence.participatingEngines.includes(engine))) return "MODERATE";
  return divergence.evidenceIndependence === "INDEPENDENT" ? "HIGH" : "MODERATE";
}

/**
 * Phase 6 scores are deterministic prioritization dimensions only. They are
 * intentionally not calibrated probabilities, targets, or expected returns.
 */
function scoreFor(synthesis: CrossEngineSynthesis, divergence: CrossEngineDivergence, dataConfidence: EarlyWarningDataConfidence): EarlyWarningScoreComponents {
  const eligibleConfirmation = synthesis.confirmations.some(item => item.participatingEngines.every(engine => divergence.participatingEngines.includes(engine)) && item.independenceAssessment === "INDEPENDENT");
  return {
    magnitude: divergence.magnitude == null ? 0 : Math.min(15, Math.max(0, Math.round(divergence.magnitude))),
    acceleration: divergence.acceleration == null ? 0 : Math.min(10, Math.max(0, Math.round(divergence.acceleration))),
    persistence: divergence.persistence === "PERSISTING" ? 25 : 5,
    historicalLeadStrength: 0,
    crossEngineConfirmation: eligibleConfirmation ? 15 : 0,
    systemicImportance: divergence.participatingEngines.length >= 2 ? 25 : 0,
    novelty: divergence.persistence === "NEW" ? 20 : 5,
    dataConfidence: dataConfidence === "HIGH" ? 20 : dataConfidence === "MODERATE" ? 10 : 0,
  };
}

function scoreTotal(components: EarlyWarningScoreComponents) {
  return Object.values(components).reduce((total, value) => total + value, 0);
}

function lifecycleFor(qualified: boolean, score: number, divergence: CrossEngineDivergence, prior: PriorEarlyWarning | undefined, confirmation: "NONE" | "LIMITED" | "GOVERNED"): EarlyWarningLifecycleState | null {
  if (!qualified) return prior?.lifecycleState === "ELEVATED" || prior?.lifecycleState === "DEVELOPING" || prior?.lifecycleState === "CONFIRMING" || prior?.lifecycleState === "EMERGING" ? "FADING" : null;
  if (!prior) return "EMERGING";
  if (score < prior.compositeWarningScore) return "FADING";
  if (confirmation === "GOVERNED" && score >= 85) return "CONFIRMING";
  if (score >= 90 && divergence.persistence === "PERSISTING") return "ELEVATED";
  if (divergence.persistence === "PERSISTING" && score > prior.compositeWarningScore) return "DEVELOPING";
  return prior.lifecycleState ?? "EMERGING";
}

function candidateFor(synthesis: CrossEngineSynthesis, divergence: CrossEngineDivergence, priorWarnings: Map<string, PriorEarlyWarning>, marketContext: GovernedMarketContext): EarlyWarningCandidate {
  const warningId = `ew:${stableId(["CROSS_ENGINE_DIVERGENCE", divergence.participatingEngines.slice().sort()])}`;
  const candidateId = `ewc:${stableId([synthesis.synthesisId, divergence.divergenceId])}`;
  const dataConfidence = confidenceFor(synthesis, divergence);
  const scoreComponents = scoreFor(synthesis, divergence, dataConfidence);
  const compositeWarningScore = scoreTotal(scoreComponents);
  const governedConfirmation = synthesis.confirmations.some(item => item.participatingEngines.every(engine => divergence.participatingEngines.includes(engine)) && item.independenceAssessment === "INDEPENDENT");
  const crossEngineConfirmation = governedConfirmation ? "GOVERNED" : divergence.evidenceIndependence === "INDEPENDENT" ? "LIMITED" : "NONE" as const;
  const acceptedFreshness = !synthesis.staleEngines.some(engine => divergence.participatingEngines.includes(engine));
  const independent = divergence.evidenceIndependence === "INDEPENDENT";
  const sufficientMagnitude = divergence.magnitude != null && divergence.magnitude >= 10;
  const qualified = independent && acceptedFreshness && dataConfidence !== "INSUFFICIENT" && sufficientMagnitude && divergence.persistence === "PERSISTING" && compositeWarningScore >= EARLY_WARNING_QUALIFICATION_SCORE;
  const prior = priorWarnings.get(warningId);
  return {
    contractVersion: EARLY_WARNING_CONTRACT_VERSION,
    candidateId,
    warningId,
    candidateType: "CROSS_ENGINE_DIVERGENCE",
    title: titleFor(divergence),
    originatingSynthesisId: synthesis.synthesisId,
    originatingStateId: synthesis.originatingStateId,
    effectiveAt: synthesis.originatingEffectiveAt,
    firstObservedAt: divergence.firstObservedAt,
    latestObservedAt: divergence.latestObservedAt,
    participatingEngines: divergence.participatingEngines,
    participatingRelationships: synthesis.relationships.filter(item => item.participatingEngines.join("|") === divergence.participatingEngines.join("|")).map(item => item.relationshipId),
    supportingDivergences: [divergence.divergenceId],
    supportingConfirmations: governedConfirmation ? synthesis.confirmations.filter(item => item.participatingEngines.every(engine => divergence.participatingEngines.includes(engine))).map(item => item.confirmationId) : [],
    magnitude: divergence.magnitude,
    acceleration: divergence.acceleration,
    persistence: divergence.persistence,
    historicalLeadStrength: null,
    crossEngineConfirmation,
    systemicImportance: divergence.participatingEngines.length >= 2 ? "MATERIAL" : "LIMITED",
    novelty: divergence.persistence,
    dataConfidence,
    dataFreshness: synthesis.staleEngines.some(engine => divergence.participatingEngines.includes(engine)) ? "STALE" : synthesis.degradedEngines.some(engine => divergence.participatingEngines.includes(engine)) ? "DEGRADED" : dataConfidence === "INSUFFICIENT" ? "UNAVAILABLE" : "FRESH",
    marketContext,
    scoreComponents,
    compositeWarningScore,
    qualificationState: qualified ? "QUALIFIED" : dataConfidence === "INSUFFICIENT" ? "INSUFFICIENT_EVIDENCE" : "NOT_QUALIFIED",
    lifecycleState: lifecycleFor(qualified, compositeWarningScore, divergence, prior, crossEngineConfirmation),
    evidenceClaimIds: divergence.supportingClaimIds,
    relevantArchiveEventIds: [],
    dataQuality: synthesis.dataQuality,
    evidenceStrength: synthesis.evidenceStrength,
    limitations: [
      ...divergence.limitations,
      ...(divergence.persistence === "NEW" ? ["New divergence has not yet met the governed persistence requirement for a user-facing warning."] : []),
      ...(dataConfidence === "INSUFFICIENT" ? ["Insufficient current evidence quality; no warning is qualified."] : []),
      ...(!sufficientMagnitude ? ["No governed divergence magnitude is available at the required qualification level; this candidate is withheld."] : []),
      "Early Warning Score is a governed prioritization score, not an outcome probability or forecast.",
    ],
    confirmationConditions: ["Additional sufficiently independent governed evidence aligns with this divergence.", "The relationship persists with acceptable freshness and evidence quality."],
    invalidationConditions: ["The governed divergence is no longer present in the canonical synthesis.", "Participating evidence becomes stale, unavailable, or insufficient for current interpretation."],
    provenance: {
      canonicalStateSchemaVersion: synthesis.provenance.canonicalStateSchemaVersion,
      synthesisContractVersion: synthesis.contractVersion,
      deterministic: true,
      scoreMeaning: "PRIORITIZATION_ONLY_NOT_OUTCOME_PROBABILITY",
    },
  };
}

export function evaluateEarlyWarnings(synthesis: CrossEngineSynthesis, prior: PriorEarlyWarning[] = [], marketContext: GovernedMarketContext = null): EarlyWarningEvaluation {
  const priorWarnings = new Map(prior.map(item => [item.warningId, item]));
  const candidates = synthesis.divergences.map(divergence => candidateFor(synthesis, divergence, priorWarnings, marketContext));
  const qualifiedWarnings = candidates
    .filter(candidate => candidate.qualificationState === "QUALIFIED" && candidate.lifecycleState !== "FADING")
    .sort((a, b) => b.compositeWarningScore - a.compositeWarningScore || a.warningId.localeCompare(b.warningId))
    .slice(0, MAX_MATERIAL_EARLY_WARNINGS);
  return {
    originatingSynthesisId: synthesis.synthesisId,
    originatingStateId: synthesis.originatingStateId,
    effectiveAt: synthesis.originatingEffectiveAt,
    candidates,
    qualifiedWarnings,
    noMaterialEarlyWarning: qualifiedWarnings.length === 0,
    limitations: synthesis.limitations,
  };
}

/** Provides only structured Phase 6 warning facts to narrative consumers. */
export function buildEarlyWarningPromptContract(evaluation: EarlyWarningEvaluation | null): string {
  if (!evaluation) return [
    "GOVERNED EARLY WARNING INTELLIGENCE: unavailable.",
    "Do not invent, infer, promote, or label an Early Warning from raw metrics, individual engines, or unsupplied synthesis relationships.",
  ].join("\n");
  return [
    "GOVERNED EARLY WARNING INTELLIGENCE (STRUCTURED FACTS ONLY):",
    `Canonical State ID: ${evaluation.originatingStateId}`,
    `Synthesis ID: ${evaluation.originatingSynthesisId}`,
    `Material warning count: ${evaluation.qualifiedWarnings.length}`,
    `Warnings: ${evaluation.qualifiedWarnings.map(item => `${item.warningId} | ${item.title} | ${item.lifecycleState} | priority ${item.compositeWarningScore}/100`).join(" || ") || "NO MATERIAL EARLY WARNING"}`,
    "An Early Warning Score is prioritization only, not probability, target, forecast, or expected return.",
    "You may describe only supplied qualified warnings. When no qualified warning is supplied, say NO MATERIAL EARLY WARNING rather than constructing one.",
  ].join("\n");
}

function severityFor(score: number): InstitutionalSeverity {
  if (score >= 90) return "critical";
  if (score >= 85) return "high";
  if (score >= 75) return "moderate";
  return "low";
}

function observationType(candidate: EarlyWarningCandidate, previousLifecycle?: string | null) {
  if (!previousLifecycle) return "warning_detected";
  if (candidate.lifecycleState === "INVALIDATED") return "warning_invalidated";
  if (candidate.lifecycleState === "FADING") return "warning_fading";
  if (candidate.lifecycleState !== previousLifecycle) return `warning_${candidate.lifecycleState.toLowerCase()}`;
  return "warning_observation";
}

function candidatePayload(candidate: EarlyWarningCandidate) {
  return {
    candidateId: candidate.candidateId,
    warningId: candidate.warningId,
    originatingStateId: candidate.originatingStateId,
    originatingSynthesisId: candidate.originatingSynthesisId,
    score: candidate.compositeWarningScore,
    lifecycleState: candidate.lifecycleState,
    qualificationState: candidate.qualificationState,
    participatingEngines: candidate.participatingEngines,
    supportingDivergences: candidate.supportingDivergences,
    supportingConfirmations: candidate.supportingConfirmations,
    evidenceClaimIds: candidate.evidenceClaimIds,
    scoreComponents: candidate.scoreComponents,
    dataFreshness: candidate.dataFreshness,
    marketContext: candidate.marketContext,
    limitations: candidate.limitations,
    provenance: candidate.provenance,
    historyClass: "live_verified" as const,
  };
}

export async function getPersistedEarlyWarnings(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(earlyWarnings);
  const rows = activeOnly
    ? await query.where(eq(earlyWarnings.isActive, true)).orderBy(desc(earlyWarnings.currentScore))
    : await query.orderBy(desc(earlyWarnings.updatedAt));
  return rows;
}

export async function getEarlyWarningTimeline(warningId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(earlyWarningObservations)
    .where(eq(earlyWarningObservations.warningId, warningId))
    .orderBy(earlyWarningObservations.observedAt);
}

/**
 * Evaluates one state-locked Phase 5 synthesis and persists only real governed
 * warnings. Originals remain immutable while every later observation is append-only.
 */
export async function evaluateAndPersistEarlyWarnings(synthesis: CrossEngineSynthesis) {
  const db = await getDb();
  const authoritativeState = await getAuthoritativeCanonicalIntelligenceState();
  const publicState = authoritativeState ? toPublicCanonicalIntelligenceState(authoritativeState) : null;
  const marketContext: GovernedMarketContext = publicState?.stateId === synthesis.originatingStateId ? {
    pressureIndex: publicState.pressureIndex,
    regime: publicState.regime,
    pressureLevel: publicState.pressureLevel,
  } : null;
  if (!db) return { evaluation: evaluateEarlyWarnings(synthesis, [], marketContext), createdWarningCount: 0, appendedObservationCount: 0, unavailable: true };
  const existing = await db.select().from(earlyWarnings);
  const prior = existing.map(item => ({ warningId: item.warningId, compositeWarningScore: item.currentScore, lifecycleState: item.currentLifecycleState as EarlyWarningLifecycleState }));
  const evaluation = evaluateEarlyWarnings(synthesis, prior, marketContext);
  const byWarningId = new Map(existing.map(item => [item.warningId, item]));
  const currentCandidateIds = new Set(evaluation.candidates.map(item => item.warningId));
  let createdWarningCount = 0;
  let appendedObservationCount = 0;

  for (const candidate of evaluation.candidates) {
    const priorWarning = byWarningId.get(candidate.warningId);
    if (!priorWarning && candidate.qualificationState !== "QUALIFIED") continue;
    const lifecycleState = candidate.lifecycleState ?? "EMERGING";
    const active = candidate.qualificationState === "QUALIFIED" && lifecycleState !== "FADING" && lifecycleState !== "INVALIDATED";
    const payload = candidatePayload({ ...candidate, lifecycleState });
    const eventAt = new Date(candidate.effectiveAt);
    if (!priorWarning) {
      await db.insert(earlyWarnings).values({
        warningId: candidate.warningId,
        candidateType: candidate.candidateType,
        title: candidate.title,
        originalStateId: candidate.originatingStateId,
        originalSynthesisId: candidate.originatingSynthesisId,
        originalEffectiveAt: eventAt,
        originalScore: candidate.compositeWarningScore,
        originalLifecycleState: lifecycleState,
        originalPayloadJson: JSON.stringify(payload),
        currentStateId: candidate.originatingStateId,
        currentSynthesisId: candidate.originatingSynthesisId,
        currentScore: candidate.compositeWarningScore,
        currentLifecycleState: lifecycleState,
        currentQualificationState: candidate.qualificationState,
        isActive: active,
      });
      createdWarningCount += 1;
    } else {
      await db.update(earlyWarnings).set({
        currentStateId: candidate.originatingStateId,
        currentSynthesisId: candidate.originatingSynthesisId,
        currentScore: candidate.compositeWarningScore,
        currentLifecycleState: lifecycleState,
        currentQualificationState: candidate.qualificationState,
        isActive: active,
      }).where(eq(earlyWarnings.id, priorWarning.id));
    }
    const type = observationType({ ...candidate, lifecycleState }, priorWarning?.currentLifecycleState);
    const observationKey = `early_warning:${candidate.warningId}:${candidate.originatingSynthesisId}:${type}`;
    const alreadyRecorded = await db.select({ id: earlyWarningObservations.id }).from(earlyWarningObservations).where(eq(earlyWarningObservations.observationKey, observationKey)).limit(1);
    if (!alreadyRecorded[0]) {
      await db.insert(earlyWarningObservations).values({
        observationKey,
        warningId: candidate.warningId,
        originatingStateId: candidate.originatingStateId,
        originatingSynthesisId: candidate.originatingSynthesisId,
        observedAt: eventAt,
        observationType: type,
        lifecycleState,
        qualificationState: candidate.qualificationState,
        warningScore: candidate.compositeWarningScore,
        observationPayloadJson: JSON.stringify(payload),
        provenanceJson: JSON.stringify(candidate.provenance),
      });
      appendedObservationCount += 1;
      await recordVerifiedInstitutionalEvent({
        eventKey: observationKey,
        eventType: type,
        sourceEngine: "early_warning_intelligence",
        entityType: "market_warning",
        entityId: candidate.warningId,
        severity: severityFor(candidate.compositeWarningScore),
        direction: "deteriorating",
        eventAt,
        sourceObservedAt: eventAt,
        dataFreshness: candidate.dataQuality,
        headline: `${candidate.title}: ${lifecycleState}`,
        explanation: "A live, state-locked Early Warning Intelligence observation generated from governed Phase 5 synthesis. The score is prioritization only, not an outcome probability.",
        previousState: priorWarning ? { stateId: priorWarning.currentStateId, synthesisId: priorWarning.currentSynthesisId, score: priorWarning.currentScore, lifecycleState: priorWarning.currentLifecycleState } : null,
        newState: payload,
        supportingState: { participatingEngines: candidate.participatingEngines, supportingDivergences: candidate.supportingDivergences, supportingConfirmations: candidate.supportingConfirmations, supportingClaimIds: candidate.evidenceClaimIds },
      });
    }
  }

  // A previously active warning whose governed relationship is absent is not
  // silently deleted; it receives an immutable invalidation observation.
  for (const priorWarning of existing.filter(item => item.isActive && !currentCandidateIds.has(item.warningId))) {
    const observationKey = `early_warning:${priorWarning.warningId}:${synthesis.synthesisId}:warning_invalidated`;
    const alreadyRecorded = await db.select({ id: earlyWarningObservations.id }).from(earlyWarningObservations).where(eq(earlyWarningObservations.observationKey, observationKey)).limit(1);
    if (alreadyRecorded[0]) continue;
    const invalidatedAt = new Date(synthesis.originatingEffectiveAt);
    const payload = { warningId: priorWarning.warningId, originatingStateId: synthesis.originatingStateId, originatingSynthesisId: synthesis.synthesisId, lifecycleState: "INVALIDATED", reason: "The governed Phase 5 divergence is no longer present in the current state-locked synthesis.", historyClass: "live_verified" as const };
    await db.update(earlyWarnings).set({
      currentStateId: synthesis.originatingStateId,
      currentSynthesisId: synthesis.synthesisId,
      currentLifecycleState: "INVALIDATED",
      currentQualificationState: "NOT_QUALIFIED",
      isActive: false,
    }).where(eq(earlyWarnings.id, priorWarning.id));
    await db.insert(earlyWarningObservations).values({
      observationKey,
      warningId: priorWarning.warningId,
      originatingStateId: synthesis.originatingStateId,
      originatingSynthesisId: synthesis.synthesisId,
      observedAt: invalidatedAt,
      observationType: "warning_invalidated",
      lifecycleState: "INVALIDATED",
      qualificationState: "NOT_QUALIFIED",
      warningScore: priorWarning.currentScore,
      observationPayloadJson: JSON.stringify(payload),
      provenanceJson: JSON.stringify({ canonicalStateSchemaVersion: synthesis.provenance.canonicalStateSchemaVersion, synthesisContractVersion: synthesis.contractVersion, deterministic: true }),
    });
    appendedObservationCount += 1;
    await recordVerifiedInstitutionalEvent({
      eventKey: observationKey,
      eventType: "warning_invalidated",
      sourceEngine: "early_warning_intelligence",
      entityType: "market_warning",
      entityId: priorWarning.warningId,
      severity: "info",
      direction: "neutral",
      eventAt: invalidatedAt,
      sourceObservedAt: invalidatedAt,
      dataFreshness: synthesis.dataQuality,
      headline: `Early Warning invalidated: ${priorWarning.title}`,
      explanation: "The previously active governed relationship is absent from the current state-locked Phase 5 synthesis. The original warning remains preserved without hindsight edits.",
      previousState: { stateId: priorWarning.currentStateId, synthesisId: priorWarning.currentSynthesisId, lifecycleState: priorWarning.currentLifecycleState },
      newState: payload,
      supportingState: { originatingSynthesisId: synthesis.synthesisId, supportingClaimIds: synthesis.supportingClaimIds },
    });
  }

  return { evaluation, createdWarningCount, appendedObservationCount, unavailable: false };
}
