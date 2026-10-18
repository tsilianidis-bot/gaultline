import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("./errorTracking", () => ({
  captureError: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import {
  clearSocialIntelligenceCache,
  clearTickerSocialCache,
  getSocialIntelligenceData,
  getTickerSocialData,
  globalSourceLabel,
} from "./socialIntelligence";

/**
 * MOCK/FIXTURE ONLY — no provider request is made. Every fixture carries its
 * provider identity and provider-supplied observation time to guard provenance.
 */
const PROVIDER_FIXTURES = {
  yahooTrending: {
    provider: "Yahoo Finance",
    observedAt: "2026-10-17T12:00:00.000Z",
    payload: { finance: { result: [{ quotes: [{ symbol: "NVDA" }] }] } },
  },
  yahooScreener: {
    provider: "Yahoo Finance",
    observedAt: "2026-10-17T12:00:00.000Z",
    payload: {
      finance: {
        result: [{ quotes: [{ symbol: "NVDA", shortName: "NVIDIA", regularMarketPrice: 190, regularMarketVolume: 1000 }] }],
      },
    },
  },
  yahooQuote: {
    provider: "Yahoo Finance",
    observedAt: "2026-10-17T12:00:00.000Z",
    payload: { quoteResponse: { result: [{ symbol: "NVDA", shortName: "NVIDIA", regularMarketPrice: 190 }] } },
  },
  polygon: {
    provider: "Polygon.io",
    observedAt: "2026-10-17T11:58:00.000Z",
    payload: {
      results: [{
        id: "polygon-fixture-1",
        publisher: { name: "Fixture Publisher" },
        title: "Fixture provider-model classification",
        author: "Fixture",
        published_utc: "2026-10-17T11:58:00.000Z",
        article_url: "https://example.test/article",
        tickers: ["NVDA"],
        insights: [{ ticker: "NVDA", sentiment: "positive", sentiment_reasoning: "Fixture provider model" }],
      }],
    },
  },
  stocktwits: {
    provider: "StockTwits",
    observedAt: "2026-10-17T11:59:00.000Z",
    payload: {
      response: { status: 200 },
      symbol: { watchlist_count: 1234 },
      messages: [{
        id: 1,
        body: "Fixture tagged message",
        created_at: "2026-10-17T11:59:00.000Z",
        entities: { sentiment: { basic: "Bullish" } },
        user: { username: "fixture", name: "Fixture", followers: 2 },
        likes: { total: 3 },
      }],
    },
  },
  reddit: {
    provider: "Reddit",
    observedAt: "2026-10-17T11:57:00.000Z",
    payload: {
      data: {
        children: [{
          data: {
            id: "reddit-fixture-1",
            title: "Fixture discussion",
            score: 150,
            num_comments: 4,
            permalink: "/r/stocks/comments/fixture",
            created_utc: 1792238220,
            selftext: "Fixture source post",
          },
        }],
      },
    },
  },
} as const;

const originalPolygonKey = process.env.POLYGON_API_KEY;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  clearSocialIntelligenceCache();
  clearTickerSocialCache();
  vi.mocked(invokeLLM).mockReset();
});

afterEach(() => {
  clearSocialIntelligenceCache();
  clearTickerSocialCache();
  vi.unstubAllGlobals();
  if (originalPolygonKey === undefined) delete process.env.POLYGON_API_KEY;
  else process.env.POLYGON_API_KEY = originalPolygonKey;
});

describe("Social Intelligence source-truth integrity (mock/fixture tests; no live provider checks)", () => {
  it("labels global discovery only with providers that supplied fixture observations", async () => {
    process.env.POLYGON_API_KEY = "fixture-only-not-a-credential";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/finance/trending/")) return jsonResponse(PROVIDER_FIXTURES.yahooTrending.payload);
      if (url.includes("/predefined/saved")) return jsonResponse(PROVIDER_FIXTURES.yahooScreener.payload);
      if (url.includes("/v7/finance/quote")) return jsonResponse(PROVIDER_FIXTURES.yahooQuote.payload);
      if (url.includes("api.polygon.io")) return jsonResponse(PROVIDER_FIXTURES.polygon.payload);
      throw new Error(`Unexpected fixture URL: ${url}`);
    }));

    const result = await getSocialIntelligenceData();

    expect(result.dataSource).toBe("Polygon.io News + Yahoo Finance Trending/Screener");
    expect(result.dataSource).not.toMatch(/StockTwits|Reddit/);
  });

  it("does not name an empty provider fixture as a global data source", () => {
    const label = globalSourceLabel({
      polygonNews: [],
      yahooTrending: ["NVDA"],
      yahooScreener: [],
    });

    expect(label).toBe("Yahoo Finance Trending/Screener");
    expect(label).not.toMatch(/Polygon|StockTwits|Reddit/);
  });

  it("returns nullable model synthesis, no synthetic 50/50 trend, and matched source weights when the model rejects", async () => {
    process.env.POLYGON_API_KEY = "fixture-only-not-a-credential";
    vi.mocked(invokeLLM).mockRejectedValue(new Error("fixture model rejection"));
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.stocktwits.com")) return jsonResponse(PROVIDER_FIXTURES.stocktwits.payload);
      if (url.includes("api.polygon.io")) return jsonResponse(PROVIDER_FIXTURES.polygon.payload);
      if (url.includes("reddit.com")) return jsonResponse(PROVIDER_FIXTURES.reddit.payload);
      throw new Error(`Unexpected fixture URL: ${url}`);
    }));

    const result = await getTickerSocialData("NVDA", "stock");
    const contributingSources = result.sources.filter(source => source.contributesToComposite);

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(result.synthesisStatus).toBe("UNAVAILABLE");
    expect(result.retailInterestScore).toBeNull();
    expect(result.crowdConvictionScore).toBeNull();
    expect(result.contrarianSignalScore).toBeNull();
    expect(result.sentimentTrends).toEqual([]);
    expect(result.socialMomentum).toBeNull();
    expect(result.discussionVelocity).toBeNull();
    expect(result.sources.find(source => source.source === "StockTwits")).toMatchObject({
      provider: PROVIDER_FIXTURES.stocktwits.provider,
      classification: "OBSERVED",
      observedAt: PROVIDER_FIXTURES.stocktwits.observedAt,
      weight: 35,
    });
    expect(result.sources.find(source => source.source === "Financial News")).toMatchObject({
      provider: PROVIDER_FIXTURES.polygon.provider,
      classification: "PROVIDER_MODEL",
      observedAt: PROVIDER_FIXTURES.polygon.observedAt,
      weight: 40,
    });
    expect(result.sources.find(source => source.source === "Reddit")).toMatchObject({
      provider: PROVIDER_FIXTURES.reddit.provider,
      classification: "DERIVED_HEURISTIC",
      observedAt: PROVIDER_FIXTURES.reddit.observedAt,
      weight: 25,
    });
    expect(contributingSources.reduce((sum, source) => sum + source.weight, 0)).toBe(100);
  });

  it("preserves untagged StockTwits observation metadata while excluding it from sentiment attribution", async () => {
    delete process.env.POLYGON_API_KEY;
    vi.mocked(invokeLLM).mockRejectedValue(new Error("fixture model rejection"));
    const untaggedStockTwitsFixture = {
      provider: "StockTwits",
      observedAt: "2026-10-17T11:56:00.000Z",
      payload: {
        response: { status: 200 },
        symbol: { watchlist_count: 99 },
        messages: [{
          id: 2,
          body: "Fixture untagged message",
          created_at: "2026-10-17T11:56:00.000Z",
          entities: {},
          user: { username: "untagged", name: "Untagged", followers: 0 },
          likes: { total: 0 },
        }],
      },
    } as const;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.stocktwits.com")) return jsonResponse(untaggedStockTwitsFixture.payload);
      if (url.includes("reddit.com")) return new Response("", { status: 503 });
      throw new Error(`Unexpected fixture URL: ${url}`);
    }));

    const result = await getTickerSocialData("UNTAGGED", "stock");
    const stocktwits = result.sources.find(source => source.source === "StockTwits");

    expect(stocktwits).toMatchObject({
      provider: untaggedStockTwitsFixture.provider,
      classification: "OBSERVED",
      observedAt: untaggedStockTwitsFixture.observedAt,
      available: false,
      contributesToComposite: false,
      volume: 1,
      bullishPct: 0,
      bearishPct: 0,
      note: "No Bullish/Bearish tags; excluded from composite",
    });
  });

  it("treats empty provider fixtures as unavailable rather than emitting numeric defaults or calling the model", async () => {
    delete process.env.POLYGON_API_KEY;
    vi.mocked(invokeLLM).mockRejectedValue(new Error("must not be called without source observations"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));

    const result = await getTickerSocialData("VOID", "stock");

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(result.socialIntelligenceScore).toBeNull();
    expect(result.overallSentiment).toBeNull();
    expect(result.overallBullishPct).toBeNull();
    expect(result.overallBearishPct).toBeNull();
    expect(result.retailInterestScore).toBeNull();
    expect(result.crowdConvictionScore).toBeNull();
    expect(result.contrarianSignalScore).toBeNull();
    expect(result.sentimentTrends).toEqual([]);
    expect(result.sources.find(source => source.source === "StockTwits")).toMatchObject({
      available: false,
      contributesToComposite: false,
      classification: "UNAVAILABLE",
    });
  });
});
