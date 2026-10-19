/**
 * Display-only credibility labels (Oct 2 2026).
 *
 * No engine calculation is changed here. These helpers only decide how an
 * existing number may be presented, based on what the code/docs actually
 * support about it:
 *
 * 1. Systemic Regime `regimeConfidence` is the hmmlearn GaussianHMM posterior
 *    (predict_proba, forward-backward smoothed over the scored window) of the
 *    decoded current state on the last row (quant/systemic-regime/inference.py).
 *    No calibration exists for it. The only calibration check in the repo
 *    (validate.py `_calibration`) is on the CRISIS-state probability, and for
 *    the approved 2-state FRED model it reports ECE 0.515 (top bin: mean
 *    predicted 0.996 vs observed event frequency 0.184),
 *    artifacts/fred_validation_report.json. So it is shown as an uncalibrated
 *    model score, to one decimal, never rounded up to 100%.
 *
 * 2. Header "EQ/BTC <regime> NN%" confidences are not probabilities:
 *    - EQ (stockRegimeEngine.classifyRegime): winner share of a hand-weighted
 *      point tally, shrunk by the runner-up gap, clamped to 45..92.
 *    - BTC (cryptoIntelligence.buildBtcDashboard): a hard-coded constant per
 *      cycle phase (e.g. Early Bull = 65, Distribution = 60), derived from the
 *      macro Pressure vectors with no BTC price input.
 *    Neither has a horizon or a validation record, so the % is suppressed.
 */

import { PROBABILITY_DISPLAY_TEXT, SYSTEMIC_REGIME_CALIBRATION, type CalibrationRecord } from "./probabilityContract";

/** Exact customer-facing disclosure when Systemic Regime probability fields are uncalibrated (#60 contract). */
export const SYSTEMIC_REGIME_PROBABILITY_WITHHELD_TEXT =
  "Probability outputs withheld until calibration is validated." as const;

/** Exact customer-facing disclosure when Bull/Neutral/Bear scenario weights are not AVAILABLE. */
export const SCENARIO_PROBABILITY_WITHHELD_TEXT =
  "Quantitative scenario probabilities are withheld pending calibration." as const;

/**
 * Short caption under the Systemic Regime label: independent statistical model,
 * not the Pressure Index, and not a claim that overall market risk is low.
 */
export const SYSTEMIC_REGIME_INDEPENDENT_CAPTION =
  "Independent statistical regime model (PCA + HMM). Not the Pressure Index and not a reading that overall market risk is low." as const;

/** True when Stress / Crisis p / Model score must be withheld (existing #60 calibration record). */
export function systemicRegimeProbabilityOutputsWithheld(calibration: Pick<CalibrationRecord, "status"> = SYSTEMIC_REGIME_CALIBRATION): boolean {
  return calibration.status !== "CALIBRATED";
}


export const REGIME_MODEL_SCORE_LABEL = "Model score (uncalibrated)";

/** Format a 0..1 model score to one decimal place without rounding up to 100%. */
export function formatModelScorePct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const clamped = Math.min(1, Math.max(0, value));
  if (clamped >= 0.9995) return ">99.9%";
  if (clamped > 0 && clamped < 0.0005) return "<0.1%";
  return `${(Math.round(clamped * 1000) / 10).toFixed(1)}%`;
}

const ET_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Oct 1, 3:00 PM ET" for an ISO string / epoch ms; null when not a valid time. */
export function formatEt(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${ET_FORMAT.format(date)} ET`;
}

export interface RegimeScoreInput {
  regimeConfidence: number | null | undefined;
  currentRegime: string | null | undefined;
  dataAsOf: string | null | undefined;
  computedAt: string | null | undefined;
  modelType?: string | null;
  nStates?: number | null;
}

export interface RegimeScoreDisplay {
  label: string;
  value: string;
  asOf: string;
  explanation: string;
}

export function regimeModelScoreDisplay(reading: RegimeScoreInput | null | undefined, unavailable: boolean): RegimeScoreDisplay {
  if (unavailable || !reading) {
    return {
      label: REGIME_MODEL_SCORE_LABEL,
      value: "—",
      asOf: "no current inference",
      explanation: "No current Systemic Regime inference; no model score is shown.",
    };
  }
  const computed = formatEt(reading.computedAt);
  const asOf = [reading.dataAsOf ? `data through ${reading.dataAsOf}` : null, computed ? `computed ${computed}` : null]
    .filter(Boolean)
    .join(" · ") || "as-of unknown";
  const states = reading.nStates ? `${reading.nStates}-state ` : "";
  return {
    label: REGIME_MODEL_SCORE_LABEL,
    // Probability contract: the HMM posterior is uncalibrated (validation ECE
    // 0.5152), so its number is withheld; the state name above still renders.
    value: PROBABILITY_DISPLAY_TEXT.UNCALIBRATED,
    asOf,
    explanation:
      `Posterior weight the ${states}statistical HMM gives its current state (${reading.currentRegime ?? "—"}) on the latest scored day. ` +
      `It describes model fit, is not calibrated (validation ECE ${SYSTEMIC_REGIME_CALIBRATION.value}), and is not a forecast or a measure of accuracy, so no percentage is shown.`,
  };
}

export interface HeaderRegimeInput {
  regime?: string | null;
  confidence?: number | null;
  fetchedAt?: number | null;
}

export interface HeaderRegimeChip {
  regime: string;
  /** Short qualifier shown instead of a percentage. */
  tag: string;
  /** Hover text: what it is, inputs, as-of, limitation. */
  title: string;
}

/**
 * Header regime chip. Never shows the engine "confidence" percentage (not a
 * probability, no horizon, not validated). States what the label is instead.
 */
export function headerRegimeChip(kind: "EQ" | "BTC", summary: HeaderRegimeInput | null | undefined): HeaderRegimeChip {
  const regime = summary?.regime && summary.regime !== "UNAVAILABLE" ? summary.regime : null;
  if (!regime) {
    return {
      regime: "UNAVAILABLE",
      tag: "",
      title: `${kind} regime classification unavailable.`,
    };
  }
  const computed = formatEt(summary?.fetchedAt ?? null);
  const when = computed ? ` Computed ${computed} (cached up to 10 min).` : "";
  if (kind === "EQ") {
    return {
      regime,
      tag: "RULE-BASED",
      title:
        "Rule-based equity regime label from the Pressure Index, credit/liquidity/Labor & Rates vectors and SPY daily moving averages (last close)." +
        when +
        " No validated confidence or forecast horizon; no percentage is shown.",
    };
  }
  return {
    regime,
    tag: "MACRO-IMPLIED",
    title:
      "Rule-based crypto cycle label inferred from the macro Pressure vectors only (no BTC price input)." +
      when +
      " No validated confidence or forecast horizon; no percentage is shown.",
  };
}
