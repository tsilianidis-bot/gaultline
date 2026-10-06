import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/ProductExperience.tsx"), "utf8");

describe("Founder Statement copy refresh", () => {
  it("uses the founder-approved market-change narrative and Pentagonal Thesis framing", () => {
    expect(source).toContain("Markets don’t usually break all at once.");
    expect(source).toContain("They change underneath you first.");
    expect(source).toContain("across the financial markets");
    expect(source).toContain("Pentagonal Thesis™");
    expect(source).toContain("self-directed investors and traders");
    expect(source).toContain("institutional-grade intelligence");
    expect(source).toContain("Less noise. More context.");
    expect(source).toContain("Better decisions.");
    expect(source).not.toContain("Finding the right assets isn’t always the hardest part of investing.");
  });

  it("preserves the existing Founder Statement structure instead of adding a new visual system", () => {
    expect(source).toContain("Section 8: Founder's Statement");
    expect(source).toContain("Founder & CEO, FAULTLINE");
    expect(source).toContain("SectionLabel text=\"Why I Built FAULTLINE\"");
  });
});
