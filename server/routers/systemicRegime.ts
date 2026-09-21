import { publicProcedure, router } from "../_core/trpc";
import { EMPTY_SYSTEMIC_REGIME_READING } from "../../shared/systemicRegime";
import { getLatestSignalConvergence, getLatestSystemicRegimeReading, getSystemicRegimeHistory } from "../systemicRegime/reader";
import { MAJOR_STRESS_PERIODS } from "../systemicRegime/stressPeriods";

export const systemicRegimeRouter = router({
  current: publicProcedure.query(async () => {
    const reading = await getLatestSystemicRegimeReading("LIVE_INFERENCE");
    return reading ?? EMPTY_SYSTEMIC_REGIME_READING;
  }),
  history: publicProcedure.query(async () => {
    const [live, research] = await Promise.all([
      getSystemicRegimeHistory("LIVE_INFERENCE", 400),
      getSystemicRegimeHistory("OOS_RESEARCH", 2500),
    ]);
    return {
      live,
      research,
      stressPeriods: MAJOR_STRESS_PERIODS,
      pcaMethod: "standard_scaler_pca",
      modelType: "gaussian-hmm-2state",
      contributesToPressureIndex: false,
    };
  }),
  convergenceCurrent: publicProcedure.query(async () => getLatestSignalConvergence()),
});
