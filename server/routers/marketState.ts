import { publicProcedure, router } from "../_core/trpc";
import { getCanonicalMarketState } from "../marketStateService";

export const marketStateRouter = router({
  current: publicProcedure.query(() => getCanonicalMarketState()),
});
