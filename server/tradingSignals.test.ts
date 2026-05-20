// ============================================================
// FAULTLINE — Trading Signals Engine Tests
// ============================================================
import { describe, it, expect, beforeEach } from "vitest";
import {
  computeTradingSignal,
  computeTradingSignals,
  clearSignalCache,
  getSignalCacheStats,
  type TradingSignalsInput,
  type TradingSignalResult,
} from "./tradingSignals";

// ── Fixtures ──────────────────────────────────────────────────

const MODERATE_REGIME = { label: "MODERATE RISK", score: 5 };
const BULLISH_REGIME  = { label: "AI MELT-UP",    score: 2 };
const BEARISH_REGIME  = { label: "CREDIT STRESS", score: 8 };

function makeTicker(overrides: Partial<TradingSignalsInput> = {}): TradingSignalsInput {
  return {
    ticker: "NVDA",
    price: 120,
    open: 118,
    high: 124,
    low: 116,
    changePercent: 1.8,
    volumeMillions: 45,
    avgVolume: 30,
    sparkline: [-0.5, 0.2, 0.8, 1.4, 2.1],  // uptrend
    relativeStrength: 72,
    ...overrides,
  };
}

beforeEach(() => {
  clearSignalCache();
});

// ── Structure tests ───────────────────────────────────────────

describe("computeTradingSignal — output structure", () => {
  it("returns all required fields", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);

    expect(result).toHaveProperty("ticker");
    expect(result).toHaveProperty("action");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("strength");
    expect(result).toHaveProperty("timeframe");
    expect(result).toHaveProperty("rationale");
    expect(result).toHaveProperty("technicals");
    expect(result).toHaveProperty("priceLevels");
    expect(result).toHaveProperty("regimeAlignment");
    expect(result).toHaveProperty("regimeAlignmentScore");
    expect(result).toHaveProperty("computedAt");
  });

  it("technicals block has all required sub-fields", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    const t = result.technicals;

    expect(t).toHaveProperty("rsiEstimate");
    expect(t).toHaveProperty("rsiLabel");
    expect(t).toHaveProperty("trend");
    expect(t).toHaveProperty("volumeSignal");
    expect(t).toHaveProperty("momentumScore");
    expect(t).toHaveProperty("smaSignal");
  });

  it("priceLevels block has all required sub-fields", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    const p = result.priceLevels;

    expect(p).toHaveProperty("support");
    expect(p).toHaveProperty("resistance");
    expect(p).toHaveProperty("entryZone");
    expect(p).toHaveProperty("stopLoss");
    expect(p).toHaveProperty("targetPrice");
  });
});

// ── Value range tests ─────────────────────────────────────────

describe("computeTradingSignal — value ranges", () => {
  it("confidence is between 30 and 95", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(result.confidence).toBeGreaterThanOrEqual(30);
    expect(result.confidence).toBeLessThanOrEqual(95);
  });

  it("RSI estimate is between 0 and 100", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(result.technicals.rsiEstimate).toBeGreaterThanOrEqual(0);
    expect(result.technicals.rsiEstimate).toBeLessThanOrEqual(100);
  });

  it("momentum score is between 0 and 100", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(result.technicals.momentumScore).toBeGreaterThanOrEqual(0);
    expect(result.technicals.momentumScore).toBeLessThanOrEqual(100);
  });

  it("regime alignment score is between 0 and 10", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(result.regimeAlignmentScore).toBeGreaterThanOrEqual(0);
    expect(result.regimeAlignmentScore).toBeLessThanOrEqual(10);
  });

  it("action is one of BUY | SELL | HOLD | WATCH", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(["BUY", "SELL", "HOLD", "WATCH"]).toContain(result.action);
  });

  it("strength is one of Strong | Moderate | Weak", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(["Strong", "Moderate", "Weak"]).toContain(result.strength);
  });

  it("timeframe is one of Short-Term | Swing | Watch", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(["Short-Term", "Swing", "Watch"]).toContain(result.timeframe);
  });

  it("regimeAlignment is one of Aligned | Neutral | Counter-Trend", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(["Aligned", "Neutral", "Counter-Trend"]).toContain(result.regimeAlignment);
  });

  it("rsiLabel is one of Overbought | Neutral | Oversold", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(["Overbought", "Neutral", "Oversold"]).toContain(result.technicals.rsiLabel);
  });

  it("trend is one of Uptrend | Downtrend | Sideways", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(["Uptrend", "Downtrend", "Sideways"]).toContain(result.technicals.trend);
  });

  it("volumeSignal is one of Surge | Normal | Low", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(["Surge", "Normal", "Low"]).toContain(result.technicals.volumeSignal);
  });

  it("smaSignal is one of Golden Cross | Death Cross | Neutral", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(["Golden Cross", "Death Cross", "Neutral"]).toContain(result.technicals.smaSignal);
  });
});

// ── Directional logic tests ───────────────────────────────────

describe("computeTradingSignal — directional logic", () => {
  it("strong uptrend with high RS and volume surge leans BUY", () => {
    const input = makeTicker({
      sparkline: [0, 1.5, 3, 4.5, 6],  // strong uptrend
      relativeStrength: 80,
      volumeMillions: 60,
      avgVolume: 30,
      changePercent: 4,
    });
    const result = computeTradingSignal(input, BULLISH_REGIME);
    expect(["BUY", "HOLD"]).toContain(result.action);
  });

  it("strong downtrend with low RS leans SELL", () => {
    const input = makeTicker({
      sparkline: [0, -1.5, -3, -4.5, -6],  // strong downtrend
      relativeStrength: 20,
      changePercent: -4,
      volumeMillions: 50,
      avgVolume: 30,
    });
    const result = computeTradingSignal(input, BEARISH_REGIME);
    expect(["SELL", "HOLD"]).toContain(result.action);
  });

  it("flat sparkline with no conviction returns HOLD or WATCH", () => {
    const input = makeTicker({
      sparkline: [0, 0.1, -0.1, 0.2, -0.2],  // sideways
      relativeStrength: 50,
      changePercent: 0.1,
    });
    const result = computeTradingSignal(input, MODERATE_REGIME);
    expect(["HOLD", "WATCH"]).toContain(result.action);
  });

  it("BUY in bullish regime gets Aligned or Neutral regime alignment", () => {
    const input = makeTicker({
      sparkline: [0, 1, 2, 3, 4],
      relativeStrength: 75,
      changePercent: 3,
    });
    const result = computeTradingSignal(input, BULLISH_REGIME);
    if (result.action === "BUY") {
      expect(["Aligned", "Neutral"]).toContain(result.regimeAlignment);
    }
  });

  it("SELL in bearish regime gets Aligned regime alignment", () => {
    const input = makeTicker({
      sparkline: [0, -2, -4, -6, -8],
      relativeStrength: 15,
      changePercent: -5,
    });
    const result = computeTradingSignal(input, BEARISH_REGIME);
    if (result.action === "SELL") {
      expect(result.regimeAlignment).toBe("Aligned");
    }
  });
});

// ── Price levels tests ────────────────────────────────────────

describe("computeTradingSignal — price levels", () => {
  it("support is below current price", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(result.priceLevels.support).toBeLessThan(makeTicker().price);
  });

  it("resistance is above current price", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(result.priceLevels.resistance).toBeGreaterThan(makeTicker().price);
  });

  it("BUY stop-loss is below entry zone", () => {
    const input = makeTicker({
      sparkline: [0, 1, 2, 3, 4],
      relativeStrength: 75,
      changePercent: 3,
    });
    const result = computeTradingSignal(input, BULLISH_REGIME);
    if (result.action === "BUY") {
      expect(result.priceLevels.stopLoss).toBeLessThan(result.priceLevels.entryZone);
    }
  });

  it("BUY target price is above entry zone", () => {
    const input = makeTicker({
      sparkline: [0, 1, 2, 3, 4],
      relativeStrength: 75,
      changePercent: 3,
    });
    const result = computeTradingSignal(input, BULLISH_REGIME);
    if (result.action === "BUY") {
      expect(result.priceLevels.targetPrice).toBeGreaterThan(result.priceLevels.entryZone);
    }
  });
});

// ── Batch processing tests ────────────────────────────────────

describe("computeTradingSignals — batch", () => {
  it("returns one result per input ticker", () => {
    const inputs = [
      makeTicker({ ticker: "NVDA" }),
      makeTicker({ ticker: "TSLA", relativeStrength: 40 }),
      makeTicker({ ticker: "SPY",  relativeStrength: 55 }),
    ];
    const results = computeTradingSignals(inputs, MODERATE_REGIME);
    expect(results).toHaveLength(3);
  });

  it("each result has the correct ticker", () => {
    const inputs = [
      makeTicker({ ticker: "NVDA" }),
      makeTicker({ ticker: "TSLA" }),
    ];
    const results = computeTradingSignals(inputs, MODERATE_REGIME);
    expect(results[0].ticker).toBe("NVDA");
    expect(results[1].ticker).toBe("TSLA");
  });

  it("returns empty array for empty input", () => {
    const results = computeTradingSignals([], MODERATE_REGIME);
    expect(results).toHaveLength(0);
  });
});

// ── Cache tests ───────────────────────────────────────────────

describe("signal cache", () => {
  it("cache starts empty after clearSignalCache()", () => {
    clearSignalCache();
    expect(getSignalCacheStats().size).toBe(0);
  });

  it("cache grows after computing signals", () => {
    computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(getSignalCacheStats().size).toBeGreaterThan(0);
  });

  it("clearSignalCache() empties the cache", () => {
    computeTradingSignal(makeTicker(), MODERATE_REGIME);
    clearSignalCache();
    expect(getSignalCacheStats().size).toBe(0);
  });

  it("same input returns same result (deterministic)", () => {
    const input = makeTicker();
    const r1 = computeTradingSignal(input, MODERATE_REGIME);
    const r2 = computeTradingSignal(input, MODERATE_REGIME);
    expect(r1.action).toBe(r2.action);
    expect(r1.confidence).toBe(r2.confidence);
  });
});

// ── Edge case tests ───────────────────────────────────────────

describe("computeTradingSignal — edge cases", () => {
  it("handles empty sparkline gracefully", () => {
    const input = makeTicker({ sparkline: [] });
    expect(() => computeTradingSignal(input, MODERATE_REGIME)).not.toThrow();
    const result = computeTradingSignal(input, MODERATE_REGIME);
    expect(["BUY", "SELL", "HOLD", "WATCH"]).toContain(result.action);
  });

  it("handles zero avgVolume gracefully (no division by zero)", () => {
    const input = makeTicker({ avgVolume: 0 });
    expect(() => computeTradingSignal(input, MODERATE_REGIME)).not.toThrow();
  });

  it("handles extreme RSI (all gains) without crashing", () => {
    const input = makeTicker({
      sparkline: [0, 5, 10, 15, 20],
      changePercent: 20,
    });
    const result = computeTradingSignal(input, MODERATE_REGIME);
    expect(result.technicals.rsiEstimate).toBeLessThanOrEqual(100);
  });

  it("handles extreme RSI (all losses) without crashing", () => {
    const input = makeTicker({
      sparkline: [0, -5, -10, -15, -20],
      changePercent: -20,
    });
    const result = computeTradingSignal(input, MODERATE_REGIME);
    expect(result.technicals.rsiEstimate).toBeGreaterThanOrEqual(0);
  });

  it("rationale is a non-empty string", () => {
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    expect(typeof result.rationale).toBe("string");
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it("computedAt is a recent timestamp", () => {
    const before = Date.now();
    const result = computeTradingSignal(makeTicker(), MODERATE_REGIME);
    const after = Date.now();
    expect(result.computedAt).toBeGreaterThanOrEqual(before);
    expect(result.computedAt).toBeLessThanOrEqual(after);
  });
});
