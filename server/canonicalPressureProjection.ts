/**
 * Projects the authoritative canonical intelligence state into the
 * pressure-shaped object some engines still consume internally.
 *
 * Live `calculateFaultlinePressure()` is not current-truth authority.
 * If the manifest cannot bind a usable CURRENT reading, callers must
 * withhold (UNAVAILABLE / GRAY) instead of recalculating.
 */

import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import type { FaultlinePressureOutput, PressureLevel, RiskVector } from "./pressure/engine";

const ENGINE_WEIGHTS: Record<string, number> = {
  "liquidity-stress": 0.20,
  "credit-contagion": 0.20,
  "volatility-regime": 0.15,
  "macro-sensitivity": 0.20,
  "market-breadth": 0.10,
  "ai-bubble": 0.15,
};

const ENGINE_LABELS: Record<string, string> = {
  "liquidity-stress": "Liquidity Stress",
  "credit-contagion": "Credit Contagion Risk",
  "volatility-regime": "Volatility Regime",
  "macro-sensitivity": "Macro Sensitivity",
  "market-breadth": "Market Breadth",
  "ai-bubble": "AI / Speculative Bubble",
};

export const CANONICAL_CRYPTO_VECTOR_IDS = [
  "liquidity-stress",
  "credit-contagion",
  "volatility-regime",
  "market-breadth",
] as const;

function scoreToLevel(score: number): PressureLevel {
  if (score >= 80) return "Critical";
  if (score >= 65) return "High";
  if (score >= 45) return "Elevated";
  if (score >= 25) return "Moderate";
  return "Low";
}

export function isCanonicalCurrentUsable(
  state: CanonicalIntelligenceState | null | undefined,
): state is CanonicalIntelligenceState {
  if (!state) return false;
  if (state.pressureIndex == null || Number.isNaN(state.pressureIndex)) return false;
  if (state.confidenceOrEvidenceQuality === "UNAVAILABLE") return false;
  const coherence = state.provenance?.coherenceStatus;
  if (coherence === "UNAVAILABLE" || coherence === "INVALID") return false;
  return true;
}

export function projectPressureFromCanonical(
  state: CanonicalIntelligenceState | null | undefined,
): FaultlinePressureOutput | null {
  if (!isCanonicalCurrentUsable(state)) return null;
  const pressureIndex = state.pressureIndex;
  if (pressureIndex == null || Number.isNaN(pressureIndex)) return null;

  const vectors: RiskVector[] = state.engines
    .filter(engine => engine.value != null && engine.qualityStatus !== "UNAVAILABLE")
    .map(engine => {
      const score = engine.value as number;
      const trend = engine.direction === "Improving"
        ? "falling"
        : engine.direction === "Deteriorating"
          ? "rising"
          : "stable";
      return {
        id: engine.engineId,
        label: ENGINE_LABELS[engine.engineId] ?? engine.engineName,
        description: engine.engineName,
        score,
        level: scoreToLevel(score),
        driver: engine.classification ?? engine.engineName,
        trend,
        weight: ENGINE_WEIGHTS[engine.engineId] ?? 0,
        rawInputs: {},
        dataStatus: engine.freshnessStatus === "CURRENT"
          ? "live"
          : engine.freshnessStatus === "STALE"
            ? "stale"
            : engine.fallbackStatus === "ACTIVE"
              ? "fallback"
              : "cached",
        source: "canonical-intelligence-state",
      } satisfies RiskVector;
    });

  const level = scoreToLevel(pressureIndex);
  const declaredLevel = state.pressureLevel;
  const resolvedLevel = (
    declaredLevel === "Low" || declaredLevel === "Moderate" || declaredLevel === "Elevated"
    || declaredLevel === "High" || declaredLevel === "Critical"
  ) ? declaredLevel : level;

  return {
    overallPressure: pressureIndex,
    regime: state.regime ?? "UNKNOWN",
    level: resolvedLevel,
    vectors,
    alerts: [],
    topAnalog: {
      year: 0,
      label: "UNAVAILABLE",
      similarity: 0,
      description: "Analogs are not manufactured from canonical identity.",
    },
    analogs: [],
    timestamp: state.generatedAt,
    lastUpdated: state.effectiveAt,
    dataSource: state.confidenceOrEvidenceQuality === "HEALTHY" ? "live" : "fallback",
    priorPressure: null,
  };
}

export function selectScenarioProbabilities(state: CanonicalIntelligenceState): {
  bull: number | null;
  crash: number | null;
  neutral: number | null;
} {
  const outputs = state.scenarioOutputs ?? {};
  const bull = typeof outputs.bull === "number" ? outputs.bull
    : typeof outputs.softLanding === "number" ? outputs.softLanding
    : null;
  const crash = typeof outputs.crash === "number" ? outputs.crash
    : typeof outputs.bear === "number" ? outputs.bear
    : null;
  const neutral = typeof outputs.neutral === "number" ? outputs.neutral
    : typeof outputs.remainInRegime === "number" ? outputs.remainInRegime
    : null;
  return { bull, crash, neutral };
}

export function hasRequiredCryptoVectors(pressure: FaultlinePressureOutput): boolean {
  return CANONICAL_CRYPTO_VECTOR_IDS.every(id => (
    typeof pressure.vectors.find(vector => vector.id === id)?.score === "number"
  ));
}

export function canonicalVectorScore(pressure: FaultlinePressureOutput, id: string): number | null {
  const score = pressure.vectors.find(vector => vector.id === id)?.score;
  return typeof score === "number" && !Number.isNaN(score) ? score : null;
}
