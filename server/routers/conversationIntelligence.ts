/**
 * Conversation Intelligence Admin Router
 * All procedures are admin-only.
 * Provides analytics, conversation logs, gap analysis, business intelligence,
 * export, and privacy/retention controls.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { conversationLogs, conversationMessages, topicClusters, featureRequests, conversationRetentionPolicy } from "../../drizzle/schema";
import { eq, sql, and, gte, lte, like, desc, asc } from "drizzle-orm";
import {
  getExecutiveSummary,
  getWeeklyTrend,
  getTopTopics,
  getGapAnalysis,
  getBusinessIntelligence,
  enforceRetentionPolicy,
} from "../conversationLogger";

export const conversationIntelligenceRouter = router({

  // ── Executive Dashboard ────────────────────────────────────────────────────

  getExecutiveSummary: adminProcedure.query(async () => {
    try {
      return await getExecutiveSummary();
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch executive summary", cause: err });
    }
  }),

  getWeeklyTrend: adminProcedure.query(async () => {
    try {
      return await getWeeklyTrend();
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch weekly trend", cause: err });
    }
  }),

  // ── Conversation Log ──────────────────────────────────────────────────────

  getConversationLogs: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(25),
      search: z.string().optional(),
      userTier: z.enum(["free", "core", "premium", "founding", "anonymous", "all"]).default("all"),
      module: z.string().optional(),
      dateFrom: z.string().optional(), // ISO date string
      dateTo: z.string().optional(),
      sortBy: z.enum(["startedAt", "messageCount", "avgConfidenceScore"]).default("startedAt"),
      sortDir: z.enum(["asc", "desc"]).default("desc"),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { rows: [], total: 0, page: input.page, pageSize: input.pageSize };

        const offset = (input.page - 1) * input.pageSize;

        // Build WHERE conditions
        const conditions: string[] = [];
        const params: any[] = [];

        if (input.search) {
          conditions.push("(topics LIKE ? OR sessionId LIKE ?)");
          params.push(`%${input.search}%`, `%${input.search}%`);
        }
        if (input.userTier !== "all") {
          conditions.push("userTier = ?");
          params.push(input.userTier);
        }
        if (input.module) {
          conditions.push("module = ?");
          params.push(input.module);
        }
        if (input.dateFrom) {
          conditions.push("startedAt >= ?");
          params.push(input.dateFrom);
        }
        if (input.dateTo) {
          conditions.push("startedAt <= ?");
          params.push(input.dateTo);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const orderCol = input.sortBy === "startedAt" ? "startedAt" : input.sortBy === "messageCount" ? "messageCount" : "avgConfidenceScore";
        const orderDir = input.sortDir === "asc" ? "ASC" : "DESC";

        const [rowsResult, countResult] = await Promise.all([
          db.execute(sql.raw(`
            SELECT id, sessionId, userId, userTier, module, pagePath, topics, messageCount,
                   avgResponseTimeMs, avgConfidenceScore, hasQualityFlag, startedAt, endedAt
            FROM conversationLogs
            ${where}
            ORDER BY ${orderCol} ${orderDir}
            LIMIT ${input.pageSize} OFFSET ${offset}
          `)),
          db.execute(sql.raw(`SELECT COUNT(*) as total FROM conversationLogs ${where}`)),
        ]);

        const rows = ((rowsResult as any[])[0] as any[]) ?? [];
        const countRows = ((countResult as any[])[0] as any[]) ?? [];
        const total = Number(countRows?.[0]?.total ?? 0);

        return { rows, total, page: input.page, pageSize: input.pageSize };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch conversation logs", cause: err });
      }
    }),

  getConversationDetail: adminProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return null;

        const [conv] = await db.select().from(conversationLogs)
          .where(eq(conversationLogs.id, input.conversationId))
          .limit(1);

        if (!conv) return null;

        const messages = await db.select().from(conversationMessages)
          .where(eq(conversationMessages.conversationId, input.conversationId))
          .orderBy(asc(conversationMessages.timestamp));

        return { conversation: conv, messages };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch conversation detail", cause: err });
      }
    }),

  deleteConversation: adminProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(conversationMessages).where(eq(conversationMessages.conversationId, input.conversationId));
        await db.delete(conversationLogs).where(eq(conversationLogs.id, input.conversationId));
        return { success: true };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete conversation", cause: err });
      }
    }),

  // ── Question Analytics ────────────────────────────────────────────────────

  getTopTopics: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      try {
        return await getTopTopics(input.limit);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch top topics", cause: err });
      }
    }),

  getQuestionStats: adminProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) return { totalQuestions: 0, uniqueTopics: 0, avgConfidence: 0, unansweredCount: 0, featureRequestCount: 0 };

      const [result] = await db.execute(sql`
        SELECT
          COUNT(*) as totalQuestions,
          COUNT(DISTINCT topicClusterKey) as uniqueTopics,
          AVG(confidenceScore) as avgConfidence
        FROM conversationMessages
        WHERE role = 'user'
      `);
      const [unansweredResult] = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM topicClusters WHERE isUnanswered = 1
      `);
      const [featureResult] = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM featureRequests
      `);

      const row = ((result as unknown) as any[])?.[0] ?? {};
      const unanswered = ((unansweredResult as unknown) as any[])?.[0] ?? {};
      const features = ((featureResult as unknown) as any[])?.[0] ?? {};

      return {
        totalQuestions: Number(row.totalQuestions ?? 0),
        uniqueTopics: Number(row.uniqueTopics ?? 0),
        avgConfidence: Number(row.avgConfidence ?? 0),
        unansweredCount: Number(unanswered.cnt ?? 0),
        featureRequestCount: Number(features.cnt ?? 0),
      };
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch question stats", cause: err });
    }
  }),

  // ── Gap Analysis ──────────────────────────────────────────────────────────

  getGapAnalysis: adminProcedure.query(async () => {
    try {
      return await getGapAnalysis();
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch gap analysis", cause: err });
    }
  }),

  // ── Business Intelligence ─────────────────────────────────────────────────

  getBusinessIntelligence: adminProcedure.query(async () => {
    try {
      return await getBusinessIntelligence();
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch business intelligence", cause: err });
    }
  }),

  // ── Feature Requests ──────────────────────────────────────────────────────

  getFeatureRequests: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30), status: z.enum(["new", "under_review", "planned", "in_progress", "shipped", "wont_do", "all"]).default("all") }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return [];
        if (input.status === "all") {
          return await db.select().from(featureRequests).orderBy(desc(featureRequests.priorityScore)).limit(input.limit);
        }
        return await db.select().from(featureRequests)
          .where(eq(featureRequests.status, input.status as any))
          .orderBy(desc(featureRequests.priorityScore))
          .limit(input.limit);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch feature requests", cause: err });
      }
    }),

  updateFeatureRequestStatus: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "under_review", "planned", "in_progress", "shipped", "wont_do"]),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false };
        await db.update(featureRequests)
          .set({ status: input.status as any })
          .where(eq(featureRequests.id, input.id));
        return { success: true };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update feature request", cause: err });
      }
    }),

  // ── Privacy & Retention ───────────────────────────────────────────────────

  getRetentionPolicy: adminProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) return null;
      const [policy] = await db.select().from(conversationRetentionPolicy).limit(1);
      return policy ?? null;
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch retention policy", cause: err });
    }
  }),

  updateRetentionPolicy: adminProcedure
    .input(z.object({
      retentionDays: z.number().min(0).max(3650),
      loggingEnabled: z.boolean(),
      anonymizeOnExpiry: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { success: false };
        const [existing] = await db.select({ id: conversationRetentionPolicy.id }).from(conversationRetentionPolicy).limit(1);
        if (existing) {
          await db.update(conversationRetentionPolicy)
            .set({
              retentionDays: input.retentionDays,
              loggingEnabled: input.loggingEnabled,
              anonymizeOnExpiry: input.anonymizeOnExpiry ?? true,
            })
            .where(eq(conversationRetentionPolicy.id, existing.id));
        } else {
          await db.insert(conversationRetentionPolicy).values({
            retentionDays: input.retentionDays,
            loggingEnabled: input.loggingEnabled,
            anonymizeOnExpiry: input.anonymizeOnExpiry ?? true,
          });
        }
        return { success: true };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update retention policy", cause: err });
      }
    }),

  runRetentionCleanup: adminProcedure.mutation(async () => {
    try {
      const deleted = await enforceRetentionPolicy();
      return { success: true, deleted };
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to run retention cleanup", cause: err });
    }
  }),

  // ── Export ────────────────────────────────────────────────────────────────

  exportConversations: adminProcedure
    .input(z.object({
      format: z.enum(["json", "csv"]),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      includeMessages: z.boolean().default(false),
      limit: z.number().min(1).max(5000).default(1000),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { data: "", format: input.format, count: 0 };

        const conditions: string[] = [];
        if (input.dateFrom) conditions.push(`startedAt >= '${input.dateFrom}'`);
        if (input.dateTo) conditions.push(`startedAt <= '${input.dateTo}'`);
        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const exportResult = await db.execute(sql.raw(`
          SELECT id, sessionId, userTier, module, pagePath, topics, messageCount,
                 avgResponseTimeMs, avgConfidenceScore, hasQualityFlag, startedAt, endedAt
          FROM conversationLogs
          ${where}
          ORDER BY startedAt DESC
          LIMIT ${input.limit}
        `));

        const rows = ((exportResult as any[])[0] as any[]) ?? [];

        if (input.format === "json") {
          return { data: JSON.stringify(rows, null, 2), format: "json", count: rows.length };
        }

        // CSV format
        if (rows.length === 0) return { data: "", format: "csv", count: 0 };
        const headers = Object.keys(rows[0]).join(",");
        const csvRows = rows.map((r: any) =>
          Object.values(r).map((v: any) => {
            const str = String(v ?? "").replace(/"/g, '""');
            return str.includes(",") || str.includes("\n") ? `"${str}"` : str;
          }).join(",")
        );
        return { data: [headers, ...csvRows].join("\n"), format: "csv", count: rows.length };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to export conversations", cause: err });
      }
    }),

  exportTopics: adminProcedure
    .input(z.object({ format: z.enum(["json", "csv"]).default("csv") }))
    .query(async () => {
      try {
        const topics = await getTopTopics(500);
        return { data: topics, count: topics.length };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to export topics", cause: err });
      }
    }),
});
