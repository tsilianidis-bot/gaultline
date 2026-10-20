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
 * Quote enrichment uses the v8 chart adapter. The unauthenticated v7
 * quote endpoint is not called. Numeric scores are omitted when no tagged
 * observation supports them. LLM synthesis is not used on this path.
 *
 * Sources that require paid credentials (X/Twitter, TikTok, Seeking Alpha,
 * TradingView, Telegram, Discord) are reported as "Source unavailable" rather
 * than silently excluded.
 */

import { log } from "./logger";
import { captureError } from "./errorTracking";
import { getQuotes, type YahooQuote } from "./yahooProxy";

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
  socialIntelligenceScore: number | null; // 0-100 weighted composite; null when no tagged source contributes
  overallSentiment: "STRONGLY BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONGLY BEARISH" | "UNAVAILABLE";
  overallSentimentScore: number | null; // -1 to +1
  overallBullishPct: number | null;
  overallBearishPct: number | null;

  // Source breakdown
  sources: SourceSentiment[];

  // Volume & momentum
  socialVolume: number; // total posts/articles/mentions
  socialMomentum: "rising" | "falling" | "stable" | "unknown";
  discussionVelocity: string; // human-readable e.g. "+42% vs 7d avg"

  // Sentiment trends
  sentimentTrends: SentimentTrend[];

  // LLM-synthesized intelligence
  topBullishArguments: string[];
  topBearishArguments: string[];
  keyTopics: string[];
  influencerMentions: string[];
  retailInterestScore: number | null; // 0-100, null when StockTwits did not return a watchlist
  crowdConvictionScore: number | null; // 0-100, null without tagged StockTwits sentiment
  contrarianSignalScore: number | null; // withheld; no source observation defines this score
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

/**
 * Raw public-source snapshot for deterministic scoring systems. This omits LLM
 * synthesis so consumers can rely only on fetched source measurements.
 */
export interface VerifiedSocialSnapshot {
  symbol: string;
  assetType: "stock" | "crypto";
  sources: SourceSentiment[];
  sourceCount: number;
  socialVolume: number;
  newsCount: number;
  sentimentScore: number | null;
  positiveNews: number;
  negativeNews: number;
  extremeAttentionDetected: boolean;
  fetchedAt: number;
}

// ── Cache ─────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedData: SocialIntelligenceData | null = null;
let cacheTime = 0;

const tickerSocialCache = new Map<string, { data: MultiSourceSocialData; time: number }>();
const verifiedSocialSnapshotCache = new Map<string, { data: VerifiedSocialSnapshot; time: number }>();
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

export function socialQuoteFromProvider(quote: Pick<YahooQuote, "ticker" | "price" | "changePercent" | "volume" | "marketState" | "source">): YahooScreenerQuote | null {
  if (quote.source === "error" || quote.price == null || !Number.isFinite(quote.price)) return null;
  return {
    symbol: quote.ticker,
    regularMarketPrice: quote.price,
    regularMarketChangePercent: quote.changePercent ?? undefined,
    regularMarketVolume: quote.volume ?? undefined,
    marketState: quote.marketState,
  };
}

async function enrichWithQuotes(symbols: string[]): Promise<Map<string, YahooScreenerQuote>> {
  const map = new Map<string, YahooScreenerQuote>();
  if (!symbols.length) return map;
  try {
    const quotes = await getQuotes(symbols);
    for (const quote of quotes) {
      const mapped = socialQuoteFromProvider(quote);
      if (mapped) map.set(mapped.symbol, mapped);
    }
  } catch (err) {
    log.warn(`[SocialIntel] Chart quote enrichment failed: ${(err as Error).message}`);
  }
  return map;
}

export function socialDataSourceLabel(input: {
  newsCount: number;
  yahooListingCount: number;
  chartQuoteCount: number;
}): string {
  const parts: string[] = [];
  if (input.newsCount > 0) parts.push("Polygon.io News");
  if (input.yahooListingCount > 0) parts.push("Yahoo Finance Trending/Screener");
  if (input.chartQuoteCount > 0) parts.push("Yahoo Finance chart quotes");
  return parts.length > 0 ? parts.join(" + ") : "No provider observations";
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

// ── Observed social summary ───────────────────────────────────
// Numeric gauges and trend rows come only from tagged provider observations.
// This path does not call an LLM.

interface ObservedSocialSynthesis {
  topBullishArguments: string[];
  topBearishArguments: string[];
  keyTopics: string[];
  influencerMentions: string[];
  retailInterestScore: number | null;
  crowdConvictionScore: number | null;
  contrarianSignalScore: number | null;
  memeHypeDetected: boolean;
  memeHypeDescription: string;
  socialRiskWarnings: string[];
  bullCaseSummary: string;
  bearCaseSummary: string;
  sentimentTrends: SentimentTrend[];
  discussionVelocity: string;
}

export function observationTimestamps(input: {
  stocktwits: StockTwitsData | null;
  news: TickerNewsArticle[];
  redditPosts: RedditPost[];
}): number[] {
  const stamps: number[] = [];
  for (const message of input.stocktwits?.messages ?? []) {
    const parsed = Date.parse(message.createdAt);
    if (Number.isFinite(parsed)) stamps.push(parsed);
  }
  for (const article of input.news) {
    const parsed = Date.parse(article.publishedUtc);
    if (Number.isFinite(parsed)) stamps.push(parsed);
  }
  for (const post of input.redditPosts) {
    if (!Number.isFinite(post.createdUtc) || post.createdUtc <= 0) continue;
    stamps.push(post.createdUtc > 1_000_000_000_000 ? post.createdUtc : post.createdUtc * 1000);
  }
  return stamps;
}

const TREND_WINDOW_MS = { "24h": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000 } as const;

/** A period is admitted only when a provider timestamp falls inside it and is not in the future. */
export function admittedTrendPeriods(stamps: number[], now = Date.now()): Array<"24h" | "7d" | "30d"> {
  return (Object.keys(TREND_WINDOW_MS) as Array<keyof typeof TREND_WINDOW_MS>).filter(period =>
    stamps.some(stamp => stamp <= now && now - stamp <= TREND_WINDOW_MS[period]),
  );
}

function buildObservedSocialSynthesis(
  _symbol: string,
  stocktwits: StockTwitsData | null,
  news: TickerNewsArticle[],
  redditPosts: RedditPost[]
): ObservedSocialSynthesis {
  const bullNews = news.filter(article => article.sentiment === "positive");
  const bearNews = news.filter(article => article.sentiment === "negative");
  const tagged = stocktwitsContributes(stocktwits);
  return {
    topBullishArguments: bullNews.slice(0, 3).map(article => article.title),
    topBearishArguments: bearNews.slice(0, 3).map(article => article.title),
    keyTopics: [],
    influencerMentions: [],
    retailInterestScore: stocktwits ? Math.min(100, Math.round(stocktwits.watchlistCount / 100)) : null,
    crowdConvictionScore: tagged && stocktwits ? Math.round(Math.abs(stocktwits.sentimentScore) * 100) : null,
    contrarianSignalScore: null,
    memeHypeDetected: false,
    memeHypeDescription: "",
    socialRiskWarnings: tagged || bullNews.length > 0 || bearNews.length > 0
      ? []
      : ["No tagged social observations."],
    bullCaseSummary: bullNews.length > 0 ? bullNews[0].title : "Not supplied by source observations.",
    bearCaseSummary: bearNews.length > 0 ? bearNews[0].title : "Not supplied by source observations.",
    sentimentTrends: [],
    discussionVelocity: "Not supplied",
  };
}

// ── Source Attribution Builder ────────────────────────────────

/** Weights used by computeCompositeScore. Displayed weights must match these. */
export const SOCIAL_COMPOSITE_WEIGHTS = {
  stocktwits: 35,
  news: 40,
  reddit: 25,
} as const;

export function stocktwitsContributes(stocktwits: StockTwitsData | null): boolean {
  return Boolean(stocktwits && (stocktwits.bullishCount + stocktwits.bearishCount) > 0);
}

export function newsContributes(news: TickerNewsArticle[]): boolean {
  const positive = news.filter(article => article.sentiment === "positive").length;
  const negative = news.filter(article => article.sentiment === "negative").length;
  return positive + negative > 0;
}

export function redditContributes(redditPosts: RedditPost[]): boolean {
  return redditPosts.length > 0;
}

export function buildSourceAttribution(
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
      available: stocktwitsContributes(stocktwits),
      bullishPct: tagged > 0 ? Math.round((stocktwits.bullishCount / tagged) * 100) : 0,
      bearishPct: tagged > 0 ? Math.round((stocktwits.bearishCount / tagged) * 100) : 0,
      neutralPct: 0,
      volume: stocktwits.messages.length,
      weight: stocktwitsContributes(stocktwits) ? SOCIAL_COMPOSITE_WEIGHTS.stocktwits : 0,
      note: stocktwitsContributes(stocktwits) ? undefined : "No tagged sentiment; excluded from the composite",
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
    available: newsContributes(news),
    bullishPct: totalNews > 0 ? Math.round((posNews / totalNews) * 100) : 0,
    bearishPct: totalNews > 0 ? Math.round((negNews / totalNews) * 100) : 0,
    neutralPct: totalNews > 0 ? Math.round(((totalNews - posNews - negNews) / totalNews) * 100) : 0,
    volume: totalNews,
    weight: newsContributes(news) ? SOCIAL_COMPOSITE_WEIGHTS.news : 0,
    note: newsContributes(news) ? undefined : "No tagged news sentiment; excluded from the composite",
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
      weight: SOCIAL_COMPOSITE_WEIGHTS.reddit,
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

export function computeCompositeScore(
  stocktwits: StockTwitsData | null,
  news: TickerNewsArticle[],
  redditPosts: RedditPost[]
): { score: number | null; bullishPct: number | null; bearishPct: number | null; overallSentimentScore: number | null } {
  let weightedScore = 0;
  let totalWeight = 0;

  if (stocktwitsContributes(stocktwits) && stocktwits) {
    weightedScore += stocktwits.sentimentScore * SOCIAL_COMPOSITE_WEIGHTS.stocktwits;
    totalWeight += SOCIAL_COMPOSITE_WEIGHTS.stocktwits;
  }

  if (newsContributes(news)) {
    const pos = news.filter(n => n.sentiment === "positive").length;
    const neg = news.filter(n => n.sentiment === "negative").length;
    const newsScore = (pos - neg) / (pos + neg);
    weightedScore += newsScore * SOCIAL_COMPOSITE_WEIGHTS.news;
    totalWeight += SOCIAL_COMPOSITE_WEIGHTS.news;
  }

  if (redditContributes(redditPosts)) {
    const highScore = redditPosts.filter(p => p.score > 100).length;
    const redditScore = (highScore / redditPosts.length) * 2 - 1;
    weightedScore += redditScore * SOCIAL_COMPOSITE_WEIGHTS.reddit;
    totalWeight += SOCIAL_COMPOSITE_WEIGHTS.reddit;
  }

  if (totalWeight === 0) {
    return { score: null, bullishPct: null, bearishPct: null, overallSentimentScore: null };
  }

  const normalizedScore = Math.round((weightedScore / totalWeight) * 100) / 100;
  const compositeScore = Math.round((normalizedScore + 1) * 50);

  let bullPct: number | null = null;
  let bearPct: number | null = null;
  if (stocktwitsContributes(stocktwits) && stocktwits) {
    const tagged = stocktwits.bullishCount + stocktwits.bearishCount;
    bullPct = Math.round((stocktwits.bullishCount / tagged) * 100);
    bearPct = 100 - bullPct;
  } else if (newsContributes(news)) {
    const pos = news.filter(n => n.sentiment === "positive").length;
    const neg = news.filter(n => n.sentiment === "negative").length;
    bullPct = Math.round((pos / (pos + neg)) * 100);
    bearPct = 100 - bullPct;
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
    dataSource: socialDataSourceLabel({
      newsCount: newsRaw.length,
      yahooListingCount: trendingSymbols.length + mostActiveRaw.length,
      chartQuoteCount: trendingQuotes.size,
    }),
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
  const synthesis = buildObservedSocialSynthesis(symbol, stocktwits, news, redditPosts);

  // Social volume
  const socialVolume = (stocktwits?.messages.length ?? 0) + news.length + redditPosts.length;

  // Social momentum from trends
  const socialMomentum = "unknown" as const;

  const result: MultiSourceSocialData = {
    symbol: symbol.toUpperCase(),
    assetType,
    socialIntelligenceScore: score,
    overallSentiment: overallSentimentScore == null ? "UNAVAILABLE" : sentimentToLabel(overallSentimentScore),
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

export async function getVerifiedSocialSnapshot(
  symbol: string,
  assetType: "stock" | "crypto"
): Promise<VerifiedSocialSnapshot> {
  const cacheKey = `${symbol.toUpperCase()}_${assetType}`;
  const cached = verifiedSocialSnapshotCache.get(cacheKey);
  if (cached && Date.now() - cached.time < TICKER_CACHE_TTL_MS) return cached.data;

  const [stocktwits, news, redditPosts] = await Promise.all([
    fetchStockTwitsData(symbol, assetType),
    fetchTickerNews(symbol),
    fetchRedditPosts(symbol, assetType),
  ]);
  const sources = buildSourceAttribution(stocktwits, news, redditPosts, assetType);
  const composite = computeCompositeScore(stocktwits, news, redditPosts);
  const sourceCount = sources.filter(source => source.available).length;
  const socialVolume = (stocktwits?.messages.length ?? 0) + news.length + redditPosts.length;
  const result: VerifiedSocialSnapshot = {
    symbol: symbol.toUpperCase(),
    assetType,
    sources,
    sourceCount,
    socialVolume,
    newsCount: news.length,
    sentimentScore: composite.overallSentimentScore,
    positiveNews: news.filter(article => article.sentiment === "positive").length,
    negativeNews: news.filter(article => article.sentiment === "negative").length,
    extremeAttentionDetected: sourceCount >= 2 && socialVolume >= 75 && (composite.overallSentimentScore ?? -1) >= 0.7,
    fetchedAt: Date.now(),
  };
  verifiedSocialSnapshotCache.set(cacheKey, { data: result, time: Date.now() });
  return result;
}

/**
 * Returns a previously verified social snapshot without initiating provider calls.
 * Discovery surfaces use this to keep a market-data request bounded; a missing
 * snapshot is intentionally treated as unavailable and excluded from scoring.
 */
export function getCachedVerifiedSocialSnapshot(
  symbol: string,
  assetType: "stock" | "crypto"
): VerifiedSocialSnapshot | null {
  const cached = verifiedSocialSnapshotCache.get(`${symbol.toUpperCase()}_${assetType}`);
  return cached && Date.now() - cached.time < TICKER_CACHE_TTL_MS ? cached.data : null;
}

export function clearTickerSocialCache(symbol?: string): void {
  if (symbol) {
    tickerSocialCache.delete(`${symbol.toUpperCase()}_stock`);
    tickerSocialCache.delete(`${symbol.toUpperCase()}_crypto`);
    verifiedSocialSnapshotCache.delete(`${symbol.toUpperCase()}_stock`);
    verifiedSocialSnapshotCache.delete(`${symbol.toUpperCase()}_crypto`);
  } else {
    tickerSocialCache.clear();
    verifiedSocialSnapshotCache.clear();
  }
}
