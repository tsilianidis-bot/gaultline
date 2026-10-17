import { intelligenceEvidenceDisabledResponse } from "../../shared/intelligenceEvidence";
import { coreProcedure, router } from "../_core/trpc";
import { getIntelligenceEvidenceCollector } from "../intelligenceEvidence/collector";
import { isIntelligenceEvidenceEnabled } from "../intelligenceEvidence/config";

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
});
