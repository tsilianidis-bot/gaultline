// Directional condition classification (Phase 2 #6, 2026-10-13).
// "Recovery" / "improving" must come from an ACTUAL change between two
// observations of the same v1 engine (which is a deterministic function of the
// underlying FRED observations), never from a low absolute level alone.

export type ConditionState =
  | "Low current stress"
  | "Improving"
  | "Deteriorating"
  | "Elevated stress"
  | "Insufficient evidence";

/** Minimum engine-score change (points, 0–100 scale) treated as a direction. */
export const DIRECTION_MIN_CHANGE = 3;
/** Engine score at/above which a family is "Elevated stress" (canonical Elevated band). */
export const ELEVATED_STRESS_MIN = 45;
/** Engine score below which a stable family is "Low current stress" (canonical Low band). */
export const LOW_STRESS_MAX_EXCLUSIVE = 25;

function finite(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function classifyCondition(
  current: number | null | undefined,
  previous: number | null | undefined,
): { state: ConditionState; change: number | null; trend: "improving" | "deteriorating" | "stable" } {
  if (!finite(current)) return { state: "Insufficient evidence", change: null, trend: "stable" };
  const change = finite(previous) ? current - previous : null;
  const trend = change === null ? "stable"
    : change >= DIRECTION_MIN_CHANGE ? "deteriorating"
    : change <= -DIRECTION_MIN_CHANGE ? "improving" : "stable";
  if (current >= ELEVATED_STRESS_MIN) return { state: "Elevated stress", change, trend };
  if (trend === "deteriorating") return { state: "Deteriorating", change, trend };
  if (trend === "improving") return { state: "Improving", change, trend };
  if (current < LOW_STRESS_MAX_EXCLUSIVE) return { state: "Low current stress", change, trend };
  return { state: "Insufficient evidence", change, trend };
}

export const RECOVERY_CORE_FAMILIES = ["Credit Markets", "Liquidity Conditions", "Macro Sensitivity"] as const;

/**
 * Broad Recovery requires verified directional improvement: at least two of
 * Credit / Liquidity / Macro Sensitivity Improving, none of them Deteriorating
 * or Elevated, and at least three families Improving overall.
 */
export function isBroadRecoveryVerified(
  families: Array<{ name: string; conditionState?: ConditionState }>,
  compositeScore: number,
): boolean {
  if (!finite(compositeScore) || compositeScore > 45) return false;
  const core = families.filter(f => (RECOVERY_CORE_FAMILIES as readonly string[]).includes(f.name));
  if (core.some(f => f.conditionState === "Deteriorating" || f.conditionState === "Elevated stress")) return false;
  const coreImproving = core.filter(f => f.conditionState === "Improving").length;
  const improving = families.filter(f => f.conditionState === "Improving").length;
  return coreImproving >= 2 && improving >= 3;
}
