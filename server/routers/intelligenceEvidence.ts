import { intelligenceEvidenceDisabledResponse } from "../../shared/intelligenceEvidence";
import { coreProcedure, router } from "../_core/trpc";
import { getIntelligenceEvidenceCollector } from "../intelligenceEvidence/collector";
import { isIntelligenceCoreVisualEnabled, isIntelligenceEvidenceEnabled } from "../intelligenceEvidence/config";

/**
 * Authenticated, read-only Phase 1 evidence surface. It deliberately exposes
 * evidence records only: no visual graph, inferred events, recommendations, or
 * mutation procedure is registered here.
 */
export const intelligenceEvidenceRouter = router({
  current: coreProcedure.query(async () => {
    if (!isIntelligenceEvidenceEnabled()) return intelligenceEvidenceDisabledResponse();
    return getIntelligenceEvidenceCollector().current();
  }),
  /**
   * Phase 2 presentation receives the same evidence contract as Phase 1. It
   * cannot start collection and is independently disabled by default.
   */
  visual: coreProcedure.query(async () => {
    if (!isIntelligenceCoreVisualEnabled()) {
      return {
        ...intelligenceEvidenceDisabledResponse(),
        reason: "Intelligence Core visualization is disabled in this environment pending evidence-rollout verification.",
      };
    }
    if (!isIntelligenceEvidenceEnabled()) {
      return {
        ...intelligenceEvidenceDisabledResponse(),
        reason: "Verified evidence collection is disabled, so the Intelligence Core cannot present a current system map.",
      };
    }
    return getIntelligenceEvidenceCollector().current();
  }),
});
