// Public redaction of the Systemic Regime (2-state HMM) model — Phase 2 #4 (2026-10-13).
// The HMM's crisis / stress-building / transition probabilities and regime
// confidence are uncalibrated model outputs. They stay in the database and are
// available to admins (systemicRegime.currentInternal); public responses carry null.
import type { SystemicRegimeHistoryPoint, SystemicRegimeReading } from "./systemicRegime";

export const SYSTEMIC_REGIME_PROBABILITIES_WITHHELD_REASON =
  "Model probabilities are uncalibrated and are not published.";

export function redactSystemicRegimeReading(reading: SystemicRegimeReading): SystemicRegimeReading & { probabilitiesWithheld: true; withheldReason: string } {
  return {
    ...reading,
    crisisProbability: null,
    stressBuildingProbability: null,
    transitionProbability: null,
    regimeConfidence: null,
    probabilitiesWithheld: true,
    withheldReason: SYSTEMIC_REGIME_PROBABILITIES_WITHHELD_REASON,
  };
}

export function redactSystemicRegimeHistoryPoint(point: SystemicRegimeHistoryPoint): SystemicRegimeHistoryPoint {
  return {
    ...point,
    crisisProbability: null,
    stressBuildingProbability: null,
    ...("transitionProbability" in point ? { transitionProbability: null } : {}),
    ...("regimeConfidence" in point ? { regimeConfidence: null } : {}),
  };
}
