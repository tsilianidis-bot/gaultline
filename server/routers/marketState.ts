import { publicProcedure, router } from "../_core/trpc";
import { getCanonicalMarketState } from "../marketStateService";
import { toPublicMarketStateWire } from "../../shared/publicProbabilityWire";
import { getAuthoritativeCanonicalIntelligenceState, toClientCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "../canonicalIntelligenceState";
import { buildCanonicalEvidencePacket } from "../evidencePacket";
import { getAuthoritativeCrossEngineSynthesis } from "../crossEngineSynthesis";
import { getCurrentGovernedEarlyWarningPresentation, getCurrentGovernedEarlyWarningTimeline } from "../earlyWarningPresentation";

export const marketStateRouter = router({
  // Public boundary: withheld probabilities serialize as null, never the string "NaN".
  current: publicProcedure.query(async () => toPublicMarketStateWire(await getCanonicalMarketState())),
  canonicalCurrent: publicProcedure.query(async () => {
    const state = await getAuthoritativeCanonicalIntelligenceState();
    return state ? toClientCanonicalIntelligenceState(state) : null;
  }),
  evidenceCurrent: publicProcedure.query(async () => {
    const state = await getAuthoritativeCanonicalIntelligenceState();
    // Client projection: no scenarioOutputs claims ("Scenario component bull is 33") on the public route.
    return state ? buildCanonicalEvidencePacket(toClientCanonicalIntelligenceState(state)) : null;
  }),
  synthesisCurrent: publicProcedure.query(() => getAuthoritativeCrossEngineSynthesis()),
  earlyWarningPresentationCurrent: publicProcedure.query(() => getCurrentGovernedEarlyWarningPresentation()),
  earlyWarningPresentationTimeline: publicProcedure.query(() => getCurrentGovernedEarlyWarningTimeline()),
});
