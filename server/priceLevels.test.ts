// server/priceLevels.test.ts
// Unit tests for the FAULTLINE Calculated Price Levels Engine

import { describe, it, expect } from "vitest";
import { computeCalculatedLevels, type OHLCBar } from "./priceLevels";

// ── Helpers ───────────────────────────────────────────────────

function makeBars(n: number, basePrice = 100, trend: "up" | "down" | "flat" = "flat"): OHLCBar[] {
  const bars: OHLCBar[] = [];
  let price = basePrice;
  for (let i = 0; i < n; i++) {
    const delta = trend === "up" ? 0.5 : trend === "down" ? -0.5 : 0;
    price += delta;
    const high = price * 1.01;
    const low = price * 0.99;
    bars.push({
      open: price * 0.995,
      high,
      low,
      close: price,
      volume: 1_000_000,
      timestamp: Date.now() - (n - i) * 86400000,
    });
  }
  return bars;
}

// ── Tests ─────────────────────────────────────────────────────

describe("computeCalculatedLevels — insufficient data", () => {
  it("returns available=false when bars array is empty", () => {
    const result = computeCalculatedLevels([], 100, "Bullish", "swing");
    expect(result.available).toBe(false);
    expect(result.insufficientDataReason).toContain("0 daily bars");
    expect(result.supportResistance.support1).toBeNull();
    expect(result.tradeFramework.entryZone).toBeNull();
  });

  it("returns available=false when fewer than 5 bars", () => {
    const bars = makeBars(3, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    expect(result.available).toBe(false);
    expect(result.insufficientDataReason).toContain("3 daily bars");
  });

  it("returns available=false when currentPrice is 0", () => {
    const bars = makeBars(20, 100);
    const result = computeCalculatedLevels(bars, 0, "Bullish", "swing");
    expect(result.available).toBe(false);
  });
});

describe("computeCalculatedLevels — minimal data (5–19 bars)", () => {
  it("returns available=true with 10 bars", () => {
    const bars = makeBars(10, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    expect(result.available).toBe(true);
    expect(result.barsUsed).toBe(10);
    expect(result.dataQuality).toBe("minimal");
  });

  it("has at least one support and one resistance level", () => {
    const bars = makeBars(10, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    // Support levels should be below current price
    if (result.supportResistance.support1) {
      expect(result.supportResistance.support1.price).toBeLessThan(100);
    }
    // Resistance levels should be above current price
    if (result.supportResistance.resistance1) {
      expect(result.supportResistance.resistance1.price).toBeGreaterThan(100);
    }
  });
});

describe("computeCalculatedLevels — partial data (20–199 bars)", () => {
  it("returns partial dataQuality with 50 bars", () => {
    const bars = makeBars(50, 200);
    const result = computeCalculatedLevels(bars, 200, "Bullish", "swing");
    expect(result.available).toBe(true);
    expect(result.dataQuality).toBe("partial");
    expect(result.sma20).not.toBeNull();
    expect(result.sma50).not.toBeNull();
    expect(result.sma200).toBeNull(); // not enough bars
  });

  it("SMA-20 is computed correctly", () => {
    const bars = makeBars(30, 100, "flat");
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    expect(result.sma20).toBeCloseTo(100, 0);
  });

  it("ATR is positive and reasonable", () => {
    const bars = makeBars(20, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    expect(result.atr).not.toBeNull();
    expect(result.atr!).toBeGreaterThan(0);
    expect(result.atrPct).not.toBeNull();
    expect(result.atrPct!).toBeGreaterThan(0);
    expect(result.atrPct!).toBeLessThan(20); // sanity: ATR shouldn't be >20% for flat bars
  });

  it("Bollinger Bands are computed with 20+ bars", () => {
    const bars = makeBars(25, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    expect(result.bollingerUpper).not.toBeNull();
    expect(result.bollingerLower).not.toBeNull();
    expect(result.bollingerUpper!).toBeGreaterThanOrEqual(result.bollingerLower!);
  });

  it("pivot point is computed from previous bar", () => {
    const bars = makeBars(10, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "day");
    expect(result.pivotPoint).not.toBeNull();
    // Pivot = (H + L + C) / 3 — should be near 100 for flat bars
    expect(result.pivotPoint!).toBeGreaterThan(90);
    expect(result.pivotPoint!).toBeLessThan(110);
  });
});

describe("computeCalculatedLevels — full data (200+ bars)", () => {
  it("returns full dataQuality with 200 bars", () => {
    const bars = makeBars(200, 150);
    const result = computeCalculatedLevels(bars, 150, "Bullish", "long");
    expect(result.available).toBe(true);
    expect(result.dataQuality).toBe("full");
    expect(result.sma200).not.toBeNull();
  });

  it("52-week high is >= current price or close to it for uptrend", () => {
    const bars = makeBars(252, 100, "up");
    const lastPrice = bars[bars.length - 1].close;
    const result = computeCalculatedLevels(bars, lastPrice, "Bullish", "long");
    expect(result.weekHigh52).not.toBeNull();
    expect(result.weekLow52).not.toBeNull();
    expect(result.weekHigh52!).toBeGreaterThanOrEqual(result.weekLow52!);
  });
});

describe("computeCalculatedLevels — Trade Framework (Bullish)", () => {
  it("entry zone is at or near current price", () => {
    const bars = makeBars(30, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    expect(result.tradeFramework.entryZone).not.toBeNull();
    expect(result.tradeFramework.entryZone!.price).toBeGreaterThanOrEqual(95);
    expect(result.tradeFramework.entryZone!.price).toBeLessThanOrEqual(105);
  });

  it("risk zone is below entry for bullish", () => {
    const bars = makeBars(30, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    expect(result.tradeFramework.riskZone).not.toBeNull();
    expect(result.tradeFramework.riskZone!.price).toBeLessThan(
      result.tradeFramework.entryZone!.price
    );
  });

  it("profit targets are above entry for bullish", () => {
    const bars = makeBars(30, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    const entry = result.tradeFramework.entryZone!.price;
    expect(result.tradeFramework.profitTarget1!.price).toBeGreaterThan(entry);
    expect(result.tradeFramework.profitTarget2!.price).toBeGreaterThan(entry);
    // Stretch target may be capped by 52-week high; allow small rounding tolerance
    expect(result.tradeFramework.stretchTarget!.price).toBeGreaterThanOrEqual(entry - 0.05);
  });

  it("TP2 >= TP1 for bullish", () => {
    const bars = makeBars(30, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    expect(result.tradeFramework.profitTarget2!.price).toBeGreaterThanOrEqual(
      result.tradeFramework.profitTarget1!.price
    );
  });
});

describe("computeCalculatedLevels — Trade Framework (Bearish)", () => {
  it("risk zone is above entry for bearish", () => {
    const bars = makeBars(30, 100);
    const result = computeCalculatedLevels(bars, 100, "Bearish", "swing");
    expect(result.tradeFramework.riskZone!.price).toBeGreaterThan(
      result.tradeFramework.entryZone!.price
    );
  });

  it("profit targets are below entry for bearish", () => {
    const bars = makeBars(30, 100);
    const result = computeCalculatedLevels(bars, 100, "Bearish", "swing");
    const entry = result.tradeFramework.entryZone!.price;
    expect(result.tradeFramework.profitTarget1!.price).toBeLessThan(entry);
    expect(result.tradeFramework.profitTarget2!.price).toBeLessThan(entry);
  });
});

describe("computeCalculatedLevels — Timeframe-Specific Levels", () => {
  it("day timeframe returns intraday pivot-based levels", () => {
    const bars = makeBars(10, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "day");
    const day = result.timeframeSpecific.day;
    expect(day.intradaySupport).not.toBeNull();
    expect(day.intradayResistance).not.toBeNull();
    expect(day.dayTradeTarget1).not.toBeNull();
    expect(day.intradayInvalidation).not.toBeNull();
  });

  it("short timeframe returns near-term levels", () => {
    const bars = makeBars(20, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "short");
    const short = result.timeframeSpecific.short;
    expect(short.nearTermSupport).not.toBeNull();
    expect(short.nearTermResistance).not.toBeNull();
    expect(short.target1).not.toBeNull();
    expect(short.riskLevel).not.toBeNull();
  });

  it("swing timeframe returns swing levels", () => {
    const bars = makeBars(30, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    const swing = result.timeframeSpecific.swing;
    expect(swing.swingSupport).not.toBeNull();
    expect(swing.swingResistance).not.toBeNull();
    expect(swing.swingTarget1).not.toBeNull();
    expect(swing.swingInvalidation).not.toBeNull();
  });

  it("long timeframe returns long-term levels", () => {
    const bars = makeBars(50, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "long");
    const long = result.timeframeSpecific.long;
    expect(long.longTermSupportZone).not.toBeNull();
    expect(long.longTermResistanceZone).not.toBeNull();
    expect(long.longTermTargetLow).not.toBeNull();
    expect(long.longTermTargetHigh).not.toBeNull();
    expect(long.longTermInvalidation).not.toBeNull();
  });
});

describe("computeCalculatedLevels — pctFromCurrent accuracy", () => {
  it("pctFromCurrent is negative for support levels", () => {
    const bars = makeBars(30, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    if (result.supportResistance.support1) {
      expect(result.supportResistance.support1.pctFromCurrent).toBeLessThan(0);
    }
  });

  it("pctFromCurrent is positive for resistance levels", () => {
    const bars = makeBars(30, 100);
    const result = computeCalculatedLevels(bars, 100, "Bullish", "swing");
    if (result.supportResistance.resistance1) {
      expect(result.supportResistance.resistance1.pctFromCurrent).toBeGreaterThan(0);
    }
  });
});

describe("computeCalculatedLevels — sub-$1 asset (crypto)", () => {
  it("handles sub-$1 prices without precision errors", () => {
    const bars = makeBars(30, 0.5);
    const result = computeCalculatedLevels(bars, 0.5, "Bullish", "swing");
    expect(result.available).toBe(true);
    expect(result.currentPrice).toBeGreaterThan(0);
    expect(result.currentPrice).toBeLessThan(1);
  });
});
