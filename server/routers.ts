import { COOKIE_NAME } from "@shared/const";
import { notifyOwner } from "./_core/notification";
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
import { getPositionsByUser, addPosition, updatePosition, deletePosition, getAllUsers,
  getCryptoWatchlist, addCryptoWatchlistItem, removeCryptoWatchlistItem, isCryptoWatchlisted,
  getUserTier, setUserTier, createFoundingRequest, getFoundingRequests, updateFoundingRequestStatus,
  getAllUsersWithTier, getPlatformStats, getActivityFeed,
  getSignupTimeSeries, getWaitlistTimeSeries, getConversionStats,
  getBlogPosts, getBlogPostBySlug, getBlogPostById, createBlogPost, updateBlogPost, deleteBlogPost, getBlogCategories,
  getXPostQueue, getXPostQueueStats,
  getPressureHistory, getPressureHistoryStats,
  getMobileWatchlist, addMobileWatchlistItem, removeMobileWatchlistItem } from "./db";
import { getCryptoIntelligence, clearCryptoCache } from "./cryptoIntelligence";
import { getCryptoIntelligenceResult, computeCryptoSystemicRisk, clearCryptoEngineCache } from "./cryptoEngine";
import { searchCoins, getTopMarkets, getGlobalStats, getCoinMarketData, getCoinOHLC } from "./coingeckoProxy";
import { getQuotes } from "./yahooProxy";
import { runAftershockEngine, getAssetContagionChain, getAllContagionAssets, clearAftershockCache } from "./aftershockEngine";
import { computeCryptoSignal, computeCryptoSignals, clearCryptoSignalCache } from "./cryptoSignals";
import { computeAltRotation, clearAltRotationCache } from "./altRotationEngine";
import { getRecoveryAnalysis, clearRecoveryCache } from "./recoveryEngine";
import { protectedProcedure, coreProcedure } from "./_core/trpc";
import { stripe } from './stripe/client';
import { PLANS } from './stripe/products';
import { generateXPosts } from './xPostGenerator';
import { postTweet, postThread, parseThread } from './xPoster';
import { xPostQueue } from '../drizzle/schema';
import { getDb } from './db';

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,

  billing: router({
    getPlans: publicProcedure.query(() => {
      return Object.values(PLANS).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        amount: p.amount,
        interval: p.interval,
        available: !!p.priceId,
      }));
    }),

    createCheckout: protectedProcedure
      .input(z.object({
        planId: z.enum(['core', 'core_annual', 'premium', 'premium_annual', 'founding', 'lifetime']),
        origin: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = PLANS[input.planId];
        if (!plan.priceId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'This plan is not yet available for purchase. Please contact us.' });
        }
        const session = await stripe.checkout.sessions.create({
          mode: plan.interval === 'one_time' ? 'payment' : 'subscription',
          payment_method_types: ['card'],
          customer_email: ctx.user.email ?? undefined,
          allow_promotion_codes: true,
          line_items: [{ price: plan.priceId, quantity: 1 }],
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            user_id: ctx.user.id.toString(),
            customer_email: ctx.user.email ?? '',
            customer_name: ctx.user.name ?? '',
            plan_id: input.planId,
          },
          success_url: `${input.origin}/app/account?payment=success`,
          cancel_url: `${input.origin}/app/account?payment=cancelled`,
        });
        return { url: session.url };
      }),

    createPortalSession: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user as any;
        if (!user.stripeCustomerId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No billing account found. Please make a purchase first.' });
        }
        const session = await stripe.billingPortal.sessions.create({
          customer: user.stripeCustomerId,
          return_url: `${input.origin}/app/dashboard`,
        });
        return { url: session.url };
      }),
  }),

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
    clearCache: protectedProcedure.mutation(() => {
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
    clearCache: protectedProcedure.mutation(() => {
      clearGuidanceCache();
      return { success: true };
    }),
  }),

  portfolio: router({
    // Get all positions for the authenticated user
    getPositions: coreProcedure.query(async ({ ctx }) => {
      try {
        return await getPositionsByUser(ctx.user.id);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to load positions", cause: err });
      }
    }),

    // Add a new position
    addPosition: coreProcedure
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
    updatePosition: coreProcedure
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
    deletePosition: coreProcedure
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
    getLivePortfolio: coreProcedure.query(async ({ ctx }) => {
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

    // Get AI guidance for a single user position (supports any ticker) — requires premium
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
  crypto: router({
    // Get FAULTLINE Crypto Intelligence™ report (legacy)
    getSignals: protectedProcedure
      .query(async () => {
        try {
          return await getCryptoIntelligence();
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Crypto intelligence failed", cause: err });
        }
      }),

    // Search cryptocurrencies by symbol or name
    search: protectedProcedure
      .input(z.object({ query: z.string().min(1).max(50) }))
      .query(async ({ input }) => {
        try {
          return await searchCoins(input.query);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Crypto search failed", cause: err });
        }
      }),

    // Full intelligence card for a single asset
    getAssetIntelligence: protectedProcedure
      .input(z.object({ idOrSymbol: z.string().min(1).max(50) }))
      .query(async ({ input }) => {
        try {
          const result = await getCryptoIntelligenceResult(input.idOrSymbol);
          if (!result) throw new TRPCError({ code: "NOT_FOUND", message: `Asset not found: ${input.idOrSymbol}` });
          return result;
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Asset intelligence failed", cause: err });
        }
      }),

    // Crypto systemic risk score
    getSystemicRisk: protectedProcedure
      .query(async () => {
        try {
          return await computeCryptoSystemicRisk();
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Systemic risk computation failed", cause: err });
        }
      }),

    // Top 50 markets for heatmap
    getTopMarkets: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
      .query(async ({ input }) => {
        try {
          return await getTopMarkets(input?.limit ?? 50);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Top markets fetch failed", cause: err });
        }
      }),

    // Global market stats
    getGlobalStats: protectedProcedure
      .query(async () => {
        try {
          const stats = await getGlobalStats();
          if (!stats) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Global stats unavailable" });
          return stats;
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Global stats failed", cause: err });
        }
      }),

    // ── Crypto Trading Signals ────────────────────────────────
    // Get trading signal (BUY/SELL/HOLD/WATCH) for a single crypto asset
    getSignal: protectedProcedure
      .input(z.object({ idOrSymbol: z.string().min(1).max(50) }))
      .query(async ({ input }) => {
        try {
          const [market, ohlcBars, globalStats, pressure] = await Promise.all([
            getCoinMarketData(input.idOrSymbol),
            getCoinOHLC(input.idOrSymbol, 30),
            getGlobalStats(),
            calculateFaultlinePressure(),
          ]);
          if (!market) throw new TRPCError({ code: "NOT_FOUND", message: `Asset not found: ${input.idOrSymbol}` });
          const result = computeCryptoSignal({
            market,
            ohlcBars: ohlcBars.length > 0 ? ohlcBars : undefined,
            btcDominance: globalStats?.btcDominance ?? 55,
            regime: { label: pressure.regime, score: pressure.overallPressure },
          });
          return result;
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Crypto signal computation failed", cause: err });
        }
      }),

    // Get trading signals screener for top N crypto assets
    getScreener: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        try {
          const limit = input?.limit ?? 20;
          const [markets, globalStats, pressure] = await Promise.all([
            getTopMarkets(limit),
            getGlobalStats(),
            calculateFaultlinePressure(),
          ]);
          const regime = { label: pressure.regime, score: pressure.overallPressure };
          const btcDominance = globalStats?.btcDominance ?? 55;
          // Compute signals without OHLC for screener speed (sparkline fallback)
          const results = computeCryptoSignals(
            markets.map(m => ({ market: m, btcDominance, regime }))
          );
          return {
            signals: results,
            regime,
            btcDominance,
            totalMarketCap: globalStats?.totalMarketCap ?? 0,
            marketCapChange24h: globalStats?.marketCapChangePercent24h ?? 0,
            computedAt: Date.now(),
          };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Crypto screener failed", cause: err });
        }
      }),

    // Clear all crypto caches
    clearCache: protectedProcedure.mutation(() => {
      clearCryptoCache();
      clearCryptoEngineCache();
      clearCryptoSignalCache();
      return { success: true };
    }),

    // ── Watchlist procedures ──────────────────────────────────
    watchlist: router({
      // List all saved tokens for the current user
      list: protectedProcedure
        .query(async ({ ctx }) => {
          return await getCryptoWatchlist(ctx.user.id);
        }),

      // Add a token to the watchlist
      add: protectedProcedure
        .input(z.object({
          symbol: z.string().min(1).max(20),
          name:   z.string().min(1).max(120),
        }))
        .mutation(async ({ ctx, input }) => {
          const id = await addCryptoWatchlistItem({
            userId: ctx.user.id,
            symbol: input.symbol.toUpperCase(),
            name:   input.name,
          });
          return { success: true, id };
        }),

      // Remove a token from the watchlist
      remove: protectedProcedure
        .input(z.object({ symbol: z.string().min(1).max(20) }))
        .mutation(async ({ ctx, input }) => {
          await removeCryptoWatchlistItem(ctx.user.id, input.symbol);
          return { success: true };
        }),

      // Check if a specific token is watchlisted
      check: protectedProcedure
        .input(z.object({ symbol: z.string().min(1).max(20) }))
        .query(async ({ ctx, input }) => {
          const watchlisted = await isCryptoWatchlisted(ctx.user.id, input.symbol);
          return { watchlisted };
        }),
    }),
  }),
  aftershock: router({
    // Run the full Aftershock Engine™ — detect ruptures and map aftershock chains
    getAnalysis: protectedProcedure
      .query(async () => {
        try {
          return await runAftershockEngine();
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Aftershock Engine failed", cause: err });
        }
      }),

    // Get the contagion chain for a specific asset
    getAssetChain: publicProcedure
      .input(z.object({ symbol: z.string().min(1).max(10) }))
      .query(async ({ input }) => {
        try {
          const edges = getAssetContagionChain(input.symbol.toUpperCase());
          const allAssets = getAllContagionAssets();
          return { symbol: input.symbol.toUpperCase(), edges, allAssets };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Asset chain lookup failed", cause: err });
        }
      }),

    // Clear the aftershock engine cache
    clearCache: protectedProcedure
      .mutation(async () => {
        clearAftershockCache();
        return { success: true };
      }),
  }),

  recovery: router({
    // Get recovery confirmation analysis for a single crypto asset
    getAssetRecovery: protectedProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ input }) => {
        try {
          const sym = input.symbol.toUpperCase();
          const [market, ohlcBars, globalStats, pressure] = await Promise.all([
            getCoinMarketData(sym),
            getCoinOHLC(sym, 30).catch(() => []),
            getGlobalStats().catch(() => null),
            calculateFaultlinePressure().catch(() => null),
          ]);
          if (!market) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Asset not found: ${sym}` });
          }
          const btcDominance = globalStats?.btcDominance ?? undefined;
          return getRecoveryAnalysis({
            symbol: sym,
            name: market.name,
            market,
            ohlcBars: ohlcBars.length > 0 ? ohlcBars : undefined,
            btcDominance,
            pressure,
            isCrypto: true,
          });
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          const msg = err instanceof Error ? err.message : String(err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
        }
      }),

    // Get recovery analysis for the overall crypto market (using BTC as proxy)
    getMarketRecovery: protectedProcedure
      .query(async () => {
        try {
          const [market, ohlcBars, globalStats, pressure] = await Promise.all([
            getCoinMarketData("BTC"),
            getCoinOHLC("BTC", 30).catch(() => []),
            getGlobalStats().catch(() => null),
            calculateFaultlinePressure().catch(() => null),
          ]);
          if (!market) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch BTC market data" });
          }
          const btcDominance = globalStats?.btcDominance ?? undefined;
          return getRecoveryAnalysis({
            symbol: "BTC",
            name: "Bitcoin",
            market,
            ohlcBars: ohlcBars.length > 0 ? ohlcBars : undefined,
            btcDominance,
            pressure,
            isCrypto: true,
          });
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          const msg = err instanceof Error ? err.message : String(err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
        }
      }),

    // Clear the recovery engine cache
    clearCache: protectedProcedure
      .mutation(async () => {
        clearRecoveryCache();
        return { success: true };
      }),
  }),

  // ── User profile & tier procedures ──────────────────────────────────
  user: router({
    // Get current user profile including access tier
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      try {
        const tier = await getUserTier(ctx.user.id);
        return {
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
          role: ctx.user.role,
          accessTier: tier,
          loginMethod: ctx.user.loginMethod,
          createdAt: ctx.user.createdAt,
          lastSignedIn: ctx.user.lastSignedIn,
        };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch profile", cause: err });
      }
    }),

    // Get just the access tier (lightweight, used by PremiumGate)
    getAccessTier: protectedProcedure.query(async ({ ctx }) => {
      try {
        const tier = await getUserTier(ctx.user.id);
        return { tier };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch tier", cause: err });
      }
    }),

    // Submit a founding access / waitlist request
    publicStats: publicProcedure.query(async () => {
      try {
        const stats = await getPlatformStats();
        if (!stats) return { totalUsers: 1, waitlistCount: 0, riskSignals: 8400 };
        // Derive a live risk-signal count: base of 8400 + 12 per registered user + 47 per waitlist entry
        const riskSignals = 8400 + (stats.users.total * 12) + (stats.waitlist.total * 47);
        return {
          totalUsers: stats.users.total,
          waitlistCount: stats.waitlist.total,
          riskSignals,
        };
      } catch {
        return { totalUsers: 1, waitlistCount: 0, riskSignals: 8400 };
      }
    }),

    requestFoundingAccess: publicProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(1).max(200).optional(),
        message: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const userId = ctx.user?.id ?? null;
          const result = await createFoundingRequest({
            userId,
            email: input.email,
            name: input.name ?? null,
            message: input.message ?? null,
          });
          // Return success silently even on duplicate — don't reveal whether the email exists
          if (result.duplicate) return { success: true, id: null };
          // Notify the owner of the new founding access request
          await notifyOwner({
            title: "New Founding Access Request",
            content: [
              `**Email:** ${input.email}`,
              input.name ? `**Name:** ${input.name}` : null,
              input.message ? `**Message:** ${input.message}` : null,
            ].filter(Boolean).join("\n"),
          }).catch(() => { /* non-fatal — don't block the response */ });
          return { success: true, id: result.id };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to submit request", cause: err });
        }
      }),
  }),

  admin: router({
    // List all registered users — admin only
    getUsers: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
          }
          return await getAllUsers();
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch users", cause: err });
        }
      }),

    // List all users with tier info — admin only
    getUsersWithTier: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
          }
          return await getAllUsersWithTier();
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch users", cause: err });
        }
      }),

    // Set a user's access tier — admin only
    setUserTier: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        tier: z.enum(['free', 'core', 'premium', 'founding']),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
          }
          await setUserTier(input.userId, input.tier);
          return { success: true };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to set tier", cause: err });
        }
      }),

    // List all founding access requests — admin only
    getFoundingRequests: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
          }
          return await getFoundingRequests();
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch requests", cause: err });
        }
      }),

    // Platform stats — admin only
    getPlatformStats: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
          return await getPlatformStats();
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch stats', cause: err });
        }
      }),

    // Activity feed — admin only
    getActivityFeed: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
          return await getActivityFeed(30);
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch activity', cause: err });
        }
      }),

    // Update founding request status — admin only
    updateFoundingRequestStatus: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        status: z.enum(['pending', 'approved', 'rejected']),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          if (ctx.user.role !== "admin") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
          }
          await updateFoundingRequestStatus(input.id, input.status);
          return { success: true };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update request", cause: err });
        }
      }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const [signups, waitlist, conversion] = await Promise.all([
        getSignupTimeSeries(30),
        getWaitlistTimeSeries(30),
        getConversionStats(),
      ]);
      return { signups, waitlist, conversion };
    }),
  }),
  blog: router({
    // Public: list published posts
    list: publicProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
        category: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          const posts = await getBlogPosts({ publishedOnly: true, ...input });
          return posts;
        } catch (err) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch posts', cause: err });
        }
      }),

    // Public: get single post by slug
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          const post = await getBlogPostBySlug(input.slug);
          if (!post || !post.published) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
          return post;
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch post', cause: err });
        }
      }),

    // Public: get categories
    getCategories: publicProcedure.query(async () => {
      try {
        return await getBlogCategories();
      } catch (err) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch categories', cause: err });
      }
    }),

    // Admin: list all posts (including drafts)
    adminList: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      try {
        return await getBlogPosts({ publishedOnly: false, limit: 100 });
      } catch (err) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch posts', cause: err });
      }
    }),

    // Admin: get single post by id (for editing)
    adminGetById: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const post = await getBlogPostById(input.id);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
        return post;
      }),

    // Admin: create post
    create: protectedProcedure
      .input(z.object({
        slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
        title: z.string().min(1).max(300),
        subtitle: z.string().max(400).optional(),
        content: z.string().min(1),
        author: z.string().max(100).default('FAULTLINE'),
        category: z.string().max(80).default('Macro Intelligence'),
        tags: z.string().max(500).optional(),
        published: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        try {
          const id = await createBlogPost({
            ...input,
            published: input.published ? 1 : 0,
            publishedAt: input.published ? new Date() : null,
          });
          return { id };
        } catch (err: any) {
          if (err?.code === 'ER_DUP_ENTRY') throw new TRPCError({ code: 'CONFLICT', message: 'A post with this slug already exists' });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create post', cause: err });
        }
      }),

    // Admin: update post
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
        title: z.string().min(1).max(300).optional(),
        subtitle: z.string().max(400).optional(),
        content: z.string().min(1).optional(),
        author: z.string().max(100).optional(),
        category: z.string().max(80).optional(),
        tags: z.string().max(500).optional(),
        published: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        try {
          const { id, published, ...rest } = input;
          const existing = await getBlogPostById(id);
          if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
          const updateData: Record<string, unknown> = { ...rest };
          if (published !== undefined) {
            updateData.published = published ? 1 : 0;
            if (published && !existing.publishedAt) updateData.publishedAt = new Date();
          }
          await updateBlogPost(id, updateData as any);
          return { success: true };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update post', cause: err });
        }
      }),

    // Admin: delete post
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        try {
          await deleteBlogPost(input.id);
          return { success: true };
        } catch (err) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete post', cause: err });
        }
      }),
  }),

  xPostQueue: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(100).default(50),
        postType: z.enum(['premarket', 'midday', 'closing', 'breaking']).optional(),
        status: z.enum(['pending', 'posted', 'failed', 'skipped']).optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getXPostQueue(input);
      }),
    stats: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getXPostQueueStats();
      }),
  }),

  trackRecord: router({
    // Public: get all pressure history records (paginated)
    getHistory: publicProcedure
      .input(z.object({
        startMonth: z.string().optional(),
        endMonth: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(317),
      }))
      .query(async ({ input }) => {
        try {
          const records = await getPressureHistory(input);
          return records.map(r => ({
            month: r.month,
            overallPressure: r.overallPressure,
            regime: r.regime,
            liquidityStress: r.liquidityStress,
            creditContagion: r.creditContagion,
            volatilityRegime: r.volatilityRegime,
            macroSensitivity: r.macroSensitivity,
            marketBreadth: r.marketBreadth,
            aiBubble: r.aiBubble,
            baaSpread: r.baaSpread !== null ? Number(r.baaSpread) : null,
            hySpreadProxy: r.hySpreadProxy !== null ? Number(r.hySpreadProxy) : null,
            tsy10y: r.tsy10y !== null ? Number(r.tsy10y) : null,
            tsy2y: r.tsy2y !== null ? Number(r.tsy2y) : null,
            fedfunds: r.fedfunds !== null ? Number(r.fedfunds) : null,
            cpiYoy: r.cpiYoy !== null ? Number(r.cpiYoy) : null,
            unemployment: r.unemployment !== null ? Number(r.unemployment) : null,
            sp500: r.sp500 !== null ? Number(r.sp500) : null,
          }));
        } catch (err) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch pressure history', cause: err });
        }
      }),

    // Public: get aggregate stats for the Track Record page
    getStats: publicProcedure.query(async () => {
      try {
        return await getPressureHistoryStats();
      } catch (err) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch stats', cause: err });
      }
    }),
  }),

  xPost: router({
    generate: protectedProcedure
      .input(z.object({
        postType: z.enum(['premarket', 'midday', 'closing', 'breaking']),
        headline: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
        try {
          const pressure = await calculateFaultlinePressure();
          const variants = await generateXPosts({
            postType: input.postType,
            pressure,
            headline: input.headline,
          });
          return { variants, pressure: { overallPressure: pressure.overallPressure, regime: pressure.regime, level: pressure.level } };
        } catch (err) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate X posts', cause: err });
        }
      }),
    post: protectedProcedure
      .input(z.object({
        text: z.string().min(1).max(280),
        postType: z.enum(['premarket', 'midday', 'closing', 'breaking']).optional(),
        variant: z.enum(['short', 'thread', 'founder', 'institutional', 'breaking']).optional(),
        pressureScore: z.number().optional(),
        pressureRegime: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
        try {
          const result = await postTweet(input.text);
          const db = await getDb();
          if (db) {
            await db.insert(xPostQueue).values({
              postType: input.postType ?? 'premarket',
              variant: input.variant ?? 'short',
              content: input.text,
              status: 'posted',
              xPostId: result.id,
              pressureScore: input.pressureScore,
              pressureRegime: input.pressureRegime,
              postedAt: new Date(),
            });
          }
          return { success: true, id: result.id };
        } catch (err: any) {
          // Log failed attempt to queue
          try {
            const db = await getDb();
            if (db) {
              await db.insert(xPostQueue).values({
                postType: input.postType ?? 'premarket',
                variant: input.variant ?? 'short',
                content: input.text,
                status: 'failed',
                errorMsg: err?.message ?? 'Unknown error',
                pressureScore: input.pressureScore,
                pressureRegime: input.pressureRegime,
              });
            }
          } catch (_) { /* ignore queue write failure */ }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err?.message ?? 'Failed to post tweet', cause: err });
        }
      }),
    postThread: protectedProcedure
      .input(z.object({
        threadText: z.string().min(1),
        postType: z.enum(['premarket', 'midday', 'closing', 'breaking']).optional(),
        pressureScore: z.number().optional(),
        pressureRegime: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
        try {
          const tweets = parseThread(input.threadText);
          if (tweets.length === 0) throw new Error('No tweets parsed from thread text');
          const result = await postThread(tweets);
          const db = await getDb();
          if (db) {
            await db.insert(xPostQueue).values({
              postType: input.postType ?? 'premarket',
              variant: 'thread',
              content: input.threadText,
              status: 'posted',
              xPostId: result.ids[0],
              pressureScore: input.pressureScore,
              pressureRegime: input.pressureRegime,
              postedAt: new Date(),
            });
          }
          return { success: true, ids: result.ids, tweetCount: tweets.length };
        } catch (err: any) {
          try {
            const db = await getDb();
            if (db) {
              await db.insert(xPostQueue).values({
                postType: input.postType ?? 'premarket',
                variant: 'thread',
                content: input.threadText,
                status: 'failed',
                errorMsg: err?.message ?? 'Unknown error',
                pressureScore: input.pressureScore,
                pressureRegime: input.pressureRegime,
              });
            }
          } catch (_) { /* ignore */ }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err?.message ?? 'Failed to post thread', cause: err });
        }
      }),
  }),

  altRotation: router({
    getData: coreProcedure.query(async () => {
      const apiKey = process.env.COINGECKO_API_KEY;
      return computeAltRotation(apiKey);
    }),
    clearCache: protectedProcedure.mutation(() => {
      clearAltRotationCache();
      return { cleared: true };
    }),
  }),
  mobileWatchlist: router({
    // Get all watchlist items for the current user
    getItems: coreProcedure.query(async ({ ctx }) => {
      try {
        return await getMobileWatchlist(ctx.user.id);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to load watchlist", cause: err });
      }
    }),
    // Add a ticker or crypto to the watchlist
    addItem: coreProcedure
      .input(z.object({
        symbol: z.string().min(1).max(30).trim().transform(s => s.toUpperCase()),
        name: z.string().min(1).max(120).trim(),
        type: z.enum(["stock", "crypto"]),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await addMobileWatchlistItem(ctx.user.id, input.symbol, input.name, input.type);
          if (result.duplicate) return { success: true, duplicate: true, id: null };
          return { success: true, duplicate: false, id: result.id };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to add to watchlist", cause: err });
        }
      }),
    // Remove an item from the watchlist
    removeItem: coreProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await removeMobileWatchlistItem(ctx.user.id, input.id);
          return { success: true };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to remove from watchlist", cause: err });
        }
      }),
  }),
});
export type AppRouter = typeof appRouter;
