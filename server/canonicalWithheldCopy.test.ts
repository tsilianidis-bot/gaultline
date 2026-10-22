import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(import.meta.dirname, "..", rel), "utf8");

describe("canonical withheld wording", () => {
  it("states that a missing assessment or emerging-stress reading was not supplied by canonical Core", () => {
    const experience = read("client/src/components/intelligence-core-visual/IntelligenceCoreExperience.tsx");
    const drawer = read("client/src/components/intelligence-core-visual/EvidenceDrawer.tsx");
    expect(experience).toContain("Not supplied by canonical Core");
    expect(experience).toContain("not an all-clear signal");
    expect(experience).not.toContain("The verified Intelligence Core has not supplied a supported current assessment");
    expect(experience).not.toContain("No evidence-supported emerging stress indicator connected");
    expect(drawer).toContain('domain.assessment ||\n                  "Not supplied by canonical Core. This is not an all-clear signal."');
    expect(drawer).not.toContain("A verified current assessment is not available for this domain.");
  });
});
