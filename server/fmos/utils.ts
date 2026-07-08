// ============================================================
// FMOS — Shared Utility Functions  (server/fmos/utils.ts)
//
// Single canonical implementations of utility functions that
// were previously duplicated across 12+ engine files.
//
// MIGRATION STATUS:
//   clamp()       — replaces 12 duplicate definitions
//   linearMap()   — canonical (was only in pressure/engine.ts)
//   scoreToLabel() — replaces 3 duplicate definitions
//   scoreToRisk()  — replaces 3 duplicate definitions
//   scoreToDirection() — canonical from signalOutlook.ts
//   classifyPressureLevel() — canonical from pressure/engine.ts
//
// All engines should import from this file instead of defining
// their own local copies.
// ============================================================

// ── Math Utilities ────────────────────────────────────────────

/**
 * Clamp a value between min and max (inclusive).
 * Canonical replacement for 12 duplicate clamp() definitions.
 *
 * @param v   - The value to clamp
 * @param min - Lower bound (default: 0)
 * @param max - Upper bound (default: 100)
 */
export function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Linear interpolation: map a value from [inMin, inMax] to [outMin, outMax].
 * Clamps the result to [outMin, outMax].
 */
export function linearMap(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  const ratio = clamp((v - inMin) / (inMax - inMin), 0, 1);
  return outMin + ratio * (outMax - outMin);
}

/**
 * Round a number to a specified number of decimal places.
 */
export function round(v: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

/**
 * Compute Euclidean distance between two numeric vectors.
 * Used by the Historical Analog Engine for similarity scoring.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vectors must have equal length");
  return Math.sqrt(a.reduce((sum, ai, i) => sum + Math.pow(ai - (b[i] ?? 0), 2), 0));
}

/**
 * Normalize a Euclidean distance to a 0–100 similarity score.
 * Higher score = more similar.
 *
 * @param distance  - Euclidean distance between two vectors
 * @param maxDist   - Maximum possible distance (normalizer)
 */
export function distanceToSimilarity(distance: number, maxDist: number): number {
  return clamp(Math.round((1 - distance / maxDist) * 100));
}

// ── Score-to-Label Converters ─────────────────────────────────

/**
 * Convert a 0–100 score to a qualitative strength label.
 * Canonical replacement for multiple scoreToLabel() definitions.
 */
export function scoreToLabel(score: number): "Strong" | "Moderate" | "Weak" | "Very Weak" {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Moderate";
  if (score >= 35) return "Weak";
  return "Very Weak";
}

/**
 * Convert a 0–100 score to a risk level label.
 * Higher score = higher risk.
 */
export function scoreToRisk(score: number): "Extreme" | "High" | "Moderate" | "Low" {
  if (score >= 75) return "Extreme";
  if (score >= 55) return "High";
  if (score >= 35) return "Moderate";
  return "Low";
}

/**
 * Convert a 0–100 outlook score to a directional label.
 * Higher score = more bullish.
 */
export function scoreToDirection(
  score: number
): "Bullish" | "Neutral" | "Bearish" | "Avoid" {
  if (score >= 65) return "Bullish";
  if (score >= 50) return "Neutral";
  if (score >= 30) return "Bearish";
  return "Avoid";
}

// ── Pressure Classification ───────────────────────────────────

export type PressureLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";

/**
 * Classify a pressure index (0–100) into a qualitative level.
 * Canonical replacement for the pressure/engine.ts classifyRegime() function.
 */
export function classifyPressureLevel(pressure: number): PressureLevel {
  if (pressure >= 80) return "Critical";
  if (pressure >= 65) return "High";
  if (pressure >= 45) return "Elevated";
  if (pressure >= 25) return "Moderate";
  return "Low";
}

/**
 * Classify a pressure index into a regime label.
 * Canonical replacement for both classifyRegime() and classifyRegimeLabel().
 */
export function classifyRegimeLabel(pressure: number): string {
  if (pressure >= 80) return "SYSTEMIC CRISIS";
  if (pressure >= 65) return "HIGH STRESS";
  if (pressure >= 45) return "ELEVATED RISK";
  if (pressure >= 25) return "MODERATE RISK";
  return "LOW RISK";
}

/**
 * Classify a pressure index into a human-readable diagnostic label.
 * Used by DiagnosticAI and the Regime Engine.
 */
export function classifyDiagnosticLabel(pressure: number): string {
  if (pressure >= 86) return "Systemic Break Zone";
  if (pressure >= 76) return "Critical Stress";
  if (pressure >= 61) return "Elevated Pressure";
  if (pressure >= 41) return "Watch Zone";
  if (pressure >= 21) return "Normal Risk";
  return "Calm";
}

export type ActionBias = "Bullish" | "Neutral" | "Cautious" | "Defensive" | "Critical";

/**
 * Convert a pressure index to an action bias label.
 * Canonical replacement for pressureToActionBias() in diagnosticAI.ts.
 */
export function pressureToActionBias(pressure: number): ActionBias {
  if (pressure >= 76) return "Critical";
  if (pressure >= 61) return "Defensive";
  if (pressure >= 41) return "Cautious";
  if (pressure >= 21) return "Neutral";
  return "Bullish";
}

// ── Probability Utilities ─────────────────────────────────────

/**
 * Convert a pressure index to a bull probability (0–100).
 *
 * CANONICAL FORMULA — replaces two competing implementations:
 *   - preFlight.ts: (100 - pressure) * 0.80 + (100 - creditScore) * 0.20
 *   - signalOutlook.ts: 100 - pressure * 0.85
 *
 * The FMOS canonical formula uses a simple inverse relationship
 * with a 0.85 multiplier (matching signalOutlook.ts which is the
 * more widely used implementation). For credit-adjusted probability,
 * use the Probability Engine's full distribution calculation.
 *
 * @param pressure - Overall pressure index (0–100)
 */
export function pressureToBullProbability(pressure: number): number {
  return clamp(Math.round(100 - pressure * 0.85));
}

/**
 * Convert a pressure index to a bear probability (0–100).
 * Note: bull + bear may not sum to 100 — neutral fills the gap.
 */
export function pressureToBearProbability(pressure: number): number {
  return clamp(Math.round(pressure * 0.75));
}

/**
 * Compute a full probability distribution (bull/neutral/bear) that sums to 100.
 * This is the canonical FMOS probability distribution.
 *
 * Applies shrinkage toward neutral when evidence is weak (evidenceDiversity < 20)
 * or confidence is low (< 45). Pressure alone cannot create 70%+ conviction.
 *
 * @param pressure         - Overall pressure index (0–100)
 * @param creditScore      - Credit contagion vector score (0–100, optional)
 * @param evidenceDiversity - Evidence diversity score 0–100 (optional, default 50)
 * @param confidenceScore   - Overall confidence score 0–100 (optional, default 50)
 */
export function computeProbabilityDistribution(
  pressure: number,
  creditScore = 30,
  evidenceDiversity = 50,
  confidenceScore = 50
): { bull: number; neutral: number; bear: number } {
  // Bull: inverse of pressure, weighted by credit conditions
  const rawBull = clamp(
    Math.round((100 - pressure) * 0.75 + (100 - creditScore) * 0.25),
    5,
    90
  );
  // Bear: direct pressure, weighted by credit conditions
  const rawBear = clamp(
    Math.round(pressure * 0.70 + creditScore * 0.30),
    5,
    90
  );
  // Normalize so bull + bear ≤ 95, neutral fills the rest
  const total = rawBull + rawBear;
  let bull: number, bear: number, neutral: number;
  if (total > 95) {
    const scale = 95 / total;
    bull = Math.round(rawBull * scale);
    bear = Math.round(rawBear * scale);
    neutral = 100 - bull - bear;
  } else {
    bull = rawBull;
    bear = rawBear;
    neutral = 100 - rawBull - rawBear;
  }

  // ── Evidence-quality shrinkage toward neutral ──────────────────
  // When evidence is weak or confidence is low, shrink bull/bear toward
  // neutral. This prevents false conviction from pressure alone.
  // Shrinkage factor: 0 = no shrinkage, 1 = full collapse to neutral
  const evidenceQuality = clamp(Math.round((evidenceDiversity + confidenceScore) / 2));
  if (evidenceQuality < 45) {
    // Shrinkage is proportional to how weak the evidence is
    // At evidenceQuality=0: shrink 40% toward neutral
    // At evidenceQuality=44: shrink ~5% toward neutral
    const shrinkFactor = clamp((45 - evidenceQuality) / 45 * 0.40, 0, 0.40);
    const neutralTarget = 33; // full-uncertainty neutral baseline
    bull = Math.round(bull * (1 - shrinkFactor) + neutralTarget * shrinkFactor);
    bear = Math.round(bear * (1 - shrinkFactor) + neutralTarget * shrinkFactor);
    neutral = 100 - bull - bear;
    // Ensure neutral is at least 10% when evidence is weak
    if (neutral < 10) {
      const deficit = 10 - neutral;
      bull = Math.max(5, bull - Math.ceil(deficit / 2));
      bear = Math.max(5, bear - Math.floor(deficit / 2));
      neutral = 100 - bull - bear;
    }
  }

  return { bull: clamp(bull, 5, 90), neutral: clamp(neutral, 5, 90), bear: clamp(bear, 5, 90) };
}

// ── Confidence Utilities ──────────────────────────────────────

/**
 * Convert a raw confidence score (0–100) to a qualitative label.
 */
export function confidenceToLabel(
  confidence: number
): "Very High" | "High" | "Moderate" | "Low" | "Very Low" {
  if (confidence >= 80) return "Very High";
  if (confidence >= 65) return "High";
  if (confidence >= 45) return "Moderate";
  if (confidence >= 25) return "Low";
  return "Very Low";
}

// ── Time Utilities ────────────────────────────────────────────

/**
 * Return a human-readable "X min ago" / "X hours ago" string.
 */
export function relativeTime(isoTimestamp: string): string {
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
