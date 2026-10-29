import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { YahooQuote } from "../yahooProxy";

const providers = vi.hoisted(() => ({
  getQuotes: vi.fn(),
  fetchFredBulk: vi.fn(),
  getGlobalStats: vi.fn(),
}));

vi.mock("../yahooProxy", () => ({ getQuotes: providers.getQuotes }));
vi.mock("../fredClient", () => ({ fetchFredBulk: providers.fetchFredBulk }));
vi.mock("../coingeckoProxy", () => ({ getGlobalStats: providers.getGlobalStats }));

import { GLOBAL_INSTRUMENTS, classifyFreshness, freshnessForYahooQuote, getGlobalMarketSnapshot } from "./markets";

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const receipt = (ms: number) => new Date(ms).toISOString();
type SeriesReceipts = Partial<Record<"DGS2" | "DGS10" | "DGS30", number | null | undefined>>;
const fredBulk = (date: string, receipts: SeriesReceipts = {}, timestamp = receipt(NOW)) => ({
  timestamp,
  results: Object.fromEntries(["DGS2", "DGS10", "DGS30"].map((id, index) => [id, {
    cached: true,
    // This is the fredClient adapter contract: receipt evidence belongs to the
    // individual result, while bulk.timestamp is composition compatibility.
    fetchedAt: Object.hasOwn(receipts, id) ? receipts[id as keyof SeriesReceipts] : NOW - 60_000,
    observations: [{ date, value: String(4 + index / 10) }, { date: "2026-10-27", value: String(3.9 + index / 10) }],
  }])),
});
const globalStats = (overrides: Record<string, unknown> = {}) => ({
  totalMarketCap: 2_500_000_000_000,
  totalVolume24h: 100_000_000_000,
  btcDominance: 55,
  ethDominance: 18,
  marketCapChangePercent24h: 1.2,
  activeCryptocurrencies: 10_000,
  markets: 800,
  observedAt: NOW - 60_000,
  fetchedAt: NOW - 60_000,
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  providers.getQuotes.mockResolvedValue([]);
  providers.fetchFredBulk.mockResolvedValue(fredBulk("2026-10-28"));
  providers.getGlobalStats.mockResolvedValue(globalStats());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

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
    expect(classifyFreshness({ price: 4.3, isDelayed: true, fetchedAt: now, observedDate: "1970-01-01", provider: "fred", state: "CLOSED", now })).toBe("LATEST_VERIFIED");
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

  it("rejects blank or malformed FRED values instead of coercing them to zero, while retaining an explicit zero", async () => {
    const bulk = fredBulk("2026-10-28");
    bulk.results.DGS2.observations = [
      { date: "2026-10-28", value: " " },
      { date: "2026-10-27", value: "not-a-number" },
    ];
    bulk.results.DGS10.observations = [
      { date: "2026-10-28", value: "0" },
      { date: "2026-10-27", value: "0.1" },
    ];
    providers.fetchFredBulk.mockResolvedValue(bulk);

    const snapshot = await getGlobalMarketSnapshot(true);
    const twoYear = snapshot.items.find(item => item.symbol === "FRED:DGS2");
    const tenYear = snapshot.items.find(item => item.symbol === "FRED:DGS10");

    expect(twoYear).toMatchObject({ price: null, observedDate: null, freshnessState: "UNAVAILABLE" });
    expect(tenYear).toMatchObject({ price: 0, observedDate: "2026-10-28", freshnessState: "LATEST_VERIFIED" });
  });

  it("uses each FRED series receipt rather than the newer bulk composition timestamp", async () => {
    const oldReceipt = NOW - 8 * 24 * 60 * 60 * 1000;
    providers.fetchFredBulk.mockResolvedValue(fredBulk("2026-10-20", {
      DGS2: oldReceipt,
      DGS10: oldReceipt,
      DGS30: oldReceipt,
    }, receipt(NOW)));

    const snapshot = await getGlobalMarketSnapshot(true);
    const twoYear = snapshot.items.find(item => item.symbol === "FRED:DGS2");

    expect(snapshot.fetchedAt).toBe(NOW);
    expect(twoYear).toMatchObject({
      observedAt: null,
      observedDate: "2026-10-20",
      fetchedAt: oldReceipt,
      cacheState: "STALE",
      freshnessState: "STALE",
    });
    expect(twoYear?.fetchedAt).not.toBe(snapshot.fetchedAt);
  });

  it("keeps mixed fresh and old FRED series receipts and derives the curve from the oldest input receipt", async () => {
    const freshReceipt = NOW - 60_000;
    const oldCachedReceipt = NOW - 8 * 24 * 60 * 60 * 1000;
    providers.fetchFredBulk.mockResolvedValue(fredBulk("2026-10-28", {
      DGS2: freshReceipt,
      DGS10: oldCachedReceipt,
      DGS30: null,
    }, receipt(NOW)));

    const snapshot = await getGlobalMarketSnapshot(true);
    const twoYear = snapshot.items.find(item => item.symbol === "FRED:DGS2");
    const tenYear = snapshot.items.find(item => item.symbol === "FRED:DGS10");
    const thirtyYear = snapshot.items.find(item => item.symbol === "FRED:DGS30");
    const curve = snapshot.items.find(item => item.symbol === "DERIVED:2Y10Y");

    expect(twoYear).toMatchObject({ fetchedAt: freshReceipt, cacheState: "FRESH" });
    expect(tenYear).toMatchObject({ fetchedAt: oldCachedReceipt, cacheState: "STALE" });
    expect(thirtyYear).toMatchObject({ fetchedAt: null, cacheState: "UNAVAILABLE" });
    expect(curve).toMatchObject({ fetchedAt: oldCachedReceipt, cacheState: "STALE" });
    expect(curve?.fetchedAt).not.toBe(snapshot.fetchedAt);
  });

  it("does not manufacture a curve receipt from bulk composition time when an input receipt is missing", async () => {
    providers.fetchFredBulk.mockResolvedValue(fredBulk("2026-10-28", {
      DGS2: NOW - 60_000,
      DGS10: null,
      DGS30: NOW - 60_000,
    }, receipt(NOW)));

    const snapshot = await getGlobalMarketSnapshot(true);
    const tenYear = snapshot.items.find(item => item.symbol === "FRED:DGS10");
    const curve = snapshot.items.find(item => item.symbol === "DERIVED:2Y10Y");

    expect(tenYear).toMatchObject({ fetchedAt: null, cacheState: "UNAVAILABLE" });
    expect(curve).toMatchObject({ fetchedAt: null, cacheState: "UNAVAILABLE" });
    expect(curve?.fetchedAt).not.toBe(snapshot.fetchedAt);
  });

  it("uses CoinGecko observedAt for source freshness while exposing a newer cache receipt separately", async () => {
    const providerObservedAt = NOW - 13 * 60 * 1000;
    const cacheReceiptAt = NOW - 60_000;
    providers.getGlobalStats.mockResolvedValue(globalStats({ observedAt: providerObservedAt, fetchedAt: cacheReceiptAt }));

    const snapshot = await getGlobalMarketSnapshot(true);
    const totalCap = snapshot.items.find(item => item.symbol === "CG:TOTAL_MC");

    expect(totalCap).toMatchObject({
      observedAt: providerObservedAt,
      observedDate: null,
      fetchedAt: cacheReceiptAt,
      cacheState: "FRESH",
      freshnessState: "STALE",
    });
  });

  it("fails closed when a FRED observation date or CoinGecko observation timestamp is missing", async () => {
    providers.fetchFredBulk.mockResolvedValue(fredBulk(""));
    providers.getGlobalStats.mockResolvedValue(globalStats({ observedAt: null }));

    const snapshot = await getGlobalMarketSnapshot(true);
    const twoYear = snapshot.items.find(item => item.symbol === "FRED:DGS2");
    const totalCap = snapshot.items.find(item => item.symbol === "CG:TOTAL_MC");

    expect(twoYear).toMatchObject({ price: null, observedDate: null, freshnessState: "UNAVAILABLE" });
    expect(totalCap).toMatchObject({ price: null, observedAt: null, freshnessState: "UNAVAILABLE", cacheState: "FRESH" });
  });

  it("fails closed when a FRED date or CoinGecko provider timestamp is in the future", async () => {
    providers.fetchFredBulk.mockResolvedValue(fredBulk("2026-10-29"));
    providers.getGlobalStats.mockResolvedValue(globalStats({ observedAt: NOW + 1 }));

    const snapshot = await getGlobalMarketSnapshot(true);
    const twoYear = snapshot.items.find(item => item.symbol === "FRED:DGS2");
    const totalCap = snapshot.items.find(item => item.symbol === "CG:TOTAL_MC");

    expect(twoYear).toMatchObject({ price: null, observedDate: null, freshnessState: "UNAVAILABLE" });
    expect(totalCap).toMatchObject({ price: null, observedAt: null, freshnessState: "UNAVAILABLE" });
  });
});
