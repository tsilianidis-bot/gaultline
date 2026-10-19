import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapRawCoin } from "./coingeckoProxy";
import { computeRecoveryAnalysis } from "./recoveryEngine";
import type { CoinMarketData } from "./coingeckoProxy";

function coin(overrides: Record<string, unknown> = {}) {
  return mapRawCoin({
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    current_price: 70_000,
    high_24h: 72_000,
    low_24h: 68_000,
    market_cap: 1_000_000_000_000,
    total_volume: 30_000_000_000,
    ath: 73_750,
    price_change_percentage_24h: 1.5,
    price_change_percentage_7d_in_currency: 4,
    ...overrides,
  });
}

describe("missing coin price, range, volume, and market cap", () => {
  it("stays null instead of becoming 0", () => {
    const missing = coin({
      current_price: undefined,
      high_24h: undefined,
      low_24h: undefined,
      market_cap: undefined,
      total_volume: undefined,
    });
    expect(missing.currentPrice).toBeNull();
    expect(missing.high24h).toBeNull();
    expect(missing.low24h).toBeNull();
    expect(missing.marketCap).toBeNull();
    expect(missing.totalVolume).toBeNull();
    expect(missing.volatility24h).toBeNull();
    expect(missing.distanceFromAth).toBeNull();
    expect(JSON.stringify(missing)).not.toMatch(/"currentPrice":0/);
    expect(JSON.stringify(missing)).not.toMatch(/"totalVolume":0/);
    expect(JSON.stringify(missing)).not.toMatch(/"marketCap":0/);
  });

  it("keeps an observed coin byte-identical, including an observed zero", () => {
    const observed = coin();
    expect(observed.currentPrice).toBe(70_000);
    expect(observed.high24h).toBe(72_000);
    expect(observed.low24h).toBe(68_000);
    expect(observed.marketCap).toBe(1_000_000_000_000);
    expect(observed.totalVolume).toBe(30_000_000_000);
    expect(observed.volatility24h).toBeCloseTo(((72_000 - 68_000) / 68_000) * 100, 10);
    expect(observed.distanceFromAth).toBeCloseTo(((70_000 - 73_750) / 73_750) * 100, 10);
    const zero = coin({ total_volume: 0, market_cap: 0, low_24h: 0 });
    expect(zero.totalVolume).toBe(0);
    expect(zero.marketCap).toBe(0);
    expect(zero.volatility24h).toBe(0);
  });

  it("does not let a missing price, volume, or range pass a recovery check", () => {
    const base = coin() as CoinMarketData;
    const present = computeRecoveryAnalysis({
      symbol: "ETH",
      name: "Ethereum",
      market: base,
      ohlcBars: undefined,
      btcDominance: 54,
      pressure: { overallPressure: 40, level: "Moderate", vectors: [] } as never,
      isCrypto: true,
    });
    const missing = computeRecoveryAnalysis({
      symbol: "ETH",
      name: "Ethereum",
      market: {
        ...base,
        currentPrice: null,
        high24h: null,
        low24h: null,
        marketCap: null,
        totalVolume: null,
        volatility24h: null,
        distanceFromAth: null,
      },
      ohlcBars: undefined,
      btcDominance: 54,
      pressure: { overallPressure: 40, level: "Moderate", vectors: [] } as never,
      isCrypto: true,
    });
    for (const id of ["volume_confirmation", "volatility_cooling", "above_ma"]) {
      const rule = missing.confirmationRules.find(item => item.id === id);
      expect(rule?.withheld, id).toBe(true);
      expect(rule?.passed, id).toBe(false);
    }
    expect(missing.aftershockRiskScore).toBeLessThanOrEqual(present.aftershockRiskScore);
    expect(JSON.stringify(missing.confirmationRules)).not.toContain("0.00%");
    expect(JSON.stringify(missing.confirmationRules)).not.toContain("volume too thin");
  });

  it("renders Crypto Search prices, range, volume, and market cap through the unavailable formatter", () => {
    const source = readFileSync("client/src/pages/CryptoSearch.tsx", "utf8");
    expect(source).not.toMatch(/fmt\(asset\.currentPrice/);
    expect(source).not.toMatch(/fmt\(asset\.marketCap\)/);
    expect(source).not.toMatch(/fmt\(asset\.totalVolume\)/);
    expect(source).not.toMatch(/fmt\(asset\.high24h/);
    expect(source).not.toMatch(/fmt\(asset\.low24h/);
    expect(source).toContain("fmtObserved");
  });
});
