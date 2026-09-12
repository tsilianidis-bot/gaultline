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
});
