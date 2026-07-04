/**
 * Market Intelligence Router
 */
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import { computeStockMarketRegime, clearStockRegimeCache } from "../stockRegimeEngine";
import { computeCryptoMarketRegime, clearCryptoRegimeCache } from "../cryptoRegimeEngine";
import { computeCrossMarketIntelligence, clearCrossMarketCache } from "../crossMarketEngine";

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

  clearCache: protectedProcedure.mutation(async () => {
    clearStockRegimeCache();
    clearCryptoRegimeCache();
    clearCrossMarketCache();
    return { cleared: true, timestamp: Date.now() };
  }),
});
