import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pagePath = new URL("../client/src/pages/seo/MarketCrashProbability2026.tsx", import.meta.url);

describe("critical public claim containment", () => {
  const page = readFileSync(pagePath, "utf8");

  it("does not call the six-vector Pressure Index a crash probability", () => {
    expect(page).toContain("not a calibrated crash probability");
    expect(page).not.toContain("single 0-100 crash probability score");
    expect(page).not.toContain("core crash probability indicator");
  });

  it("does not misstate VIX, seven vectors, intraday updating, or historical FAULTLINE warnings", () => {
    expect(page).toContain("six-vector methodology");
    expect(page).toContain("it is not a live VIX input");
    expect(page).not.toContain("seven independent risk vectors");
    expect(page).not.toContain("updated continuously throughout the trading day");
    expect(page).toContain("does not support the claim that FAULTLINE historically issued warnings");
  });
});
