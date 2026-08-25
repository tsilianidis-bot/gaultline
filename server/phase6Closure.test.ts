import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const text = (file: string) => readFileSync(resolve(root, file), "utf8");
const json = <T>(file: string) => JSON.parse(text(file)) as T;

describe("Phase 6 candidate-only closure artifacts", () => {
  it("documents canonical/evidence/synthesis authority and explicit candidate-only scope", () => {
    const contract = text("PHASE_6_CANDIDATE_DETECTION_CONTRACT.md");
    expect(contract).toContain("CrossEngineSynthesis");
    expect(contract).toContain("CANDIDATE ≠ QUALIFIED WARNING");
    expect(contract).toContain("does not score importance");
  });

  it("records the sole implemented detector with reproducible provenance", () => {
    const inventory = json<{ status: string; detectors: Array<{ candidateType: string; detectorId: string; detectorVersion: string; detectorConfigVersion: string }> }>("PHASE_6_DETECTOR_INVENTORY.json");
    expect(inventory.status).toBe("PASS");
    expect(inventory.detectors).toEqual([expect.objectContaining({ candidateType: "CROSS_ENGINE_DIVERGENCE", detectorId: "cross-engine-divergence", detectorVersion: "1.0.0", detectorConfigVersion: "phase6r-candidate-v1" })]);
  });

  it("requires zero active blocking phase leaks and state propagation proof", () => {
    const leak = json<{ status: string; counts: { BLOCKING_PHASE_LEAK: number } }>("PHASE_6_PHASE7_LEAK_AUDIT.json");
    const propagation = json<{ status: string; invariants: string[] }>("PHASE_6_STATE_PROPAGATION_PROOF.json");
    expect(leak.status).toBe("PASS");
    expect(leak.counts.BLOCKING_PHASE_LEAK).toBe(0);
    expect(propagation.status).toBe("PASS");
    expect(propagation.invariants.some(item => item.includes("Original state/synthesis"))).toBe(true);
  });

  it("contains the complete passing 60-question candidate-detection gate", () => {
    const gate = text("PHASE_6_CANDIDATE_DETECTION_ACCEPTANCE_GATE.md");
    expect((gate.match(/\| PASS \|/g) ?? []).length).toBe(60);
    expect(gate).toContain("**Gate result: PASS.**");
  });
});
