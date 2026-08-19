import { describe, expect, it } from "vitest";
import { detectEquityDrawdownEvents, mechanicalAblation, scoreBucket } from "./reconstructedChampionMetrics";

describe("Reconstructed Champion metrics", () => {
  it("uses the locked frozen score buckets", () => {
    expect([scoreBucket(24), scoreBucket(25), scoreBucket(44), scoreBucket(45), scoreBucket(80)]).toEqual(["0-24", "25-44", "25-44", "45-64", "80-100"]);
  });
  it("registers a local peak-to-trough 10% drawdown within 60 observations", () => {
    const bars = Array.from({ length: 90 }, (_, index) => ({ timestamp: Date.UTC(2020, 0, index + 1), open: 100, high: 100, low: index < 30 ? 100 : 85, close: index < 30 ? 100 : 85, volume: 1 }));
    expect(detectEquityDrawdownEvents(bars).length).toBeGreaterThan(0);
  });
  it("calculates a descriptive reweighted ablation rather than changing the frozen baseline", () => {
    const result = mechanicalAblation({ id: 1, scoreMonth: "2020-01", scoreTimestamp: new Date("2020-01-31T00:00:00Z"), overallPressure: 50, regime: "ELEVATED RISK", vectors: { liquidityStress: 50, creditContagion: 50, volatilityRegime: 50, macroSensitivity: 50, marketBreadth: 50, aiBubble: 50 } }, "aiBubble");
    expect(result.score).toBe(50);
    expect(result.differenceFromBaseline).toBe(0);
  });
});
