import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { clearCoinGeckoCache, getGlobalStats, getTopMarketsSnapshot } from "./coingeckoProxy";
import { registerCoinGeckoProxy } from "./coingeckoProxy";

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
  vi.useRealTimers();
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

describe("CoinGecko top-markets cache provenance", () => {
  const marketPayload = [{
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    image: "",
    current_price: 100,
    market_cap: 2_000,
    market_cap_rank: 1,
    fully_diluted_valuation: null,
    total_volume: 100,
    high_24h: 101,
    low_24h: 99,
    price_change_24h: 1,
    price_change_percentage_24h: 1,
    price_change_percentage_7d_in_currency: 2,
    price_change_percentage_30d_in_currency: 3,
    market_cap_change_24h: 10,
    market_cap_change_percentage_24h: 1,
    circulating_supply: 20,
    total_supply: 21,
    max_supply: 21,
    ath: 120,
    ath_change_percentage: -16,
    atl: 1,
    atl_change_percentage: 9_900,
    sparkline_in_7d: { price: [] },
    last_updated: "2026-10-29T00:00:00.000Z",
  }];

  it("preserves the original adapter receipt time and marks a cache hit", async () => {
    vi.useFakeTimers();
    const receiptAt = new Date("2026-10-29T00:00:00.000Z");
    vi.setSystemTime(receiptAt);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(marketPayload)));
    vi.stubGlobal("fetch", fetchMock);

    const fresh = await getTopMarketsSnapshot(1);
    expect(fresh).toMatchObject({ cached: false, source: "coingecko", fetchedAt: receiptAt.getTime() });

    vi.setSystemTime(new Date("2026-10-29T00:04:00.000Z"));
    const cached = await getTopMarketsSnapshot(1);
    expect(cached).toMatchObject({ cached: true, source: "coingecko", fetchedAt: receiptAt.getTime() });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not invent a fetched timestamp when top-markets ingestion fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider unavailable")));
    const snapshot = await getTopMarketsSnapshot(1);
    expect(snapshot).toMatchObject({ coins: [], cached: false, fetchedAt: null, source: "coingecko" });
  });

  it("returns the cache receipt time and cache state from the HTTP markets route", async () => {
    const nativeFetch = globalThis.fetch;
    const upstreamFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("https://api.coingecko.com/api/v3/")) {
        return new Response(JSON.stringify(marketPayload));
      }
      return nativeFetch(input, init);
    });
    vi.stubGlobal("fetch", upstreamFetch);
    const app = express();
    registerCoinGeckoProxy(app);
    const server: Server = await new Promise(resolve => {
      const listening = app.listen(0, () => resolve(listening));
    });
    try {
      const port = (server.address() as AddressInfo).port;
      const first = await fetch(`http://127.0.0.1:${port}/api/crypto/markets`).then(response => response.json()) as {
        coins: unknown[]; fetchedAt: number | null; cached: boolean; source: string;
      };
      const second = await fetch(`http://127.0.0.1:${port}/api/crypto/markets`).then(response => response.json()) as typeof first;

      expect(first).toMatchObject({ coins: [{ id: "bitcoin" }], cached: false, source: "coingecko" });
      expect(typeof first.fetchedAt).toBe("number");
      expect(second).toMatchObject({ cached: true, fetchedAt: first.fetchedAt, source: "coingecko" });
      expect(upstreamFetch.mock.calls.filter(([input]) => String(input).startsWith("https://api.coingecko.com/api/v3/")).length).toBe(1);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
