import { describe, expect, it } from "vitest";
import { createEvidencePacket, type EvidenceClaim } from "../shared/evidenceContract";
import { assertSameInterpretationState, buildInterpretationPromptContract, createInterpretationTransaction, validateInterpretationOutput } from "../shared/interpretationIntegrity";

const canonical = { stateId: "state:phase4", effectiveAt: "2026-08-22T12:00:00.000Z" };
const claim: EvidenceClaim = {
  claimId: "state:phase4:observed:pressure", evidenceClass: "OBSERVED", statement: "Pressure Index is 18.", value: 18, unit: "score_0_to_100",
  canonical, sourceIds: ["state:phase4"], sourceType: "MANIFEST", sourceTimestamp: canonical.effectiveAt,
  qualityStatus: "HEALTHY", evidenceStrength: "MODERATE", limitations: [], createdAt: canonical.effectiveAt, effectiveAt: canonical.effectiveAt, forecastAuthorized: false,
};

describe("Phase 4 interpretation integrity", () => {
  it("binds a generation transaction to the supplied canonical evidence packet and prompt identity", () => {
    const packet = createEvidencePacket(canonical, [claim], canonical.effectiveAt);
    const transaction = createInterpretationTransaction("ASHA", packet, "model:test", canonical.effectiveAt);
    expect(transaction).toMatchObject({ originatingStateId: canonical.stateId, evidenceClaimIds: [claim.claimId], forecastClaimIds: [], promptVersion: "phase4-prompt-v1" });
    expect(buildInterpretationPromptContract(transaction, packet)).toContain(canonical.stateId);
  });

  it("withholds unsupported numeric target, timing, probability, confirmation, and invalidation fields", () => {
    const packet = createEvidencePacket(canonical, [claim], canonical.effectiveAt);
    const transaction = createInterpretationTransaction("ORACLE", packet, "model:test", canonical.effectiveAt);
    const result = validateInterpretationOutput({ reply: "Answer.", bullProbability: 62, confidence: 88, expectedTimeframe: "4–8 weeks", entryZone: "$100", confirmationConditions: ["Cross 100"], invalidation: "Break 90" }, transaction);
    expect(result.status).toBe("CORRECTED");
    expect(result.normalizedOutput).toMatchObject({ bullProbability: null, confidence: null, expectedTimeframe: null, entryZone: null, confirmationConditions: ["No governed confirmation condition is currently defined."], invalidation: "No governed invalidation condition is currently defined." });
  });

  it("flags unsupported causal and system-wide escalation language plus materially duplicated sections", () => {
    const packet = createEvidencePacket(canonical, [claim], canonical.effectiveAt);
    const transaction = createInterpretationTransaction("ASHA", packet, "model:test", canonical.effectiveAt);
    const reply = "Credit deterioration caused equities to fall. The entire system is confirmed deteriorating.";
    const result = validateInterpretationOutput({ reply, executiveSummary: reply }, transaction);
    expect(result.issues.join(" ")).toMatch(/causal|system-wide|duplicates/i);
    expect(result.status).toBe("WITHHELD");
    expect(result.normalizedOutput.reply).toMatch(/does not support/);
  });

  it("withholds an invented current narrative when canonical state is unavailable", () => {
    const transaction = createInterpretationTransaction("ASHA", null, "model:test", canonical.effectiveAt);
    const result = validateInterpretationOutput({ reply: "Markets are worsening." }, transaction);
    expect(result.status).toBe("WITHHELD");
    expect(result.normalizedOutput.reply).toMatch(/Canonical state unavailable/);
  });

  it("rejects regeneration that silently changes the canonical-state transaction", () => {
    const packet = createEvidencePacket(canonical, [claim], canonical.effectiveAt);
    const transaction = createInterpretationTransaction("ASHA", packet, "model:test", canonical.effectiveAt);
    expect(() => assertSameInterpretationState(transaction, createEvidencePacket({ ...canonical, stateId: "state:other" }, [{ ...claim, claimId: "state:other:observed:pressure", canonical: { ...canonical, stateId: "state:other" }, sourceIds: ["state:other"] }], canonical.effectiveAt))).toThrow(/state changed/);
  });
});
