/**
 * server/socialIntelligence.ts
 * Social Intelligence data layer for FAULTLINE.
 *
 * Data sources (no fabricated values):
 *   - Polygon.io /v2/reference/news  → per-ticker news + AI sentiment scores
 *   - Yahoo Finance /v1/finance/trending/US → live trending tickers
 *   - Yahoo Finance screener most_actives   → highest-volume movers
 *   - Yahoo Finance screener day_gainers / day_losers → momentum movers
 *
 * All sentiment scores are derived from Polygon's "insights" field which
 * contains ticker-level sentiment ("positive" | "neutral" | "negative") and
 * reasoning text generated from the article content.
 */

import { log } from "./logger";
import { captureError } from "./errorTracking";

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
  /** Sentiment derived from recent Polygon news articles */
  sentiment: "bullish" | "bearish" | "neutral" | "unknown";
  /** 0–100 composite buzz score (news volume × sentiment weight) */
  buzzScore: number;
  /** Number of news articles in last 24h */
  newsCount: number;
  /** Most recent news headline */
  latestHeadline: string | null;
}

export interface SentimentSummary {
  ticker: string;
  name: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalArticles: number;
  /** -1.0 to +1.0 */
  sentimentScore: number;
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

// ── Cache ─────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedData: SocialIntelligenceData | null = null;
let cacheTime = 0;

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

/** Convert Polygon insight sentiment to buzz weight */
function sentimentWeight(s: "positive" | "neutral" | "negative"): number {
  if (s === "positive") return 1;
  if (s === "negative") return 1;
  return 0.5;
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

// ── Main Fetch ────────────────────────────────────────────────

export async function getSocialIntelligenceData(): Promise<SocialIntelligenceData> {
  if (cachedData && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedData;
  }

  log.info("[SocialIntel] Fetching fresh social intelligence data…");

  // Parallel fetches
  const [trendingSymbols, mostActiveRaw, gainersRaw, newsRaw] = await Promise.all([
    fetchYahooTrending(),
    fetchYahooScreener("most_actives", 15),
    fetchYahooScreener("day_gainers", 10),
    fetchPolygonNews(undefined, 50),
  ]);

  // Enrich trending symbols with quotes
  const trendingQuotes = await enrichWithQuotes(trendingSymbols.slice(0, 15));

  // ── Build sentiment map from Polygon news ──────────────────
  // ticker → { bullish, bearish, neutral, articles, latestHeadline, latestPublished }
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

  // ── Build trending tickers ─────────────────────────────────
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

    // Buzz score: log-scaled news count × sentiment intensity
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

  // ── Build most active ──────────────────────────────────────
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

  // ── Build sentiment leaderboard ────────────────────────────
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

  // ── Build latest news ──────────────────────────────────────
  const latestNews: NewsArticle[] = newsRaw.slice(0, 30).map((item) => {
    // Find the primary ticker's sentiment from insights
    const primaryTicker = item.tickers?.[0] ?? null;
    const primaryInsight = item.insights?.find((i) => i.ticker === primaryTicker);
    const sentiment = primaryInsight
      ? insightSentimentToDirection(primaryInsight.sentiment)
      : "unknown";
    const sentimentReasoning = primaryInsight?.sentiment_reasoning ?? "";

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
      sentimentReasoning,
      primaryTicker,
    };
  });

  // ── Build narrative clusters ───────────────────────────────
  const narrativeClusters = buildNarrativeClusters(newsRaw);

  const result: SocialIntelligenceData = {
    trendingTickers,
    sentimentLeaderboard,
    latestNews,
    narrativeClusters,
    mostActive,
    fetchedAt: Date.now(),
    dataSource: "Polygon.io News API + Yahoo Finance Trending/Screener",
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
