import { describe, expect, it } from "vitest";
import { evaluatePhase1BAcceptanceGate } from "./phase1bAcceptanceGate";

const complete = {
  coherentStateManifestCount: 1,
  governedClaimCount: 30,
  predictiveEligibleClaimCount: 0,
  suppressedPredictiveClaimCount: 20,
  qualifiedAnalogClaimCount: 3,
  immutableResearchObservationSchemaReady: true,
  reconstructedScoreCount: 318,
  reconstructedMissingMonthCount: 1,
  registeredDrawdownEvents: 26,
  compositeConditionsMet: 10,
  compositeConditionsMissed: 16,
  residualCriticalClaimCount: 0,
  championFormulaChanged: false,
  v3hPromoted: false,
};

describe("Phase 1B acceptance gate", () => {
  it("accepts governance remediation while explicitly retaining the Phase 2 block", () => {
    const result = evaluatePhase1BAcceptanceGate(complete);
    expect(result.status).toBe("ACCEPTED_WITH_PHASE2_BLOCK");
    expect(result.phase2Status).toBe("BLOCKED");
    expect(result.immutableEvidence).toMatchObject({ registeredDrawdownEvents: 26, compositeConditionsMet: 10, compositeConditionsMissed: 16 });
  });

  it("blocks if a claim is predictive-eligible without evidence or the frozen core changes", () => {
    expect(evaluatePhase1BAcceptanceGate({ ...complete, predictiveEligibleClaimCount: 1 }).status).toBe("BLOCKED");
    expect(evaluatePhase1BAcceptanceGate({ ...complete, championFormulaChanged: true }).status).toBe("BLOCKED");
  });
});
