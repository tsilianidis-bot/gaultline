import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (name: string) => readFileSync(resolve(root, name), "utf8");

describe("Phase 10 presentation closure", () => {
  const required = [
    "PHASE_10_PRESENTATION_CONTRACT.md",
    "PHASE_10_CROSS_SURFACE_PROOF.json",
    "PHASE_10_API_SAFETY.json",
    "PHASE_10_ADVERSARIAL_TESTS.json",
    "PHASE_10_VISUAL_VALIDATION.md",
    "PHASE_10_ACCEPTANCE_GATE.md",
  ];

  it("keeps every required presentation evidence artifact present", () => {
    for (const artifact of required) expect(existsSync(resolve(root, artifact))).toBe(true);
  });

  it("requires one governed presentation contract and no second warning engine", () => {
    const contract = read("PHASE_10_PRESENTATION_CONTRACT.md");
    const api = JSON.parse(read("PHASE_10_API_SAFETY.json")) as { result: string; forbiddenPublicBehavior: string[] };
    expect(contract).toContain("phase10-early-warning-presentation-v1");
    expect(contract).toContain("cannot calculate, score, qualify, transition, confirm, invalidate, forecast");
    expect(api.result).toBe("PASS");
    expect(api.forbiddenPublicBehavior).toContain("importance scoring");
    expect(api.forbiddenPublicBehavior).toContain("warning mutation");
  });

  it("requires all governed public and assistant surfaces in cross-surface proof", () => {
    const proof = JSON.parse(read("PHASE_10_CROSS_SURFACE_PROOF.json")) as { result: string; surfaces: Array<{ surface: string; status: string }> };
    expect(proof.result).toBe("PASS");
    for (const surface of ["HOME", "WATCH canonical deep route", "warning detail", "Alerts Archive current projection", "ASHA", "Oracle", "social foundation", "Track Record"]) {
      expect(proof.surfaces.find(item => item.surface === surface)?.status).toBe("PASS");
    }
  });

  it("keeps no-material presentation and retrospective separation in visual validation", () => {
    const visual = read("PHASE_10_VISUAL_VALIDATION.md");
    expect(visual).toContain("NO MATERIAL EARLY WARNING");
    expect(visual).toContain("retrospective historical reconstruction");
  });
});
