import { beforeEach, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({
  getCanonicalState: vi.fn(),
  projectPressure: vi.fn(),
  getQuote: vi.fn(),
  getDailyBars: vi.fn(),
  classifyYahooObservation: vi.fn(),
  getCoinMarketData: vi.fn(),
  getCoinOHLC: vi.fn(),
}));

vi.mock("./canonicalIntelligenceState", () => ({
  getAuthoritativeCanonicalIntelligenceState: providers.getCanonicalState,
}));
vi.mock("./canonicalPressureProjection", () => ({
  projectPressureFromCanonical: providers.projectPressure,
}));
vi.mock("./yahooProxy", () => ({
  getQuote: providers.getQuote,
  getDailyBars: providers.getDailyBars,
  classifyYahooObservation: providers.classifyYahooObservation,
}));
vi.mock("./coingeckoProxy", () => ({
  getCoinMarketData: providers.getCoinMarketData,
  getCoinOHLC: providers.getCoinOHLC,
}));

import { getGuidanceForTicker, getPositionGuidance } from "./positionGuidance";

const canonicalStateFixture = {
  stateId: "canonical-state-fixture-001",
  effectiveAt: "2026-10-17T20:00:00.000Z",
  generatedAt: "2026-10-17T20:00:00.000Z",
  modelVersion: "champion-v1",
  configurationVersion: "cfg-2026-10-17",
  confidenceOrEvidenceQuality: "HEALTHY",
  regime: "Elevated Pressure",
  pressureIndex: 62,
  pressureLevel: "Elevated",
  provenance: { coherenceStatus: "COHERENT" },
} as any;

function pressureFixture(excludedVector?: string) {
  const vectors = [
    ["liquidity-stress", 58],
    ["credit-contagion", 55],
    ["volatility-regime", 65],
    ["macro-sensitivity", 63],
    ["market-breadth", 61],
    ["ai-bubble", 40],
  ].filter(([id]) => id !== excludedVector).map(([id, score]) => ({ id, score }));
  return {
    overallPressure: 62,
    regime: "Elevated Pressure",
    level: "Elevated",
    vectors,
  } as any;
}

/** Provider metadata intentionally travels with every source fixture. */
const yahooFixture = {
  provider: "Yahoo Finance",
  observedAt: 1_792_267_200_000,
  fetchedAt: 1_792_267_260_000,
  quote: {
    ticker: "ACME",
    price: 125,
    prevClose: 124,
    open: 123,
    high: 126,
    low: 122,
    volume: 1_500_000,
    change: 1,
    changePercent: 0.81,
    marketState: "REGULAR",
    isDelayed: true,
    source: "yahoo",
    observedAt: 1_792_267_200_000,
    fetchedAt: 1_792_267_260_000,
  },
  dailyBars: Array.from({ length: 30 }, (_, index) => ({
    close: 100 + index,
    open: 99 + index,
    high: 101 + index,
    low: 98 + index,
    volume: 1_000_000 + index * 1_000,
    timestamp: 1_789_776_000_000 + index * 86_400_000,
  })),
};

const coinFixture = {
  provider: "CoinGecko",
  observedAt: new Date().toISOString(),
  market: {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    currentPrice: 65_000,
    totalVolume: 1_000_000_000,
    lastUpdated: new Date().toISOString(),
  },
  dailyBars: Array.from({ length: 30 }, (_, index) => ({
    open: 50_000 + index * 100,
    high: 50_500 + index * 100,
    low: 49_500 + index * 100,
    close: 50_100 + index * 100,
    timestamp: 1_789_776_000_000 + index * 86_400_000,
  })),
};

beforeEach(() => {
  vi.clearAllMocks();
  providers.getCanonicalState.mockResolvedValue(canonicalStateFixture);
  providers.projectPressure.mockReturnValue(pressureFixture());
  providers.getQuote.mockResolvedValue(yahooFixture.quote);
  providers.getDailyBars.mockResolvedValue(yahooFixture.dailyBars);
  providers.classifyYahooObservation.mockReturnValue({
    timing: "delayed",
    supportsCurrentClaim: true,
    detail: "Delayed provider fixture.",
  });
  providers.getCoinMarketData.mockResolvedValue(coinFixture.market);
  providers.getCoinOHLC.mockResolvedValue(coinFixture.dailyBars);
});

describe("Position Guidance integrity — fixture checks, not live provider checks", () => {
  it("binds observed Yahoo price/history guidance to the supplied canonical state", async () => {
    const result = await getGuidanceForTicker("acme", "ACME Test", "Stock");

    expect(result).toMatchObject({
      status: "AVAILABLE",
      availability: "AVAILABLE",
      ticker: "ACME",
      stateId: "canonical-state-fixture-001",
      effectiveAt: "2026-10-17T20:00:00.000Z",
      modelVersion: "champion-v1",
      configurationVersion: "cfg-2026-10-17",
      quality: "HEALTHY",
      priceStatus: "DELAYED",
      currentPrice: "$125.00",
      source: {
        assetProvider: yahooFixture.provider,
        assetInputClassification: "OBSERVED",
        quoteProvider: "yahoo",
        quoteObservedAt: new Date(yahooFixture.observedAt).toISOString(),
        dailyBarProvider: yahooFixture.provider,
        dailyBarCount: 30,
        volumeObserved: true,
      },
      model: {
        classification: "DERIVED_MODEL",
        modelId: "position-guidance-market-context",
        modelVersion: "2.0.0",
      },
    });
    expect(providers.projectPressure).toHaveBeenCalledWith(canonicalStateFixture);
    expect(providers.getQuote).toHaveBeenCalledWith("ACME");
    expect(providers.getDailyBars).toHaveBeenCalledWith("ACME", "3mo");
    if (result.status === "AVAILABLE") {
      expect(result.scores.sectorStrengthScore).toBeNull();
      expect(result.aiInterpretation).toContain("model output");
      expect(result.source.quoteObservedAt).not.toBe(result.source.quoteFetchedAt);
    }
  });

  it("supports an arbitrary verified Crypto holding through CoinGecko observations, not category traits", async () => {
    const result = await getGuidanceForTicker("btc", "user supplied name", "Crypto");

    expect(result).toMatchObject({
      status: "AVAILABLE",
      ticker: "BTC",
      name: "Bitcoin",
      assetType: "Crypto",
      source: {
        assetProvider: coinFixture.provider,
        assetInputClassification: "OBSERVED",
        quoteProvider: "coingecko",
        dailyBarProvider: coinFixture.provider,
        volumeObserved: true,
      },
      model: { classification: "DERIVED_MODEL" },
    });
    expect(providers.getCoinMarketData).toHaveBeenCalledWith("BTC");
    expect(providers.getCoinOHLC).toHaveBeenCalledWith("BTC", 30);
  });

  it("withholds instead of recalculating when no authoritative canonical state is available", async () => {
    providers.getCanonicalState.mockResolvedValue(null);
    providers.projectPressure.mockReturnValue(null);

    const result = await getGuidanceForTicker("ACME", "ACME Test", "Other");

    expect(result).toMatchObject({
      status: "UNAVAILABLE",
      availability: "UNAVAILABLE",
      stateId: null,
      quality: "UNAVAILABLE",
    });
    expect(result.reason).toContain("canonical macro state");
    expect(providers.getQuote).not.toHaveBeenCalled();
    expect(providers.getDailyBars).not.toHaveBeenCalled();
  });

  it.each([
    "liquidity-stress",
    "credit-contagion",
    "volatility-regime",
    "macro-sensitivity",
    "market-breadth",
    "ai-bubble",
  ])("withholds action and score fields when canonical vector %s is absent", async (missingVector) => {
    providers.projectPressure.mockReturnValue(pressureFixture(missingVector));

    const result = await getGuidanceForTicker("ACME", "ACME Test", "Stock");

    expect(result.status).toBe("UNAVAILABLE");
    expect(result).not.toHaveProperty("action");
    expect(result).not.toHaveProperty("scores");
    expect(providers.getQuote).not.toHaveBeenCalled();
  });

  it("withholds when verified asset evidence is absent rather than producing a category profile", async () => {
    providers.getQuote.mockResolvedValue({
      ...yahooFixture.quote,
      price: null,
      observedAt: null,
      source: "error",
      error: "fixture provider unavailable",
    });

    const result = await getGuidanceForTicker("UNKNOWN", "Unknown Holding", "Other");

    expect(result).toMatchObject({ status: "UNAVAILABLE", ticker: "UNKNOWN" });
    expect(result.reason).toContain("provider-observed Yahoo quote");
    expect(result).not.toHaveProperty("action");
    expect(result).not.toHaveProperty("scores");
  });

  it("returns source-labelled model-derived reference cards without static price claims", async () => {
    const results = await getPositionGuidance(["ACME"]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      status: "AVAILABLE",
      source: { assetInputClassification: "OBSERVED", assetProvider: "Yahoo Finance" },
      model: { classification: "DERIVED_MODEL" },
    });
    if (results[0].status === "AVAILABLE") {
      expect(results[0].currentPrice).toBe("$125.00");
      expect(results[0].currentPrice).not.toContain("May 21");
      expect(results[0].priceStatus).not.toBe("UNAVAILABLE");
    }
  });
});
