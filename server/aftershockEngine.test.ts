/**
 * Aftershock Engine™ — Vitest test suite
 * Tests rupture detection, contagion graph, signal classification,
 * and the full engine pipeline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock external dependencies ────────────────────────────────

vi.mock("./coingeckoProxy", () => ({
  getTopMarkets: vi.fn().mockResolvedValue([
    {
      id: "bitcoin", symbol: "BTC", name: "Bitcoin",
      current_price: 65000, price_change_percentage_24h: -5.8,
      price_change_percentage_7d_in_currency: -8.2,
      market_cap: 1_280_000_000_000, total_volume: 42_000_000_000,
      sparkline_in_7d: { price: [] },
    },
    {
      id: "ethereum", symbol: "ETH", name: "Ethereum",
      current_price: 3200, price_change_percentage_24h: -4.1,
      price_change_percentage_7d_in_currency: -6.0,
      market_cap: 385_000_000_000, total_volume: 18_000_000_000,
      sparkline_in_7d: { price: [] },
    },
    {
      id: "solana", symbol: "SOL", name: "Solana",
      current_price: 145, price_change_percentage_24h: -7.2,
      price_change_percentage_7d_in_currency: -12.0,
      market_cap: 65_000_000_000, total_volume: 4_500_000_000,
      sparkline_in_7d: { price: [] },
    },
  ]),
  getGlobalStats: vi.fn().mockResolvedValue({
    total_market_cap: { usd: 2_200_000_000_000 },
    total_volume: { usd: 95_000_000_000 },
    market_cap_percentage: { btc: 58.5 },
    market_cap_change_percentage_24h_usd: -3.8,
  }),
}));

vi.mock("./pressureEngine", () => ({
  computePressureIndex: vi.fn().mockResolvedValue({
    overallPressure: 72,
    domains: {
      treasuryDebt: { score: 68 },
      creditStress: { score: 55 },
      recession: { score: 45 },
      aiBubble: { score: 80 },
    },
  }),
}));

vi.mock("./yahooProxy", () => ({
  getQuotes: vi.fn().mockResolvedValue({
    NVDA: { symbol: "NVDA", regularMarketPrice: 890, regularMarketChangePercent: 8.5, regularMarketVolume: 52_000_000, averageVolume: 35_000_000 },
    AMD:  { symbol: "AMD",  regularMarketPrice: 175, regularMarketChangePercent: 3.2, regularMarketVolume: 28_000_000, averageVolume: 22_000_000 },
    TSLA: { symbol: "TSLA", regularMarketPrice: 185, regularMarketChangePercent: -6.1, regularMarketVolume: 110_000_000, averageVolume: 75_000_000 },
    SPY:  { symbol: "SPY",  regularMarketPrice: 510, regularMarketChangePercent: -1.2, regularMarketVolume: 80_000_000, averageVolume: 60_000_000 },
    QQQ:  { symbol: "QQQ",  regularMarketPrice: 430, regularMarketChangePercent: -1.8, regularMarketVolume: 45_000_000, averageVolume: 35_000_000 },
    TLT:  { symbol: "TLT",  regularMarketPrice: 92,  regularMarketChangePercent: -2.5, regularMarketVolume: 22_000_000, averageVolume: 15_000_000 },
    GLD:  { symbol: "GLD",  regularMarketPrice: 215, regularMarketChangePercent: 1.8,  regularMarketVolume: 12_000_000, averageVolume: 9_000_000 },
    COIN: { symbol: "COIN", regularMarketPrice: 195, regularMarketChangePercent: -9.2, regularMarketVolume: 18_000_000, averageVolume: 8_000_000 },
    MSTR: { symbol: "MSTR", regularMarketPrice: 1450, regularMarketChangePercent: -11.5, regularMarketVolume: 5_000_000, averageVolume: 2_500_000 },
  }),
}));

// ── Import after mocks ─────────────────────────────────────────

import {
  runAftershockEngine,
  getAssetContagionChain,
  getAllContagionAssets,
  clearAftershockCache,
} from "./aftershockEngine";

// ── Tests ──────────────────────────────────────────────────────

describe("Aftershock Engine™ — Core Pipeline", () => {
  beforeEach(() => {
    clearAftershockCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearAftershockCache();
  });

  it("should run the full engine and return a valid AftershockEngineResult", async () => {
    const result = await runAftershockEngine();

    expect(result).toBeDefined();
    expect(result).toHaveProperty("activeRuptures");
    expect(result).toHaveProperty("aftershocks");
    expect(result).toHaveProperty("chains");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("pressureIndex");
    expect(result).toHaveProperty("systemicRiskLevel");
    expect(result).toHaveProperty("generatedAt");
  });

  it("should return a numeric pressureIndex between 0 and 100", async () => {
    const result = await runAftershockEngine();
    expect(result.pressureIndex).toBeGreaterThanOrEqual(0);
    expect(result.pressureIndex).toBeLessThanOrEqual(100);
  });

  it("should classify systemicRiskLevel as one of the four valid levels", async () => {
    const result = await runAftershockEngine();
    expect(["Low", "Moderate", "Elevated", "High", "Critical"]).toContain(result.systemicRiskLevel);
  });

  it("should return a non-empty summary string", async () => {
    const result = await runAftershockEngine();
    expect(typeof result.summary).toBe("string");
    expect(result.summary.length).toBeGreaterThan(10);
  });

  it("should have generatedAt as a recent timestamp", async () => {
    const before = Date.now();
    const result = await runAftershockEngine();
    const after  = Date.now();
    expect(result.generatedAt).toBeGreaterThanOrEqual(before);
    expect(result.generatedAt).toBeLessThanOrEqual(after);
  });
});

describe("Aftershock Engine™ — Rupture Detection", () => {
  beforeEach(() => {
    clearAftershockCache();
    vi.clearAllMocks();
  });

  it("should detect ruptures as an array", async () => {
    const result = await runAftershockEngine();
    expect(Array.isArray(result.activeRuptures)).toBe(true);
  });

  it("each rupture should have required fields", async () => {
    const result = await runAftershockEngine();
    for (const rupture of result.activeRuptures) {
      expect(rupture).toHaveProperty("id");
      expect(rupture).toHaveProperty("triggerAsset");
      expect(rupture).toHaveProperty("triggerName");
      expect(rupture).toHaveProperty("assetClass");
      expect(rupture).toHaveProperty("ruptureType");
      expect(rupture).toHaveProperty("magnitude");
      expect(rupture).toHaveProperty("strength");
      expect(rupture).toHaveProperty("direction");
      expect(rupture).toHaveProperty("description");
      expect(rupture).toHaveProperty("aftershockWindowHours");
    }
  });

  it("rupture strength should be between 0 and 100", async () => {
    const result = await runAftershockEngine();
    for (const rupture of result.activeRuptures) {
      expect(rupture.strength).toBeGreaterThanOrEqual(0);
      expect(rupture.strength).toBeLessThanOrEqual(100);
    }
  });

  it("rupture direction should be Bullish, Bearish, or Uncertain", async () => {
    const result = await runAftershockEngine();
    for (const rupture of result.activeRuptures) {
      expect(["Bullish", "Bearish", "Uncertain"]).toContain(rupture.direction);
    }
  });

  it("rupture assetClass should be a valid class", async () => {
    const result = await runAftershockEngine();
    const validClasses = ["Stock", "ETF", "Crypto", "Macro", "Sector"];
    for (const rupture of result.activeRuptures) {
      expect(validClasses).toContain(rupture.assetClass);
    }
  });
});

describe("Aftershock Engine™ — Aftershock Signals", () => {
  beforeEach(() => {
    clearAftershockCache();
    vi.clearAllMocks();
  });

  it("should return aftershocks as an array", async () => {
    const result = await runAftershockEngine();
    expect(Array.isArray(result.aftershocks)).toBe(true);
  });

  it("each aftershock should have required fields", async () => {
    const result = await runAftershockEngine();
    for (const signal of result.aftershocks) {
      expect(signal).toHaveProperty("id");
      expect(signal).toHaveProperty("ruptureId");
      expect(signal).toHaveProperty("triggerAsset");
      expect(signal).toHaveProperty("relatedAsset");
      expect(signal).toHaveProperty("label");
      expect(signal).toHaveProperty("probability");
      expect(signal).toHaveProperty("strength");
      expect(signal).toHaveProperty("timingWindowHours");
      expect(signal).toHaveProperty("timingWindowLabel");
      expect(signal).toHaveProperty("direction");
      expect(signal).toHaveProperty("confidence");
      expect(signal).toHaveProperty("confirmationStatus");
      expect(signal).toHaveProperty("explanation");
    }
  });

  it("aftershock probability should be between 0 and 100", async () => {
    const result = await runAftershockEngine();
    for (const signal of result.aftershocks) {
      expect(signal.probability).toBeGreaterThanOrEqual(0);
      expect(signal.probability).toBeLessThanOrEqual(100);
    }
  });

  it("aftershock label should be one of the 9 valid labels", async () => {
    const validLabels = [
      "Primary Rupture", "First-Wave Aftershock", "Delayed Reaction",
      "Sympathy Momentum", "Sector Echo", "Liquidity Spillover",
      "Macro Shockwave", "Fading Aftershock", "False Aftershock",
    ];
    const result = await runAftershockEngine();
    for (const signal of result.aftershocks) {
      expect(validLabels).toContain(signal.label);
    }
  });

  it("aftershock confidence should be High, Moderate, or Low", async () => {
    const result = await runAftershockEngine();
    for (const signal of result.aftershocks) {
      expect(["High", "Moderate", "Low"]).toContain(signal.confidence);
    }
  });

  it("aftershock confirmationStatus should be a valid status", async () => {
    const result = await runAftershockEngine();
    const validStatuses = ["Confirmed", "Developing", "Unconfirmed", "Fading"];
    for (const signal of result.aftershocks) {
      expect(validStatuses).toContain(signal.confirmationStatus);
    }
  });
});

describe("Aftershock Engine™ — Contagion Chains", () => {
  beforeEach(() => {
    clearAftershockCache();
    vi.clearAllMocks();
  });

  it("should return chains as an array", async () => {
    const result = await runAftershockEngine();
    expect(Array.isArray(result.chains)).toBe(true);
  });

  it("each chain should have required fields", async () => {
    const result = await runAftershockEngine();
    for (const chain of result.chains) {
      expect(chain).toHaveProperty("triggerAsset");
      expect(chain).toHaveProperty("triggerName");
      expect(chain).toHaveProperty("ruptureType");
      expect(chain).toHaveProperty("direction");
      expect(chain).toHaveProperty("signals");
      expect(chain).toHaveProperty("totalAftershocks");
      expect(chain).toHaveProperty("confirmedAftershocks");
      expect(chain).toHaveProperty("macroContext");
      expect(Array.isArray(chain.signals)).toBe(true);
    }
  });

  it("chain confirmedAftershocks should not exceed totalAftershocks", async () => {
    const result = await runAftershockEngine();
    for (const chain of result.chains) {
      expect(chain.confirmedAftershocks).toBeLessThanOrEqual(chain.totalAftershocks);
    }
  });
});

describe("Aftershock Engine™ — Contagion Graph API", () => {
  beforeEach(() => {
    clearAftershockCache();
    vi.clearAllMocks();
  });

  it("getAssetContagionChain should return an array for any symbol", async () => {
    // Run engine first to populate graph
    await runAftershockEngine();
    const edges = getAssetContagionChain("NVDA");
    expect(Array.isArray(edges)).toBe(true);
  });

  it("getAllContagionAssets should return an array of strings", async () => {
    await runAftershockEngine();
    const assets = getAllContagionAssets();
    expect(Array.isArray(assets)).toBe(true);
    assets.forEach(a => expect(typeof a).toBe("string"));
  });

  it("getAssetContagionChain for unknown symbol should return empty array", async () => {
    await runAftershockEngine();
    const edges = getAssetContagionChain("ZZZZUNKNOWN");
    expect(Array.isArray(edges)).toBe(true);
    expect(edges.length).toBe(0);
  });
});

describe("Aftershock Engine™ — Cache", () => {
  it("clearAftershockCache should not throw", () => {
    expect(() => clearAftershockCache()).not.toThrow();
  });

  it("second call within cache window should return same generatedAt", async () => {
    clearAftershockCache();
    vi.clearAllMocks();
    const first  = await runAftershockEngine();
    const second = await runAftershockEngine();
    expect(second.generatedAt).toBe(first.generatedAt);
  });
});
