import { describe, expect, it } from "vitest";
import { describeHistoricalPercentile, formatHistoricalPercentile, formatOrdinal } from "../shared/historicalPercentile";

describe("canonical historical percentile formatting", () => {
  it("uses correct ordinal suffixes at the known edge cases", () => {
    expect(formatOrdinal(1)).toBe("1st");
    expect(formatOrdinal(2)).toBe("2nd");
    expect(formatOrdinal(3)).toBe("3rd");
    expect(formatOrdinal(11)).toBe("11th");
    expect(formatOrdinal(13)).toBe("13th");
    expect(formatOrdinal(23)).toBe("23rd");
  });

  it("keeps qualitative labels consistent with the numeric percentile", () => {
    expect(describeHistoricalPercentile(3)).toBe("exceptionally low");
    expect(describeHistoricalPercentile(50)).toBe("typical");
    expect(describeHistoricalPercentile(85)).toBe("historically elevated");
    expect(formatHistoricalPercentile(3)).toContain("3rd historical percentile (exceptionally low)");
  });
});
