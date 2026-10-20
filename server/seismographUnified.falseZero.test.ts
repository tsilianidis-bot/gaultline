/**
 * A stored sub-score is an observation only when the available inputs support it.
 * A finite 0 that recomputes to the v1 floor stays. A 0 the inputs rule out is a
 * sentinel. A 0 the inputs cannot decide is unverifiable and is withheld with
 * the reason. Null and non-finite values are missing. Carry-forward runs only
 * for a missing cell.
 *
 * May 2026 evidence is the FRED fixture fred-2026-10-12-deep.json, not a month
 * switch. CPI, PPI, and Fed Funds recompute macro to 48. Unemployment 4.3 keeps
 * credit at least 3 and breadth at least 11 even with HY and the 10Y at their
 * formula floors. HY and SOFR in that fixture begin 2026-07-17, so liquidity 0
 * for May 2026 is unverifiable.
 */
import { describe, expect, it } from "vitest";
import { assessStoredSubScore } from "./pressure/engine";
import { fredFixtureInputsForMonth, fredFixtureSeriesStart } from "./pressure/fredFixtureEvidence";
import {
  buildEvidenceFamilies,
  carryForwardMissingSubScore,
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
  it("keeps a finite reading, including 0, and withholds null and non-finite values", () => {
    expect(normalizeStoredSubScore(0)).toBe(0);
    expect(normalizeStoredSubScore(29)).toBe(29);
    expect(normalizeStoredSubScore(null)).toBeNull();
    expect(normalizeStoredSubScore(undefined)).toBeNull();
    expect(normalizeStoredSubScore(Number.NaN)).toBeNull();
  });
});

describe("stored sub-score evidence", () => {
  const may = fredFixtureInputsForMonth("2026-05");

  it("documents that HY and SOFR evidence starts on 2026-07-17", () => {
    expect(fredFixtureSeriesStart("BAMLH0A0HYM2")).toBe("2026-07-17");
    expect(fredFixtureSeriesStart("SOFR")).toBe("2026-07-17");
    expect(may.evidence).toContain("2026-07-17");
    expect(may.inputs.hySpreadBps).toBeNull();
    expect(may.inputs.sofr).toBeNull();
    expect(may.inputs.unemployment).toBe(4.3);
    expect(may.inputs.fedFunds).toBe(3.63);
  });

  it("treats May 2026 credit, macro, and breadth zeros as sentinels and liquidity 0 as unverifiable", () => {
    const macro = assessStoredSubScore("macro", 0, may.inputs, may.evidence);
    const credit = assessStoredSubScore("credit", 0, may.inputs, may.evidence);
    const breadth = assessStoredSubScore("breadth", 0, may.inputs, may.evidence);
    const liquidity = assessStoredSubScore("liquidity", 0, may.inputs, may.evidence);
    expect(macro).toMatchObject({ status: "sentinel", value: null });
    expect(macro.reason).toContain("48");
    expect(credit).toMatchObject({ status: "sentinel", value: null });
    expect(credit.reason).toContain("at least 3");
    expect(breadth).toMatchObject({ status: "sentinel", value: null });
    expect(breadth.reason).toContain("at least 11");
    expect(liquidity).toMatchObject({ status: "unverifiable", value: null });
    expect(liquidity.reason).toContain("unverifiable");
    expect(liquidity.reason).toContain("2026-07-17");
  });

  it("keeps a liquidity 0 that the HY and SOFR floors recompute, and does not carry an unverifiable 0", () => {
    const floor = assessStoredSubScore("liquidity", 0, { hySpreadBps: 180, sofr: 1.5 }, "HY and SOFR at the floor.");
    expect(floor).toMatchObject({ status: "observed", value: 0 });
    const unverifiable = assessStoredSubScore("liquidity", 0, {}, "No HY or SOFR observation.");
    expect(unverifiable.status).toBe("unverifiable");
    expect(carryForwardMissingSubScore(floor, 29)).toBe(0);
    expect(carryForwardMissingSubScore(unverifiable, 29)).toBeNull();
    expect(carryForwardMissingSubScore({ status: "missing", value: null, reason: "No finite stored sub-score." }, 29)).toBe(29);
    expect(assessStoredSubScore("macro", 48, may.inputs, may.evidence)).toMatchObject({ status: "observed", value: 48 });
    expect(assessStoredSubScore("liquidity", 22, may.inputs, may.evidence)).toMatchObject({ status: "observed", value: 22 });
  });
});

describe("missing sub-score evidence is omitted", () => {
  it("does not publish a 50/100 family for a missing liquidity score", () => {
    const history = Array.from({ length: 6 }, () => month({ liquidity: null }));
    const families = buildEvidenceFamilies(month({ liquidity: null }), history);
    expect(families.find(family => family.name === "Liquidity Conditions")).toBeUndefined();
  });

  it("publishes a confirmed liquidity floor as 0/100", () => {
    const history = Array.from({ length: 6 }, () => month({ liquidity: 0 }));
    const family = buildEvidenceFamilies(month({ liquidity: 0 }), history).find(item => item.name === "Liquidity Conditions");
    expect(family?.strength).toBe(0);
    expect(family?.currentValue).toBe("0/100");
  });

  it("keeps an observed liquidity score", () => {
    const history = Array.from({ length: 6 }, () => month());
    const family = buildEvidenceFamilies(month(), history).find(item => item.name === "Liquidity Conditions");
    expect(family?.currentValue).toBe("29/100");
  });
});
