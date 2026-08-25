import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

describe("Phase 4 ASHA / Oracle integration boundaries", () => {
  it("binds ASHA generation to canonical evidence, validation, and response provenance", () => {
    const source = read("server/ashaEngine.ts");
    expect(source).toContain("buildCanonicalEvidencePacket");
    expect(source).toContain("createInterpretationTransaction(\"ASHA\"");
    expect(source).toContain("buildInterpretationPromptContract(transaction, evidencePacket)");
    expect(source).toContain("validateInterpretationOutput(parsed, transaction)");
    expect(source).toContain("integrity:");
    expect(source).toContain("createInterpretationTransaction(\"DAILY_GREETING\"");
    expect(source).not.toContain('expectedTimeframe: readString(parsed.expectedTimeframe) || "2-4 weeks"');
  });

  it("binds Oracle’s main ask response to the same canonical evidence transaction and audit metadata", () => {
    const source = read("server/routers/smartDiscovery.ts");
    expect(source).toContain("createInterpretationTransaction(\"ORACLE\"");
    expect(source).toContain("buildInterpretationPromptContract(transaction, evidencePacket)");
    expect(source).toContain("validateInterpretationOutput(raw, transaction)");
    expect(source).toContain("withheldClaimReasons: integrity.validation.withheldClaimReasons");
    expect(source).toContain("const systemPrompt = `You are ASHA, FAULTLINE's evidence-bound market interpretation layer.");
    expect(source).not.toContain("const systemPrompt = `${legacySystemPrompt}");
    expect(source).toContain("function resolveAnswerFormat");
    expect(source).toContain("Response format: ${answerFormat}");
  });

  it("persists Phase 4 response identity, evidence references, validation, and withholding reasons on assistant audit messages", () => {
    const source = read("server/conversationLogger.ts");
    for (const field of ["responseId", "originatingStateId", "evidenceClaimIds", "forecastClaimIds", "promptVersion", "validationStatus", "withheldClaimReasons"]) {
      expect(source).toContain(field);
    }
  });

  it("does not render missing Oracle conditions or synthesis as generated engine evidence", () => {
    const source = read("client/src/components/OracleBriefing.tsx");
    expect(source).toContain("No governed confirmation condition is currently defined.");
    expect(source).toContain("No governed invalidation condition is currently defined.");
    expect(source).toContain("data.crossEngineSynthesis?.length ?");
    expect(source).not.toContain("Structured synthesis unavailable");
    expect(source).not.toContain("No additional confirmation condition was returned by the currently available engines.");
  });
});
