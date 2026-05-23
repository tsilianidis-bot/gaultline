import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { classifyTicker, clearClassCache, getClassCacheStats } from "./signalsClassifier";
import { calculateFaultlinePressure } from "./pressure/engine";
import { computeTradingSignals, computeTradingSignal, clearSignalCache } from "./tradingSignals";
import { getDiagnosticReport, clearDiagnosticCache } from "./diagnosticAI";
import { getPositionGuidance, clearGuidanceCache, getGuidanceForTicker } from "./positionGuidance";
import { getPositionsByUser, addPosition, updatePosition, deletePosition } from "./db";
import { getQuotes } from "./yahooProxy";
import { protectedProcedure } from "./_core/trpc";

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
        try {
          return await classifyTicker(input.profile, input.regime);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Signal classification failed", cause: err });
        }
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
        try {
          return computeTradingSignals(input.tickers, input.regime);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Trading signal computation failed", cause: err });
        }
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
        try {
          const { regime, ...tickerInput } = input;
          return computeTradingSignal(tickerInput, regime);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Trading signal computation failed", cause: err });
        }
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
      try {
        return await calculateFaultlinePressure();
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Pressure engine failed", cause: err });
      }
    }),
  }),

  diagnostic: router({
    // Get FAULTLINE Diagnostic AI™ report for a given timeframe
    getReport: publicProcedure
      .input(z.object({
        timeframe: z.enum(["today", "week", "month", "year"]),
      }))
      .query(async ({ input }) => {
        try {
          return await getDiagnosticReport(input.timeframe);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Diagnostic report failed", cause: err });
        }
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
        try {
          return await getPositionGuidance(input?.tickers);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Position guidance failed", cause: err });
        }
      }),

    // Clear guidance cache
    clearCache: publicProcedure.mutation(() => {
      clearGuidanceCache();
      return { success: true };
    }),
  }),

  portfolio: router({
    // Get all positions for the authenticated user
    getPositions: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await getPositionsByUser(ctx.user.id);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to load positions", cause: err });
      }
    }),

    // Add a new position
    addPosition: protectedProcedure
      .input(z.object({
        ticker:    z.string().min(1).max(20).trim().transform(s => s.toUpperCase()),
        name:      z.string().min(1).max(120).trim(),
        shares:    z.number().positive(),
        costBasis: z.number().positive(),
        assetType: z.enum(["Stock", "ETF", "Crypto", "Other"]).default("Stock"),
        notes:     z.string().max(500).optional(),
        openedAt:  z.string().datetime().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          await addPosition({
            userId:    ctx.user.id,
            ticker:    input.ticker,
            name:      input.name,
            shares:    String(input.shares),
            costBasis: String(input.costBasis),
            assetType: input.assetType,
            notes:     input.notes ?? null,
            openedAt:  input.openedAt ? new Date(input.openedAt) : new Date(),
          });
          return { success: true };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to add position", cause: err });
        }
      }),

    // Update an existing position
    updatePosition: protectedProcedure
      .input(z.object({
        id:        z.number().int().positive(),
        ticker:    z.string().min(1).max(20).trim().transform(s => s.toUpperCase()).optional(),
        name:      z.string().min(1).max(120).trim().optional(),
        shares:    z.number().positive().optional(),
        costBasis: z.number().positive().optional(),
        assetType: z.enum(["Stock", "ETF", "Crypto", "Other"]).optional(),
        notes:     z.string().max(500).nullable().optional(),
        openedAt:  z.string().datetime().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const { id, ...fields } = input;
          const data: Record<string, unknown> = {};
          if (fields.ticker    !== undefined) data.ticker    = fields.ticker;
          if (fields.name      !== undefined) data.name      = fields.name;
          if (fields.shares    !== undefined) data.shares    = String(fields.shares);
          if (fields.costBasis !== undefined) data.costBasis = String(fields.costBasis);
          if (fields.assetType !== undefined) data.assetType = fields.assetType;
          if (fields.notes     !== undefined) data.notes     = fields.notes;
          if (fields.openedAt  !== undefined) data.openedAt  = new Date(fields.openedAt);
          await updatePosition(id, ctx.user.id, data as any);
          return { success: true };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update position", cause: err });
        }
      }),

    // Delete a position
    deletePosition: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await deletePosition(input.id, ctx.user.id);
          return { success: true };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete position", cause: err });
        }
      }),

    // Get live portfolio: positions + Yahoo Finance quotes + P&L + AI guidance
    getLivePortfolio: protectedProcedure.query(async ({ ctx }) => {
      try {
        const rows = await getPositionsByUser(ctx.user.id);
        if (rows.length === 0) return { positions: [], summary: null, pressure: null };

        // Fetch live quotes for all tickers
        const tickers = Array.from(new Set(rows.map(r => r.ticker)));
        const quotes = await getQuotes(tickers);
        const quoteMap = new Map(quotes.map(q => [q.ticker, q]));

        // Fetch current FAULTLINE pressure for AI guidance
        const pressure = await calculateFaultlinePressure();

        // Build enriched positions
        const enriched = rows.map(row => {
          const quote = quoteMap.get(row.ticker);
          const shares    = parseFloat(String(row.shares));
          const costBasis = parseFloat(String(row.costBasis));
          const currentPrice = quote?.price ?? null;
          const totalCost    = shares * costBasis;
          const marketValue  = currentPrice != null ? shares * currentPrice : null;
          const unrealizedPnl    = marketValue != null ? marketValue - totalCost : null;
          const unrealizedPnlPct = totalCost > 0 && unrealizedPnl != null
            ? (unrealizedPnl / totalCost) * 100 : null;
          const dayChange    = quote?.change    != null ? shares * quote.change    : null;
          const dayChangePct = quote?.changePercent ?? null;

          return {
            id:            row.id,
            ticker:        row.ticker,
            name:          row.name,
            shares,
            costBasis,
            assetType:     row.assetType,
            notes:         row.notes,
            openedAt:      row.openedAt,
            // Live quote data
            currentPrice,
            prevClose:     quote?.prevClose    ?? null,
            dayHigh:       quote?.high         ?? null,
            dayLow:        quote?.low          ?? null,
            volume:        quote?.volume       ?? null,
            marketState:   quote?.marketState  ?? "UNKNOWN",
            isDelayed:     quote?.isDelayed    ?? true,
            quoteError:    quote?.error        ?? null,
            // P&L
            totalCost,
            marketValue,
            unrealizedPnl,
            unrealizedPnlPct,
            dayChange,
            dayChangePct,
          };
        });

        // Portfolio summary
        const totalCostAll    = enriched.reduce((s, p) => s + p.totalCost, 0);
        const totalValueAll   = enriched.reduce((s, p) => s + (p.marketValue ?? p.totalCost), 0);
        const totalPnl        = totalValueAll - totalCostAll;
        const totalPnlPct     = totalCostAll > 0 ? (totalPnl / totalCostAll) * 100 : 0;
        const totalDayChange  = enriched.reduce((s, p) => s + (p.dayChange ?? 0), 0);

        const summary = {
          totalCost:       totalCostAll,
          totalValue:      totalValueAll,
          totalPnl,
          totalPnlPct,
          totalDayChange,
          positionCount:   enriched.length,
          pressureScore:   pressure.overallPressure,
          pressureRegime:  pressure.regime,
        };

        return { positions: enriched, summary, pressure };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to load live portfolio", cause: err });
      }
    }),

    // Get AI guidance for a single user position (supports any ticker)
    getPositionGuidance: protectedProcedure
      .input(z.object({
        ticker:    z.string().min(1).max(20).transform(s => s.toUpperCase()),
        name:      z.string().min(1).max(120).optional(),
        assetType: z.enum(["Stock", "ETF", "Crypto", "Other"]),
      }))
      .query(async ({ input, ctx }) => {
        try {
          // Look up name from user's positions if not provided
          let name = input.name;
          if (!name) {
            const positions = await getPositionsByUser(ctx.user.id);
            const match = positions.find(p => p.ticker === input.ticker);
            name = match?.name ?? input.ticker;
          }
          return await getGuidanceForTicker(input.ticker, name, input.assetType);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Position guidance failed", cause: err });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
