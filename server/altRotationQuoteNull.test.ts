import { beforeEach, describe, expect, it, vi } from "vitest";

function json(data: unknown) {
  return { ok: true, json: async () => data };
}

const fullPrices = {
  bitcoin: { usd: 65000, btc: 1, usd_24h_change: 1.2, usd_market_cap: 1_280_000_000_000 },
  ethereum: { usd: 3200, btc: 0.049, usd_24h_change: 2.4, usd_market_cap: 380_000_000_000 },
  tether: { usd: 1, usd_24h_change: 0.01, usd_market_cap: 110_000_000_000 },
  "usd-coin": { usd: 1, usd_24h_change: 0, usd_market_cap: 32_000_000_000 },
};

async function load(fetchImpl: (url: string) => Promise<unknown>) {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => fetchImpl(String(url))));
  const { clearAltRotationCache, computeAltRotation } = await import("./altRotationEngine");
  clearAltRotationCache();
  return computeAltRotation();
}

describe("alt rotation does not zero-fill price, change, cap, or volume", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("keeps observed quotes, including an observed zero change", async () => {
    const payload = await load(async (url) => {
      if (url.includes("/global")) {
        return json({
          data: {
            market_cap_percentage: { btc: 54, eth: 17 },
            total_market_cap: { usd: 2_500_000_000_000 },
            total_volume: { usd: 120_000_000_000 },
            active_cryptocurrencies: 1,
            updated_at: 1,
          },
        });
      }
      if (url.includes("ids=bitcoin")) return json(fullPrices);
      if (url.includes("/simple/price")) {
        return json({
          uniswap: { usd: 8, usd_24h_change: 0, usd_market_cap: 4_000_000_000, usd_24h_vol: 90_000_000 },
        });
      }
      if (url.includes("/coins/markets")) {
        return json([{ id: "uniswap", price_change_percentage_7d_in_currency: 3 }]);
      }
      return json({});
    });
    const uni = payload.sectors.flatMap(sector => sector.coins).find(coin => coin.id === "uniswap");
    expect(uni?.price).toBe(8);
    expect(uni?.change24h).toBe(0);
    expect(uni?.marketCap).toBe(4);
    expect(uni?.volume24h).toBe(90);
    expect(payload.ethLeadership.ethBtcRatio).toBe(parseFloat((0.049).toFixed(5)));
    expect(payload.ethLeadership.ethChange24h).toBe(parseFloat((2.4).toFixed(2)));
    expect(payload.stablecoinLiquidity.usdcChange24h).toBe(0);
    expect(payload.stablecoinLiquidity.usdtMarketCap).toBe(parseFloat((110).toFixed(1)));
    expect(payload.marketBreadth.total2Proxy).toBe(parseFloat(((2_500_000_000_000 / 1e9) - (1_280_000_000_000 / 1e9)).toFixed(0)));
  });

  it("leaves a missing quote null instead of 0", async () => {
    const payload = await load(async (url) => {
      if (url.includes("/global")) {
        return json({
          data: {
            market_cap_percentage: { btc: 54, eth: 17 },
            total_market_cap: {},
            total_volume: { usd: 1 },
            active_cryptocurrencies: 1,
            updated_at: 1,
          },
        });
      }
      if (url.includes("ids=bitcoin")) {
        return json({ bitcoin: { usd: 65000 }, ethereum: {}, tether: {}, "usd-coin": {} });
      }
      if (url.includes("/simple/price")) return json({ uniswap: {} });
      if (url.includes("/coins/markets")) return json([{ id: "uniswap" }]);
      return json({});
    });
    expect(payload.ethLeadership.ethBtcRatio).toBeNull();
    expect(payload.ethLeadership.ethChange24h).toBeNull();
    expect(payload.ethLeadership.btcChange24h).toBeNull();
    expect(payload.ethLeadership.score).toBeNull();
    expect(payload.stablecoinLiquidity.usdtMarketCap).toBeNull();
    expect(payload.stablecoinLiquidity.usdcMarketCap).toBeNull();
    expect(payload.stablecoinLiquidity.combinedChange24h).toBeNull();
    expect(payload.stablecoinLiquidity.score).toBeNull();
    expect(payload.marketBreadth.total2Proxy).toBeNull();
    expect(payload.marketBreadth.total3Proxy).toBeNull();
    const uni = payload.sectors.flatMap(sector => sector.coins).find(coin => coin.id === "uniswap");
    expect(uni).toBeUndefined();
    expect(JSON.stringify(payload.ethLeadership)).not.toMatch(/":0[,}]/);
    expect(JSON.stringify(payload.stablecoinLiquidity)).not.toContain('"usdtMarketCap":0');
  });
});
