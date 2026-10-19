import { publicProcedure, router } from "../_core/trpc";
import { getServedSectorRotation } from "../sectorRotation/service";

/**
 * FAULTLINE Sector Rotation Map™ — read-only. Serves the latest saved snapshot built by
 * the post-close collector (server/sectorRotation/collector.ts). This query never
 * computes or fetches market data; no LLM, no probabilities.
 */
export const sectorRotationRouter = router({
  current: publicProcedure.query(() => getServedSectorRotation()),
});
