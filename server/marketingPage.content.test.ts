import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const page = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/MarketingSite.tsx"), "utf8");

describe("Marketing page positioning guardrails", () => {
  it("contains one canonical hero and the Pentagonal Thesis architecture", () => {
    expect((page.match(/function Hero\(/g) ?? [])).toHaveLength(1);
    expect(page).toContain("FAULTLINE PENTAGONAL THESIS™");
    expect(page).toContain("What’s happening?");
    expect(page).toContain("What should I do?");
  });

  it("does not present unsupported historical warnings or competing score claims", () => {
    expect(page).toContain("RETROSPECTIVE RECONSTRUCTION");
    expect(page).not.toMatch(/funds with the pressure read|top funds were already positioned|the read was there before the headlines/i);
    expect(page).not.toMatch(/Lehman Collapse|COVID Crash|94\s*\/\s*100|82\s*\/\s*100|91\s*\/\s*100|72\s*\/\s*100/);
  });

  it("uses the repaired access anchor and avoids static current-market claims", () => {
    expect(page).toContain('id="access"');
    expect(page).toContain('href="#access"');
    expect(page).toContain("ILLUSTRATIVE INTERFACE");
    expect(page).not.toMatch(/CURRENT REGIME|SIGNALS ACTIVE|TREASURY STRESS: ELEVATED/);
  });

  it("keeps ASHA current and does not present PLATO as an implemented feature", () => {
    expect(page).toContain("ASHA market explanation");
    expect(page).not.toContain("PLATO");
  });
});
