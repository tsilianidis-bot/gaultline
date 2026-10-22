import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  admittedTrendPeriods,
  buildSourceAttribution,
  computeCompositeScore,
  newsContributes,
  observationTimestamps,
  SOCIAL_COMPOSITE_WEIGHTS,
  socialDataSourceLabel,
  socialQuoteFromProvider,
  stocktwitsContributes,
} from "./socialIntelligence";
import type { RedditPost, StockTwitsData, TickerNewsArticle } from "./socialIntelligence";

const source = readFileSync(new URL("./socialIntelligence.ts", import.meta.url), "utf8");

function stocktwits(bullish: number, bearish: number): StockTwitsData {
  const tagged = bullish + bearish;
  return {
    symbol: "NVDA",
    watchlistCount: 10,
    messages: [],
    bullishCount: bullish,
    bearishCount: bearish,
    neutralCount: 0,
    sentimentScore: tagged === 0 ? 0 : (bullish - bearish) / tagged,
    sentimentLabel: "NEUTRAL",
    fetchedAt: 1,
  };
}

const news = (sentiment: TickerNewsArticle["sentiment"]): TickerNewsArticle => ({
  id: sentiment,
  title: `${sentiment} headline`,
  description: "",
  publishedUtc: "2026-10-20T12:00:00Z",
  articleUrl: "https://example.com",
  imageUrl: null,
  publisher: "Example",
  tickers: ["NVDA"],
  sentiment,
  sentimentReasoning: "",
});

const post = (score: number): RedditPost => ({
  id: String(score),
  title: "post",
  subreddit: "stocks",
  score,
  numComments: 1,
  url: "https://example.com",
  createdUtc: 1,
});

describe("social observations fail closed", () => {
  it("does not call the unauthenticated Yahoo v7 quote endpoint or an LLM", () => {
    expect(source).not.toContain("v7/finance/quote");
    expect(source).not.toContain("invokeLLM");
    expect(source).not.toContain("Polygon.io News + Yahoo Finance Trending/Screener + StockTwits + Reddit");
  });

  it("drops an errored or priceless quote instead of filling zero", () => {
    expect(socialQuoteFromProvider({
      ticker: "NVDA", price: null, changePercent: null, volume: null, marketState: "UNKNOWN", source: "error",
    })).toBeNull();
    expect(socialQuoteFromProvider({
      ticker: "NVDA", price: 100, changePercent: 1, volume: 5, marketState: "REGULAR", source: "yahoo",
    })?.regularMarketPrice).toBe(100);
  });

  it("withholds the composite when no tagged source contributes", () => {
    const empty = computeCompositeScore(null, [], []);
    expect(empty).toEqual({ score: null, bullishPct: null, bearishPct: null, overallSentimentScore: null });
    const untagged = computeCompositeScore(stocktwits(0, 0), [news("unknown")], []);
    expect(untagged.score).toBeNull();
    expect(newsContributes([news("unknown")])).toBe(false);
    expect(stocktwitsContributes(stocktwits(0, 0))).toBe(false);
  });

  it("displays the same weights the composite uses, and zero when a source does not contribute", () => {
    const sources = buildSourceAttribution(stocktwits(3, 1), [news("positive")], [post(200)], "stock");
    const byName = Object.fromEntries(sources.map(row => [row.source, row.weight]));
    expect(byName.StockTwits).toBe(SOCIAL_COMPOSITE_WEIGHTS.stocktwits);
    expect(byName["Financial News"]).toBe(SOCIAL_COMPOSITE_WEIGHTS.news);
    expect(byName.Reddit).toBe(SOCIAL_COMPOSITE_WEIGHTS.reddit);
    const missing = buildSourceAttribution(null, [], [], "stock");
    expect(missing.filter(row => row.available).map(row => row.weight)).toEqual([]);
    expect(missing.find(row => row.source === "Financial News")?.weight).toBe(0);
  });

  it("does not admit a last-24h period when there is no observation in that window", () => {
    const now = Date.parse("2026-10-20T16:00:00Z");
    expect(admittedTrendPeriods([], now)).toEqual([]);
    expect(admittedTrendPeriods([now + 60_000], now)).toEqual([]);
    expect(admittedTrendPeriods([now - 2 * 60 * 60 * 1000], now)).toEqual(["24h", "7d", "30d"]);
    expect(observationTimestamps({
      stocktwits: { ...stocktwits(1, 0), messages: [{ id: 1, body: "", createdAt: "2026-10-19T12:00:00Z", sentiment: "Bullish", username: "u", name: "u", avatarUrl: null, likes: 0, followers: 0, isVerified: false }] },
      news: [],
      redditPosts: [],
    })).toEqual([Date.parse("2026-10-19T12:00:00Z")]);
    expect(socialDataSourceLabel({ newsCount: 0, yahooListingCount: 0, chartQuoteCount: 0 })).toBe("No provider observations");
    expect(socialDataSourceLabel({ newsCount: 2, yahooListingCount: 0, chartQuoteCount: 0 })).toBe("Polygon.io News");
  });
});
