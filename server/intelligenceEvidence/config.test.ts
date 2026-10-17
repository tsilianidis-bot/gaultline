import { describe, expect, it } from "vitest";
import {
  INTELLIGENCE_CORE_LEDGER_FLAG,
  INTELLIGENCE_CORE_VISUAL_FLAG,
  INTELLIGENCE_EVIDENCE_FLAG,
  isIntelligenceCoreLedgerEnabled,
  isIntelligenceCoreVisualEnabled,
  isIntelligenceEvidenceEnabled,
} from "./config";

describe("Phase 1 verified evidence rollout gate", () => {
  it("is disabled unless explicitly enabled", () => {
    expect(isIntelligenceEvidenceEnabled({})).toBe(false);
    expect(isIntelligenceEvidenceEnabled({ [INTELLIGENCE_EVIDENCE_FLAG]: "false" })).toBe(false);
    expect(isIntelligenceEvidenceEnabled({ [INTELLIGENCE_EVIDENCE_FLAG]: "true" })).toBe(true);
  });

  it("keeps presentation and automatic ledger recording separately disabled", () => {
    expect(isIntelligenceCoreVisualEnabled({})).toBe(false);
    expect(isIntelligenceCoreLedgerEnabled({})).toBe(false);
    expect(isIntelligenceCoreVisualEnabled({ [INTELLIGENCE_CORE_VISUAL_FLAG]: "true" })).toBe(true);
    expect(isIntelligenceCoreLedgerEnabled({ [INTELLIGENCE_CORE_LEDGER_FLAG]: "true" })).toBe(true);
  });
});
