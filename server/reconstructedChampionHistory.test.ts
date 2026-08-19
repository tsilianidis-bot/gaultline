import { describe, expect, it } from "vitest";
import { buildReconstructedMonth, selectPriorReleasedMonthly, selectSameMonthDaily } from "./reconstructedChampionHistory";

const point = (date: string, value: number) => ({ date, value, sourceClass: "CURRENT_OFFICIAL_REVISED" as const, sourceUrl: "https://example.test", transformation: "test", metadata: {} });

describe("Reconstructed Champion V1 history", () => {
  it("uses the latest daily value within the same calendar month and refuses an undocumented cross-month carry", () => {
    const points = new Map([ ["2018-02-28", point("2018-02-28", 1.4)] ]);
    expect(selectSameMonthDaily(points, "2018-02")).toMatchObject({ value: 1.4 });
    expect(selectSameMonthDaily(points, "2018-03")).toBeNull();
  });

  it("uses a conservative prior-reference-month value for monthly releases", () => {
    const points = new Map([ ["2000-01-01", point("2000-01-01", 100)], ["2000-02-01", point("2000-02-01", 101)] ]);
    expect(selectPriorReleasedMonthly(points, "2000-02")).toMatchObject({ date: "2000-01-01" });
  });

  it("persists an incomplete month rather than filling the explicit March 2018 funding-data gap", () => {
    const populated = new Map([["2018-03-30", point("2018-03-30", 3)]]);
    const monthly = new Map([["2018-02-01", point("2018-02-01", 100)], ["2017-02-01", point("2017-02-01", 95)]]);
    const result = buildReconstructedMonth("2018-03", { BAMLH0A0HYM2: populated, SOFR: new Map(), DGS10: populated, DGS2: populated, CPIAUCSL: monthly, PPIACO: monthly, FEDFUNDS: monthly, UNRATE: monthly });
    expect(result.scoreStatus).toBe("INCOMPLETE");
    expect(result.missingFlags).toContain("sofr");
  });
});
