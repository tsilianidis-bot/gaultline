import { describe, expect, it } from "vitest";
import { CURRENT_REDESIGN_EVIDENCE, evaluateRedesignReadiness } from "./redesignEvaluation";

describe("Champion redesign readiness", () => {
  it("blocks interactions, calibration, and challenger promotion when the audited baseline prerequisites are absent", () => {
    const result = evaluateRedesignReadiness(CURRENT_REDESIGN_EVIDENCE);
    expect(result.status).toBe("BLOCKED");
    expect(result.missingGates).toContain("champion_reproducibility");
    expect(result.missingGates).toContain("point_in_time_data");
    expect(result.missingGates).toContain("outcome_ledger");
    expect(result.interactionCandidates.every(candidate => candidate.status === "blocked_pending_data")).toBe(true);
  });

  it("permits only shadow eligibility when every pre-registered gate is independently satisfied", () => {
    const result = evaluateRedesignReadiness({
      championReproducible: true,
      pointInTimeDataAvailable: true,
      independentOutcomesAvailable: true,
      lockedWalkForwardAvailable: true,
      calibrationSampleAdequate: true,
      ablationSampleAdequate: true,
      stabilitySampleAdequate: true,
      explainabilityContractComplete: true,
    });
    expect(result.status).toBe("ELIGIBLE_FOR_SHADOW");
  });
});
