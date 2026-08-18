import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/ProductExperience.tsx"), "utf8");

describe("Founder Statement copy refresh", () => {
  it("replaces the prior founder statement with the supplied opening, question set, and closing", () => {
    expect(source).toContain("Finding the right assets isn’t the hardest part of investing.");
    expect(source).toContain("Knowing when to act is.");
    expect(source).toContain("What’s likely to happen next?");
    expect(source).toContain("And what should I do?");
    expect(source).toContain("Finding the opportunity can change your portfolio.");
    expect(source).toContain("Knowing when to move can change your life.");
    expect(source).not.toContain("I built FAULTLINE because I kept watching the same pattern repeat");
  });

  it("preserves the existing Founder Statement structure instead of adding a new visual system", () => {
    expect(source).toContain("Section 8: Founder's Statement");
    expect(source).toContain("Founder, FAULTLINE");
    expect(source).toContain("SectionLabel text=\"From the Founder\"");
  });
});
