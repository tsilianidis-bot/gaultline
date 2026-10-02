/* ============================================================
   Simulate Pressure (/app/pressure?tab=scenarios) display helpers.
   Presentation only: nothing here changes any score.

   - Not simulating: the headline and vector grid show the canonical
     Pressure Index and the canonical engine vectors on their 0–100 scale,
     with source and ET as-of.
   - Simulating: the sandbox runs the browser model on fixed example
     defaults plus the user's overrides. Its 0–10 output is displayed on
     the same 0–100 scale (×10) and labelled as a sandbox result.
   ============================================================ */
import type { PublicCanonicalIntelligenceState } from "@shared/canonicalIntelligenceState";
import { formatEt } from "@shared/credibilityLabels";
import { pressureVectorLabel } from "@shared/pressureVectorLabels";

/** 0–10 browser-model score → 0–100 display value (rounded). Non-finite → null. */
export function sandboxScoreOn100(score0to10: number | null | undefined): number | null {
  if (typeof score0to10 !== "number" || !Number.isFinite(score0to10)) return null;
  return Math.round(Math.min(10, Math.max(0, score0to10)) * 10);
}

/** value is null when the engine published no score: rendered "—", never 0. */
export interface CanonicalVectorRow { id: string; label: string; value: number | null }

export type CanonicalSummary =
  | { available: false; basis: string }
  | { available: true; score: number; regime: string | null; basis: string; vectors: CanonicalVectorRow[] };

type StateLike = Pick<PublicCanonicalIntelligenceState, "pressureIndex" | "regime" | "effectiveAt" | "engines" | "confidenceOrEvidenceQuality"> | null | undefined;

export function canonicalSummary(state: StateLike): CanonicalSummary {
  if (!state) return { available: false, basis: "Canonical Pressure state unavailable" };
  const p = state.pressureIndex;
  if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 100 || state.confidenceOrEvidenceQuality === "UNAVAILABLE") {
    return { available: false, basis: "Canonical Pressure Index unavailable" };
  }
  const vectors = (state.engines ?? [])
    .filter(e => e.unit === "score_0_to_100")
    .map(e => ({
      id: e.engineId,
      label: pressureVectorLabel(e.engineId, e.engineName),
      value: typeof e.value === "number" && Number.isFinite(e.value) && e.value >= 0 && e.value <= 100 ? Math.round(e.value) : null,
    }));
  return {
    available: true,
    score: Math.round(p),
    regime: state.regime ?? null,
    basis: `Canonical Pressure Index · as of ${formatEt(state.effectiveAt) ?? "—"} · evidence ${state.confidenceOrEvidenceQuality}`,
    vectors,
  };
}

export const SANDBOX_BASIS = "Sandbox model on fixed example inputs plus your overrides · not the canonical engine, not live";
