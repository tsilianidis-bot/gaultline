/**
 * Market Intelligence Router
 */
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import { computeStockMarketRegime, clearStockRegimeCache } from "../stockRegimeEngine";
import { computeCryptoMarketRegime, clearCryptoRegimeCache } from "../cryptoRegimeEngine";
import { computeCrossMarketIntelligence, clearCrossMarketCache } from "../crossMarketEngine";
import { getDb } from "../db";
import { regimeAlerts } from "../../drizzle/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

export const marketIntelligenceRouter = router({
  getAll: publicProcedure.query(async () => {
    const result = await computeCrossMarketIntelligence();
    if (result.regimeChangeAlerts.length > 0) {
      const alertMessages = result.regimeChangeAlerts.map(a =>
        `${a.asset} Market: ${a.previous} -> ${a.current}`
      ).join("\n");
      await notifyOwner({
        title: "FAULTLINE: Regime Change Detected",
        content: `${alertMessages}\n\nAlignment: ${result.alignmentStatus}\n\n${result.plainEnglishSummary}`,
      }).catch(() => {});
    }
    return result;
  }),

  getStock: publicProcedure.query(async () => {
    return computeStockMarketRegime();
  }),

  getCrypto: publicProcedure.query(async () => {
    return computeCryptoMarketRegime();
  }),

  getRecentAlerts: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit ?? 20;
      const rows = await db
        .select()
        .from(regimeAlerts)
        .orderBy(desc(regimeAlerts.detectedAt))
        .limit(limit);
      return rows;
    }),

  // Full enriched crypto regime dashboard — includes indicators, historical context,
  // transition probabilities, actionable interpretation, and cross-market comparison
  getCryptoRegimeDashboard: publicProcedure.query(async () => {
    const [regime, cross] = await Promise.all([
      computeCryptoMarketRegime(),
      computeCrossMarketIntelligence(),
    ]);
    return {
      ...regime,
      stockRegimeLabel:          cross.stockRegime.regime,
      stockRegimeColor:          cross.stockRegime.color,
      alignmentStatus:           cross.alignmentStatus,
      alignmentScore:            cross.alignmentScore,
      crossMarketInterpretation: cross.plainEnglishSummary,
    };
  }),

  clearCache: protectedProcedure.mutation(async () => {
    clearStockRegimeCache();
    clearCryptoRegimeCache();
    clearCrossMarketCache();
    return { cleared: true, timestamp: Date.now() };
  }),
});
