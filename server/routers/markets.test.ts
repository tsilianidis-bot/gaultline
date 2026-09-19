import { describe, expect, it } from "vitest";
import type { YahooQuote } from "../yahooProxy";
import { GLOBAL_INSTRUMENTS, classifyFreshness, freshnessForYahooQuote } from "./markets";

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
    expect(classifyFreshness({ price: Number.NaN, isDelayed: false, fetchedAt: now, provider: "yahoo", state: "REGULAR", now })).toBe("UNAVAILABLE");
    expect(classifyFreshness({ price: 100, isDelayed: false, fetchedAt: now - 13 * 60 * 1000, provider: "yahoo", state: "REGULAR", now })).toBe("STALE");
    expect(classifyFreshness({ price: 4.3, isDelayed: true, fetchedAt: now, provider: "fred", state: "CLOSED", now })).toBe("LATEST_VERIFIED");
  });

  it("does not treat a non-finite overlay print as mixed or live", () => {
    expect(Number.isNaN(Number.NaN)).toBe(true);
    expect(Number.NaN != null).toBe(true);
    expect(classifyFreshness({
      price: Number.NaN,
      isDelayed: false,
      fetchedAt: 1_000_000,
      provider: "yahoo",
      state: "REGULAR",
      now: 1_000_000,
    })).toBe("UNAVAILABLE");
  });

  it("treats a failed Yahoo ^GSPC observation as UNAVAILABLE, not a live zero", () => {
    expect(GLOBAL_INSTRUMENTS.find(item => item.symbol === "^GSPC")?.provider).toBe("yahoo");
    const now = 1_000_000;
    expect(classifyFreshness({
      price: null,
      isDelayed: true,
      fetchedAt: now,
      provider: "yahoo",
      state: "UNKNOWN",
      now,
    })).toBe("UNAVAILABLE");
  });

  it("marks failed ^RUT and ^VIX quotes UNAVAILABLE, never LIVE", () => {
    const failed: YahooQuote = {
      ticker: "^RUT",
      price: null,
      prevClose: null,
      open: null,
      high: null,
      low: null,
      volume: null,
      change: null,
      changePercent: null,
      marketState: "UNKNOWN",
      isDelayed: true,
      source: "error",
      fetchedAt: 1_000_000,
      error: "Yahoo index unavailable; Polygon cannot serve this index",
    };
    expect(GLOBAL_INSTRUMENTS.find(item => item.symbol === "^RUT")?.provider).toBe("yahoo");
    expect(GLOBAL_INSTRUMENTS.find(item => item.symbol === "^VIX")?.provider).toBe("yahoo");
    expect(freshnessForYahooQuote(failed)).toBe("UNAVAILABLE");
    expect(freshnessForYahooQuote({ ...failed, ticker: "^VIX" })).toBe("UNAVAILABLE");
    expect(freshnessForYahooQuote(undefined)).toBe("UNAVAILABLE");
  });

  it("never labels an IWM RUT proxy or Polygon prev-close as LIVE", () => {
    const now = 1_000_000;
    const proxy: YahooQuote = {
      ticker: "^RUT",
      price: 284.1,
      prevClose: 284.1,
      open: 283,
      high: 285,
      low: 282,
      volume: 2_000_000,
      change: null,
      changePercent: null,
      marketState: "CLOSED",
      isDelayed: false,
      source: "polygon-prev",
      proxySymbol: "IWM",
      fetchedAt: now,
    };
    expect(freshnessForYahooQuote(proxy, now)).toBe("DELAYED");
    expect(freshnessForYahooQuote({ ...proxy, proxySymbol: undefined, isDelayed: false }, now)).toBe("DELAYED");
  });
});
