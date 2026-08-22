import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const load = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Phase 5 closure artifacts", () => {
  it("records the governed contract, engine audit, adversarial evidence, and cross-surface proof", () => {
    const contract = load("PHASE_5_CROSS_ENGINE_SYNTHESIS_CONTRACT.md");
    const engineAudit = JSON.parse(load("PHASE_5_ENGINE_AUDIT.json"));
    const adversarial = JSON.parse(load("PHASE_5_ADVERSARIAL_TESTS.json"));
    const crossSurface = JSON.parse(load("PHASE_5_CROSS_SURFACE_PROOF.json"));
    expect(contract).toContain("phase5-cross-engine-synthesis-v1");
    expect(engineAudit.status).toBe("PASS");
    expect(engineAudit.phaseBoundary.earlyWarningUI).toBe(false);
    expect(adversarial.cases).toHaveLength(18);
    expect(adversarial.cases.every((item: { result: string }) => item.result === "PASS")).toBe(true);
    expect(crossSurface.surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: "ASHA" }),
      expect.objectContaining({ surface: "Oracle" }),
      expect.objectContaining({ surface: "Alerts Archive" }),
      expect.objectContaining({ surface: "Owner/debug" }),
    ]));
  });

  it("requires the complete explicit acceptance gate and clean final regression confirmation", () => {
    const gate = load("PHASE_5_ACCEPTANCE_GATE.md");
    expect((gate.match(/\| PASS \|/g) ?? []).length).toBeGreaterThanOrEqual(48);
    expect(gate).not.toContain("PENDING_FINAL_REGRESSION");
    expect(gate).toContain("1,787 tests passed; 22 skipped; 0 failed");
    expect(gate).toContain("No warning score, lifecycle, qualification, ranking, or UI is implemented.");
  });
});
