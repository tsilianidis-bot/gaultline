import { describe, expect, it } from "vitest";
import { PHASE10_PRESENTATION_CONTRACT_VERSION, PRESENTATION_SEMANTICS } from "../shared/earlyWarningPresentation";
import {
  buildGovernedEvaluationUnavailablePresentation,
  buildNoMaterialEarlyWarningPresentation,
  isCurrentLifecycleObservation,
} from "./earlyWarningPresentation";

// Mock ledger provenance only — no database or production call is made in this suite.
const MOCK_LEDGER_PROVENANCE = { provider: "fixture-early-warning-ledger", observedAt: "2026-08-27T02:00:00.000Z" } as const;

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

  it("MOCK ledger: requires exact canonical state and synthesis identity before treating a lifecycle observation as current", () => {
    const priorObservation = { originatingStateId: "state:S1", originatingSynthesisId: "syn:S1", fixtureProvenance: MOCK_LEDGER_PROVENANCE };
    const currentObservation = { originatingStateId: "state:S2", originatingSynthesisId: "syn:S2", fixtureProvenance: MOCK_LEDGER_PROVENANCE };

    expect(isCurrentLifecycleObservation(priorObservation, "state:S2", "syn:S2")).toBe(false);
    expect(isCurrentLifecycleObservation(currentObservation, "state:S2", "syn:S2")).toBe(true);
    expect(isCurrentLifecycleObservation({ ...currentObservation, originatingSynthesisId: "syn:other" }, "state:S2", "syn:S2")).toBe(false);
  });
});
