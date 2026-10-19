import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { volatileRangePercent } from "./yahooProxy";

describe("volatile screener does not invent a high or low", () => {
  it("keeps the prior range when high and low are present", () => {
    const high = 110;
    const low = 100;
    expect(volatileRangePercent({
      regularMarketDayHigh: high,
      regularMarketDayLow: low,
      regularMarketOpen: 100,
      regularMarketPrice: 105,
    })).toBe(((high - low) / 100) * 100);
    expect(volatileRangePercent({
      regularMarketDayHigh: high,
      regularMarketDayLow: low,
      regularMarketPrice: 11,
    })).toBe(((high - low) / 11) * 100);
    expect(volatileRangePercent({
      regularMarketDayHigh: 12,
      regularMarketDayLow: 10,
    })).toBe(((12 - 10) / 1) * 100);
    expect(volatileRangePercent({
      regularMarketDayHigh: 0,
      regularMarketDayLow: 0,
      regularMarketOpen: 0,
    })).toBe(0);
  });

  it("drops a quote when high or low is missing instead of copying the price", () => {
    expect(volatileRangePercent({ regularMarketPrice: 11, regularMarketDayLow: 10 })).toBeNull();
    expect(volatileRangePercent({ regularMarketPrice: 11, regularMarketDayHigh: 12 })).toBeNull();
    expect(volatileRangePercent({ regularMarketPrice: 11 })).toBeNull();
    const source = readFileSync("server/yahooProxy.ts", "utf8");
    expect(source).not.toContain("regularMarketDayHigh) ?? finiteQuoteNumber(q.regularMarketPrice) ?? 0");
    expect(source).not.toContain("regularMarketDayLow) ?? finiteQuoteNumber(q.regularMarketPrice) ?? 0");
  });
});
