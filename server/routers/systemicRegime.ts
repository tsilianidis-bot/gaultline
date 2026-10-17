import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { redactSystemicRegimeReading, redactSystemicRegimeHistoryPoint } from "../../shared/systemicRegimePublic";
import { EMPTY_SYSTEMIC_REGIME_READING } from "../../shared/systemicRegime";
import { getLatestSignalConvergence, getLatestSystemicRegimeReading, getSystemicRegimeHistory } from "../systemicRegime/reader";
import { MAJOR_STRESS_PERIODS } from "../systemicRegime/stressPeriods";

export const systemicRegimeRouter = router({
  // PUBLIC (Phase 2 #4, 2026-10-13): uncalibrated HMM probabilities
  // (crisis / stress-building / transition / regime confidence) are withheld.
  current: publicProcedure.query(async () => {
    const reading = await getLatestSystemicRegimeReading("LIVE_INFERENCE");
    return redactSystemicRegimeReading(reading ?? EMPTY_SYSTEMIC_REGIME_READING);
  }),
  history: publicProcedure.query(async () => {
    const [live, research] = await Promise.all([
      getSystemicRegimeHistory("LIVE_INFERENCE", 400),
      getSystemicRegimeHistory("OOS_RESEARCH", 2500),
    ]);
    return {
      live: live.map(redactSystemicRegimeHistoryPoint),
      research: research.map(redactSystemicRegimeHistoryPoint),
      probabilitiesWithheld: true as const,
      stressPeriods: MAJOR_STRESS_PERIODS,
      pcaMethod: "standard_scaler_pca",
      modelType: "gaussian-hmm-2state",
      contributesToPressureIndex: false,
    };
  }),
  // INTERNAL research access (admin only): unredacted readings are preserved.
  currentInternal: adminProcedure.query(async () => {
    const reading = await getLatestSystemicRegimeReading("LIVE_INFERENCE");
    return reading ?? EMPTY_SYSTEMIC_REGIME_READING;
  }),
  convergenceCurrent: publicProcedure.query(async () => getLatestSignalConvergence()),
});
