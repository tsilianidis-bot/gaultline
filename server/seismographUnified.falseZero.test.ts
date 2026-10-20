/**
 * Missing stored sub-scores stay unavailable.
 * A finite 0 is a computed floor and is kept. Null, undefined, and non-finite
 * values are missing. The May 2026 row is the only sentinel, and only by month.
 * Carry-forward copies a prior observation when the latest value is missing.
 * It does not run because the stored value is 0, and it never invents 50.
 */
import { describe, expect, it } from "vitest";
import {
  buildEvidenceFamilies,
  carryForwardMissingSubScore,
  normalizeHistorySubScore,
  normalizeStoredSubScore,
  type HistoricalMonth,
} from "./seismographUnified";

function month(overrides: Partial<HistoricalMonth> = {}): HistoricalMonth {
  return {
    month: "2026-09", score: 33, regime: "MODERATE RISK",
    liquidity: 29, credit: 25, volatility: 28, macro: 44, breadth: 22, aiBubble: 30,
    baaSpread: null, hySpread: null, tsy10y: null, tsy2y: null, fedfunds: null, cpiYoy: null,
    unemployment: null, sp500: null,
    ...overrides,
  };
}

describe("normalizeStoredSubScore", () => {
  it("keeps an observed reading, including a computed floor of 0", () => {
    expect(normalizeStoredSubScore(29)).toBe(29);
    expect(normalizeStoredSubScore(50)).toBe(50);
    expect(normalizeStoredSubScore(15)).toBe(15);
    expect(normalizeStoredSubScore(0)).toBe(0);
  });

  it("withholds null, undefined, and non-finite values", () => {
    expect(normalizeStoredSubScore(null)).toBeNull();
    expect(normalizeStoredSubScore(undefined)).toBeNull();
    expect(normalizeStoredSubScore(Number.NaN)).toBeNull();
    expect(normalizeStoredSubScore(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("May 2026 sentinel", () => {
  it("treats the documented zero columns as missing only on the May 2026 row", () => {
    expect(normalizeHistorySubScore(0, "2026-05", "liquidity")).toBeNull();
    expect(normalizeHistorySubScore(0, "2026-05", "credit")).toBeNull();
    expect(normalizeHistorySubScore(0, "2026-05", "macro")).toBeNull();
    expect(normalizeHistorySubScore(0, "2026-05", "breadth")).toBeNull();
    expect(normalizeHistorySubScore(0, "2026-05", "volatility")).toBe(0);
    expect(normalizeHistorySubScore(0, "2026-05", "aiBubble")).toBe(0);
    expect(normalizeHistorySubScore(22, "2026-05", "liquidity")).toBe(22);
  });

  it("keeps a computed 0 on every other month", () => {
    expect(normalizeHistorySubScore(0, "2026-04", "liquidity")).toBe(0);
    expect(normalizeHistorySubScore(0, "2026-06", "macro")).toBe(0);
    expect(normalizeHistorySubScore(null, "2026-09", "credit")).toBeNull();
  });
});

describe("carry-forward", () => {
  it("does not replace an observed 0 with the previous row", () => {
    expect(carryForwardMissingSubScore(0, 29)).toBe(0);
    expect(carryForwardMissingSubScore(null, 29)).toBe(29);
    expect(carryForwardMissingSubScore(null, null)).toBeNull();
  });
});

describe("missing sub-score evidence is omitted", () => {
  it("does not publish a 50/100 family for a missing liquidity score", () => {
    const history = Array.from({ length: 6 }, () => month({ liquidity: null }));
    const families = buildEvidenceFamilies(month({ liquidity: null }), history);
    expect(families.find(family => family.name === "Liquidity Conditions")).toBeUndefined();
    expect(families.some(family => family.strength === 50 && family.name === "Liquidity Conditions")).toBe(false);
  });

  it("publishes an observed liquidity floor as 0/100", () => {
    const history = Array.from({ length: 6 }, () => month({ liquidity: 0 }));
    const family = buildEvidenceFamilies(month({ liquidity: 0 }), history).find(item => item.name === "Liquidity Conditions");
    expect(family?.strength).toBe(0);
    expect(family?.currentValue).toBe("0/100");
    expect(family?.historicalContext).toContain("6-month average: 0/100.");
  });

  it("keeps an observed liquidity score", () => {
    const history = Array.from({ length: 6 }, () => month());
    const family = buildEvidenceFamilies(month(), history).find(item => item.name === "Liquidity Conditions");
    expect(family?.strength).toBe(29);
    expect(family?.currentValue).toBe("29/100");
  });
});
