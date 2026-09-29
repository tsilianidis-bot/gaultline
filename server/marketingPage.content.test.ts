import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const page = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/MarketingSite.tsx"), "utf8");

describe("Marketing page positioning guardrails", () => {
  it("contains one canonical hero and the systemic-risk positioning", () => {
    expect((page.match(/function Hero\(/g) ?? [])).toHaveLength(1);
    expect(page).toContain("See the fault before the break.");
    expect(page).toContain("EXPLORE FAULTLINE");
    expect(page).toContain("VIEW METHODOLOGY");
    expect(page).toContain('const EXPLORE_HREF = "/pressure-index"');
    expect(page).toContain('const METHOD_HREF = "#methodology"');
  });

  it("does not present unsupported historical warnings or competing score claims", () => {
    expect(page).toContain("NOT A RETROSPECTIVE RECONSTRUCTION OF LIVE WARNINGS");
    expect(page).not.toMatch(/funds with the pressure read|top funds were already positioned|the read was there before the headlines/i);
    expect(page).not.toMatch(/Lehman Collapse|COVID Crash|94\s*\/\s*100|82\s*\/\s*100|91\s*\/\s*100|72\s*\/\s*100/);
    expect(page).not.toMatch(/back-tested for 25 years|predicted the/i);
  });

  it("keeps checkout off the landing page and avoids a fake live score", () => {
    expect(page).toContain('id="access"');
    expect(page).toContain("Checkout is not offered on this page.");
    expect(page).not.toContain("MARKETING_TIER_CARDS");
    expect(page).not.toMatch(/CURRENT REGIME|SIGNALS ACTIVE|TREASURY STRESS: ELEVATED/);
    expect(page).not.toMatch(/\$299|\$59|\$99|\$49/);
  });

  it("uses PLATO as the customer-facing interpreter and does not name ASHA", () => {
    expect(page).toContain("PLATO market explanation");
    expect(page).not.toContain("ASHA");
  });

  it("keeps the founder note verbatim and points both CTAs at public destinations", () => {
    expect(page).toContain("A NOTE FROM THE FOUNDER");
    expect(page).toContain("— JT");
    expect(page).toContain("The goal isn't to tell you what to buy or sell.");
    expect(page).toContain("FUTURE INTELLIGENCE");
  });
});
