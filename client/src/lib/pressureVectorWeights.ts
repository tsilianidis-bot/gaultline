/* ============================================================
   Pressure Index vector weights and per-vector levels for display.

   Weights are the engine's own composite weights (server/pressure/engine.ts
   vectors[].weight, recorded in CHAMPION_VECTOR_WEIGHTS). The canonical state
   publishes only whether a vector contributes, so the weight is looked up by
   engine id here; an unknown id has no weight (none is shown).

   Each vector's level is its own score on the engine's level thresholds
   (engine.ts scoreToLevel: 80/65/45/25), never the composite's level.
   Display only: nothing here changes any score.
   ============================================================ */
import { CHAMPION_VECTOR_WEIGHTS } from "../../../server/pressure/championBaseline";
import { pressureBandFor } from "@/lib/pressureSnapshot";

const ENGINE_ID_TO_WEIGHT_KEY: Record<string, keyof typeof CHAMPION_VECTOR_WEIGHTS> = {
  "liquidity-stress": "liquidityStress",
  "credit-contagion": "creditContagion",
  "volatility-regime": "volatilityRegime",
  "macro-sensitivity": "macroSensitivity",
  "market-breadth": "marketBreadth",
  "ai-bubble": "aiBubble",
};

/** Composite weight (0–1) for a canonical engine id, or null when unknown. */
export function pressureVectorWeight(engineId: string, contributesToComposite = true): number | null {
  if (!contributesToComposite) return null;
  const key = ENGINE_ID_TO_WEIGHT_KEY[engineId];
  return key ? CHAMPION_VECTOR_WEIGHTS[key] : null;
}

/** The vector's own level from its own 0–100 score; null for a missing/invalid score. */
export function pressureVectorLevel(score: number | null | undefined): "Low" | "Moderate" | "Elevated" | "High" | "Critical" | null {
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) return null;
  return pressureBandFor(score).level;
}
