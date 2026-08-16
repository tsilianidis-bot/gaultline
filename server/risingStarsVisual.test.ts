import { describe, expect, it } from "vitest";
import { chartBarsForRange, computeRecordedSignalWindow, deriveDefensibleTechnicalLevels } from "./risingStarsVisual";

const now = Date.now();
const bars = Array.from({ length: 25 }, (_, index) => ({
  timestamp: now - (25 - index) * 24 * 60 * 60 * 1000,
  open: 100 + index,
  high: 102 + index,
  low: 99 + index,
  close: 101 + index,
  volume: 1_000_000 + index * 1_000,
}));

describe("Rising Stars visual-detail evidence rules", () => {
  it("maps chart ranges to completed source bars without synthetic points", () => {
    expect(chartBarsForRange(bars, "1W").length).toBeLessThan(bars.length);
    expect(chartBarsForRange(bars, "3M").every(bar => bars.includes(bar))).toBe(true);
  });

  it("derives reference support and resistance only from completed daily bars", () => {
    const levels = deriveDefensibleTechnicalLevels(bars);
    expect(levels.support).toBe(104);
    expect(levels.resistance).toBe(126);
    expect(levels.basis).toContain("completed daily bars");
  });

  it("does not calculate signal-window outcome without a recorded detection", () => {
    expect(computeRecordedSignalWindow(null, null, bars, 125)).toBeNull();
  });

  it("labels calculated price movement as a recorded signal-window measurement, not a return", () => {
    const result = computeRecordedSignalWindow(110, bars[5].timestamp, bars, 125);
    expect(result?.movementPercent).toBeCloseTo(13.636, 2);
    expect(result?.note).toContain("recorded FAULTLINE signal window");
  });
});
