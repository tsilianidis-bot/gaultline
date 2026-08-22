import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const audit = JSON.parse(fs.readFileSync(path.join(root, "PHASE_3_CLAIM_INTEGRITY_AUDIT.json"), "utf8")) as { entries: Array<{ surface: string; status: string }>; counts: Record<string, number> };
const adversarial = JSON.parse(fs.readFileSync(path.join(root, "PHASE_3_ADVERSARIAL_TESTS.json"), "utf8")) as { result: string; cases: Array<{ case: number; result: string }> };
const crossSurface = JSON.parse(fs.readFileSync(path.join(root, "PHASE_3_CROSS_SURFACE_EVIDENCE_PROOF.json"), "utf8")) as { result: string; controlledEvidence: { stateId: string }; surfaces: Array<{ surface: string; currentBinding: string; scenarioSemantics: string; analogSemantics: string; unauthorizedForecast: string; result: string }> };

describe("Phase 3 evidence closure artifacts", () => {
  it("records the required material intelligence-surface claim audit without fabricated support", () => {
    expect(audit.entries.length).toBeGreaterThanOrEqual(12);
    expect(audit.entries.some(entry => entry.status === "WITHHELD")).toBe(true);
    expect(audit.entries.some(entry => entry.status === "RECLASSIFIED")).toBe(true);
    expect(Object.values(audit.counts).reduce((sum, value) => sum + value, 0)).toBeGreaterThan(0);
  });

  it("records all ten adversarial cases as passing evidence controls", () => {
    expect(adversarial.result).toBe("PASS");
    expect(adversarial.cases.map(item => item.case)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(adversarial.cases.every(item => item.result === "PASS")).toBe(true);
  });

  it("preserves controlled state binding and semantic meanings across required evidence surfaces", () => {
    expect(crossSurface.result).toBe("PASS");
    expect(crossSurface.surfaces.map(surface => surface.surface)).toEqual(["NOW", "WHY", "WATCH", "ACT", "Outlook", "ASHA", "Oracle", "Market Context"]);
    for (const surface of crossSurface.surfaces) {
      expect(surface).toMatchObject({ currentBinding: crossSurface.controlledEvidence.stateId, scenarioSemantics: "DERIVED_SCENARIO_SCORE", analogSemantics: "HISTORICAL_SIMILARITY", unauthorizedForecast: "WITHHELD", result: "PASS" });
    }
  });
});
