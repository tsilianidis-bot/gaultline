import { getAuthoritativeCanonicalIntelligenceState } from "../canonicalIntelligenceState";
import { getAuthoritativeCrossEngineSynthesis } from "../crossEngineSynthesis";
import { getCurrentGovernedEarlyWarningPresentation } from "../earlyWarningPresentation";
import { memoryGetJson } from "../seismographEngine";
import type { SeismographOutput } from "../seismographCore";
import { computeSignalConvergence } from "./signalConvergence";
import { getLatestSystemicRegimeReading } from "./reader";
import type { SystemicRegimeReading } from "../../shared/systemicRegime";
import type { SignalConvergenceSnapshot } from "../../shared/systemicRegime";

const SEISMOGRAPH_OUTPUT_KEY = "seismograph:latest_output";

/**
 * Read-only snapshot for canonical domainValues.
 * Never fits a model. Never changes Pressure Index weights.
 */
export async function getPersistedRegimeHooks(seismographOverride?: SeismographOutput | null): Promise<{
  systemicRegime: SystemicRegimeReading | null;
  signalConvergence: SignalConvergenceSnapshot;
}> {
  const systemicRegime = await getLatestSystemicRegimeReading("LIVE_INFERENCE");
  const canonical = await getAuthoritativeCanonicalIntelligenceState();
  const seismograph = seismographOverride !== undefined
    ? seismographOverride
    : await memoryGetJson<SeismographOutput | null>(SEISMOGRAPH_OUTPUT_KEY, null);
  const synthesis = await getAuthoritativeCrossEngineSynthesis();
  const earlyWarning = await getCurrentGovernedEarlyWarningPresentation();
  const signalConvergence = computeSignalConvergence({ canonical, seismograph, synthesis, earlyWarning, systemicRegime });
  return { systemicRegime, signalConvergence };
}
