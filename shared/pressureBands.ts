/**
 * Canonical Pressure Index risk bands (display only).
 *
 * James / product contract — inclusive ranges on the displayed 0–100 score:
 *   0–24   LOW
 *   25–44  MODERATE
 *   45–64  ELEVATED
 *   65–79  HIGH STRESS
 *   80–100 SYSTEMIC CRISIS
 *
 * Every customer-facing score→label / badge / colour mapping must go through
 * `pressureBand(score)` (or the thin helpers below). This module does not
 * calculate the Pressure Index; it only labels a displayed score.
 */
export type PressureBandId = "low" | "moderate" | "elevated" | "high" | "crisis";

export type PressureBandRegime =
  | "LOW RISK"
  | "MODERATE RISK"
  | "ELEVATED RISK"
  | "HIGH STRESS"
  | "SYSTEMIC CRISIS";

export interface PressureBandDefinition {
  /** Inclusive lower bound (0–100). */
  min: number;
  /** Inclusive upper bound (0–100). */
  max: number;
  id: PressureBandId;
  /** Short gauge / legend label (e.g. "MODERATE", "HIGH STRESS"). */
  shortLabel: string;
  /** Full regime / badge text (e.g. "MODERATE RISK"). */
  regime: PressureBandRegime;
  /** Title-case level word used in some narrative / engine-adjacent surfaces. */
  level: "Low" | "Moderate" | "Elevated" | "High" | "Critical";
  /** Compact risk-token used by RiskBadge / getRiskColor. */
  riskLevel: "low" | "moderate" | "elevated" | "high" | "critical";
  /** Display colour for the band. */
  color: string;
  /** Human range legend, e.g. "25–44". */
  range: string;
  /** One-line description for methodology / trust surfaces. */
  description: string;
}

export const PRESSURE_BANDS: readonly PressureBandDefinition[] = [
  {
    min: 0,
    max: 24,
    id: "low",
    shortLabel: "LOW",
    regime: "LOW RISK",
    level: "Low",
    riskLevel: "low",
    color: "#00E5FF",
    range: "0–24",
    description: "Low measured pressure across the implemented inputs.",
  },
  {
    min: 25,
    max: 44,
    id: "moderate",
    shortLabel: "MODERATE",
    regime: "MODERATE RISK",
    level: "Moderate",
    riskLevel: "moderate",
    color: "#FFD700",
    range: "25–44",
    description: "Moderate measured pressure; monitor changes in the contributing inputs.",
  },
  {
    min: 45,
    max: 64,
    id: "elevated",
    shortLabel: "ELEVATED",
    regime: "ELEVATED RISK",
    level: "Elevated",
    riskLevel: "elevated",
    color: "#EAB308",
    range: "45–64",
    description: "Elevated measured pressure across the composite score.",
  },
  {
    min: 65,
    max: 79,
    id: "high",
    shortLabel: "HIGH STRESS",
    regime: "HIGH STRESS",
    level: "High",
    riskLevel: "high",
    color: "#FF9500",
    range: "65–79",
    description: "High measured pressure; review the input evidence and its freshness.",
  },
  {
    min: 80,
    max: 100,
    id: "crisis",
    shortLabel: "SYSTEMIC CRISIS",
    regime: "SYSTEMIC CRISIS",
    level: "Critical",
    riskLevel: "critical",
    color: "#FF4444",
    range: "80–100",
    description: "Critical measured pressure. This band does not establish a probability of a crash.",
  },
] as const;

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, score));
}

/**
 * Canonical band for a displayed 0–100 Pressure Index score.
 * Uses inclusive bounds; non-finite input collapses to the LOW band.
 */
export function pressureBand(score: number): PressureBandDefinition {
  const s = clampScore(score);
  for (let i = PRESSURE_BANDS.length - 1; i >= 0; i -= 1) {
    if (s >= PRESSURE_BANDS[i].min) return PRESSURE_BANDS[i];
  }
  return PRESSURE_BANDS[0];
}

/** Full badge / regime text derived from the displayed score. */
export function pressureRegimeLabel(score: number): PressureBandRegime {
  return pressureBand(score).regime;
}

/** Short gauge label derived from the displayed score. */
export function pressureShortLabel(score: number): string {
  return pressureBand(score).shortLabel;
}

/** Band colour derived from the displayed score. */
export function pressureBandColor(score: number): string {
  return pressureBand(score).color;
}

/** RiskBadge-compatible level token derived from the displayed score. */
export function pressureRiskLevel(score: number): "low" | "moderate" | "elevated" | "high" | "critical" {
  return pressureBand(score).riskLevel;
}

/** Title-case level word (Low / Moderate / …). */
export function pressureLevelWord(score: number): PressureBandDefinition["level"] {
  return pressureBand(score).level;
}

/**
 * Map a published regime string to a RiskBadge level without inventing a score.
 * Prefer `pressureRiskLevel(displayedScore)` when a score is on screen.
 */
export function regimeToRiskLevel(regime: string | null | undefined): "low" | "moderate" | "elevated" | "high" | "critical" {
  switch ((regime ?? "").trim().toUpperCase()) {
    case "LOW RISK":
      return "low";
    case "MODERATE RISK":
      return "moderate";
    case "ELEVATED RISK":
      return "elevated";
    case "HIGH STRESS":
      return "high";
    case "SYSTEMIC CRISIS":
      return "critical";
    default:
      return "moderate";
  }
}
