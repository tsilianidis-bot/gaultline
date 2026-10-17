import type { IntelligenceEvidenceSnapshot } from "../../shared/intelligenceEvidence";
import {
  recordVerifiedInstitutionalEvent,
  type InstitutionalSeverity,
  type VerifiedInstitutionalEvent,
} from "../institutionalMemory";
import { isIntelligenceCoreLedgerEnabled } from "./config";

const ASSESSMENT_VERSION = "intelligence-core-assessment-v1-2026-10-16" as const;

type AssessmentReason = "initial_verified_snapshot" | "domain_support_changed" | "canonical_state_changed";

export interface MaterialIntelligenceAssessment {
  event: VerifiedInstitutionalEvent;
  reason: AssessmentReason;
}

function statusSignature(snapshot: IntelligenceEvidenceSnapshot) {
  return snapshot.domains
    .map(domain => `${domain.id}:${domain.status}:${domain.currentObservationIds.slice().sort().join(",")}`)
    .sort()
    .join("|");
}

function newestObservedAt(snapshot: IntelligenceEvidenceSnapshot): Date | null {
  const times = snapshot.observations
    .filter(item => item.supportsCurrentClaim && item.observedAt)
    .map(item => Date.parse(item.observedAt as string))
    .filter(Number.isFinite);
  if (!times.length) return null;
  return new Date(Math.max(...times));
}

function severityForSnapshot(snapshot: IntelligenceEvidenceSnapshot): InstitutionalSeverity {
  const unavailable = snapshot.domains.filter(domain => domain.status === "unavailable").length;
  const degraded = snapshot.domains.filter(domain => domain.status === "degraded").length;
  if (unavailable >= 3) return "moderate";
  if (unavailable || degraded) return "low";
  return "info";
}

function reasonForSnapshot(current: IntelligenceEvidenceSnapshot, previous: IntelligenceEvidenceSnapshot | null): AssessmentReason | null {
  if (!previous) return "initial_verified_snapshot";
  if (current.canonicalStateId !== previous.canonicalStateId) return "canonical_state_changed";
  if (statusSignature(current) !== statusSignature(previous)) return "domain_support_changed";
  return null;
}

function sourceState(snapshot: IntelligenceEvidenceSnapshot) {
  return {
    methodVersion: snapshot.methodVersion,
    capturedAt: snapshot.capturedAt,
    canonicalStateId: snapshot.canonicalStateId,
    canonicalState: snapshot.canonicalState,
    domains: snapshot.domains.map(domain => ({
      id: domain.id,
      label: domain.label,
      status: domain.status,
      currentObservationIds: domain.currentObservationIds,
      historicalObservationIds: domain.historicalObservationIds,
      limitation: domain.limitation,
    })),
    observations: snapshot.observations.map(observation => ({
      id: observation.id,
      label: observation.label,
      provider: observation.provider,
      sourceIdentifier: observation.sourceIdentifier,
      observedAt: observation.observedAt,
      receivedAt: observation.receivedAt,
      value: observation.value,
      unit: observation.unit,
      validationStatus: observation.validationStatus,
      supportsCurrentClaim: observation.supportsCurrentClaim,
      temporalStatus: observation.temporalStatus,
      validationReason: observation.validationReason,
      modelVersion: observation.modelVersion,
    })),
    providerHealth: snapshot.providerHealth,
    limitations: snapshot.limitations,
  };
}

/**
 * Produces a ledger event only for an initial verified assessment or a material
 * change in source support/canonical state. It deliberately creates no causal,
 * predictive, confidence, or transmission claim.
 */
export function deriveMaterialIntelligenceAssessment(
  current: IntelligenceEvidenceSnapshot,
  previous: IntelligenceEvidenceSnapshot | null,
): MaterialIntelligenceAssessment | null {
  const reason = reasonForSnapshot(current, previous);
  if (!reason) return null;

  const currentSignature = statusSignature(current);
  const previousSignature = previous ? statusSignature(previous) : "none";
  const reasonLabel = reason === "initial_verified_snapshot"
    ? "Initial verified Intelligence Core evidence snapshot"
    : reason === "canonical_state_changed"
      ? "Canonical MarketState identifier changed"
      : "Six-domain source support changed";
  const observedAt = newestObservedAt(current);
  const currentState = sourceState(current);
  const previousState = previous ? sourceState(previous) : null;
  const eventKey = `intelligence-core-assessment:${ASSESSMENT_VERSION}:${current.canonicalStateId ?? "no-canonical"}:${currentSignature}`.slice(0, 240);

  return {
    reason,
    event: {
      eventKey,
      eventType: "intelligence_core_assessment",
      sourceEngine: "intelligence_evidence_core",
      entityType: "market",
      entityId: current.canonicalStateId,
      assetClass: "multi_asset",
      severity: severityForSnapshot(current),
      direction: "neutral",
      eventAt: new Date(current.capturedAt),
      sourceObservedAt: observedAt,
      dataFreshness: current.domains.every(domain => domain.status === "healthy") ? "current" : "degraded",
      pressureIndex: current.canonicalState?.pressureIndex ?? null,
      marketRegime: current.canonicalState?.regime ?? null,
      headline: reasonLabel,
      explanation: "An append-only evidence assessment records source availability and original observations. It does not assert a causal relationship, predictive scenario, investment recommendation, or statistically validated performance result.",
      previousState: previousState ? { assessmentVersion: ASSESSMENT_VERSION, signature: previousSignature, sourceState: previousState } : null,
      newState: {
        assessmentVersion: ASSESSMENT_VERSION,
        reason,
        signature: currentSignature,
        sourceState: currentState,
        interpretation: "No causal, predictive, or individualized-action interpretation is asserted by this record.",
        scenario: "No scenario is asserted by the verified evidence record.",
        confirmationConditions: ["A subsequent verified snapshot must retain source timestamps and pass the Integrity Gate."],
        invalidationConditions: ["A source becoming stale, unavailable, invalid, or superseded by a later verified observation invalidates its current-use eligibility."],
      },
      supportingState: currentState,
    },
  };
}

/**
 * Production writes remain off unless the dedicated ledger flag is enabled.
 * The existing institutional-event unique key preserves the immutable original
 * assessment and prevents duplicate records.
 */
export async function recordMaterialIntelligenceAssessment(
  current: IntelligenceEvidenceSnapshot,
  previous: IntelligenceEvidenceSnapshot | null,
  enabled = isIntelligenceCoreLedgerEnabled(),
) {
  if (!enabled) return { status: "disabled" as const, id: null, created: false };
  const assessment = deriveMaterialIntelligenceAssessment(current, previous);
  if (!assessment) return { status: "not_material" as const, id: null, created: false };
  const result = await recordVerifiedInstitutionalEvent(assessment.event);
  return { status: "recorded" as const, reason: assessment.reason, ...result };
}
