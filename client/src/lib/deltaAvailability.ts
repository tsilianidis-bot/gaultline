/* ============================================================
   Delta availability (display only).

   #60 marks a canonical-projection delta as unknown with
   `deltaAvailable: false` and keeps the numeric `delta` at 0 for legacy
   readers. A missing delta must render "—" / Unavailable, never "Stable"
   or "0 vs baseline". Written defensively (no dependency on #60's
   availableDelta helper or its DomainScore fields), so it behaves the same
   with and without #60: no flag → the finite numeric delta is used.
   ============================================================ */

export interface DeltaLike {
  delta?: unknown;
  deltaAvailable?: boolean;
}

/** The delta when it is known; null when flagged unavailable or not a finite number. */
export function knownDelta(item: DeltaLike | null | undefined): number | null {
  if (!item || item?.deltaAvailable === false) return null;
  const d = item?.delta;
  return typeof d === "number" && Number.isFinite(d) ? d : null;
}

export type DeltaTrend = "deteriorating" | "improving" | "stable" | "unavailable";

/** Domain trend from a 0–10 delta (±0.1 band); "unavailable" when the delta is unknown. */
export function deltaTrend(item: DeltaLike | null | undefined): DeltaTrend {
  const d = knownDelta(item);
  if (d === null) return "unavailable";
  return d > 0.1 ? "deteriorating" : d < -0.1 ? "improving" : "stable";
}

/** Composite direction label from a 0–10 delta; "Unavailable" when the delta is unknown. */
export function deltaDirection(item: DeltaLike | null | undefined): "Deteriorating" | "Improving" | "Stable" | "Unavailable" {
  const t = deltaTrend(item);
  return t === "unavailable" ? "Unavailable" : t === "deteriorating" ? "Deteriorating" : t === "improving" ? "Improving" : "Stable";
}

/** "+3.5 pts vs baseline" for a known 0–10 delta (×10 → 0–100 points); "Δ unavailable" when unknown. */
export function vsBaselineText(item: DeltaLike | null | undefined): string {
  const d = knownDelta(item);
  if (d === null) return "Δ unavailable";
  const pts = Math.round(d * 100) / 10;
  return `${pts > 0 ? "+" : ""}${pts.toFixed(1)} pts vs baseline`;
}
