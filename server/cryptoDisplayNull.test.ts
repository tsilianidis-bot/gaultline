import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapRawCoin } from "./coingeckoProxy";
import { withholdNonFiniteNumbers } from "./displayNumbers";

function rawCoin(overrides: Record<string, unknown> = {}) {
  return {
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    current_price: 70_000,
    high_24h: 72_000,
    low_24h: 68_000,
    market_cap: 1_000_000_000_000,
    total_volume: 30_000_000_000,
    ...overrides,
  };
}

describe("crypto display fields stay null when the provider omits them", () => {
  it("mapRawCoin keeps an observed 0 and withholds a missing rank, change, supply, and low", () => {
    const missing = mapRawCoin(rawCoin());
    expect(missing.marketCapRank).toBeNull();
    expect(missing.priceChange24h).toBeNull();
    expect(missing.priceChangePercent7d).toBeNull();
    expect(missing.priceChangePercent30d).toBeNull();
    expect(missing.marketCapChange24h).toBeNull();
    expect(missing.marketCapChangePercent24h).toBeNull();
    expect(missing.circulatingSupply).toBeNull();
    expect(missing.totalSupply).toBeNull();
    expect(missing.maxSupply).toBeNull();
    expect(missing.fullyDilutedValuation).toBeNull();
    expect(missing.athChangePercent).toBeNull();
    expect(missing.atl).toBeNull();
    expect(missing.atlChangePercent).toBeNull();
    expect(JSON.stringify(missing)).not.toMatch(/"circulatingSupply":0|"priceChange24h":0|"marketCapRank":0|"athChangePercent":0/);

    const zero = mapRawCoin(rawCoin({
      market_cap_rank: 0,
      price_change_24h: 0,
      price_change_percentage_7d_in_currency: 0,
      price_change_percentage_30d_in_currency: 0,
      market_cap_change_24h: 0,
      market_cap_change_percentage_24h: 0,
      circulating_supply: 0,
      total_supply: 0,
      max_supply: 0,
      fully_diluted_valuation: 0,
      ath_change_percentage: 0,
      atl: 0,
      atl_change_percentage: 0,
    }));
    expect(zero.marketCapRank).toBe(0);
    expect(zero.priceChange24h).toBe(0);
    expect(zero.circulatingSupply).toBe(0);
    expect(zero.athChangePercent).toBe(0);
    expect(zero.atl).toBe(0);
    expect(zero.fullyDilutedValuation).toBe(0);
  });

  it("turns a non-finite response number into null and keeps an observed 0", () => {
    expect(withholdNonFiniteNumbers({
      price: Number.NaN,
      cap: Number.POSITIVE_INFINITY,
      flat: 0,
      missing: null,
      nested: [{ change: Number.NEGATIVE_INFINITY }],
    })).toEqual({
      price: null,
      cap: null,
      flat: 0,
      missing: null,
      nested: [{ change: null }],
    });
  });

  it("does not zero-fill crypto signal, screener, or alt-rotation responses", () => {
    const routers = readFileSync("server/routers.ts", "utf8");
    const signal = routers.slice(routers.indexOf("getSignal:"), routers.indexOf("getScreener:"));
    const screener = routers.slice(routers.indexOf("getScreener:"), routers.indexOf("getCoinInfo:"));
    const alt = routers.slice(routers.indexOf("altRotation: router"), routers.indexOf("mobileWatchlist: router"));
    expect(signal).toContain("return withholdNonFiniteNumbers(withheld)");
    expect(signal).not.toContain(": 0");
    expect(screener).toContain("return withholdNonFiniteNumbers(screenerResult)");
    expect(screener).not.toContain(": 0");
    expect(alt).toContain("return withholdNonFiniteNumbers(result)");
    expect(alt).not.toContain(": 0");
  });

  it("renders supply, ATH change, active assets, and markets as Unavailable when missing", () => {
    const page = readFileSync("client/src/pages/CryptoSearch.tsx", "utf8");
    expect(page).toContain("fmtSupply(asset.circulatingSupply, asset.symbol)");
    expect(page).toContain("formatObservedFixed(asset.athChangePercent, 1, \"%\")");
    expect(page).toContain("formatObservedFixed(resolvedGlobal.activeCryptocurrencies, 0)");
    expect(page).toContain("formatObservedFixed(resolvedGlobal.markets, 0)");
    expect(page).toContain('return "Unavailable"');
  });
});

describe("global activeCryptocurrencies and markets", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  function globalPayload(active: unknown, markets: unknown) {
    return {
      data: {
        total_market_cap: { usd: 2_500_000_000_000 },
        total_volume: { usd: 120_000_000_000 },
        market_cap_percentage: { btc: 55.2, eth: 17.1 },
        market_cap_change_percentage_24h_usd: -1.5,
        active_cryptocurrencies: active,
        markets,
        updated_at: 1_704_067_200,
      },
    };
  }

  async function load(active: unknown, markets: unknown) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => globalPayload(active, markets) }));
    vi.doMock("./logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
    const { getGlobalStats } = await import("./coingeckoProxy");
    return getGlobalStats();
  }

  it("keeps an observed count, including 0, and withholds a missing count", async () => {
    const present = await load(13000, 900);
    expect(present?.activeCryptocurrencies).toBe(13000);
    expect(present?.markets).toBe(900);

    vi.resetModules();
    const zero = await load(0, 0);
    expect(zero?.activeCryptocurrencies).toBe(0);
    expect(zero?.markets).toBe(0);

    vi.resetModules();
    const missing = await load(undefined, "n/a");
    expect(missing?.activeCryptocurrencies).toBeNull();
    expect(missing?.markets).toBeNull();
  });
});
