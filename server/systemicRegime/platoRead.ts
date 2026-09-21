import type { SystemicRegimeReading } from "../../shared/systemicRegime";
import type { SignalConvergenceSnapshot } from "../../shared/systemicRegime";

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
      crisisProbability: reading.crisisProbability,
      transitionProbability: reading.transitionProbability,
      regimeConfidence: reading.regimeConfidence,
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
    "This engine is independent of the Champion Pressure Index and is not a Pressure weight.",
    convergence
      ? `SIGNAL CONVERGENCE (N of M independent votes, not an average): ${convergence.summary}`
      : "SIGNAL CONVERGENCE: unavailable.",
  ].join("\n");
}
