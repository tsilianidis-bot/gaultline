import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
function read(file: string) { return fs.readFileSync(path.join(root, file), "utf8"); }

describe("Phase 9 closure evidence", () => {
  it("contains every required contract, rule, condition, provenance, adversarial, leak, and acceptance artifact", () => {
    for (const file of [
      "PHASE_9_CONFIRMATION_INVALIDATION_CONTRACT.md",
      "PHASE_9_RULE_TEMPLATES.json",
      "PHASE_9_CONDITION_SCHEMA.md",
      "PHASE_9_STATE_AND_PROVENANCE_PROOF.json",
      "PHASE_9_ADVERSARIAL_TESTS.json",
      "PHASE_9_PHASE10_LEAK_AUDIT.json",
      "PHASE_9_ACCEPTANCE_GATE.md",
    ]) expect(fs.existsSync(path.join(root, file))).toBe(true);
  });
  it("records all 104 exact Phase 9 acceptance questions as PASS", () => {
    const gate = read("PHASE_9_ACCEPTANCE_GATE.md");
    const rows = gate.split("\n").filter(line => /^\|\s*\d+\s*\|/.test(line));
    expect(rows).toHaveLength(104);
    expect(rows.every(row => row.includes("| PASS |"))).toBe(true);
  });
  it("requires no public or AI Phase 10 leak", () => {
    const audit = JSON.parse(read("PHASE_9_PHASE10_LEAK_AUDIT.json"));
    expect(audit.BLOCKING_PHASE10_LEAK).toBe(0);
  });
  it("preserves typed cross-phase provenance and structural-only authority", () => {
    const proof = JSON.parse(read("PHASE_9_STATE_AND_PROVENANCE_PROOF.json"));
    expect(proof.result).toBe("PASS");
    expect(proof.requiredIds).toContain("originatingStateId");
    expect(proof.publicSurface).toBe("none");
    expect(proof.aiSurface).toBe("none");
  });
});
