/**
 * FAULTLINE — ASHA Memory Router
 * User-facing procedures that power the ASHA Intelligence Center.
 * Returns the current user's conversation history, market thesis,
 * topics discussed, symbols analyzed, and ASHA-generated follow-up questions.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { conversationLogs, conversationMessages } from "../../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sevenDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

// ── Router ───────────────────────────────────────────────────────────────────

export const ashaMemoryRouter = router({

  /**
   * Returns today's conversation messages for the current user,
   * grouped by conversation session, newest first.
   */
  getTodayConversation: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return { conversations: [], totalMessages: 0 };

      // Get today's conversation logs for this user
      const logs = await db
        .select()
        .from(conversationLogs)
        .where(
          and(
            eq(conversationLogs.userId, ctx.user.id),
            gte(conversationLogs.startedAt, todayStart())
          )
        )
        .orderBy(desc(conversationLogs.startedAt))
        .limit(20);

      if (logs.length === 0) return { conversations: [], totalMessages: 0 };

      // Fetch messages for each conversation
      const conversations = await Promise.all(
        logs.map(async (log) => {
          const messages = await db
            .select()
            .from(conversationMessages)
            .where(eq(conversationMessages.conversationId, log.id))
            .orderBy(conversationMessages.timestamp)
            .limit(50);
          return {
            id: log.id,
            sessionId: log.sessionId,
            module: log.module,
            topics: log.topics ? log.topics.split(",").filter(Boolean) : [],
            symbols: log.symbolsMentioned ? log.symbolsMentioned.split(",").filter(Boolean) : [],
            messageCount: log.messageCount,
            startedAt: log.startedAt,
            endedAt: log.endedAt,
            messages: messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              confidenceScore: m.confidenceScore,
              topicClusterKey: m.topicClusterKey,
              symbolsMentioned: m.symbolsMentioned ? m.symbolsMentioned.split(",").filter(Boolean) : [],
            })),
          };
        })
      );

      const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
      return { conversations, totalMessages };
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch today's conversation", cause: err });
    }
  }),

  /**
   * Returns the last 7 days of conversation activity for the current user.
   * Used for the Intelligence Timeline.
   */
  getIntelligenceTimeline: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return { entries: [] };

      const logs = await db
        .select()
        .from(conversationLogs)
        .where(
          and(
            eq(conversationLogs.userId, ctx.user.id),
            gte(conversationLogs.startedAt, sevenDaysAgo())
          )
        )
        .orderBy(desc(conversationLogs.startedAt))
        .limit(50);

      // For each log, get the first user message (the question) and first assistant message (the answer)
      const entries = await Promise.all(
        logs.map(async (log) => {
          const messages = await db
            .select()
            .from(conversationMessages)
            .where(eq(conversationMessages.conversationId, log.id))
            .orderBy(conversationMessages.timestamp)
            .limit(4);

          const userMsg = messages.find((m) => m.role === "user");
          const assistantMsg = messages.find((m) => m.role === "assistant");

          return {
            id: log.id,
            question: userMsg?.content?.slice(0, 200) ?? null,
            answerSummary: assistantMsg?.content?.slice(0, 300) ?? null,
            topics: log.topics ? log.topics.split(",").filter(Boolean) : [],
            symbols: log.symbolsMentioned ? log.symbolsMentioned.split(",").filter(Boolean) : [],
            confidenceScore: log.avgConfidenceScore,
            startedAt: log.startedAt,
            module: log.module,
          };
        })
      );

      return { entries: entries.filter((e) => e.question) };
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch intelligence timeline", cause: err });
    }
  }),

  /**
   * Returns all unique symbols the user has discussed with ASHA in the last 7 days.
   */
  getRecentSymbols: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return { symbols: [] };

      const logs = await db
        .select({ symbolsMentioned: conversationLogs.symbolsMentioned, startedAt: conversationLogs.startedAt })
        .from(conversationLogs)
        .where(
          and(
            eq(conversationLogs.userId, ctx.user.id),
            gte(conversationLogs.startedAt, sevenDaysAgo())
          )
        )
        .orderBy(desc(conversationLogs.startedAt))
        .limit(100);

      // Aggregate symbols with frequency
      const symbolCount: Record<string, { count: number; lastSeen: Date }> = {};
      for (const log of logs) {
        if (!log.symbolsMentioned) continue;
        const syms = log.symbolsMentioned.split(",").filter(Boolean);
        for (const sym of syms) {
          const s = sym.trim().toUpperCase();
          if (!s) continue;
          if (!symbolCount[s]) symbolCount[s] = { count: 0, lastSeen: log.startedAt };
          symbolCount[s].count++;
          if (log.startedAt > symbolCount[s].lastSeen) symbolCount[s].lastSeen = log.startedAt;
        }
      }

      const symbols = Object.entries(symbolCount)
        .map(([symbol, data]) => ({ symbol, count: data.count, lastSeen: data.lastSeen }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      return { symbols };
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch recent symbols", cause: err });
    }
  }),

  /**
   * Returns all unique topics the user has discussed with ASHA in the last 7 days.
   */
  getRecentTopics: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return { topics: [] };

      const logs = await db
        .select({ topics: conversationLogs.topics, startedAt: conversationLogs.startedAt })
        .from(conversationLogs)
        .where(
          and(
            eq(conversationLogs.userId, ctx.user.id),
            gte(conversationLogs.startedAt, sevenDaysAgo())
          )
        )
        .orderBy(desc(conversationLogs.startedAt))
        .limit(100);

      const topicCount: Record<string, number> = {};
      for (const log of logs) {
        if (!log.topics) continue;
        const topics = log.topics.split(",").filter(Boolean);
        for (const t of topics) {
          const key = t.trim();
          if (!key) continue;
          topicCount[key] = (topicCount[key] ?? 0) + 1;
        }
      }

      const topics = Object.entries(topicCount)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      return { topics };
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch recent topics", cause: err });
    }
  }),

  /**
   * Uses ASHA to synthesize the user's current market thesis based on
   * their recent conversation history. Returns a 2-3 sentence synthesis.
   */
  synthesizeMarketThesis: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return { thesis: null, generatedAt: new Date() };

      // Get recent user questions (last 7 days)
      const logs = await db
        .select()
        .from(conversationLogs)
        .where(
          and(
            eq(conversationLogs.userId, ctx.user.id),
            gte(conversationLogs.startedAt, sevenDaysAgo())
          )
        )
        .orderBy(desc(conversationLogs.startedAt))
        .limit(15);

      if (logs.length === 0) return { thesis: null, generatedAt: new Date() };

      // Collect user questions
      const questions: string[] = [];
      for (const log of logs.slice(0, 8)) {
        const msgs = await db
          .select({ content: conversationMessages.content, role: conversationMessages.role })
          .from(conversationMessages)
          .where(
            and(
              eq(conversationMessages.conversationId, log.id),
              eq(conversationMessages.role, "user")
            )
          )
          .limit(2);
        for (const m of msgs) {
          if (m.content) questions.push(m.content.slice(0, 200));
        }
      }

      if (questions.length === 0) return { thesis: null, generatedAt: new Date() };

      const allTopics = logs
        .map((l) => l.topics ?? "")
        .join(",")
        .split(",")
        .filter(Boolean)
        .slice(0, 20)
        .join(", ");

      const allSymbols = logs
        .map((l) => l.symbolsMentioned ?? "")
        .join(",")
        .split(",")
        .filter(Boolean)
        .map((s) => s.trim().toUpperCase())
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 10)
        .join(", ");

      const prompt = `You are ASHA, the continuously active intelligence layer of FAULTLINE. Based on the following questions a user has asked you over the past 7 days, synthesize their current market thesis in 2-3 sentences. Write in first person as if you are describing what you understand about their current market perspective. Be specific, evidence-based, and institutional in tone. Do not use generic language.

User's recent questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Topics discussed: ${allTopics || "general market conditions"}
Symbols analyzed: ${allSymbols || "none specified"}

Write a 2-3 sentence synthesis of their current market thesis. Start with "Based on our recent discussions..."`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are ASHA, the intelligence layer of FAULTLINE. You synthesize market understanding from conversation history. Be concise, institutional, and specific." },
          { role: "user", content: prompt },
        ],
      });

      const rawThesis = response.choices?.[0]?.message?.content;
      const thesis = typeof rawThesis === 'string' ? rawThesis.trim() : null;
      return { thesis, generatedAt: new Date() };
    } catch (err) {
      // Non-fatal — return null thesis gracefully
      return { thesis: null, generatedAt: new Date() };
    }
  }),

  /**
   * Generates follow-up questions ASHA would suggest based on the user's
   * most recent conversation.
   */
  getFollowUpQuestions: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return { questions: [] };

      // Get the most recent conversation
      const [latestLog] = await db
        .select()
        .from(conversationLogs)
        .where(eq(conversationLogs.userId, ctx.user.id))
        .orderBy(desc(conversationLogs.startedAt))
        .limit(1);

      if (!latestLog) return { questions: [] };

      const messages = await db
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, latestLog.id))
        .orderBy(conversationMessages.timestamp)
        .limit(10);

      if (messages.length === 0) return { questions: [] };

      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");

      if (!lastUserMsg || !lastAssistantMsg) return { questions: [] };

      const prompt = `You are ASHA, the intelligence layer of FAULTLINE. Based on this recent exchange, generate exactly 4 follow-up questions that would deepen the user's market understanding. Each question should be specific, actionable, and build naturally on the conversation. Return as a JSON array of strings.

User asked: ${lastUserMsg.content.slice(0, 300)}
ASHA responded: ${lastAssistantMsg.content.slice(0, 400)}

Return exactly this format: ["question 1", "question 2", "question 3", "question 4"]`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are ASHA. Generate follow-up questions as a JSON array. Return only the JSON array, nothing else." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "follow_up_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const content = typeof rawContent === 'string' ? rawContent : null;
      if (!content) return { questions: [] };

      try {
        const parsed = JSON.parse(content);
        const questions = (parsed.questions ?? []).slice(0, 4) as string[];
        return { questions };
      } catch {
        return { questions: [] };
      }
    } catch (err) {
      return { questions: [] };
    }
  }),

  /**
   * Returns a summary of what changed in the market since the user's last visit.
   * Compares current regime/pressure state to what was discussed last session.
   */
  getWhatChangedSummary: protectedProcedure
    .input(z.object({
      currentPressureScore: z.number(),
      currentRegime: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) return { summary: null };

        // Get the most recent conversation before today
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const [lastLog] = await db
          .select()
          .from(conversationLogs)
          .where(eq(conversationLogs.userId, ctx.user.id))
          .orderBy(desc(conversationLogs.startedAt))
          .limit(1);

        if (!lastLog) return { summary: null };

        const daysSince = Math.floor((Date.now() - lastLog.startedAt.getTime()) / (1000 * 60 * 60 * 24));
        const topics = lastLog.topics ? lastLog.topics.split(",").filter(Boolean).slice(0, 5).join(", ") : "general market conditions";
        const symbols = lastLog.symbolsMentioned ? lastLog.symbolsMentioned.split(",").filter(Boolean).slice(0, 5).join(", ") : null;

        // Get last user question for context
        const [lastUserMsg] = await db
          .select({ content: conversationMessages.content })
          .from(conversationMessages)
          .where(
            and(
              eq(conversationMessages.conversationId, lastLog.id),
              eq(conversationMessages.role, "user")
            )
          )
          .orderBy(desc(conversationMessages.timestamp))
          .limit(1);

        const prompt = `You are ASHA, the continuously active intelligence layer of FAULTLINE. The user last spoke with you ${daysSince === 0 ? "earlier today" : `${daysSince} day${daysSince > 1 ? "s" : ""} ago`}. Write 2 sentences describing what has continued to develop since their last visit. Be specific about the current market regime (${input.currentRegime}) and pressure level (${input.currentPressureScore.toFixed(1)}/10). Reference the topics they were discussing: ${topics}${symbols ? `. Symbols they were watching: ${symbols}` : ""}${lastUserMsg ? `. Their last question was: "${lastUserMsg.content.slice(0, 150)}"` : ""}. Start with "Since we last spoke..."`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are ASHA. Write a 2-sentence update on what has developed since the user's last visit. Be specific and institutional." },
            { role: "user", content: prompt },
          ],
        });

        const rawSummary = response.choices?.[0]?.message?.content;
        const summary = typeof rawSummary === 'string' ? rawSummary.trim() : null;
        return { summary, lastVisit: lastLog.startedAt, daysSince };
      } catch (err) {
        return { summary: null };
      }
    }),

  /**
   * Returns aggregate stats for the ASHA Intelligence Center header.
   */
  getSessionStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return { totalQuestions: 0, totalSessions: 0, uniqueSymbols: 0, uniqueTopics: 0, firstSession: null };

      const [stats] = await db.execute(sql.raw(`
        SELECT
          COUNT(DISTINCT id) as totalSessions,
          SUM(messageCount) as totalMessages,
          MIN(startedAt) as firstSession
        FROM conversationLogs
        WHERE userId = ${ctx.user.id}
      `)) as any;

      const rows = (stats as any[]) ?? [];
      const row = rows[0] ?? {};

      // Count unique symbols
      const symbolLogs = await db
        .select({ symbolsMentioned: conversationLogs.symbolsMentioned })
        .from(conversationLogs)
        .where(eq(conversationLogs.userId, ctx.user.id));

      const uniqueSymbols = new Set<string>();
      for (const log of symbolLogs) {
        if (log.symbolsMentioned) {
          log.symbolsMentioned.split(",").filter(Boolean).forEach((s) => uniqueSymbols.add(s.trim().toUpperCase()));
        }
      }

      // Count unique topics
      const topicLogs = await db
        .select({ topics: conversationLogs.topics })
        .from(conversationLogs)
        .where(eq(conversationLogs.userId, ctx.user.id));

      const uniqueTopics = new Set<string>();
      for (const log of topicLogs) {
        if (log.topics) {
          log.topics.split(",").filter(Boolean).forEach((t) => uniqueTopics.add(t.trim()));
        }
      }

      return {
        totalSessions: Number(row.totalSessions ?? 0),
        totalQuestions: Math.floor(Number(row.totalMessages ?? 0) / 2), // divide by 2 for user messages only
        uniqueSymbols: uniqueSymbols.size,
        uniqueTopics: uniqueTopics.size,
        firstSession: row.firstSession ? new Date(row.firstSession) : null,
      };
    } catch (err) {
      return { totalQuestions: 0, totalSessions: 0, uniqueSymbols: 0, uniqueTopics: 0, firstSession: null };
    }
  }),
});
