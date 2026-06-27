// ============================================================
// FMOS — Public API Barrel
// (server/fmos/index.ts)
//
// Single import point for all FMOS functionality.
// ============================================================

// Core pipeline
export { runFMOSPipeline, runFMOSPipelineFast, runFMOSPipelineForSymbol, FMOS_VERSION } from "./pipeline";

// Individual engines (for direct use when needed)
export { fetchMacroData } from "./engines/dataAcquisition";
export { computeMarketDNA } from "./engines/marketDNA";
export { computeMarketWeather } from "./engines/marketWeather";
export { computeRegime } from "./engines/regime";
export { computeTransition } from "./engines/transition";
export { computeEvidence } from "./engines/evidence";
export { computeProbability } from "./engines/probability";
export { computeConfidence } from "./engines/confidence";
export { computeHistoricalAnalogs, getTopAnalog } from "./engines/historicalAnalog";
export { computeDecision } from "./engines/decision";
export { computeAIInterpretation, computeQuickInterpretation } from "./engines/aiInterpretation";
export { computeCalibrationMetrics, computeBrierScore, generateCalibrationChartData } from "./engines/calibration";
export { computeLearningInsights } from "./engines/learning";

// Shared utilities
export {
  clamp,
  linearMap,
  euclideanDistance,
  distanceToSimilarity,
  scoreToLabel,
  scoreToRisk,
  scoreToDirection,
  pressureToActionBias,
  confidenceToLabel,
  computeProbabilityDistribution,
} from "./utils";

// All types
export type {
  // Core types
  FMOSUniversalOutput,
  FMOSPartialOutput,
  FMOSPipelineOptions,

  // Engine output types
  FMOSHistoricalAnalog,
  FMOSProbabilityDistribution,
  FMOSEvidenceOutput,
  FMOSEvidenceFamily,
  FMOSEvidenceItem,
  FMOSMarketDNA,
  FMOSMarketWeather,
  FMOSRegimeOutput,
  FMOSTransitionOutput,
  FMOSTransitionSignal,
  FMOSConfidenceOutput,
  FMOSDecisionOutput,
  FMOSAIInterpretation,
  FMOSCalibrationMetrics,

  // Enum-like types
  EvidenceFamilyName,
  EvidenceSignal,
  MarketDNARegime,
  MarketWeatherCondition,
  DecisionVerdict,
  ActionBias,
  PressureLevel,
} from "./types";
