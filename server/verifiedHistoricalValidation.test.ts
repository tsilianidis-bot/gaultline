import { describe, expect, it } from "vitest";
import {
  assessFrozenInputCompleteness,
  calculateFrozenChampionV1,
  classifySeriesHistoricalQuality,
  worstHistoricalQuality,
} from "./verifiedHistoricalValidation";

const completeInputs = {
  hySpreadBps: 300,
  sofr: 3,
  tsy10y: 3,
  tsy2y: 3.5,
  cpiYoy: 2.5,
  ppiYoy: 2,
  fedFunds: 3,
  unemployment: 4,
};

describe("Verified Historical Champion V1", () => {
  it("calculates the frozen formula deterministically for known complete inputs", () => {
    const first = calculateFrozenChampionV1(completeInputs);
    const second = calculateFrozenChampionV1(completeInputs);

    expect(first).toEqual(second);
    expect(first.overallPressure).toBe(23);
    expect(first.regime).toBe("LOW RISK");
    expect(first.vectorScores).toEqual({
      liquidityStress: 16,
      creditContagion: 13,
      volatilityRegime: 39,
      macroSensitivity: 21,
      marketBreadth: 13,
      aiBubble: 37,
    });
  });

  it("marks incomplete historical inputs instead of manufacturing a fallback score", () => {
    const result = assessFrozenInputCompleteness({ ...completeInputs, sofr: null, ppiYoy: undefined });

    expect(result.scoreStatus).toBe("INCOMPLETE");
    expect(result.missingFlags).toEqual(expect.arrayContaining(["sofr", "ppiYoy"]));
  });

  it("always identifies the BAML credit spread history as revised when no ALFRED vintage exists", () => {
    expect(classifySeriesHistoricalQuality("BAMLH0A0HYM2", false)).toBe("REVISED_HISTORICAL");
    expect(classifySeriesHistoricalQuality("DGS10", true)).toBe("POINT_IN_TIME_CONFIRMED");
  });

  it("propagates the worst available input quality into the score-quality summary", () => {
    expect(worstHistoricalQuality(["POINT_IN_TIME_CONFIRMED", "POINT_IN_TIME_APPROXIMATED"])).toBe("POINT_IN_TIME_APPROXIMATED");
    expect(worstHistoricalQuality(["POINT_IN_TIME_CONFIRMED", "REVISED_HISTORICAL", "UNAVAILABLE"])).toBe("UNAVAILABLE");
  });
});
