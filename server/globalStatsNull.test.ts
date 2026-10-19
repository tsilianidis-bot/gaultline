import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("missing global market totals", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("keeps a missing market cap, volume, and 24h change null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        total_market_cap: {},
        total_volume: {},
        market_cap_percentage: { btc: 54.2, eth: 17 },
        active_cryptocurrencies: 10000,
        markets: 800,
        updated_at: 1_704_067_200,
      },
    }))));
    const { clearCoinGeckoCache, getGlobalStats } = await import("./coingeckoProxy");
    clearCoinGeckoCache();
    const stats = await getGlobalStats();
    expect(stats?.totalMarketCap).toBeNull();
    expect(stats?.totalVolume24h).toBeNull();
    expect(stats?.marketCapChangePercent24h).toBeNull();
    expect(JSON.stringify(stats)).not.toMatch(/"totalMarketCap":0/);
    expect(JSON.stringify(stats)).not.toMatch(/"totalVolume24h":0/);
    expect(JSON.stringify(stats)).not.toMatch(/"marketCapChangePercent24h":0/);
  });

  it("keeps an observed zero distinct from a missing reading", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        total_market_cap: { usd: 0 },
        total_volume: { usd: 0 },
        market_cap_percentage: { btc: 54.2 },
        market_cap_change_percentage_24h_usd: 0,
        active_cryptocurrencies: 1,
        markets: 1,
        updated_at: 1_704_067_200,
      },
    }))));
    const { clearCoinGeckoCache, getGlobalStats } = await import("./coingeckoProxy");
    clearCoinGeckoCache();
    const stats = await getGlobalStats();
    expect(stats?.totalMarketCap).toBe(0);
    expect(stats?.totalVolume24h).toBe(0);
    expect(stats?.marketCapChangePercent24h).toBe(0);
  });

  it("renders the Crypto Search strip as Unavailable instead of 0 or +0.00%", () => {
    const search = readFileSync("client/src/pages/CryptoSearch.tsx", "utf8");
    expect(search).toContain("Unavailable");
    expect(search).not.toMatch(/fmt\(resolvedGlobal\.totalMarketCap\)/);
    expect(search).not.toMatch(/fmt\(resolvedGlobal\.totalVolume24h\)/);
    expect(search).not.toMatch(/fmtPct\(resolvedGlobal\.marketCapChangePercent24h\)/);
    const signals = readFileSync("client/src/pages/CryptoSignals.tsx", "utf8");
    expect(signals).not.toMatch(/marketCapChange24h\.toFixed/);
    expect(signals).toContain("formatObservedFixed");
  });
});
