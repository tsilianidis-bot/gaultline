/* ============================================================
   Confidence display gating (presentation only).

   A numeric confidence % may be shown ONLY when enough valid underlying data
   supports it. When required inputs are insufficient the display is
   "Insufficient data" (partial inputs) or "Unavailable" (no inputs) — never a
   number. This does not change how any engine computes confidence.
   ============================================================ */

export type ConfidenceDisplayState = "AVAILABLE" | "INSUFFICIENT" | "UNAVAILABLE";

export interface ConfidenceDisplay {
  state: ConfidenceDisplayState;
  /** Text to render, e.g. "90% confidence", "Confidence: Insufficient data". */
  text: string;
  /** Numeric value to render, or null when it must not be shown. */
  percent: number | null;
}

export const CONFIDENCE_INSUFFICIENT_TEXT = "Confidence: Insufficient data";
export const CONFIDENCE_UNAVAILABLE_TEXT = "Confidence: Unavailable";

/**
 * Generic gate: `sufficient` must be true (required inputs complete) AND the
 * value must be a finite 0–100 number for a % to be shown.
 */
export function gatedConfidence(input: {
  confidence: number | null | undefined;
  sufficient: boolean;
  /** true when there is no valid underlying input at all */
  noData?: boolean;
}): ConfidenceDisplay {
  const { confidence, sufficient, noData } = input;
  if (noData) return { state: "UNAVAILABLE", text: CONFIDENCE_UNAVAILABLE_TEXT, percent: null };
  if (!sufficient) return { state: "INSUFFICIENT", text: CONFIDENCE_INSUFFICIENT_TEXT, percent: null };
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
    return { state: "UNAVAILABLE", text: CONFIDENCE_UNAVAILABLE_TEXT, percent: null };
  }
  const percent = Math.round(confidence);
  return { state: "AVAILABLE", text: `${percent}% confidence`, percent };
}

/**
 * S.O.B.: a confidence % is supported only when every required pillar has
 * valid data (coverage COMPLETE) — the same completeness rule as "Clear".
 */
export function sobConfidenceDisplay(sob: {
  confidence: number | null | undefined;
  coverage: "COMPLETE" | "PARTIAL" | "UNAVAILABLE" | string | null | undefined;
}): ConfidenceDisplay {
  return gatedConfidence({
    confidence: sob.confidence,
    sufficient: sob.coverage === "COMPLETE",
    noData: sob.coverage === "UNAVAILABLE" || sob.coverage == null,
  });
}
