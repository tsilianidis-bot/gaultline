/**
 * NOW / Pulse interpretation copy — evidence-contracted wording only.
 *
 * Hierarchy (always):
 *   1. Current pressure level
 *   2. Historical percentile
 *   3. Direction of change
 *   4. Confirmation strength
 *
 * Hard rules:
 *   - Unavailable evidence is never cited as a current driver unless tied to a
 *     prior verified snapshot with date/time.
 *   - Uncalibrated ≠ directional confidence; Not offered ≠ low probability.
 *   - Missing vol/liquidity reduces confirmation (never ignored).
 *   - Improving / recovery ≠ low risk / constructive / safe when absolute
 *     pressure or historical percentile remains elevated.
 *   - Numbers come from live served values — never hard-coded demo fallbacks.
 */
import { describeHistoricalPercentile, formatOrdinal } from "./historicalPercentile";
import { pressureVectorLabel } from "./pressureVectorLabels";

export const LABOR_RATES_DISPLAY_NAME = pressureVectorLabel("market-breadth");
export const LIQUIDITY_FAMILY_MATCH = /liquidity/i;
export const VOLATILITY_OR_CURVE_MATCH = /volatility|yield curve/i;

export type EvidenceFamilyCopyInput = {
  name: string;
  signal: string;
  strength: number;
  currentValue?: string | null;
  trend?: string | null;
  /** Explicit availability; when omitted, inferred from currentValue. */
  available?: boolean;
};

export type NowInterpretationInput = {
  pressureScore: number;
  /** Regime label as served (e.g. "MODERATE RISK" or "Moderate Risk"). */
  regimeLabel: string;
  historicalPercentile: number | null;
  evidenceFamilies: EvidenceFamilyCopyInput[];
  /** Tracked families known missing from the current evidence set. */
  missingFamilyNames?: string[];
  /** When false, vol input is unavailable on the served surface. */
  volatilityAvailable?: boolean;
  /** When false, liquidity input is unavailable on the served surface. */
  liquidityAvailable?: boolean;
  /**
   * When false, scenario confidence is unavailable/uncalibrated
   * (e.g. Bull "Uncalibrated", Crash "Not offered").
   */
  scenarioConfidenceAvailable?: boolean;
  /** ISO / display timestamp if citing a prior verified snapshot as a driver. */
  priorSnapshotAt?: string | null;
};

const SMALL_CARDINALS = [
  "zero", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
] as const;

export function cardinalWord(n: number): string {
  const rounded = Math.max(0, Math.round(n));
  if (rounded < SMALL_CARDINALS.length) return SMALL_CARDINALS[rounded];
  return String(rounded);
}

export function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function stressLevelWord(score: number): "crisis" | "high" | "elevated" | "moderate" | "low" {
  if (score >= 80) return "crisis";
  if (score >= 65) return "high";
  if (score >= 45) return "elevated";
  if (score >= 30) return "moderate";
  return "low";
}

export function formatDisplayRegime(regime: string): string {
  const r = regime.trim();
  if (!r) return "Unclassified";
  // Preserve served casing when already title-like; otherwise title-case words.
  if (/[a-z]/.test(r) && /[A-Z]/.test(r)) return r;
  return r
    .toLowerCase()
    .split(/\s+/)
    .map(capitalize)
    .join(" ");
}

export function isEvidenceFamilyAvailable(family: EvidenceFamilyCopyInput): boolean {
  if (family.available === false) return false;
  if (family.available === true) return true;
  const value = (family.currentValue ?? "").trim();
  if (!value) return false;
  if (/unavailable|insufficient|not available|n\/a/i.test(value)) return false;
  if (value === "—" || value === "--" || value === "–") return false;
  if (!Number.isFinite(family.strength)) return false;
  return true;
}

export function availableEvidenceFamilies(
  families: EvidenceFamilyCopyInput[],
): EvidenceFamilyCopyInput[] {
  return families.filter(isEvidenceFamilyAvailable);
}

export function isHistoricallyElevatedPercentile(percentile: number | null): boolean {
  if (percentile === null || !Number.isFinite(percentile)) return false;
  // Matches describeHistoricalPercentile bands: above typical / historically /
  // exceptionally elevated (above 60).
  return Math.round(percentile) > 60;
}

export function laborRatesUnavailableMessage(): string {
  return `${LABOR_RATES_DISPLAY_NAME} data is currently unavailable, so its contribution to the latest regime assessment cannot be independently confirmed.`;
}

export function topThreatEvidenceCopy(hasThreat: boolean): string {
  return hasThreat
    ? "Strongest evidence family currently signaling stress."
    : "No single verified evidence family is currently dominating the risk signal.";
}

function familyLooksLike(family: EvidenceFamilyCopyInput, match: RegExp): boolean {
  return match.test(family.name);
}

export function hasAvailableFamily(
  families: EvidenceFamilyCopyInput[],
  match: RegExp,
): boolean {
  return availableEvidenceFamilies(families).some(f => familyLooksLike(f, match));
}

export function isLaborRatesUnavailable(input: NowInterpretationInput): boolean {
  const missing = (input.missingFamilyNames ?? []).some(n =>
    /labor|breadth/i.test(n) || n === LABOR_RATES_DISPLAY_NAME,
  );
  if (missing) return true;
  const labor = input.evidenceFamilies.find(
    f => f.name === LABOR_RATES_DISPLAY_NAME || /labor|breadth/i.test(f.name),
  );
  if (!labor) return true;
  return !isEvidenceFamilyAvailable(labor);
}

export function confirmationIncomplete(input: NowInterpretationInput): boolean {
  const families = input.evidenceFamilies;
  const volOk =
    input.volatilityAvailable !== false &&
    (input.volatilityAvailable === true || hasAvailableFamily(families, VOLATILITY_OR_CURVE_MATCH));
  const liqOk =
    input.liquidityAvailable !== false &&
    (input.liquidityAvailable === true || hasAvailableFamily(families, LIQUIDITY_FAMILY_MATCH));
  const scenarioOk = input.scenarioConfidenceAvailable !== false;
  const laborOk = !isLaborRatesUnavailable(input);
  // Missing any of these reduces confirmation.
  return !volOk || !liqOk || !scenarioOk || !laborOk;
}

function improvingOrRecoveringCount(families: EvidenceFamilyCopyInput[]): number {
  return availableEvidenceFamilies(families).filter(f => {
    const signal = (f.signal ?? "").toLowerCase();
    const trend = (f.trend ?? "").toLowerCase();
    return (
      signal === "bullish" ||
      signal === "recovering" ||
      trend === "improving"
    );
  }).length;
}

function stressedCount(families: EvidenceFamilyCopyInput[]): number {
  return availableEvidenceFamilies(families).filter(f => {
    const signal = (f.signal ?? "").toLowerCase();
    return signal === "stressed" || signal === "bearish";
  }).length;
}

/**
 * NOW verdict / what-is-happening narrative.
 * Live score + percentile only — never invents numbers.
 */
export function buildWhatIsHappeningCopy(input: NowInterpretationInput): string {
  const score = Math.round(input.pressureScore);
  const stress = stressLevelWord(score);
  const families = availableEvidenceFamilies(input.evidenceFamilies);
  const total = Math.max(families.length, input.evidenceFamilies.length);
  const bullish = improvingOrRecoveringCount(input.evidenceFamilies);
  const stressed = stressedCount(input.evidenceFamilies);
  const percentile = input.historicalPercentile;
  const hasPercentile = percentile !== null && Number.isFinite(percentile);
  const ordinal = hasPercentile ? formatOrdinal(percentile!) : null;
  const pctDesc = hasPercentile ? describeHistoricalPercentile(percentile!) : null;
  const elevatedHistorically = isHistoricallyElevatedPercentile(percentile);

  if (score >= 65) {
    const pctClause = hasPercentile
      ? `, placing current conditions in the ${ordinal} percentile (${pctDesc}) of all observations since 2000`
      : "";
    return `The market is operating under ${stress} systemic pressure (${score}/100)${pctClause}. ${stressed} of ${total} intelligence engines are signaling stress, with ${formatDisplayRegime(input.regimeLabel)} as the prevailing regime classification.`;
  }

  if (score >= 45) {
    const pctClause = hasPercentile
      ? `, in the ${ordinal} percentile historically (${pctDesc})`
      : "";
    return `The market is operating under ${stress} systemic pressure (${score}/100)${pctClause}. Conditions are mixed — ${stressed} engines signal stress while ${bullish} signal strength, producing a divergent environment that requires careful monitoring.`;
  }

  // Moderate / low absolute score: hierarchy first; never frame improvement as safe
  // when historically elevated or confirmation is incomplete.
  const pctClause = hasPercentile
    ? elevatedHistorically
      ? ` and remains ${pctDesc} at the ${ordinal} percentile`
      : ` at the ${ordinal} percentile (${pctDesc})`
    : "";

  const engineClause =
    bullish > 0
      ? `${capitalize(cardinalWord(bullish))} of ${cardinalWord(total)} intelligence engines are showing improvement or recovery, indicating easing pressure, but not yet confirming a low-risk environment.`
      : stressed > 0
        ? `${capitalize(cardinalWord(stressed))} of ${cardinalWord(total)} intelligence engines are still signaling stress, so confirmation of a low-risk environment is not established.`
        : `Available intelligence engines are not confirming a low-risk environment.`;

  return `Systemic pressure is ${stress} at ${score}/100${pctClause}. ${engineClause}`;
}

/**
 * Pulse / why-this-regime explanatory paragraph from actual evidence state.
 */
export function buildWhyThisRegimeCopy(input: NowInterpretationInput): string {
  const score = Math.round(input.pressureScore);
  const regime = formatDisplayRegime(input.regimeLabel);
  const available = availableEvidenceFamilies(input.evidenceFamilies);
  const incomplete = confirmationIncomplete(input);
  const laborUnavailable = isLaborRatesUnavailable(input);

  // Cite only available families as current drivers.
  const topAvailable = [...available]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map(f => f.name);

  // No verified current drivers: never invent drivers; prior snapshot needs a timestamp.
  if (topAvailable.length === 0) {
    const prior = input.priorSnapshotAt
      ? ` Prior verified drivers from the snapshot at ${input.priorSnapshotAt} are retained for context only and are not treated as current drivers.`
      : "";
    const laborNote = laborUnavailable ? ` ${laborRatesUnavailableMessage()}` : "";
    return (
      `The current Pressure Index is ${score}/100, classified as ${regime}. ` +
      `No verified evidence family is currently available to attribute as a driver of this classification.${prior}${laborNote}`
    );
  }

  // Preferred incomplete-confirmation wording when key surfaces are missing /
  // uncalibrated and absolute pressure is not already in a high-stress band.
  if (incomplete && score < 65) {
    const base =
      `The current Pressure Index is ${score}/100, classified as ${regime}. ` +
      `Available evidence does not currently indicate high systemic stress, but key volatility, liquidity, and scenario-confidence inputs are unavailable or uncalibrated. ` +
      `The appropriate interpretation is ${stressLevelWord(score)} risk with incomplete confirmation.`;
    return laborUnavailable ? `${base} ${laborRatesUnavailableMessage()}` : base;
  }

  // High / critical: defensive language without implying unavailable drivers.
  if (score >= 65 || /critical|high/i.test(regime)) {
    return (
      `The ${regime} regime classification is supported by verified evidence from ${topAvailable.join(", ")}. ` +
      `These factors indicate the market environment is not conducive to risk-taking — defensive positioning is historically appropriate.`
    );
  }

  if (score >= 45 || /elevated/i.test(regime) || isHistoricallyElevatedPercentile(input.historicalPercentile)) {
    return (
      `The ${regime} regime classification is supported by verified evidence from ${topAvailable.join(", ")}. ` +
      `These factors require elevated caution — selective exposure with tight risk management. ` +
      `Improvement in individual engines does not by itself establish a low-risk environment.`
    );
  }

  // Only when absolute pressure is low, percentile is not elevated, and
  // confirmation is complete may we describe a verified supportive backdrop.
  // Still avoid "broadly supportive of measured risk-taking" unless evidence
  // clearly supports it (bullish/recovering majority).
  const bullish = improvingOrRecoveringCount(available);
  const supportive = bullish >= Math.ceil(available.length / 2);
  if (supportive) {
    return (
      `The ${regime} regime classification is supported by verified evidence from ${topAvailable.join(", ")}. ` +
      `Verified available evidence is consistent with contained systemic stress; confirmation remains contingent on those inputs staying current.`
    );
  }

  return (
    `The current Pressure Index is ${score}/100, classified as ${regime}. ` +
    `Verified evidence from ${topAvailable.join(", ")} does not currently indicate high systemic stress. ` +
    `The appropriate interpretation is ${stressLevelWord(score)} risk with the confirmation strength of the available evidence only.`
  );
}

/** Forbidden phrases that over-claim safety or cite unavailable drivers. */
export const FORBIDDEN_NOW_COPY_PATTERNS: RegExp[] = [
  /constructive risk environment/i,
  /broadly supportive of measured risk-taking/i,
  /signaling strength or recovery,\s*consistent with/i,
  /low-stress environment/i,
];

/**
 * Returns integrity issues for a candidate interpretation string.
 * Does not rewrite — callers decide. Used by tests and optional gates.
 */
export function nowInterpretationIssues(
  text: string,
  input: NowInterpretationInput,
): string[] {
  const issues: string[] = [];
  for (const pattern of FORBIDDEN_NOW_COPY_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(`Forbidden over-claim pattern: ${pattern.source}`);
    }
  }
  // "low-risk" is allowed only in negation ("not yet confirming a low-risk…").
  if (/\blow-risk environment\b/i.test(text) && !/not yet confirming a low-risk|not confirming a low-risk|does not.*low-risk/i.test(text)) {
    issues.push("Claims low-risk environment without negation.");
  }
  if (isLaborRatesUnavailable(input)) {
    const citesLaborAsDriver =
      /driven primarily by[^.]*Labor & Rates/i.test(text) ||
      /supported by verified evidence from[^.]*Labor & Rates/i.test(text);
    if (citesLaborAsDriver && !input.priorSnapshotAt) {
      issues.push("Cites Labor & Rates as a current driver while unavailable (no prior snapshot timestamp).");
    }
  }
  // Hard-coded demo pair James called out must never appear as a fallback.
  if (/\b34\/100\b/.test(text) && Math.round(input.pressureScore) !== 34) {
    issues.push("Hard-coded demo pressure 34/100 does not match live served score.");
  }
  if (/\b83rd\b/.test(text) && input.historicalPercentile !== null && Math.round(input.historicalPercentile) !== 83) {
    issues.push("Hard-coded demo percentile 83rd does not match live served percentile.");
  }
  return issues;
}
