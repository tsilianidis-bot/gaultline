import type { CanonicalMarketState } from "@shared/marketState";
import { normalizeCanonicalMetric } from "@shared/marketMetrics";
import {
  computeEngine,
  type DomainScore,
  type EngineOutput,
  type RawIndicators,
  type RegimeOutput,
} from "@/lib/engine";

export type BrowserMarketMode = "canonical" | "simulation" | "deterministic-fallback";

function riskLevel(score: number): DomainScore["riskLevel"] {
  if (score >= 8.5) return "critical";
  if (score >= 7) return "high";
  if (score >= 5) return "elevated";
  if (score >= 3) return "moderate";
  return "low";
}

function regimeCode(score: number): RegimeOutput["code"] {
  if (score >= 85) return "CRITICAL_SYSTEMIC";
  if (score >= 70) return "LATE_CYCLE_FRAGILITY";
  if (score >= 50) return "ELEVATED_STRESS";
  if (score >= 30) return "MODERATE_RISK";
  return "LOW_RISK";
}

function regimeColor(score: number): string {
  if (score >= 85) return "#ff2d55";
  if (score >= 70) return "#ff6b35";
  if (score >= 50) return "#ffb020";
  if (score >= 30) return "#00d4ff";
  return "#00e599";
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
      delta: 0,
      riskLevel: riskLevel(domainScore),
      description: family.whyItMatters,
      drivers: [family.currentValue, family.historicalContext].filter(Boolean),
      dataStatus: state.cache.status === "stale-if-error" ? "fallback" : "live",
      fallbackReason: state.cache.staleReason ?? undefined,
      source: "canonical-market-state",
    };
  });

  const probabilities = state.outlook.regimeProbabilities;
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
    overall: {
      id: "canonical-market-pressure",
      label: "Market Pressure",
      score: score10,
      delta: 0,
      riskLevel: riskLevel(score10),
      description: state.now.headline,
      drivers: state.now.topDrivers,
      dataStatus: state.cache.status === "stale-if-error" ? "fallback" : "live",
      fallbackReason: state.cache.staleReason ?? undefined,
      source: "canonical-market-state",
    },
    domains: domains.length > 0 ? domains : deterministicFallback.domains,
    regime: {
      label: state.now.regime,
      sublabel: `${state.now.stressLevel} · ${state.now.direction}`,
      color: regimeColor(canonicalScore),
      code: regimeCode(canonicalScore),
      description: state.why.whyThisRegime,
    },
    probability: {
      bullProbability: normalizeCanonicalMetric(probabilities.bull),
      crashProbability: normalizeCanonicalMetric(probabilities.crash),
      softLandingProbability: normalizeCanonicalMetric(probabilities.softLanding),
      stagflationProbability: normalizeCanonicalMetric(probabilities.stagflation),
      recessionProbability: normalizeCanonicalMetric(probabilities.recession),
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
    return { output: deterministicOutput, mode: "simulation" };
  }

  if (input.marketState) {
    return {
      output: projectCanonicalMarketState(input.marketState, deterministicOutput),
      mode: "canonical",
    };
  }

  return { output: deterministicOutput, mode: "deterministic-fallback" };
}
