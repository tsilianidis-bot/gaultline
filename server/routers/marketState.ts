import { publicProcedure, router } from "../_core/trpc";
import { getCanonicalMarketState } from "../marketStateService";
import { getAuthoritativeCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "../canonicalIntelligenceState";
import { buildCanonicalEvidencePacket } from "../evidencePacket";

export const marketStateRouter = router({
  current: publicProcedure.query(() => getCanonicalMarketState()),
  canonicalCurrent: publicProcedure.query(async () => {
    const state = await getAuthoritativeCanonicalIntelligenceState();
    return state ? toPublicCanonicalIntelligenceState(state) : null;
  }),
  evidenceCurrent: publicProcedure.query(async () => {
    const state = await getAuthoritativeCanonicalIntelligenceState();
    return state ? buildCanonicalEvidencePacket(toPublicCanonicalIntelligenceState(state)) : null;
  }),
});
