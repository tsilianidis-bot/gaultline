import type { SystemicRegimeReading } from "../../shared/systemicRegime";
import type { SignalConvergenceSnapshot } from "../../shared/systemicRegime";
import { PLATO_SCENARIO_WITHHELD, withholdScenarioPercents } from "../plato/scenarioWithholding";

/**
 * Thin PLATO read of persisted Systemic Regime + Signal Convergence.
 * Does not calculate, fit, or reweight Pressure. Unavailable output is stated
 * as unavailable — never as "markets are safe".
 */
export function buildSystemicRegimePromptContract(
  reading: SystemicRegimeReading | null,
  convergence: SignalConvergenceSnapshot | null,
): string {
  if (!reading || reading.freshnessStatus === "UNAVAILABLE" || !reading.currentRegime) {
    return [
      "SYSTEMIC REGIME ENGINE (READ ONLY, STATISTICAL PCA+HMM, NOT AI):",
      "No persisted inference is available. Do not invent a systemic regime, crisis probability, or PCA factor.",
      "Do not imply that the absence of a reading means markets are safe.",
    ].join("\n");
  }
  return [
    "SYSTEMIC REGIME ENGINE (READ ONLY, STATISTICAL PCA+HMM, NOT AI):",
    JSON.stringify({
      currentRegime: reading.currentRegime,
      systemicRiskScore: reading.systemicRiskScore,
      // Probabilities and confidence are withheld (owner rule: none has an AVAILABLE contract status).
      crisisProbability: PLATO_SCENARIO_WITHHELD,
      transitionProbability: PLATO_SCENARIO_WITHHELD,
      regimeConfidence: PLATO_SCENARIO_WITHHELD,
      creditStressZ: reading.creditStressZ,
      volStressZ: reading.volStressZ,
      ratesStressZ: reading.ratesStressZ,
      modelVersion: reading.modelVersion,
      modelType: reading.modelType,
      pcaMethod: reading.pcaMethod,
      dataAsOf: reading.dataAsOf,
      freshnessStatus: reading.freshnessStatus,
      contributesToPressureIndex: false,
    }),
    "Use only these persisted fields. Do not retrain, rescore, or call this AI.",
    `crisisProbability, transitionProbability and regimeConfidence are ${PLATO_SCENARIO_WITHHELD}: do not state, estimate or imply a value for them.`,
    "This engine is independent of the Champion Pressure Index and is not a Pressure weight.",
    convergence
      ? `SIGNAL CONVERGENCE (N of M independent votes, not an average): ${withholdScenarioPercents(convergence.summary)}`
      : "SIGNAL CONVERGENCE: unavailable.",
  ].join("\n");
}
