/**
 * Analytics domain router
 * Handles all analytics dashboard queries: pageviews, sessions, events, UTM campaigns.
 * Extracted from server/routers.ts for maintainability.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { pageViews, analyticsSessions, siteEvents, visitorProfiles } from "../../drizzle/schema";
import { sql, gte, desc, count, isNotNull } from "drizzle-orm";

export const analyticsRouter = router({
  // Overview: total pageviews, sessions, unique visitors, bounce rate, avg duration
  getOverview: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(365).default(30),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const since = new Date(Date.now() - input.days * 86400000);

      const [pvRow] = await db.select({ total: count() }).from(pageViews).where(gte(pageViews.createdAt, since));
      const [sessRow] = await db.select({ total: count() }).from(analyticsSessions).where(gte(analyticsSessions.startedAt, since));
      const [evtRow] = await db.select({ total: count() }).from(siteEvents).where(gte(siteEvents.createdAt, since));

      const sessStats = await db.select({
        bounces: sql<number>`SUM(isBounce)`,
        totalSess: count(),
        avgDuration: sql<number>`AVG(durationSecs)`,
      }).from(analyticsSessions).where(gte(analyticsSessions.startedAt, since));

      const s = sessStats[0];
      const bounceRate = s.totalSess > 0 ? Math.round((Number(s.bounces) / Number(s.totalSess)) * 100) : 0;
      const avgDuration = Math.round(Number(s.avgDuration) || 0);

      return {
        pageViews: Number(pvRow.total),
        sessions: Number(sessRow.total),
        events: Number(evtRow.total),
        bounceRate,
        avgDurationSecs: avgDuration,
        days: input.days,
      };
    }),

  // Top pages by view count
  getTopPages: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const since = new Date(Date.now() - input.days * 86400000);
      return db.select({
        path: pageViews.path,
        views: sql<number>`COUNT(*)`,
        uniqueSessions: sql<number>`COUNT(DISTINCT sessionId)`,
      })
        .from(pageViews)
        .where(gte(pageViews.createdAt, since))
        .groupBy(pageViews.path)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(input.limit);
    }),

  // Device breakdown
  getDevices: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const since = new Date(Date.now() - input.days * 86400000);
      const [devices, browsers, os] = await Promise.all([
        db.select({ deviceType: pageViews.deviceType, count: sql<number>`COUNT(*)` })
          .from(pageViews).where(gte(pageViews.createdAt, since))
          .groupBy(pageViews.deviceType).orderBy(desc(sql`COUNT(*)`)),
        db.select({ browser: pageViews.browser, count: sql<number>`COUNT(*)` })
          .from(pageViews).where(gte(pageViews.createdAt, since))
          .groupBy(pageViews.browser).orderBy(desc(sql`COUNT(*)`)),
        db.select({ os: pageViews.os, count: sql<number>`COUNT(*)` })
          .from(pageViews).where(gte(pageViews.createdAt, since))
          .groupBy(pageViews.os).orderBy(desc(sql`COUNT(*)`)),
      ]);
      return { devices, browsers, os };
    }),

  // Country breakdown
  getCountries: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const since = new Date(Date.now() - input.days * 86400000);
      return db.select({ country: pageViews.country, count: sql<number>`COUNT(*)` })
        .from(pageViews).where(gte(pageViews.createdAt, since))
        .groupBy(pageViews.country).orderBy(desc(sql`COUNT(*)`)).limit(input.limit);
    }),

  // Referrer / traffic sources
  getReferrers: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const since = new Date(Date.now() - input.days * 86400000);
      return db.select({ referrer: analyticsSessions.referrer, count: sql<number>`COUNT(*)` })
        .from(analyticsSessions)
        .where(gte(analyticsSessions.startedAt, since))
        .groupBy(analyticsSessions.referrer)
        .orderBy(desc(sql`COUNT(*)`)).limit(input.limit);
    }),

  // Custom events breakdown
  getEvents: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30), limit: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const since = new Date(Date.now() - input.days * 86400000);
      return db.select({ eventName: siteEvents.eventName, count: sql<number>`COUNT(*)`, uniqueSessions: sql<number>`COUNT(DISTINCT sessionId)` })
        .from(siteEvents).where(gte(siteEvents.createdAt, since))
        .groupBy(siteEvents.eventName).orderBy(desc(sql`COUNT(*)`)).limit(input.limit);
    }),

  // Daily pageview time series for chart
  getTimeSeries: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const since = new Date(Date.now() - input.days * 86400000);
      const [pvSeries, sessSeries] = await Promise.all([
        db.select({
          date: sql<string>`DATE(createdAt)`,
          views: sql<number>`COUNT(*)`,
        }).from(pageViews).where(gte(pageViews.createdAt, since))
          .groupBy(sql`DATE(createdAt)`).orderBy(sql`DATE(createdAt)`),
        db.select({
          date: sql<string>`DATE(startedAt)`,
          sessions: sql<number>`COUNT(*)`,
        }).from(analyticsSessions).where(gte(analyticsSessions.startedAt, since))
          .groupBy(sql`DATE(startedAt)`).orderBy(sql`DATE(startedAt)`),
      ]);
      return { pageViews: pvSeries, sessions: sessSeries };
    }),

  // Recent visitor sessions list
  getSessions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return db.select().from(analyticsSessions)
        .orderBy(desc(analyticsSessions.startedAt))
        .limit(input.limit).offset(input.offset);
    }),

  // Country + city breakdown from visitorProfiles (richer than pageViews)
  getCountriesWithCities: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const countries = await db.select({
        country: visitorProfiles.country,
        countryName: visitorProfiles.countryName,
        visitors: sql<number>`COUNT(*)`,
        totalVisits: sql<number>`SUM(visitCount)`,
      })
        .from(visitorProfiles)
        .groupBy(visitorProfiles.country, visitorProfiles.countryName)
        .orderBy(desc(sql`COUNT(*)`)).limit(input.limit);

      const cities = await db.select({
        country: visitorProfiles.country,
        city: visitorProfiles.city,
        region: visitorProfiles.region,
        visitors: sql<number>`COUNT(*)`,
      })
        .from(visitorProfiles)
        .groupBy(visitorProfiles.country, visitorProfiles.city, visitorProfiles.region)
        .orderBy(desc(sql`COUNT(*)`)).limit(50);

      return { countries, cities };
    }),

  // Visitor stats: new vs returning, total unique visitors
  getVisitorStats: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const since = new Date(Date.now() - input.days * 86400000);

      const [totalRow] = await db.select({ total: count() }).from(visitorProfiles);
      const [activeRow] = await db.select({ active: count() }).from(visitorProfiles)
        .where(gte(visitorProfiles.lastSeenAt, since));
      const [newRow] = await db.select({ newVisitors: count() }).from(visitorProfiles)
        .where(gte(visitorProfiles.firstSeenAt, since));
      const [convertedRow] = await db.select({ converted: sql<number>`SUM(converted)` }).from(visitorProfiles);

      const total = Number(totalRow.total);
      const active = Number(activeRow.active);
      const newVisitors = Number(newRow.newVisitors);
      const returning = active - newVisitors;
      const converted = Number(convertedRow.converted) || 0;

      // Avg visits per visitor
      const [avgRow] = await db.select({ avg: sql<number>`AVG(visitCount)` }).from(visitorProfiles);
      const avgVisits = Math.round((Number(avgRow.avg) || 1) * 10) / 10;

      return {
        totalUniqueVisitors: total,
        activeInPeriod: active,
        newVisitors,
        returningVisitors: Math.max(0, returning),
        converted,
        avgVisitsPerVisitor: avgVisits,
        days: input.days,
      };
    }),

  // Paginated visitor profiles list
  getVisitorProfiles: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().default(0),
      country: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const conditions = input.country
        ? [sql`country = ${input.country}`]
        : [];

      const rows = await db.select().from(visitorProfiles)
        .where(conditions.length ? conditions[0] : undefined)
        .orderBy(desc(visitorProfiles.lastSeenAt))
        .limit(input.limit).offset(input.offset);

      const [totalRow] = await db.select({ total: count() }).from(visitorProfiles)
        .where(conditions.length ? conditions[0] : undefined);

      return { visitors: rows, total: Number(totalRow.total) };
    }),

  // UTM campaign performance
  getCampaigns: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const since = new Date(Date.now() - input.days * 86400000);
      return db.select({
        utmSource: analyticsSessions.utmSource,
        utmMedium: analyticsSessions.utmMedium,
        utmCampaign: analyticsSessions.utmCampaign,
        sessions: sql<number>`COUNT(*)`,
        avgDuration: sql<number>`AVG(durationSecs)`,
        bounceRate: sql<number>`ROUND(SUM(isBounce)/COUNT(*)*100,1)`,
      })
        .from(analyticsSessions)
        .where(gte(analyticsSessions.startedAt, since))
        .groupBy(analyticsSessions.utmSource, analyticsSessions.utmMedium, analyticsSessions.utmCampaign)
        .orderBy(desc(sql`COUNT(*)`)).limit(20);
    }),
});
