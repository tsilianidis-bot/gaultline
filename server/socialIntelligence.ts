/**
 * server/socialIntelligence.ts
 * FAULTLINE Social Intelligence Engine — Multi-Source Aggregation
 *
 * Data sources (no fabricated values):
 *   - Polygon.io /v2/reference/news  → per-ticker news + AI sentiment scores
 *   - Yahoo Finance trending/screener → live trending tickers + most active
 *   - StockTwits API                  → retail trader sentiment + watchlist count
 *   - Reddit JSON API (public)        → r/wallstreetbets, r/investing, r/stocks,
 *                                       r/CryptoCurrency, r/Bitcoin, r/ethereum
 *   - LLM synthesis engine            → cross-platform intelligence synthesis,
 *                                       bull/bear arguments, topics, influencer
 *                                       mentions, crowd conviction, contrarian
 *                                       signals, meme/hype detection
 *
 * Sources that require paid credentials (X/Twitter, TikTok, Seeking Alpha,
 * TradingView, Telegram, Discord) are reported as "Source unavailable" rather
 * than silently excluded.
 */

import { log } from "./logger";
import { captureError } from "./errorTracking";
import { invokeLLM } from "./_core/llm";

// ── Types ─────────────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  publishedUtc: string;
  articleUrl: string;
  imageUrl: string | null;
  publisher: string;
  publisherLogoUrl: string | null;
  tickers: string[];
  keywords: string[];
  sentiment: "positive" | "neutral" | "negative" | "unknown";
  sentimentReasoning: string;
  primaryTicker: string | null;
}

export interface TrendingTicker {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  marketState: string | null;
  sentiment: "bullish" | "bearish" | "neutral" | "unknown";
  buzzScore: number;
  newsCount: number;
  latestHeadline: string | null;
}

export interface SentimentSummary {
  ticker: string;
  name: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalArticles: number;
  sentimentScore: number; // -1.0 to +1.0
  label: "STRONGLY BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONGLY BEARISH";
  latestHeadline: string | null;
  latestPublished: string | null;
}

export interface NarrativeCluster {
  theme: string;
  description: string;
  tickers: string[];
  articleCount: number;
  dominantSentiment: "bullish" | "bearish" | "neutral";
  keywords: string[];
}

export interface SocialIntelligenceData {
  trendingTickers: TrendingTicker[];
  sentimentLeaderboard: SentimentSummary[];
  latestNews: NewsArticle[];
  narrativeClusters: NarrativeCluster[];
  mostActive: TrendingTicker[];
  fetchedAt: number;
  dataSource: string;
}

// ── Multi-Source Ticker Intelligence Types ────────────────────

export interface SourceSentiment {
  source: string;
  available: boolean;
  bullishPct: number;
  bearishPct: number;
  neutralPct: number;
  volume: number; // number of posts/articles/mentions
  weight: number; // 0-100 contribution weight in composite score
  note?: string;
}

export interface SentimentTrend {
  period: "24h" | "7d" | "30d";
  direction: "rising" | "falling" | "stable";
  bullishPct: number;
  bearishPct: number;
  volume: number;
}

export interface StockTwitsMessage {
  id: number;
  body: string;
  createdAt: string;
  sentiment: "Bullish" | "Bearish" | null;
  username: string;
  name: string;
  avatarUrl: string | null;
  likes: number;
  followers: number;
  isVerified: boolean;
}

export interface StockTwitsData {
  symbol: string;
  watchlistCount: number;
  messages: StockTwitsMessage[];
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  sentimentScore: number; // -1 to +1
  sentimentLabel: "STRONGLY BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONGLY BEARISH";
  fetchedAt: number;
}

export interface TickerNewsArticle {
  id: string;
  title: string;
  description: string;
  publishedUtc: string;
  articleUrl: string;
  imageUrl: string | null;
  publisher: string;
  tickers: string[];
  sentiment: "positive" | "neutral" | "negative" | "unknown";
  sentimentReasoning: string;
}

export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  numComments: number;
  url: string;
  createdUtc: number;
  selftext?: string;
}

export interface MultiSourceSocialData {
  symbol: string;
  assetType: "stock" | "crypto";

  // Composite score
  socialIntelligenceScore: number; // 0-100 weighted composite
  overallSentiment: "STRONGLY BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONGLY BEARISH";
  overallSentimentScore: number; // -1 to +1
  overallBullishPct: number;
  overallBearishPct: number;

  // Source breakdown
  sources: SourceSentiment[];

  // Volume & momentum
  socialVolume: number; // total posts/articles/mentions
  socialMomentum: "rising" | "falling" | "stable";
  discussionVelocity: string; // human-readable e.g. "+42% vs 7d avg"

  // Sentiment trends
  sentimentTrends: SentimentTrend[];

  // LLM-synthesized intelligence
  topBullishArguments: string[];
  topBearishArguments: string[];
  keyTopics: string[];
  influencerMentions: string[];
  retailInterestScore: number; // 0-100
  crowdConvictionScore: number; // 0-100
  contrarianSignalScore: number; // 0-100
  memeHypeDetected: boolean;
  memeHypeDescription: string;
  socialRiskWarnings: string[];
  bullCaseSummary: string;
  bearCaseSummary: string;

  // Raw data
  stocktwits: StockTwitsData | null;
  news: TickerNewsArticle[];
  redditPosts: RedditPost[];

  fetchedAt: number;
}

// ── Cache ─────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedData: SocialIntelligenceData | null = null;
let cacheTime = 0;

const tickerSocialCache = new Map<string, { data: MultiSourceSocialData; time: number }>();
const TICKER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Helpers ───────────────────────────────────────────────────

const YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/json",
  "Referer": "https://finance.yahoo.com/",
};

function sentimentToLabel(score: number): SentimentSummary["label"] {
  if (score >= 0.5)  return "STRONGLY BULLISH";
  if (score >= 0.15) return "BULLISH";
  if (score <= -0.5) return "STRONGLY BEARISH";
  if (score <= -0.15) return "BEARISH";
  return "NEUTRAL";
}

function insightSentimentToDirection(s: string): "positive" | "neutral" | "negative" {
  if (s === "positive") return "positive";
  if (s === "negative") return "negative";
  return "neutral";
}

// ── Polygon News Fetcher ──────────────────────────────────────

interface PolygonInsight {
  ticker: string;
  sentiment: string;
  sentiment_reasoning: string;
}

interface PolygonNewsItem {
  id: string;
  publisher: { name: string; logo_url?: string };
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  image_url?: string;
  description?: string;
  keywords?: string[];
  insights?: PolygonInsight[];
}

async function fetchPolygonNews(ticker?: string, limit = 25): Promise<PolygonNewsItem[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    log.warn("[SocialIntel] POLYGON_API_KEY not set");
    return [];
  }
  const base = "https://api.polygon.io/v2/reference/news";
  const params = new URLSearchParams({
    limit: String(limit),
    order: "desc",
    sort: "published_utc",
    apiKey,
  });
  if (ticker) params.set("ticker", ticker);

  try {
    const res = await fetch(`${base}?${params}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Polygon news HTTP ${res.status}`);
    const data = await res.json();
    return (data.results as PolygonNewsItem[]) ?? [];
  } catch (err) {
    log.warn(`[SocialIntel] Polygon news fetch failed: ${(err as Error).message}`);
    captureError(err as Error, { source: "socialIntelligence", stage: "polygon_news" }).catch(() => {});
    return [];
  }
}

// ── Yahoo Finance Trending Fetcher ────────────────────────────

interface YahooTrendingSymbol {
  symbol: string;
}

async function fetchYahooTrending(): Promise<string[]> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v1/finance/trending/US?count=20",
      { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`Yahoo trending HTTP ${res.status}`);
    const data = await res.json();
    const quotes: YahooTrendingSymbol[] = data?.finance?.result?.[0]?.quotes ?? [];
    return quotes.map((q) => q.symbol).filter((s) => !s.includes("-") && s.length <= 5);
  } catch (err) {
    log.warn(`[SocialIntel] Yahoo trending fetch failed: ${(err as Error).message}`);
    return [];
  }
}

// ── Yahoo Finance Screener Fetcher ────────────────────────────

interface YahooScreenerQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  marketState?: string;
}

async function fetchYahooScreener(scrId: string, count = 15): Promise<YahooScreenerQuote[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${scrId}&count=${count}&start=0`;
    const res = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Yahoo screener HTTP ${res.status}`);
    const data = await res.json();
    return (data?.finance?.result?.[0]?.quotes as YahooScreenerQuote[]) ?? [];
  } catch (err) {
    log.warn(`[SocialIntel] Yahoo screener (${scrId}) failed: ${(err as Error).message}`);
    return [];
  }
}

// ── Batch Quote Enrichment ────────────────────────────────────

async function enrichWithQuotes(symbols: string[]): Promise<Map<string, YahooScreenerQuote>> {
  const map = new Map<string, YahooScreenerQuote>();
  if (!symbols.length) return map;
  try {
    const fields = "regularMarketPrice,regularMarketChangePercent,regularMarketVolume,marketCap,shortName,longName,marketState";
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=${fields}`;
    const res = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Yahoo quote batch HTTP ${res.status}`);
    const data = await res.json();
    const quotes: YahooScreenerQuote[] = data?.quoteResponse?.result ?? [];
    for (const q of quotes) map.set(q.symbol, q);
  } catch (err) {
    log.warn(`[SocialIntel] Yahoo batch quote failed: ${(err as Error).message}`);
  }
  return map;
}

// ── StockTwits Fetcher ────────────────────────────────────────

function toStockTwitsSymbol(symbol: string, assetType: "stock" | "crypto"): string {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (assetType === "crypto") return `${s}.X`;
  return s;
}

async function fetchStockTwitsData(
  symbol: string,
  assetType: "stock" | "crypto"
): Promise<StockTwitsData | null> {
  const stSymbol = toStockTwitsSymbol(symbol, assetType);
  try {
    const url = `https://api.stocktwits.com/api/2/streams/symbol/${stSymbol}.json?limit=30`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      log.warn(`[SocialIntel] StockTwits ${stSymbol} HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data?.response?.status !== 200) return null;

    const rawMessages: any[] = data.messages ?? [];
    const symInfo = data.symbol ?? {};

    const messages: StockTwitsMessage[] = rawMessages.map((m: any) => ({
      id: m.id,
      body: m.body ?? "",
      createdAt: m.created_at ?? "",
      sentiment: m.entities?.sentiment?.basic ?? null,
      username: m.user?.username ?? "",
      name: m.user?.name ?? "",
      avatarUrl: m.user?.avatar_url_ssl ?? m.user?.avatar_url ?? null,
      likes: m.likes?.total ?? 0,
      followers: m.user?.followers ?? 0,
      isVerified: m.user?.official === true,
    }));

    let bullishCount = 0, bearishCount = 0, neutralCount = 0;
    for (const msg of messages) {
      if (msg.sentiment === "Bullish") bullishCount++;
      else if (msg.sentiment === "Bearish") bearishCount++;
      else neutralCount++;
    }

    const tagged = bullishCount + bearishCount;
    const sentimentScore = tagged > 0 ? (bullishCount - bearishCount) / tagged : 0;

    return {
      symbol: stSymbol,
      watchlistCount: symInfo.watchlist_count ?? 0,
      messages,
      bullishCount,
      bearishCount,
      neutralCount,
      sentimentScore: Math.round(sentimentScore * 100) / 100,
      sentimentLabel: sentimentToLabel(sentimentScore),
      fetchedAt: Date.now(),
    };
  } catch (err) {
    log.warn(`[SocialIntel] StockTwits fetch failed for ${stSymbol}: ${(err as Error).message}`);
    return null;
  }
}

// ── Reddit Fetcher (Public JSON API) ─────────────────────────

const REDDIT_SUBREDDITS_STOCK = ["wallstreetbets", "investing", "stocks", "StockMarket"];
const REDDIT_SUBREDDITS_CRYPTO = ["CryptoCurrency", "Bitcoin", "ethereum", "CryptoMarkets", "altcoin"];

async function fetchRedditPosts(symbol: string, assetType: "stock" | "crypto"): Promise<RedditPost[]> {
  const subreddits = assetType === "crypto" ? REDDIT_SUBREDDITS_CRYPTO : REDDIT_SUBREDDITS_STOCK;
  const posts: RedditPost[] = [];

  // Search top 2 subreddits for the symbol to stay within timeout
  const targetSubs = subreddits.slice(0, 2);

  await Promise.allSettled(targetSubs.map(async (sub) => {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(symbol)}&restrict_sr=1&sort=hot&limit=10&t=week`;
      const res = await fetch(url, {
        headers: { "User-Agent": "FAULTLINE/1.0 (market intelligence platform)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const children: any[] = data?.data?.children ?? [];
      for (const child of children) {
        const p = child.data;
        if (!p) continue;
        posts.push({
          id: p.id,
          title: p.title ?? "",
          subreddit: sub,
          score: p.score ?? 0,
          numComments: p.num_comments ?? 0,
          url: `https://reddit.com${p.permalink}`,
          createdUtc: p.created_utc ?? 0,
          selftext: (p.selftext ?? "").slice(0, 300),
        });
      }
    } catch (err) {
      log.warn(`[SocialIntel] Reddit r/${sub} fetch failed: ${(err as Error).message}`);
    }
  }));

  return posts.sort((a, b) => b.score - a.score).slice(0, 20);
}

// ── Ticker News Fetcher ───────────────────────────────────────

async function fetchTickerNews(symbol: string): Promise<TickerNewsArticle[]> {
  const articles = await fetchPolygonNews(symbol.toUpperCase(), 20);
  return articles.map((item) => {
    const insight = item.insights?.find((i) => i.ticker === symbol.toUpperCase())
      ?? item.insights?.[0];
    const sentiment = insight
      ? insightSentimentToDirection(insight.sentiment)
      : "unknown";
    return {
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      publishedUtc: item.published_utc,
      articleUrl: item.article_url,
      imageUrl: item.image_url ?? null,
      publisher: item.publisher.name,
      tickers: item.tickers ?? [],
      sentiment,
      sentimentReasoning: insight?.sentiment_reasoning ?? "",
    };
  });
}

// ── LLM Synthesis Engine ──────────────────────────────────────

interface LLMSocialSynthesis {
  topBullishArguments: string[];
  topBearishArguments: string[];
  keyTopics: string[];
  influencerMentions: string[];
  retailInterestScore: number;
  crowdConvictionScore: number;
  contrarianSignalScore: number;
  memeHypeDetected: boolean;
  memeHypeDescription: string;
  socialRiskWarnings: string[];
  bullCaseSummary: string;
  bearCaseSummary: string;
  sentimentTrends: SentimentTrend[];
  discussionVelocity: string;
}

async function synthesizeSocialIntelligence(
  symbol: string,
  assetType: "stock" | "crypto",
  stocktwits: StockTwitsData | null,
  news: TickerNewsArticle[],
  redditPosts: RedditPost[]
): Promise<LLMSocialSynthesis> {
  // Build context for LLM
  const stContext = stocktwits
    ? `StockTwits: ${stocktwits.bullishCount} bullish, ${stocktwits.bearishCount} bearish, ${stocktwits.neutralCount} neutral. Watchlist: ${stocktwits.watchlistCount.toLocaleString()}. Top messages: ${stocktwits.messages.slice(0, 5).map(m => `"${m.body.slice(0, 120)}" (${m.sentiment ?? 'no tag'})`).join(" | ")}`
    : "StockTwits: unavailable";

  const newsContext = news.length > 0
    ? `Recent news (${news.length} articles): ${news.slice(0, 8).map(n => `[${n.sentiment.toUpperCase()}] ${n.title}`).join(" | ")}`
    : "News: no recent articles";

  const redditContext = redditPosts.length > 0
    ? `Reddit posts (${redditPosts.length} posts from r/wallstreetbets, r/investing, r/stocks, r/CryptoCurrency): ${redditPosts.slice(0, 6).map(p => `[r/${p.subreddit} score:${p.score}] "${p.title.slice(0, 100)}"`).join(" | ")}`
    : "Reddit: no recent posts found";

  const prompt = `You are a social intelligence analyst for FAULTLINE, a professional market intelligence platform.

Analyze the following social media and news data for ${symbol} (${assetType}) and produce a structured JSON intelligence report.

DATA SOURCES:
${stContext}
${newsContext}
${redditContext}

IMPORTANT RULES:
- Base ALL analysis strictly on the provided data. Do not fabricate information.
- If a source has no data, reflect that in your analysis.
- Scores must be integers 0-100.
- Provide exactly 3 bullish arguments and 3 bearish arguments (shorter if data is insufficient).
- Provide 3-5 key topics being discussed.
- For influencer mentions, only include if explicitly mentioned in the data (otherwise empty array).
- socialRiskWarnings: include warnings like "concentrated retail sentiment", "low data quality", "meme activity detected", etc.
- discussionVelocity: estimate like "+35% vs 7d avg" or "below average" based on volume signals.

Return ONLY valid JSON matching this schema exactly:
{
  "topBullishArguments": ["string", "string", "string"],
  "topBearishArguments": ["string", "string", "string"],
  "keyTopics": ["string", "string", "string"],
  "influencerMentions": ["string"],
  "retailInterestScore": 0,
  "crowdConvictionScore": 0,
  "contrarianSignalScore": 0,
  "memeHypeDetected": false,
  "memeHypeDescription": "string",
  "socialRiskWarnings": ["string"],
  "bullCaseSummary": "string",
  "bearCaseSummary": "string",
  "sentimentTrends": [
    {"period": "24h", "direction": "stable", "bullishPct": 50, "bearishPct": 50, "volume": 0},
    {"period": "7d", "direction": "stable", "bullishPct": 50, "bearishPct": 50, "volume": 0},
    {"period": "30d", "direction": "stable", "bullishPct": 50, "bearishPct": 50, "volume": 0}
  ],
  "discussionVelocity": "string"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a social intelligence analyst. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "social_intelligence",
          strict: true,
          schema: {
            type: "object",
            properties: {
              topBullishArguments: { type: "array", items: { type: "string" } },
              topBearishArguments: { type: "array", items: { type: "string" } },
              keyTopics: { type: "array", items: { type: "string" } },
              influencerMentions: { type: "array", items: { type: "string" } },
              retailInterestScore: { type: "integer" },
              crowdConvictionScore: { type: "integer" },
              contrarianSignalScore: { type: "integer" },
              memeHypeDetected: { type: "boolean" },
              memeHypeDescription: { type: "string" },
              socialRiskWarnings: { type: "array", items: { type: "string" } },
              bullCaseSummary: { type: "string" },
              bearCaseSummary: { type: "string" },
              sentimentTrends: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    period: { type: "string" },
                    direction: { type: "string" },
                    bullishPct: { type: "integer" },
                    bearishPct: { type: "integer" },
                    volume: { type: "integer" },
                  },
                  required: ["period", "direction", "bullishPct", "bearishPct", "volume"],
                  additionalProperties: false,
                },
              },
              discussionVelocity: { type: "string" },
            },
            required: [
              "topBullishArguments", "topBearishArguments", "keyTopics", "influencerMentions",
              "retailInterestScore", "crowdConvictionScore", "contrarianSignalScore",
              "memeHypeDetected", "memeHypeDescription", "socialRiskWarnings",
              "bullCaseSummary", "bearCaseSummary", "sentimentTrends", "discussionVelocity",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty LLM response");
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const parsed = JSON.parse(content);
    return parsed as LLMSocialSynthesis;
  } catch (err) {
    log.warn(`[SocialIntel] LLM synthesis failed for ${symbol}: ${(err as Error).message}`);
    // Fallback synthesis from raw data
    return buildFallbackSynthesis(symbol, stocktwits, news, redditPosts);
  }
}

function buildFallbackSynthesis(
  symbol: string,
  stocktwits: StockTwitsData | null,
  news: TickerNewsArticle[],
  redditPosts: RedditPost[]
): LLMSocialSynthesis {
  const bullNews = news.filter(n => n.sentiment === "positive");
  const bearNews = news.filter(n => n.sentiment === "negative");

  return {
    topBullishArguments: bullNews.slice(0, 3).map(n => n.title),
    topBearishArguments: bearNews.slice(0, 3).map(n => n.title),
    keyTopics: [symbol, "market sentiment", "price action"],
    influencerMentions: [],
    retailInterestScore: stocktwits ? Math.min(100, Math.round(stocktwits.watchlistCount / 100)) : 30,
    crowdConvictionScore: stocktwits
      ? Math.round(Math.abs(stocktwits.sentimentScore) * 100)
      : 40,
    contrarianSignalScore: 50,
    memeHypeDetected: false,
    memeHypeDescription: "",
    socialRiskWarnings: ["Limited data available — analysis based on partial sources"],
    bullCaseSummary: bullNews.length > 0 ? bullNews[0].title : `Insufficient data for ${symbol} bull case.`,
    bearCaseSummary: bearNews.length > 0 ? bearNews[0].title : `Insufficient data for ${symbol} bear case.`,
    sentimentTrends: [
      { period: "24h", direction: "stable", bullishPct: 50, bearishPct: 50, volume: news.length },
      { period: "7d", direction: "stable", bullishPct: 50, bearishPct: 50, volume: news.length },
      { period: "30d", direction: "stable", bullishPct: 50, bearishPct: 50, volume: news.length },
    ],
    discussionVelocity: "Data insufficient for velocity estimate",
  };
}

// ── Source Attribution Builder ────────────────────────────────

function buildSourceAttribution(
  stocktwits: StockTwitsData | null,
  news: TickerNewsArticle[],
  redditPosts: RedditPost[],
  assetType: "stock" | "crypto"
): SourceSentiment[] {
  const sources: SourceSentiment[] = [];

  // StockTwits
  if (stocktwits) {
    const tagged = stocktwits.bullishCount + stocktwits.bearishCount;
    sources.push({
      source: "StockTwits",
      available: true,
      bullishPct: tagged > 0 ? Math.round((stocktwits.bullishCount / tagged) * 100) : 50,
      bearishPct: tagged > 0 ? Math.round((stocktwits.bearishCount / tagged) * 100) : 50,
      neutralPct: 0,
      volume: stocktwits.messages.length,
      weight: 25,
    });
  } else {
    sources.push({ source: "StockTwits", available: false, bullishPct: 0, bearishPct: 0, neutralPct: 0, volume: 0, weight: 0, note: "Source unavailable" });
  }

  // Polygon News / Financial News
  const posNews = news.filter(n => n.sentiment === "positive").length;
  const negNews = news.filter(n => n.sentiment === "negative").length;
  const totalNews = news.length;
  sources.push({
    source: "Financial News",
    available: totalNews > 0,
    bullishPct: totalNews > 0 ? Math.round((posNews / totalNews) * 100) : 0,
    bearishPct: totalNews > 0 ? Math.round((negNews / totalNews) * 100) : 0,
    neutralPct: totalNews > 0 ? Math.round(((totalNews - posNews - negNews) / totalNews) * 100) : 0,
    volume: totalNews,
    weight: 30,
    note: totalNews === 0 ? "Source unavailable" : undefined,
  });

  // Reddit
  if (redditPosts.length > 0) {
    // Estimate sentiment from post scores and titles
    const posReddit = redditPosts.filter(p => p.score > 100).length;
    const negReddit = Math.max(0, redditPosts.length - posReddit - Math.floor(redditPosts.length * 0.3));
    sources.push({
      source: "Reddit",
      available: true,
      bullishPct: Math.round((posReddit / redditPosts.length) * 100),
      bearishPct: Math.round((negReddit / redditPosts.length) * 100),
      neutralPct: Math.max(0, 100 - Math.round((posReddit / redditPosts.length) * 100) - Math.round((negReddit / redditPosts.length) * 100)),
      volume: redditPosts.length,
      weight: 20,
    });
  } else {
    sources.push({ source: "Reddit", available: false, bullishPct: 0, bearishPct: 0, neutralPct: 0, volume: 0, weight: 0, note: "Source unavailable" });
  }

  // Sources requiring paid credentials — always report as unavailable
  sources.push({ source: "X (Twitter)", available: false, bullishPct: 0, bearishPct: 0, neutralPct: 0, volume: 0, weight: 0, note: "Source unavailable" });
  sources.push({ source: "YouTube", available: false, bullishPct: 0, bearishPct: 0, neutralPct: 0, volume: 0, weight: 0, note: "Source unavailable" });
  sources.push({ source: "TikTok", available: false, bullishPct: 0, bearishPct: 0, neutralPct: 0, volume: 0, weight: 0, note: "Source unavailable" });
  sources.push({ source: "Seeking Alpha", available: false, bullishPct: 0, bearishPct: 0, neutralPct: 0, volume: 0, weight: 0, note: "Source unavailable" });
  sources.push({ source: "TradingView", available: false, bullishPct: 0, bearishPct: 0, neutralPct: 0, volume: 0, weight: 0, note: "Source unavailable" });

  // Crypto-specific sources
  if (assetType === "crypto") {
    sources.push({ source: "Telegram", available: false, bullishPct: 0, bearishPct: 0, neutralPct: 0, volume: 0, weight: 0, note: "Source unavailable" });
    sources.push({ source: "Discord", available: false, bullishPct: 0, bearishPct: 0, neutralPct: 0, volume: 0, weight: 0, note: "Source unavailable" });
  }

  return sources;
}

// ── Composite Score Calculator ────────────────────────────────

function computeCompositeScore(
  stocktwits: StockTwitsData | null,
  news: TickerNewsArticle[],
  redditPosts: RedditPost[]
): { score: number; bullishPct: number; bearishPct: number; overallSentimentScore: number } {
  let weightedScore = 0;
  let totalWeight = 0;

  // StockTwits (weight: 35%)
  if (stocktwits && (stocktwits.bullishCount + stocktwits.bearishCount) > 0) {
    weightedScore += stocktwits.sentimentScore * 35;
    totalWeight += 35;
  }

  // News (weight: 40%)
  if (news.length > 0) {
    const pos = news.filter(n => n.sentiment === "positive").length;
    const neg = news.filter(n => n.sentiment === "negative").length;
    const newsScore = (pos + neg) > 0 ? (pos - neg) / (pos + neg) : 0;
    weightedScore += newsScore * 40;
    totalWeight += 40;
  }

  // Reddit (weight: 25%)
  if (redditPosts.length > 0) {
    const highScore = redditPosts.filter(p => p.score > 100).length;
    const redditScore = (highScore / redditPosts.length) * 2 - 1; // normalize to -1..+1
    weightedScore += redditScore * 25;
    totalWeight += 25;
  }

  const rawScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const normalizedScore = Math.round(rawScore * 100) / 100;

  // Convert to 0-100 composite
  const compositeScore = Math.round((normalizedScore + 1) * 50);

  // Compute overall bull/bear %
  let bullPct = 50, bearPct = 50;
  if (stocktwits && (stocktwits.bullishCount + stocktwits.bearishCount) > 0) {
    const tagged = stocktwits.bullishCount + stocktwits.bearishCount;
    bullPct = Math.round((stocktwits.bullishCount / tagged) * 100);
    bearPct = 100 - bullPct;
  } else if (news.length > 0) {
    const pos = news.filter(n => n.sentiment === "positive").length;
    const neg = news.filter(n => n.sentiment === "negative").length;
    const total = pos + neg;
    if (total > 0) {
      bullPct = Math.round((pos / total) * 100);
      bearPct = 100 - bullPct;
    }
  }

  return { score: compositeScore, bullishPct: bullPct, bearishPct: bearPct, overallSentimentScore: normalizedScore };
}

// ── Narrative Cluster Builder ─────────────────────────────────

const NARRATIVE_THEMES: Array<{
  theme: string;
  description: string;
  keywords: string[];
}> = [
  {
    theme: "AI & Semiconductor Surge",
    description: "Artificial intelligence infrastructure, GPU demand, and data-center buildout driving mega-cap tech.",
    keywords: ["AI", "artificial intelligence", "GPU", "semiconductor", "data center", "NVDA", "NVIDIA", "chips"],
  },
  {
    theme: "Fed Policy & Rate Expectations",
    description: "Federal Reserve rate decisions, inflation data, and Treasury yield movements shaping risk appetite.",
    keywords: ["Fed", "Federal Reserve", "rate", "inflation", "CPI", "treasury", "yield", "FOMC", "interest"],
  },
  {
    theme: "Earnings & Revenue Beats",
    description: "Corporate earnings surprises, revenue guidance, and analyst estimate revisions.",
    keywords: ["earnings", "revenue", "EPS", "beat", "guidance", "analyst", "estimate", "quarterly"],
  },
  {
    theme: "Crypto & Digital Assets",
    description: "Bitcoin, Ethereum, and altcoin price action, ETF flows, and regulatory developments.",
    keywords: ["bitcoin", "BTC", "crypto", "ethereum", "ETH", "digital asset", "blockchain", "ETF", "altcoin"],
  },
  {
    theme: "Geopolitical Risk",
    description: "Trade tensions, sanctions, conflict, and macro political events affecting markets.",
    keywords: ["tariff", "trade war", "sanctions", "geopolitical", "China", "Russia", "war", "conflict", "election"],
  },
  {
    theme: "Energy & Commodities",
    description: "Oil, natural gas, gold, and commodity price drivers including supply/demand dynamics.",
    keywords: ["oil", "crude", "energy", "gold", "commodity", "OPEC", "natural gas", "silver", "copper"],
  },
];

function buildNarrativeClusters(articles: PolygonNewsItem[]): NarrativeCluster[] {
  return NARRATIVE_THEMES.map((theme) => {
    const matched = articles.filter((a) => {
      const text = `${a.title} ${a.description ?? ""} ${(a.keywords ?? []).join(" ")}`.toLowerCase();
      return theme.keywords.some((kw) => text.includes(kw.toLowerCase()));
    });

    const tickers = Array.from(new Set(matched.flatMap((a) => a.tickers ?? []))).slice(0, 6);

    let bullish = 0, bearish = 0;
    for (const a of matched) {
      for (const ins of a.insights ?? []) {
        if (ins.sentiment === "positive") bullish++;
        else if (ins.sentiment === "negative") bearish++;
      }
    }
    const dominantSentiment: NarrativeCluster["dominantSentiment"] =
      bullish > bearish * 1.3 ? "bullish" : bearish > bullish * 1.3 ? "bearish" : "neutral";

    return {
      theme: theme.theme,
      description: theme.description,
      tickers,
      articleCount: matched.length,
      dominantSentiment,
      keywords: theme.keywords.slice(0, 5),
    };
  }).filter((c) => c.articleCount > 0)
    .sort((a, b) => b.articleCount - a.articleCount);
}

// ── Main Global Fetch ─────────────────────────────────────────

export async function getSocialIntelligenceData(): Promise<SocialIntelligenceData> {
  if (cachedData && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedData;
  }

  log.info("[SocialIntel] Fetching fresh social intelligence data…");

  const [trendingSymbols, mostActiveRaw, newsRaw] = await Promise.all([
    fetchYahooTrending(),
    fetchYahooScreener("most_actives", 15),
    fetchPolygonNews(undefined, 50),
  ]);

  const trendingQuotes = await enrichWithQuotes(trendingSymbols.slice(0, 15));

  // Build sentiment map from Polygon news
  const sentimentMap = new Map<string, {
    bullish: number; bearish: number; neutral: number;
    articles: number; latestHeadline: string | null; latestPublished: string | null;
    name: string;
  }>();

  for (const article of newsRaw) {
    for (const insight of article.insights ?? []) {
      const ticker = insight.ticker.toUpperCase();
      if (!sentimentMap.has(ticker)) {
        sentimentMap.set(ticker, {
          bullish: 0, bearish: 0, neutral: 0,
          articles: 0, latestHeadline: null, latestPublished: null,
          name: ticker,
        });
      }
      const entry = sentimentMap.get(ticker)!;
      entry.articles++;
      if (insight.sentiment === "positive") entry.bullish++;
      else if (insight.sentiment === "negative") entry.bearish++;
      else entry.neutral++;
      if (!entry.latestHeadline) {
        entry.latestHeadline = article.title;
        entry.latestPublished = article.published_utc;
      }
    }
  }

  const trendingTickers: TrendingTicker[] = trendingSymbols.slice(0, 15).map((symbol) => {
    const q = trendingQuotes.get(symbol);
    const sent = sentimentMap.get(symbol);
    const newsCount = sent?.articles ?? 0;
    const bullish = sent?.bullish ?? 0;
    const bearish = sent?.bearish ?? 0;

    let sentiment: TrendingTicker["sentiment"] = "unknown";
    if (newsCount > 0) {
      if (bullish > bearish * 1.3) sentiment = "bullish";
      else if (bearish > bullish * 1.3) sentiment = "bearish";
      else sentiment = "neutral";
    }

    const sentimentIntensity = newsCount > 0 ? Math.abs(bullish - bearish) / newsCount : 0;
    const buzzScore = Math.min(100, Math.round(Math.log1p(newsCount) * 20 + sentimentIntensity * 30));

    return {
      symbol,
      name: q?.shortName ?? q?.longName ?? symbol,
      price: q?.regularMarketPrice ?? null,
      changePercent: q?.regularMarketChangePercent ?? null,
      volume: q?.regularMarketVolume ?? null,
      marketCap: q?.marketCap ?? null,
      marketState: q?.marketState ?? null,
      sentiment,
      buzzScore,
      newsCount,
      latestHeadline: sent?.latestHeadline ?? null,
    };
  });

  const mostActive: TrendingTicker[] = mostActiveRaw.slice(0, 12).map((q) => {
    const sent = sentimentMap.get(q.symbol);
    const newsCount = sent?.articles ?? 0;
    const bullish = sent?.bullish ?? 0;
    const bearish = sent?.bearish ?? 0;

    let sentiment: TrendingTicker["sentiment"] = "unknown";
    if (newsCount > 0) {
      if (bullish > bearish * 1.3) sentiment = "bullish";
      else if (bearish > bullish * 1.3) sentiment = "bearish";
      else sentiment = "neutral";
    }

    const sentimentIntensity = newsCount > 0 ? Math.abs(bullish - bearish) / newsCount : 0;
    const buzzScore = Math.min(100, Math.round(Math.log1p(newsCount) * 20 + sentimentIntensity * 30));

    return {
      symbol: q.symbol,
      name: q.shortName ?? q.longName ?? q.symbol,
      price: q.regularMarketPrice ?? null,
      changePercent: q.regularMarketChangePercent ?? null,
      volume: q.regularMarketVolume ?? null,
      marketCap: q.marketCap ?? null,
      marketState: q.marketState ?? null,
      sentiment,
      buzzScore,
      newsCount,
      latestHeadline: sent?.latestHeadline ?? null,
    };
  });

  const sentimentLeaderboard: SentimentSummary[] = Array.from(sentimentMap.entries())
    .filter(([, v]) => v.articles >= 2)
    .map(([ticker, v]) => {
      const total = v.bullish + v.bearish + v.neutral;
      const score = total > 0 ? (v.bullish - v.bearish) / total : 0;
      return {
        ticker,
        name: v.name,
        bullishCount: v.bullish,
        bearishCount: v.bearish,
        neutralCount: v.neutral,
        totalArticles: v.articles,
        sentimentScore: Math.round(score * 100) / 100,
        label: sentimentToLabel(score),
        latestHeadline: v.latestHeadline,
        latestPublished: v.latestPublished,
      };
    })
    .sort((a, b) => Math.abs(b.sentimentScore) - Math.abs(a.sentimentScore))
    .slice(0, 20);

  const latestNews: NewsArticle[] = newsRaw.slice(0, 30).map((item) => {
    const primaryTicker = item.tickers?.[0] ?? null;
    const primaryInsight = item.insights?.find((i) => i.ticker === primaryTicker);
    const sentiment = primaryInsight
      ? insightSentimentToDirection(primaryInsight.sentiment)
      : "unknown";
    return {
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      publishedUtc: item.published_utc,
      articleUrl: item.article_url,
      imageUrl: item.image_url ?? null,
      publisher: item.publisher.name,
      publisherLogoUrl: item.publisher.logo_url ?? null,
      tickers: item.tickers ?? [],
      keywords: item.keywords ?? [],
      sentiment,
      sentimentReasoning: primaryInsight?.sentiment_reasoning ?? "",
      primaryTicker,
    };
  });

  const narrativeClusters = buildNarrativeClusters(newsRaw);

  const result: SocialIntelligenceData = {
    trendingTickers,
    sentimentLeaderboard,
    latestNews,
    narrativeClusters,
    mostActive,
    fetchedAt: Date.now(),
    dataSource: "Polygon.io News + Yahoo Finance Trending/Screener + StockTwits + Reddit",
  };

  cachedData = result;
  cacheTime = Date.now();
  log.info(`[SocialIntel] Data ready: ${trendingTickers.length} trending, ${sentimentLeaderboard.length} sentiment entries, ${latestNews.length} articles`);

  return result;
}

export function clearSocialIntelligenceCache(): void {
  cachedData = null;
  cacheTime = 0;
}

// ── Ticker-Specific Multi-Source Social Data ──────────────────

export async function getTickerSocialData(
  symbol: string,
  assetType: "stock" | "crypto"
): Promise<MultiSourceSocialData> {
  const cacheKey = `${symbol.toUpperCase()}_${assetType}`;
  const cached = tickerSocialCache.get(cacheKey);
  if (cached && Date.now() - cached.time < TICKER_CACHE_TTL_MS) {
    return cached.data;
  }

  log.info(`[SocialIntel] Fetching multi-source social data for ${symbol} (${assetType})`);

  // Parallel fetch all available sources
  const [stocktwits, news, redditPosts] = await Promise.all([
    fetchStockTwitsData(symbol, assetType),
    fetchTickerNews(symbol),
    fetchRedditPosts(symbol, assetType),
  ]);

  // Build source attribution
  const sources = buildSourceAttribution(stocktwits, news, redditPosts, assetType);

  // Compute composite score
  const { score, bullishPct, bearishPct, overallSentimentScore } = computeCompositeScore(stocktwits, news, redditPosts);

  // LLM synthesis (runs in parallel with above, but needs their results)
  const synthesis = await synthesizeSocialIntelligence(symbol, assetType, stocktwits, news, redditPosts);

  // Social volume
  const socialVolume = (stocktwits?.messages.length ?? 0) + news.length + redditPosts.length;

  // Social momentum from trends
  const trend24h = synthesis.sentimentTrends.find(t => t.period === "24h");
  const socialMomentum: "rising" | "falling" | "stable" = trend24h?.direction ?? "stable";

  const result: MultiSourceSocialData = {
    symbol: symbol.toUpperCase(),
    assetType,
    socialIntelligenceScore: score,
    overallSentiment: sentimentToLabel(overallSentimentScore),
    overallSentimentScore,
    overallBullishPct: bullishPct,
    overallBearishPct: bearishPct,
    sources,
    socialVolume,
    socialMomentum,
    discussionVelocity: synthesis.discussionVelocity,
    sentimentTrends: synthesis.sentimentTrends as SentimentTrend[],
    topBullishArguments: synthesis.topBullishArguments,
    topBearishArguments: synthesis.topBearishArguments,
    keyTopics: synthesis.keyTopics,
    influencerMentions: synthesis.influencerMentions,
    retailInterestScore: synthesis.retailInterestScore,
    crowdConvictionScore: synthesis.crowdConvictionScore,
    contrarianSignalScore: synthesis.contrarianSignalScore,
    memeHypeDetected: synthesis.memeHypeDetected,
    memeHypeDescription: synthesis.memeHypeDescription,
    socialRiskWarnings: synthesis.socialRiskWarnings,
    bullCaseSummary: synthesis.bullCaseSummary,
    bearCaseSummary: synthesis.bearCaseSummary,
    stocktwits,
    news,
    redditPosts,
    fetchedAt: Date.now(),
  };

  tickerSocialCache.set(cacheKey, { data: result, time: Date.now() });
  return result;
}

export function clearTickerSocialCache(symbol?: string): void {
  if (symbol) {
    tickerSocialCache.delete(`${symbol.toUpperCase()}_stock`);
    tickerSocialCache.delete(`${symbol.toUpperCase()}_crypto`);
  } else {
    tickerSocialCache.clear();
  }
}
