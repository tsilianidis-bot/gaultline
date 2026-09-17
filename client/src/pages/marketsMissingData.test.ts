import { describe, expect, it } from "vitest";
import {
  advancingShare,
  cryptoRiskRelationship,
  dollarEquityRelationship,
  isFiniteNumber,
  isUsableChangeObservation,
  rateEquityRelationship,
  rutSpxCommentary,
  rutVersusSpxSpread,
  usEquitiesCommentary,
} from "./marketsMissingData";

describe("isFiniteNumber", () => {
  it("accepts genuine zeros and signed values", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-0)).toBe(true);
    expect(isFiniteNumber(1.25)).toBe(true);
    expect(isFiniteNumber(-0.4)).toBe(true);
  });

  it("rejects null, undefined, and non-finite values", () => {
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
    expect(isFiniteNumber("0")).toBe(false);
  });
});

describe("isUsableChangeObservation", () => {
  it("keeps genuine zero percents when the quote is available", () => {
    expect(isUsableChangeObservation({ changePercent: 0, freshnessState: "LIVE" })).toBe(true);
    expect(isUsableChangeObservation({ changePercent: 0, freshnessState: "DELAYED" })).toBe(true);
  });

  it("rejects missing and non-finite percents", () => {
    expect(isUsableChangeObservation({ changePercent: null, freshnessState: "LIVE" })).toBe(false);
    expect(isUsableChangeObservation({ changePercent: undefined, freshnessState: "LIVE" })).toBe(false);
    expect(isUsableChangeObservation({ changePercent: NaN, freshnessState: "LIVE" })).toBe(false);
    expect(isUsableChangeObservation({ changePercent: Infinity, freshnessState: "LIVE" })).toBe(false);
    expect(isUsableChangeObservation(null)).toBe(false);
    expect(isUsableChangeObservation(undefined)).toBe(false);
  });

  it("rejects UNAVAILABLE freshness even if a leftover zero is present", () => {
    expect(isUsableChangeObservation({ changePercent: 0, freshnessState: "UNAVAILABLE" })).toBe(false);
    expect(isUsableChangeObservation({ changePercent: 1.2, freshnessState: "UNAVAILABLE" })).toBe(false);
  });
});

describe("advancingShare", () => {
  it("shows unavailable when index data is missing", () => {
    expect(advancingShare([])).toEqual({ status: "unavailable", value: null });
    expect(advancingShare([
      { changePercent: null, freshnessState: "UNAVAILABLE" },
      { changePercent: undefined, freshnessState: "LIVE" },
      { changePercent: NaN, freshnessState: "LIVE" },
      { changePercent: Infinity, freshnessState: "DELAYED" },
    ])).toEqual({ status: "unavailable", value: null });
  });

  it("uses only the valid subset when some indices are missing", () => {
    expect(advancingShare([
      { changePercent: 0.8, freshnessState: "LIVE" },
      { changePercent: null, freshnessState: "UNAVAILABLE" },
      { changePercent: -0.4, freshnessState: "LIVE" },
      { changePercent: NaN, freshnessState: "DELAYED" },
    ])).toEqual({ status: "ok", value: 50 });
  });

  it("preserves genuine zeros as 0% advancing", () => {
    expect(advancingShare([
      { changePercent: 0, freshnessState: "LIVE" },
      { changePercent: 0, freshnessState: "DELAYED" },
      { changePercent: -0.01, freshnessState: "LIVE" },
    ])).toEqual({ status: "ok", value: 0 });
  });

  it("counts valid positive and negative observations", () => {
    expect(advancingShare([
      { changePercent: 1.1, freshnessState: "LIVE" },
      { changePercent: 0.2, freshnessState: "LIVE" },
      { changePercent: -0.5, freshnessState: "LIVE" },
      { changePercent: -1.4, freshnessState: "LATEST_VERIFIED" },
    ])).toEqual({ status: "ok", value: 50 });
    expect(advancingShare([
      { changePercent: 0.4, freshnessState: "LIVE" },
      { changePercent: 0.1, freshnessState: "LIVE" },
    ])).toEqual({ status: "ok", value: 100 });
  });
});

describe("rutVersusSpxSpread", () => {
  it("omits the spread when either observation is missing or non-finite", () => {
    expect(rutVersusSpxSpread(undefined, { changePercent: 0.4, freshnessState: "LIVE" })).toEqual({
      status: "unavailable",
      value: null,
    });
    expect(rutVersusSpxSpread({ changePercent: 0.5, freshnessState: "LIVE" }, null)).toEqual({
      status: "unavailable",
      value: null,
    });
    expect(rutVersusSpxSpread(
      { changePercent: NaN, freshnessState: "LIVE" },
      { changePercent: 0.4, freshnessState: "LIVE" },
    )).toEqual({ status: "unavailable", value: null });
    expect(rutVersusSpxSpread(
      { changePercent: 0.5, freshnessState: "UNAVAILABLE" },
      { changePercent: 0.4, freshnessState: "LIVE" },
    )).toEqual({ status: "unavailable", value: null });
  });

  it("calculates the spread only when both observations are valid and comparable", () => {
    expect(rutVersusSpxSpread(
      { changePercent: 1.25, freshnessState: "LIVE" },
      { changePercent: 0.25, freshnessState: "LIVE" },
    )).toEqual({ status: "ok", value: 1 });
    expect(rutVersusSpxSpread(
      { changePercent: -1.5, freshnessState: "DELAYED" },
      { changePercent: 0.5, freshnessState: "LIVE" },
    )).toEqual({ status: "ok", value: -2 });
  });

  it("preserves genuine zeros on either side of the spread", () => {
    expect(rutVersusSpxSpread(
      { changePercent: 0, freshnessState: "LIVE" },
      { changePercent: 0, freshnessState: "LIVE" },
    )).toEqual({ status: "ok", value: 0 });
    expect(rutVersusSpxSpread(
      { changePercent: 0, freshnessState: "LIVE" },
      { changePercent: 0.5, freshnessState: "LIVE" },
    )).toEqual({ status: "ok", value: -0.5 });
  });
});

describe("commentary is omitted when inputs are unavailable", () => {
  it("does not emit Mixed, Neutral, or outperformance copy for missing inputs", () => {
    expect(usEquitiesCommentary("unavailable")).toBeNull();
    expect(usEquitiesCommentary(undefined)).toBeNull();
    expect(usEquitiesCommentary(null)).toBeNull();
    expect(rutSpxCommentary(null)).toBeNull();
    expect(rutSpxCommentary(undefined)).toBeNull();
    expect(rutSpxCommentary(NaN)).toBeNull();
    expect(dollarEquityRelationship("unavailable", "risk-on")).toBe("Unavailable");
    expect(rateEquityRelationship(undefined, "risk-on")).toBe("Unavailable");
    expect(cryptoRiskRelationship("positive", "unavailable")).toBe("Unavailable");
    expect(dollarEquityRelationship("unavailable", "unavailable")).not.toMatch(/Neutral|Mixed|outperforming/i);
    expect(cryptoRiskRelationship(null, null)).not.toMatch(/Neutral|Mixed/i);
  });

  it("keeps Mixed and Neutral only when both inputs are present", () => {
    expect(usEquitiesCommentary("mixed")).toMatch(/mixed/i);
    expect(dollarEquityRelationship("stable", "mixed")).toBe("Neutral");
    expect(rateEquityRelationship("stable", "risk-off")).toBe("Neutral");
    expect(cryptoRiskRelationship("mixed", "mixed")).toBe("Mixed");
  });

  it("keeps outperformance copy for valid spreads, including genuine zero", () => {
    expect(rutSpxCommentary(0.5)).toBe("Small caps outperforming — broad participation");
    expect(rutSpxCommentary(-0.5)).toBe("Large caps leading — narrow rally");
    expect(rutSpxCommentary(0)).toBe("Small and large caps roughly in line");
  });

  it("keeps aligned and divergent copy for valid positive and negative regimes", () => {
    expect(dollarEquityRelationship("weakening", "risk-on")).toMatch(/Aligned/);
    expect(dollarEquityRelationship("strengthening", "risk-on")).toMatch(/Divergence/);
    expect(rateEquityRelationship("falling", "risk-on")).toMatch(/Supportive/);
    expect(cryptoRiskRelationship("negative", "risk-on")).toMatch(/Divergence/);
  });
});
