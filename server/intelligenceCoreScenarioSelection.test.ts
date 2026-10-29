import { describe, expect, it } from "vitest";
import { resolveScenarioSelection } from "../client/src/components/intelligence-core-visual/Panels";
import type {
  CoreScenario,
  ScenarioId,
} from "../client/src/components/intelligence-core-visual/types";

function scenario(
  id: ScenarioId,
  status: CoreScenario["status"]
): CoreScenario {
  return {
    id,
    title: `Scenario ${id}`,
    status,
    summary: null,
    conditions: [],
    invalidations: [],
    evidenceIds: [],
    domainIds: [],
  };
}

describe("Intelligence Core scenario selection", () => {
  it("resolves the initial supplied scenario, preserves explicit selection, and clears a removed scenario", () => {
    const supplied = [
      scenario("A", "unsupported"),
      scenario("B", "favored"),
      scenario("C", "conditional"),
    ];

    expect(resolveScenarioSelection(supplied, null)).toBe("B");
    expect(resolveScenarioSelection(supplied, "C")).toBe("C");
    expect(
      resolveScenarioSelection(
        [scenario("A", "unsupported"), scenario("C", "conditional")],
        "B"
      )
    ).toBe("A");
    expect(resolveScenarioSelection([], "A")).toBeNull();
  });
});
