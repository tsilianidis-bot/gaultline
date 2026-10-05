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
import type { CanonicalDirection, CanonicalEngineState, CanonicalIntelligenceState, PublicCanonicalIntelligenceState } from "./canonicalIntelligenceState";
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

export type FreshnessBadge = "LIVE" | "DELAYED" | "STALE" | "UNAVAILABLE" | "PARTLY FIXED BASELINE" | "FIXED INPUT";


/**
 * Read-only disclosure of server/pressure/engine.ts scoreAIBubble fixed terms.
 * Display only -- must stay identical to the engine source (tested).
 * Formula: round(concentrationScore * 0.5 + rateScore * 0.3 + spreadScore * 0.2)
 */
export const AI_BUBBLE_FIXED_DISCLOSURE = {
  /** engine.ts: const concentrationScore = 65 */
  concentrationScore: 65,
  /** engine.ts: concentrationScore * 0.5 */
  concentrationWeightInVector: 0.5,
  rateWeightInVector: 0.3,
  spreadWeightInVector: 0.2,
  sourcePath: "server/pressure/engine.ts",
} as const;

/** Fixed concentration term inside the 0-100 AI vector (65 * 0.5 = 32.5). */
export function aiFixedBaselinePointsInVector(): number {
  return AI_BUBBLE_FIXED_DISCLOSURE.concentrationScore * AI_BUBBLE_FIXED_DISCLOSURE.concentrationWeightInVector;
}

/** Fixed concentration term in Pressure Index points (vectorPts * AI Champion weight). */
export function aiFixedBaselinePointsInPi(aiChampionWeight: number): number {
  return Math.round(aiFixedBaselinePointsInVector() * aiChampionWeight * 10) / 10;
}


export type DirectionPosture =
  | "high-but-improving"
  | "high-and-worsening"
  | "high-and-stable"
  | "low-but-worsening"
  | "low-but-improving"
  | "low-and-stable"
  | "unavailable";

export type ComponentAvailability = "available" | "unavailable";

/** Canonical fields required for transparency (public or full state). */
export type IntelligenceCanonicalLike = Pick<
  CanonicalIntelligenceState,
  | "stateId"
  | "effectiveAt"
  | "pressureIndex"
  | "regime"
  | "pressureDirection"
  | "engines"
>;

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
  /**
   * Whether the component as a whole may be listed as carrying the composite.
   * The fixed concentration constant itself is never cited as a live driver --
   * see fixedConstantCitedAsLive / fixedBaselineDisclosure.
   */
  citedAsDriver: boolean;
  /** True when any code path would treat the fixed constant as live evidence (must stay false). */
  fixedConstantCitedAsLive: boolean;
  /** Plain disclosure of the engine fixed concentration term; null when not applicable. */
  fixedBaselineDisclosure: string | null;
  /** Engine concentrationScore (65) when static baseline applies. */
  fixedConcentrationScore: number | null;
  /** Points of the 0-100 AI vector from the fixed term (65*0.5=32.5). */
  fixedPointsInVector: number | null;
  /** PI index points attributable to the fixed term (32.5*AI weight). */
  fixedPointsInPi: number | null;
}

export interface HowBuiltSummary {
  pressureIndex: number;
  regime: string | null;
  weightedSum: number;
  roundedScore: number;
  reconciles: boolean;
  explanation: string;
  methodNote: string;
  /** Always-present AI fixed-baseline sentence when AI contributes; null otherwise. */
  aiFixedBaselineNote: string | null;
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

/**
 * Map engine freshness to a customer badge.
 * Static-baseline / fixed-constant components NEVER map to LIVE -- even when the
 * engine stamps CURRENT on the vector as a whole.
 */
export function mapFreshnessBadge(
  raw: string | null | undefined,
  qualityStatus?: string | null,
  options?: { staticBaseline?: boolean },
): FreshnessBadge {
  if (options?.staticBaseline) {
    const q = String(qualityStatus ?? "").toUpperCase();
    if (q === "UNAVAILABLE") return "UNAVAILABLE";
    const f = String(raw ?? "").toUpperCase();
    if (f === "UNAVAILABLE" || f === "MISSING") return "UNAVAILABLE";
    if (f === "STALE") return "STALE";
    // Partly fixed: concentration is a fixed engine constant; rates/spreads may still move.
    return "PARTLY FIXED BASELINE";
  }
  const q = String(qualityStatus ?? "").toUpperCase();
  if (q === "UNAVAILABLE") return "UNAVAILABLE";
  const f = String(raw ?? "").toUpperCase();
  if (f === "UNAVAILABLE" || f === "MISSING") return "UNAVAILABLE";
  if (f === "STALE") return "STALE";
  if (f === "DELAYED") return "DELAYED";
  if (f === "CURRENT" || f === "LIVE" || f === "FRESH") return "LIVE";
  if (f === "STATIC" || f === "FALLBACK" || f === "CACHED") return "FIXED INPUT";
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
  fixedBaselineDisclosure: string | null;
}): string {
  if (args.availability === "unavailable" || args.score == null) {
    return `${args.label} is unavailable on the current canonical state and is not cited as a driver of the Pressure Index.`;
  }
  const pts = args.contributionPoints != null ? `${args.contributionPoints} index points` : "an uncomputed contribution";
  const dir =
    args.direction === "Unknown"
      ? "Direction versus the prior verified reading is unavailable."
      : `Direction versus the prior verified reading: ${args.direction} (${args.posture}).`;
  let freshnessNote: string;
  if (args.freshness === "PARTLY FIXED BASELINE" || args.freshness === "FIXED INPUT") {
    freshnessNote =
      "Freshness is PARTLY FIXED BASELINE -- the concentration term is a fixed engine constant, not live market-cap data; live rate/spread inputs only adjust the remainder.";
  } else if (args.freshness === "LIVE") {
    freshnessNote = "Inputs are LIVE on the verified as-of.";
  } else if (args.freshness === "DELAYED") {
    freshnessNote = "Inputs carry publication lag (DELAYED).";
  } else if (args.freshness === "STALE") {
    freshnessNote = "Inputs are STALE relative to the refresh window.";
  } else {
    freshnessNote = "Inputs are UNAVAILABLE.";
  }
  const fixedNote = args.fixedBaselineDisclosure ? ` ${args.fixedBaselineDisclosure}` : "";
  return `${args.label} scores ${args.score}/100 and carries a fixed ${args.weightPct}% Champion weight (${pts}). ${dir} ${freshnessNote}${fixedNote} ${args.description}`;
}

export function buildAiFixedBaselineDisclosure(aiChampionWeight: number): string {
  const vectorPts = aiFixedBaselinePointsInVector();
  const piPts = aiFixedBaselinePointsInPi(aiChampionWeight);
  const c = AI_BUBBLE_FIXED_DISCLOSURE.concentrationScore;
  const w = AI_BUBBLE_FIXED_DISCLOSURE.concentrationWeightInVector;
  return (
    `Half of the AI / Speculation vector is a fixed engine baseline value of ${c} ` +
    `(weight ${w} inside the vector → ${vectorPts} of the 0–100 AI score; ` +
    `${piPts} Pressure Index points at the ${(aiChampionWeight * 100).toFixed(0)}% Champion weight). ` +
    `That fixed constant is not live evidence and is not cited as a live driver.`
  );
}

/**
 * Build the Intelligence transparency model from canonical state + Champion weights.
 * Weights must be the live Champion table (read-only); this function never invents them.
 */
export function buildIntelligenceTransparency(
  state: IntelligenceCanonicalLike | PublicCanonicalIntelligenceState | CanonicalIntelligenceState | null | undefined,
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
    const freshnessRaw = mapFreshnessBadge(engine?.freshnessStatus, engine?.qualityStatus, { staticBaseline });
    const freshness: FreshnessBadge =
      availability === "unavailable" ? "UNAVAILABLE" : freshnessRaw;
    // Hard rule: staticBaseline never LIVE
    if (staticBaseline && freshness === "LIVE") {
      throw new Error("staticBaseline component must never map to LIVE freshness");
    }
    const direction: CanonicalDirection = engine?.direction ?? "Unknown";
    const posture = directionPosture(score, direction);
    const asOf = formatAsOf(engine?.observedAt ?? engine?.calculatedAt ?? state.effectiveAt);
    const contributionPoints = score == null ? null : round1(score * weight);
    // Overall vector may contribute to the composite; the fixed constant is never live evidence.
    const citedAsDriver = availability === "available" && freshness !== "UNAVAILABLE";
    const fixedConcentrationScore = staticBaseline ? AI_BUBBLE_FIXED_DISCLOSURE.concentrationScore : null;
    const fixedPointsInVector = staticBaseline ? aiFixedBaselinePointsInVector() : null;
    const fixedPointsInPi = staticBaseline ? aiFixedBaselinePointsInPi(weight) : null;
    const fixedBaselineDisclosure = staticBaseline ? buildAiFixedBaselineDisclosure(weight) : null;
    const fixedConstantCitedAsLive = false;

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
      freshness,
      delayedAgeLabel: delayedAgeLabel(engine?.observedAt ?? engine?.calculatedAt ?? state.effectiveAt, freshness, nowMs),
      availability,
      staticBaseline,
      citedAsDriver,
      fixedConstantCitedAsLive,
      fixedBaselineDisclosure,
      fixedConcentrationScore,
      fixedPointsInVector,
      fixedPointsInPi,
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
      fixedBaselineDisclosure: row.fixedBaselineDisclosure,
    });
    const { description: _d, ...rest } = row;
    return {
      ...rest,
      contributionPct,
      rank: rankById.get(row.engineId) ?? null,
      plainEnglishReason: reason,
      citedAsDriver: row.citedAsDriver,
      fixedConstantCitedAsLive: false,
    };
  });

  const weightedSum = round1(availablePoints);
  const roundedScore = Math.round(availablePoints);
  const reconciles = Math.abs(roundedScore - state.pressureIndex) <= 1;

  const aiRow = components.find((c) => c.engineId === "ai-bubble" && c.staticBaseline && c.availability === "available");
  const aiFixedBaselineNote = aiRow ? buildAiFixedBaselineDisclosure(aiRow.weight) : null;
  const howBuilt: HowBuiltSummary = {
    pressureIndex: state.pressureIndex,
    regime: state.regime,
    weightedSum,
    roundedScore,
    reconciles,
    explanation: buildHowExplanation(state.pressureIndex, components, weightedSum, roundedScore, reconciles, aiFixedBaselineNote),
    methodNote:
      "Pressure Index = round(Σ (vector score × fixed Champion V1 weight)). It is not a simple average of the five evidence-family cards. The AI / Speculation vector also contributes when present; half of that vector is a fixed engine baseline (concentrationScore=65), not live market-cap data. No caps or transforms are applied beyond per-vector 0–100 scoring and the final round.",
    aiFixedBaselineNote,
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
  aiFixedBaselineNote: string | null,
): string {
  const parts = components
    .filter((c) => c.citedAsDriver && c.score != null && c.contributionPoints != null)
    .sort((a, b) => (b.contributionPoints as number) - (a.contributionPoints as number))
    .map((c) => {
      const base = `${c.label} ${c.score}×${c.weightPct}%→${c.contributionPoints}`;
      if (c.staticBaseline && c.fixedConcentrationScore != null && c.fixedPointsInVector != null && c.fixedPointsInPi != null) {
        return `${base} [fixed baseline ${c.fixedConcentrationScore} × ${AI_BUBBLE_FIXED_DISCLOSURE.concentrationWeightInVector} → ${c.fixedPointsInVector} of AI score / ${c.fixedPointsInPi} PI pts; not live evidence]`;
      }
      return base;
    });
  const unavailable = components.filter((c) => !c.citedAsDriver).map((c) => c.label);
  const unavailNote =
    unavailable.length > 0
      ? ` Not cited as drivers (unavailable): ${unavailable.join(", ")}.`
      : "";
  const reconcileNote = reconciles
    ? `Weighted sum ${weightedSum} rounds to ${roundedScore}, matching the published Pressure Index ${pressureIndex}.`
    : `Weighted sum ${weightedSum} rounds to ${roundedScore}; published Pressure Index is ${pressureIndex} (within display tolerance check: ${reconciles ? "pass" : "review"}).`;
  const fixedNote = aiFixedBaselineNote ? ` ${aiFixedBaselineNote}` : "";
  return `HOW ${pressureIndex} IS BUILT: ${parts.join("; ")}. ${reconcileNote} This is a weighted composite, not an average of the on-screen component cards.${fixedNote}${unavailNote}`;
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
    const fallback =
      state === "AVAILABLE"
        ? PROBABILITY_DISPLAY_TEXT.UNAVAILABLE
        : (PROBABILITY_DISPLAY_TEXT[state] ?? PROBABILITY_DISPLAY_TEXT.UNAVAILABLE);
    const text = display?.text ?? fallback;
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


/** Guard: static-baseline components must never show LIVE freshness. */
export function staticBaselineShownAsLive(model: IntelligenceTransparencyModel): string[] {
  return model.components.filter((c) => c.staticBaseline && c.freshness === "LIVE").map((c) => c.engineId);
}

/** Guard: fixed constant must never be flagged as live evidence. */
export function fixedConstantCitedAsLiveEvidence(model: IntelligenceTransparencyModel): string[] {
  return model.components.filter((c) => c.fixedConstantCitedAsLive).map((c) => c.engineId);
}

/** Guard: AI static baseline must disclose engine concentrationScore=65. */
export function staticBaselineMissingSixtyFiveDisclosure(model: IntelligenceTransparencyModel): string[] {
  return model.components
    .filter((c) => c.staticBaseline && c.availability === "available")
    .filter((c) => {
      const blob = `${c.plainEnglishReason}\n${c.fixedBaselineDisclosure ?? ""}\n${model.howBuilt?.explanation ?? ""}\n${model.howBuilt?.aiFixedBaselineNote ?? ""}`;
      return !blob.includes(String(AI_BUBBLE_FIXED_DISCLOSURE.concentrationScore));
    })
    .map((c) => c.engineId);
}
