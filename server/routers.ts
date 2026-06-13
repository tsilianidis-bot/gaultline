import { COOKIE_NAME } from "@shared/const";
import { analyticsRouter, blogRouter, billingRouter, adminRouter } from "./routers/index";
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
  getBlogPosts, getBlogPostBySlug, getBlogPostById, createBlogPost, updateBlogPost, deleteBlogPost, getBlogCategories, incrementBlogPostViewCount,
  updateDashboardMode,
  getXPostQueue, getXPostQueueStats,
  getPressureHistory, getPressureHistoryStats,
  getMobileWatchlist, addMobileWatchlistItem, removeMobileWatchlistItem,
  deleteUser,
  insertPressureRun, getRecentPressureRuns, countPressureRuns,
  getAllFeatureFlags, getFeatureFlag, setFeatureFlag } from "./db";
import { getCryptoIntelligence, clearCryptoCache } from "./cryptoIntelligence";
import { getCryptoIntelligenceResult, computeCryptoSystemicRisk, clearCryptoEngineCache } from "./cryptoEngine";
import { searchCoins, getTopMarkets, getGlobalStats, getCoinMarketData, getCoinOHLC, getCoinDetail } from "./coingeckoProxy";
import { getQuotes, getTopStockPerformers, getTopStockLosers, getTopStockByVolume } from "./yahooProxy";
import { getAsymmetricOpportunities } from "./asymmetricOpportunities";
import { runAftershockEngine, getAssetContagionChain, getAllContagionAssets, clearAftershockCache } from "./aftershockEngine";
import { computeCryptoSignal, computeCryptoSignals, clearCryptoSignalCache } from "./cryptoSignals";
import { computeAltRotation, clearAltRotationCache } from "./altRotationEngine";
import { getRecoveryAnalysis, clearRecoveryCache } from "./recoveryEngine";
import { logMarketAwarenessAction, computeAwarenessScore, getRecentActions, ACTION_KEYS, type ActionKey } from "./marketAwareness";
import {
  getTodaySnapshot, hasTodaySnapshot, getSnapshotRange, getLatestSnapshot,
  upsertTodaySnapshot, getTimeframeReading, computeOutcomeSupport, getReadingHistorySummary,
} from "./readingHistory";
import { protectedProcedure, coreProcedure } from "./_core/trpc";
import { stripe } from './stripe/client';
import { PLANS } from './stripe/products';
import { generateXPosts } from './xPostGenerator';
import { sendEmail, buildApprovalEmail } from './email';
import { postTweet, postThread, parseThread } from './xPoster';
import { runTradePreflightSimulation, type MoveType, type SimulatorTimeframe, type ThesisType } from './tradePreflight';
import { getPreFlightData } from './preFlight';
import { getInsiderRadar, getInsiderCompany, getInsiderAlertsForTicker } from './insiderIntelligence';
import { analyzeSeoUrl, generateMetaTags, generateAutoFix } from './seoOptimizer';
import { xPostQueue, users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { getDb } from './db';

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,

  billing: billingRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    setDashboardMode: protectedProcedure
      .input(z.object({ mode: z.enum(['pulse', 'signals', 'intelligence']) }))
      .mutation(async ({ ctx, input }) => {
        await updateDashboardMode(ctx.user.id, input.mode);
        return { success: true };
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

    // Get stock info (sector, industry, description) for a ticker
    getStockInfo: publicProcedure
      .input(z.object({
        ticker: z.string().min(1).max(10).trim().transform(s => s.toUpperCase()),
      }))
      .query(async ({ input }) => {
        try {
          const apiKey = process.env.POLYGON_API_KEY ?? "";
          const res = await fetch(`${process.env.VITE_FRONTEND_FORGE_API_URL ? '' : ''}/api/signals/ticker/${input.ticker}`, {
            headers: { 'x-internal': '1' },
          }).catch(() => null);
          // Use direct Polygon reference endpoint for description/sector/industry
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
  }),

  pressure: router({
    // Get the current FAULTLINE Pressure Index with all risk vectors
    getCurrentPressure: publicProcedure.query(async () => {
      try {
        // Feature flag gate — admin can disable the pressure engine from the Admin Portal
        const engineEnabled = await getFeatureFlag("pressure_engine");
        if (!engineEnabled) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Pressure engine is temporarily disabled for maintenance." });
        }
        const result = await calculateFaultlinePressure();
        // Fire-and-forget audit insert — never blocks the response
        insertPressureRun({
          overallPressure: result.overallPressure,
          regime: result.regime,
          level: result.level,
          dataSource: result.dataSource,
          vectorsJson: JSON.stringify(result.vectors),
          alertsJson: JSON.stringify(result.alerts),
          topAnalogJson: JSON.stringify(result.topAnalog),
          rawInputsJson: JSON.stringify(
            result.vectors.reduce((acc, v) => ({ ...acc, [v.id]: v.rawInputs }), {})
          ),
          engineVersion: "1.0.0",
        }).catch(err => {
          // Non-fatal: audit failure must never break the pressure response
          console.warn("[Pressure Audit] Failed to write run record", err);
        });
        return result;
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

    // Portfolio Intelligence — 8 macro-risk metrics derived from positions + pressure engine
    getIntelligence: coreProcedure.query(async ({ ctx }) => {
      try {
        const rows = await getPositionsByUser(ctx.user.id);
        const pressure = await calculateFaultlinePressure();
        const vectors = pressure.vectors;

        // Helper: find vector score by id
        const vs = (id: string) => vectors.find(v => v.id === id)?.score ?? 50;
        const vd = (id: string) => vectors.find(v => v.id === id)?.driver ?? "";
        const vt = (id: string) => vectors.find(v => v.id === id)?.trend ?? "stable";

        // Analyse position composition
        const totalPositions = rows.length;
        const assetTypeCounts: Record<string, number> = {};
        for (const r of rows) {
          assetTypeCounts[r.assetType] = (assetTypeCounts[r.assetType] ?? 0) + 1;
        }
        const stockCount = (assetTypeCounts["Stock"] ?? 0) + (assetTypeCounts["ETF"] ?? 0);
        const cryptoCount = assetTypeCounts["Crypto"] ?? 0;
        const cryptoRatio = totalPositions > 0 ? cryptoCount / totalPositions : 0;
        const stockRatio  = totalPositions > 0 ? stockCount  / totalPositions : 0;

        // Concentration: Herfindahl-style — if < 5 positions, concentration is high
        const concentrationScore = totalPositions === 0 ? 50
          : totalPositions === 1 ? 90
          : totalPositions <= 3 ? 75
          : totalPositions <= 6 ? 55
          : totalPositions <= 10 ? 35
          : 20;

        // 1. Portfolio Pressure Score — weighted composite of all vectors
        const portfolioPressureScore = pressure.overallPressure;

        // 2. AI Bubble Exposure — ai-bubble vector, amplified by AI/tech stock ratio
        const aiBubbleBase = vs("ai-bubble");
        const aiBubbleScore = Math.min(100, Math.round(aiBubbleBase * (1 + stockRatio * 0.2)));

        // 3. Interest Rate Sensitivity — volatility-regime + macro-sensitivity
        const rateSensScore = Math.min(100, Math.round((vs("volatility-regime") * 0.5 + vs("macro-sensitivity") * 0.5)));

        // 4. Concentration Risk — position count heuristic
        const concentrationRiskScore = concentrationScore;

        // 5. Liquidity Risk — liquidity-stress vector, amplified by crypto ratio
        const liquidityBase = vs("liquidity-stress");
        const liquidityScore = Math.min(100, Math.round(liquidityBase * (1 + cryptoRatio * 0.3)));

        // 6. Recession Exposure — credit-contagion + macro-sensitivity
        const recessionScore = Math.min(100, Math.round((vs("credit-contagion") * 0.6 + vs("macro-sensitivity") * 0.4)));

        // 7. Historical Crash Vulnerability — top analog similarity as proxy
        const crashVulnScore = Math.min(100, Math.round(pressure.topAnalog.similarity * 0.85 + portfolioPressureScore * 0.15));

        // 8. Regime Alignment — how well-positioned the portfolio is for the current regime
        // Low pressure = good alignment; high pressure = poor alignment
        const regimeAlignmentScore = Math.max(0, 100 - portfolioPressureScore);

        const scoreToLevel = (s: number) =>
          s >= 75 ? "Critical" : s >= 60 ? "High" : s >= 40 ? "Elevated" : s >= 20 ? "Moderate" : "Low";

        return {
          regime: pressure.regime,
          regimeLevel: pressure.level,
          dataSource: pressure.dataSource,
          timestamp: pressure.timestamp,
          metrics: [
            {
              id: "portfolio-pressure",
              label: "Portfolio Pressure Score",
              description: "Composite macro-risk pressure index applied to your current portfolio",
              score: portfolioPressureScore,
              level: scoreToLevel(portfolioPressureScore),
              driver: `FAULTLINE Pressure Index at ${portfolioPressureScore}/100 — ${pressure.regime}`,
              trend: pressure.overallPressure > 60 ? "rising" : pressure.overallPressure < 30 ? "falling" : "stable" as const,
              color: portfolioPressureScore >= 75 ? "#FF2D55" : portfolioPressureScore >= 55 ? "#FF6B35" : portfolioPressureScore >= 35 ? "#FFD60A" : "#00FF88",
            },
            {
              id: "ai-bubble-exposure",
              label: "AI Bubble Exposure",
              description: "Concentration risk from AI mega-cap and speculative growth assets",
              score: aiBubbleScore,
              level: scoreToLevel(aiBubbleScore),
              driver: vd("ai-bubble"),
              trend: vt("ai-bubble"),
              color: aiBubbleScore >= 75 ? "#FF2D55" : aiBubbleScore >= 55 ? "#FF6B35" : aiBubbleScore >= 35 ? "#FFD60A" : "#00FF88",
            },
            {
              id: "rate-sensitivity",
              label: "Interest Rate Sensitivity",
              description: "Exposure to rate-driven repricing from Fed policy and yield curve dynamics",
              score: rateSensScore,
              level: scoreToLevel(rateSensScore),
              driver: vd("macro-sensitivity"),
              trend: vt("macro-sensitivity"),
              color: rateSensScore >= 75 ? "#FF2D55" : rateSensScore >= 55 ? "#FF6B35" : rateSensScore >= 35 ? "#FFD60A" : "#00FF88",
            },
            {
              id: "concentration-risk",
              label: "Concentration Risk",
              description: `Portfolio spread across ${totalPositions} position${totalPositions !== 1 ? "s" : ""}`,
              score: concentrationRiskScore,
              level: scoreToLevel(concentrationRiskScore),
              driver: totalPositions === 0 ? "No positions tracked" : totalPositions <= 3 ? `Only ${totalPositions} position${totalPositions !== 1 ? "s" : ""} — high single-name risk` : `${totalPositions} positions — diversification improving`,
              trend: "stable" as const,
              color: concentrationRiskScore >= 75 ? "#FF2D55" : concentrationRiskScore >= 55 ? "#FF6B35" : concentrationRiskScore >= 35 ? "#FFD60A" : "#00FF88",
            },
            {
              id: "liquidity-risk",
              label: "Liquidity Risk",
              description: "Credit market liquidity conditions affecting exit and re-entry costs",
              score: liquidityScore,
              level: scoreToLevel(liquidityScore),
              driver: vd("liquidity-stress"),
              trend: vt("liquidity-stress"),
              color: liquidityScore >= 75 ? "#FF2D55" : liquidityScore >= 55 ? "#FF6B35" : liquidityScore >= 35 ? "#FFD60A" : "#00FF88",
            },
            {
              id: "recession-exposure",
              label: "Recession Exposure",
              description: "Probability of macro contraction impacting portfolio valuations",
              score: recessionScore,
              level: scoreToLevel(recessionScore),
              driver: vd("credit-contagion"),
              trend: vt("credit-contagion"),
              color: recessionScore >= 75 ? "#FF2D55" : recessionScore >= 55 ? "#FF6B35" : recessionScore >= 35 ? "#FFD60A" : "#00FF88",
            },
            {
              id: "crash-vulnerability",
              label: "Historical Crash Vulnerability",
              description: `Current conditions match ${pressure.topAnalog.label} (${pressure.topAnalog.similarity}% similarity)`,
              score: crashVulnScore,
              level: scoreToLevel(crashVulnScore),
              driver: `Closest analog: ${pressure.topAnalog.label} — ${pressure.topAnalog.description}`,
              trend: "stable" as const,
              color: crashVulnScore >= 75 ? "#FF2D55" : crashVulnScore >= 55 ? "#FF6B35" : crashVulnScore >= 35 ? "#FFD60A" : "#00FF88",
            },
            {
              id: "regime-alignment",
              label: "Regime Alignment",
              description: "How well your portfolio is positioned for the current macro regime",
              score: regimeAlignmentScore,
              level: scoreToLevel(regimeAlignmentScore),
              driver: regimeAlignmentScore >= 60 ? `Portfolio well-aligned with ${pressure.regime} regime` : `Portfolio exposed to ${pressure.regime} headwinds`,
              trend: pressure.overallPressure > 60 ? "falling" : "rising" as const,
              color: regimeAlignmentScore >= 60 ? "#00FF88" : regimeAlignmentScore >= 40 ? "#FFD60A" : regimeAlignmentScore >= 20 ? "#FF6B35" : "#FF2D55",
            },
          ],
        };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Portfolio intelligence failed", cause: err });
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

    // Get coin info (description + categories) for a crypto asset
    getCoinInfo: publicProcedure
      .input(z.object({
        symbol: z.string().min(1).max(20).trim().transform(s => s.toUpperCase()),
      }))
      .query(async ({ input }) => {
        try {
          const detail = await getCoinDetail(input.symbol);
          if (!detail) return { description: null, categories: [], sector: null };
          return {
            description: detail.description,
            categories: detail.categories,
            sector: detail.sector,
          };
        } catch (err) {
          return { description: null, categories: [], sector: null };
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

  admin: adminRouter,
  blog: blogRouter,

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

  awareness: router({
    // Log a single market awareness action for the authenticated user
    logAction: protectedProcedure
      .input(z.object({
        actionKey: z.string().refine((v): v is ActionKey => (ACTION_KEYS as readonly string[]).includes(v), { message: "Invalid action key" }),
        sourcePage: z.string().max(80).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          await logMarketAwarenessAction(
            ctx.user.id,
            input.actionKey as ActionKey,
            input.sourcePage,
            input.metadata
          );
          return { success: true };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to log action", cause: err });
        }
      }),

    // Get the Complete Market Awareness Score for today
    getScore: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await computeAwarenessScore(ctx.user.id);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to compute awareness score", cause: err });
      }
    }),

    // Get recent action history (last 7 days)
    getHistory: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await getRecentActions(ctx.user.id, 7);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to load action history", cause: err });
      }
    }),

    // Get the user's Market Preflight Prompts preference
    getPreflightMode: protectedProcedure.query(async ({ ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const rows = await db.select({ preflightPromptMode: users.preflightPromptMode })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);
        return { mode: (rows[0]?.preflightPromptMode ?? "full_guidance") as "full_guidance" | "minimal_reminders" | "off" };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get preflight mode", cause: err });
      }
    }),

    // Set the user's Market Preflight Prompts preference
    setPreflightMode: protectedProcedure
      .input(z.object({
        mode: z.enum(["full_guidance", "minimal_reminders", "off"]),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("DB unavailable");
          await db.update(users).set({ preflightPromptMode: input.mode }).where(eq(users.id, ctx.user.id));
          return { success: true, mode: input.mode };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to set preflight mode", cause: err });
        }
      }),

    // Mark a preflight session as completed — stores current UTC timestamp
    completePreflightSession: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const now = new Date();
        await db.update(users).set({ lastPreflightCompletedAt: now }).where(eq(users.id, ctx.user.id));
        return { success: true, completedAt: now.getTime() };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to record preflight completion", cause: err });
      }
    }),

    // Get the user's last preflight completion timestamp
    getPreflightStatus: protectedProcedure.query(async ({ ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const rows = await db
          .select({ lastPreflightCompletedAt: users.lastPreflightCompletedAt })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);
        const ts = rows[0]?.lastPreflightCompletedAt;
        return {
          lastCompletedAt: ts ? ts.getTime() : null,
          // True if never completed OR last completion was more than 24h ago
          needsPreflight: !ts || (Date.now() - ts.getTime() > 24 * 60 * 60 * 1000),
        };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get preflight status", cause: err });
      }
    }),
  }),

  readingHistory: router({
    // Get today's snapshot if it exists
    getToday: protectedProcedure.query(async () => {
      return await getTodaySnapshot();
    }),

    // Get snapshots for a date range
    getRange: protectedProcedure
      .input(z.object({
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }))
      .query(async ({ input }) => {
        return await getSnapshotRange(input.fromDate, input.toDate);
      }),

    // Get summary stats across all available history
    getSummary: protectedProcedure.query(async () => {
      return await getReadingHistorySummary();
    }),

    // Get outcome support scores from live engine
    getOutcomeSupport: protectedProcedure.query(async () => {
      return await computeOutcomeSupport();
    }),

    // Get the most recent snapshot (may not be today)
    getLatestSnapshot: protectedProcedure.query(async () => {
      return await getLatestSnapshot();
    }),

    // Check whether today's snapshot has been generated
    hasTodaySnapshot: protectedProcedure.query(async () => {
      return { exists: await hasTodaySnapshot() };
    }),

    // Get timeframe analysis: today | week | month | year
    getTimeframeAnalysis: protectedProcedure
      .input(z.object({
        timeframe: z.enum(["today", "week", "month", "year"]),
      }))
      .query(async ({ input }) => {
        const today = await getTodaySnapshot();
        return await getTimeframeReading(input.timeframe, today);
      }),

    // Generate (or regenerate) today's snapshot — admin only
    generateTodaySnapshot: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      try {
        const pressure = await calculateFaultlinePressure();
        let crashScore: number | null = null;
        let bullScore: number | null = null;
        try {
          const diag = await getDiagnosticReport("today");
          crashScore = diag.crashRisk.score;
          bullScore = diag.bullContinuation.score;
        } catch { /* diagnostic unavailable */ }
        const snapshot = await upsertTodaySnapshot(pressure, crashScore, bullScore, null);
        return { success: true, snapshot };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Snapshot generation failed", cause: err });
      }
    }),
  }),

  // ── Insider Intelligence ──────────────────────────────────
  insider: router({
    radar: protectedProcedure
      .query(async () => {
        try {
          return await getInsiderRadar();
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Insider radar failed", cause: err });
        }
      }),
    company: protectedProcedure
      .input(z.object({ ticker: z.string().min(1).max(10) }))
      .query(async ({ input }) => {
        try {
          return await getInsiderCompany(input.ticker);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Insider company profile failed", cause: err });
        }
      }),
    tickerAlert: protectedProcedure
      .input(z.object({ ticker: z.string().min(1).max(10) }))
      .query(async ({ input }) => {
        try {
          return await getInsiderAlertsForTicker(input.ticker);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Insider ticker alert failed", cause: err });
        }
      }),
  }),

  // ── Trade Preflight Simulator ───────────────────────────────
  trade: router({
    simulate: protectedProcedure
      .input(z.object({
        moveType: z.enum([
          "buy_add_risk",
          "hold",
          "trim",
          "sell",
          "hedge",
          "raise_cash",
          "rotate_sectors",
          "buy_specific_ticker",
          "sell_specific_ticker",
          "increase_crypto",
          "reduce_crypto",
        ] as const),
        timeframe: z.enum(["today", "this_week", "one_three_months", "six_twelve_months"] as const),
        ticker: z.string().min(1).max(10).optional(),
        thesisType: z.enum([
          "momentum",
          "breakout",
          "mean_reversion",
          "long_term",
          "value",
          "ai_theme",
          "crypto_cycle",
          "sector_rotation",
          "other",
        ] as const).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await runTradePreflightSimulation({
            moveType: input.moveType as MoveType,
            timeframe: input.timeframe as SimulatorTimeframe,
            ticker: input.ticker,
            thesisType: input.thesisType as ThesisType | undefined,
          });
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Trade Preflight simulation failed", cause: err });
        }
      }),
  }),

  // ── Pre-Flight Market Awareness ──────────────────────────────
  preFlight: router({
    getAwarenessData: publicProcedure
      .query(async () => {
        try {
          return await getPreFlightData();
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Pre-Flight data fetch failed", cause: err });
        }
      }),
  }),

  // ── Analytics Dashboard ──────────────────────────────────────
  analytics: analyticsRouter,

  // ── SEO Optimizer ────────────────────────────────────────────
  seo: router({
    analyzeUrl: protectedProcedure
      .input(z.object({
        url: z.string().url(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await analyzeSeoUrl(input.url);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err instanceof Error ? err.message : "SEO analysis failed", cause: err });
        }
      }),
    generateMeta: protectedProcedure
      .input(z.object({
        topic: z.string().min(3).max(200),
        targetKeyword: z.string().min(2).max(100),
        pageType: z.enum(["blog", "landing", "product", "category", "homepage", "about", "service"]),
      }))
      .mutation(async ({ input }) => {
        try {
          return await generateMetaTags(input.topic, input.targetKeyword, input.pageType);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Meta generation failed", cause: err });
        }
      }),
    autoFix: protectedProcedure
      .input(z.object({ analysisJson: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const analysis = JSON.parse(input.analysisJson);
          return await generateAutoFix(analysis);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err instanceof Error ? err.message : "Auto fix generation failed", cause: err });
        }
      }),
  }),

  // ── Contact Us ────────────────────────────────────────────────────────────────
  // ── Stocks Heatmap ─────────────────────────────────────────────────────────
  stocks: router({
    // Top 100 daily stock gainers for the heatmap
    getTopPerformers: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(100) }).optional())
      .query(async ({ input }) => {
        try {
          return await getTopStockPerformers(input?.limit ?? 100);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stock performers fetch failed", cause: err });
        }
      }),
    // Top 100 daily stock losers for the heatmap
    getTopLosers: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(100) }).optional())
      .query(async ({ input }) => {
        try {
          return await getTopStockLosers(input?.limit ?? 100);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stock losers fetch failed", cause: err });
        }
      }),
    // Top 100 stocks by volume for the heatmap
    getTopByVolume: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(100) }).optional())
      .query(async ({ input }) => {
        try {
          return await getTopStockByVolume(input?.limit ?? 100);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stock volume fetch failed", cause: err });
        }
      }),
    // Asymmetric Opportunities — high reward/risk setups with AI scoring
    getAsymmetricOpportunities: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(30).default(20) }).optional())
      .query(async ({ input }) => {
        try {
          return await getAsymmetricOpportunities(input?.limit ?? 20);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Asymmetric opportunities fetch failed", cause: err });
        }
      }),
  }),

    contact: router({
    submit: publicProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        subject: z.string().min(1).max(200),
        message: z.string().min(10).max(5000),
        category: z.enum(["General Inquiry", "Technical Support", "Access Request", "Partnership", "Press", "Feedback", "Bug Report", "Other"]),
      }))
      .mutation(async ({ input }) => {
        const { buildContactEmail, buildContactAutoReply } = await import('./email');
        const ownerEmail = buildContactEmail(input);
        await sendEmail(ownerEmail);
        const autoReply = buildContactAutoReply({ name: input.name, email: input.email, subject: input.subject });
        await sendEmail(autoReply);
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
