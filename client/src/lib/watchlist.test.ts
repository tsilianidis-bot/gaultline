import { describe, expect, it } from "vitest";
import { recordWatchlistBreachTransition, type WatchlistItem } from "./watchlist";

const item: WatchlistItem = {
  id: "yield-10y",
  indicatorKey: "yield10Y",
  thresholdValue: 5,
  condition: "above",
  severity: "high",
  createdAt: 1,
  breachCount: 2,
};

describe("recordWatchlistBreachTransition", () => {
  it("records only an observed non-breach to breach transition", () => {
    expect(recordWatchlistBreachTransition(item, undefined, true, 100)).toBe(item);
    expect(recordWatchlistBreachTransition(item, true, true, 101)).toBe(item);
    expect(recordWatchlistBreachTransition(item, true, false, 102)).toBe(item);

    expect(recordWatchlistBreachTransition(item, false, true, 103)).toEqual({
      ...item,
      breachCount: 3,
      lastBreached: 103,
    });
  });
});
