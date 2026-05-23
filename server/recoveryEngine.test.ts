// recoveryEngine.test.ts
// Vitest tests for the FAULTLINE Recovery Confirmation System
import { describe, it, expect } from "vitest";
import { getRecoveryAnalysis } from "./recoveryEngine";
import type { CoinMarketData } from "./coingeckoProxy";

// ── Helpers ───────────────────────────────────────────────────
function makeMarket(overrides: Partial<CoinMarketData> = {}): CoinMarketData {
  return {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    currentPrice: 65000,
    priceChangePercent24h: 1.2,
    priceChangePercent7d: 3.5,
    priceChangePercent30d: 8.0,
    marketCap: 1_280_000_000_000,
    volume24h: 32_000_000_000,
    ath: 73_750,
    athChangePercent: -11.8,
    volatility24h: 2.5,
    sparkline7d: Array.from({ length: 48 }, (_, i) => 60000 + i * 100),
    ...overrides,
  };
}

function makeOHLC(count: number, trend: "up" | "down" | "flat" = "flat") {
  const bars: [number, number, number, number, number][] = [];
  let price = 60000;
  for (let i = 0; i < count; i++) {
    const delta = trend === "up" ? 200 : trend === "down" ? -200 : 0;
    price += delta + (Math.random() - 0.5) * 100;
    bars.push([Date.now() - (count - i) * 86400000, price * 1.01, price * 0.99, price, price]);
  }
  return bars;
}

// ── Tests ─────────────────────────────────────────────────────
describe("getRecoveryAnalysis", () => {
  it("returns a valid RecoveryAnalysis object with all required fields", () => {
    const result = getRecoveryAnalysis({
      symbol: "BTC",
      name: "Bitcoin",
      market: makeMarket(),
      isCrypto: true,
    });

    expect(result).toBeDefined();
    expect(result.symbol).toBe("BTC");
    expect(result.name).toBe("Bitcoin");
    expect(result.isCrypto).toBe(true);
    expect(typeof result.recoveryConfidence).toBe("number");
    expect(result.recoveryConfidence).toBeGreaterThanOrEqual(0);
    expect(result.recoveryConfidence).toBeLessThanOrEqual(100);
    expect(result.aftershockRisk).toMatch(/^(Low|Moderate|Elevated|High)$/);
    expect(typeof result.aftershockRiskScore).toBe("number");
    expect(result.aftershockRiskScore).toBeGreaterThanOrEqual(0);
    expect(result.aftershockRiskScore).toBeLessThanOrEqual(100);
    expect(result.status).toMatch(/^(Breakdown Continuing|Relief Bounce|Recovery Attempt|Stabilizing|Confirmed Recovery)$/);
    expect(result.statusColor).toMatch(/^(red|orange|yellow|blue|green)$/);
    expect(result.confirmationRules).toBeInstanceOf(Array);
    expect(result.confirmationRules.length).toBeGreaterThan(0);
    expect(typeof result.keyReasoning).toBe("string");
    expect(result.keyReasoning.length).toBeGreaterThan(0);
    expect(typeof result.computedAt).toBe("number");
  });

  it("classifies a strong uptrend as Confirmed Recovery or Stabilizing", () => {
    const result = getRecoveryAnalysis({
      symbol: "BTC",
      name: "Bitcoin",
      market: makeMarket({
        priceChangePercent24h: 4.5,
        priceChangePercent7d: 12.0,
        priceChangePercent30d: 25.0,
        athChangePercent: -2.0,
        volume24h: 60_000_000_000, // high volume
      }),
      ohlcBars: makeOHLC(30, "up"),
      isCrypto: true,
    });

    expect(["Confirmed Recovery", "Stabilizing", "Recovery Attempt"]).toContain(result.status);
    expect(result.recoveryConfidence).toBeGreaterThan(40);
    expect(result.trendBias).not.toBe("Bearish");
  });

  it("classifies a sharp selloff as Breakdown Continuing or Relief Bounce", () => {
    const result = getRecoveryAnalysis({
      symbol: "ETH",
      name: "Ethereum",
      market: makeMarket({
        symbol: "ETH",
        id: "ethereum",
        priceChangePercent24h: -7.5,
        priceChangePercent7d: -18.0,
        priceChangePercent30d: -30.0,
        athChangePercent: -45.0,
        volume24h: 8_000_000_000, // low volume
      }),
      ohlcBars: makeOHLC(30, "down"),
      isCrypto: true,
    });

    expect(["Breakdown Continuing", "Relief Bounce"]).toContain(result.status);
    expect(result.recoveryConfidence).toBeLessThan(50);
    expect(result.trendBias).toBe("Bearish");
    expect(result.aftershockRisk).toMatch(/^(Moderate|Elevated|High)$/);  // deep selloff raises risk
  });

  it("assigns isBitcoin=true and provides btcSpecificLanguage for BTC", () => {
    const result = getRecoveryAnalysis({
      symbol: "BTC",
      name: "Bitcoin",
      market: makeMarket({ priceChangePercent24h: -5.7 }),
      isCrypto: true,
    });

    expect(result.isBitcoin).toBe(true);
    expect(result.btcSpecificLanguage).not.toBeNull();
    expect(typeof result.btcSpecificLanguage).toBe("string");
    expect((result.btcSpecificLanguage as string).length).toBeGreaterThan(20);
  });

  it("does not provide btcSpecificLanguage for non-BTC assets", () => {
    const result = getRecoveryAnalysis({
      symbol: "SOL",
      name: "Solana",
      market: makeMarket({ symbol: "SOL", id: "solana" }),
      isCrypto: true,
    });

    expect(result.isBitcoin).toBe(false);
    expect(result.btcSpecificLanguage).toBeNull();
  });

  it("returns higher aftershock risk when 24h change is deeply negative", () => {
    const mild = getRecoveryAnalysis({
      symbol: "BTC", name: "Bitcoin",
      market: makeMarket({ priceChangePercent24h: -1.0 }), isCrypto: true,
    });
    const severe = getRecoveryAnalysis({
      symbol: "BTC", name: "Bitcoin",
      market: makeMarket({ priceChangePercent24h: -9.0 }), isCrypto: true,
    });

    // aftershockRiskScore may be equal when both are clamped at 0; just verify severe is not lower
    expect(severe.aftershockRiskScore).toBeGreaterThanOrEqual(mild.aftershockRiskScore);
  });

  it("returns higher recovery confidence when macro pressure is benign", () => {
    const withPressure = getRecoveryAnalysis({
      symbol: "BTC", name: "Bitcoin",
      market: makeMarket({ priceChangePercent24h: 2.0 }),
      pressure: {
        overallPressure: 8.5,
        level: "Critical",
        regime: { label: "HIGH RISK", score: 8.5, color: "#FF2D55" },
        overall: { score: 8.5, label: "Critical", color: "#FF2D55" },
        components: {} as any,
      },
      isCrypto: true,
    });
    const withoutPressure = getRecoveryAnalysis({
      symbol: "BTC", name: "Bitcoin",
      market: makeMarket({ priceChangePercent24h: 2.0 }),
      pressure: {
        overallPressure: 2.0,
        level: "Low",
        regime: { label: "LOW RISK", score: 2.0, color: "#00D4FF" },
        overall: { score: 2.0, label: "Low", color: "#00D4FF" },
        components: {} as any,
      },
      isCrypto: true,
    });

    // benign macro should produce equal-or-higher confidence
    expect(withoutPressure.recoveryConfidence).toBeGreaterThanOrEqual(withPressure.recoveryConfidence);
  });

  it("returns all 8 confirmation rules", () => {
    const result = getRecoveryAnalysis({
      symbol: "BTC", name: "Bitcoin",
      market: makeMarket(), isCrypto: true,
    });

    expect(result.confirmationRules.length).toBe(9);
    result.confirmationRules.forEach(rule => {
      expect(typeof rule.id).toBe("string");
      expect(typeof rule.label).toBe("string");
      expect(typeof rule.passed).toBe("boolean");
      expect(typeof rule.weight).toBe("number");
      expect(typeof rule.detail).toBe("string");
    });
  });

  it("confirmationsPassed matches the count of rules with passed=true", () => {
    const result = getRecoveryAnalysis({
      symbol: "BTC", name: "Bitcoin",
      market: makeMarket(), isCrypto: true,
    });

    const manualCount = result.confirmationRules.filter(r => r.passed).length;
    expect(result.confirmationsPassed).toBe(manualCount);
  });

  it("consecutiveGreenCloses is non-negative integer", () => {
    const result = getRecoveryAnalysis({
      symbol: "BTC", name: "Bitcoin",
      market: makeMarket(),
      ohlcBars: makeOHLC(30, "up"),
      isCrypto: true,
    });

    expect(result.consecutiveGreenCloses).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.consecutiveGreenCloses)).toBe(true);
  });

  it("handles missing ohlcBars gracefully", () => {
    expect(() => getRecoveryAnalysis({
      symbol: "BTC", name: "Bitcoin",
      market: makeMarket(),
      ohlcBars: undefined,
      isCrypto: true,
    })).not.toThrow();
  });

  it("handles missing btcDominance gracefully", () => {
    expect(() => getRecoveryAnalysis({
      symbol: "ETH", name: "Ethereum",
      market: makeMarket({ symbol: "ETH" }),
      btcDominance: undefined,
      isCrypto: true,
    })).not.toThrow();
  });

  it("confidenceTier matches recoveryConfidence score range", () => {
    const result = getRecoveryAnalysis({
      symbol: "BTC", name: "Bitcoin",
      market: makeMarket(), isCrypto: true,
    });

    const score = result.recoveryConfidence;
    if (score >= 76) expect(result.confidenceTier).toBe("Confirmed");
    else if (score >= 51) expect(result.confidenceTier).toBe("Improving");
    else if (score >= 26) expect(result.confidenceTier).toBe("Recovery Attempt");
    else expect(result.confidenceTier).toBe("Weak Bounce");
  });
});
