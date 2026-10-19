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

function lerp(v: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function presentScore(btcDom: number, mcChange: number, ratio: number) {
  const btcDomScore = btcDom > 65 ? lerp(btcDom, 65, 80, 6, 9)
    : btcDom > 55 ? lerp(btcDom, 55, 65, 3, 6)
    : lerp(btcDom, 40, 55, 1, 3);
  const mcScore = mcChange < -8 ? 9 : mcChange < -5 ? 7 : mcChange < -3 ? 5 : mcChange < -1 ? 3 : mcChange > 3 ? 1 : 2;
  const volScore = 3;
  const macroScore = 4;
  const breadthScore = 1;
  const stableScore = ratio > 15 ? 8 : ratio > 10 ? 6 : ratio > 6 ? 4 : 2;
  const dominanceWeight = 0.15;
  return (
    btcDomScore * dominanceWeight +
    mcScore * 0.25 +
    volScore * 0.20 +
    macroScore * 0.20 +
    breadthScore * 0.15 +
    stableScore * 0.05
  ) / (dominanceWeight + 0.85);
}

describe("systemic score with missing global totals", () => {
  beforeEach(() => {
    mocks.getTopMarkets.mockResolvedValue([]);
    mocks.calculateFaultlinePressure.mockResolvedValue({ overallPressure: 40, regime: "MODERATE" });
  });

  it("omits missing totals from the score and keeps present inputs on the prior formula", async () => {
    const { clearCryptoEngineCache, computeCryptoSystemicRisk } = await import("./cryptoEngine");
    const present = {
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
    mocks.getGlobalStats.mockResolvedValueOnce(present);
    clearCryptoEngineCache();
    const observed = await computeCryptoSystemicRisk();
    const ratio = (present.totalVolume24h / Math.max(present.totalMarketCap, 1)) * 100;
    expect(observed.score).toBeCloseTo(presentScore(54, -10, ratio), 10);
    expect(observed.breakdown.map(row => row.label)).toEqual(expect.arrayContaining(["Market Cap Momentum", "Stablecoin Flow"]));
    expect(observed.stablecoinLiquidity).toBe("Contracting");

    mocks.getGlobalStats.mockResolvedValueOnce({
      ...present,
      totalMarketCap: null,
      totalVolume24h: null,
      marketCapChangePercent24h: null,
    });
    clearCryptoEngineCache();
    const missing = await computeCryptoSystemicRisk();
    expect(missing.breakdown.map(row => row.label)).not.toContain("Market Cap Momentum");
    expect(missing.breakdown.map(row => row.label)).not.toContain("Stablecoin Flow");
    expect(missing.stablecoinLiquidity).toBe("Unavailable");
    expect(missing.speculativeIntensity).toBe("Unavailable");
    expect(missing.score).not.toBe(observed.score);
    expect(JSON.stringify(missing.breakdown)).not.toContain("0.0%");
  });
});
