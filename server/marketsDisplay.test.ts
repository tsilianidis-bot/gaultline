import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  UNAVAILABLE_LABEL,
  advancingShare,
  cryptoRiskRelationship,
  displaySummaryValue,
  dollarEquityRelationship,
  formatSpread,
  isFiniteNumber,
  isUsableObservation,
  rateEquityRelationship,
  rutVersusSpxSpread,
  usableChangePercent,
  usEquitiesRead,
} from "../shared/marketsDisplay";

describe("Markets missing-data display", () => {
  it("treats null, undefined, and non-finite values as unusable without coercing to zero", () => {
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(usableChangePercent(null)).toBeNull();
    expect(usableChangePercent(undefined)).toBeNull();
    expect(usableChangePercent(Number.NaN)).toBeNull();
    expect(isUsableObservation({ changePercent: null })).toBe(false);
    expect(isUsableObservation({ changePercent: 0 })).toBe(true);
    expect(isUsableObservation({ changePercent: 1.2, freshnessState: "UNAVAILABLE" })).toBe(false);
  });

  it("preserves a genuine zero change as a usable observation", () => {
    expect(usableChangePercent(0)).toBe(0);
    expect(isUsableObservation({ symbol: "^GSPC", changePercent: 0, freshnessState: "LIVE" })).toBe(true);
  });

  it("shows Unavailable advancing share when every U.S. index observation is missing", () => {
    const result = advancingShare([
      { symbol: "^GSPC", changePercent: null, freshnessState: "UNAVAILABLE" },
      { symbol: "^RUT", changePercent: undefined },
      { symbol: "^DJI", changePercent: Number.NaN },
    ]);
    expect(result.percent).toBeNull();
    expect(result.sampleSize).toBe(0);
  });

  it("computes advancing share from partial data and keeps a genuine zero out of the advancing count", () => {
    const result = advancingShare([
      { symbol: "^GSPC", changePercent: 0, freshnessState: "LIVE" },
      { symbol: "^IXIC", changePercent: 0.4, freshnessState: "DELAYED" },
      { symbol: "^DJI", changePercent: null, freshnessState: "UNAVAILABLE" },
      { symbol: "^RUT", changePercent: -0.2, freshnessState: "LIVE" },
    ]);
    expect(result.sampleSize).toBe(3);
    expect(result.percent).toBeCloseTo(100 / 3, 5);
  });

  it("withholds RUT vs SPX when either observation is missing or non-finite", () => {
    expect(rutVersusSpxSpread([
      { symbol: "^GSPC", changePercent: 0.5, freshnessState: "LIVE" },
    ])).toEqual({ spread: null, commentary: null });
    expect(rutVersusSpxSpread([
      { symbol: "^GSPC", changePercent: 0.5, freshnessState: "LIVE" },
      { symbol: "^RUT", changePercent: null, freshnessState: "UNAVAILABLE" },
    ])).toEqual({ spread: null, commentary: null });
    expect(formatSpread(null)).toBe(UNAVAILABLE_LABEL);
  });

  it("computes RUT vs SPX only from two valid observations, including genuine zeros and negatives", () => {
    const zeros = rutVersusSpxSpread([
      { symbol: "^GSPC", changePercent: 0, freshnessState: "LIVE" },
      { symbol: "^RUT", changePercent: 0, freshnessState: "LIVE" },
    ]);
    expect(zeros.spread).toBe(0);
    expect(zeros.commentary).toBe("Small and large caps roughly in line");

    const outperformance = rutVersusSpxSpread([
      { symbol: "^GSPC", changePercent: -0.1, freshnessState: "DELAYED" },
      { symbol: "^RUT", changePercent: 0.5, freshnessState: "DELAYED" },
    ]);
    expect(outperformance.spread).toBeCloseTo(0.6, 5);
    expect(outperformance.commentary).toContain("Small caps outperforming");

    const lag = rutVersusSpxSpread([
      { symbol: "^GSPC", changePercent: 0.8, freshnessState: "LIVE" },
      { symbol: "^RUT", changePercent: -0.2, freshnessState: "LIVE" },
    ]);
    expect(lag.spread).toBeCloseTo(-1.0, 5);
    expect(lag.commentary).toContain("Large caps leading");
  });

  it("does not invent Mixed, Neutral, or directional reads from missing inputs", () => {
    expect(usEquitiesRead("unavailable")).toBeNull();
    expect(usEquitiesRead(undefined)).toBeNull();
    expect(displaySummaryValue("unavailable")).toBe(UNAVAILABLE_LABEL);
    expect(dollarEquityRelationship("unavailable", "risk-on")).toBe(UNAVAILABLE_LABEL);
    expect(rateEquityRelationship("rising", "unavailable")).toBe(UNAVAILABLE_LABEL);
    expect(cryptoRiskRelationship(undefined, "risk-on")).toBe(UNAVAILABLE_LABEL);
    expect(dollarEquityRelationship("strengthening", "risk-on")).toContain("Divergence");
  });

  it("keeps Markets.tsx on the missing-data helpers instead of coercing to zero", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Markets.tsx"), "utf8");
    expect(source).toContain("advancingShare");
    expect(source).toContain("rutVersusSpxSpread");
    expect(source).not.toContain("changePercent ?? 0");
    expect(source).not.toContain("usLive.length > 0");
    expect(source).not.toContain(": \"Neutral\"");
    expect(source).not.toContain(": \"Mixed\"");
  });
});
