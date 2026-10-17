import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCoinGeckoCache, getGlobalStats } from "./coingeckoProxy";

const globalPayload = (updatedAt: number | null) => ({
  data: {
    total_market_cap: { usd: 2_500_000_000_000 },
    total_volume: { usd: 100_000_000_000 },
    market_cap_percentage: { btc: 55, eth: 18 },
    market_cap_change_percentage_24h_usd: 1.2,
    active_cryptocurrencies: 10_000,
    markets: 800,
    updated_at: updatedAt,
  },
});

afterEach(() => {
  clearCoinGeckoCache();
  vi.unstubAllGlobals();
});

describe("CoinGecko global observation timestamps", () => {
  it("propagates the provider's updated_at field instead of using fetch time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(globalPayload(1_792_180_000)))));
    const stats = await getGlobalStats();
    expect(stats).toMatchObject({ observedAt: 1_792_180_000_000, totalMarketCap: 2_500_000_000_000 });
    expect(stats?.fetchedAt).not.toBe(stats?.observedAt);
  });

  it("preserves a missing provider timestamp as unavailable metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(globalPayload(null)))));
    const stats = await getGlobalStats();
    expect(stats).toMatchObject({ observedAt: null });
  });
});
