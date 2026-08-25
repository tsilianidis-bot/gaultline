import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const text = (name: string) => readFileSync(resolve(process.cwd(), name), "utf8");

describe("Phase 7 closure artifacts", () => {
  it("requires a complete passing 74-item acceptance gate", () => {
    const gate = text("PHASE_7_ACCEPTANCE_GATE.md");
    expect((gate.match(/\| PASS \|/g) ?? []).length).toBe(74);
    expect(gate).toContain("Gate result: PASS");
  });

  it("requires a versioned model, explicit missing policy, zero Phase 8 leak count, and all adversarial cases", () => {
    const model = JSON.parse(text("PHASE_7_SCORING_MODEL.json"));
    const adversarial = JSON.parse(text("PHASE_7_ADVERSARIAL_TESTS.json"));
    const leak = JSON.parse(text("PHASE_7_PHASE8_LEAK_AUDIT.json"));
    expect(model.missingValuePolicy).toBe("EXPLICIT_UNAVAILABLE_NO_IMPUTATION");
    expect(Object.values(model.weights).reduce((sum: number, value) => sum + Number(value), 0)).toBe(100);
    expect(adversarial.cases).toHaveLength(15);
    expect(leak.counts.BLOCKING_PHASE8_LEAK).toBe(0);
  });
});
