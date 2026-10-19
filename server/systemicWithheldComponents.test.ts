import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGlobalStats: vi.fn(),
  getTopMarkets: vi.fn(),
  calculateFaultlinePressure: vi.fn(),
}));

vi.mock("./coingeckoProxy", () => ({
  getGlobalStats: mocks.getGlobalStats,
  getTopMarkets: mocks.getTopMarkets,
  getCoinMarketData: vi.fn(),
}));

vi.mock("./pressure/engine", () => ({
  calculateFaultlinePressure: mocks.calculateFaultlinePressure,
}));

const globals = {
  totalMarketCap: 2_000_000_000_000,
  totalVolume24h: 400_000_000_000,
  btcDominance: 54,
  ethDominance: 17,
  marketCapChangePercent24h: -10,
  activeCryptocurrencies: 1,
  markets: 1,
  observedAt: 1,
  fetchedAt: 1,
};

describe("empty breadth and missing pressure are withheld", () => {
  beforeEach(() => {
    mocks.getGlobalStats.mockResolvedValue(globals);
    mocks.getTopMarkets.mockResolvedValue([]);
    mocks.calculateFaultlinePressure.mockResolvedValue({ overallPressure: 40, regime: "MODERATE" });
  });

  it("does not turn an empty top-20 list into average range 5 or Strong breadth", async () => {
    const { clearCryptoEngineCache, computeCryptoSystemicRisk } = await import("./cryptoEngine");
    clearCryptoEngineCache();
    const empty = await computeCryptoSystemicRisk();
    expect(empty.volatilityRegime).toBe("Unavailable");
    expect(empty.marketBreadth).toBe("Unavailable");
    expect(empty.breakdown.map(row => row.label)).not.toContain("Volatility");
    expect(empty.breakdown.map(row => row.label)).not.toContain("Market Breadth");
    expect(JSON.stringify(empty.breakdown)).not.toContain("Avg 24h range: 5.0%");
  });

  it("does not turn a missing pressure reading into macro score 5", async () => {
    const { clearCryptoEngineCache, computeCryptoSystemicRisk } = await import("./cryptoEngine");
    mocks.getTopMarkets.mockResolvedValue([{ volatility24h: 5, priceChangePercent24h: 1 }]);
    mocks.calculateFaultlinePressure.mockResolvedValue(null);
    clearCryptoEngineCache();
    const missing = await computeCryptoSystemicRisk();
    expect(missing.breakdown.map(row => row.label)).not.toContain("Macro Pressure");
    expect(missing.macroLiquidity).toBe("Unavailable");
    expect(JSON.stringify(missing.breakdown)).not.toContain("FAULTLINE macro score: 50");
  });

  it("keeps a populated list and a supplied pressure reading on the prior labels", async () => {
    const { clearCryptoEngineCache, computeCryptoSystemicRisk } = await import("./cryptoEngine");
    mocks.getTopMarkets.mockResolvedValue([
      { volatility24h: 5, priceChangePercent24h: 1 },
      { volatility24h: 5, priceChangePercent24h: -1 },
    ]);
    clearCryptoEngineCache();
    const present = await computeCryptoSystemicRisk();
    expect(present.volatilityRegime).toBe("Normal");
    expect(present.marketBreadth).toBe("Strong");
    expect(present.macroLiquidity).toBe("Neutral");
    expect(present.breakdown.find(row => row.label === "Macro Pressure")?.score).toBe(40);
    expect(present.breakdown.find(row => row.label === "Volatility")?.score).toBe(30);
    expect(present.breakdown.find(row => row.label === "Market Breadth")?.score).toBe(10);
  });
});
