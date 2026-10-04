import { publicProcedure, router } from "../_core/trpc";
import { getSectorRotationReading } from "../sectorRotation/service";

/**
 * FAULTLINE Sector Rotation Map™ — read-only. Computed server-side from market
 * data (see server/sectorRotation/calc.ts); no DB writes, no LLM, no probabilities.
 */
export const sectorRotationRouter = router({
  current: publicProcedure.query(() => getSectorRotationReading()),
});
