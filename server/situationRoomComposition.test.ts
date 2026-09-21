import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/SituationRoom.tsx"), "utf8");

describe("Situation Room Decision-Light composition", () => {
  it("binds market status to canonical state and withholds when evidence is unavailable", () => {
    expect(source).toContain("canonicalState");
    expect(source).toContain("marketMode === \"canonical\"");
    expect(source).toContain("UNAVAILABLE");
    expect(source).not.toContain("Derive market status from engine output (client-side, pre-simulation)");
    expect(source).not.toMatch(/const clientMarketStatus = pressureScore >= 60/);
  });

  it("renders the action-specific Decision-Light instead of collapsing to a single buy/sell label", () => {
    expect(source).toContain("result.decisionLight");
    expect(source).toContain("DECISION LIGHT");
    expect(source).toContain("decisionLabel");
    expect(source).toContain("canonicalStateId");
  });

  it("keeps bull-continuation and crash/drawdown as separate withheld-capable fields", () => {
    expect(source).toContain("bullProbability");
    expect(source).toContain("crashProbability");
    expect(source).toContain("regimeProbabilities.bull");
    expect(source).toContain("regimeProbabilities.crash");
  });
});
