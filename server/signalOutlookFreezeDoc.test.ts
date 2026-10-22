/**
 * server/signalOutlook.ts was frozen so scoreRisingStar would keep a numeric
 * social sentiment. The owner authorized one correction: a missing verified-social
 * composite must not be stored or multiplied as 0. The social term and the
 * catalyst term that consumes the composite are withheld. A present composite,
 * including a genuine 0, keeps the prior formula. Weights and thresholds are
 * unchanged. preFlight.ts and tradePreflight.ts stay byte-frozen.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const freezeBase = "1cfa1299f6644a7eb9a60246330c7b9a13ccc433";
const source = readFileSync(new URL("./signalOutlook.ts", import.meta.url), "utf8");

describe("signalOutlook.ts rising-star composite withhold", () => {
  it("documents the authorized delta against the freeze base", () => {
    const diff = execSync(`git diff ${freezeBase} -- server/signalOutlook.ts`, { encoding: "utf8" });
    expect(diff).toContain("function risingStarSocialTerms");
    expect(diff).toMatch(/-.*sentimentScore: social\?\.sentimentScore \?\? 0/);
    expect(source).not.toContain("sentimentScore: social?.sentimentScore ?? 0");
    expect(source).toContain("clamp(50 + composite * 30 + Math.min(20, (social!.positiveNews + social!.negativeNews) * 4))");
    expect(source).toContain("Verified social composite is unavailable; social term excluded from score.");
  });
});
