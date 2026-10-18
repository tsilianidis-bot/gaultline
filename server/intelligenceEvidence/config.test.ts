import { describe, expect, it } from "vitest";
import { INTELLIGENCE_EVIDENCE_FLAG, isIntelligenceEvidenceEnabled } from "./config";

describe("Phase 1 verified evidence rollout gate", () => {
  it("is disabled unless explicitly enabled", () => {
    expect(isIntelligenceEvidenceEnabled({})).toBe(false);
    expect(isIntelligenceEvidenceEnabled({ [INTELLIGENCE_EVIDENCE_FLAG]: "false" })).toBe(false);
    expect(isIntelligenceEvidenceEnabled({ [INTELLIGENCE_EVIDENCE_FLAG]: "true" })).toBe(true);
  });
});
