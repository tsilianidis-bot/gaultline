import { describe, expect, it } from "vitest";
import { PHASE10_PRESENTATION_CONTRACT_VERSION, PRESENTATION_SEMANTICS } from "../shared/earlyWarningPresentation";
import {
  buildGovernedEvaluationUnavailablePresentation,
  buildNoMaterialEarlyWarningPresentation,
} from "./earlyWarningPresentation";

describe("Phase 10 early-warning presentation contract", () => {
  it("declares one immutable compute-once distribution contract", () => {
    expect(PHASE10_PRESENTATION_CONTRACT_VERSION).toBe("phase10-early-warning-presentation-v1");
  });
  it("retains standardized non-probabilistic semantics", () => {
    expect(PRESENTATION_SEMANTICS.score).toMatch(/not probability/i);
    expect(PRESENTATION_SEMANTICS.confirming).toMatch(/structural warning thesis/i);
    expect(PRESENTATION_SEMANTICS.noMaterial).not.toMatch(/safe|bullish/i);
  });

  it("binds a completed no-material result to the evaluated canonical state and synthesis", () => {
    const presentation = buildNoMaterialEarlyWarningPresentation("state:current", "syn:current", "CURRENT", "2026-08-27T02:00:00.000Z");
    expect(presentation).toMatchObject({ kind: "NO_MATERIAL_EARLY_WARNING", stateId: "state:current", synthesisId: "syn:current", freshness: "CURRENT" });
  });

  it("distinguishes an unavailable governed evaluation from a completed no-material result", () => {
    const presentation = buildGovernedEvaluationUnavailablePresentation(null, null, "CANONICAL_STATE_UNAVAILABLE", "2026-08-27T02:00:00.000Z");
    expect(presentation).toMatchObject({ kind: "GOVERNED_EVALUATION_UNAVAILABLE", freshness: "UNAVAILABLE", reason: "CANONICAL_STATE_UNAVAILABLE" });
    expect(presentation.message).toMatch(/could not complete/i);
    expect(presentation.message).not.toMatch(/no current candidate/i);
  });
});
