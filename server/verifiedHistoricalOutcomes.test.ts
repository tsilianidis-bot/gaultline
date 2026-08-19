import { describe, expect, it } from "vitest";
import { calculateIndependentSp500Outcome } from "./verifiedHistoricalOutcomes";

const bars = [
  { timestamp: Date.parse("2024-01-31T00:00:00.000Z"), open: 100, high: 101, low: 99, close: 100, volume: 1 },
  { timestamp: Date.parse("2024-02-01T00:00:00.000Z"), open: 100, high: 111, low: 108, close: 110, volume: 1 },
  { timestamp: Date.parse("2024-02-02T00:00:00.000Z"), open: 110, high: 111, low: 85, close: 90, volume: 1 },
];

describe("Verified historical S&P 500 outcomes", () => {
  it("keeps independent forward-return, drawdown, MAE, and realized-volatility measurements separate", () => {
    const result = calculateIndependentSp500Outcome("2024-01-31", 2, bars);

    expect(result.outcomeStatus).toBe("COMPLETE");
    expect(result.forwardReturnPct).toBeCloseTo(-10, 8);
    expect(result.maximumDrawdownPct).toBeCloseTo(-18.18181818, 8);
    expect(result.maximumAdverseExcursionPct).toBeCloseTo(-15, 8);
    expect(result.realizedVolatilityPct).toBeGreaterThan(0);
    expect(result.endDate).toBe("2024-02-02");
  });

  it("keeps incomplete future horizons pending rather than inferring an outcome", () => {
    const result = calculateIndependentSp500Outcome("2024-01-31", 5, bars);

    expect(result.outcomeStatus).toBe("PENDING");
    expect(result.forwardReturnPct).toBeNull();
    expect(result.endDate).toBeNull();
  });
});
