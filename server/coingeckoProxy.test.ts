// ============================================================
// FAULTLINE — CoinGecko Proxy + Crypto Engine Tests
//
// NOTE: Because the proxy and engine modules use module-level
// LRU caches, we use vi.resetModules() + dynamic imports so
// each test gets a fresh module instance with empty caches.
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers ───────────────────────────────────────────────────
function makeCoinMarketItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    image: "https://example.com/btc.png",
    current_price: 70000,
    market_cap: 1_380_000_000_000,
    market_cap_rank: 1,
    fully_diluted_valuation: 1_470_000_000_000,
    total_volume: 35_000_000_000,
    high_24h: 72000,
    low_24h: 68000,
    price_change_24h: 1500,
    price_change_percentage_24h: 2.2,
    price_change_percentage_7d_in_currency: 5.1,
    price_change_percentage_30d_in_currency: 12.3,
    market_cap_change_24h: 30_000_000_000,
    market_cap_change_percentage_24h: 2.2,
    circulating_supply: 19_700_000,
    total_supply: 21_000_000,
    max_supply: 21_000_000,
    ath: 73750,
    ath_change_percentage: -5.1,
    atl: 67.81,
    atl_change_percentage: 103000,
    sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => 65000 + i * 30) },
    last_updated: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeGlobalData() {
  return {
    data: {
      total_market_cap: { usd: 2_500_000_000_000 },
      total_volume: { usd: 120_000_000_000 },
      market_cap_percentage: { btc: 55.2, eth: 17.1 },
      market_cap_change_percentage_24h_usd: -1.5,
      active_cryptocurrencies: 13000,
      markets: 900,
    },
  };
}

function makeSearchData() {
  return {
    coins: [
      { id: "bitcoin",      symbol: "btc", name: "Bitcoin",      thumb: "https://example.com/btc.png", market_cap_rank: 1 },
      { id: "bitcoin-cash", symbol: "bch", name: "Bitcoin Cash", thumb: "https://example.com/bch.png", market_cap_rank: 18 },
    ],
  };
}

function mockOk(data: unknown) {
  return { ok: true, json: async () => data };
}

// ── Tests ─────────────────────────────────────────────────────
describe("CoinGecko Proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  describe("searchCoins", () => {
    it("returns search results from CoinGecko", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(mockOk(makeSearchData()));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { searchCoins } = await import("./coingeckoProxy");
      const results = await searchCoins("bitcoin");

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("bitcoin");
      expect(results[0].symbol).toBe("BTC");
      expect(results[0].marketCapRank).toBe(1);
    });

    it("returns empty array on fetch failure", async () => {
      const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { searchCoins } = await import("./coingeckoProxy");
      const results = await searchCoins("failquery");

      expect(results).toEqual([]);
    });

    it("uppercases symbol in results", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(mockOk({
        coins: [{ id: "ethereum", symbol: "eth", name: "Ethereum", thumb: "", market_cap_rank: 2 }],
      }));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { searchCoins } = await import("./coingeckoProxy");
      const results = await searchCoins("eth");

      expect(results[0].symbol).toBe("ETH");
    });
  });

  describe("getCoinMarketData", () => {
    it("maps raw CoinGecko data to CoinMarketData shape", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(mockOk([makeCoinMarketItem()]));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { getCoinMarketData } = await import("./coingeckoProxy");
      const coin = await getCoinMarketData("BTC");

      expect(coin).not.toBeNull();
      expect(coin!.symbol).toBe("BTC");
      expect(coin!.currentPrice).toBe(70000);
      expect(coin!.volatility24h).toBeCloseTo((72000 - 68000) / 68000 * 100, 1);
      expect(coin!.distanceFromAth).toBeCloseTo(-5.1, 0);
    });

    it("returns null when asset not found", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(mockOk([]));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { getCoinMarketData } = await import("./coingeckoProxy");
      const coin = await getCoinMarketData("NONEXISTENT");

      expect(coin).toBeNull();
    });

    it("returns null on fetch error", async () => {
      const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Timeout"));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { getCoinMarketData } = await import("./coingeckoProxy");
      const coin = await getCoinMarketData("FAILCOIN");

      expect(coin).toBeNull();
    });

    it("resolves BTC symbol to bitcoin id via SYMBOL_MAP", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(mockOk([makeCoinMarketItem({ id: "bitcoin" })]));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { getCoinMarketData } = await import("./coingeckoProxy");
      const coin = await getCoinMarketData("BTC");

      expect(coin).not.toBeNull();
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("bitcoin");
    });
  });

  describe("getGlobalStats", () => {
    it("maps global CoinGecko response to GlobalStats", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(mockOk(makeGlobalData()));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { getGlobalStats } = await import("./coingeckoProxy");
      const stats = await getGlobalStats();

      expect(stats).not.toBeNull();
      expect(stats!.totalMarketCap).toBe(2_500_000_000_000);
      expect(stats!.btcDominance).toBeCloseTo(55.2, 1);
      expect(stats!.activeCryptocurrencies).toBe(13000);
    });

    it("returns null on fetch error", async () => {
      const mockFetch = vi.fn().mockRejectedValueOnce(new Error("CoinGecko down"));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { getGlobalStats } = await import("./coingeckoProxy");
      const stats = await getGlobalStats();

      expect(stats).toBeNull();
    });
  });

  describe("getTopMarkets", () => {
    it("returns array of mapped coins", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(mockOk([
        makeCoinMarketItem(),
        makeCoinMarketItem({ id: "ethereum", symbol: "eth", name: "Ethereum" }),
      ]));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { getTopMarkets } = await import("./coingeckoProxy");
      const coins = await getTopMarkets(2);

      expect(coins).toHaveLength(2);
      expect(coins[0].id).toBe("bitcoin");
    });

    it("returns empty array on failure", async () => {
      const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Rate limited"));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

      const { getTopMarkets } = await import("./coingeckoProxy");
      const coins = await getTopMarkets(10);

      expect(coins).toEqual([]);
    });
  });
});

describe("Crypto Engine", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  describe("computeCryptoSystemicRisk", () => {
    it("returns a valid systemic risk object with score 0–10", async () => {
      const mockFetch = vi.fn()
        // global stats
        .mockResolvedValueOnce(mockOk(makeGlobalData()))
        // top markets
        .mockResolvedValueOnce(mockOk(Array.from({ length: 20 }, (_, i) => makeCoinMarketItem({
          id: `coin-${i}`,
          symbol: `C${i}`,
          price_change_percentage_24h: i % 3 === 0 ? -6 : 2,
        }))));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
      vi.doMock("./pressure/engine", () => ({
        calculateFaultlinePressure: vi.fn().mockResolvedValue({ overallPressure: 45 }),
      }));

      const { computeCryptoSystemicRisk } = await import("./cryptoEngine");
      const risk = await computeCryptoSystemicRisk();

      expect(risk.score).toBeGreaterThanOrEqual(0);
      expect(risk.score).toBeLessThanOrEqual(10);
      expect(["Low", "Moderate", "Elevated", "High", "Critical"]).toContain(risk.level);
      expect(risk.btcDominance).toBeCloseTo(55.2, 1);
      expect(risk.breakdown).toHaveLength(6);
      expect(typeof risk.regime).toBe("string");
    });

    it("handles all fetch failures gracefully (fallback values)", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("All APIs down"));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
      vi.doMock("./pressure/engine", () => ({
        calculateFaultlinePressure: vi.fn().mockRejectedValue(new Error("Pressure engine down")),
      }));

      const { computeCryptoSystemicRisk } = await import("./cryptoEngine");
      const risk = await computeCryptoSystemicRisk();

      expect(risk.score).toBeGreaterThanOrEqual(0);
      expect(risk.score).toBeLessThanOrEqual(10);
    });
  });

  describe("computeAssetIntelligence", () => {
    async function buildSysRisk() {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockOk(makeGlobalData()))
        .mockResolvedValueOnce(mockOk([makeCoinMarketItem()]));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
      vi.doMock("./pressure/engine", () => ({
        calculateFaultlinePressure: vi.fn().mockResolvedValue({ overallPressure: 45 }),
      }));
      const { computeCryptoSystemicRisk } = await import("./cryptoEngine");
      return computeCryptoSystemicRisk();
    }

    it("returns full intelligence object for BTC", async () => {
      vi.resetModules();
      vi.unstubAllGlobals();

      const mockFetch = vi.fn()
        // For systemic risk: global + top markets
        .mockResolvedValueOnce(mockOk(makeGlobalData()))
        .mockResolvedValueOnce(mockOk([makeCoinMarketItem()]))
        // For asset data
        .mockResolvedValueOnce(mockOk([makeCoinMarketItem()]));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
      vi.doMock("./pressure/engine", () => ({
        calculateFaultlinePressure: vi.fn().mockResolvedValue({ overallPressure: 45 }),
      }));

      const { computeAssetIntelligence, computeCryptoSystemicRisk } = await import("./cryptoEngine");
      const sysRisk = await computeCryptoSystemicRisk();
      const intel = await computeAssetIntelligence("BTC", sysRisk);

      expect(intel).not.toBeNull();
      expect(intel!.symbol).toBe("BTC");
      expect(intel!.signalScore).toBeGreaterThanOrEqual(0);
      expect(intel!.signalScore).toBeLessThanOrEqual(100);
      expect(["Bullish", "Neutral", "Bearish"]).toContain(intel!.signalBias);
      expect(intel!.riskScore).toBeGreaterThanOrEqual(0);
      expect(intel!.riskScore).toBeLessThanOrEqual(10);
      expect(["Low", "Moderate", "Elevated", "High", "Critical"]).toContain(intel!.riskLevel);
      expect(["Accelerating", "Stable", "Decelerating", "Reversing"]).toContain(intel!.momentum);
      expect(intel!.primaryLabel).toBeTruthy();
      expect(intel!.vectors.length).toBeGreaterThan(0);
      expect(intel!.keyInsights.length).toBeGreaterThan(0);
    });

    it("returns null when coin data is unavailable", async () => {
      vi.resetModules();
      vi.unstubAllGlobals();

      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockOk(makeGlobalData()))
        .mockResolvedValueOnce(mockOk([makeCoinMarketItem()]))
        // Asset fetch returns empty
        .mockResolvedValueOnce(mockOk([]));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
      vi.doMock("./pressure/engine", () => ({
        calculateFaultlinePressure: vi.fn().mockResolvedValue({ overallPressure: 45 }),
      }));

      const { computeAssetIntelligence, computeCryptoSystemicRisk } = await import("./cryptoEngine");
      const sysRisk = await computeCryptoSystemicRisk();
      const intel = await computeAssetIntelligence("NONEXISTENT999", sysRisk);

      expect(intel).toBeNull();
    });

    it("assigns AI Narrative Exposure label to RNDR", async () => {
      vi.resetModules();
      vi.unstubAllGlobals();

      const rndrItem = makeCoinMarketItem({ id: "render-token", symbol: "rndr", name: "Render" });
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockOk(makeGlobalData()))
        .mockResolvedValueOnce(mockOk([makeCoinMarketItem()]))
        .mockResolvedValueOnce(mockOk([rndrItem]));
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
      vi.doMock("./pressure/engine", () => ({
        calculateFaultlinePressure: vi.fn().mockResolvedValue({ overallPressure: 45 }),
      }));

      const { computeAssetIntelligence, computeCryptoSystemicRisk } = await import("./cryptoEngine");
      const sysRisk = await computeCryptoSystemicRisk();
      const intel = await computeAssetIntelligence("RNDR", sysRisk);

      expect(intel).not.toBeNull();
      const allLabels = [intel!.primaryLabel, ...intel!.secondaryLabels];
      expect(allLabels).toContain("AI Narrative Exposure");
    });
  });
});
