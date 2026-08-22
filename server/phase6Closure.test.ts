import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const text = (file: string) => readFileSync(resolve(root, file), "utf8");
const json = <T>(file: string) => JSON.parse(text(file)) as T;

describe("Phase 6 Early Warning closure artifacts", () => {
  it("keeps the governed contract explicit about source authority, score meaning, strict qualification, lifecycle, and immutable history", () => {
    const contract = text("PHASE_6_EARLY_WARNING_CONTRACT.md");
    expect(contract).toContain("CrossEngineSynthesis");
    expect(contract).toContain("not a probability");
    expect(contract).toMatch(/at most three/i);
    expect(contract).toContain("append-only");
    expect(contract).toContain("INVALIDATED");
  });

  it("records the only candidate type and zero-fabrication policy", () => {
    const audit = json<{ status: string; candidateTypes: Array<{ candidateType: string; forbiddenSources: string[] }> }>("PHASE_6_CANDIDATE_AUDIT.json");
    expect(audit.status).toBe("PASS");
    expect(audit.candidateTypes).toHaveLength(1);
    expect(audit.candidateTypes[0].candidateType).toBe("CROSS_ENGINE_DIVERGENCE");
    expect(audit.candidateTypes[0].forbiddenSources).toContain("LLM-generated warning");
  });

  it("documents all adversarial and cross-surface controls as passed", () => {
    const adversarial = json<{ status: string; cases: Array<{ result: string }> }>("PHASE_6_ADVERSARIAL_TESTS.json");
    const proof = json<{ status: string; surfaces: Array<{ result: string }> }>("PHASE_6_CROSS_SURFACE_PROOF.json");
    expect(adversarial.status).toBe("PASS");
    expect(adversarial.cases).toHaveLength(12);
    expect(adversarial.cases.every(item => item.result === "PASS")).toBe(true);
    expect(proof.status).toBe("PASS");
    expect(proof.surfaces.every(item => item.result === "PASS")).toBe(true);
  });

  it("contains a complete passing Phase 6 acceptance gate", () => {
    const gate = text("PHASE_6_ACCEPTANCE_GATE.md");
    expect((gate.match(/\| PASS \|/g) ?? []).length).toBe(42);
    expect(gate).toContain("**Gate result: PASS.**");
  });
});
