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
