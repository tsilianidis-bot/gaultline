/**
 * signals router — ticker classification and trading signal computation.
 * Extracted from server/routers.ts as part of Stage 5 large-file decomposition.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, coreProcedure } from "../_core/trpc";
import { classifyTicker, clearClassCache, getClassCacheStats } from "../signalsClassifier";
import { computeTradingSignals, computeTradingSignal, clearSignalCache } from "../tradingSignals";
import { getDailyBars, getQuote } from "../yahooProxy";
import { getLatestSeismographOutput } from "../scheduledSeismograph";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isObservedNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildRelativeStrength(price: number, closes: number[]): number | null {
  if (closes.length < 20) return null;
  const sma20 = closes.slice(-20).reduce((sum, close) => sum + close, 0) / 20;
  if (!Number.isFinite(sma20) || sma20 <= 0) return null;

  // 50 is neutral at the completed 20-session average. Each +/- 1% from the
  // average contributes five normalized points; values remain bounded 0–100.
  return Math.round(clamp(50 + ((price / sma20) - 1) * 500, 0, 100));
}

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
  // Canonical, source-backed visual-detail payload for /app/signals/:symbol.
  // This intentionally leaves the scanner procedures above unchanged.
  getSignalVisualDetail: coreProcedure
    .input(z.object({
      symbol: z.string().min(1).max(10).trim().regex(/^[A-Za-z0-9.\-]+$/).transform(symbol => symbol.toUpperCase()),
    }))
    .query(async ({ input }) => {
      const [quoteResult, barsResult, seismographResult] = await Promise.allSettled([
        getQuote(input.symbol),
        getDailyBars(input.symbol, "3mo"),
        getLatestSeismographOutput(),
      ]);

      const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
      const bars = barsResult.status === "fulfilled" ? barsResult.value : [];
      const seismograph = seismographResult.status === "fulfilled" ? seismographResult.value : null;
      const closes = bars.map(bar => bar.close);
      const latestBar = bars.at(-1) ?? null;
      const avgVolume = bars.length >= 20
        ? bars.slice(-20).reduce((sum, bar) => sum + bar.volume, 0) / 20
        : null;

      const quoteFieldsAvailable = Boolean(
        quote &&
        quote.source !== "error" &&
        isObservedNumber(quote.price) &&
        isObservedNumber(quote.open) &&
        isObservedNumber(quote.high) &&
        isObservedNumber(quote.low) &&
        isObservedNumber(quote.changePercent) &&
        isObservedNumber(quote.volume)
      );
      const barsAvailable = bars.length >= 15;
      const regimeAvailable = Boolean(
        seismograph &&
        typeof seismograph.regime === "string" &&
        isObservedNumber(seismograph.pressureScore)
      );

      const regime = regimeAvailable && seismograph
        ? {
            label: seismograph.regime,
            score: clamp(seismograph.pressureScore / 10, 0, 10),
            pressureIndex: seismograph.pressureScore,
            direction: seismograph.direction,
            freshness: seismograph.dataFreshness,
            computedAt: seismograph.computedAt,
          }
        : null;

      const relativeStrength = quoteFieldsAvailable && quote
        ? buildRelativeStrength(quote.price, closes)
        : null;
      const sparklineBars = bars.slice(-5);
      const sparklineBase = sparklineBars[0]?.close;
      const sparkline = sparklineBase && sparklineBase > 0
        ? sparklineBars.map(bar => Number((((bar.close - sparklineBase) / sparklineBase) * 100).toFixed(4)))
        : [];

      const signal = quoteFieldsAvailable && quote && barsAvailable && regime && relativeStrength !== null && avgVolume !== null
        ? computeTradingSignal({
            ticker: input.symbol,
            price: quote.price,
            open: quote.open,
            high: quote.high,
            low: quote.low,
            changePercent: quote.changePercent,
            volumeMillions: quote.volume / 1_000_000,
            avgVolume: avgVolume / 1_000_000,
            sparkline,
            relativeStrength,
            dailyBars: bars,
          }, regime)
        : null;

      const quoteStatus = quoteFieldsAvailable ? "available" : "unavailable";
      const barsStatus = bars.length >= 15 ? "available" : bars.length > 0 ? "limited" : "unavailable";
      const regimeStatus = regime ? "available" : "unavailable";
      const signalStatus = signal ? "available" : "unavailable";
      const observedAt = quote?.observedAt ?? latestBar?.timestamp ?? seismograph?.computedAt ?? null;

      return {
        symbol: input.symbol,
        quote,
        bars,
        signal,
        regime,
        relativeStrength,
        avgVolume,
        observedAt,
        providerHealth: {
          quote: {
            status: quoteStatus,
            source: quote?.source ?? "unavailable",
            observedAt: quote?.observedAt ?? null,
            fetchedAt: quote?.fetchedAt ?? null,
            detail: quoteFieldsAvailable
              ? `${quote?.isDelayed ? "Delayed" : "Observed"} market quote available.`
              : quote?.error ?? "The market quote is not available with the fields required for a signal calculation.",
          },
          dailyBars: {
            status: barsStatus,
            source: "yahoo",
            completedBars: bars.length,
            latestCompletedAt: latestBar?.timestamp ?? null,
            detail: bars.length >= 15
              ? "Completed daily OHLCV bars available for charting and technical calculations."
              : "Fewer than 15 completed daily bars are available; technical signal calculation is withheld.",
          },
          regime: {
            status: regimeStatus,
            source: "seismograph",
            computedAt: seismograph?.computedAt ?? null,
            freshness: seismograph?.dataFreshness ?? null,
            detail: regime
              ? "Latest canonical Seismograph regime context available."
              : "Current Seismograph regime context is unavailable; signal calculation is withheld.",
          },
          signal: {
            status: signalStatus,
            detail: signal
              ? "Calculated from the existing deterministic trading-signal engine."
              : "Signal calculation is unavailable until quote, completed daily-bar, and current regime inputs are all present.",
          },
        },
      };
    }),
  // Clear the trading signal cache
  clearSignalCache: protectedProcedure.mutation(() => {
    clearSignalCache();
    return { success: true };
  }),
});
