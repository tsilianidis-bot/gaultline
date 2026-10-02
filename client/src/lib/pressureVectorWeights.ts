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

/**
 * A canonical vector's own 0–100 score for display, or null when the engine
 * published none (null / non-finite / out of range). A missing value stays
 * null all the way to render — it is never shown as 0. Display only.
 */
export function canonicalVectorScore(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

/** Text for a vector score: the number, or "—" when missing (never "0"). */
export function vectorScoreText(score: number | null | undefined): string {
  return typeof score === "number" && Number.isFinite(score) ? String(score) : "—";
}

export interface VectorNodeLike { score: number | null }

/**
 * Contagion read-out over the vectors that HAVE a score. Missing vectors are
 * neither "fired" nor counted as calm; with no scored vector the share is null.
 */
export function contagionSummary<T extends VectorNodeLike>(nodes: readonly T[], threshold: number): {
  fired: T[];
  scored: number;
  total: number;
  pct: number | null;
} {
  const scored = nodes.filter(n => n.score != null);
  const fired = scored.filter(n => (n.score as number) > threshold);
  return {
    fired,
    scored: scored.length,
    total: nodes.length,
    pct: scored.length ? Math.round((fired.length / scored.length) * 100) : null,
  };
}

/** Top-N vectors by score; vectors without a score are excluded (not ranked as 0). */
export function topScoredVectors<T extends VectorNodeLike>(vectors: readonly T[], n: number): T[] {
  return vectors.filter(v => v.score != null).sort((a, b) => (b.score as number) - (a.score as number)).slice(0, n);
}
