import { describe, expect, it } from "vitest";
import {
  formatCanonicalPercent,
  formatCanonicalScore,
  normalizeCanonicalMetric,
} from "../shared/marketMetrics";

describe("canonical market metrics", () => {
  it("deterministically clamps and rounds every metric to the 0-100 contract", () => {
    expect(normalizeCanonicalMetric(-12)).toBe(0);
    expect(normalizeCanonicalMetric(101.26)).toBe(100);
    expect(normalizeCanonicalMetric(61.26)).toBe(61.3);
    expect(normalizeCanonicalMetric(Number.NaN, 42)).toBe(42);
  });

  it("formats canonical scores and probabilities exactly once", () => {
    expect(formatCanonicalPercent(61.26)).toBe("61.3%");
    expect(formatCanonicalPercent(140)).toBe("100%");
    expect(formatCanonicalScore(61)).toBe("61/100");
  });
});
