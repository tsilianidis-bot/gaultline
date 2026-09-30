/**
 * Landing-page view of the public canonical Pressure Index.
 *
 * Built on the single-snapshot selector from PR #40
 * (client/src/lib/pressureSnapshot.ts): score, band, regime and as-of time all
 * come from ONE marketState.canonicalCurrent result, the same query the public
 * /pressure-index page uses. Bands are the engine thresholds (25/45/65/80) with
 * the engine labels (LOW RISK … SYSTEMIC CRISIS). A missing, withheld or
 * invalid score is "unavailable"; it is never replaced with 0.
 */
import { customerIntegrityLabel, type CustomerIntegrityLabel } from "@shared/customerIntegrityLabels";
import { AI_CONCENTRATION_STATIC_BASELINE_INPUT_ID, PRESSURE_VECTOR_DISPLAY } from "@shared/pressureVectorLabels";
import type { PressureSnapshotView } from "@/lib/pressureSnapshot";

export const PRESSURE_VECTOR_ORDER = [
  ["liquidity-stress", "20%"],
  ["credit-contagion", "20%"],
  ["volatility-regime", "15%"],
  ["macro-sensitivity", "20%"],
  ["market-breadth", "10%"],
  ["ai-bubble", "15%"],
] as const;

export interface LandingVectorReading {
  id: string;
  label: string;
  weight: string;
  /** null when the canonical state does not carry a usable value */
  value: number | null;
  staticBaseline: boolean;
}

export type LandingPressure =
  | { status: "loading" }
  | { status: "unavailable"; reason: string }
  | {
      status: "available";
      /** Rounded display score from the snapshot. */
      score: number;
      /** Engine band label, e.g. "HIGH STRESS". */
      band: string;
      bandRange: string;
      /** Regime as published by the canonical state. */
      regime: string;
      regimeMatchesBand: boolean;
      /** Time the canonical state is effective for. */
      asOf: string;
      integrity: CustomerIntegrityLabel;
      refreshFailed: boolean;
      vectors: LandingVectorReading[];
    };

const UNAVAILABLE_REASON: Record<Extract<PressureSnapshotView, { status: "unavailable" }>["reason"], string> = {
  NO_STATE: "No canonical Pressure Index reading is published right now.",
  QUERY_ERROR: "The public Pressure Index could not be reached.",
  WITHHELD: "Canonical evidence is withheld right now.",
  INVALID_SCORE: "The canonical score is missing or invalid.",
};

/** Pure mapping from the single pressure snapshot to the landing view. */
export function landingFromSnapshot(view: PressureSnapshotView): LandingPressure {
  if (view.status === "loading") return { status: "loading" };
  if (view.status === "unavailable") return { status: "unavailable", reason: UNAVAILABLE_REASON[view.reason] };

  const state = view.state;
  const integrity = customerIntegrityLabel({
    hasState: true,
    quality: state.confidenceOrEvidenceQuality,
    coherence: state.provenance?.coherenceStatus,
    fallbackInputCount: state.dataQualitySummary?.fallbackInputCount,
    staleInputCount: state.dataQualitySummary?.staleInputCount,
  });

  const vectors = PRESSURE_VECTOR_ORDER.map(([id, weight]) => {
    const engine = state.engines.find((item) => item.engineId === id);
    const usable = !!engine && typeof engine.value === "number" && Number.isFinite(engine.value) && engine.qualityStatus !== "UNAVAILABLE";
    return {
      id,
      label: PRESSURE_VECTOR_DISPLAY[id].label,
      weight,
      value: usable ? (engine!.value as number) : null,
      staticBaseline: engine ? engine.sourceInputIds.includes(AI_CONCENTRATION_STATIC_BASELINE_INPUT_ID) : id === "ai-bubble",
    };
  });

  return {
    status: "available",
    score: view.displayScore,
    band: view.band.regime,
    bandRange: view.band.range,
    regime: view.regime,
    regimeMatchesBand: view.regimeMatchesBand,
    asOf: view.provenance.asOf,
    integrity,
    refreshFailed: view.refreshFailed,
    vectors,
  };
}

/** Coarse age of a reading ("12 min ago"). */
export function formatReadingAge(iso: string, now = Date.now()): string | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const minutes = Math.max(0, Math.round((now - t) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export const INTEGRITY_COPY: Record<CustomerIntegrityLabel, string> = {
  LIVE: "Live canonical evidence.",
  CACHED: "Latest persisted canonical snapshot. Monthly FRED series carry publication lag.",
  STALE: "Some inputs are stale. Treat the reading with care.",
  FALLBACK: "Some inputs are on a governed fallback. Treat the reading with care.",
  UNAVAILABLE: "Evidence is unavailable.",
};
