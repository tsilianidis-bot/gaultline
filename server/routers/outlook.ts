// ============================================================
// FAULTLINE — Signal Outlook Center™ tRPC Router
// server/routers/outlook.ts
// ============================================================
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  getFullOutlook,
  getQuickOutlook,
  getTopOpportunities,
  getOpportunityDiscovery,
  clearOutlookCaches,
  type OutlookTimeframe,
} from "../signalOutlook";
import { calculateFaultlinePressure } from "../pressure/engine";
import { invokeLLM } from "../_core/llm";
import { getQuote } from "../yahooProxy";

const timeframeSchema = z.enum(["day", "short", "swing", "long"]).default("swing");
const assetTypeSchema = z.enum(["stock", "crypto"]);

/**
 * Recursively replace NaN and Infinity with 0 so SuperJSON never throws
 * "Unable to transform response from server" on the client.
 */
function sanitizeNumbers(v: unknown): unknown {
  if (typeof v === "number") return isFinite(v) && !isNaN(v) ? v : 0;
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(sanitizeNumbers);
  if (typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, sanitizeNumbers(val)])
    );
  }
  return v;
}

export const outlookRouter = router({
  /**
   * Full outlook for a single symbol.
   * Includes all 8 scoring factors, AI interpretation, invalidation scenarios,
   * FAULTLINE environment context, and integration with Diagnostic AI / Preflight.
   */
  getOutlook: publicProcedure
    .input(z.object({
      symbol: z.string().min(1).max(20).toUpperCase(),
      assetType: assetTypeSchema,
      timeframe: timeframeSchema,
    }))
    .query(async ({ input }) => {
      try {
        const result = await getFullOutlook(input.symbol, input.assetType, input.timeframe as OutlookTimeframe);
        return sanitizeNumbers(result) as typeof result;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[outlook.getOutlook] Error for", input.symbol, err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Unable to generate outlook for ${input.symbol}. Live market data may be temporarily unavailable.`,
        });
      }
    }),

  /**
   * Quick outlook for a single symbol (watchlist chips, inline badges).
   * Returns score, direction, confidence, risk level only — no AI interpretation.
   * Cached for 10 minutes.
   */
  getQuickOutlook: publicProcedure
    .input(z.object({
      symbol: z.string().min(1).max(20).toUpperCase(),
      assetType: assetTypeSchema,
    }))
    .query(async ({ input }) => {
      try {
        const result = await getQuickOutlook(input.symbol, input.assetType);
        return sanitizeNumbers(result) as typeof result;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[outlook.getQuickOutlook] Error for", input.symbol, err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Quick outlook unavailable for ${input.symbol}.`,
        });
      }
    }),

  /**
   * Top 5 stock + top 5 crypto opportunities ranked by composite outlook score.
   * Used on the Signal Outlook Center landing screen.
   * Cached for 8 minutes.
   */
  getTopOpportunities: publicProcedure
    .query(async () => {
      try {
        const result = await getTopOpportunities();
        return sanitizeNumbers(result) as typeof result;
      } catch (err) {
        console.error("[outlook.getTopOpportunities] Error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Top opportunities unavailable." });
      }
    }),

  /**
   * Batch quick outlooks for a list of watchlist symbols.
   * Used by the Watchlist page to show outlook chips alongside each position.
   * Max 30 symbols per request.
   */
  getWatchlistOutlooks: publicProcedure
    .input(z.object({
      items: z.array(z.object({
        symbol: z.string().min(1).max(20),
        assetType: assetTypeSchema,
      })).max(30),
    }))
    .query(async ({ input }) => {
      const results = await Promise.allSettled(
        input.items.map(item =>
          getQuickOutlook(item.symbol.toUpperCase(), item.assetType)
        )
      );
      return results.map((r, i) => ({
        symbol: input.items[i].symbol.toUpperCase(),
        assetType: input.items[i].assetType,
        outlook: r.status === "fulfilled" ? sanitizeNumbers(r.value) : null,
        error: r.status === "rejected" ? String(r.reason) : null,
      }));
    }),

  /**
   * Opportunity Discovery Engine — 8-category proactive feed.
   * Returns categorized buckets with Opportunity Score, Time Horizon, Catalyst, Risk Level.
   * Cached for 10 minutes.
   */
  getOpportunityDiscovery: publicProcedure
    .query(async () => {
      try {
        const result = await getOpportunityDiscovery();
        return sanitizeNumbers(result) as typeof result;
      } catch (err) {
        console.error("[outlook.getOpportunityDiscovery] Error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Opportunity discovery unavailable." });
      }
    }),

  /**
   * Security Context — unified live data bar for any ticker.
   * Returns price, change, volume, market cap, sector, regime alignment, opportunity score.
   * Used by UniversalTickerHeader on every analysis page.
   */
  getSecurityContext: publicProcedure
    .input(z.object({
      symbol: z.string().min(1).max(20).toUpperCase(),
      assetType: assetTypeSchema,
    }))
    .query(async ({ input }) => {
      try {
        const [quote, quickOutlook] = await Promise.allSettled([
          getQuote(input.symbol),
          getQuickOutlook(input.symbol, input.assetType),
        ]);

        const q = quote.status === "fulfilled" ? quote.value : null;
        const o = quickOutlook.status === "fulfilled" ? quickOutlook.value : null;

        // Fetch sector/industry from Polygon reference
        const apiKey = process.env.POLYGON_API_KEY ?? "";
        let sector: string | null = null;
        let industry: string | null = null;
        let marketCap: number | null = null;
        if (input.assetType === "stock" && apiKey) {
          try {
            const refRes = await fetch(
              `https://api.polygon.io/v3/reference/tickers/${input.symbol}?apiKey=${apiKey}`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (refRes.ok) {
              const refData = await refRes.json() as { results?: { sic_description?: string; sector?: string; industry?: string; market_cap?: number } };
              const r = refData.results ?? {};
              sector = r.sector ?? null;
              industry = r.sic_description ?? r.industry ?? null;
              marketCap = r.market_cap ?? null;
            }
          } catch { /* ignore */ }
        }

        return sanitizeNumbers({
          symbol: input.symbol,
          assetType: input.assetType,
          price: q?.price ?? null,
          change: q?.change ?? null,
          changePercent: q?.changePercent ?? null,
          volume: q?.volume ?? null,
          marketState: q?.marketState ?? "UNKNOWN",
          sector,
          industry,
          marketCap,
          opportunityScore: o?.outlookScore ?? null,
          direction: o?.direction ?? null,
          riskLevel: o?.riskLevel ?? null,
          confidence: o?.confidence ?? null,
        }) as {
          symbol: string;
          assetType: "stock" | "crypto";
          price: number | null;
          change: number | null;
          changePercent: number | null;
          volume: number | null;
          marketState: string;
          sector: string | null;
          industry: string | null;
          marketCap: number | null;
          opportunityScore: number | null;
          direction: string | null;
          riskLevel: string | null;
          confidence: number | null;
        };
      } catch (err) {
        console.error("[outlook.getSecurityContext] Error for", input.symbol, err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Security context unavailable for ${input.symbol}.` });
      }
    }),

  /**
   * Today's Story — AI-written market narrative.
   * What happened, what changed overnight, what institutions are doing,
   * what matters next, and the invalidation thesis.
   * Cached for 15 minutes.
   */
  getTodaysStory: publicProcedure
    .query(async () => {
      try {
        const pressure = await calculateFaultlinePressure();
        const topOpp = await getTopOpportunities();

        const topStocks = topOpp.stocks.slice(0, 3).map(s => `${s.symbol} (score: ${s.outlookScore}, ${s.direction})`).join(", ");
        const topCrypto = topOpp.crypto.slice(0, 3).map(s => `${s.symbol} (score: ${s.outlookScore}, ${s.direction})`).join(", ");
        const topVectors = pressure.vectors.slice(0, 5).map(v => `${v.label}: ${v.score}/100 (${v.driver})`).join("; ");

        const prompt = `You are FAULTLINE, an institutional-grade market intelligence system. Write today's market story in exactly 5 sections. Be specific, data-driven, and institutional in tone. Use the live data below.

LIVE FAULTLINE DATA:
- Overall Pressure Index: ${pressure.overallPressure}/100
- Market Regime: ${pressure.regime} (${pressure.level})
- Top Risk Vectors: ${topVectors}
- Top Stock Opportunities: ${topStocks || "None identified"}
- Top Crypto Opportunities: ${topCrypto || "None identified"}
- Historical Analog: ${pressure.topAnalog.label} (${pressure.topAnalog.similarity}% similarity)
- Data Source: ${pressure.dataSource}

Write exactly this JSON structure:
{
  "headline": "A single punchy 10-15 word headline summarizing today's market story",
  "whatHappened": "2-3 sentences on what happened in markets today/overnight. Reference the pressure index and regime.",
  "whatChanged": "2-3 sentences on what changed from yesterday. What shifted in the risk vectors or regime?",
  "whatInstitutionsAreDoing": "2-3 sentences on institutional positioning signals. Reference the top vectors and historical analog.",
  "whatMattersNext": "2-3 sentences on the 1-3 most important catalysts or levels to watch in the next 24-72 hours.",
  "invalidationThesis": "1-2 sentences on what would invalidate the current regime reading and force a reassessment.",
  "topOpportunity": "${topStocks.split(',')[0]?.split('(')[0]?.trim() || 'SPY'}",
  "topOpportunityReason": "One sentence on why this is the top opportunity right now.",
  "riskWarning": "One sentence on the single biggest risk to watch.",
  "regimeSummary": "${pressure.regime} — Pressure ${pressure.overallPressure}/100",
  "generatedAt": "${new Date().toISOString()}"
}`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are FAULTLINE — an elite institutional market intelligence system operating as a Chief Investment Strategist. You synthesize live market data, macro regime analysis, and proprietary signal scoring into clear, confident analysis. Be direct, specific, and institutional in tone. Respond only with valid JSON." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" } as any,
        });

        const rawContent = response.choices?.[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent ?? {});
        const story = JSON.parse(content);

        return sanitizeNumbers({
          ...story,
          pressureIndex: pressure.overallPressure,
          regime: pressure.regime,
          regimeLevel: pressure.level,
          topAnalog: pressure.topAnalog,
          dataSource: pressure.dataSource,
          generatedAt: new Date().toISOString(),
        }) as {
          headline: string;
          whatHappened: string;
          whatChanged: string;
          whatInstitutionsAreDoing: string;
          whatMattersNext: string;
          invalidationThesis: string;
          topOpportunity: string;
          topOpportunityReason: string;
          riskWarning: string;
          regimeSummary: string;
          pressureIndex: number;
          regime: string;
          regimeLevel: string;
          topAnalog: { label: string; similarity: number; description: string };
          dataSource: string;
          generatedAt: string;
        };
      } catch (err) {
        console.error("[outlook.getTodaysStory] Error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Today's Story unavailable. Market data may be temporarily unavailable." });
      }
    }),

  /**
   * Admin: clear all outlook caches (forces fresh computation on next request).
   */
  clearCaches: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      clearOutlookCaches();
      return { success: true };
    }),
});
