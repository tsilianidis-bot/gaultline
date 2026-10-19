import { beforeEach, describe, expect, it, vi } from "vitest";
import { COINGECKO_DAILY_CLOSE_BUFFER_MS, completedCoinDailyBars, type CoinOHLCBar } from "./coingeckoProxy";
import { completedYahooDailyBars, type YahooDailyBar } from "./yahooProxy";

const candle = (timestamp: number): CoinOHLCBar => ({ timestamp, open: 100, high: 101, low: 99, close: 100.5 });
const bar = (timestamp: number): YahooDailyBar => ({ timestamp, open: 100, high: 101, low: 99, close: 100.5, volume: 1 });

describe("completed-candle admission", () => {
  it("keeps only CoinGecko daily candles closed before the documented availability buffer", () => {
    const now = Date.parse("2026-10-19T01:00:00.000Z");
    expect(completedCoinDailyBars([
      candle(now - COINGECKO_DAILY_CLOSE_BUFFER_MS - 1),
      candle(now - COINGECKO_DAILY_CLOSE_BUFFER_MS + 1),
      candle(now + 1),
    ], now).map(item => item.timestamp)).toEqual([now - COINGECKO_DAILY_CLOSE_BUFFER_MS - 1]);
  });

  it("excludes Yahoo’s active New York calendar session even when a provider supplies a bar", () => {
    const duringFriday = Date.parse("2026-10-16T19:30:00.000Z"); // 3:30 PM ET
    const thursdayClose = Date.parse("2026-10-15T20:00:00.000Z");
    const fridayOpen = Date.parse("2026-10-16T13:30:00.000Z");
    expect(completedYahooDailyBars([bar(thursdayClose), bar(fridayOpen)], duringFriday).map(item => item.timestamp)).toEqual([thursdayClose]);
  });

  it("compares New York dates correctly across a month boundary", () => {
    const now = Date.parse("2026-11-02T15:00:00.000Z");
    const oct30 = Date.parse("2026-10-30T13:30:00.000Z");
    const nov2 = Date.parse("2026-11-02T14:30:00.000Z");
    expect(completedYahooDailyBars([bar(oct30), bar(nov2)], now).map(item => item.timestamp)).toEqual([oct30]);
  });
});


describe("completed-candle provider admission", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("requests CoinGecko daily bars and excludes a still-unavailable candle", async () => {
    const now = Date.now();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        [now - COINGECKO_DAILY_CLOSE_BUFFER_MS - 1, 100, 101, 99, 100.5],
        [now, 101, 102, 100, 101.5],
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
    const { getCoinOHLC } = await import("./coingeckoProxy");
    const bars = await getCoinOHLC("BTC");
    expect(String(fetchMock.mock.calls[0][0])).toContain("interval=daily");
    expect(bars).toHaveLength(1);
  });
});
