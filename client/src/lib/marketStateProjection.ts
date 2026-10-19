import { pressureBand, pressureBandColor, pressureRiskLevel, regimeToRiskLevel } from "@shared/pressureBands";
import type { CanonicalMarketState } from "@shared/marketState";
import { normalizeCanonicalMetric } from "@shared/marketMetrics";
import {
  computeEngine,
  type DomainScore,
  type EngineOutput,
  type ProbabilityOutput,
  type ProbabilityOutputDisplay,
  type ProbabilityOutputKey,
  type RawIndicators,
  type RegimeOutput,
} from "@/lib/engine";
import {
  PROBABILITY_DISPLAY_TEXT,
  type CanonicalProbabilityContract,
  type ProbabilityDisplay,
} from "@shared/probabilityContract";

const WITHHELD = (state: Exclude<ProbabilityDisplay["state"], "AVAILABLE">): ProbabilityDisplay => ({
  state,
  text: PROBABILITY_DISPLAY_TEXT[state],
  percent: null,
});

/** Crash, recession, soft landing and stagflation are not offered in any mode. */
const NOT_OFFERED_KEYS: ProbabilityOutputKey[] = [
  "crashProbability",
  "softLandingProbability",
  "stagflationProbability",
  "recessionProbability",
];

function displayFor(
  mode: BrowserMarketMode,
  contract: CanonicalProbabilityContract | null | undefined,
): ProbabilityOutputDisplay {
  const notOffered = Object.fromEntries(NOT_OFFERED_KEYS.map(key => [key, WITHHELD("NOT_OFFERED")])) as Record<string, ProbabilityDisplay>;
  let bull: ProbabilityDisplay;
  if (mode === "canonical") {
    // The "bull" field on canonical surfaces is the canonical bull scenario claim.
    bull = contract?.scenarioSet.scenarios.find(c => c.scenario.scenarioId === "bull")?.display ?? WITHHELD("UNAVAILABLE");
  } else if (mode === "simulation") {
    // What-if heuristic from the browser engine: never calibrated.
    bull = WITHHELD("UNCALIBRATED");
  } else {
    // Demo DEFAULT_INDICATORS baseline: no market data behind it.
    bull = WITHHELD("UNAVAILABLE");
  }
  return { ...notOffered, bullProbability: bull } as ProbabilityOutputDisplay;
}

/** NaN for every field the display withholds; the displayed integer otherwise. */
function gateProbabilities(display: ProbabilityOutputDisplay): ProbabilityOutput {
  const out = {} as ProbabilityOutput;
  (Object.keys(display) as ProbabilityOutputKey[]).forEach(key => {
    const percent = display[key].state === "AVAILABLE" ? display[key].percent : null;
    out[key] = percent === null ? Number.NaN : percent;
  });
  return out;
}

/** The only sanctioned text for an EngineOutput probability field. */
export function engineProbabilityText(output: Pick<EngineOutput, "probabilityDisplay">, key: ProbabilityOutputKey): string {
  return output.probabilityDisplay?.[key]?.text ?? PROBABILITY_DISPLAY_TEXT.UNAVAILABLE;
}

/** Bar/width percent for an EngineOutput probability field, or null when withheld. */
export function engineProbabilityPercent(output: Pick<EngineOutput, "probabilityDisplay">, key: ProbabilityOutputKey): number | null {
  const display = output.probabilityDisplay?.[key];
  return display?.state === "AVAILABLE" ? display.percent : null;
}

function withProbabilityContract(
  output: EngineOutput,
  mode: BrowserMarketMode,
  contract: CanonicalProbabilityContract | null | undefined,
): EngineOutput {
  const probabilityDisplay = displayFor(mode, contract);
  return { ...output, probability: gateProbabilities(probabilityDisplay), probabilityDisplay };
}

export type BrowserMarketMode = "canonical" | "simulation" | "deterministic-fallback";

function riskLevel(score: number): DomainScore["riskLevel"] {
  // Engine domain scores are 0–10; map via canonical 0–100 bands.
  return pressureRiskLevel(score * 10);
}

function regimeCode(score: number): RegimeOutput["code"] {
  // `score` is 0–100 canonical pressure (call sites pass canonicalScore).
  switch (pressureBand(score).id) {
    case "crisis": return "CRITICAL_SYSTEMIC";
    case "high": return "LATE_CYCLE_FRAGILITY";
    case "elevated": return "ELEVATED_STRESS";
    case "moderate": return "MODERATE_RISK";
    default: return "LOW_RISK";
  }
}

function regimeColor(score: number): string {
  return pressureBandColor(score);
}

export function projectCanonicalMarketState(
  state: CanonicalMarketState,
  deterministicFallback: EngineOutput,
): EngineOutput {
  const canonicalScore = normalizeCanonicalMetric(state.now.pressureScore);
  const score10 = canonicalScore / 10;
  const domains: DomainScore[] = state.why.evidenceFamilies.map((family, index) => {
    const domainScore = normalizeCanonicalMetric(family.strength) / 10;
    return {
      id: `canonical-${index}-${family.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: family.name,
      score: domainScore,
      // No prior comparable family reading: delta unknown (renders "—").
      delta: 0,
      deltaAvailable: false,
      riskLevel: riskLevel(domainScore),
      description: family.whyItMatters,
      drivers: [family.currentValue, family.historicalContext].filter(Boolean),
      dataStatus: state.cache.status === "stale-if-error" ? "fallback" : "live",
      fallbackReason: state.cache.staleReason ?? undefined,
      source: "canonical-market-state",
    };
  });

  const analogs = state.outlook.topAnalog
    ? [{
        id: `canonical-${state.outlook.topAnalog.period}`,
        era: state.outlook.topAnalog.label,
        year: state.outlook.topAnalog.period,
        similarity: normalizeCanonicalMetric(state.outlook.topAnalog.similarity),
        matchReasons: [state.outlook.topAnalog.resolution],
      }]
    : [];

  return {
    ...deterministicFallback,
    // Never inherit values computed from the DEFAULT_INDICATORS demo baseline:
    // the canonical state has no ticker values or 0–100 alert gauges.
    tickerValues: [],
    alertPressure: { treasury: null, credit: null, aiRisk: null, liquidity: null },
    overall: {
      id: "canonical-market-pressure",
      label: "Market Pressure",
      score: score10,
      // No prior comparable composite in the projection: delta unknown ("—");
      // the composite direction comes from the canonical state itself.
      delta: 0,
      deltaAvailable: false,
      direction: state.now.direction,
      riskLevel: riskLevel(score10),
      description: state.now.headline,
      drivers: state.now.topDrivers,
      dataStatus: state.cache.status === "stale-if-error" ? "fallback" : "live",
      fallbackReason: state.cache.staleReason ?? undefined,
      source: "canonical-market-state",
    },
    // No canonical evidence families: no domains (never the demo-baseline domains).
    domains,
    regime: {
      label: state.now.regime,
      sublabel: `${state.now.stressLevel} · ${state.now.direction}`,
      color: regimeColor(canonicalScore),
      code: regimeCode(canonicalScore),
      description: state.why.whyThisRegime,
    },
    // Withheld here; withProbabilityContract sets the contract-gated values.
    probability: {
      bullProbability: Number.NaN,
      crashProbability: Number.NaN,
      softLandingProbability: Number.NaN,
      stagflationProbability: Number.NaN,
      recessionProbability: Number.NaN,
    },
    analogs,
    narrative: {
      regimeAssessment: state.why.whyThisRegime,
      summary: state.why.story,
      keyRisks: state.watch.whatToWatch,
    },
  };
}

export function selectBrowserMarketOutput(input: {
  marketState: CanonicalMarketState | null;
  baselineIndicators: RawIndicators;
  simulationOverrides: Partial<RawIndicators>;
}): { output: EngineOutput; mode: BrowserMarketMode } {
  const isSimulating = Object.keys(input.simulationOverrides).length > 0;
  const deterministicOutput = computeEngine({
    ...input.baselineIndicators,
    ...input.simulationOverrides,
  });

  if (isSimulating) {
    return { output: withProbabilityContract(deterministicOutput, "simulation", null), mode: "simulation" };
  }

  if (input.marketState) {
    return {
      output: withProbabilityContract(
        projectCanonicalMarketState(input.marketState, deterministicOutput),
        "canonical",
        input.marketState.outlook.probabilityContract,
      ),
      mode: "canonical",
    };
  }

  // No MarketState: the deterministic engine runs on DEFAULT_INDICATORS demo
  // inputs, so its narrative ("Systemic risk composite at 45/100 — MODERATE
  // regime", "Banking System Stress (59/100)…") is not shown as market text.
  return {
    output: withProbabilityContract(withholdFallbackNarrative(deterministicOutput), "deterministic-fallback", null),
    mode: "deterministic-fallback",
  };
}

/** Shown wherever the market synthesis is unavailable (no MarketState). */
export const SYNTHESIS_UNAVAILABLE = "Synthesis unavailable";

export function withholdFallbackNarrative(output: EngineOutput): EngineOutput {
  return {
    ...output,
    narrative: { regimeAssessment: SYNTHESIS_UNAVAILABLE, summary: SYNTHESIS_UNAVAILABLE, keyRisks: [] },
  };
}

/** Neutral colour for a withheld (unavailable) canonical value. */
export const UNAVAILABLE_DISPLAY_COLOR = "#64748B";

type DisplayRiskLevel = DomainScore["riskLevel"];

function finitePressure100(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? normalizeCanonicalMetric(value) : null;
}

/** Canonical regime label → the risk band healthy mode would show for it. */
function regimeLabelRiskLevel(regime: string | null | undefined): DisplayRiskLevel | null {
  const key = (regime ?? "").trim().toUpperCase();
  if (!key) return null;
  switch (key) {
    case "LOW RISK":
    case "MODERATE RISK":
    case "ELEVATED RISK":
    case "HIGH STRESS":
    case "SYSTEMIC CRISIS":
      return regimeToRiskLevel(key);
    default:
      return null;
  }
}

const REGIME_BAND_COLOR: Record<DisplayRiskLevel, string> = {
  low: regimeColor(0),
  moderate: regimeColor(30),
  elevated: regimeColor(50),
  high: regimeColor(70),
  critical: regimeColor(85),
};

/**
 * Risk level from the canonical state only (pressure first, then the regime
 * label), the same banding healthy mode applies to the projected score; null
 * when there is no canonical value. Never derived from the demo engine.
 */
export function canonicalDisplayRiskLevel(
  pressure100: number | null | undefined,
  regime: string | null | undefined,
): DisplayRiskLevel | null {
  const p = finitePressure100(pressure100);
  if (p !== null) return riskLevel(p / 10);
  return regimeLabelRiskLevel(regime);
}

/** Regime colour from the canonical state (healthy-mode mapping), or neutral #64748B. */
export function canonicalRegimeDisplayColor(
  pressure100: number | null | undefined,
  regime: string | null | undefined,
): string {
  const p = finitePressure100(pressure100);
  if (p !== null) return regimeColor(p);
  const level = regimeLabelRiskLevel(regime);
  return level ? REGIME_BAND_COLOR[level] : UNAVAILABLE_DISPLAY_COLOR;
}
