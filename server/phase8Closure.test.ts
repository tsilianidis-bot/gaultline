import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Phase 8 lifecycle closure artifacts", () => {
  it("contains the governing contract, state machine, provenance, adversarial, leak, and 80-item gate evidence", () => {
    expect(read("PHASE_8_LIFECYCLE_CONTRACT.md")).toContain("Phase 8 — Early Warning Lifecycle Contract");
    expect(JSON.parse(read("PHASE_8_STATE_MACHINE.json")).activeStates).toEqual(["EMERGING", "DEVELOPING", "FADING"]);
    expect(JSON.parse(read("PHASE_8_STATE_AND_PROVENANCE_PROOF.json")).result).toBe("PASS");
    expect(JSON.parse(read("PHASE_8_ADVERSARIAL_TESTS.json")).cases).toHaveLength(20);
    expect(JSON.parse(read("PHASE_8_PHASE9_LEAK_AUDIT.json")).blockingPhase9LeakCount).toBe(0);
    const gate = read("PHASE_8_ACCEPTANCE_GATE.md");
    expect((gate.match(/\| \d+ \|/g) ?? []).length).toBe(80);
    expect(gate).toContain("Gate result: PASS");
  });
});
