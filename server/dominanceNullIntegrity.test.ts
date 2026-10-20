import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecoveryStatusCard } from "../client/src/components/RecoveryStatus.tsx";
import { formatObservedFixed } from "../client/src/lib/nullableFormat";
import type { CoinMarketData } from "./coingeckoProxy";
import { clearRecoveryCache, getRecoveryAnalysis } from "./recoveryEngine";

function makeMarket(overrides: Partial<CoinMarketData> = {}): CoinMarketData {
  return {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    currentPrice: 3200,
    priceChangePercent24h: 1.2,
    priceChangePercent7d: 3.5,
    priceChangePercent30d: 8.0,
    marketCap: 380_000_000_000,
    volume24h: 18_000_000_000,
    totalVolume: 18_000_000_000,
    ath: 4800,
    athChangePercent: -33,
    distanceFromAth: -33,
    volatility24h: 2.5,
    sparkline7d: Array.from({ length: 48 }, (_, i) => 3000 + i),
    ...overrides,
  } as CoinMarketData;
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
      updated_at: 1_704_067_200,
    },
  };
}

function mockOk(data: unknown) {
  return { ok: true, json: async () => data };
}

describe("missing BTC dominance is withheld", () => {
  beforeEach(() => clearRecoveryCache());

  it("does not pass or score the altcoin-breadth check when dominance is missing", () => {
    const missing = getRecoveryAnalysis({
      symbol: "ETH",
      name: "Ethereum",
      market: makeMarket(),
      btcDominance: undefined,
      isCrypto: true,
    });
    const rule = missing.confirmationRules.find(r => r.id === "altcoin_breadth");
    expect(rule).toBeDefined();
    expect(rule?.passed).toBe(false);
    expect(rule?.withheld).toBe(true);
    expect(rule?.detail.toLowerCase()).toContain("unavailable");
    expect(rule?.detail).not.toContain("55.0");
    expect(rule?.detail.toLowerCase()).not.toContain("altcoins participating");
    expect(missing.confirmationsPassed).toBe(
      missing.confirmationRules.filter(r => r.passed && !r.withheld).length,
    );
    expect(missing.confirmationsRequired).toBe(
      missing.confirmationRules.filter(r => !r.withheld).length,
    );
    expect(missing.confirmationsRequired).toBeLessThan(missing.confirmationRules.length);

    clearRecoveryCache();
    const observed = getRecoveryAnalysis({
      symbol: "ETH",
      name: "Ethereum",
      market: makeMarket(),
      btcDominance: 55,
      isCrypto: true,
    });
    const observedRule = observed.confirmationRules.find(r => r.id === "altcoin_breadth");
    expect(observedRule?.passed).toBe(true);
    expect(observedRule?.withheld).not.toBe(true);
    expect(observedRule?.detail).toContain("55.0%");
    expect(missing.recoveryConfidence).not.toBe(observed.recoveryConfidence);
  });

  it("withholds the same check for Bitcoin when dominance was not observed", () => {
    const result = getRecoveryAnalysis({
      symbol: "BTC",
      name: "Bitcoin",
      market: makeMarket({ id: "bitcoin", symbol: "BTC", name: "Bitcoin" }),
      btcDominance: null,
      isCrypto: true,
    });
    const rule = result.confirmationRules.find(r => r.id === "altcoin_breadth");
    expect(rule?.passed).toBe(false);
    expect(rule?.withheld).toBe(true);
    expect(rule?.detail).not.toContain("55.0");
    expect(result.keyReasoning).not.toContain("55.0");
    expect(result.btcSpecificLanguage ?? "").not.toContain("55.0");
  });

  it("does not invent a macro pressure of 50 when the pressure reading is absent", () => {
    const result = getRecoveryAnalysis({
      symbol: "ETH",
      name: "Ethereum",
      market: makeMarket(),
      btcDominance: 52,
      isCrypto: true,
    });
    const rule = result.confirmationRules.find(r => r.id === "macro_not_worsening");
    expect(rule?.withheld).toBe(true);
    expect(rule?.passed).toBe(false);
    expect(rule?.detail.toLowerCase()).toContain("unavailable");
    expect(rule?.detail).not.toContain("50/100");
    expect(result.confirmationsRequired).toBe(
      result.confirmationRules.filter(r => !r.withheld).length,
    );
  });

  it("reports a withheld dominance check as unavailable on the recovery card", () => {
    const analysis = getRecoveryAnalysis({
      symbol: "ETH",
      name: "Ethereum",
      market: makeMarket(),
      btcDominance: undefined,
      isCrypto: true,
    });
    const html = renderToStaticMarkup(createElement(RecoveryStatusCard, { data: analysis }));
    expect(html.toLowerCase()).toContain("unavailable");
    expect(html).not.toContain("55.0%");
    expect(html).not.toContain("altcoins participating");
  });
});

describe("crypto dominance display does not use 55", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("shows Unavailable instead of a fabricated dominance percent", () => {
    expect(formatObservedFixed(null, 1, "%")).toBe("Unavailable");
    expect(formatObservedFixed(undefined, 1, "%")).toBe("Unavailable");
    expect(readFileSync("server/cryptoEngine.ts", "utf8")).not.toMatch(/\?\? 55/);
    expect(readFileSync("server/recoveryEngine.ts", "utf8")).not.toMatch(/btcDominance \?\? 55/);
    expect(readFileSync("server/coingeckoProxy.ts", "utf8")).not.toMatch(/market_cap_percentage\?\.btc \?\? 0/);
  });

  it("propagates a missing CoinGecko BTC dominance as null", async () => {
    const data = makeGlobalData();
    delete (data.data.market_cap_percentage as { btc?: number }).btc;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockOk(data)));
    vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
    const { getGlobalStats } = await import("./coingeckoProxy");
    const stats = await getGlobalStats();
    expect(stats?.btcDominance).toBeNull();
    expect(stats?.ethDominance).toBeCloseTo(17.1, 1);
  });

  it("propagates a missing CoinGecko ETH dominance as null", async () => {
    const data = makeGlobalData();
    delete (data.data.market_cap_percentage as { eth?: number }).eth;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockOk(data)));
    vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
    const { clearCoinGeckoCache, getGlobalStats } = await import("./coingeckoProxy");
    clearCoinGeckoCache();
    const stats = await getGlobalStats();
    expect(stats?.btcDominance).toBeCloseTo(55.2, 1);
    expect(stats?.ethDominance).toBeNull();
    expect(JSON.stringify(stats)).not.toMatch(/"ethDominance":0/);
  });

  it("does not let a missing dominance reading enter the systemic score", async () => {
    const markets = Array.from({ length: 20 }, (_, i) => ({
      id: `coin-${i}`,
      symbol: `c${i}`,
      name: `Coin ${i}`,
      image: "",
      current_price: 10,
      market_cap: 1_000_000_000,
      market_cap_rank: i + 1,
      fully_diluted_valuation: 1_000_000_000,
      total_volume: 50_000_000,
      high_24h: 11,
      low_24h: 9,
      price_change_24h: 0.2,
      price_change_percentage_24h: i % 3 === 0 ? -6 : 2,
      price_change_percentage_7d_in_currency: 1,
      price_change_percentage_30d_in_currency: 1,
      market_cap_change_24h: 1,
      market_cap_change_percentage_24h: 1,
      circulating_supply: 1,
      total_supply: 1,
      max_supply: 1,
      ath: 12,
      ath_change_percentage: -5,
      atl: 1,
      atl_change_percentage: 10,
      sparkline_in_7d: { price: [9, 10, 11] },
      last_updated: "2024-01-01T00:00:00.000Z",
    }));

    async function riskFor(globalBody: unknown) {
      vi.resetModules();
      vi.unstubAllGlobals();
      vi.stubGlobal("fetch", vi.fn()
        .mockResolvedValueOnce(mockOk(globalBody))
        .mockResolvedValueOnce(mockOk(markets)));
      vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
      vi.doMock("./pressure/engine", () => ({
        calculateFaultlinePressure: vi.fn().mockResolvedValue({ overallPressure: 45 }),
      }));
      const { computeCryptoSystemicRisk } = await import("./cryptoEngine");
      return computeCryptoSystemicRisk();
    }

    const observed = makeGlobalData();
    observed.data.market_cap_percentage.btc = 55;
    const missing = makeGlobalData();
    delete (missing.data.market_cap_percentage as { btc?: number }).btc;

    const withObservation = await riskFor(observed);
    const withoutObservation = await riskFor(missing);

    expect(withObservation.btcDominance).toBeCloseTo(55, 1);
    expect(withoutObservation.btcDominance).toBeNull();
    expect(withoutObservation.score).not.toBe(withObservation.score);
    expect(withoutObservation.breakdown.some(v => /55\.0/.test(v.description))).toBe(false);
    expect(withoutObservation.breakdown.some(v => v.label === "BTC Dominance" && /\d/.test(v.description))).toBe(false);
    expect(JSON.stringify(withoutObservation)).not.toContain("55.0");
  });
});
