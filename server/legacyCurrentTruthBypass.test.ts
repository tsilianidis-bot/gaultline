import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf8");
}

describe("legacy current-truth bypasses", () => {
  const mobilePulse = source("client/src/pages/mobile/MobilePulse.tsx");
  const mobileBrief = source("client/src/pages/mobile/MobileBrief.tsx");
  const pressureIndex = source("client/src/pages/PressureIndex.tsx");
  const homepageBriefing = source("server/homepageBriefing.ts");
  const homepagePanel = source("client/src/components/HomepageBriefingPanel.tsx");
  const cryptoIntelligence = source("server/cryptoIntelligence.ts");
  const historicalRouter = source("server/routers.ts");

  it("keeps Mobile Pulse on canonicalCurrent and does not invent bull/crash from a score", () => {
    expect(mobilePulse).toContain("marketState.canonicalCurrent");
    expect(mobilePulse).not.toContain("pressure.getCurrentPressure");
    expect(mobilePulse).not.toContain("100 - score * 0.9");
    expect(mobilePulse).not.toContain("Credit Spread Widening");
    expect(mobilePulse).toContain("UNAVAILABLE");
  });

  it("keeps Mobile Brief on canonicalCurrent and withholds manufactured probabilities", () => {
    expect(mobileBrief).toContain("marketState.canonicalCurrent");
    expect(mobileBrief).not.toContain("pressure.getCurrentPressure");
    expect(mobileBrief).not.toContain("pressureScore * 0.7");
    expect(mobileBrief).toContain("scenarioOutputs");
  });

  it("binds public Pressure Index to canonical state and never seeds placeholder vector scores", () => {
    expect(pressureIndex).toContain("marketState.canonicalCurrent");
    expect(pressureIndex).not.toContain("pressure.getCurrentPressure");
    expect(pressureIndex).not.toContain("[42, 58, 35, 27, 61]");
    expect(pressureIndex).toContain("RISK VECTORS UNAVAILABLE — WITHHELD");
  });

  it("binds homepage briefing to canonical state and does not invent bull/crash from pressure", () => {
    expect(homepageBriefing).toContain("getAuthoritativeCanonicalIntelligenceState");
    expect(homepageBriefing).toContain("projectPressureFromCanonical");
    expect(homepageBriefing).not.toContain("calculateFaultlinePressure");
    expect(homepageBriefing).not.toContain("currentOverall * 0.6");
    expect(homepageBriefing).toContain("UNAVAILABLE");
    expect(homepagePanel).toContain("availability === \"UNAVAILABLE\"");
    expect(homepagePanel).toContain("CRASH / DRAWDOWN");
  });

  it("binds crypto intelligence and historical context to canonical state", () => {
    expect(cryptoIntelligence).toContain("getAuthoritativeCanonicalIntelligenceState");
    expect(cryptoIntelligence).toContain("projectPressureFromCanonical");
    expect(cryptoIntelligence).not.toContain("calculateFaultlinePressure");
    expect(cryptoIntelligence).not.toContain("?? 50");
    expect(cryptoIntelligence).not.toContain("?? 40");
    expect(historicalRouter).toContain("projectPressureFromCanonical");
    expect(historicalRouter).toContain("no canonical market state is bound");
  });
});
