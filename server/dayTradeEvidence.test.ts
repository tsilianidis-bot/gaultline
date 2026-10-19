import { describe, expect, it } from "vitest";
import { DAY_TRADE_INSUFFICIENT_BARS, dayTradeIndicatorGate } from "./dayTradeEngine";
import { computeCryptoSignal } from "./cryptoSignals";

describe("day-trade completed bars", () => {
  it("returns unavailable for a single price and does not manufacture RSI 50", () => {
    const gate = dayTradeIndicatorGate([100]);
    expect(gate.available).toBe(false);
    expect(gate.rsi).toBeNull();
    expect(DAY_TRADE_INSUFFICIENT_BARS).toContain("Insufficient completed historical bars");
  });

  it("computes RSI from 15 completed closes", () => {
    const closes = Array.from({ length: 15 }, (_, index) => 100 + index);
    const gate = dayTradeIndicatorGate(closes);
    expect(gate.available).toBe(true);
    expect(gate.rsi).not.toBeNull();
    expect(gate.rsi).not.toBe(50);
  });
});

describe("crypto signal without completed bars", () => {
  it("does not emit a sparkline RSI or a directional action", () => {
    const result = computeCryptoSignal({
      market: {
        symbol: "BTC",
        name: "Bitcoin",
        id: "bitcoin",
        image: "",
        currentPrice: 70000,
        marketCap: 1,
        marketCapRank: 1,
        fullyDilutedValuation: null,
        totalVolume: 1,
        high24h: 71000,
        low24h: 69000,
        priceChange24h: 1,
        priceChangePercent24h: 4,
        priceChangePercent7d: 8,
        priceChangePercent30d: 10,
        marketCapChange24h: 0,
        marketCapChangePercent24h: 0,
        circulatingSupply: 1,
        totalSupply: 1,
        maxSupply: 1,
        ath: 80000,
        athChangePercent: -5,
        atl: 1,
        atlChangePercent: 1,
        sparkline7d: Array.from({ length: 48 }, (_, index) => 60000 + index * 100),
        lastUpdated: "2026-10-05T20:00:00.000Z",
        volatility24h: 2,
        distanceFromAth: -5,
      },
      regime: { label: "MODERATE RISK", score: 5 },
    });
    expect(result.actionLabel).toBe("Unavailable");
    expect(result.action).toBe("WATCH");
    expect(result.technicals.rsiEstimate).toBeNull();
    expect(result.technicals.rsiIsTrue).toBe(false);
    expect(`${result.rationale} ${result.actionLabel}`).not.toMatch(/RSI|BUY|SELL|golden cross/i);
  });
});
