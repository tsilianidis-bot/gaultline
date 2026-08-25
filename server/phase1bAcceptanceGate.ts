export interface Phase1BAcceptanceInput {
  coherentStateManifestCount: number;
  governedClaimCount: number;
  predictiveEligibleClaimCount: number;
  suppressedPredictiveClaimCount: number;
  qualifiedAnalogClaimCount: number;
  immutableResearchObservationSchemaReady: boolean;
  reconstructedScoreCount: number;
  reconstructedMissingMonthCount: number;
  registeredDrawdownEvents: number;
  compositeConditionsMet: number;
  compositeConditionsMissed: number;
  residualCriticalClaimCount: number;
  championFormulaChanged: boolean;
  v3hPromoted: boolean;
}

export interface Phase1BAcceptanceResult {
  status: "ACCEPTED_WITH_PHASE2_BLOCK" | "BLOCKED";
  checks: Array<{ id: string; passed: boolean; detail: string }>;
  immutableEvidence: {
    reconstructedScoreCount: number;
    reconstructedMissingMonthCount: number;
    registeredDrawdownEvents: number;
    compositeConditionsMet: number;
    compositeConditionsMissed: number;
  };
  phase2Status: "BLOCKED";
}

export function evaluatePhase1BAcceptanceGate(input: Phase1BAcceptanceInput): Phase1BAcceptanceResult {
  const checks = [
    { id: "coherent-atomic-state", passed: input.coherentStateManifestCount > 0, detail: input.coherentStateManifestCount > 0 ? "At least one append-only coherent atomic state manifest exists." : "No coherent state manifest exists." },
    { id: "governed-claims", passed: input.governedClaimCount > 0 && input.predictiveEligibleClaimCount === 0 && input.suppressedPredictiveClaimCount > 0, detail: "Probability-like values must be governed and have no predictive-eligible claim absent calibration evidence." },
    { id: "analog-qualification", passed: input.qualifiedAnalogClaimCount > 0, detail: "Analog similarity is preserved only with qualification, not as outcome probability." },
    { id: "immutable-observation-resolution-ledger", passed: input.immutableResearchObservationSchemaReady, detail: "Original observations and later resolutions have separate append-only ledgers." },
    { id: "historical-record-preserved", passed: input.reconstructedScoreCount === 318 && input.reconstructedMissingMonthCount === 1 && input.registeredDrawdownEvents === 26 && input.compositeConditionsMet === 10 && input.compositeConditionsMissed === 16, detail: "The locked reconstructed research record remains 318 scores, one explicit missing month, and 26/10/16 event findings." },
    { id: "critical-claim-containment", passed: input.residualCriticalClaimCount === 0, detail: "No critical unqualified probability, historical-warning, or analog-outcome claim remains in the audited shared surfaces." },
    { id: "frozen-core-preserved", passed: !input.championFormulaChanged && !input.v3hPromoted, detail: "Champion V1 remains frozen and V3-H remains shadow-only." },
  ];
  return {
    status: checks.every(check => check.passed) ? "ACCEPTED_WITH_PHASE2_BLOCK" : "BLOCKED",
    checks,
    immutableEvidence: {
      reconstructedScoreCount: input.reconstructedScoreCount,
      reconstructedMissingMonthCount: input.reconstructedMissingMonthCount,
      registeredDrawdownEvents: input.registeredDrawdownEvents,
      compositeConditionsMet: input.compositeConditionsMet,
      compositeConditionsMissed: input.compositeConditionsMissed,
    },
    phase2Status: "BLOCKED",
  };
}
