import { describe, expect, it } from "vitest";
import { createEvidencePacket, type EvidenceClaim } from "../shared/evidenceContract";
import { assertSameInterpretationState, buildInterpretationPromptContract, createInterpretationTransaction, validateInterpretationOutput } from "../shared/interpretationIntegrity";

const effectiveAt = "2026-08-22T12:00:00.000Z";
const canonical = { stateId: "phase4-adversarial-state", effectiveAt };

function packet(qualityStatus = "HEALTHY") {
  const observed: EvidenceClaim = {
    claimId: `${canonical.stateId}:observed:macro`, evidenceClass: "OBSERVED", statement: "Macro reading is 44.", value: 44, unit: "score_0_to_100",
    canonical, sourceIds: [canonical.stateId], sourceType: "MANIFEST", sourceTimestamp: effectiveAt,
    qualityStatus, evidenceStrength: qualityStatus === "HEALTHY" ? "MODERATE" : "PRELIMINARY", limitations: qualityStatus === "HEALTHY" ? [] : ["Input is degraded."], createdAt: effectiveAt, effectiveAt, forecastAuthorized: false,
  };
  return createEvidencePacket(canonical, [observed], effectiveAt);
}

function transaction(qualityStatus = "HEALTHY") {
  return createInterpretationTransaction("ASHA", packet(qualityStatus), "model:test", effectiveAt);
}

describe("Phase 4 adversarial ASHA / Oracle evidence integrity", () => {
  it("withholds a Macro 44 / Composite 18 six-week target without an authorized forecast", () => {
    const result = validateInterpretationOutput({ reply: "Composite will reach 44.", expectedTimeframe: "6 weeks", finalVerdictProbability: 70 }, transaction());
    expect(result.normalizedOutput).toMatchObject({ expectedTimeframe: null, finalVerdictProbability: null });
  });

  it("rejects analog similarity as crash probability", () => {
    const result = validateInterpretationOutput({ reply: "A 93% analog match means a 93% crash chance.", bullProbability: 93 }, transaction());
    expect(result.status).toBe("CORRECTED");
    expect(result.normalizedOutput.bullProbability).toBeNull();
  });

  it("rejects historical continuation frequency as current probability", () => {
    const result = validateInterpretationOutput({ reply: "Historical continuation is a 62% current bull probability.", bearProbability: 38 }, transaction());
    expect(result.normalizedOutput.bearProbability).toBeNull();
  });

  it("withholds unsupported system-wide deterioration from a single engine observation", () => {
    const result = validateInterpretationOutput({ reply: "Macro deterioration means the entire system is confirmed deteriorating." }, transaction());
    expect(result.status).toBe("WITHHELD");
  });

  it("withholds invented confirmation and invalidation thresholds", () => {
    const result = validateInterpretationOutput({ reply: "Answer.", confirmationConditions: ["Confirm above 100"], invalidationConditions: ["Invalidate below 90"] }, transaction());
    expect(result.normalizedOutput).toMatchObject({
      confirmationConditions: ["No governed confirmation condition is currently defined."],
      invalidationConditions: ["No governed invalidation condition is currently defined."],
    });
  });

  it("withholds unsupported timing and quantitative probability when directly requested", () => {
    const result = validateInterpretationOutput({ reply: "It happens in four weeks with 72% probability.", expectedTimeframe: "4 weeks", bullProbability: 72 }, transaction());
    expect(result.normalizedOutput).toMatchObject({ expectedTimeframe: null, bullProbability: null });
  });

  it("withholds unsupported causal escalation", () => {
    const result = validateInterpretationOutput({ reply: "Credit spreads caused the selloff." }, transaction());
    expect(result.status).toBe("WITHHELD");
    expect(result.withheldClaimReasons.join(" ")).toMatch(/causality/i);
  });

  it("requires degraded evidence language in the pre-generation contract without treating quality as probability", () => {
    const tx = transaction("DEGRADED");
    const prompt = buildInterpretationPromptContract(tx, packet("DEGRADED"));
    expect(prompt).toContain("DEGRADED");
    expect(prompt).toMatch(/never translate strength or quality into probability/i);
  });

  it("preserves material conflict and insufficient evidence as a valid withheld outcome", () => {
    const result = validateInterpretationOutput({ reply: "Markets are worsening." }, createInterpretationTransaction("ASHA", null, "model:test", effectiveAt));
    expect(result.status).toBe("WITHHELD");
    expect(result.normalizedOutput.reply).toMatch(/Insufficient evidence/);
  });

  it("detects materially repeated structured sections without exact-string matching", () => {
    const summary = "Pressure is elevated because the same supplied macro reading remains stressed.";
    const result = validateInterpretationOutput({ reply: summary, executiveSummary: "The supplied macro reading remains stressed, so pressure is elevated." }, transaction());
    expect(result.status).toBe("WITHHELD");
  });

  it("retains claim references and does not allow a regeneration to drift to State B", () => {
    const tx = transaction();
    expect(tx.evidenceClaimIds).toHaveLength(1);
    expect(() => assertSameInterpretationState(tx, createEvidencePacket({ ...canonical, stateId: "phase4-state-b" }, [{
      ...packet().claims[0], claimId: "phase4-state-b:observed:macro", canonical: { ...canonical, stateId: "phase4-state-b" }, sourceIds: ["phase4-state-b"],
    }], effectiveAt))).toThrow(/state changed/i);
  });

  it("requires a complete authorized Phase 3 forecast contract before leaving a forecast value available", () => {
    const tx = transaction();
    expect(tx.forecastClaimIds).toEqual([]);
    const result = validateInterpretationOutput({ reply: "Answer.", expectedTimeframe: "4–8 weeks", entryZone: "$99" }, tx);
    expect(result.normalizedOutput).toMatchObject({ expectedTimeframe: null, entryZone: null });
  });
});
