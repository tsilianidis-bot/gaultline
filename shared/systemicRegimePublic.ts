// Public redaction of the Systemic Regime (2-state HMM) model — Phase 2 #4 (2026-10-13).
// The HMM's crisis / stress-building / transition probabilities and regime
// confidence are uncalibrated model outputs. They stay in the database and are
// available to admins (systemicRegime.currentInternal); public responses carry null.
import type { SystemicRegimeHistoryPoint, SystemicRegimeReading } from "./systemicRegime";
export type { SystemicRegimeReadingView } from "./systemicRegime";

export const SYSTEMIC_REGIME_PROBABILITIES_WITHHELD_REASON =
  "Model probabilities are uncalibrated and are not published.";

/** Probability-derived fields that are never sent on public responses (keys removed, not nulled). */
export const SYSTEMIC_REGIME_PROBABILITY_FIELDS = [
  "systemicRiskScore",
  "crisisProbability",
  "stressBuildingProbability",
  "transitionProbability",
  "regimeConfidence",
] as const;
type ProbabilityField = (typeof SYSTEMIC_REGIME_PROBABILITY_FIELDS)[number];

export type PublicSystemicRegimeReading = Omit<SystemicRegimeReading, ProbabilityField> & {
  probabilitiesWithheld: true;
  withheldReason: string;
};

function omitProbabilities<T extends object>(value: T): Omit<T, ProbabilityField> {
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const key of SYSTEMIC_REGIME_PROBABILITY_FIELDS) delete out[key];
  return out as Omit<T, ProbabilityField>;
}

export function redactSystemicRegimeReading(reading: SystemicRegimeReading): PublicSystemicRegimeReading {
  // systemicRiskScore = round(100×(crisis_p + 0.5·stress_p)) is probability-derived, so it is removed too (QA B-2).
  return {
    ...omitProbabilities(reading),
    probabilitiesWithheld: true,
    withheldReason: SYSTEMIC_REGIME_PROBABILITIES_WITHHELD_REASON,
  };
}

export function redactSystemicRegimeHistoryPoint(point: SystemicRegimeHistoryPoint): SystemicRegimeHistoryPoint {
  return {
    ...point,
    systemicRiskScore: null,
    crisisProbability: null,
    stressBuildingProbability: null,
    ...("transitionProbability" in point ? { transitionProbability: null } : {}),
    ...("regimeConfidence" in point ? { regimeConfidence: null } : {}),
  };
}
