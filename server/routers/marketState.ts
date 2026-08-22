import { publicProcedure, router } from "../_core/trpc";
import { getCanonicalMarketState } from "../marketStateService";
import { getAuthoritativeCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "../canonicalIntelligenceState";
import { buildCanonicalEvidencePacket } from "../evidencePacket";
import { getAuthoritativeCrossEngineSynthesis } from "../crossEngineSynthesis";
import { evaluateEarlyWarnings, getEarlyWarningTimeline, getPersistedEarlyWarnings } from "../earlyWarningIntelligence";
import { z } from "zod";

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
  synthesisCurrent: publicProcedure.query(() => getAuthoritativeCrossEngineSynthesis()),
  earlyWarningsCurrent: publicProcedure.query(async () => {
    const synthesis = await getAuthoritativeCrossEngineSynthesis();
    if (!synthesis) return null;
    const state = await getAuthoritativeCanonicalIntelligenceState();
    const publicState = state ? toPublicCanonicalIntelligenceState(state) : null;
    const persisted = await getPersistedEarlyWarnings(false);
    return evaluateEarlyWarnings(synthesis, persisted.map(item => ({
      warningId: item.warningId,
      compositeWarningScore: item.currentScore,
      lifecycleState: item.currentLifecycleState as "EMERGING" | "DEVELOPING" | "CONFIRMING" | "ELEVATED" | "FADING" | "INVALIDATED",
    })), publicState?.stateId === synthesis.originatingStateId ? {
      pressureIndex: publicState.pressureIndex,
      regime: publicState.regime,
      pressureLevel: publicState.pressureLevel,
    } : null);
  }),
  earlyWarningHistory: publicProcedure.input(z.object({ warningId: z.string().min(1).max(96) })).query(async ({ input }) => {
    const warnings = await getPersistedEarlyWarnings(false);
    const warning = warnings.find(item => item.warningId === input.warningId) ?? null;
    return { warning, observations: warning ? await getEarlyWarningTimeline(input.warningId) : [] };
  }),
});
