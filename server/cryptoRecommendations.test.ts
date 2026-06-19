// ============================================================
// FAULTLINE — Crypto Recommendations Uniqueness Tests
// server/cryptoRecommendations.test.ts
//
// Proves that every crypto recommendation in Situation Room
// Hot Sectors uses live, asset-specific market data and
// produces unique trade plans — not placeholder values.
//
// Bug fixed: buildCryptoOpportunity() used fixed multipliers
// (stop=0.88, T1=1.18, T2=1.35) and computeRecommendedVehicles()
// fell back to basePrice=100 when no live opportunity existed,
// producing the identical $88/$125/$140/conviction=82 values
// seen across FET, RNDR, and other AI crypto assets.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildCryptoOpportunity, CRYPTO_UNIVERSE } from "./ownerSimulation";
import {
  detectTemplateTradeLevels,
  detectCrossAssetTemplateDuplication,
  type HotSectorTicker,
} from "./tradePreflight";

// ── Mock: CoinGecko proxy ─────────────────────────────────────
// Returns asset-specific market data with realistic prices and
// different volatility profiles so ATR-based levels differ per asset.
vi.mock("./coingeckoProxy", () => {
  const makeMockMarket = (id: string, symbol: string, name: string, price: number, vol24h: number) => ({
    id,
    symbol,
    name,
    image: `https://example.com/${id}.png`,
    currentPrice: price,
    marketCap: price * 1e9,
    marketCapRank: 50,
    fullyDilutedValuation: price * 1.2e9,
    totalVolume: price * 1e7,
    high24h: price * (1 + vol24h / 100),
    low24h:  price * (1 - vol24h / 100),
    priceChange24h: price * 0.03,
    priceChangePercent24h: 3.0,
    priceChangePercent7d: 5.5,
    priceChangePercent30d: -12.0,
    marketCapChange24h: price * 1e7,
    marketCapChangePercent24h: 1.0,
    circulatingSupply: 1e9,
    totalSupply: 1.2e9,
    maxSupply: null,
    ath: price * 4,
    athChangePercent: -75.0,
    atl: price * 0.05,
    atlChangePercent: 1900.0,
    sparkline7d: [],
    lastUpdated: new Date().toISOString(),
    volatility24h: vol24h,
    distanceFromAth: -75.0,
  });

  // Asset-specific OHLC bars — return CoinOHLCBar objects (not raw arrays)
  // Different volatility profiles per asset to produce unique ATR values
  const makeMockOHLC = (price: number, volatilityPct: number) =>
    Array.from({ length: 30 }, (_, i) => {
      const base = price * (1 + ((i % 7) - 3) * 0.01 * volatilityPct * 10);
      const range = base * volatilityPct * 0.5;
      return {
        timestamp: Date.now() - (30 - i) * 86400000,
        open:  Math.max(0.0001, base - range * 0.3),
        high:  Math.max(0.0001, base + range),
        low:   Math.max(0.0001, base - range),
        close: Math.max(0.0001, base + range * 0.2),
      };
    });

  return {
    getCoinMarketData: vi.fn().mockImplementation((coinId: string) => {
      const assets: Record<string, ReturnType<typeof makeMockMarket>> = {
        "fetch-ai":       makeMockMarket("fetch-ai",       "FET",   "Fetch.ai",        1.42,   8.5),
        "render-token":   makeMockMarket("render-token",   "RNDR",  "Render Network",  5.87,   9.2),
        "bittensor":      makeMockMarket("bittensor",      "TAO",   "Bittensor",       481.50, 6.8),
        "worldcoin-wld":  makeMockMarket("worldcoin-wld",  "WLD",   "Worldcoin",       2.31,   11.0),
        "ocean-protocol": makeMockMarket("ocean-protocol", "OCEAN", "Ocean Protocol",  0.6823, 10.1),
        "the-graph":      makeMockMarket("the-graph",      "GRT",   "The Graph",       0.1923, 12.3),
        "io-net":         makeMockMarket("io-net",         "IO",    "io.net",          3.15,   14.0),
        "arweave":        makeMockMarket("arweave",        "AR",    "Arweave",         22.40,  7.5),
        "bitcoin":        makeMockMarket("bitcoin",        "BTC",   "Bitcoin",         68500,  3.2),
        "ethereum":       makeMockMarket("ethereum",       "ETH",   "Ethereum",        3820,   4.1),
        "solana":         makeMockMarket("solana",         "SOL",   "Solana",          178.50, 5.8),
      };
      return Promise.resolve(assets[coinId] ?? null);
    }),
    getCoinOHLC: vi.fn().mockImplementation((coinId: string) => {
      const ohlcData: Record<string, ReturnType<typeof makeMockOHLC>> = {
        "fetch-ai":       makeMockOHLC(1.42,   0.085),
        "render-token":   makeMockOHLC(5.87,   0.092),
        "bittensor":      makeMockOHLC(481.50, 0.068),
        "worldcoin-wld":  makeMockOHLC(2.31,   0.110),
        "ocean-protocol": makeMockOHLC(0.6823, 0.101),
        "the-graph":      makeMockOHLC(0.1923, 0.123),
        "io-net":         makeMockOHLC(3.15,   0.140),
        "arweave":        makeMockOHLC(22.40,  0.075),
        "bitcoin":        makeMockOHLC(68500,  0.032),
        "ethereum":       makeMockOHLC(3820,   0.041),
        "solana":         makeMockOHLC(178.50, 0.058),
      };
      return Promise.resolve(ohlcData[coinId] ?? []);
    }),
    getGlobalStats: vi.fn().mockResolvedValue({
      totalMarketCap: 2.5e12,
      totalVolume24h: 8.5e10,
      btcDominance: 54.2,
      ethDominance: 17.8,
      activeCryptocurrencies: 12500,
      markets: 750,
      marketCapChangePercent24h: 1.5,
    }),
  };
});

// ── Mock: Pressure engine ─────────────────────────────────────
vi.mock("./pressure/engine", () => ({
  calculateFaultlinePressure: vi.fn().mockResolvedValue({
    overallPressure: 35,
    regime: "Neutral",
    level: "MODERATE",
    alerts: [],
    topAnalog: null,
    analogs: [],
    timestamp: new Date().toISOString(),
    dataSource: "mock",
    lastUpdated: new Date().toISOString(),
    vectors: [],
    domains: {
      liquidity: 30,
      credit: 25,
      volatility: 40,
      macro: 35,
      sentiment: 45,
    },
  }),
}));

// ── Mock: LLM (rationale generation) ─────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue(
    JSON.stringify({
      whyNow: "Mocked rationale for testing.",
      invalidation: "Mocked invalidation.",
      keyRisks: ["Risk 1", "Risk 2"],
      labels: ["AI Crypto", "Momentum"],
    })
  ),
}));

// ── Mock: Database ────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ── Mock: Yahoo Finance proxy ─────────────────────────────────
vi.mock("./yahooProxy", () => ({
  getQuote: vi.fn().mockResolvedValue(null),
}));

// ── Helpers ───────────────────────────────────────────────────
const MOCK_PRESSURE = {
  overallPressure: 35,
  regime: "Neutral",
  level: "MODERATE",
  alerts: [],
  topAnalog: null,
  analogs: [],
  timestamp: new Date().toISOString(),
  dataSource: "mock",
  lastUpdated: new Date().toISOString(),
  vectors: [],
  domains: { liquidity: 30, credit: 25, volatility: 40, macro: 35, sentiment: 45 },
};

const makeRawPrice = (usd: number, change = 3.0) => ({
  usd,
  usd_24h_change: change,
  usd_24h_vol: usd * 1e7,
  usd_market_cap: usd * 1e9,
});

// ── Tests ─────────────────────────────────────────────────────

describe("CRYPTO_UNIVERSE coverage", () => {
  it("includes FET (Fetch.ai) with AI Crypto sector", () => {
    const entry = CRYPTO_UNIVERSE.find(c => c.ticker === "FET");
    expect(entry).toBeDefined();
    expect(entry?.sector).toBe("AI Crypto");
    expect(entry?.coinId).toBe("fetch-ai");
  });

  it("includes RNDR (Render Network) with AI Crypto sector", () => {
    const entry = CRYPTO_UNIVERSE.find(c => c.ticker === "RNDR");
    expect(entry).toBeDefined();
    expect(entry?.sector).toBe("AI Crypto");
    expect(entry?.coinId).toBe("render-token");
  });

  it("includes TAO (Bittensor) with AI Crypto sector", () => {
    const entry = CRYPTO_UNIVERSE.find(c => c.ticker === "TAO");
    expect(entry).toBeDefined();
    expect(entry?.sector).toBe("AI Crypto");
  });

  it("includes WLD (Worldcoin) with AI Crypto sector", () => {
    const entry = CRYPTO_UNIVERSE.find(c => c.ticker === "WLD");
    expect(entry).toBeDefined();
    expect(entry?.sector).toBe("AI Crypto");
  });

  it("includes OCEAN (Ocean Protocol) with AI Crypto sector", () => {
    const entry = CRYPTO_UNIVERSE.find(c => c.ticker === "OCEAN");
    expect(entry).toBeDefined();
    expect(entry?.sector).toBe("AI Crypto");
  });

  it("includes GRT (The Graph) with AI Crypto sector", () => {
    const entry = CRYPTO_UNIVERSE.find(c => c.ticker === "GRT");
    expect(entry).toBeDefined();
    expect(entry?.sector).toBe("AI Crypto");
  });

  it("has at least 13 assets total (7 original + 8 AI Crypto)", () => {
    expect(CRYPTO_UNIVERSE.length).toBeGreaterThanOrEqual(13);
  });

  it("has at least 6 AI Crypto assets", () => {
    const aiCrypto = CRYPTO_UNIVERSE.filter(c => c.sector === "AI Crypto");
    expect(aiCrypto.length).toBeGreaterThanOrEqual(6);
  });
});

describe("buildCryptoOpportunity — unique asset-specific trade plans", () => {
  it("FET produces a valid opportunity with live price (not $100)", async () => {
    const opp = await buildCryptoOpportunity(
      "FET", "fetch-ai", "Fetch.ai",
      makeRawPrice(1.42), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp).not.toBeNull();
    expect(opp!.currentPrice).toBeCloseTo(1.42, 1);
    expect(opp!.currentPrice).not.toBeCloseTo(100, 0);
  });

  it("RNDR produces a valid opportunity with live price (not $100)", async () => {
    const opp = await buildCryptoOpportunity(
      "RNDR", "render-token", "Render Network",
      makeRawPrice(5.87), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp).not.toBeNull();
    expect(opp!.currentPrice).toBeCloseTo(5.87, 1);
    expect(opp!.currentPrice).not.toBeCloseTo(100, 0);
  });

  it("TAO produces a valid opportunity with price proportional to ~$481 (not $100)", async () => {
    const opp = await buildCryptoOpportunity(
      "TAO", "bittensor", "Bittensor",
      makeRawPrice(481.50), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp).not.toBeNull();
    expect(opp!.currentPrice).toBeGreaterThan(400);
    expect(opp!.stopLoss).toBeGreaterThan(200);
    expect(opp!.targetOne).toBeGreaterThan(481.50);
  });

  it("FET and RNDR produce DIFFERENT prices", async () => {
    const [fetOpp, rndrOpp] = await Promise.all([
      buildCryptoOpportunity("FET",  "fetch-ai",     "Fetch.ai",       makeRawPrice(1.42), MOCK_PRESSURE as any, null, 100000),
      buildCryptoOpportunity("RNDR", "render-token", "Render Network", makeRawPrice(5.87), MOCK_PRESSURE as any, null, 100000),
    ]);
    expect(fetOpp).not.toBeNull();
    expect(rndrOpp).not.toBeNull();
    expect(fetOpp!.currentPrice).not.toBeCloseTo(rndrOpp!.currentPrice, 0);
  });

  it("FET and RNDR produce DIFFERENT stop losses", async () => {
    const [fetOpp, rndrOpp] = await Promise.all([
      buildCryptoOpportunity("FET",  "fetch-ai",     "Fetch.ai",       makeRawPrice(1.42), MOCK_PRESSURE as any, null, 100000),
      buildCryptoOpportunity("RNDR", "render-token", "Render Network", makeRawPrice(5.87), MOCK_PRESSURE as any, null, 100000),
    ]);
    expect(fetOpp!.stopLoss).not.toBeCloseTo(rndrOpp!.stopLoss, 0);
  });

  it("FET and RNDR produce DIFFERENT T1 targets", async () => {
    const [fetOpp, rndrOpp] = await Promise.all([
      buildCryptoOpportunity("FET",  "fetch-ai",     "Fetch.ai",       makeRawPrice(1.42), MOCK_PRESSURE as any, null, 100000),
      buildCryptoOpportunity("RNDR", "render-token", "Render Network", makeRawPrice(5.87), MOCK_PRESSURE as any, null, 100000),
    ]);
    expect(fetOpp!.targetOne).not.toBeCloseTo(rndrOpp!.targetOne, 0);
  });

  it("FET stop loss is NOT $88 (the known placeholder value)", async () => {
    const opp = await buildCryptoOpportunity(
      "FET", "fetch-ai", "Fetch.ai",
      makeRawPrice(1.42), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.stopLoss).not.toBeCloseTo(88, 0);
  });

  it("RNDR T1 is NOT $125 (the known placeholder value)", async () => {
    const opp = await buildCryptoOpportunity(
      "RNDR", "render-token", "Render Network",
      makeRawPrice(5.87), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.targetOne).not.toBeCloseTo(125, 0);
  });

  it("TAO T2 is NOT $140 (the known placeholder value)", async () => {
    const opp = await buildCryptoOpportunity(
      "TAO", "bittensor", "Bittensor",
      makeRawPrice(481.50), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.targetTwo).not.toBeCloseTo(140, 0);
  });

  it("FET trade levels satisfy stopLoss < price < targetOne < targetTwo", async () => {
    const opp = await buildCryptoOpportunity(
      "FET", "fetch-ai", "Fetch.ai",
      makeRawPrice(1.42), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.stopLoss).toBeLessThan(opp!.currentPrice);
    expect(opp!.currentPrice).toBeLessThan(opp!.targetOne);
    expect(opp!.targetOne).toBeLessThan(opp!.targetTwo);
  });

  it("RNDR trade levels satisfy stopLoss < price < targetOne < targetTwo", async () => {
    const opp = await buildCryptoOpportunity(
      "RNDR", "render-token", "Render Network",
      makeRawPrice(5.87), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.stopLoss).toBeLessThan(opp!.currentPrice);
    expect(opp!.currentPrice).toBeLessThan(opp!.targetOne);
    expect(opp!.targetOne).toBeLessThan(opp!.targetTwo);
  });

  it("TAO trade levels satisfy stopLoss < price < targetOne < targetTwo", async () => {
    const opp = await buildCryptoOpportunity(
      "TAO", "bittensor", "Bittensor",
      makeRawPrice(481.50), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.stopLoss).toBeLessThan(opp!.currentPrice);
    expect(opp!.currentPrice).toBeLessThan(opp!.targetOne);
    expect(opp!.targetOne).toBeLessThan(opp!.targetTwo);
  });

  it("WLD trade levels satisfy stopLoss < price < targetOne < targetTwo", async () => {
    const opp = await buildCryptoOpportunity(
      "WLD", "worldcoin-wld", "Worldcoin",
      makeRawPrice(2.31), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.stopLoss).toBeLessThan(opp!.currentPrice);
    expect(opp!.currentPrice).toBeLessThan(opp!.targetOne);
    expect(opp!.targetOne).toBeLessThan(opp!.targetTwo);
  });

  it("GRT trade levels satisfy stopLoss < price < targetOne < targetTwo", async () => {
    const opp = await buildCryptoOpportunity(
      "GRT", "the-graph", "The Graph",
      makeRawPrice(0.1923), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.stopLoss).toBeLessThan(opp!.currentPrice);
    expect(opp!.currentPrice).toBeLessThan(opp!.targetOne);
    expect(opp!.targetOne).toBeLessThan(opp!.targetTwo);
  });

  it("FET opportunity includes dataSource='CoinGecko'", async () => {
    const opp = await buildCryptoOpportunity(
      "FET", "fetch-ai", "Fetch.ai",
      makeRawPrice(1.42), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.dataSource).toBe("CoinGecko");
  });

  it("FET opportunity includes a priceTimestamp (ISO string)", async () => {
    const opp = await buildCryptoOpportunity(
      "FET", "fetch-ai", "Fetch.ai",
      makeRawPrice(1.42), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.priceTimestamp).toBeDefined();
    expect(typeof opp!.priceTimestamp).toBe("string");
    // Should be a valid ISO date
    expect(new Date(opp!.priceTimestamp!).getTime()).toBeGreaterThan(0);
  });

  it("FET sector is 'AI Crypto' (not generic 'Crypto')", async () => {
    const opp = await buildCryptoOpportunity(
      "FET", "fetch-ai", "Fetch.ai",
      makeRawPrice(1.42), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.sector).toBe("AI Crypto");
  });

  it("RNDR sector is 'AI Crypto'", async () => {
    const opp = await buildCryptoOpportunity(
      "RNDR", "render-token", "Render Network",
      makeRawPrice(5.87), MOCK_PRESSURE as any, null, 100000
    );
    expect(opp!.sector).toBe("AI Crypto");
  });

  it("returns null when rawPrice is undefined (no live data)", async () => {
    const opp = await buildCryptoOpportunity(
      "FET", "fetch-ai", "Fetch.ai",
      undefined, MOCK_PRESSURE as any, null, 100000
    );
    expect(opp).toBeNull();
  });

  it("returns null when rawPrice.usd is 0", async () => {
    const opp = await buildCryptoOpportunity(
      "FET", "fetch-ai", "Fetch.ai",
      { usd: 0, usd_24h_change: 0, usd_24h_vol: 0, usd_market_cap: 0 },
      MOCK_PRESSURE as any, null, 100000
    );
    expect(opp).toBeNull();
  });
});

describe("detectTemplateTradeLevels — identifies known placeholder set", () => {
  const makeHotSectorTicker = (overrides: Partial<HotSectorTicker>): HotSectorTicker => ({
    ticker: "TEST",
    name: "Test Asset",
    assetType: "crypto",
    action: "LONG",
    currentPrice: 1.42,
    entryZoneLow: 1.35,
    entryZoneHigh: 1.48,
    stopLoss: 1.21,
    targetOne: 1.63,
    targetTwo: 1.84,
    riskRewardRatio: 2.1,
    momentumScore: 65,
    compositeScore: 72,
    rationale: "Live data rationale",
    dataSource: "CoinGecko",
    priceTimestamp: new Date().toISOString(),
    ...overrides,
  });

  it("flags the exact known placeholder set (price=100, stop=88, T1=125, T2=140)", () => {
    const ticker = makeHotSectorTicker({
      currentPrice: 100.00,
      entryZoneLow: 98.00,
      entryZoneHigh: 101.00,
      stopLoss: 88.00,
      targetOne: 125.00,
      targetTwo: 140.00,
    });
    expect(detectTemplateTradeLevels(ticker)).toBe(true);
  });

  it("does NOT flag a real FET price (~$1.42)", () => {
    const ticker = makeHotSectorTicker({
      currentPrice: 1.42,
      stopLoss: 1.21,
      targetOne: 1.63,
      targetTwo: 1.84,
    });
    expect(detectTemplateTradeLevels(ticker)).toBe(false);
  });

  it("does NOT flag a real RNDR price (~$5.87)", () => {
    const ticker = makeHotSectorTicker({
      currentPrice: 5.87,
      stopLoss: 4.98,
      targetOne: 6.82,
      targetTwo: 7.77,
    });
    expect(detectTemplateTradeLevels(ticker)).toBe(false);
  });

  it("does NOT flag a real TAO price (~$481)", () => {
    const ticker = makeHotSectorTicker({
      currentPrice: 481.50,
      stopLoss: 414.89,
      targetOne: 542.32,
      targetTwo: 603.14,
    });
    expect(detectTemplateTradeLevels(ticker)).toBe(false);
  });

  it("does NOT flag price=100 if stop and targets are NOT placeholder values", () => {
    // A legitimate asset could theoretically be priced near $100
    const ticker = makeHotSectorTicker({
      currentPrice: 100.00,
      stopLoss: 91.50,   // not $88
      targetOne: 118.00, // not $125
      targetTwo: 135.00, // not $140
    });
    expect(detectTemplateTradeLevels(ticker)).toBe(false);
  });
});

describe("detectCrossAssetTemplateDuplication — catches identical cross-asset levels", () => {
  const makeHotSectorTicker = (ticker: string, price: number, stop: number, t1: number): HotSectorTicker => ({
    ticker,
    name: `${ticker} Asset`,
    assetType: "crypto",
    action: "LONG",
    currentPrice: price,
    entryZoneLow: price * 0.99,
    entryZoneHigh: price * 1.01,
    stopLoss: stop,
    targetOne: t1,
    targetTwo: t1 * 1.12,
    riskRewardRatio: 2.0,
    momentumScore: 60,
    compositeScore: 70,
    rationale: "Test",
  });

  it("detects duplication when FET and RNDR share identical price/stop/T1", () => {
    const tickers = [
      makeHotSectorTicker("FET",  100, 88, 125),
      makeHotSectorTicker("RNDR", 100, 88, 125),
    ];
    expect(detectCrossAssetTemplateDuplication(tickers)).toBe(true);
  });

  it("does NOT flag duplication when FET and RNDR have different levels", () => {
    const tickers = [
      makeHotSectorTicker("FET",  1.42, 1.21, 1.63),
      makeHotSectorTicker("RNDR", 5.87, 4.98, 6.82),
    ];
    expect(detectCrossAssetTemplateDuplication(tickers)).toBe(false);
  });

  it("does NOT flag a single-asset array as duplicated", () => {
    const tickers = [makeHotSectorTicker("FET", 1.42, 1.21, 1.63)];
    expect(detectCrossAssetTemplateDuplication(tickers)).toBe(false);
  });

  it("detects duplication across 3 assets with identical levels", () => {
    const tickers = [
      makeHotSectorTicker("FET",   100, 88, 125),
      makeHotSectorTicker("RNDR",  100, 88, 125),
      makeHotSectorTicker("TAO",   100, 88, 125),
    ];
    expect(detectCrossAssetTemplateDuplication(tickers)).toBe(true);
  });

  it("does NOT flag duplication for 3 assets with unique levels", () => {
    const tickers = [
      makeHotSectorTicker("FET",   1.42,   1.21,   1.63),
      makeHotSectorTicker("RNDR",  5.87,   4.98,   6.82),
      makeHotSectorTicker("TAO",   481.50, 414.89, 542.32),
    ];
    expect(detectCrossAssetTemplateDuplication(tickers)).toBe(false);
  });
});
