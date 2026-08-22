import { describe, expect, it } from "vitest";
import { PHASE10_PRESENTATION_CONTRACT_VERSION, PRESENTATION_SEMANTICS } from "../shared/earlyWarningPresentation";

describe("Phase 10 early-warning presentation contract", () => {
  it("declares one immutable compute-once distribution contract", () => {
    expect(PHASE10_PRESENTATION_CONTRACT_VERSION).toBe("phase10-early-warning-presentation-v1");
  });
  it("retains standardized non-probabilistic semantics", () => {
    expect(PRESENTATION_SEMANTICS.score).toMatch(/not probability/i);
    expect(PRESENTATION_SEMANTICS.confirming).toMatch(/structural warning thesis/i);
    expect(PRESENTATION_SEMANTICS.noMaterial).not.toMatch(/safe|bullish/i);
  });
});
