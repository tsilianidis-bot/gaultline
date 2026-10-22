import { describe, expect, it } from "vitest";
import { mapRawCoin } from "./coingeckoProxy";
import { computeRecoveryAnalysis } from "./recoveryEngine";
import type { CoinMarketData } from "./coingeckoProxy";

function analyze(market: CoinMarketData) {
  return computeRecoveryAnalysis({
    symbol: "ETH",
    name: "Ethereum",
    market,
    ohlcBars: [],
    btcDominance: 54,
    pressure: { overallPressure: 40, level: "Moderate", vectors: [] } as never,
    isCrypto: true,
  });
}

describe("recovery does not invent 7d and 30d changes", () => {
  it("keeps an observed 7d and 30d change on the prior rule", () => {
    const market = mapRawCoin({
      id: "ethereum",
      symbol: "eth",
      name: "Ethereum",
      current_price: 3000,
      price_change_percentage_24h: 2,
      price_change_percentage_7d_in_currency: -4,
      price_change_percentage_30d_in_currency: -20,
      high_24h: 3100,
      low_24h: 2900,
      market_cap: 1e11,
      total_volume: 5e9,
      ath: 4000,
    });
    const result = analyze(market);
    const week = result.confirmationRules.find(rule => rule.id === "trend_7d");
    const month = result.confirmationRules.find(rule => rule.id === "trend_14d");
    expect(week?.withheld).not.toBe(true);
    expect(month?.withheld).not.toBe(true);
    expect(week?.passed).toBe(-4 > -5);
    expect(month?.passed).toBe(-20 > -15);
    expect(week?.detail).toContain(`${(-4).toFixed(1)}%`);
    expect(month?.detail).toContain(`${(-20).toFixed(1)}%`);
  });

  it("withholds a missing 7d or 30d change instead of scaling the 24h move", () => {
    const market = mapRawCoin({
      id: "ethereum",
      symbol: "eth",
      name: "Ethereum",
      current_price: 3000,
      price_change_percentage_24h: -4,
      high_24h: 3100,
      low_24h: 2900,
      market_cap: 1e11,
      total_volume: 5e9,
      ath: 4000,
    });
    const result = analyze(market);
    const week = result.confirmationRules.find(rule => rule.id === "trend_7d");
    const month = result.confirmationRules.find(rule => rule.id === "trend_14d");
    expect(week?.withheld).toBe(true);
    expect(month?.withheld).toBe(true);
    expect(week?.passed).toBe(false);
    expect(month?.passed).toBe(false);
    expect(week?.detail).toBe("7d change unavailable");
    expect(month?.detail).toBe("30d change unavailable");
    expect(JSON.stringify(result.confirmationRules)).not.toContain(`${(-4 * 3).toFixed(1)}%`);
    expect(JSON.stringify(result.confirmationRules)).not.toContain(`${(-4 * 10).toFixed(1)}%`);
    const scored = result.confirmationRules.filter(rule => !rule.withheld);
    expect(scored.some(rule => rule.id === "trend_7d" || rule.id === "trend_14d")).toBe(false);
  });
});
