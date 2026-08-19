import { describe, expect, it } from "vitest";
import { calculateAblationScore, identifyRegisteredDrawdownEvents, pearsonCorrelation } from "./verifiedChampionMetrics";

describe("Locked verified Champion metrics", () => {
  it("finds the first 10% drawdown onset and collapses an unrecovered episode into one event", () => {
    const bars = [100, 99, 90, 89, 95, 101].map((close, index) => ({ timestamp: Date.parse(`2024-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`), open: close, high: close, low: close, close, volume: 1 }));
    const events = identifyRegisteredDrawdownEvents(bars);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ onsetDate: "2024-01-03", troughDate: "2024-01-04", recoveryDate: "2024-01-06" });
  });

  it("calculates stable Pearson and frozen-weight ablation sensitivity without mutating the baseline", () => {
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 8);
    expect(calculateAblationScore({ liquidityStress: 20, creditContagion: 30, volatilityRegime: 40, macroSensitivity: 50, marketBreadth: 60, aiBubble: 70 }, "aiBubble")).toBe(38);
  });
});
