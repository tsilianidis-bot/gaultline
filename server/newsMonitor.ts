// FAULTLINE — News Monitor (server/newsMonitor.ts)
//
// Polls Polygon.io for major financial headlines, scores them
// for macro significance via LLM, and triggers breaking alerts
// when a headline scores 8+ out of 10.
//
// Cooldown: max 1 breaking alert per 2 hours to prevent spam.
// ============================================================

import { invokeLLM } from "./_core/llm";
import { log } from "./logger";

// ── Types ────────────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  keywords?: string[];
}

export interface ScoredHeadline {
  article: NewsArticle;
  score: number;       // 1–10 macro significance
  reason: string;      // why it scored this way
  isBreaking: boolean; // score >= 8
}

// ── Cooldown tracking ─────────────────────────────────────────
// In-memory — resets on server restart. Good enough for 2hr window.

let lastBreakingAlertAt: number | null = null;
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

// Track processed article IDs to avoid re-processing
const processedIds = new Set<string>();
const MAX_PROCESSED_IDS = 500; // prevent unbounded growth

export function isOnCooldown(): boolean {
  if (!lastBreakingAlertAt) return false;
  return Date.now() - lastBreakingAlertAt < COOLDOWN_MS;
}

export function setCooldown(): void {
  lastBreakingAlertAt = Date.now();
}

export function getCooldownRemainingMinutes(): number {
  if (!lastBreakingAlertAt) return 0;
  const remaining = COOLDOWN_MS - (Date.now() - lastBreakingAlertAt);
  return Math.max(0, Math.ceil(remaining / 60000));
}

// ── Fetch recent news from Polygon.io ────────────────────────

export async function fetchRecentNews(limit = 20): Promise<NewsArticle[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    log.warn(`[NewsMonitor] POLYGON_API_KEY not set, skipping news fetch`);
    return [];
  }

  // Fetch news from the last 30 minutes
  const publishedAfter = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const url = `https://api.polygon.io/v2/reference/news?limit=${limit}&order=desc&sort=published_utc&published_utc.gte=${publishedAfter}&apiKey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      log.warn(`[NewsMonitor] Polygon news fetch failed: ${res.status}`);
      return [];
    }
    const data = await res.json() as { results?: NewsArticle[] };
    return data.results ?? [];
  } catch (err) {
    log.warn(`[NewsMonitor] Error fetching news: ${err}`);
    return [];
  }
}

// ── Score headlines for macro significance ───────────────────

export async function scoreHeadlines(articles: NewsArticle[]): Promise<ScoredHeadline[]> {
  if (articles.length === 0) return [];

  // Filter out already-processed articles
  const newArticles = articles.filter(a => !processedIds.has(a.id));
  if (newArticles.length === 0) {
    log.info("[NewsMonitor] All articles already processed");
    return [];
  }

  // Mark as processed
  newArticles.forEach(a => {
    processedIds.add(a.id);
    if (processedIds.size > MAX_PROCESSED_IDS) {
      // Remove oldest entries (first inserted)
      const first = processedIds.values().next().value;
      if (first) processedIds.delete(first);
    }
  });

  const headlineList = newArticles
    .map((a, i) => `${i + 1}. [${a.id}] ${a.title}${a.description ? ` — ${a.description.slice(0, 100)}` : ""}`)
    .join("\n");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a macro risk analyst. Score each headline for systemic macro significance on a scale of 1–10.

SCORING GUIDE:
9–10: Immediate systemic impact — Fed emergency action, major bank failure, circuit breaker triggered, sovereign default, war escalation affecting markets
8: High macro significance — CPI/PCE surprise, FOMC decision, major earnings miss with systemic implications, credit event, large bank stress
7: Notable macro event — jobs report, GDP revision, major policy change, significant geopolitical development
5–6: Moderate market relevance — sector news, individual company earnings, minor policy updates
3–4: Low macro relevance — routine corporate news, minor economic data
1–2: Not macro relevant — individual stock moves, product launches, non-financial news

Focus on SYSTEMIC and MACRO implications, not just market moves.

Return JSON array with objects: { "id": string, "score": number, "reason": string }`,
        },
        {
          role: "user",
          content: `Score these headlines:\n\n${headlineList}\n\nReturn only the JSON array.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "headline_scores",
          strict: true,
          schema: {
            type: "object",
            properties: {
              scores: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    score: { type: "number" },
                    reason: { type: "string" },
                  },
                  required: ["id", "score", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["scores"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const raw = typeof rawContent === "string" ? rawContent : null;
    if (!raw) return [];

    const parsed = JSON.parse(raw) as { scores: { id: string; score: number; reason: string }[] };
    const scoreMap = new Map(parsed.scores.map(s => [s.id, s]));

    return newArticles.map(article => {
      const scored = scoreMap.get(article.id);
      const score = scored?.score ?? 0;
      return {
        article,
        score,
        reason: scored?.reason ?? "Not scored",
        isBreaking: score >= 8,
      };
    });
  } catch (err) {
    log.warn(`[NewsMonitor] Error scoring headlines: ${err}`);
    return newArticles.map(a => ({ article: a, score: 0, reason: "Scoring failed", isBreaking: false }));
  }
}

// ── Get the top breaking headline (if any) ───────────────────

export async function getBreakingHeadline(): Promise<ScoredHeadline | null> {
  if (isOnCooldown()) {
    log.info(`[NewsMonitor] On cooldown — ${getCooldownRemainingMinutes()} min remaining`);
    return null;
  }

  const articles = await fetchRecentNews(20);
  if (articles.length === 0) return null;

  const scored = await scoreHeadlines(articles);
  const breaking = scored
    .filter(s => s.isBreaking)
    .sort((a, b) => b.score - a.score);

  if (breaking.length === 0) {
    log.info("[NewsMonitor] No breaking headlines found");
    return null;
  }

  log.info(`[NewsMonitor] Breaking headline: "${breaking[0].article.title}" (score: ${breaking[0].score})`);
  return breaking[0];
}
