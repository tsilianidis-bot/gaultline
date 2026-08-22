import { describe, expect, it } from "vitest";
import {
  buildConfirmationInvalidationPlan,
  buildWarningThesis,
  evaluatePlan,
} from "./confirmationInvalidation";
import { PHASE9_GOVERNANCE } from "../shared/confirmationInvalidation";
import type { Phase9EvaluationInput } from "../shared/confirmationInvalidation";

function input(overrides: Partial<Phase9EvaluationInput> = {}): Phase9EvaluationInput {
  const candidate = {
    contractVersion: "phase6-candidate-detection-v1" as const, candidateId: "cd:1", candidateType: "CROSS_ENGINE_DIVERGENCE" as const,
    title: "A / B DIVERGENCE", originatingStateId: "state-1", originatingSynthesisId: "syn-1", effectiveAt: "2026-08-22T00:00:00.000Z",
    firstObservedAt: "2026-08-20T00:00:00.000Z", latestObservedAt: "2026-08-22T00:00:00.000Z", participatingEngines: ["a", "b"],
    participatingRelationships: ["rel-1"], supportingDivergences: ["div-1"], evidenceClaimIds: ["claim-1"], relevantArchiveEventIds: [],
    magnitude: 12, acceleration: null, persistence: "PERSISTING" as const, dataConfidence: "HIGH" as const, dataFreshness: "FRESH" as const,
    dataQuality: "HEALTHY" as const, evidenceStrength: "MODERATE" as const, hasBlockingConflict: false, limitations: [],
    detectorId: "cross-engine-divergence" as const, detectorVersion: "1.0.0" as const, detectorConfigVersion: "phase6r-candidate-v1" as const,
    provenance: { canonicalStateSchemaVersion: "phase2-canonical-state-v1", synthesisContractVersion: "phase5-cross-engine-synthesis-v1", deterministic: true as const },
  };
  const qualification = {
    contractVersion: "phase7-importance-qualification-v1" as const, qualificationId: "iq:1", candidateId: candidate.candidateId,
    originatingStateId: "state-1", originatingSynthesisId: "syn-1", evaluatedAt: "2026-08-22T00:00:00.000Z", importanceScore: 82,
    factors: [], qualificationStatus: "QUALIFIED" as const, qualificationReasons: ["material"], suppressionReasons: [],
    evidenceClaimIds: ["claim-1"], relationshipIds: ["rel-1"], evidenceStrength: "MODERATE" as const, dataQuality: "HEALTHY" as const,
    scoringModelId: "faultline-candidate-materiality" as const, scoringModelVersion: "1.0.0" as const, scoringConfigVersion: "phase7-governance-v1" as const,
    relationshipFamily: "CROSS_ENGINE_DIVERGENCE", rank: 1, isPrimary: true, limitations: [],
  };
  return {
    candidate, qualification, lifecycleId: "lc:1", lifecycleState: "DEVELOPING",
    currentDivergence: { divergenceId: "div-1", magnitude: 16, persistence: "PERSISTING", dataQuality: "HEALTHY", evidenceStrength: "MODERATE", evidenceIndependence: "INDEPENDENT", evidenceClaimIds: ["claim-1"] },
    ...overrides,
  };
}

function run(overrides: Partial<Phase9EvaluationInput> = {}) {
  const value = input(overrides);
  const thesis = buildWarningThesis(value);
  const plan = buildConfirmationInvalidationPlan(thesis);
  if (!plan) throw new Error("expected governed plan");
  return evaluatePlan(value, thesis, plan);
}

describe("Phase 9 confirmation and invalidation engine", () => {
  it("creates a deterministic machine-readable thesis and versioned plan", () => {
    const value = input();
    const thesis = buildWarningThesis(value);
    const plan = buildConfirmationInvalidationPlan(thesis);
    expect(thesis.thesisStatementCode).toBe("CROSS_ENGINE_DIVERGENCE_PERSISTED_ABNORMAL_RELATIONSHIP");
    expect(plan?.ruleSetVersion).toBe("cross-engine-divergence-rules-v1");
  });
  it("authorizes confirmation only for a developing lifecycle with expanded persisted independent evidence", () => {
    const result = run();
    expect(result.planEvaluation.result).toBe("CONFIRMATION_MET");
    expect(result.event?.eventType).toBe("CONFIRMATION_AUTHORIZED");
  });
  it("does not authorize confirmation from lifecycle persistence alone", () => {
    const result = run({ currentDivergence: { ...input().currentDivergence!, magnitude: 14 } });
    expect(result.event).toBeNull();
  });
  it("does not authorize confirmation from importance alone", () => {
    const value = input();
    value.qualification.importanceScore = 100;
    value.currentDivergence = { ...value.currentDivergence!, magnitude: 14 };
    const thesis = buildWarningThesis(value); const plan = buildConfirmationInvalidationPlan(thesis)!;
    expect(evaluatePlan(value, thesis, plan).event).toBeNull();
  });
  it("authorizes invalidation only through a persisted normalized divergence condition", () => {
    const result = run({ currentDivergence: { ...input().currentDivergence!, magnitude: 4 }, lifecycleState: "FADING" });
    expect(result.planEvaluation.result).toBe("INVALIDATION_MET");
    expect(result.event?.eventType).toBe("INVALIDATION_AUTHORIZED");
  });
  it("does not invalidate merely because a lifecycle is fading", () => {
    const result = run({ currentDivergence: { ...input().currentDivergence!, magnitude: 10 }, lifecycleState: "FADING" });
    expect(result.event).toBeNull();
  });
  it("holds authority when current magnitude is unavailable", () => {
    const result = run({ currentDivergence: { ...input().currentDivergence!, magnitude: null } });
    expect(result.planEvaluation.result).toBe("UNEVALUABLE");
    expect(result.event).toBeNull();
  });
  it("holds authority on stale/degraded quality", () => {
    const result = run({ currentDivergence: { ...input().currentDivergence!, dataQuality: "DEGRADED" } });
    expect(result.planEvaluation.result).toBe("UNEVALUABLE");
  });
  it("holds authority for overlapping or unknown evidence", () => {
    const result = run({ currentDivergence: { ...input().currentDivergence!, evidenceIndependence: "HIGHLY_OVERLAPPING" } });
    expect(result.planEvaluation.result).toBe("UNEVALUABLE");
  });
  it("holds confirmation in emerging state despite satisfied conditions", () => {
    const result = run({ lifecycleState: "EMERGING" });
    expect(result.planEvaluation.result).toBe("CONFIRMATION_MET");
    expect(result.event).toBeNull();
  });
  it("produces deterministic evaluation and event identities for identical inputs", () => {
    const first = run(); const second = run();
    expect(first.planEvaluation.planEvaluationId).toBe(second.planEvaluation.planEvaluationId);
    expect(first.event?.phase9EventId).toBe(second.event?.phase9EventId);
  });
  it("keeps thresholds explicitly governed and non-calibrated", () => {
    expect(PHASE9_GOVERNANCE.thresholdLabel).toContain("NOT_STATISTICALLY_CALIBRATED");
    expect(PHASE9_GOVERNANCE.confirmationMagnitudeThreshold).toBeGreaterThan(PHASE9_GOVERNANCE.invalidationNormalizationThreshold);
  });
  it("creates no probability, forecast, target, or outcome semantics", () => {
    const result = run();
    expect(Object.keys(result.event ?? {})).not.toContain("probability");
    expect(Object.keys(result.event ?? {})).not.toContain("forecastHorizon");
    expect(Object.keys(result.event ?? {})).not.toContain("target");
    expect(Object.keys(result.event ?? {})).not.toContain("outcome");
  });
});
