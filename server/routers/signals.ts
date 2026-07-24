/**
 * signals router — ticker classification and trading signal computation.
 * Extracted from server/routers.ts as part of Stage 5 large-file decomposition.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, coreProcedure } from "../_core/trpc";
import { classifyTicker, clearClassCache, getClassCacheStats } from "../signalsClassifier";
import { computeTradingSignals, computeTradingSignal, clearSignalCache } from "../tradingSignals";

export const signalsRouter = router({
  // Classify any ticker with FAULTLINE signal labels using LLM + regime context
  classifyTicker: publicProcedure
    .input(z.object({
      ticker: z.string().min(1).max(10).trim().regex(/^[A-Za-z0-9.\-]+$/).transform(s => s.toUpperCase()),
      regime: z.object({
        label: z.string(),
        score: z.number().min(0).max(10),
        description: z.string().optional(),
      }),
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
      try {
        return await classifyTicker(input.profile, input.regime);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Signal classification failed", cause: err });
      }
    }),
  // Get stock info (sector, industry, description) for a ticker
  getStockInfo: publicProcedure
    .input(z.object({
      ticker: z.string().min(1).max(10).trim().transform(s => s.toUpperCase()),
    }))
    .query(async ({ input }) => {
      try {
        const apiKey = process.env.POLYGON_API_KEY ?? "";
        const refUrl = `https://api.polygon.io/v3/reference/tickers/${input.ticker}?apiKey=${apiKey}`;
        const refRes = await fetch(refUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
        if (!refRes || !refRes.ok) return { sector: null, industry: null, description: null };
        const refData = await refRes.json() as { results?: { sic_description?: string; description?: string; sector?: string; industry?: string } };
        const r = refData.results ?? {};
        return {
          sector: r.sector ?? null,
          industry: r.sic_description ?? r.industry ?? null,
          description: r.description ?? null,
        };
      } catch (err) {
        return { sector: null, industry: null, description: null };
      }
    }),
  // Clear the classification cache (admin utility)
  clearCache: protectedProcedure.mutation(() => {
    clearClassCache();
    return { success: true };
  }),
  // Get classification cache stats
  cacheStats: publicProcedure.query(() => {
    return getClassCacheStats();
  }),
  // Compute trading signals (BUY/SELL/HOLD) for a batch of tickers
  // Uses mutation (POST) to avoid 414 URI Too Large with large sparkline payloads
  getTradingSignals: coreProcedure
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
      try {
        return computeTradingSignals(input.tickers, input.regime);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Trading signal computation failed", cause: err });
      }
    }),
  // Compute trading signal for a single ticker
  getTradingSignal: coreProcedure
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
      try {
        const { regime, ...tickerInput } = input;
        return computeTradingSignal(tickerInput, regime);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Trading signal computation failed", cause: err });
      }
    }),
  // Clear the trading signal cache
  clearSignalCache: protectedProcedure.mutation(() => {
    clearSignalCache();
    return { success: true };
  }),
});
