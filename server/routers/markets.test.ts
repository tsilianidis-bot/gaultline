import { describe, expect, it } from "vitest";
import { GLOBAL_INSTRUMENTS, classifyFreshness } from "./markets";

describe("canonical Global Markets snapshot", () => {
  it("covers the intended cross-asset categories without a simulated instrument", () => {
    const categories = new Set(GLOBAL_INSTRUMENTS.map(item => item.category));
    expect(categories).toEqual(new Set(["us_equity", "volatility", "europe", "asia", "rates", "fx", "commodity", "crypto"]));
    expect(GLOBAL_INSTRUMENTS.find(item => item.symbol === "FRED:DGS2")?.provider).toBe("fred");
    expect(GLOBAL_INSTRUMENTS.find(item => item.symbol === "CG:BTC_DOM")?.provider).toBe("coingecko");
  });

  it("never labels delayed, stale, or unavailable observations as live", () => {
    const now = 1_000_000;
    expect(classifyFreshness({ price: 100, isDelayed: true, fetchedAt: now, provider: "yahoo", state: "REGULAR", now })).toBe("DELAYED");
    expect(classifyFreshness({ price: null, isDelayed: false, fetchedAt: now, provider: "yahoo", state: "REGULAR", now })).toBe("UNAVAILABLE");
    expect(classifyFreshness({ price: 100, isDelayed: false, fetchedAt: now - 13 * 60 * 1000, provider: "yahoo", state: "REGULAR", now })).toBe("STALE");
    expect(classifyFreshness({ price: 4.3, isDelayed: true, fetchedAt: now, provider: "fred", state: "CLOSED", now })).toBe("LATEST_VERIFIED");
  });
});
