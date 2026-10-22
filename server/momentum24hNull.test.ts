import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapRawCoin } from "./coingeckoProxy";
import type { CoinMarketData } from "./coingeckoProxy";
import type { CryptoSystemicRisk } from "./cryptoEngine";

const mocks = vi.hoisted(() => ({ getCoinMarketData: vi.fn() }));

vi.mock("./coingeckoProxy", async () => {
  const actual = await vi.importActual<typeof import("./coingeckoProxy")>("./coingeckoProxy");
  return { ...actual, getCoinMarketData: mocks.getCoinMarketData };
});

vi.mock("./pressure/engine", () => ({ calculateFaultlinePressure: vi.fn() }));

const systemic = {
  score: 4,
  level: "Moderate",
  btcDominance: 54,
  stablecoinLiquidity: "Stable",
  volatilityRegime: "Normal",
  leverageConditions: "Normal",
  marketBreadth: "Strong",
  macroLiquidity: "Neutral",
  speculativeIntensity: "Low",
  breakdown: [],
  regime: "MODERATE CRYPTO STRESS",
  regimeColor: "#00D4FF",
  summary: "Contained.",
  fetchedAt: 1,
} as CryptoSystemicRisk;

function coin(change: number | null): CoinMarketData {
  return {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    image: "",
    currentPrice: 70_000,
    marketCap: 1_000_000_000_000,
    marketCapRank: 1,
    fullyDilutedValuation: null,
    totalVolume: 30_000_000_000,
    high24h: 72_000,
    low24h: 68_000,
    priceChange24h: change == null ? 0 : 70_000 * change / 100,
    priceChangePercent24h: change as number,
    priceChangePercent24hDisplay: change,
    priceChangePercent7d: 4,
    priceChangePercent30d: 8,
    marketCapChange24h: 0,
    marketCapChangePercent24h: 0,
    circulatingSupply: 19_000_000,
    totalSupply: 21_000_000,
    maxSupply: 21_000_000,
    ath: 73_750,
    athChangePercent: -5,
    atl: 1,
    atlChangePercent: 100,
    sparkline7d: [],
    lastUpdated: "",
    volatility24h: ((72_000 - 68_000) / 68_000) * 100,
    distanceFromAth: ((70_000 - 73_750) / 73_750) * 100,
  };
}

describe("missing 24h momentum is withheld from the crypto score", () => {
  beforeEach(() => {
    mocks.getCoinMarketData.mockReset();
  });

  it("keeps an observed 0 on the prior 24h score of 50", async () => {
    const { clearCryptoEngineCache, computeAssetIntelligence } = await import("./cryptoEngine");
    mocks.getCoinMarketData.mockResolvedValue(coin(0));
    clearCryptoEngineCache();
    const observed = await computeAssetIntelligence("bitcoin", systemic);
    const vector = observed?.vectors.find(item => item.label === "24h Momentum");
    expect(vector?.score).toBe(50);
    expect(observed?.priceChangePercent24h).toBe(0);
  });

  it("does not score a missing 24h change as 50 and drops its weight", async () => {
    const { clearCryptoEngineCache, computeAssetIntelligence } = await import("./cryptoEngine");
    mocks.getCoinMarketData.mockResolvedValueOnce(coin(0));
    clearCryptoEngineCache();
    const flat = await computeAssetIntelligence("bitcoin", systemic);
    mocks.getCoinMarketData.mockResolvedValueOnce({ ...coin(0), priceChangePercent24h: null, priceChangePercent24hDisplay: null });
    clearCryptoEngineCache();
    const missing = await computeAssetIntelligence("bitcoin", systemic);
    expect(missing?.vectors.some(item => item.label === "24h Momentum")).toBe(false);
    expect(missing?.signalScore).not.toBe(flat?.signalScore);
    expect(missing?.momentum).toBe("Unavailable");
    const mapped = mapRawCoin({ id: "x", symbol: "x", name: "X", current_price: 1, high_24h: 1, low_24h: 1 });
    expect(mapped.priceChangePercent24h).toBeNull();
    expect(mapped.priceChangePercent24hDisplay).toBeNull();
    const zero = mapRawCoin({ id: "x", symbol: "x", name: "X", current_price: 1, high_24h: 1, low_24h: 1, price_change_percentage_24h: 0 });
    expect(zero.priceChangePercent24h).toBe(0);
  });
});
