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

/**
 * Probability cell text. A finite 0–100 number renders as "N%"; anything else
 * (null, undefined, NaN for a withheld probability, out of range) renders "—",
 * never "NaN%" or "0%".
 */
export function probabilityPercentText(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) return "—";
  return `${value}%`;
}

/**
 * Simulate probability cell (Crash/Bear, Recession, Stagflation). Display only.
 *
 * - With #60's probability contract on the output (`probabilityDisplay`), the
 *   contract decides: a number only when that field is AVAILABLE, else "—".
 * - Without a contract (#59 alone), canonical and deterministic-fallback values
 *   cannot be trusted: marketStateService / marketStateProjection turn a withheld
 *   (NaN) probability into 0 via normalizeCanonicalMetric, and the fallback is
 *   the demo baseline. Those render "—". Only the sandbox (the user's own
 *   overrides through the browser model) shows its finite result.
 */
export type SimProbabilityKey = "crashProbability" | "recessionProbability" | "stagflationProbability";
type ProbabilityContractEntry = { state?: string; percent?: number | null } | null | undefined;
export function probabilityCellText(
  output: { probability?: Partial<Record<SimProbabilityKey, unknown>>; probabilityDisplay?: Partial<Record<SimProbabilityKey, ProbabilityContractEntry>> } | null | undefined,
  key: SimProbabilityKey,
  isSimulating: boolean,
): string {
  const contract = output?.probabilityDisplay;
  if (contract) {
    const entry = contract?.[key];
    return entry?.state === "AVAILABLE" ? probabilityPercentText(entry?.percent) : "—";
  }
  return isSimulating ? probabilityPercentText(output?.probability?.[key]) : "—";
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
