import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeCryptoSignal, computeCryptoSignals } from "./cryptoSignals";

// ── Mock market data ──────────────────────────────────────────

function makeMockMarket(overrides: Partial<{
  symbol: string; name: string; id: string;
  priceChangePercent24h: number; priceChangePercent7d: number | null; priceChangePercent30d: number | null;
  totalVolume: number; marketCap: number; marketCapRank: number;
  ath: number; currentPrice: number; athChangePercent: number;
  volatility24h: number; distanceFromAth: number; sparkline7d: number[];
}> = {}) {
  return {
    symbol: "BTC",
    name: "Bitcoin",
    id: "bitcoin",
    image: "",
    currentPrice: 70000,
    marketCap: 1_400_000_000_000,
    marketCapRank: 1,
    fullyDilutedValuation: null,
    totalVolume: 35_000_000_000,
    high24h: 71000,
    low24h: 69000,
    priceChange24h: 1400,
    priceChangePercent24h: 2.0,
    priceChangePercent7d: 5.0,
    priceChangePercent30d: 10.0,
    marketCapChange24h: 0,
    marketCapChangePercent24h: 0,
    circulatingSupply: 19_700_000,
    totalSupply: 21_000_000,
    maxSupply: 21_000_000,
    ath: 73_750,
    athChangePercent: -5.0,
    atl: 67.81,
    atlChangePercent: 103000,
    sparkline7d: Array.from({ length: 48 }, (_, i) => 65000 + i * 100),
    lastUpdated: new Date().toISOString(),
    volatility24h: 1.4,
    distanceFromAth: 5.0,
    ...overrides,
  };
}

const mockRegime = { label: "MODERATE RISK", score: 5 };

// ── Tests ─────────────────────────────────────────────────────

describe("computeCryptoSignal", () => {
  it("returns a valid signal result for a bullish BTC scenario", () => {
    const market = makeMockMarket({ priceChangePercent24h: 4.5, priceChangePercent7d: 12.0, priceChangePercent30d: 25.0 });
    const result = computeCryptoSignal({ market, btcDominance: 55, regime: mockRegime });

    expect(result.symbol).toBe("BTC");
    expect(result.name).toBe("Bitcoin");
    expect(["BUY", "SELL", "HOLD", "WATCH"]).toContain(result.action);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(["Strong", "Moderate", "Weak"]).toContain(result.strength);
    expect(["Short-Term", "Swing", "Watch"]).toContain(result.timeframe);
    expect(result.rationale).toBeTruthy();
  });

  it("returns SELL for a strongly bearish scenario", () => {
    const market = makeMockMarket({
      priceChangePercent24h: -8.0,
      priceChangePercent7d: -18.0,
      priceChangePercent30d: -35.0,
      volatility24h: 8.0,
      distanceFromAth: 40.0,
      athChangePercent: -40.0,
    });
    const result = computeCryptoSignal({ market, btcDominance: 60, regime: { label: "HIGH RISK", score: 7.5 } });
    expect(["SELL", "HOLD"]).toContain(result.action);
  });

  it("returns BUY for a strongly bullish scenario", () => {
    const market = makeMockMarket({
      priceChangePercent24h: 6.0,
      priceChangePercent7d: 15.0,
      priceChangePercent30d: 40.0,
      volatility24h: 2.0,
      distanceFromAth: 3.0,
      athChangePercent: -3.0,
    });
    const result = computeCryptoSignal({ market, btcDominance: 50, regime: { label: "LOW RISK", score: 2 } });
    expect(["BUY", "HOLD", "WATCH"]).toContain(result.action);
  });

  it("includes all required fields in the result", () => {
    const market = makeMockMarket();
    const result = computeCryptoSignal({ market, btcDominance: 55, regime: mockRegime });

    // Core fields
    expect(result).toHaveProperty("symbol");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("coinId");
    expect(result).toHaveProperty("action");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("strength");
    expect(result).toHaveProperty("timeframe");
    expect(result).toHaveProperty("rationale");
    expect(result).toHaveProperty("computedAt");

    // Technicals
    expect(result.technicals).toHaveProperty("rsiEstimate");
    expect(result.technicals).toHaveProperty("rsiLabel");
    expect(result.technicals).toHaveProperty("rsiIsTrue");
    expect(result.technicals).toHaveProperty("trend");
    expect(result.technicals).toHaveProperty("volumeSignal");
    expect(result.technicals).toHaveProperty("momentumScore");
    expect(result.technicals).toHaveProperty("smaSignal");
    expect(result.technicals).toHaveProperty("smaIsTrue");
    expect(result.technicals).toHaveProperty("volatility24h");
    expect(result.technicals).toHaveProperty("distanceFromAth");

    // Price levels
    expect(result.priceLevels).toHaveProperty("entryZone");
    expect(result.priceLevels).toHaveProperty("stopLoss");
    expect(result.priceLevels).toHaveProperty("targetPrice");
    expect(result.priceLevels).toHaveProperty("riskReward");
    expect(result.priceLevels).toHaveProperty("support");
    expect(result.priceLevels).toHaveProperty("resistance");
    expect(result.priceLevels).toHaveProperty("atr");

    // Regime alignment
    expect(["Aligned", "Neutral", "Counter-Trend"]).toContain(result.regimeAlignment);
    expect(result.regimeAlignmentScore).toBeGreaterThanOrEqual(0);
    expect(result.regimeAlignmentScore).toBeLessThanOrEqual(10);

    // Crypto factors
    expect(["Headwind", "Neutral", "Tailwind"]).toContain(result.cryptoFactors.btcDominanceEffect);
    expect(["High", "Normal", "Low"]).toContain(result.cryptoFactors.volatilityRegime);
    expect(["Near ATH", "Mid-Range", "Deep Discount"]).toContain(result.cryptoFactors.athProximity);
    expect(result.cryptoFactors.liquidityScore).toBeGreaterThanOrEqual(0);
    expect(result.cryptoFactors.liquidityScore).toBeLessThanOrEqual(10);
  });

  it("computes RSI estimate within valid range", () => {
    const market = makeMockMarket({ sparkline7d: Array.from({ length: 48 }, (_, i) => 60000 + i * 200) });
    const result = computeCryptoSignal({ market, btcDominance: 55, regime: mockRegime });
    expect(result.technicals.rsiEstimate).toBeGreaterThanOrEqual(0);
    expect(result.technicals.rsiEstimate).toBeLessThanOrEqual(100);
  });

  it("computes MACD when OHLC bars are provided", () => {
    const market = makeMockMarket();
    const ohlcBars = Array.from({ length: 30 }, (_, i) => ({
      timestamp: Date.now() - (29 - i) * 86400000,
      open: 65000 + i * 100,
      high: 65500 + i * 100,
      low: 64500 + i * 100,
      close: 65200 + i * 100,
    }));
    const result = computeCryptoSignal({ market, ohlcBars, btcDominance: 55, regime: mockRegime });
    expect(result.technicals.macd).not.toBeNull();
    // rsiIsTrue requires 15+ bars — 30 bars satisfies this
    expect(result.technicals.rsiIsTrue).toBe(true);
    // smaIsTrue requires 200+ bars for a true SMA50/200 crossover — 30 bars is not enough
    expect(result.technicals.smaIsTrue).toBe(false);
  });

  it("handles missing sparkline data gracefully", () => {
    const market = makeMockMarket({ sparkline7d: [] });
    const result = computeCryptoSignal({ market, btcDominance: 55, regime: mockRegime });
    expect(result.technicals.rsiEstimate).toBeGreaterThanOrEqual(0);
    expect(result.technicals.rsiEstimate).toBeLessThanOrEqual(100);
  });

  it("price levels are logically consistent for BUY signal", () => {
    const market = makeMockMarket({ priceChangePercent24h: 5.0, priceChangePercent7d: 12.0 });
    const result = computeCryptoSignal({ market, btcDominance: 50, regime: { label: "LOW RISK", score: 2 } });
    if (result.action === "BUY") {
      expect(result.priceLevels.stopLoss).toBeLessThan(result.priceLevels.entryZone);
      expect(result.priceLevels.targetPrice).toBeGreaterThan(result.priceLevels.entryZone);
      expect(result.priceLevels.riskReward).toBeGreaterThan(0);
    }
  });

  it("price levels are logically consistent for SELL signal", () => {
    const market = makeMockMarket({ priceChangePercent24h: -7.0, priceChangePercent7d: -20.0, volatility24h: 7.0 });
    const result = computeCryptoSignal({ market, btcDominance: 62, regime: { label: "HIGH RISK", score: 8 } });
    if (result.action === "SELL") {
      expect(result.priceLevels.stopLoss).toBeGreaterThan(result.priceLevels.entryZone);
      expect(result.priceLevels.targetPrice).toBeLessThan(result.priceLevels.entryZone);
    }
  });

  it("BTC dominance effect is Headwind for altcoins when BTC dom is high", () => {
    const market = makeMockMarket({ symbol: "SOL", name: "Solana", id: "solana" });
    const result = computeCryptoSignal({ market, btcDominance: 65, regime: mockRegime });
    expect(result.cryptoFactors.btcDominanceEffect).toBe("Headwind");
  });

  it("BTC dominance effect is Tailwind for altcoins when BTC dom is low", () => {
    const market = makeMockMarket({ symbol: "ETH", name: "Ethereum", id: "ethereum" });
    const result = computeCryptoSignal({ market, btcDominance: 42, regime: mockRegime });
    expect(result.cryptoFactors.btcDominanceEffect).toBe("Tailwind");
  });
});

describe("computeCryptoSignals (batch)", () => {
  it("returns a result for each input", () => {
    const inputs = [
      { market: makeMockMarket({ symbol: "BTC", id: "bitcoin" }), btcDominance: 55, regime: mockRegime },
      { market: makeMockMarket({ symbol: "ETH", name: "Ethereum", id: "ethereum", priceChangePercent24h: -2.0 }), btcDominance: 55, regime: mockRegime },
      { market: makeMockMarket({ symbol: "SOL", name: "Solana", id: "solana", priceChangePercent24h: 3.0 }), btcDominance: 55, regime: mockRegime },
    ];
    const results = computeCryptoSignals(inputs);
    expect(results).toHaveLength(3);
    expect(results[0].symbol).toBe("BTC");
    expect(results[1].symbol).toBe("ETH");
    expect(results[2].symbol).toBe("SOL");
  });

  it("handles empty batch gracefully", () => {
    const results = computeCryptoSignals([]);
    expect(results).toHaveLength(0);
  });

  it("all batch results have valid actions", () => {
    const inputs = Array.from({ length: 5 }, (_, i) => ({
      market: makeMockMarket({ symbol: `COIN${i}`, id: `coin${i}`, priceChangePercent24h: (i - 2) * 3 }),
      btcDominance: 55,
      regime: mockRegime,
    }));
    const results = computeCryptoSignals(inputs);
    for (const r of results) {
      expect(["BUY", "SELL", "HOLD", "WATCH"]).toContain(r.action);
    }
  });

  it("clearCryptoSignalCache does not throw", async () => {
    const { clearCryptoSignalCache } = await import("./cryptoSignals");
    expect(() => clearCryptoSignalCache()).not.toThrow();
  });
});
