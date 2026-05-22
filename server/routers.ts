import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { classifyTicker, clearClassCache, getClassCacheStats } from "./signalsClassifier";
import { calculateFaultlinePressure } from "./pressure/engine";
import { computeTradingSignals, computeTradingSignal, clearSignalCache } from "./tradingSignals";
import { getDiagnosticReport, clearDiagnosticCache } from "./diagnosticAI";
import { getPositionGuidance, clearGuidanceCache } from "./positionGuidance";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  signals: router({
    // Classify any ticker with FAULTLINE signal labels using LLM + regime context
    classifyTicker: publicProcedure
      .input(z.object({
        ticker: z.string().min(1).max(10).trim().regex(/^[A-Za-z0-9.\-]+$/).transform(s => s.toUpperCase()),
        regime: z.object({
          label: z.string(),
          score: z.number().min(0).max(10),
          description: z.string().optional(),
        }),
        // Pass the ticker profile from the frontend (already fetched via /api/signals/ticker/:symbol)
        profile: z.object({
          ticker: z.string(),
          name: z.string(),
          price: z.number(),
          open: z.number(),
          high: z.number(),
          low: z.number(),
          changePercent: z.number(),
          volume: z.number(),
          volumeMillions: z.number(),
          avgVolume: z.number().nullable(),
          marketCap: z.number().nullable(),
          sector: z.string().nullable(),
          industry: z.string().nullable(),
          description: z.string().nullable(),
          sparkline: z.array(z.number()),
          tradeDate: z.string(),
          marketStatus: z.enum(["open", "closed", "extended", "unknown"]),
          isLive: z.boolean(),
          source: z.enum(["live", "stale", "fallback"]),
        }),
      }))
      .mutation(async ({ input }) => {
        return classifyTicker(input.profile, input.regime);
      }),

    // Clear the classification cache (admin utility)
    clearCache: publicProcedure.mutation(() => {
      clearClassCache();
      return { success: true };
    }),

    // Get classification cache stats
    cacheStats: publicProcedure.query(() => {
      return getClassCacheStats();
    }),

    // Compute trading signals (BUY/SELL/HOLD) for a batch of tickers
    // Uses mutation (POST) to avoid 414 URI Too Large with large sparkline payloads
    getTradingSignals: publicProcedure
      .input(z.object({
        tickers: z.array(z.object({
          ticker: z.string().min(1).max(10),
          price: z.number(),
          open: z.number(),
          high: z.number(),
          low: z.number(),
          changePercent: z.number(),
          volumeMillions: z.number(),
          avgVolume: z.number(),
          sparkline: z.array(z.number()),
          relativeStrength: z.number().min(0).max(100),
          dailyBars: z.array(z.object({
            close: z.number(),
            open: z.number(),
            high: z.number(),
            low: z.number(),
            volume: z.number(),
            timestamp: z.number(),
          })).optional(),
        })).max(50),
        regime: z.object({
          label: z.string(),
          score: z.number().min(0).max(10),
        }),
      }))
      .mutation(({ input }) => {
        return computeTradingSignals(input.tickers, input.regime);
      }),

    // Compute trading signal for a single ticker
    getTradingSignal: publicProcedure
      .input(z.object({
        ticker: z.string().min(1).max(10),
        price: z.number(),
        open: z.number(),
        high: z.number(),
        low: z.number(),
        changePercent: z.number(),
        volumeMillions: z.number(),
        avgVolume: z.number(),
        sparkline: z.array(z.number()),
        relativeStrength: z.number().min(0).max(100),
        dailyBars: z.array(z.object({
          close: z.number(),
          open: z.number(),
          high: z.number(),
          low: z.number(),
          volume: z.number(),
          timestamp: z.number(),
        })).optional(),
        regime: z.object({
          label: z.string(),
          score: z.number().min(0).max(10),
        }),
      }))
      .mutation(({ input }) => {
        const { regime, ...tickerInput } = input;
        return computeTradingSignal(tickerInput, regime);
      }),

    // Clear the trading signal cache
    clearSignalCache: publicProcedure.mutation(() => {
      clearSignalCache();
      return { success: true };
    }),
  }),

  pressure: router({
    // Get the current FAULTLINE Pressure Index with all risk vectors
    getCurrentPressure: publicProcedure.query(async () => {
      return calculateFaultlinePressure();
    }),
  }),

  diagnostic: router({
    // Get FAULTLINE Diagnostic AI™ report for a given timeframe
    getReport: publicProcedure
      .input(z.object({
        timeframe: z.enum(["today", "week", "month", "year"]),
      }))
      .query(async ({ input }) => {
        return getDiagnosticReport(input.timeframe);
      }),

    // Clear diagnostic cache
    clearCache: publicProcedure.mutation(() => {
      clearDiagnosticCache();
      return { success: true };
    }),
  }),

  guidance: router({
    // Get FAULTLINE Position Guidance™ for demo assets
    getGuidance: publicProcedure
      .input(z.object({
        tickers: z.array(z.string().min(1).max(10)).optional(),
      }).optional())
      .query(async ({ input }) => {
        return getPositionGuidance(input?.tickers);
      }),

    // Clear guidance cache
    clearCache: publicProcedure.mutation(() => {
      clearGuidanceCache();
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
