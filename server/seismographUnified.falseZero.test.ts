/**
 * Missing stored sub-scores stay unavailable.
 * A DB 0 means "not computed", not zero stress and not a neutral 50.
 * The latest row may still carry forward the previous row's observed value.
 * That carry-forward never invents 50.
 */
import { describe, expect, it } from "vitest";
import { buildEvidenceFamilies, normalizeStoredSubScore, type HistoricalMonth } from "./seismographUnified";

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
  it("keeps an observed reading, including a genuine low-stress reading", () => {
    expect(normalizeStoredSubScore(29)).toBe(29);
    expect(normalizeStoredSubScore(50)).toBe(50);
    expect(normalizeStoredSubScore(15)).toBe(15);
  });

  it("withholds null, undefined, non-finite, and the 0 not-computed sentinel", () => {
    expect(normalizeStoredSubScore(0)).toBeNull();
    expect(normalizeStoredSubScore(null)).toBeNull();
    expect(normalizeStoredSubScore(undefined)).toBeNull();
    expect(normalizeStoredSubScore(Number.NaN)).toBeNull();
  });
});

describe("missing sub-score evidence is omitted", () => {
  it("does not publish a 50/100 or 0/100 family for a missing liquidity score", () => {
    const history = Array.from({ length: 6 }, () => month({ liquidity: null }));
    const families = buildEvidenceFamilies(month({ liquidity: null }), history);
    expect(families.find(family => family.name === "Liquidity Conditions")).toBeUndefined();
    expect(families.some(family => family.strength === 50 && family.name === "Liquidity Conditions")).toBe(false);
    expect(families.some(family => family.currentValue.startsWith("0/"))).toBe(false);
  });

  it("keeps an observed liquidity score", () => {
    const history = Array.from({ length: 6 }, () => month());
    const family = buildEvidenceFamilies(month(), history).find(item => item.name === "Liquidity Conditions");
    expect(family?.strength).toBe(29);
    expect(family?.currentValue).toBe("29/100");
  });
});
