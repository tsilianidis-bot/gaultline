export const SYSTEMIC_REGIME_MODEL_TYPE = "gaussian-hmm-2state" as const;
export const SYSTEMIC_REGIME_PCA_METHOD = "standard_scaler_pca" as const;
export const SIGNAL_CONVERGENCE_METHODOLOGY = "n-of-m-independent-votes-v1" as const;

export type SystemicRegimeLabel = "NORMAL" | "STRESS BUILDING" | "CRISIS" | "RISK ON" | "TRANSITION" | "STRESS";
export type SystemicFreshness = "CURRENT" | "DELAYED" | "STALE" | "UNAVAILABLE";
export type FactorArrow = "up" | "down" | "flat";
export type HistoryClass = "LIVE_INFERENCE" | "OOS_RESEARCH";
export type ConvergenceLevel = "LOW" | "MEDIUM" | "HIGH" | "UNAVAILABLE";

export interface SystemicRegimeFactorArrows {
  credit: FactorArrow;
  vol: FactorArrow;
  rates: FactorArrow;
}

export interface SystemicRegimeReading {
  systemicRiskScore: number | null;
  crisisProbability: number | null;
  stressBuildingProbability: number | null;
  transitionProbability: number | null;
  currentRegime: SystemicRegimeLabel | null;
  regimeConfidence: number | null;
  creditStressZ: number | null;
  volStressZ: number | null;
  ratesStressZ: number | null;
  pc1: number | null;
  factorArrows: SystemicRegimeFactorArrows;
  modelVersion: string;
  modelType: typeof SYSTEMIC_REGIME_MODEL_TYPE | string;
  pcaMethod: typeof SYSTEMIC_REGIME_PCA_METHOD;
  nStates: number;
  dataAsOf: string | null;
  computedAt: string | null;
  freshnessStatus: SystemicFreshness;
  historyClass: HistoryClass;
  contributesToPressureIndex: false;
}

export interface SystemicRegimeHistoryPoint {
  date: string;
  currentRegime: SystemicRegimeLabel | string;
  crisisProbability: number | null;
  stressBuildingProbability: number | null;
  transitionProbability?: number | null;
  regimeConfidence?: number | null;
  systemicRiskScore: number | null;
  pc1: number | null;
  spx: number | null;
  pressureIndex?: number | null;
}

export interface StressPeriodBand {
  id: string;
  label: string;
  start: string;
  end: string;
  severity: string;
  notes?: string;
}

export interface ConvergenceVote {
  engineId: string;
  engineName: string;
  available: boolean;
  deteriorating: boolean | null;
  reason: string;
  independent: true;
}

export interface SignalConvergenceSnapshot {
  methodology: typeof SIGNAL_CONVERGENCE_METHODOLOGY;
  level: ConvergenceLevel;
  deterioratingCount: number;
  availableCount: number;
  voteCount: number;
  thresholdMedium: number;
  thresholdHigh: number;
  votes: ConvergenceVote[];
  summary: string;
  computedAt: string;
  contributesToPressureIndex: false;
}

export const EMPTY_SYSTEMIC_REGIME_READING: SystemicRegimeReading = {
  systemicRiskScore: null,
  crisisProbability: null,
  stressBuildingProbability: null,
  transitionProbability: null,
  currentRegime: null,
  regimeConfidence: null,
  creditStressZ: null,
  volStressZ: null,
  ratesStressZ: null,
  pc1: null,
  factorArrows: { credit: "flat", vol: "flat", rates: "flat" },
  modelVersion: "unavailable",
  modelType: SYSTEMIC_REGIME_MODEL_TYPE,
  pcaMethod: SYSTEMIC_REGIME_PCA_METHOD,
  nStates: 2,
  dataAsOf: null,
  computedAt: null,
  freshnessStatus: "UNAVAILABLE",
  historyClass: "LIVE_INFERENCE",
  contributesToPressureIndex: false,
};
