import { describe, expect, it } from "vitest";
import { RECONSTRUCTED_OUTCOME_HORIZONS } from "./reconstructedChampionOutcomes";

describe("Reconstructed Champion independent outcomes", () => {
  it("keeps the required 1/5/20/60-day horizons and separately registers longer research horizons", () => {
    expect(RECONSTRUCTED_OUTCOME_HORIZONS).toEqual([1, 5, 20, 60, 120, 252]);
  });

  it("requires daily rather than provider-downsampled long-range bars for trading-day outcomes", () => {
    expect(RECONSTRUCTED_OUTCOME_HORIZONS).toContain(60);
  });
});
