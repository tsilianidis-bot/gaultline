import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./_core/env";
import { analyticsRouter, blogRouter, billingRouter, adminRouter, outlookRouter, organicContentRouter, smartDiscoveryRouter, fmosRouter, dailyBriefRouter, intelligenceValidationRouter } from "./routers/index";
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
  getMobileUsageToday, incrementMobileUsage, incrementSituationRoomUsage, getSituationRoomMonthlyCount,
  deleteUser,
  insertPressureRun, getRecentPressureRuns, countPressureRuns,
  getAllFeatureFlags, getFeatureFlag, setFeatureFlag,
  createSharedReport, getSharedReportByPublicId, listSharedReportsByUser, revokeSharedReport, incrementSharedReportViewCount } from "./db";
import { getCryptoIntelligence, clearCryptoCache } from "./cryptoIntelligence";
import { getCryptoIntelligenceResult, computeCryptoSystemicRisk, clearCryptoEngineCache } from "./cryptoEngine";
import { searchCoins, getTopMarkets, getGlobalStats, getCoinMarketData, getCoinOHLC, getCoinDetail } from "./coingeckoProxy";
import { getQuotes, getTopStockPerformers, getTopStockLosers, getTopStockByVolume, getTopNear52WeekHigh, getTopNear52WeekLow, getMostVolatileStocks, getSmallCapRunners } from "./yahooProxy";
import { getAsymmetricOpportunities } from "./asymmetricOpportunities";
import {
  getSimAccounts, upsertSimAccount, getSimOpenPositions, insertSimPosition, updateSimPosition,
  insertSimTrade, getSimTrades, getSimJournalEntries, upsertSimJournalEntry,
} from "./db";
import { valuateSimPortfolio, runDailyEvaluation } from "./simPortfolioEngine";
import { generateDailyJournal } from "./simPortfolioJournal";
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
import { sendEmail, buildApprovalEmail, buildFoundingRequestNotification } from './email';
import { postTweet, postThread, parseThread } from './xPoster';
import { runTradePreflightSimulation, type MoveType, type SimulatorTimeframe, type ExposureCategory, type RaiseCashReason, type DeployCashTarget, type PositionSizeType, type ExitType, type HoldConcern } from './tradePreflight';
import { getPreFlightData } from './preFlight';
import {
  getOrCreateOwnerAccount, getOwnerPositions, getOwnerTrades, getOwnerObjective, setOwnerObjective,
  getDailySnapshots, upsertDailySnapshot, scanOpportunities, executeTrade, markToMarket,
  calcGoalProgress, generateOwnerJournal, getOptimalAction, OBJECTIVE_TYPES,
  buildStockOpportunity, buildCryptoOpportunity,
} from './ownerSimulation';
import { getInsiderRadar, getInsiderCompany, getInsiderAlertsForTicker } from './insiderIntelligence';
import { dayTradeScanner, dayTradeSymbolSetup, getDayTradeFavorability, clearDayTradeCache } from './dayTradeEngine';
import { saveDayTradeSnapshot, loadDayTradeSnapshot, getPipelineHealthLogs, getPipelineHealthSummary } from './db';
import { logPipelineFailure } from './pipelineLogger';
import { getDayTradeWatchlist, addDayTradeWatchlistItem, removeDayTradeWatchlistItem, isDayTradeWatchlisted } from './db';
import { getTradeJournalEntries, insertTradeJournalEntry, updateTradeJournalEntry, deleteTradeJournalEntry, getTradeJournalStats } from './db';
import { analyzeSeoUrl, generateMetaTags, generateAutoFix } from './seoOptimizer';
import { computeSOB } from './sobEngine';
import { generateBotResponse, detectIntent, aggregateLeadScore } from './chatbotEngine';
import {
  createChatbotSession, updateChatbotSession, addChatbotMessage, getChatbotMessages,
  createChatbotLead, getChatbotSessions, getChatbotSessionWithMessages,
  markChatbotSessionReviewed, addChatbotAdminNote, getChatbotLeads, getChatbotStats,
} from './db';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { xPostQueue, users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { getDb } from './db';

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,

  billing: billingRouter,

  outlook: outlookRouter,

  organicContent: organicContentRouter,

  smartDiscovery: smartDiscoveryRouter,

  fmos: fmosRouter,

  dailyBrief: dailyBriefRouter,

  intelligenceValidation: intelligenceValidationRouter,

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
          const sanitizeNumbers = (v: unknown): unknown => {
            if (typeof v === 'number') return (isFinite(v) && !isNaN(v)) ? v : 0;
            if (v === null || v === undefined) return v;
            if (Array.isArray(v)) return v.map(sanitizeNumbers);
            if (typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, sanitizeNumbers(val)]));
            return v;
          };
          return sanitizeNumbers(result) as typeof result;
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
          const sanitizeNums = (v: unknown): unknown => {
            if (typeof v === 'number') return (isFinite(v) && !isNaN(v)) ? v : 0;
            if (v === null || v === undefined) return v;
            if (Array.isArray(v)) return v.map(sanitizeNums);
            if (typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, sanitizeNums(val)]));
            return v;
          };
          const screenerResult = {
            signals: results,
            regime,
            btcDominance,
            totalMarketCap: globalStats?.totalMarketCap ?? 0,
            marketCapChange24h: globalStats?.marketCapChangePercent24h ?? 0,
            computedAt: Date.now(),
          };
          return sanitizeNums(screenerResult) as typeof screenerResult;
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
          // Notify the owner of the new founding access request (in-app notification)
          await notifyOwner({
            title: "New Founding Access Request",
            content: [
              `**Email:** ${input.email}`,
              input.name ? `**Name:** ${input.name}` : null,
              input.message ? `**Message:** ${input.message}` : null,
            ].filter(Boolean).join("\n"),
          }).catch(() => { /* non-fatal — don't block the response */ });
          // Also send email notification to owner via SendGrid (non-blocking)
          sendEmail(buildFoundingRequestNotification({
            name: input.name ?? null,
            email: input.email,
            message: input.message ?? null,
            requestId: result.id ?? null,
          })).catch((err) => {
            console.warn("[Founding Request] Email notification failed:", err);
          });
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
      try {
        const apiKey = process.env.COINGECKO_API_KEY;
        const result = await computeAltRotation(apiKey);
        const sanitize = (v: unknown): unknown => {
          if (typeof v === 'number') return (isFinite(v) && !isNaN(v)) ? v : 0;
          if (v === null || v === undefined) return v;
          if (Array.isArray(v)) return v.map(sanitize);
          if (typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, sanitize(val)]));
          return v;
        };
        return sanitize(result) as typeof result;
      } catch (err) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Alt rotation data unavailable.' });
      }
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
          "add_risk",
          "reduce_risk",
          "hedge",
          "rotate",
          "raise_cash",
          "deploy_cash",
          "buy_specific_asset",
          "sell_specific_asset",
          "hold",
        ] as const),
        timeframe: z.enum(["today", "this_week", "one_three_months", "six_twelve_months"] as const),
        ticker: z.string().min(1).max(10).optional(),
        exposureCategory: z.enum([
          "ai_infrastructure", "technology", "large_cap_growth", "small_cap_growth",
          "value", "dividend", "financials", "industrials", "energy", "healthcare",
          "international", "emerging_markets", "bitcoin", "ethereum", "ai_crypto",
          "altcoins", "memecoins", "options", "leveraged_exposure", "concentrated_position",
          "custom_exposure", "entire_portfolio", "technology_exposure", "ai_exposure",
          "crypto_exposure", "single_position", "market_risk", "recession_risk", "inflation_risk",
        ] as const).optional(),
        rotateFrom: z.string().max(50).optional(),
        rotateTo: z.string().max(50).optional(),
        raiseCashReason: z.string().max(50).optional(),
        deployCashTarget: z.string().max(50).optional(),
        positionSizeType: z.string().max(50).optional(),
        exitType: z.string().max(50).optional(),
        holdConcern: z.string().max(50).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await runTradePreflightSimulation({
            moveType: input.moveType as MoveType,
            timeframe: input.timeframe as SimulatorTimeframe,
            ticker: input.ticker,
            exposureCategory: input.exposureCategory as ExposureCategory | undefined,
            rotateFrom: input.rotateFrom,
            rotateTo: input.rotateTo,
            raiseCashReason: input.raiseCashReason as RaiseCashReason | undefined,
            deployCashTarget: input.deployCashTarget as DeployCashTarget | undefined,
            positionSizeType: input.positionSizeType as PositionSizeType | undefined,
            exitType: input.exitType as ExitType | undefined,
            holdConcern: input.holdConcern as HoldConcern | undefined,
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

    // ── Apply SEO fixes directly to index.html (admin only) ──────
    applyFix: protectedProcedure
      .input(z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        canonicalUrl: z.string().optional(),
        ogTitle: z.string().optional(),
        ogDescription: z.string().optional(),
        ogImage: z.string().optional(),
        twitterCard: z.string().optional(),
        twitterTitle: z.string().optional(),
        twitterDescription: z.string().optional(),
        robots: z.string().optional(),
        keywords: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
        // Locate index.html — try client/index.html first, then dist/index.html
        const candidates = [
          resolve(process.cwd(), 'client', 'index.html'),
          resolve(process.cwd(), 'dist', 'client', 'index.html'),
          resolve(process.cwd(), 'dist', 'index.html'),
        ];
        const indexPath = candidates.find(p => existsSync(p));
        if (!indexPath) throw new TRPCError({ code: 'NOT_FOUND', message: 'index.html not found' });
        let html = readFileSync(indexPath, 'utf-8');
        const changes: string[] = [];

        // Helper: replace or insert a <meta> tag
        function upsertMeta(attr: string, attrValue: string, content: string) {
          const re = new RegExp(`<meta\\s+${attr}=["']${attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
          const tag = `<meta ${attr}="${attrValue}" content="${content}" />`;
          if (re.test(html)) { html = html.replace(re, tag); }
          else { html = html.replace('</head>', `  ${tag}\n  </head>`); }
          changes.push(`${attr}=${attrValue}`);
        }

        if (input.title) {
          html = html.replace(/<title>[^<]*<\/title>/, `<title>${input.title}</title>`);
          changes.push('title');
        }
        if (input.description) upsertMeta('name', 'description', input.description);
        if (input.keywords) upsertMeta('name', 'keywords', input.keywords);
        if (input.robots) upsertMeta('name', 'robots', input.robots);
        if (input.canonicalUrl) {
          const re = /<link\s+rel=["']canonical["'][^>]*>/i;
          const tag = `<link rel="canonical" href="${input.canonicalUrl}" />`;
          if (re.test(html)) { html = html.replace(re, tag); }
          else { html = html.replace('</head>', `  ${tag}\n  </head>`); }
          changes.push('canonical');
        }
        if (input.ogTitle) upsertMeta('property', 'og:title', input.ogTitle);
        if (input.ogDescription) upsertMeta('property', 'og:description', input.ogDescription);
        if (input.ogImage) upsertMeta('property', 'og:image', input.ogImage);
        if (input.twitterCard) upsertMeta('name', 'twitter:card', input.twitterCard);
        if (input.twitterTitle) upsertMeta('name', 'twitter:title', input.twitterTitle);
        if (input.twitterDescription) upsertMeta('name', 'twitter:description', input.twitterDescription);

        writeFileSync(indexPath, html, 'utf-8');
        return { success: true, appliedTo: indexPath, changes };
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
    // Stocks near 52-week highs
    getNear52WeekHigh: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(100) }).optional())
      .query(async ({ input }) => {
        try {
          return await getTopNear52WeekHigh(input?.limit ?? 100);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "52-week high screener failed", cause: err });
        }
      }),
    // Stocks near 52-week lows
    getNear52WeekLow: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(100) }).optional())
      .query(async ({ input }) => {
        try {
          return await getTopNear52WeekLow(input?.limit ?? 100);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "52-week low screener failed", cause: err });
        }
      }),
    // Most volatile stocks (highest intraday range %)
    getMostVolatile: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(100) }).optional())
      .query(async ({ input }) => {
        try {
          return await getMostVolatileStocks(input?.limit ?? 100);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Volatile screener failed", cause: err });
        }
      }),
    // Small-cap runners (small-cap gainers with strong momentum)
    getSmallCapRunners: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(100) }).optional())
      .query(async ({ input }) => {
        try {
          return await getSmallCapRunners(input?.limit ?? 100);
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Small-cap runners screener failed", cause: err });
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
  simPortfolio: router({
    getOverview: publicProcedure
      .query(async ({ ctx }) => {
        try {
          const featureEnabled = await getFeatureFlag("sim_portfolio_visible");
          const isAdminOrOwner = ctx.user?.role === "admin" || ctx.user?.openId === ENV.ownerOpenId;
          if (!featureEnabled && !isAdminOrOwner) return { visible: false as const, accounts: [], valuation: null, startDate: null, startingCapital: 20000 };
          const accounts = await getSimAccounts();
          const openPositions = await getSimOpenPositions();
          const stocksAccount = accounts.find(a => a.accountType === "stocks");
          const cryptoAccount = accounts.find(a => a.accountType === "crypto");
          const stocksCash = parseFloat(stocksAccount?.cashBalance ?? "10000");
          const cryptoCash = parseFloat(cryptoAccount?.cashBalance ?? "10000");
          const valuation = await valuateSimPortfolio(openPositions, stocksCash, cryptoCash);
          return { visible: true as const, isAdminOrOwner, accounts, valuation, startDate: stocksAccount?.createdAt ?? null, startingCapital: 20000 };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sim portfolio overview failed", cause: err });
        }
      }),
    getPositions: publicProcedure
      .query(async ({ ctx }) => {
        const featureEnabled = await getFeatureFlag("sim_portfolio_visible");
        const isAdminOrOwner = ctx.user?.role === "admin" || ctx.user?.openId === ENV.ownerOpenId;
        if (!featureEnabled && !isAdminOrOwner) return [];
        return getSimOpenPositions();
      }),
    getTrades: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(100) }).optional())
      .query(async ({ ctx, input }) => {
        const featureEnabled = await getFeatureFlag("sim_portfolio_visible");
        const isAdminOrOwner = ctx.user?.role === "admin" || ctx.user?.openId === ENV.ownerOpenId;
        if (!featureEnabled && !isAdminOrOwner) return [];
        return getSimTrades(undefined, input?.limit ?? 100);
      }),
    getJournal: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(60).default(30) }).optional())
      .query(async ({ ctx, input }) => {
        const featureEnabled = await getFeatureFlag("sim_portfolio_visible");
        const isAdminOrOwner = ctx.user?.role === "admin" || ctx.user?.openId === ENV.ownerOpenId;
        if (!featureEnabled && !isAdminOrOwner) return [];
        return getSimJournalEntries(input?.limit ?? 30);
      }),
    runDailyUpdate: protectedProcedure
      .mutation(async () => {
        try {
          const { pressure, stockDecisions, cryptoDecisions } = await runDailyEvaluation();
          const accounts = await getSimAccounts();
          const openPositions = await getSimOpenPositions();
          const stocksAccount = accounts.find(a => a.accountType === "stocks");
          const cryptoAccount = accounts.find(a => a.accountType === "crypto");
          const stocksCash = parseFloat(stocksAccount?.cashBalance ?? "10000");
          const cryptoCash = parseFloat(cryptoAccount?.cashBalance ?? "10000");
          const previousValuation = await valuateSimPortfolio(openPositions, stocksCash, cryptoCash);
          const previousTotal = previousValuation.totalValue;
          const tradesSummary: string[] = [];
          for (const decision of [...stockDecisions, ...cryptoDecisions]) {
            if (decision.action === "BUY" && decision.quantity > 0) {
              const isStock = decision.assetType === "stock";
              const account = accounts.find(a => a.accountType === (isStock ? "stocks" : "crypto"));
              if (!account) continue;
              const cash = parseFloat(account.cashBalance);
              const cost = decision.price * decision.quantity;
              if (cost > cash) continue;
              await insertSimPosition({
                accountId: account.id,
                ticker: decision.ticker,
                name: decision.name,
                assetType: decision.assetType,
                quantity: decision.quantity.toString(),
                entryPrice: decision.price.toString(),
                totalCost: cost.toString(),
                entrySignal: decision.signal,
                entryRationale: JSON.stringify(decision.rationale),
                status: "open",
              });
              await insertSimTrade({
                accountId: account.id,
                ticker: decision.ticker,
                assetType: decision.assetType,
                action: "BUY",
                quantity: decision.quantity.toString(),
                price: decision.price.toString(),
                totalValue: cost.toString(),
                rationale: JSON.stringify(decision.rationale),
                pressureScore: pressure.overallPressure,
                regime: pressure.regime,
              });
              const newCash = cash - cost;
              await upsertSimAccount({ ...account, cashBalance: newCash.toString() });
              tradesSummary.push(decision.rationale.actionSummary);
            }
          }
          const updatedAccounts = await getSimAccounts();
          const updatedPositions = await getSimOpenPositions();
          const updatedStocksCash = parseFloat(updatedAccounts.find(a => a.accountType === "stocks")?.cashBalance ?? "10000");
          const updatedCryptoCash = parseFloat(updatedAccounts.find(a => a.accountType === "crypto")?.cashBalance ?? "10000");
          const updatedValuation = await valuateSimPortfolio(updatedPositions, updatedStocksCash, updatedCryptoCash);
          const journal = await generateDailyJournal(
            updatedValuation,
            previousTotal,
            tradesSummary.join(" | ") || "No trades executed",
            pressure,
          );
          // Combine all journal sections into a single markdown journalEntry
          const journalEntry = [
            `## FAULTLINE Portfolio Journal — ${journal.date}`,
            `**Pressure Index:** ${journal.pressureScore}/100 | **Regime:** ${journal.pressureRegime} (${journal.pressureLevel})`,
            `**Portfolio Value:** $${journal.totalValue.toFixed(2)} | **Daily P&L:** ${journal.dailyPnl >= 0 ? '+' : ''}$${journal.dailyPnl.toFixed(2)} (${journal.dailyPnlPct >= 0 ? '+' : ''}${journal.dailyPnlPct.toFixed(2)}%)`,
            `### Macro Narrative`,
            journal.macroNarrative,
            `### Risk Assessment`,
            journal.riskAssessment,
            `### Actions Taken`,
            journal.actionsTaken,
            `### Position Commentary`,
            journal.positionCommentary.map(p => `**${p.ticker}** (${p.action}): ${p.commentary}`).join('\n\n'),
            `### Forward Looking`,
            journal.forwardLooking,
          ].join('\n\n');
          await upsertSimJournalEntry({
            date: journal.date,
            pressureScore: journal.pressureScore,
            regime: journal.pressureRegime,
            totalValue: journal.totalValue.toString(),
            stocksValue: journal.stocksValue.toString(),
            cryptoValue: journal.cryptoValue.toString(),
            dailyPnl: journal.dailyPnl.toString(),
            dailyPnlPct: journal.dailyPnlPct.toString(),
            journalEntry,
            holdingsJson: JSON.stringify(journal.positionCommentary.map(p => p.ticker)),
            tradesJson: JSON.stringify(tradesSummary),
            tradesMade: tradesSummary.length,
          });
          return { success: true, tradesExecuted: tradesSummary.length, journalDate: journal.date };
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Daily update failed", cause: err });
        }
      }),
    }),
  // ── Owner Simulation Module ──────────────────────────────────
  // Private admin-only $100K → $1M virtual trading cockpit.
  ownerSim: router({
    // Get or create the owner's simulation account
    getAccount: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner simulation is admin-only' });
      try {
        const account = await getOrCreateOwnerAccount(ctx.user.id);
        const valuation = await markToMarket(account.id);
        const goal = calcGoalProgress(valuation.totalValue);
        return { account, valuation, goal };
      } catch (err) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load simulation account', cause: err });
      }
    }),

    // Reset account back to $100K (clears all positions and trades)
    resetAccount: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      const { ownerSimulationAccounts: accounts, ownerSimulationPositions: positions, ownerSimulationTrades: trades } = await import('../drizzle/schema');
      const acct = await getOrCreateOwnerAccount(ctx.user.id);
      await db.update(positions).set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() }).where(eq(positions.accountId, acct.id));
      await db.update(accounts).set({ currentCash: '100000.00', currentValue: '100000.00', updatedAt: new Date() }).where(eq(accounts.id, acct.id));
      return { success: true };
    }),

    // Get current objective
    getObjective: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const account = await getOrCreateOwnerAccount(ctx.user.id);
      const objective = await getOwnerObjective(account.id);
      return { objective, objectiveTypes: OBJECTIVE_TYPES };
    }),

    // Set objective for this session
    setObjective: protectedProcedure
      .input(z.object({
        objectiveType: z.enum(['short_swing', 'long_position', 'crypto_momentum', 'defensive', 'ai_tech_momentum', 'custom']),
        assetPreference: z.enum(['stocks', 'crypto', 'both']).default('both'),
        riskMode: z.enum(['aggressive', 'balanced', 'defensive']).default('balanced'),
        maxPositionSizePct: z.number().min(1).max(50).default(10),
        maxLossPerTrade: z.number().min(100).max(50000).default(2000),
        timeframe: z.enum(['intraday', '1_5_days', '2_6_weeks', '3_12_months']).default('1_5_days'),
        customNote: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const account = await getOrCreateOwnerAccount(ctx.user.id);
        await setOwnerObjective({
          accountId: account.id,
          objectiveType: input.objectiveType,
          assetPreference: input.assetPreference,
          riskMode: input.riskMode,
          maxPositionSizePct: input.maxPositionSizePct.toString(),
          maxLossPerTrade: input.maxLossPerTrade.toString(),
          timeframe: input.timeframe,
          customNote: input.customNote ?? null,
        });
        return { success: true };
      }),

    // Scan for real-time trade opportunities
    getOpportunities: protectedProcedure
      .input(z.object({
        assetFilter: z.enum(['stocks', 'crypto', 'both']).default('both'),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        try {
          const account = await getOrCreateOwnerAccount(ctx.user.id);
          const objective = await getOwnerObjective(account.id);
          const valuation = await markToMarket(account.id);
          const opportunities = await scanOpportunities(
            objective,
            valuation.totalValue,
            input?.assetFilter ?? 'both',
          );
          return { opportunities, scannedAt: Date.now() };
        } catch (err) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Opportunity scan failed', cause: err });
        }
      }),

    // Get open positions
    getPositions: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const account = await getOrCreateOwnerAccount(ctx.user.id);
      return getOwnerPositions(account.id);
    }),

    // Get trade history
    getTrades: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(100) }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const account = await getOrCreateOwnerAccount(ctx.user.id);
        return getOwnerTrades(account.id, input?.limit ?? 100);
      }),

    // Enter a simulated trade
    enterTrade: protectedProcedure
      .input(z.object({
        opportunity: z.object({
          id: z.string(),
          ticker: z.string(),
          name: z.string(),
          sector: z.string(),
          assetType: z.enum(['stock', 'crypto']),
          direction: z.enum(['LONG', 'AVOID', 'WATCH', 'TRIM', 'DEFENSIVE']),
          currentPrice: z.number(),
          changePercent: z.number(),
          volume: z.number(),
          marketCap: z.number().nullable(),
          dataFreshness: z.enum(['LIVE', 'DELAYED', 'STALE', 'UNAVAILABLE']),
          entryZoneLow: z.number(),
          entryZoneHigh: z.number(),
          stopLoss: z.number(),
          targetOne: z.number(),
          targetTwo: z.number(),
          riskRewardRatio: z.number(),
          suggestedPositionSizePct: z.number(),
          suggestedPositionSizeUsd: z.number(),
          riskAmountUsd: z.number(),
          faultlineConfidence: z.number(),
          compositeScore: z.number(),
          momentumScore: z.number(),
          macroFit: z.number(),
          objectiveFit: z.boolean(),
          objectiveFitReason: z.string(),
          whyNow: z.string(),
          invalidation: z.string(),
          keyRisks: z.array(z.string()),
          labels: z.array(z.string()),
          fetchedAt: z.number(),
        }),
        side: z.enum(['BUY', 'SELL', 'TRIM', 'ADD']),
        quantity: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        try {
          const account = await getOrCreateOwnerAccount(ctx.user.id);
          const objective = await getOwnerObjective(account.id);
          const pressure = await calculateFaultlinePressure();
          const result = await executeTrade(account.id, input.opportunity, input.side, input.quantity, pressure, objective);
          return result;
        } catch (err) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: (err as Error).message, cause: err });
        }
      }),

    // Close a position by symbol
    closePosition: protectedProcedure
      .input(z.object({
        symbol: z.string(),
        assetType: z.enum(['stock', 'crypto']),
        currentPrice: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        try {
          const account = await getOrCreateOwnerAccount(ctx.user.id);
          const objective = await getOwnerObjective(account.id);
          const pressure = await calculateFaultlinePressure();
          // Build a minimal opportunity object for executeTrade
          const fakeOpp = {
            id: `close-${input.symbol}`,
            ticker: input.symbol,
            name: input.symbol,
            sector: 'N/A',
            assetType: input.assetType,
            direction: 'AVOID' as const,
            currentPrice: input.currentPrice,
            changePercent: 0,
            volume: 0,
            marketCap: null,
            dataFreshness: 'LIVE' as const,
            entryZoneLow: input.currentPrice,
            entryZoneHigh: input.currentPrice,
            stopLoss: input.currentPrice * 0.9,
            targetOne: input.currentPrice * 1.1,
            targetTwo: input.currentPrice * 1.2,
            riskRewardRatio: 1.5,
            suggestedPositionSizePct: 10,
            suggestedPositionSizeUsd: 10000,
            riskAmountUsd: 1000,
            faultlineConfidence: 50,
            compositeScore: 50,
            momentumScore: 50,
            macroFit: 50,
            objectiveFit: true,
            objectiveFitReason: 'Manual close',
            whyNow: 'Manual position close',
            invalidation: 'N/A',
            keyRisks: [],
            labels: [],
            fetchedAt: Date.now(),
          };
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
          const { ownerSimulationPositions: positions } = await import('../drizzle/schema');
          const { and: andOp, eq: eqOp } = await import('drizzle-orm');
          const openPos = await db.select().from(positions)
            .where(andOp(eqOp(positions.accountId, account.id), eqOp(positions.symbol, input.symbol), eqOp(positions.status, 'open')))
            .limit(1);
          if (!openPos[0]) throw new TRPCError({ code: 'NOT_FOUND', message: `No open position for ${input.symbol}` });
          const qty = parseFloat(openPos[0].quantity.toString());
          const result = await executeTrade(account.id, fakeOpp, 'SELL', qty, pressure, objective);
          return result;
        } catch (err) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: (err as Error).message, cause: err });
        }
      }),

    // Mark-to-market valuation
    getValuation: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const account = await getOrCreateOwnerAccount(ctx.user.id);
      return markToMarket(account.id);
    }),

    // Goal progress
    getGoalProgress: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const account = await getOrCreateOwnerAccount(ctx.user.id);
      const valuation = await markToMarket(account.id);
      return calcGoalProgress(valuation.totalValue);
    }),

    // Daily snapshots
    getDailySnapshots: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(90).default(30) }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const account = await getOrCreateOwnerAccount(ctx.user.id);
        return getDailySnapshots(account.id, input?.limit ?? 30);
      }),

    // Generate today's AI journal entry
    generateJournal: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      try {
        const account = await getOrCreateOwnerAccount(ctx.user.id);
        const objective = await getOwnerObjective(account.id);
        const valuation = await markToMarket(account.id);
        const trades = await getOwnerTrades(account.id, 20);
        const today = new Date().toISOString().slice(0, 10);
        const todayTrades = trades.filter(t => t.createdAt && new Date(t.createdAt).toISOString().slice(0, 10) === today);
        const pressure = await calculateFaultlinePressure();
        const journal = await generateOwnerJournal(account.id, objective, todayTrades, valuation.totalValue, pressure);
        // Save snapshot
        await upsertDailySnapshot({
          accountId: account.id,
          date: today,
          endValue: valuation.totalValue.toString(),
          dailyPnl: (valuation.totalValue - 100000).toString(),
          dailyReturnPct: (((valuation.totalValue - 100000) / 100000) * 100).toString(),
          tradesCount: todayTrades.length,
          aiSummary: journal,
        });
        return { journal, savedAt: Date.now() };
      } catch (err) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Journal generation failed', cause: err });
      }
    }),

    // Reject a trade opportunity with a reason
    rejectTrade: protectedProcedure
      .input(z.object({
        symbol: z.string(),
        assetType: z.enum(['stock', 'crypto']),
        price: z.number(),
        reason: z.string().min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const account = await getOrCreateOwnerAccount(ctx.user.id);
        const objective = await getOwnerObjective(account.id);
        const pressure = await calculateFaultlinePressure();
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { ownerSimulationTrades: trades } = await import('../drizzle/schema');
        await db.insert(trades).values({
          accountId: account.id,
          symbol: input.symbol,
          assetType: input.assetType,
          side: 'BUY',
          quantity: '0',
          entryPrice: input.price.toString(),
          notionalValue: '0',
          faultlineScoreAtEntry: pressure.overallPressure,
          pressureIndexAtEntry: pressure.overallPressure,
          regimeAtEntry: pressure.regime,
          objective: objective?.objectiveType ?? null,
          rationale: `REJECTED: ${input.reason}`,
          status: 'rejected',
          rejectionReason: input.reason,
        });
                return { success: true };
      }),

    getOptimalAction: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const account = await getOrCreateOwnerAccount(ctx.user.id);
        const valuation = await markToMarket(account.id);
        return await getOptimalAction(account.id, valuation.totalValue);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Optimal action generation failed', cause: err });
      }
    }),

    // Manual ticker lookup — build a full TradeOpportunity on demand for any stock or crypto symbol
    lookupTicker: protectedProcedure
      .input(z.object({
        symbol: z.string().min(1).max(20).transform(s => s.toUpperCase().trim()),
        assetType: z.enum(['stock', 'crypto']),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const account = await getOrCreateOwnerAccount(ctx.user.id);
        const objective = await getOwnerObjective(account.id);
        const valuation = await markToMarket(account.id);
        const pressure = await calculateFaultlinePressure();

        if (input.assetType === 'stock') {
          const { getQuote } = await import('./yahooProxy');
          const quote = await getQuote(input.symbol);
          if (!quote.price || quote.source === 'error') {
            throw new TRPCError({ code: 'NOT_FOUND', message: `No price data found for ${input.symbol}. Verify the ticker symbol and try again.` });
          }
          const opp = await buildStockOpportunity(
            input.symbol,
            (quote as { name?: string }).name ?? input.symbol,
            (quote as { sector?: string }).sector ?? 'Unknown',
            pressure,
            objective,
            valuation.totalValue,
          );
          if (!opp) throw new TRPCError({ code: 'NOT_FOUND', message: `Could not build opportunity for ${input.symbol}` });
          return opp;
        } else {
          // Crypto — resolve symbol to CoinGecko ID, fallback to search
          let coinData = await getCoinMarketData(input.symbol);
          if (!coinData) {
            const results = await searchCoins(input.symbol);
            if (results.length > 0) coinData = await getCoinMarketData(results[0].id);
          }
          if (!coinData) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `No CoinGecko data found for "${input.symbol}". Try the full coin name (e.g. "bittensor") or check the symbol.` });
          }
          const rawPrice = {
            usd: coinData.currentPrice,
            usd_24h_change: coinData.priceChangePercent24h ?? 0,
            usd_24h_vol: coinData.totalVolume ?? 0,
            usd_market_cap: coinData.marketCap ?? 0,
          };
          const opp = await buildCryptoOpportunity(
            input.symbol,
            coinData.id,
            coinData.name,
            rawPrice,
            pressure,
            objective,
            valuation.totalValue,
          );
          if (!opp) throw new TRPCError({ code: 'NOT_FOUND', message: `Could not build crypto opportunity for ${input.symbol}` });
          return opp;
        }
      }),
  }),
  sharedReports: router({
    // Create a shareable public link for a report (premium/founding/admin only)
    create: protectedProcedure
      .input(z.object({
        reportType: z.enum(['stock_intelligence', 'crypto_intelligence', 'market_preflight', 'diagnostic_ai', 'daily_report']),
        subject: z.string().min(1).max(64),
        snapshotJson: z.string().min(2).max(500000),
        expiresInDays: z.number().min(1).max(365).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tier = ctx.user.accessTier;
        if (!['premium', 'founding'].includes(tier) && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Share links require Premium or Founding access' });
        }
        const { nanoid } = await import('nanoid');
        const publicShareId = nanoid(21);
        const expiresAt = input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 86400 * 1000)
          : undefined;
        const result = await createSharedReport({
          ownerUserId: ctx.user.id,
          reportType: input.reportType,
          subject: input.subject,
          publicShareId,
          snapshotJson: input.snapshotJson,
          expiresAt,
        });
        return { id: result.id, publicShareId, shareUrl: `/r/${publicShareId}` };
      }),

    // Fetch a public report by its share ID (no auth required)
    getPublic: publicProcedure
      .input(z.object({ publicShareId: z.string().min(10).max(32) }))
      .query(async ({ input }) => {
        const report = await getSharedReportByPublicId(input.publicShareId);
        if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found' });
        if (report.revoked) throw new TRPCError({ code: 'FORBIDDEN', message: 'This link has been revoked' });
        if (report.expiresAt && new Date(report.expiresAt) < new Date()) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'This link has expired' });
        }
        incrementSharedReportViewCount(input.publicShareId).catch(() => {});
        return {
          id: report.id,
          reportType: report.reportType,
          subject: report.subject,
          snapshotJson: report.snapshotJson,
          viewCount: report.viewCount,
          createdAt: report.createdAt,
          expiresAt: report.expiresAt,
        };
      }),

    // List all share links created by the current user
    listMine: protectedProcedure
      .query(async ({ ctx }) => {
        const reports = await listSharedReportsByUser(ctx.user.id);
        return reports.map(r => ({
          id: r.id,
          reportType: r.reportType,
          subject: r.subject,
          publicShareId: r.publicShareId,
          shareUrl: `/r/${r.publicShareId}`,
          viewCount: r.viewCount,
          revoked: r.revoked === 1,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
        }));
      }),

    // Revoke a share link (owner only)
    revoke: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await revokeSharedReport(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  social: router({
    getIntelligence: publicProcedure
      .query(async () => {
        try {
          const { getSocialIntelligenceData } = await import('./socialIntelligence');
          return getSocialIntelligenceData();
        } catch (err) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Social intelligence fetch failed', cause: err });
        }
      }),

    getTickerNews: publicProcedure
      .input(z.object({ ticker: z.string().min(1).max(10).toUpperCase() }))
      .query(async ({ input }) => {
        try {
          const { getSocialIntelligenceData } = await import('./socialIntelligence');
          const data = await getSocialIntelligenceData();
          const tickerNews = data.latestNews.filter(n =>
            n.tickers.includes(input.ticker) || n.primaryTicker === input.ticker
          );
          const sentiment = data.sentimentLeaderboard.find(s => s.ticker === input.ticker) ?? null;
          return { news: tickerNews, sentiment };
        } catch (err) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Ticker news fetch failed', cause: err });
        }
      }),

    searchTicker: publicProcedure
      .input(z.object({
        symbol: z.string().min(1).max(10).trim().transform(s => s.toUpperCase()),
        assetType: z.enum(['stock', 'crypto']).default('stock'),
      }))
      .query(async ({ input }) => {
        try {
          const { getTickerSocialData } = await import('./socialIntelligence');
          return getTickerSocialData(input.symbol, input.assetType);
        } catch (err) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Ticker social search failed', cause: err });
        }
      }),

    clearCache: protectedProcedure
      .mutation(async () => {
        const { clearSocialIntelligenceCache, clearTickerSocialCache } = await import('./socialIntelligence');
        clearSocialIntelligenceCache();
        clearTickerSocialCache();
        return { cleared: true };
      }),
  }),

  mobileUsage: router({
    /** Full usage summary for the Account tab and upgrade prompts */
    getUsageSummary: protectedProcedure.query(async ({ ctx }) => {
      const row = await getMobileUsageToday(ctx.user.id);
      const monthlyCount = await getSituationRoomMonthlyCount(ctx.user.id);
      const tier = ctx.user.accessTier as string;
      const isPro = tier === 'premium' || tier === 'founding';
      const isPaid = tier === 'core' || isPro;
      const limits = {
        stockSignals:   isPro ? null : (isPaid ? 10 : 3),
        cryptoSignals:  isPro ? null : (isPaid ? 5  : 2),
        signalOutlooks: isPro ? null : (isPaid ? 1  : 0),
        situationRoom:  isPro ? null : (isPaid ? 3  : 0),
        watchlist:      isPro ? null : 20,
      };
      const usage = {
        stockSignalsViewed:  row?.stockSignalsViewed  ?? 0,
        cryptoSignalsViewed: row?.cryptoSignalsViewed ?? 0,
        signalOutlooksRun:   row?.signalOutlooksRun   ?? 0,
        situationRoomCount:  monthlyCount,
      };
      return { usage, limits, tier, isPaid, isPro };
    }),

    /** Check if a feature is available and return remaining count */
    canUseFeature: protectedProcedure
      .input(z.object({
        feature: z.enum(['stockSignals', 'cryptoSignals', 'signalOutlooks', 'situationRoom']),
      }))
      .query(async ({ ctx, input }) => {
        const tier = ctx.user.accessTier as string;
        const isPro = tier === 'premium' || tier === 'founding';
        const isPaid = tier === 'core' || isPro;
        if (isPro) return { allowed: true, remaining: null, limit: null, upgradeMessage: null };
        const row = await getMobileUsageToday(ctx.user.id);
        const monthlyCount = await getSituationRoomMonthlyCount(ctx.user.id);
        const limits: Record<string, number> = {
          stockSignals:   isPaid ? 10 : 3,
          cryptoSignals:  isPaid ? 5  : 2,
          signalOutlooks: isPaid ? 1  : 0,
          situationRoom:  isPaid ? 3  : 0,
        };
        const used: Record<string, number> = {
          stockSignals:   row?.stockSignalsViewed  ?? 0,
          cryptoSignals:  row?.cryptoSignalsViewed ?? 0,
          signalOutlooks: row?.signalOutlooksRun   ?? 0,
          situationRoom:  monthlyCount,
        };
        const limit = limits[input.feature];
        const current = used[input.feature];
        const remaining = Math.max(0, limit - current);
        const allowed = remaining > 0;
        const upgradeMessage = allowed ? null
          : isPaid
            ? `Daily limit reached. Upgrade to Pro for unlimited ${input.feature === 'situationRoom' ? 'monthly' : 'daily'} access.`
            : `Upgrade to Core to unlock this feature.`;
        return { allowed, remaining, limit, upgradeMessage };
      }),

    /** Log stock signal view and return updated count */
    logStockSignalView: protectedProcedure.mutation(async ({ ctx }) => {
      const count = await incrementMobileUsage(ctx.user.id, 'stockSignalsViewed');
      return { count };
    }),
    /** Log crypto signal view and return updated count */
    logCryptoSignalView: protectedProcedure.mutation(async ({ ctx }) => {
      const count = await incrementMobileUsage(ctx.user.id, 'cryptoSignalsViewed');
      return { count };
    }),
    /** Log Signal Outlook run and return updated count */
    logSignalOutlookRun: protectedProcedure.mutation(async ({ ctx }) => {
      const count = await incrementMobileUsage(ctx.user.id, 'signalOutlooksRun');
      return { count };
    }),
    /** Log Situation Room simulation and return updated monthly count */
    logSituationRoomRun: protectedProcedure.mutation(async ({ ctx }) => {
      const count = await incrementSituationRoomUsage(ctx.user.id);
      return { count };
    }),

    // Legacy aliases kept for backward compatibility
    getToday: protectedProcedure.query(async ({ ctx }) => {
      const row = await getMobileUsageToday(ctx.user.id);
      const monthlyCount = await getSituationRoomMonthlyCount(ctx.user.id);
      const tier = ctx.user.accessTier as string;
      const isPro = tier === 'premium' || tier === 'founding';
      const isPaid = tier === 'core' || isPro;
      return {
        stockSignalsViewed: row?.stockSignalsViewed ?? 0,
        cryptoSignalsViewed: row?.cryptoSignalsViewed ?? 0,
        signalOutlooksRun: row?.signalOutlooksRun ?? 0,
        situationRoomCount: monthlyCount,
        limits: {
          stockSignals: isPaid ? (isPro ? null : 10) : 3,
          cryptoSignals: isPaid ? (isPro ? null : 5) : 2,
          signalOutlooks: isPaid ? (isPro ? null : 1) : 0,
          situationRoom: isPaid ? (isPro ? null : 3) : 0,
        },
        tier, isPaid, isPro,
      };
    }),
    incrementStockSignals: protectedProcedure.mutation(async ({ ctx }) => {
      const count = await incrementMobileUsage(ctx.user.id, 'stockSignalsViewed');
      return { count };
    }),
    incrementCryptoSignals: protectedProcedure.mutation(async ({ ctx }) => {
      const count = await incrementMobileUsage(ctx.user.id, 'cryptoSignalsViewed');
      return { count };
    }),
    incrementSignalOutlooks: protectedProcedure.mutation(async ({ ctx }) => {
      const count = await incrementMobileUsage(ctx.user.id, 'signalOutlooksRun');
      return { count };
    }),
    incrementSituationRoom: protectedProcedure.mutation(async ({ ctx }) => {
      const count = await incrementSituationRoomUsage(ctx.user.id);
      return { count };
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
        const ownerResult = await sendEmail(ownerEmail);
        if (!ownerResult.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: ownerResult.error ?? 'Failed to send message. Please try again or email us directly at jt@getfaultline.live',
          });
        }
        // Auto-reply is best-effort — don't block the response on failure
        const autoReply = buildContactAutoReply({ name: input.name, email: input.email, subject: input.subject });
        sendEmail(autoReply).catch((err) => {
          console.warn('[Contact] Auto-reply failed (non-fatal):', err);
        });
        return { success: true };
      }),
  }),

  // ── Day Trade Intelligence™ ─────────────────────────────────────
  dayTrade: router({
    getFavorability: coreProcedure.query(async () => {
      const result = await getDayTradeFavorability();
      const sanitizeNumbers = (v: unknown): unknown => {
        if (typeof v === 'number') return (isFinite(v) && !isNaN(v)) ? v : 0;
        if (v === null || v === undefined) return v;
        if (Array.isArray(v)) return v.map(sanitizeNumbers);
        if (typeof v === 'object') {
          return Object.fromEntries(
            Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, sanitizeNumbers(val)])
          );
        }
        return v;
      };
      return sanitizeNumbers(result) as typeof result;
    }),
    scan: coreProcedure
      .input(z.object({
        assetType: z.enum(["stock", "crypto", "both"]).default("both"),
        capBucket: z.enum(["low", "mid", "large", "mixed"]).default("mixed"),
        direction: z.enum(["bullish", "bearish", "both"]).default("both"),
        riskProfile: z.enum(["aggressive", "balanced", "conservative"]).default("balanced"),
        maxResults: z.number().min(1).max(30).default(12),
      }))
      .query(async ({ input }) => {
        const sanitizeNumbers = (v: unknown): unknown => {
          if (typeof v === 'number') return (isFinite(v) && !isNaN(v)) ? v : 0;
          if (v === null || v === undefined) return v;
          if (Array.isArray(v)) return v.map(sanitizeNumbers);
          if (typeof v === 'object') {
            return Object.fromEntries(
              Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, sanitizeNumbers(val)])
            );
          }
          return v;
        };
        const cacheKey = `scan:${input.assetType}:${input.capBucket}:${input.direction}:${input.riskProfile}:${input.maxResults}`;
        const t0 = Date.now();
        // ── Tier 1: Live data ──────────────────────────────────────────────────
        try {
          const results = await dayTradeScanner(input);
          const clean = sanitizeNumbers(results) as typeof results;
          // Persist snapshot for Tier 2 fallback (fire-and-forget)
          saveDayTradeSnapshot(cacheKey, clean).catch(() => {});
          return { data: clean, source: 'live' as const, snapshotAge: null as number | null };
        } catch (liveErr) {
          const latencyMs = Date.now() - t0;
          console.error('[dayTrade.scan] Live scan failed, trying snapshot:', liveErr);
          logPipelineFailure({
            provider: 'polygon',
            endpoint: 'dayTradeScanner',
            latencyMs,
            failureReason: String(liveErr),
            retryAttempts: 0,
            recoveryStatus: 'snapshot',
            autoRecovered: true,
          }).catch(() => {});
        }
        // ── Tier 2: DB snapshot ───────────────────────────────────────────────
        try {
          const snap = await loadDayTradeSnapshot(cacheKey);
          if (snap && snap.payload) {
            const ageMs = Date.now() - snap.capturedAt;
            const clean = sanitizeNumbers(snap.payload) as Awaited<ReturnType<typeof dayTradeScanner>>;
            return { data: clean, source: 'snapshot' as const, snapshotAge: ageMs };
          }
        } catch (snapErr) {
          console.error('[dayTrade.scan] Snapshot load failed:', snapErr);
          logPipelineFailure({
            provider: 'other',
            endpoint: 'loadDayTradeSnapshot',
            latencyMs: Date.now() - t0,
            failureReason: String(snapErr),
            recoveryStatus: 'fallback',
            autoRecovered: false,
          }).catch(() => {});
        }
        // ── Tier 3: Institutional Fallback ────────────────────────────────────
        return { data: [] as Awaited<ReturnType<typeof dayTradeScanner>>, source: 'fallback' as const, snapshotAge: null as number | null };
      }),
    symbolSetup: coreProcedure
      .input(z.object({
        symbol: z.string().min(1).max(20).toUpperCase(),
        assetType: z.enum(["stock", "crypto"]),
        direction: z.enum(["bullish", "bearish", "both"]).default("both"),
      }))
      .query(async ({ input }) => {
        try {
          const result = await dayTradeSymbolSetup(input.symbol, input.assetType, input.direction);
          // Sanitize all numeric fields to prevent NaN/Infinity from causing SuperJSON
          // "Unable to transform response from server" errors on the client
          const sanitizeNumbers = (v: unknown): unknown => {
            if (typeof v === 'number') return (isFinite(v) && !isNaN(v)) ? v : 0;
            if (v === null || v === undefined) return v;
            if (Array.isArray(v)) return v.map(sanitizeNumbers);
            if (typeof v === 'object') {
              return Object.fromEntries(
                Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, sanitizeNumbers(val)])
              );
            }
            return v;
          };
          return sanitizeNumbers(result) as typeof result;
        } catch (err) {
          console.error('[symbolSetup] Error for', input.symbol, err);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Unable to generate analysis for ${input.symbol}. Live market data may be unavailable or the symbol may be invalid.`,
          });
        }
      }),
    getWatchlist: coreProcedure.query(async ({ ctx }) => {
      return await getDayTradeWatchlist(ctx.user.id);
    }),
    addToWatchlist: coreProcedure
      .input(z.object({
        symbol: z.string().min(1).max(20),
        assetType: z.enum(["stock", "crypto"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await addDayTradeWatchlistItem({
          userId: ctx.user.id,
          symbol: input.symbol.toUpperCase(),
          assetType: input.assetType,
        });
        return { id, symbol: input.symbol.toUpperCase() };
      }),
    removeFromWatchlist: coreProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .mutation(async ({ ctx, input }) => {
        await removeDayTradeWatchlistItem(ctx.user.id, input.symbol.toUpperCase());
        return { success: true };
      }),
    isWatchlisted: coreProcedure
      .input(z.object({ symbol: z.string().min(1).max(20) }))
      .query(async ({ ctx, input }) => {
        return { watchlisted: await isDayTradeWatchlisted(ctx.user.id, input.symbol.toUpperCase()) };
      }),
        clearCache: protectedProcedure.mutation(() => {
      clearDayTradeCache();
      return { success: true };
    }),
  }),
  // ── Pipeline Health ──────────────────────────────────────────────────────
  pipelineHealth: router({
    // Get recent pipeline failure logs (admin only)
    logs: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(500).default(200) }))
      .query(async ({ input }) => {
        return await getPipelineHealthLogs(input.limit);
      }),
    // Get per-provider summary (admin only)
    summary: protectedProcedure.query(async () => {
      return await getPipelineHealthSummary();
    }),
  }),
  // ── Trade Journal (Performance Tracking) ────────────────────────────────
  tradeJournal: router({
    // Get all journal entries for the current user
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getTradeJournalEntries(ctx.user.id, 200);
    }),

    // Get performance stats summary
    stats: protectedProcedure.query(async ({ ctx }) => {
      return await getTradeJournalStats(ctx.user.id);
    }),

    // Log a new trade entry
    add: protectedProcedure
      .input(z.object({
        symbol:        z.string().min(1).max(20).toUpperCase(),
        assetType:     z.enum(['stock', 'crypto']).default('stock'),
        direction:     z.enum(['long', 'short']).default('long'),
        entryPrice:    z.number().positive(),
        exitPrice:     z.number().positive().optional(),
        quantity:      z.number().positive(),
        stopLoss:      z.number().positive().optional(),
        target:        z.number().positive().optional(),
        realizedPnl:   z.number().optional(),
        pnlPercent:    z.number().optional(),
        outcome:       z.enum(['win', 'loss', 'breakeven', 'open']).default('open'),
        setupGrade:    z.string().max(4).optional(),
        executionScore: z.number().min(0).max(100).optional(),
        notes:         z.string().max(2000).optional(),
        tags:          z.string().max(300).optional(),
        followedSetup: z.boolean().default(false),
        enteredAt:     z.string().datetime(),
        exitedAt:      z.string().datetime().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await insertTradeJournalEntry({
          userId:        ctx.user.id,
          symbol:        input.symbol,
          assetType:     input.assetType,
          direction:     input.direction,
          entryPrice:    String(input.entryPrice),
          exitPrice:     input.exitPrice != null ? String(input.exitPrice) : null,
          quantity:      String(input.quantity),
          stopLoss:      input.stopLoss != null ? String(input.stopLoss) : null,
          target:        input.target != null ? String(input.target) : null,
          realizedPnl:   input.realizedPnl != null ? String(input.realizedPnl) : null,
          pnlPercent:    input.pnlPercent != null ? String(input.pnlPercent) : null,
          outcome:       input.outcome,
          setupGrade:    input.setupGrade ?? null,
          executionScore: input.executionScore ?? null,
          notes:         input.notes ?? null,
          tags:          input.tags ?? null,
          followedSetup: input.followedSetup ? 1 : 0,
          enteredAt:     new Date(input.enteredAt),
          exitedAt:      input.exitedAt ? new Date(input.exitedAt) : null,
        });
        return { id };
      }),

    // Update / close an existing entry
    update: protectedProcedure
      .input(z.object({
        id:            z.number(),
        exitPrice:     z.number().positive().optional(),
        quantity:      z.number().positive().optional(),
        stopLoss:      z.number().positive().optional(),
        target:        z.number().positive().optional(),
        realizedPnl:   z.number().optional(),
        pnlPercent:    z.number().optional(),
        outcome:       z.enum(['win', 'loss', 'breakeven', 'open']).optional(),
        setupGrade:    z.string().max(4).optional(),
        executionScore: z.number().min(0).max(100).optional(),
        notes:         z.string().max(2000).optional(),
        tags:          z.string().max(300).optional(),
        followedSetup: z.boolean().optional(),
        exitedAt:      z.string().datetime().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, followedSetup, exitPrice, quantity, stopLoss, target, realizedPnl, pnlPercent, exitedAt, ...rest } = input;
        await updateTradeJournalEntry(id, ctx.user.id, {
          ...rest,
          ...(exitPrice != null && { exitPrice: String(exitPrice) }),
          ...(quantity != null && { quantity: String(quantity) }),
          ...(stopLoss != null && { stopLoss: String(stopLoss) }),
          ...(target != null && { target: String(target) }),
          ...(realizedPnl != null && { realizedPnl: String(realizedPnl) }),
          ...(pnlPercent != null && { pnlPercent: String(pnlPercent) }),
          ...(followedSetup != null && { followedSetup: followedSetup ? 1 : 0 }),
          ...(exitedAt != null && { exitedAt: new Date(exitedAt) }),
        });
        return { success: true };
      }),

    // Delete a journal entry
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteTradeJournalEntry(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ── Chatbot Concierge ─────────────────────────────────────────────
  chatbot: router({
    // Start or resume a session
    startSession: publicProcedure
      .input(z.object({
        visitorId: z.string().max(64),
        pageUrl:   z.string().max(512).optional(),
      }))
      .mutation(async ({ input }) => {
        const sessionId = await createChatbotSession({
          visitorId: input.visitorId,
          pageUrl:   input.pageUrl,
        });
        return { sessionId };
      }),

    // Send a message and get a bot response
    sendMessage: publicProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        visitorId: z.string().max(64),
        message:   z.string().min(1).max(2000),
      }))
      .mutation(async ({ input }) => {
        // Fetch conversation history
        const history = await getChatbotMessages(input.sessionId);
        const chatHistory = history.map(m => ({ role: m.role as 'user' | 'bot', content: m.content }));

        // Detect intent
        const analysis = detectIntent(input.message);

        // Store user message
        await addChatbotMessage({
          sessionId: input.sessionId,
          role: 'user',
          content: input.message,
          intent: analysis.intent,
        });

        // Generate bot response
        const botResponse = await generateBotResponse(chatHistory, input.message);

        // Store bot message
        await addChatbotMessage({
          sessionId: input.sessionId,
          role: 'bot',
          content: botResponse,
          intent: analysis.intent,
        });

        // Recompute aggregate lead score from all messages
        const allHistory = await getChatbotMessages(input.sessionId);
        const allUserMessages = allHistory.filter(m => m.role === 'user');
        const allAnalyses = allUserMessages.map(m => detectIntent(m.content));
        const leadScore = aggregateLeadScore(allAnalyses);
        const securitiesMentioned = Array.from(
          new Set(allAnalyses.flatMap(a => a.securitiesMentioned))
        ).join(',');
        const planInterest = allAnalyses.find(a => a.planInterest)?.planInterest ?? null;
        const signupIntent = allAnalyses.some(a => a.signupIntent) ? 1 : 0;
        const pricingIntent = allAnalyses.some(a => a.pricingIntent) ? 1 : 0;

        await updateChatbotSession(input.sessionId, {
          leadScore,
          securitiesMentioned: securitiesMentioned || undefined,
          planInterest: planInterest ?? undefined,
          signupIntent,
          pricingIntent,
        });

        // Ask for email if high intent and not yet captured
        const askForEmail = leadScore >= 50 && (analysis.pricingIntent || analysis.signupIntent || analysis.intent === 'upgrade');

        return {
          response: botResponse,
          intent: analysis.intent,
          leadScore,
          askForEmail,
          securitiesMentioned: analysis.securitiesMentioned,
        };
      }),

    // Capture lead email
    captureLead: publicProcedure
      .input(z.object({
        sessionId:   z.number().int().positive(),
        visitorId:   z.string().max(64),
        email:       z.string().email().max(320),
        interest:    z.string().max(500).optional(),
        planInterest: z.string().max(32).optional(),
        leadScore:   z.number().int().min(0).max(100).optional(),
      }))
      .mutation(async ({ input }) => {
        await createChatbotLead({
          sessionId:    input.sessionId,
          visitorId:    input.visitorId,
          email:        input.email,
          interest:     input.interest,
          planInterest: input.planInterest,
          leadScore:    input.leadScore ?? 0,
        });
        return { success: true };
      }),

    // ── Admin procedures ──────────────────────────────────────────────
    admin: router({
      getSessions: protectedProcedure
        .input(z.object({
          filter: z.enum(['all', 'new_leads', 'pricing', 'security', 'high_intent', 'converted', 'needs_review']).default('all'),
          limit:  z.number().int().min(1).max(200).default(50),
          offset: z.number().int().min(0).default(0),
        }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
          return getChatbotSessions(input);
        }),

      getSession: protectedProcedure
        .input(z.object({ sessionId: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
          return getChatbotSessionWithMessages(input.sessionId);
        }),

      markReviewed: protectedProcedure
        .input(z.object({ sessionId: z.number().int().positive(), reviewed: z.boolean() }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
          await markChatbotSessionReviewed(input.sessionId, input.reviewed);
          return { success: true };
        }),

      addNote: protectedProcedure
        .input(z.object({ sessionId: z.number().int().positive(), note: z.string().max(2000) }))
        .mutation(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
          await addChatbotAdminNote(input.sessionId, input.note);
          return { success: true };
        }),

      getStats: protectedProcedure
        .query(async ({ ctx }) => {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
          return getChatbotStats();
        }),

      getLeads: protectedProcedure
        .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
        .query(async ({ ctx, input }) => {
          if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
          return getChatbotLeads(input.limit);
        }),
    }),
  }),

  // ── S.O.B.™ — Signals of Breakdown ────────────────────────────────
  sob: router({
    getSOB: publicProcedure
      .input(z.object({
        regime:        z.string().optional(),
        pressureIndex: z.number().optional(),
        yieldSpread:   z.number().nullable().optional(),
        fedFundsRate:  z.number().nullable().optional(),
        vix:           z.number().nullable().optional(),
        creditSpread:  z.number().nullable().optional(),
      }))
      .query(({ input }) => {
        return computeSOB({
          regime:        input.regime,
          pressureIndex: input.pressureIndex,
          yieldSpread:   input.yieldSpread ?? null,
          fedFundsRate:  input.fedFundsRate ?? null,
          vix:           input.vix ?? null,
          creditSpread:  input.creditSpread ?? null,
        });
      }),
  }),
});
export type AppRouter = typeof appRouter;
