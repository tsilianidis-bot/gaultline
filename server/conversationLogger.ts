/**
 * Conversation Intelligence Logger
 * Captures every Ask Intelligence interaction for admin analytics.
 * Non-blocking — all writes are fire-and-forget to avoid impacting response latency.
 */

import { getDb } from "./db";
import { conversationLogs, conversationMessages, topicClusters, featureRequests, conversationRetentionPolicy } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LogConversationParams {
  sessionId: string;
  userId?: number;
  userTier?: "free" | "core" | "premium" | "founding" | "anonymous";
  module?: string;
  pagePath?: string;
}

export interface LogMessageParams {
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  responseTimeMs?: number;
  confidenceScore?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract ticker symbols from text (e.g. AAPL, BTC, NVDA) */
function extractSymbols(text: string): string[] {
  const matches = text.match(/\b([A-Z]{1,5})\b/g) ?? [];
  const stopWords = new Set(["I", "A", "AN", "THE", "IN", "ON", "AT", "TO", "FOR", "OF", "AND", "OR", "BUT", "IS", "IT", "BE", "DO", "GO", "US", "UK", "EU", "AI", "ML", "IF", "AS", "UP", "MY", "NO", "SO", "BY", "AM", "PM", "EST", "PST", "UTC"]);
  return Array.from(new Set(matches.filter(m => !stopWords.has(m) && m.length >= 2))).slice(0, 10);
}

/** Check if conversation logging is enabled */
async function isLoggingEnabled(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return true;
    const [policy] = await db.select({ loggingEnabled: conversationRetentionPolicy.loggingEnabled })
      .from(conversationRetentionPolicy)
      .limit(1);
    return policy?.loggingEnabled ?? true;
  } catch {
    return true;
  }
}

/** Compute retention expiry timestamp based on policy */
async function getRetentionExpiry(): Promise<Date | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [policy] = await db.select({ retentionDays: conversationRetentionPolicy.retentionDays })
      .from(conversationRetentionPolicy)
      .limit(1);
    const days = policy?.retentionDays ?? 90;
    if (days === 0) return null;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  } catch {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 90);
    return expiry;
  }
}

// ── Core Logging Functions ────────────────────────────────────────────────────

/**
 * Start a conversation session.
 * Returns the conversation ID for subsequent message logging.
 */
export async function startConversation(params: LogConversationParams): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return -1;
    const retentionExpiry = await getRetentionExpiry();
    const [result] = await db.insert(conversationLogs).values({
      sessionId: params.sessionId,
      userId: params.userId ?? null,
      userTier: params.userTier ?? "anonymous",
      module: params.module ?? null,
      pagePath: params.pagePath ?? null,
      retentionExpiresAt: retentionExpiry ?? undefined,
    });
    return (result as any).insertId as number;
  } catch (err) {
    console.error("[ConvLogger] Failed to start conversation:", err);
    return -1;
  }
}

/**
 * Log a single message (user question or assistant response).
 * Fire-and-forget — does not block the response.
 */
export async function logMessage(params: LogMessageParams): Promise<void> {
  try {
    const enabled = await isLoggingEnabled();
    if (!enabled) return;

    const db = await getDb();
    if (!db) return;

    const symbols = extractSymbols(params.content);
    const truncated = params.content.slice(0, 4000);

    await db.insert(conversationMessages).values({
      conversationId: params.conversationId,
      role: params.role,
      content: truncated,
      responseTimeMs: params.responseTimeMs ?? null,
      confidenceScore: params.confidenceScore ?? null,
      symbolsMentioned: symbols.length > 0 ? symbols.join(",") : null,
    });

    // Update conversation message count
    await db.update(conversationLogs)
      .set({ messageCount: sql`messageCount + 1` })
      .where(eq(conversationLogs.id, params.conversationId));

    // Async: extract topics for user messages (non-blocking)
    if (params.role === "user") {
      extractAndClusterTopic(params.conversationId, truncated, params.confidenceScore).catch(() => {});
    }
  } catch (err) {
    console.error("[ConvLogger] Failed to log message:", err);
  }
}

/**
 * Close a conversation session.
 */
export async function closeConversation(conversationId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.update(conversationLogs)
      .set({ endedAt: new Date() })
      .where(eq(conversationLogs.id, conversationId));
  } catch (err) {
    console.error("[ConvLogger] Failed to close conversation:", err);
  }
}

// ── Topic Extraction & Clustering ─────────────────────────────────────────────

async function extractAndClusterTopic(conversationId: number, question: string, confidence?: number): Promise<void> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a topic classifier for a financial intelligence platform.
Extract the primary topic from the user's question and return JSON with:
- clusterKey: snake_case key (e.g. "bitcoin_outlook", "recession_risk", "nvda_analysis")
- label: human-readable label (e.g. "Bitcoin Outlook", "Recession Risk")
- isFeatureRequest: true if the user is asking for a capability the platform may not have
- featureRequestText: if isFeatureRequest, describe what they want in 1 sentence, else empty string
- symbols: array of ticker symbols mentioned (e.g. ["NVDA", "BTC"])
Keep clusterKey generic enough to group similar questions.`,
        },
        { role: "user", content: question },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "topic_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              clusterKey: { type: "string" },
              label: { type: "string" },
              isFeatureRequest: { type: "boolean" },
              featureRequestText: { type: "string" },
              symbols: { type: "array", items: { type: "string" } },
            },
            required: ["clusterKey", "label", "isFeatureRequest", "featureRequestText", "symbols"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) return;
    const rawStr: string = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const parsed = JSON.parse(rawStr);
    const { clusterKey, label, isFeatureRequest, featureRequestText, symbols } = parsed;

    const db = await getDb();
    if (!db) return;

    // Upsert topic cluster
    await db.execute(sql`
      INSERT INTO topicClusters (clusterKey, label, exampleQuestions, count, lastSeenAt)
      VALUES (${clusterKey}, ${label}, ${JSON.stringify([question.slice(0, 200)])}, 1, NOW())
      ON DUPLICATE KEY UPDATE
        count = count + 1,
        lastSeenAt = NOW(),
        avgConfidence = CASE
          WHEN avgConfidence IS NULL THEN ${confidence ?? null}
          ELSE (avgConfidence * (count - 1) + COALESCE(${confidence ?? null}, avgConfidence)) / count
        END
    `);

    // Update message with topic cluster key
    await db.execute(sql`
      UPDATE conversationMessages
      SET topicClusterKey = ${clusterKey},
          symbolsMentioned = ${symbols.length > 0 ? symbols.join(",") : null}
      WHERE conversationId = ${conversationId}
        AND role = 'user'
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    // Update conversation topics
    await db.execute(sql`
      UPDATE conversationLogs
      SET topics = CASE
        WHEN topics IS NULL THEN ${clusterKey}
        WHEN topics NOT LIKE CONCAT('%', ${clusterKey}, '%') THEN CONCAT(topics, ',', ${clusterKey})
        ELSE topics
      END
      WHERE id = ${conversationId}
    `);

    // Handle feature requests
    if (isFeatureRequest && featureRequestText) {
      const normalized = (featureRequestText as string).toLowerCase().trim().slice(0, 255);
      await db.execute(sql`
        INSERT INTO featureRequests (requestText, normalizedText, count, priorityScore, firstSeenAt, lastSeenAt)
        VALUES (${featureRequestText}, ${normalized}, 1, 1.0, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          count = count + 1,
          priorityScore = count + 1,
          lastSeenAt = NOW()
      `);
    }
  } catch (err) {
    console.error("[ConvLogger] Topic extraction failed:", err);
  }
}

// ── Analytics Query Helpers ───────────────────────────────────────────────────

export interface ConversationSummary {
  totalConversations: number;
  todayConversations: number;
  activeUsers: number;
  avgResponseTimeMs: number;
  avgConfidenceScore: number;
  qualityFlagRate: number;
  topQuestion: string | null;
  trendingTopic: string | null;
}

export async function getExecutiveSummary(): Promise<ConversationSummary> {
  const empty: ConversationSummary = { totalConversations: 0, todayConversations: 0, activeUsers: 0, avgResponseTimeMs: 0, avgConfidenceScore: 0, qualityFlagRate: 0, topQuestion: null, trendingTopic: null };
  try {
    const db = await getDb();
    if (!db) return empty;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalsResult, todayResult, topTopicResult] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) as totalConversations,
          COUNT(DISTINCT userId) as activeUsers,
          AVG(avgResponseTimeMs) as avgResponseTimeMs,
          AVG(avgConfidenceScore) as avgConfidenceScore,
          SUM(CASE WHEN hasQualityFlag = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) as qualityFlagRate
        FROM conversationLogs
      `),
      db.execute(sql`
        SELECT COUNT(*) as todayConversations
        FROM conversationLogs
        WHERE startedAt >= ${todayStart.toISOString()}
      `),
      db.execute(sql`
        SELECT label, clusterKey, count FROM topicClusters ORDER BY count DESC LIMIT 1
      `),
    ]);

    const totalsRows = (totalsResult as any[])[0] as any[];
    const todayRows = (todayResult as any[])[0] as any[];
    const topTopicRows = (topTopicResult as any[])[0] as any[];

    const t = totalsRows?.[0] ?? {};
    const d = todayRows?.[0] ?? {};
    const topic = topTopicRows?.[0];

    let topQuestion: string | null = null;
    if (topic?.clusterKey) {
      const [msgResult] = await db.execute(sql`
        SELECT content FROM conversationMessages
        WHERE role = 'user' AND topicClusterKey = ${topic.clusterKey}
        ORDER BY timestamp DESC LIMIT 1
      `);
      topQuestion = ((msgResult as unknown) as any[])?.[0]?.content ?? null;
    }

    return {
      totalConversations: Number(t.totalConversations ?? 0),
      todayConversations: Number(d.todayConversations ?? 0),
      activeUsers: Number(t.activeUsers ?? 0),
      avgResponseTimeMs: Number(t.avgResponseTimeMs ?? 0),
      avgConfidenceScore: Number(t.avgConfidenceScore ?? 0),
      qualityFlagRate: Number(t.qualityFlagRate ?? 0),
      topQuestion,
      trendingTopic: topic?.label ?? null,
    };
  } catch (err) {
    console.error("[ConvLogger] getExecutiveSummary failed:", err);
    return empty;
  }
}

export async function getWeeklyTrend(): Promise<Array<{ date: string; conversations: number; avgQuality: number }>> {
  try {
    const db = await getDb();
    if (!db) return [];
    const [result] = await db.execute(sql`
      SELECT
        DATE(startedAt) as date,
        COUNT(*) as conversations,
        AVG(avgConfidenceScore) as avgQuality
      FROM conversationLogs
      WHERE startedAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      GROUP BY DATE(startedAt)
      ORDER BY date ASC
    `);
    return (((result as unknown) as any[]) ?? []).map((r: any) => ({
      date: String(r.date),
      conversations: Number(r.conversations),
      avgQuality: Number(r.avgQuality ?? 0),
    }));
  } catch {
    return [];
  }
}

export async function getTopTopics(limit = 20): Promise<Array<{ clusterKey: string; label: string; count: number; trend7d: number; avgConfidence: number | null; isUnanswered: boolean; hasHighFollowUp: boolean }>> {
  try {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(topicClusters)
      .orderBy(sql`count DESC`)
      .limit(limit);
    return rows.map(r => ({
      clusterKey: r.clusterKey,
      label: r.label,
      count: r.count,
      trend7d: r.trend7d,
      avgConfidence: r.avgConfidence,
      isUnanswered: r.isUnanswered,
      hasHighFollowUp: r.hasHighFollowUp,
    }));
  } catch {
    return [];
  }
}

export async function getGapAnalysis(): Promise<Array<{ type: string; description: string; count: number; priority: number; examples: string[] }>> {
  try {
    const db = await getDb();
    if (!db) return [];

    const [lowConfResult, unanswered, featureReqs] = await Promise.all([
      db.execute(sql`
        SELECT topicClusterKey, COUNT(*) as count, AVG(confidenceScore) as avgConf
        FROM conversationMessages
        WHERE role = 'assistant' AND confidenceScore < 45 AND topicClusterKey IS NOT NULL
        GROUP BY topicClusterKey
        ORDER BY count DESC
        LIMIT 10
      `),
      db.select().from(topicClusters)
        .where(eq(topicClusters.isUnanswered, true))
        .orderBy(sql`count DESC`)
        .limit(10),
      db.select().from(featureRequests)
        .orderBy(sql`priorityScore DESC`)
        .limit(10),
    ]);

    const gaps: Array<{ type: string; description: string; count: number; priority: number; examples: string[] }> = [];

    const lowConfRows = (lowConfResult as any[])[0] as any[];
    for (const row of (lowConfRows ?? [])) {
      gaps.push({
        type: "low_confidence",
        description: `Low confidence responses for topic: ${row.topicClusterKey}`,
        count: Number(row.count),
        priority: Number(row.count) * (1 - Number(row.avgConf ?? 50) / 100),
        examples: [],
      });
    }

    for (const topic of unanswered) {
      gaps.push({
        type: "unanswered",
        description: `Frequently unanswered topic: ${topic.label}`,
        count: topic.count,
        priority: topic.count * 1.5,
        examples: topic.exampleQuestions ? JSON.parse(topic.exampleQuestions) : [],
      });
    }

    for (const req of featureReqs) {
      gaps.push({
        type: "feature_request",
        description: req.normalizedText,
        count: req.count,
        priority: req.priorityScore,
        examples: [req.requestText],
      });
    }

    return gaps.sort((a, b) => b.priority - a.priority);
  } catch (err) {
    console.error("[ConvLogger] getGapAnalysis failed:", err);
    return [];
  }
}

export async function getBusinessIntelligence(): Promise<{
  topSymbols: Array<{ symbol: string; count: number }>;
  topFeatureRequests: Array<{ text: string; count: number; status: string; priority: number }>;
  conversionByTopic: Array<{ topic: string; conversationCount: number; upgradeCount: number; conversionRate: number }>;
}> {
  const empty = { topSymbols: [], topFeatureRequests: [], conversionByTopic: [] };
  try {
    const db = await getDb();
    if (!db) return empty;

    const [symbolResult, featureReqs, conversionResult] = await Promise.all([
      db.execute(sql`
        SELECT symbolsMentioned FROM conversationMessages
        WHERE symbolsMentioned IS NOT NULL AND symbolsMentioned != ''
        ORDER BY timestamp DESC LIMIT 1000
      `),
      db.select().from(featureRequests).orderBy(sql`priorityScore DESC`).limit(15),
      db.execute(sql`
        SELECT
          topics,
          COUNT(*) as conversationCount,
          SUM(CASE WHEN upgradedAfter = 1 THEN 1 ELSE 0 END) as upgradeCount
        FROM conversationLogs
        WHERE topics IS NOT NULL
        GROUP BY topics
        ORDER BY conversationCount DESC
        LIMIT 15
      `),
    ]);

    const symbolRows = (symbolResult as any[])[0] as any[];
    const symbolCounts: Record<string, number> = {};
    for (const row of (symbolRows ?? [])) {
      const syms = String(row.symbolsMentioned ?? "").split(",");
      for (const s of syms) {
        const sym = s.trim().toUpperCase();
        if (sym) symbolCounts[sym] = (symbolCounts[sym] ?? 0) + 1;
      }
    }
    const topSymbols = Object.entries(symbolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([symbol, count]) => ({ symbol, count }));

    const conversionRows = (conversionResult as any[])[0] as any[];

    return {
      topSymbols,
      topFeatureRequests: featureReqs.map(r => ({
        text: r.normalizedText,
        count: r.count,
        status: r.status,
        priority: r.priorityScore,
      })),
      conversionByTopic: (conversionRows ?? []).map((r: any) => ({
        topic: String(r.topics ?? "").split(",")[0] ?? "unknown",
        conversationCount: Number(r.conversationCount),
        upgradeCount: Number(r.upgradeCount),
        conversionRate: Number(r.conversationCount) > 0 ? Number(r.upgradeCount) / Number(r.conversationCount) : 0,
      })),
    };
  } catch (err) {
    console.error("[ConvLogger] getBusinessIntelligence failed:", err);
    return empty;
  }
}

/** Enforce retention policy — delete conversations past their expiry */
export async function enforceRetentionPolicy(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;
    const [result] = await db.execute(sql`
      DELETE FROM conversationLogs
      WHERE retentionExpiresAt IS NOT NULL AND retentionExpiresAt < NOW()
    `);
    return (result as any).affectedRows ?? 0;
  } catch (err) {
    console.error("[ConvLogger] enforceRetentionPolicy failed:", err);
    return 0;
  }
}
