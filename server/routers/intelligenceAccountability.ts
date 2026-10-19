import { PUBLIC_DISCLAIMER } from "../../shared/publicDisclaimer";
import { buildPublicTrackRecord } from "../../shared/intelligenceAccountability";
import { publicProcedure, router } from "../_core/trpc";
import { isIntelligenceTrackRecordEnabled, loadAccountabilityLedger } from "../intelligenceAccountability";

/**
 * Read-only public projection. Disabled unless the feature flag row is on.
 * Probability fields are not part of the ledger and are not returned.
 */
export const intelligenceAccountabilityRouter = router({
  publicRecord: publicProcedure.query(async () => {
    const enabled = await isIntelligenceTrackRecordEnabled();
    if (!enabled) return { enabled: false as const, disclaimer: PUBLIC_DISCLAIMER };
    const rows = await loadAccountabilityLedger();
    return buildPublicTrackRecord(rows);
  }),
});
