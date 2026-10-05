/**
 * Intelligence-view transparency — interpretation / display only.
 *
 * Explains how the published Pressure Index is built from Champion V1 vector
 * weights × live canonical engine scores. Does NOT change engine scores,
 * weights, methodology, thresholds, or data sources.
 *
 * Evidence contract:
 *   - Unavailable ≠ driver (never cited as carrying the reading)
 *   - Stale labeled; Delayed shows age when as-of is known
 *   - Every sentence is templated from verified canonical fields
 *   - Uncalibrated / Not offered are demoted visually (not implied probabilities)
 */
import {
  AI_CONCENTRATION_STATIC_BASELINE_INPUT_ID,
  PRESSURE_VECTOR_DISPLAY,
  pressureVectorLabel,
} from "./pressureVectorLabels";
import type { CanonicalDirection, CanonicalEngineState, CanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { PROBABILITY_DISPLAY_TEXT, type ProbabilityDisplay } from "./probabilityContract";

/** Champion V1 weight keys ↔ engine ids (mirrors server/pressure/championBaseline). */
export const INTELLIGENCE_VECTOR_IDS = [
  "liquidity-stress",
  "credit-contagion",
  "volatility-regime",
  "macro-sensitivity",
  "market-breadth",
  "ai-bubble",
] as const;

export type IntelligenceVectorId = (typeof INTELLIGENCE_VECTOR_IDS)[number];

/**
 * Evidence-family display names used on Intelligence / NOW surfaces.
 * AI has no evidence-family alias; it still contributes to the composite.
 */
export const INTELLIGENCE_DISPLAY_ALIAS: Readonly<Record<IntelligenceVectorId, string>> = {
  "liquidity-stress": "Liquidity Conditions",
  "credit-contagion": "Credit Markets",
  "volatility-regime": "Yield Curve (10Y–2Y) & 10Y Level",
  "macro-sensitivity": "Macro Sensitivity",
  "market-breadth": "Labor & Rates (Unemployment, 10Y)",
  "ai-bubble": "AI / Speculation (Static Baseline)",
};

/** Human labels for primary underlying indicators (verified input catalog). */
export const INPUT_INDICATOR_LABELS: Readonly<Record<string, string>> = {
  hy_credit_spread: "ICE BofA US HY OAS (BAMLH0A0HYM2)",
  secured_overnight_financing_rate: "SOFR",
  ten_year_treasury_yield: "10Y Treasury (DGS10)",
  two_year_treasury_yield: "2Y Treasury (DGS2)",
  consumer_price_index_yoy: "CPI YoY (CPIAUCSL)",
  producer_price_index_yoy: "PPI YoY (PPIACO)",
  federal_funds_rate: "Effective Federal Funds Rate (FEDFUNDS)",
  unemployment_rate: "Unemployment Rate (UNRATE)",
  [AI_CONCENTRATION_STATIC_BASELINE_INPUT_ID]: "AI mega-cap concentration static baseline (~32.4% of S&P 500)",
};

export type FreshnessBadge = "LIVE" | "DELAYED" | "STALE" | "UNAVAILABLE";

export type DirectionPosture =
  | "high-but-improving"
  | "high-and-worsening"
  | "high-and-stable"
  | "low-but-worsening"
  | "low-but-improving"
  | "low-and-stable"
  | "unavailable";

export type ComponentAvailability = "available" | "unavailable";

export interface TransparencyWeightTable {
  "liquidity-stress": number;
  "credit-contagion": number;
  "volatility-regime": number;
  "macro-sensitivity": number;
  "market-breadth": number;
  "ai-bubble": number;
}

export interface ComponentTransparency {
  engineId: IntelligenceVectorId;
  label: string;
  canonicalLabel: string;
  score: number | null;
  weight: number;
  weightPct: number;
  /** score × weight in index points; null when unavailable. */
  contributionPoints: number | null;
  /** Share of the summed available contribution; null when unavailable. */
  contributionPct: number | null;
  rank: number | null;
  direction: CanonicalDirection;
  posture: DirectionPosture;
  plainEnglishReason: string;
  primaryIndicators: string[];
  asOf: string | null;
  freshness: FreshnessBadge;
  delayedAgeLabel: string | null;
  availability: ComponentAvailability;
  staticBaseline: boolean;
  citedAsDriver: boolean;
}

export interface HowBuiltSummary {
  pressureIndex: number;
  regime: string | null;
  weightedSum: number;
  roundedScore: number;
  reconciles: boolean;
  explanation: string;
  methodNote: string;
}

export interface DemotedProbabilityView {
  key: "bullProbability" | "crashProbability";
  label: string;
  text: string;
  state: ProbabilityDisplay["state"];
  demoted: true;
  /** Never treat as a numeric probability in UI. */
  impliedProbability: null;
}

export interface IntelligenceTransparencyModel {
  status: "ready" | "unavailable";
  unavailableReason: string | null;
  stateId: string | null;
  asOf: string | null;
  pressureIndex: number | null;
  regime: string | null;
  pressureDirection: CanonicalDirection;
  howBuilt: HowBuiltSummary | null;
  components: ComponentTransparency[];
  demotedProbabilities: DemotedProbabilityView[];
}

const HIGH_SCORE_THRESHOLD = 45; // Champion Elevated band floor (server/pressure/championBaseline)

export function championWeightsFromBaseline(weights: {
  liquidityStress: number;
  creditContagion: number;
  volatilityRegime: number;
  macroSensitivity: number;
  marketBreadth: number;
  aiBubble: number;
}): TransparencyWeightTable {
  return {
    "liquidity-stress": weights.liquidityStress,
    "credit-contagion": weights.creditContagion,
    "volatility-regime": weights.volatilityRegime,
    "macro-sensitivity": weights.macroSensitivity,
    "market-breadth": weights.marketBreadth,
    "ai-bubble": weights.aiBubble,
  };
}

export function mapFreshnessBadge(raw: string | null | undefined, qualityStatus?: string | null): FreshnessBadge {
  const q = String(qualityStatus ?? "").toUpperCase();
  if (q === "UNAVAILABLE") return "UNAVAILABLE";
  const f = String(raw ?? "").toUpperCase();
  if (f === "UNAVAILABLE" || f === "MISSING") return "UNAVAILABLE";
  if (f === "STALE") return "STALE";
  if (f === "DELAYED") return "DELAYED";
  if (f === "CURRENT" || f === "LIVE" || f === "FRESH") return "LIVE";
  if (f === "STATIC" || f === "FALLBACK" || f === "CACHED") return "DELAYED";
  return "UNAVAILABLE";
}

export function directionPosture(score: number | null, direction: CanonicalDirection): DirectionPosture {
  if (score == null || !Number.isFinite(score) || direction === "Unknown") return "unavailable";
  const high = score >= HIGH_SCORE_THRESHOLD;
  if (high && direction === "Improving") return "high-but-improving";
  if (high && direction === "Deteriorating") return "high-and-worsening";
  if (high && direction === "Stable") return "high-and-stable";
  if (!high && direction === "Deteriorating") return "low-but-worsening";
  if (!high && direction === "Improving") return "low-but-improving";
  return "low-and-stable";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatAsOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function delayedAgeLabel(asOf: string | null, freshness: FreshnessBadge, nowMs = Date.now()): string | null {
  if (freshness !== "DELAYED" && freshness !== "STALE") return null;
  if (!asOf) return freshness === "DELAYED" ? "publication lag (as-of unavailable)" : "stale (as-of unavailable)";
  const t = Date.parse(asOf);
  if (!Number.isFinite(t)) return null;
  const hours = Math.max(0, Math.round((nowMs - t) / 3_600_000));
  if (hours < 48) return `${hours}h since verified as-of`;
  const days = Math.round(hours / 24);
  return `${days}d since verified as-of`;
}

function indicatorLabels(ids: readonly string[]): string[] {
  return ids.map((id) => INPUT_INDICATOR_LABELS[id] ?? id);
}

function plainEnglishReason(args: {
  label: string;
  score: number | null;
  weightPct: number;
  contributionPoints: number | null;
  direction: CanonicalDirection;
  posture: DirectionPosture;
  freshness: FreshnessBadge;
  staticBaseline: boolean;
  availability: ComponentAvailability;
  description: string;
}): string {
  if (args.availability === "unavailable" || args.score == null) {
    return `${args.label} is unavailable on the current canonical state and is not cited as a driver of the Pressure Index.`;
  }
  const pts = args.contributionPoints != null ? `${args.contributionPoints} index points` : "an uncomputed contribution";
  const dir =
    args.direction === "Unknown"
      ? "Direction versus the prior verified reading is unavailable."
      : `Direction versus the prior verified reading: ${args.direction} (${args.posture}).`;
  const freshnessNote =
    args.freshness === "LIVE"
      ? "Inputs are LIVE on the verified as-of."
      : args.freshness === "DELAYED"
        ? "Inputs carry publication lag (DELAYED)."
        : args.freshness === "STALE"
          ? "Inputs are STALE relative to the refresh window."
          : "Inputs are UNAVAILABLE.";
  const staticNote = args.staticBaseline
    ? " The AI concentration baseline is a disclosed static reference, not a live market-cap feed."
    : "";
  return `${args.label} scores ${args.score}/100 and carries a fixed ${args.weightPct}% Champion weight (${pts}). ${dir} ${freshnessNote}${staticNote} ${args.description}`;
}

/**
 * Build the Intelligence transparency model from canonical state + Champion weights.
 * Weights must be the live Champion table (read-only); this function never invents them.
 */
export function buildIntelligenceTransparency(
  state: CanonicalIntelligenceState | null | undefined,
  weights: TransparencyWeightTable,
  options?: { nowMs?: number; bullDisplay?: ProbabilityDisplay | null; crashDisplay?: ProbabilityDisplay | null },
): IntelligenceTransparencyModel {
  const demotedProbabilities = demoteProbabilityPair(options?.bullDisplay ?? null, options?.crashDisplay ?? null);

  if (!state || state.pressureIndex == null || !Number.isFinite(state.pressureIndex)) {
    return {
      status: "unavailable",
      unavailableReason: "No canonical Pressure Index is published right now.",
      stateId: state?.stateId ?? null,
      asOf: state?.effectiveAt ?? null,
      pressureIndex: null,
      regime: state?.regime ?? null,
      pressureDirection: state?.pressureDirection ?? "Unknown",
      howBuilt: null,
      components: [],
      demotedProbabilities,
    };
  }

  const engineById = new Map((state.engines ?? []).map((e) => [e.engineId, e]));
  const nowMs = options?.nowMs ?? Date.now();

  const raw = INTELLIGENCE_VECTOR_IDS.map((engineId) => {
    const engine = engineById.get(engineId) as CanonicalEngineState | undefined;
    const weight = weights[engineId];
    const weightPct = Math.round(weight * 100);
    const canonicalLabel = pressureVectorLabel(engineId);
    const label = INTELLIGENCE_DISPLAY_ALIAS[engineId];
    const description = PRESSURE_VECTOR_DISPLAY[engineId]?.description ?? "";
    const staticBaseline =
      !!engine?.sourceInputIds?.includes(AI_CONCENTRATION_STATIC_BASELINE_INPUT_ID) || engineId === "ai-bubble";

    const qualityUnavailable = engine?.qualityStatus === "UNAVAILABLE" || engine == null;
    const score =
      !qualityUnavailable && typeof engine?.value === "number" && Number.isFinite(engine.value) && engine.contributionToComposite
        ? engine.value
        : null;
    const availability: ComponentAvailability = score == null ? "unavailable" : "available";
    const freshness = mapFreshnessBadge(engine?.freshnessStatus, engine?.qualityStatus);
    const direction: CanonicalDirection = engine?.direction ?? "Unknown";
    const posture = directionPosture(score, direction);
    const asOf = formatAsOf(engine?.observedAt ?? engine?.calculatedAt ?? state.effectiveAt);
    const contributionPoints = score == null ? null : round1(score * weight);
    const citedAsDriver = availability === "available" && freshness !== "UNAVAILABLE";

    return {
      engineId,
      label,
      canonicalLabel,
      score,
      weight,
      weightPct,
      contributionPoints,
      contributionPct: null as number | null,
      rank: null as number | null,
      direction,
      posture,
      plainEnglishReason: "",
      primaryIndicators: indicatorLabels(engine?.sourceInputIds ?? []),
      asOf,
      freshness: availability === "unavailable" ? ("UNAVAILABLE" as FreshnessBadge) : freshness,
      delayedAgeLabel: delayedAgeLabel(engine?.observedAt ?? engine?.calculatedAt ?? state.effectiveAt, freshness, nowMs),
      availability,
      staticBaseline,
      citedAsDriver,
      description,
    };
  });

  const availablePoints = raw.reduce((sum, row) => sum + (row.contributionPoints ?? 0), 0);
  const ranked = [...raw]
    .filter((row) => row.citedAsDriver && row.contributionPoints != null)
    .sort((a, b) => (b.contributionPoints as number) - (a.contributionPoints as number));
  const rankById = new Map(ranked.map((row, i) => [row.engineId, i + 1]));

  const components: ComponentTransparency[] = raw.map((row) => {
    const contributionPct =
      row.contributionPoints != null && availablePoints > 0
        ? Math.round((row.contributionPoints / availablePoints) * 100)
        : null;
    const reason = plainEnglishReason({
      label: row.label,
      score: row.score,
      weightPct: row.weightPct,
      contributionPoints: row.contributionPoints,
      direction: row.direction,
      posture: row.posture,
      freshness: row.freshness,
      staticBaseline: row.staticBaseline,
      availability: row.availability,
      description: row.description,
    });
    const { description: _d, ...rest } = row;
    return {
      ...rest,
      contributionPct,
      rank: rankById.get(row.engineId) ?? null,
      plainEnglishReason: reason,
      citedAsDriver: row.citedAsDriver,
    };
  });

  const weightedSum = round1(availablePoints);
  const roundedScore = Math.round(availablePoints);
  const reconciles = Math.abs(roundedScore - state.pressureIndex) <= 1;

  const howBuilt: HowBuiltSummary = {
    pressureIndex: state.pressureIndex,
    regime: state.regime,
    weightedSum,
    roundedScore,
    reconciles,
    explanation: buildHowExplanation(state.pressureIndex, components, weightedSum, roundedScore, reconciles),
    methodNote:
      "Pressure Index = round(Σ (vector score × fixed Champion V1 weight)). It is not a simple average of the five evidence-family cards. The AI / Speculation vector also contributes when present. No caps or transforms are applied beyond per-vector 0–100 scoring and the final round.",
  };

  return {
    status: "ready",
    unavailableReason: null,
    stateId: state.stateId,
    asOf: formatAsOf(state.effectiveAt),
    pressureIndex: state.pressureIndex,
    regime: state.regime,
    pressureDirection: state.pressureDirection,
    howBuilt,
    components,
    demotedProbabilities,
  };
}

function buildHowExplanation(
  pressureIndex: number,
  components: ComponentTransparency[],
  weightedSum: number,
  roundedScore: number,
  reconciles: boolean,
): string {
  const parts = components
    .filter((c) => c.citedAsDriver && c.score != null && c.contributionPoints != null)
    .sort((a, b) => (b.contributionPoints as number) - (a.contributionPoints as number))
    .map((c) => `${c.label} ${c.score}×${c.weightPct}%→${c.contributionPoints}`);
  const unavailable = components.filter((c) => !c.citedAsDriver).map((c) => c.label);
  const unavailNote =
    unavailable.length > 0
      ? ` Not cited as drivers (unavailable): ${unavailable.join(", ")}.`
      : "";
  const reconcileNote = reconciles
    ? `Weighted sum ${weightedSum} rounds to ${roundedScore}, matching the published Pressure Index ${pressureIndex}.`
    : `Weighted sum ${weightedSum} rounds to ${roundedScore}; published Pressure Index is ${pressureIndex} (within display tolerance check: ${reconciles ? "pass" : "review"}).`;
  return `HOW ${pressureIndex} IS BUILT: ${parts.join("; ")}. ${reconcileNote} This is a weighted composite, not an average of the on-screen component cards.${unavailNote}`;
}

/** Demote Bull Uncalibrated / Crash Not offered — never convert to implied probabilities. */
export function demoteProbabilityPair(
  bull: ProbabilityDisplay | null,
  crash: ProbabilityDisplay | null,
): DemotedProbabilityView[] {
  const asDemoted = (
    key: "bullProbability" | "crashProbability",
    label: string,
    display: ProbabilityDisplay | null,
  ): DemotedProbabilityView => {
    const state = display?.state ?? "UNAVAILABLE";
    const text = display?.text ?? PROBABILITY_DISPLAY_TEXT[state] ?? PROBABILITY_DISPLAY_TEXT.UNAVAILABLE;
    return { key, label, text, state, demoted: true, impliedProbability: null };
  };
  return [
    asDemoted("bullProbability", "Bull scenario", bull),
    asDemoted("crashProbability", "Crash probability", crash),
  ];
}

/** Guard: unavailable components must never be flagged as drivers. */
export function unavailableCitedAsDriver(model: IntelligenceTransparencyModel): string[] {
  return model.components
    .filter((c) => c.availability === "unavailable" || c.freshness === "UNAVAILABLE")
    .filter((c) => c.citedAsDriver)
    .map((c) => c.engineId);
}

/** Guard: HOW-built copy must not treat unavailable labels as weighted contributors. */
export function unavailableNamedAsContributor(model: IntelligenceTransparencyModel): string[] {
  const explanation = model.howBuilt?.explanation ?? "";
  return model.components
    .filter((c) => c.availability === "unavailable" || c.freshness === "UNAVAILABLE")
    .filter((c) => new RegExp(`${c.label}\\s+\\d+`).test(explanation))
    .map((c) => c.engineId);
}

/** Issues if demoted probability views look like numeric probabilities. */
export function demotionIssues(model: IntelligenceTransparencyModel): string[] {
  const issues: string[] = [];
  for (const p of model.demotedProbabilities) {
    if (p.impliedProbability != null) issues.push(`${p.key}: impliedProbability must be null`);
    if (!p.demoted) issues.push(`${p.key}: must be demoted`);
    if (p.state === "AVAILABLE" && typeof p.text === "string" && /\d+\s*%/.test(p.text)) {
      // Available calibrated % is allowed only when state says AVAILABLE; still demoted visually by UI.
    }
    if ((p.state === "UNCALIBRATED" || p.state === "NOT_OFFERED") && /\b\d{1,3}\s*%/.test(p.text)) {
      issues.push(`${p.key}: uncalibrated/not-offered text must not show a percent`);
    }
  }
  return issues;
}

/** Contribution math check against a weight table (engine-identical). */
export function contributionMathMatchesWeights(
  components: ComponentTransparency[],
  weights: TransparencyWeightTable,
  tolerance = 0.05,
): boolean {
  for (const c of components) {
    const expected = weights[c.engineId];
    if (Math.abs(expected - c.weight) > tolerance) return false;
    if (c.score != null && c.contributionPoints != null) {
      const pts = round1(c.score * c.weight);
      if (Math.abs(pts - c.contributionPoints) > tolerance) return false;
    }
  }
  return true;
}
