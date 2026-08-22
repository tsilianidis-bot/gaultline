import { describe, expect, it } from "vitest";
import type { CandidateDetection } from "../shared/candidateDetection";
import { IMPORTANCE_SCORING_CONFIG } from "../shared/importanceQualification";
import { evaluateImportanceQualification, factorTraces } from "./importanceQualification";

function candidate(overrides: Partial<CandidateDetection> = {}): CandidateDetection {
  return {
    contractVersion: "phase6-candidate-detection-v1",
    candidateId: "cd:alpha",
    candidateType: "CROSS_ENGINE_DIVERGENCE",
    title: "CREDIT / LIQUIDITY DIVERGENCE",
    originatingStateId: "state-a",
    originatingSynthesisId: "synthesis-a",
    effectiveAt: "2026-08-22T00:00:00.000Z",
    firstObservedAt: "2026-08-21T00:00:00.000Z",
    latestObservedAt: "2026-08-22T00:00:00.000Z",
    participatingEngines: ["credit", "liquidity"],
    participatingRelationships: ["relationship-a"],
    supportingDivergences: ["divergence-a"],
    evidenceClaimIds: ["claim-a"],
    relevantArchiveEventIds: [],
    magnitude: 100,
    acceleration: 100,
    persistence: "PERSISTING",
    dataConfidence: "HIGH",
    dataFreshness: "FRESH",
    dataQuality: "VERIFIED",
    evidenceStrength: "STRONG",
    hasBlockingConflict: false,
    limitations: [],
    detectorId: "cross-engine-divergence",
    detectorVersion: "1.0.0",
    detectorConfigVersion: "phase6r-candidate-v1",
    provenance: { canonicalStateSchemaVersion: "phase2-canonical-state-v1", synthesisContractVersion: "phase5-cross-engine-synthesis-v1", deterministic: true },
    ...overrides,
  };
}

function context(overrides: Partial<ReturnType<typeof baseContext>> = {}) {
  return { ...baseContext(), ...overrides };
}

function baseContext() {
  return {
    candidate: candidate(),
    priorCandidateObservationCount: 0,
    historicalLead: { availability: "UNAVAILABLE" as const, value: null, provenance: null },
    blockingConflict: false,
  };
}

describe("Phase 7 importance scoring and qualification", () => {
  it("uses one centralized, versioned 0–100 importance model whose weights sum to 100", () => {
    expect(Object.values(IMPORTANCE_SCORING_CONFIG.factorWeights).reduce((total, weight) => total + weight, 0)).toBe(100);
    expect(IMPORTANCE_SCORING_CONFIG.scoreRange.meaning).toBe("IMPORTANCE_MATERIALITY_NOT_PROBABILITY");
  });

  it("is deterministic for the same candidate, state, factor inputs, and config", () => {
    const first = evaluateImportanceQualification([context()]);
    const second = evaluateImportanceQualification([context()]);
    expect(first.scoredCandidates[0]).toEqual(second.scoredCandidates[0]);
  });

  it("keeps all eight factor meanings separate and leaves unavailable history explicit", () => {
    const traces = factorTraces(context());
    expect(traces.map(item => item.factor)).toEqual(["magnitude", "acceleration", "persistence", "historicalLeadStrength", "crossEngineConfirmation", "systemicImportance", "novelty", "dataConfidence"]);
    expect(traces.find(item => item.factor === "historicalLeadStrength")).toMatchObject({ availability: "UNAVAILABLE", normalizedValue: null, contribution: null });
  });

  it("qualifies a strong independent, fresh, persistent, macro-systemic candidate without treating its score as probability", () => {
    const evaluation = evaluateImportanceQualification([context()]);
    expect(evaluation.primaryQualifiedWarning).toMatchObject({ qualificationStatus: "QUALIFIED", isPrimary: true, rank: 1 });
    expect(evaluation.primaryQualifiedWarning).not.toHaveProperty("probability");
    expect(evaluation.primaryQualifiedWarning).not.toHaveProperty("forecastHorizon");
  });

  it("suppresses huge magnitude when participating data is stale", () => {
    const evaluation = evaluateImportanceQualification([context({ candidate: candidate({ dataFreshness: "STALE", magnitude: 100 }) })]);
    expect(evaluation.scoredCandidates[0].qualificationStatus).toBe("SUPPRESSED");
  });

  it("does not qualify tiny magnitude solely because data quality is high", () => {
    const evaluation = evaluateImportanceQualification([context({ candidate: candidate({ magnitude: 1, acceleration: 0 }) })]);
    expect(evaluation.noMaterialEarlyWarning).toBe(true);
  });

  it("does not gain high importance from unavailable historical support or analog-like context", () => {
    const result = evaluateImportanceQualification([context({ candidate: candidate({ magnitude: 20, acceleration: 10 }) })]);
    expect(result.scoredCandidates[0].factors.find(item => item.factor === "historicalLeadStrength")?.contribution).toBeNull();
  });

  it("limits an isolated candidate's structural support and systemic contribution", () => {
    const result = evaluateImportanceQualification([context({ candidate: candidate({ participatingEngines: ["volatility"], magnitude: 100, acceleration: 100 }) })]);
    expect(result.scoredCandidates[0].qualificationStatus).not.toBe("QUALIFIED");
  });

  it("blocks qualification when supplied structured conflict exists despite a high score", () => {
    const result = evaluateImportanceQualification([context({ candidate: candidate({ hasBlockingConflict: true }), blockingConflict: true })]);
    expect(result.scoredCandidates[0].qualificationStatus).toBe("SUPPRESSED");
  });

  it("returns NO_MATERIAL_EARLY_WARNING when all candidates are below threshold", () => {
    const result = evaluateImportanceQualification([context({ candidate: candidate({ magnitude: 0, acceleration: 0 }) })]);
    expect(result.noMaterialEarlyWarning).toBe(true);
    expect(result.qualifiedCandidates).toHaveLength(0);
  });

  it("deduplicates related candidate families before qualification-slot selection", () => {
    const first = context({ candidate: candidate({ candidateId: "cd:first" }) });
    const second = context({ candidate: candidate({ candidateId: "cd:second", magnitude: 95 }) });
    const result = evaluateImportanceQualification([first, second]);
    expect(result.qualifiedCandidates).toHaveLength(1);
  });

  it("uses candidate ID as the final deterministic tie-breaker", () => {
    const a = context({ candidate: candidate({ candidateId: "cd:a" }) });
    const b = context({ candidate: candidate({ candidateId: "cd:b" }) });
    const result = evaluateImportanceQualification([b, a]);
    expect(result.primaryQualifiedWarning?.candidateId).toBe("cd:a");
  });

  it("reduces novelty for repeated unchanged candidate observations without lifecycle semantics", () => {
    const newTrace = factorTraces(context()).find(item => item.factor === "novelty")!;
    const repeatedTrace = factorTraces(context({ priorCandidateObservationCount: 8 })).find(item => item.factor === "novelty")!;
    expect(repeatedTrace.contribution!).toBeLessThan(newTrace.contribution!);
  });

  it("is monotonic for governed magnitude, acceleration, persistence, and data confidence", () => {
    const low = factorTraces(context({ candidate: candidate({ magnitude: 20, acceleration: 20, persistence: "NEW", dataConfidence: "MODERATE" }) }));
    const high = factorTraces(context({ candidate: candidate({ magnitude: 80, acceleration: 80, persistence: "PERSISTING", dataConfidence: "HIGH" }) }));
    ["magnitude", "acceleration", "persistence", "dataConfidence"].forEach(name => {
      const lowValue = low.find(item => item.factor === name)?.contribution ?? 0;
      const highValue = high.find(item => item.factor === name)?.contribution ?? 0;
      expect(highValue).toBeGreaterThanOrEqual(lowValue);
    });
  });

  it("fails safely for malformed numeric values without manufacturing a top qualification", () => {
    const result = evaluateImportanceQualification([context({ candidate: candidate({ magnitude: Number.NaN, acceleration: Number.POSITIVE_INFINITY }) })]);
    expect(Number.isFinite(result.scoredCandidates[0].importanceScore)).toBe(true);
    expect(result.scoredCandidates[0].qualificationStatus).not.toBe("QUALIFIED");
  });
});
