import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const artifact = <T>(name: string): T => JSON.parse(readFileSync(resolve(root, name), "utf8")) as T;

describe("Phase 4 permanent closure artifacts", () => {
  it("records a passing prompt audit for all ASHA and Oracle generation boundaries", () => {
    const audit = artifact<{ status: string; boundaries: Array<{ id: string; status: string }> }>("PHASE_4_PROMPT_AUDIT.json");
    expect(audit.status).toBe("PASS");
    expect(audit.boundaries.filter(boundary => ["ASHA_PRIMARY", "ASHA_DAILY_GREETING", "ORACLE_ASK"].includes(boundary.id)).every(boundary => boundary.status === "PASS")).toBe(true);
  });

  it("records all output claim classes as passing and preserves the Phase 4 safe handling order", () => {
    const audit = artifact<{ claimDisposition: Array<{ result: string }>; safeHandlingOrder: string[] }>("PHASE_4_OUTPUT_CLAIM_AUDIT.json");
    expect(audit.claimDisposition).toHaveLength(8);
    expect(audit.claimDisposition.every(item => item.result === "PASS")).toBe(true);
    expect(audit.safeHandlingOrder).toContain("withhold unsupported output");
  });

  it("documents all twelve explicit adversarial prompts as passing", () => {
    const tests = artifact<{ status: string; cases: Array<{ id: number; result: string }> }>("PHASE_4_ADVERSARIAL_TESTS.json");
    expect(tests.status).toBe("PASS");
    expect(tests.cases.map(item => item.id)).toEqual([...Array(12)].map((_, index) => index + 1));
    expect(tests.cases.every(item => item.result === "PASS")).toBe(true);
  });

  it("documents cross-surface canonical and evidence semantic preservation", () => {
    const proof = artifact<{ status: string; surfaces: Array<{ status: string; surface: string }> }>("PHASE_4_CROSS_SURFACE_PROOF.json");
    expect(proof.status).toBe("PASS");
    expect(proof.surfaces.length).toBeGreaterThanOrEqual(7);
    expect(proof.surfaces.every(surface => surface.status === "PASS")).toBe(true);
  });

  it("contains all 55 Phase 4 acceptance questions with no pending or failed result", () => {
    const gate = readFileSync(resolve(root, "PHASE_4_ACCEPTANCE_GATE.md"), "utf8");
    const rows = gate.match(/^\|\s*\d+\s*\|/gm) ?? [];
    expect(rows).toHaveLength(55);
    expect(gate).not.toMatch(/PENDING FINAL RUN|\*\*FAIL\*\*/);
    expect(gate).toContain("**141 files passed; 1 skipped; 1,756 tests passed; 22 skipped; 0 failed**");
  });
});
