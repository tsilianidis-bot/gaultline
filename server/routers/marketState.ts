import { publicProcedure, router } from "../_core/trpc";
import { getCanonicalMarketState } from "../marketStateService";
import { getAuthoritativeCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "../canonicalIntelligenceState";

export const marketStateRouter = router({
  current: publicProcedure.query(() => getCanonicalMarketState()),
  canonicalCurrent: publicProcedure.query(async () => {
    const state = await getAuthoritativeCanonicalIntelligenceState();
    return state ? toPublicCanonicalIntelligenceState(state) : null;
  }),
});
