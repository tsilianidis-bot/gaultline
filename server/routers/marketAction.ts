import { publicProcedure, router } from "../_core/trpc";
import { getMarketActionCollector } from "../marketAction/collector";

/**
 * Read-only access to the persisted Market Action monitor. This query never
 * polls third parties or calculates a reading from page traffic.
 */
export const marketActionRouter = router({
  current: publicProcedure.query(() => getMarketActionCollector().served()),
});
