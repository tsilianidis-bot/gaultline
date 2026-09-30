/* ============================================================
   Pressure snapshot view model (presentation only).

   Every value a pressure gauge shows — ring fill, number, band, regime,
   timestamp and interpretation — is selected from ONE canonical state
   object (marketState.canonicalCurrent). Nothing here calculates a score:
   bands are read from the existing engine thresholds.

   Missing, withheld, invalid or loading data never becomes 0. It yields an
   explicit "loading" or "unavailable" view.
   ============================================================ */
import type { PublicCanonicalIntelligenceState } from "@shared/canonicalIntelligenceState";
import { CHAMPION_REGIME_THRESHOLDS } from "../../../server/pressure/championBaseline";

export type PressureBandRegime = (typeof CHAMPION_REGIME_THRESHOLDS)[number]["regime"];

export interface PressureBand {
  /** Engine regime label for this band, e.g. "MODERATE RISK". */
  regime: PressureBandRegime;
  /** Short legend label, e.g. "MODERATE" or "HIGH STRESS". */
  label: string;
  /** Engine level for this band, e.g. "Moderate" (CHAMPION_REGIME_THRESHOLDS). */
  level: (typeof CHAMPION_REGIME_THRESHOLDS)[number]["level"];
  /** Inclusive lower bound, from the engine thresholds. */
  min: number;
  /** Exclusive upper bound (null for the top band). */
  maxExclusive: number | null;
  /** Human legend range, e.g. "<25", "25–44", "80+". */
  range: string;
  color: string;
  interpretation: string;
}

// Interpretation copy is the page's existing copy, re-keyed to the engine bands.
const CONVERGING_INTERPRETATION =
  "Multiple systemic stress vectors are converging. Elevated probability of cascade events. Risk management protocols should be active.";

const BAND_PRESENTATION: Record<PressureBandRegime, { color: string; interpretation: string }> = {
  "LOW RISK": {
    color: "#00E5FF",
    interpretation: "Systemic risk indicators are contained. Macro environment supports measured risk-taking with appropriate position sizing.",
  },
  "MODERATE RISK": {
    color: "#FFD700",
    interpretation: "Moderate pressure building across key risk vectors. Markets are navigating macro uncertainty with some resilience.",
  },
  "ELEVATED RISK": {
    color: "#EAB308",
    interpretation: "Significant macro stress detected across credit, rates, and volatility dimensions. Heightened vigilance warranted.",
  },
  "HIGH STRESS": {
    color: "#FF9500",
    interpretation: CONVERGING_INTERPRETATION,
  },
  "SYSTEMIC CRISIS": {
    color: "#FF4444",
    interpretation: CONVERGING_INTERPRETATION,
  },
};

/** Legend bands in ascending order, derived from the engine thresholds. */
export const PRESSURE_BANDS: readonly PressureBand[] = [...CHAMPION_REGIME_THRESHOLDS]
  .sort((a, b) => a.minimum - b.minimum)
  .map((threshold, index, ascending) => {
    const next = ascending[index + 1];
    const maxExclusive = next ? next.minimum : null;
    const range = index === 0 && maxExclusive != null
      ? `<${maxExclusive}`
      : maxExclusive == null
      ? `${threshold.minimum}+`
      : `${threshold.minimum}–${maxExclusive - 1}`;
    return {
      regime: threshold.regime,
      label: threshold.regime.replace(/ RISK$/, ""),
      level: threshold.level,
      min: threshold.minimum,
      maxExclusive,
      range,
      ...BAND_PRESENTATION[threshold.regime],
    };
  });

export const PRESSURE_UNAVAILABLE_COLOR = "#64748B";

export function isValidPressureScore(score: unknown): score is number {
  return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;
}

/** Band for a valid 0–100 score, using the engine's inclusive lower bounds. */
export function pressureBandFor(score: number): PressureBand {
  let band = PRESSURE_BANDS[0];
  for (const candidate of PRESSURE_BANDS) if (score >= candidate.min) band = candidate;
  return band;
}

export type PressureUnavailableReason = "NO_STATE" | "QUERY_ERROR" | "WITHHELD" | "INVALID_SCORE";

export interface PressureSnapshotProvenance {
  stateId: string;
  stateHash: string;
  /** Time the canonical state is effective for (the timestamp shown to readers). */
  asOf: string;
  generatedAt: string;
  coherenceStatus: PublicCanonicalIntelligenceState["provenance"]["coherenceStatus"];
  evidenceQuality: PublicCanonicalIntelligenceState["confidenceOrEvidenceQuality"];
}

export type PressureSnapshotView =
  | { status: "loading" }
  | {
      status: "unavailable";
      reason: PressureUnavailableReason;
      /** Present when a state object exists but its score is withheld/invalid. */
      provenance: PressureSnapshotProvenance | null;
    }
  | {
      status: "ready";
      /** The single canonical state object every displayed value comes from. */
      state: PublicCanonicalIntelligenceState;
      provenance: PressureSnapshotProvenance;
      score: number;
      /** Rounded score for display; the ring fill uses the same value. */
      displayScore: number;
      band: PressureBand;
      /** Regime as published by the canonical state (falls back to the band's engine label). */
      regime: string;
      /** False when the published regime does not match the band for the published score. */
      regimeMatchesBand: boolean;
      interpretation: string;
      /** True when a background refresh failed and this is the last good snapshot. */
      refreshFailed: boolean;
    };

export interface PressureSnapshotQueryState {
  data: PublicCanonicalIntelligenceState | null | undefined;
  isLoading: boolean;
  error?: unknown;
}

function provenanceOf(state: PublicCanonicalIntelligenceState): PressureSnapshotProvenance {
  return {
    stateId: state.stateId,
    stateHash: state.stateHash,
    asOf: state.effectiveAt,
    generatedAt: state.generatedAt,
    coherenceStatus: state.provenance?.coherenceStatus ?? "UNAVAILABLE",
    evidenceQuality: state.confidenceOrEvidenceQuality,
  };
}

/** Select the gauge view from exactly one canonicalCurrent query result. */
export function selectPressureSnapshot({ data, isLoading, error }: PressureSnapshotQueryState): PressureSnapshotView {
  if (!data) {
    if (isLoading) return { status: "loading" };
    return { status: "unavailable", reason: error ? "QUERY_ERROR" : "NO_STATE", provenance: null };
  }
  const provenance = provenanceOf(data);
  if (data.confidenceOrEvidenceQuality === "UNAVAILABLE") {
    return { status: "unavailable", reason: "WITHHELD", provenance };
  }
  if (!isValidPressureScore(data.pressureIndex)) {
    return { status: "unavailable", reason: "INVALID_SCORE", provenance };
  }
  const score = data.pressureIndex;
  const displayScore = Math.round(score);
  const band = pressureBandFor(score);
  const regime = data.regime?.trim() ? data.regime : band.regime;
  return {
    status: "ready",
    state: data,
    provenance,
    score,
    displayScore,
    band,
    regime,
    regimeMatchesBand: regime.toUpperCase() === band.regime,
    interpretation: band.interpretation,
    refreshFailed: Boolean(error),
  };
}

/** Ring fill fraction (0–1) for a ready snapshot; null otherwise so callers cannot draw a 0 ring. */
export function pressureRingFraction(view: PressureSnapshotView): number | null {
  return view.status === "ready" ? view.displayScore / 100 : null;
}

/** "2026-09-29 18:02 UTC" — explicit zone, deterministic across clients. */
export function formatPressureAsOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
