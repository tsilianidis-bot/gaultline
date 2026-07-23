import type {
  CanonicalMarketState,
  MarketStateCacheStatus,
  MarketStateSourceHealth,
} from "../shared/marketState";
import { normalizeCanonicalMetric } from "../shared/marketMetrics";
import {
  getUnifiedSeismographIntelligence,
  type UnifiedSeismographIntelligence,
} from "./seismographUnified";
import { canonicalMarketStateCache } from "./marketStateCache";

export type CanonicalMarketStateSource = Pick<
  UnifiedSeismographIntelligence,
  | "currentScore"
  | "currentRegime"
  | "currentStressLevel"
  | "currentDirection"
  | "currentPercentile"
  | "dataFreshness"
  | "lastUpdated"
  | "todayStory"
  | "keyDevelopments"
  | "whyThisScore"
  | "whyThisRegime"
  | "probabilities"
  | "evidenceFamilies"
  | "evidenceConsensus"
  | "topAnalog"
  | "analogSummary"
  | "transitionProbabilities"
  | "evolution"
  | "memory"
  | "regimeProbabilities5way"
  | "developingConditions"
  | "marketNarrative"
  | "activePatterns"
>;

interface AssembleMarketStateOptions {
  generatedAt: string;
  cacheStatus: MarketStateCacheStatus;
  cacheAgeMs: number;
  staleReason?: string | null;
}

function buildSourceHealth(
  source: CanonicalMarketStateSource,
  cacheStatus: MarketStateCacheStatus,
): MarketStateSourceHealth[] {
  const stale = cacheStatus === "stale-if-error" || source.dataFreshness === "stale";
  const historicalAvailable = source.memory.observationCount > 0;
  const evidenceAvailable = source.evidenceFamilies.length > 0;

  return [
    {
      id: "seismograph",
      label: "Canonical Seismograph",
      status: stale ? "degraded" : "healthy",
      required: true,
      asOf: source.lastUpdated,
      detail: stale
        ? "Serving the last known-good Seismograph state while the current refresh is unavailable."
        : "Unified Seismograph synthesis is current and available.",
    },
    {
      id: "historical-memory",
      label: "Historical Market Memory",
      status: historicalAvailable ? "healthy" : "unavailable",
      required: true,
      asOf: source.lastUpdated,
      detail: historicalAvailable
        ? `${source.memory.observationCount} observations across ${source.memory.datasetSpan}.`
        : "Historical observations are unavailable.",
    },
    {
      id: "fred",
      label: "Macro and Credit Evidence",
      status: evidenceAvailable ? "healthy" : "unavailable",
      required: true,
      asOf: source.lastUpdated,
      detail: evidenceAvailable
        ? `${source.evidenceFamilies.length} normalized evidence families are contributing.`
        : "Normalized macro and credit evidence is unavailable.",
    },
    {
      id: "coingecko",
      label: "Crypto Market Overlay",
      status: "unavailable",
      required: false,
      asOf: source.lastUpdated,
      detail: "Optional live crypto overlay is not required for the canonical Seismograph state.",
    },
  ];
}

function marketPosture(
  stressLevel: CanonicalMarketStateSource["currentStressLevel"],
  probabilities: CanonicalMarketState["outlook"]["probabilities"],
): CanonicalMarketState["act"]["marketPosture"] {
  if (stressLevel === "Crisis" || probabilities.bear >= 55) return "defensive";
  if (stressLevel === "Low" && probabilities.bull >= 50) return "opportunistic";
  return "balanced";
}

export function assembleCanonicalMarketState(
  source: CanonicalMarketStateSource,
  options: AssembleMarketStateOptions,
): CanonicalMarketState {
  const sourceHealth = buildSourceHealth(source, options.cacheStatus);
  const warnings = sourceHealth
    .filter(item => item.required && item.status !== "healthy")
    .map(item => `${item.label}: ${item.detail}`);
  if (options.staleReason) warnings.unshift(options.staleReason);

  const topDrivers = [...source.evidenceFamilies]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map(family => `${family.name}: ${family.currentValue}`);
  const probabilities = {
    ...source.probabilities,
    bull: normalizeCanonicalMetric(source.probabilities.bull),
    neutral: normalizeCanonicalMetric(source.probabilities.neutral),
    bear: normalizeCanonicalMetric(source.probabilities.bear),
    confidence: normalizeCanonicalMetric(source.probabilities.confidence),
  };
  const posture = marketPosture(source.currentStressLevel, probabilities);

  return {
    version: "1.0",
    generatedAt: options.generatedAt,
    sourceUpdatedAt: source.lastUpdated,
    freshness: options.cacheStatus === "stale-if-error" ? "stale" : source.dataFreshness,
    cache: {
      status: options.cacheStatus,
      ageMs: options.cacheAgeMs,
      staleReason: options.staleReason ?? null,
    },
    sourceHealth,
    warnings,
    now: {
      pressureScore: normalizeCanonicalMetric(source.currentScore),
      regime: source.currentRegime,
      stressLevel: source.currentStressLevel,
      direction: source.currentDirection,
      historicalPercentile: normalizeCanonicalMetric(source.currentPercentile),
      headline: `${source.currentStressLevel} stress in a ${source.currentRegime} regime; pressure is ${source.currentDirection.toLowerCase()}.`,
      topDrivers,
    },
    why: {
      story: source.todayStory,
      whyThisScore: source.whyThisScore,
      whyThisRegime: source.whyThisRegime,
      keyDevelopments: source.keyDevelopments,
      narrative: {
        whatIsHappening: source.marketNarrative.whatIsHappening,
        whyIsItHappening: source.marketNarrative.whyIsItHappening,
        whatHasChanged: source.marketNarrative.whatHasChanged,
        whatIsBuildingBeneathSurface: source.marketNarrative.whatIsBuildingBeneathSurface,
      },
      evidenceFamilies: source.evidenceFamilies.map(family => ({
        ...family,
        strength: normalizeCanonicalMetric(family.strength),
      })),
      evidenceConsensus: source.evidenceConsensus,
    },
    outlook: {
      probabilities,
      regimeProbabilities: {
        bull: normalizeCanonicalMetric(source.regimeProbabilities5way.bull),
        softLanding: normalizeCanonicalMetric(source.regimeProbabilities5way.softLanding),
        stagflation: normalizeCanonicalMetric(source.regimeProbabilities5way.stagflation),
        recession: normalizeCanonicalMetric(source.regimeProbabilities5way.recession),
        crash: normalizeCanonicalMetric(source.regimeProbabilities5way.crash),
      },
      transitionProbabilities: {
        ...source.transitionProbabilities,
        remainInRegime: normalizeCanonicalMetric(source.transitionProbabilities.remainInRegime),
        transitionToElevated: normalizeCanonicalMetric(source.transitionProbabilities.transitionToElevated),
        transitionToLow: normalizeCanonicalMetric(source.transitionProbabilities.transitionToLow),
        transitionToCrisis: normalizeCanonicalMetric(source.transitionProbabilities.transitionToCrisis),
        confidence: normalizeCanonicalMetric(source.transitionProbabilities.confidence),
      },
      highestProbabilityPath: source.marketNarrative.highestProbabilityPath,
      invalidationConditions: source.evolution.invalidationConditions,
      topAnalog: source.topAnalog
        ? {
            period: source.topAnalog.period,
            label: source.topAnalog.label,
            similarity: normalizeCanonicalMetric(source.topAnalog.similarity),
            resolution: source.topAnalog.resolution,
          }
        : null,
    },
    watch: {
      developingConditions: source.developingConditions.map(condition => ({
        title: condition.title,
        description: condition.description,
        severity: condition.severity,
        trend: condition.trend,
        durationDescription: condition.durationDescription,
        evidence: condition.evidence,
        expectedImpact: condition.expectedImpact,
      })),
      activePatterns: source.activePatterns.map(pattern => ({
        name: pattern.name,
        description: pattern.description,
        confidence: normalizeCanonicalMetric(pattern.confidence),
        daysActive: pattern.daysActive,
        invalidationConditions: pattern.invalidationConditions,
      })),
      whatChanged: source.evolution.whatChanged,
      whatToWatch: source.evolution.whatToWatch,
      accelerating: source.evolution.accelerating,
      buildingPressure: source.evolution.buildingPressure,
    },
    act: {
      marketPosture: posture,
      decisionSummary: `Maintain a ${posture} posture while ${source.marketNarrative.highestProbabilityPath}`,
      whatWouldInvalidate: source.marketNarrative.whatWouldInvalidate,
      riskControls: source.evolution.invalidationConditions,
    },
    history: {
      observationCount: source.memory.observationCount,
      datasetSpan: source.memory.datasetSpan,
      currentStreakDescription: source.memory.currentStreakDescription,
      lastMajorShift: source.memory.lastMajorShift,
      analogSummary: source.analogSummary,
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown MarketState refresh failure";
}

export async function getCanonicalMarketState(options: { forceRefresh?: boolean } = {}): Promise<CanonicalMarketState> {
  const result = await canonicalMarketStateCache.getOrLoad(
    getUnifiedSeismographIntelligence,
    { forceRefresh: options.forceRefresh },
  );
  const staleReason = result.status === "stale-if-error"
    ? `Refresh failed; serving the last known-good MarketState. ${errorMessage(result.error)}`
    : null;

  return assembleCanonicalMarketState(result.value, {
    generatedAt: new Date().toISOString(),
    cacheStatus: result.status,
    cacheAgeMs: result.ageMs,
    staleReason,
  });
}
