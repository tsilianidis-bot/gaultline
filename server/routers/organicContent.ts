import { z } from "zod";
import { eq, desc, and, gte, lte, count, sql, isNull, isNotNull } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { organicContent, signalPages, contentCtaClicks, pageViews } from "../../drizzle/schema";
import { generateOrganicContent, generateSignalPage, TRACKED_STOCKS, TRACKED_CRYPTO, type ContentType } from "../organicContentEngine";
import { TRPCError } from "@trpc/server";

export const organicContentRouter = router({

  // ── Public: get published organic content list ─────────────────────────────
  listPublished: publicProcedure
    .input(z.object({
      contentType: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions = [eq(organicContent.status, "published")];
      if (input.contentType) {
        conditions.push(eq(organicContent.contentType, input.contentType));
      }

      const items = await db.select({
        id: organicContent.id,
        contentType: organicContent.contentType,
        slug: organicContent.slug,
        title: organicContent.title,
        metaDescription: organicContent.metaDescription,
        wordCount: organicContent.wordCount,
        qualityScore: organicContent.qualityScore,
        pressureScore: organicContent.pressureScore,
        regime: organicContent.regime,
        publishedAt: organicContent.publishedAt,
      })
        .from(organicContent)
        .where(and(...conditions))
        .orderBy(desc(organicContent.publishedAt))
        .limit(input.limit)
        .offset(input.offset);

      const [{ total }] = await db.select({ total: count() })
        .from(organicContent)
        .where(and(...conditions));

      return { items, total };
    }),

  // ── Public: get single organic content by slug ─────────────────────────────
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [item] = await db.select()
        .from(organicContent)
        .where(and(
          eq(organicContent.slug, input.slug),
          eq(organicContent.status, "published")
        ))
        .limit(1);

      return item ?? null;
    }),

  // ── Public: get signal page data for a symbol ──────────────────────────────
  getSignalPage: publicProcedure
    .input(z.object({ symbol: z.string().max(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [page] = await db.select()
        .from(signalPages)
        .where(eq(signalPages.symbol, input.symbol.toUpperCase()))
        .limit(1);

      return page ?? null;
    }),

  // ── Public: list all signal pages ─────────────────────────────────────────
  listSignalPages: publicProcedure
    .input(z.object({
      assetType: z.enum(["stock", "crypto"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input.assetType) {
        conditions.push(eq(signalPages.assetType, input.assetType));
      }

      return db.select({
        symbol: signalPages.symbol,
        assetType: signalPages.assetType,
        name: signalPages.name,
        signalLabel: signalPages.signalLabel,
        confidenceScore: signalPages.confidenceScore,
        lastPrice: signalPages.lastPrice,
        dailyChangePct: signalPages.dailyChangePct,
        regime: signalPages.regime,
        lastUpdatedAt: signalPages.lastUpdatedAt,
      })
        .from(signalPages)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(signalPages.assetType, signalPages.symbol);
    }),

  // ── Public: track CTA click ────────────────────────────────────────────────
  trackCtaClick: publicProcedure
    .input(z.object({
      pageSlug: z.string().max(300),
      ctaType: z.enum(["start_free", "demo", "pricing", "related_tool"]),
      visitorId: z.string().max(64).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { ok: false };

      await db.insert(contentCtaClicks).values({
        pageSlug: input.pageSlug,
        ctaType: input.ctaType,
        visitorId: input.visitorId ?? null,
        userId: ctx.user?.id ?? null,
      });

      return { ok: true };
    }),

  // ── Admin: get full content intelligence dashboard ─────────────────────────
  adminDashboard: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return null;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Content counts by status
      const statusCounts = await db.select({
        status: organicContent.status,
        total: count(),
      })
        .from(organicContent)
        .groupBy(organicContent.status);

      // Content counts by type
      const typeCounts = await db.select({
        contentType: organicContent.contentType,
        total: count(),
        published: sql<number>`SUM(CASE WHEN ${organicContent.status} = 'published' THEN 1 ELSE 0 END)`,
      })
        .from(organicContent)
        .groupBy(organicContent.contentType);

      // Recent content (last 30 days)
      const recentContent = await db.select({
        id: organicContent.id,
        contentType: organicContent.contentType,
        slug: organicContent.slug,
        title: organicContent.title,
        status: organicContent.status,
        qualityScore: organicContent.qualityScore,
        wordCount: organicContent.wordCount,
        rejectionReason: organicContent.rejectionReason,
        publishedAt: organicContent.publishedAt,
        createdAt: organicContent.createdAt,
      })
        .from(organicContent)
        .where(gte(organicContent.createdAt, thirtyDaysAgo))
        .orderBy(desc(organicContent.createdAt))
        .limit(50);

      // Signal pages status
      const signalPagesList = await db.select({
        symbol: signalPages.symbol,
        assetType: signalPages.assetType,
        name: signalPages.name,
        signalLabel: signalPages.signalLabel,
        confidenceScore: signalPages.confidenceScore,
        lastUpdatedAt: signalPages.lastUpdatedAt,
      })
        .from(signalPages)
        .orderBy(signalPages.assetType, signalPages.symbol);

      // CTA performance (last 30 days)
      const ctaStats = await db.select({
        ctaType: contentCtaClicks.ctaType,
        total: count(),
      })
        .from(contentCtaClicks)
        .where(gte(contentCtaClicks.createdAt, thirtyDaysAgo))
        .groupBy(contentCtaClicks.ctaType);

      // Top pages by CTA clicks
      const topCtaPages = await db.select({
        pageSlug: contentCtaClicks.pageSlug,
        total: count(),
      })
        .from(contentCtaClicks)
        .where(gte(contentCtaClicks.createdAt, thirtyDaysAgo))
        .groupBy(contentCtaClicks.pageSlug)
        .orderBy(desc(count()))
        .limit(10);

      // Orphan content (published but no CTA clicks in 7 days)
      const publishedSlugs = recentContent
        .filter(c => c.status === "published")
        .map(c => `/intelligence/${c.slug}`);

      const recentCtaSlugs = topCtaPages.map(p => p.pageSlug);
      const orphanContent = recentContent
        .filter(c => c.status === "published" && !recentCtaSlugs.includes(`/intelligence/${c.slug}`))
        .slice(0, 10);

      // Stale content (published more than 7 days ago, no update)
      const staleContent = await db.select({
        id: organicContent.id,
        contentType: organicContent.contentType,
        slug: organicContent.slug,
        title: organicContent.title,
        publishedAt: organicContent.publishedAt,
      })
        .from(organicContent)
        .where(and(
          eq(organicContent.status, "published"),
          lte(organicContent.publishedAt, sevenDaysAgo)
        ))
        .orderBy(organicContent.publishedAt)
        .limit(10);

      // Tracked symbols not yet generated
      const generatedSymbols = signalPagesList.map(s => s.symbol);
      const missingStocks = TRACKED_STOCKS.filter(s => !generatedSymbols.includes(s.symbol));
      const missingCrypto = TRACKED_CRYPTO.filter(s => !generatedSymbols.includes(s.symbol));

      return {
        summary: {
          totalContent: statusCounts.reduce((sum, s) => sum + s.total, 0),
          published: statusCounts.find(s => s.status === "published")?.total ?? 0,
          draft: statusCounts.find(s => s.status === "draft")?.total ?? 0,
          rejected: statusCounts.find(s => s.status === "rejected")?.total ?? 0,
          signalPagesGenerated: signalPagesList.length,
          signalPagesTotal: TRACKED_STOCKS.length + TRACKED_CRYPTO.length,
          totalCtaClicks: ctaStats.reduce((sum, s) => sum + s.total, 0),
        },
        typeCounts,
        recentContent,
        signalPages: signalPagesList,
        ctaStats,
        topCtaPages,
        orphanContent,
        staleContent,
        missingSymbols: { stocks: missingStocks, crypto: missingCrypto },
      };
    }),

  // ── Admin: manually trigger content generation ─────────────────────────────
  adminGenerateContent: adminProcedure
    .input(z.object({
      contentType: z.enum([
        "daily_market_brief", "weekly_market_outlook", "crypto_market_outlook",
        "ai_sector_outlook", "federal_reserve_watch", "liquidity_report",
        "volatility_report", "pressure_index_report", "market_regime_report",
        "historical_analog_report"
      ]),
    }))
    .mutation(async ({ input }) => {
      const result = await generateOrganicContent(input.contentType as ContentType);
      return result;
    }),

  // ── Admin: manually trigger signal page refresh for a symbol ──────────────
  adminRefreshSignalPage: adminProcedure
    .input(z.object({
      symbol: z.string().max(20),
      assetType: z.enum(["stock", "crypto"]),
      name: z.string().max(128),
    }))
    .mutation(async ({ input }) => {
      const result = await generateSignalPage(input.symbol, input.assetType, input.name);
      return result;
    }),

  // ── Admin: delete content ──────────────────────────────────────────────────
  adminDeleteContent: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(organicContent).where(eq(organicContent.id, input.id));
      return { ok: true };
    }),
});
