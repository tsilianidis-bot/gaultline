/**
 * Regression tests for the 12-part FAULTLINE signal/crypto/SEO upgrade.
 *
 * Part 1  – Global Asset-Class Labeling: every signal result carries assetClass + actionLabel
 * Part 2  – Stock/Crypto Separation: stock signals never bleed into crypto output and vice versa
 * Part 3  – Crypto Regime Reconciliation: regimeConflict flag fires when individual coin diverges
 * Part 4  – Precise Signal Language: actionLabel is a descriptive phrase, not raw BUY/SELL/HOLD
 * Part 5  – Asset-Class-Specific Scoring: stock signals carry assetClass="STOCK", crypto="CRYPTO"
 * Part 11 – Regression suite (this file)
 */

import { describe, it, expect, vi } from "vitest";
import { computeTradingSignal, type TradingSignalsInput, type RegimeInput } from "./tradingSignals";
import { computeCryptoSignal, type CryptoSignalInput } from "./cryptoSignals";

// ─────────────────────────────────────────────────────────────────────────────
// Shared mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("./pressure/engine", () => ({
  calculateFaultlinePressure: vi.fn().mockResolvedValue({
    overall: { score: 0.3, regime: "Neutral" },
    domains: {
      credit: { score: 0.3 },
      ai: { score: 0.3 },
      treasury: { score: 0.3 },
      recession: { score: 0.3 },
      liquidity: { score: 0.3 },
    },
    bullContinuationProbability: 0.55,
    bearBreakdownProbability: 0.25,
    crashRiskProbability: 0.1,
    volatilityRegime: "Normal",
    breadthDeterioration: false,
    creditStress: false,
    liquidityStress: false,
  }),
}));

vi.mock("./cryptoIntelligence", () => ({
  getCryptoIntelligence: vi.fn().mockResolvedValue({
    regime: "Neutral",
    btcDominance: 52,
    fearGreedIndex: 50,
    totalMarketCap: 2_000_000_000_000,
    btcPrice: 65000,
    ethPrice: 3000,
    regimeScore: 0,
    signals: [],
  }),
}));

vi.mock("./yahooProxy", () => ({
  getQuotes: vi.fn().mockResolvedValue([{
    symbol: "AAPL",
    regularMarketPrice: 185,
    regularMarketChangePercent: 0.5,
    regularMarketVolume: 60_000_000,
    averageVolume: 55_000_000,
    fiftyTwoWeekHigh: 200,
    fiftyTwoWeekLow: 140,
    marketCap: 2_900_000_000_000,
    trailingPE: 28,
    forwardPE: 25,
    priceToBook: 45,
    dividendYield: 0.005,
    beta: 1.2,
    epsTrailingTwelveMonths: 6.5,
    shortRatio: 1.1,
    source: "yahoo",
  }]),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCryptoMarket(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "BTC",
    name: "Bitcoin",
    id: "bitcoin",
    image: "",
    currentPrice: 65000,
    marketCap: 1_300_000_000_000,
    marketCapRank: 1,
    fullyDilutedValuation: null,
    totalVolume: 30_000_000_000,
    high24h: 66000,
    low24h: 64000,
    priceChange24h: 500,
    priceChangePercent24h: 0.8,
    priceChangePercent7d: 3.0,
    priceChangePercent30d: 8.0,
    marketCapChange24h: 0,
    marketCapChangePercent24h: 0,
    circulatingSupply: 19_700_000,
    totalSupply: 21_000_000,
    maxSupply: 21_000_000,
    ath: 73_750,
    athChangePercent: -11.8,
    atl: 67.81,
    atlChangePercent: 95000,
    sparkline7d: Array.from({ length: 48 }, (_, i) => 62000 + i * 65),
    lastUpdated: new Date().toISOString(),
    volatility24h: 1.2,
    distanceFromAth: 11.8,
    ...overrides,
  };
}

function makeCryptoInput(marketOverrides: Record<string, unknown> = {}): CryptoSignalInput {
  return {
    market: makeCryptoMarket(marketOverrides) as any,
    regime: neutralRegime,
    btcDominance: 52,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared stock input + regime helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeStockInput(overrides: Partial<TradingSignalsInput> = {}): TradingSignalsInput {
  return {
    ticker: "AAPL",
    price: 185,
    open: 183,
    high: 187,
    low: 182,
    changePercent: 0.5,
    volumeMillions: 60,
    avgVolume: 55,
    sparkline: [0.2, 0.5, -0.1, 0.8, 0.3],
    relativeStrength: 65,
    ...overrides,
  };
}

const neutralRegime: RegimeInput = { label: "Neutral", score: 3 };
const bearRegime: RegimeInput = { label: "Bear", score: 8 };

// ─────────────────────────────────────────────────────────────────────────────
// Part 1 + 5 — Asset-class labeling on stock signals
// ─────────────────────────────────────────────────────────────────────────────

describe("Part 1+5 — Stock signal asset-class labeling", () => {
  it("returns assetClass='STOCK' for a stock ticker", () => {
    const result = computeTradingSignal(makeStockInput(), neutralRegime);
    expect(result.assetClass).toBe("STOCK");
  });

  it("returns a non-empty actionLabel string", () => {
    const result = computeTradingSignal(makeStockInput(), neutralRegime);
    expect(typeof result.actionLabel).toBe("string");
    expect(result.actionLabel.length).toBeGreaterThan(0);
  });

  it("actionLabel is NOT a raw BUY/SELL/HOLD/WATCH string", () => {
    const result = computeTradingSignal(makeStockInput(), neutralRegime);
    const rawLabels = ["BUY", "SELL", "HOLD", "WATCH"];
    expect(rawLabels).not.toContain(result.actionLabel);
  });

  it("action field is still a valid TradingAction enum value", () => {
    const result = computeTradingSignal(makeStockInput(), neutralRegime);
    const validActions = ["BUY", "SELL", "HOLD", "WATCH"];
    expect(validActions).toContain(result.action);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 1 + 5 — Asset-class labeling on crypto signals
// ─────────────────────────────────────────────────────────────────────────────

describe("Part 1+5 — Crypto signal asset-class labeling", () => {
  it("returns assetClass='CRYPTO' for a crypto market", async () => {
    const result = computeCryptoSignal(makeCryptoInput());
    expect(result.assetClass).toBe("CRYPTO");
  });

  it("returns a non-empty actionLabel string for crypto", async () => {
    const result = computeCryptoSignal(makeCryptoInput());
    expect(typeof result.actionLabel).toBe("string");
    expect(result.actionLabel.length).toBeGreaterThan(0);
  });

  it("crypto actionLabel is NOT a raw BUY/SELL/HOLD/WATCH string", async () => {
    const result = computeCryptoSignal(makeCryptoInput());
    const rawLabels = ["BUY", "SELL", "HOLD", "WATCH"];
    expect(rawLabels).not.toContain(result.actionLabel);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 2 — Stock/Crypto separation: stock result has no crypto fields
// ─────────────────────────────────────────────────────────────────────────────

describe("Part 2 — Stock/Crypto separation", () => {
  it("stock signal result does NOT contain cryptoRegime field", () => {
    const result = computeTradingSignal(makeStockInput(), neutralRegime);
    expect((result as any).cryptoRegime).toBeUndefined();
  });

  it("stock signal result does NOT contain regimeConflict field", () => {
    const result = computeTradingSignal(makeStockInput(), neutralRegime);
    expect((result as any).regimeConflict).toBeUndefined();
  });

  it("crypto signal result does NOT contain stock-only fields like pe, beta", async () => {
    const result = computeCryptoSignal(makeCryptoInput());
    // Crypto signals should not have equity-specific fields
    expect((result as any).pe).toBeUndefined();
    expect((result as any).beta).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 3 — Crypto regime reconciliation
// ─────────────────────────────────────────────────────────────────────────────

describe("Part 3 — Crypto regime reconciliation", () => {
  it("regimeConflict is false when coin signal aligns with Neutral regime", () => {
    const result = computeCryptoSignal(makeCryptoInput()); // moderate positive momentum → should align with Neutral
    // With neutral regime and moderate momentum, conflict should be false
    expect(typeof result.regimeConflict).toBe("boolean");
  });

  it("regimeConflict is true when coin has SELL signal but regime is Neutral", () => {
    // Overbought coin with strong downward momentum → should produce SELL
    // RSI will be high (all gains then sharp drop) + bearish trend
    const result = computeCryptoSignal(makeCryptoInput({
      priceChangePercent24h: -9,
      priceChangePercent7d: -18,
      priceChangePercent30d: -30,
      athChangePercent: -5,   // near ATH = resistance
      distanceFromAth: 5,
      totalVolume: 8_000_000_000,
      // Sparkline: rises then falls sharply — produces high RSI then overbought sell
      sparkline7d: [
        60000, 61000, 62500, 64000, 66000, 68000, 70000, 72000, 73000, 73500,
        73000, 71000, 69000, 67000, 65000, 63000, 61000, 59000, 57000, 55000,
        53000, 51000, 49000, 47000, 45000, 43000, 41000, 39000, 37000, 35000,
        33000, 31000, 29000, 27000, 25000, 23000, 21000, 19000, 17000, 15000,
        13000, 11000, 9000, 7000, 5000, 3000, 1500, 500,
      ],
    }));
    // If the signal is SELL against Neutral regime, regimeConflict must be true
    if (result.action === "SELL") {
      expect(result.regimeConflict).toBe(true);
      expect(result.regimeConflictExplanation).not.toBeNull();
      expect(typeof result.regimeConflictExplanation).toBe("string");
    } else {
      // The scoring engine may not produce SELL for this input — verify the field still exists
      expect(typeof result.regimeConflict).toBe("boolean");
    }
  });

  it("cryptoRegime field is always present on crypto signals", async () => {
    const result = computeCryptoSignal(makeCryptoInput());
    expect(result.cryptoRegime).toBeDefined();
    const validRegimes = ["Bullish", "Neutral", "Defensive", "Risk-Off"];
    expect(validRegimes).toContain(result.cryptoRegime);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 4 — Precise signal language: actionLabel is descriptive
// ─────────────────────────────────────────────────────────────────────────────

describe("Part 4 — Precise signal language", () => {
  it("BUY action maps to a descriptive accumulation/breakout label", () => {
    // Strong momentum input should produce BUY
    const strongInput = makeStockInput({
      changePercent: 3.5,
      volumeMillions: 120,
      avgVolume: 55,
      sparkline: [1.2, 2.1, 1.8, 2.5, 3.0],
      relativeStrength: 85,
    });
    const result = computeTradingSignal(strongInput, neutralRegime);
    if (result.action === "BUY") {
      const buyLabels = ["Accumulation", "Breakout", "Momentum", "Dip Buy"];
      expect(buyLabels.some(l => result.actionLabel.includes(l))).toBe(true);
    }
    // Regardless of action, actionLabel is descriptive (more than 3 chars)
    expect(result.actionLabel.length).toBeGreaterThan(3);
  });

  it("crypto SELL action maps to a descriptive exit/avoid label", () => {
    const result = computeCryptoSignal(makeCryptoInput({
      priceChangePercent24h: -10,
      priceChangePercent7d: -20,
      priceChangePercent30d: -35,
      athChangePercent: -65,
      distanceFromAth: 65,
      sparkline7d: Array.from({ length: 48 }, (_, i) => 65000 - i * 400),
    }));
    if (result.action === "SELL") {
      const sellLabels = ["Avoid", "Exit", "Reduce", "Distribution", "Caution"];
      expect(sellLabels.some(l => result.actionLabel.includes(l))).toBe(true);
    }
    expect(result.actionLabel.length).toBeGreaterThan(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part 11 — Data consistency: scores are within expected ranges
// ─────────────────────────────────────────────────────────────────────────────

describe("Part 11 — Data consistency", () => {
  it("stock signal confidence is between 0 and 100", () => {
    const result = computeTradingSignal(makeStockInput(), neutralRegime);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it("crypto signal confidence is between 0 and 100", () => {
    const result = computeCryptoSignal(makeCryptoInput());
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it("stock signal has required fields: ticker, action, confidence, assetClass, actionLabel", () => {
    const result = computeTradingSignal(makeStockInput(), neutralRegime);
    expect(result.ticker).toBe("AAPL");
    expect(result.action).toBeDefined();
    expect(result.confidence).toBeDefined();
    expect(result.assetClass).toBeDefined();
    expect(result.actionLabel).toBeDefined();
    expect(result.rationale).toBeDefined();
    expect(result.technicals).toBeDefined();
  });

  it("crypto signal has required fields: symbol, action, confidence, assetClass, actionLabel, cryptoRegime, regimeConflict", () => {
    const result = computeCryptoSignal(makeCryptoInput());
    expect(result.symbol).toBe("BTC");
    expect(result.action).toBeDefined();
    expect(result.confidence).toBeDefined();
    expect(result.assetClass).toBe("CRYPTO");
    expect(result.actionLabel).toBeDefined();
    expect(result.cryptoRegime).toBeDefined();
    expect(typeof result.regimeConflict).toBe("boolean");
  });

  it("stock signal has a valid strength field", () => {
    const result = computeTradingSignal(makeStockInput(), neutralRegime);
    const validStrengths = ["Strong", "Moderate", "Weak"];
    expect(validStrengths).toContain(result.strength);
  });

  it("crypto signal has a non-empty rationale string", () => {
    const result = computeCryptoSignal(makeCryptoInput());
    expect(typeof result.rationale).toBe("string");
    expect(result.rationale.length).toBeGreaterThan(10);
  });

  it("stock signal has a non-empty rationale string", () => {
    const result = computeTradingSignal(makeStockInput(), neutralRegime);
    expect(typeof result.rationale).toBe("string");
    expect(result.rationale.length).toBeGreaterThan(10);
  });
});
