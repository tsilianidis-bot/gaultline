import type {
  CanonicalMarketState,
  MarketStateCacheStatus,
  MarketStateSourceHealth,
} from "../shared/marketState";
import { normalizeCanonicalMetric } from "../shared/marketMetrics";
import { classifyEvidenceFamilies } from "../shared/canonicalReadout";
import {
  probabilityPercent,
  type CanonicalProbabilityContract,
  type ProbabilityClaim,
} from "../shared/probabilityContract";
import {
  getUnifiedSeismographIntelligence,
  type UnifiedSeismographIntelligence,
} from "./seismographUnified";
import {
  canonicalMarketStateCache,
  type MarketStateCacheOptions,
  type MarketStateCacheResult,
} from "./marketStateCache";

export type CanonicalMarketStateSource = Pick<
  UnifiedSeismographIntelligence,
  | "currentScore"
  | "currentRegime"
  | "currentStressLevel"
  | "currentDirection"
  | "currentPercentile"
  | "dataFreshness"
  | "lastUpdated"
  | "providerProvenance"
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
> & Partial<Pick<UnifiedSeismographIntelligence, "macroTicker">>;

interface AssembleMarketStateOptions {
  generatedAt: string;
  cacheStatus: MarketStateCacheStatus;
  cacheAgeMs: number;
  staleReason?: string | null;
  /**
   * The stateId-bound probability contract from the authoritative canonical
   * state. Every probability number below renders only when its contract claim
   * is AVAILABLE; otherwise it is NaN (withheld) and surfaces render the claim's
   * display text. Null/undefined (no canonical state) withholds every number.
   */
  probabilityContract?: CanonicalProbabilityContract | null;
}

/** A displayed percent from the contract, or NaN when the contract withholds it. */
function contractPercent(claim: ProbabilityClaim | null | undefined): number {
  const percent = probabilityPercent(claim);
  return percent === null ? Number.NaN : percent;
}

function scenarioClaim(contract: CanonicalProbabilityContract | null | undefined, id: "bull" | "neutral" | "bear") {
  return contract?.scenarioSet.scenarios.find(claim => claim.scenario.scenarioId === id) ?? null;
}

function transitionClaim(contract: CanonicalProbabilityContract | null | undefined, id: string) {
  return contract?.transitions.find(claim => claim.scenario.scenarioId === id) ?? null;
}

export interface CanonicalMarketStateProvider<T extends CanonicalMarketStateSource = CanonicalMarketStateSource> {
  id: "unified-seismograph";
  load: () => Promise<T>;
}

export interface CanonicalMarketStateCachePort<T extends CanonicalMarketStateSource = CanonicalMarketStateSource> {
  getOrLoad(
    loader: () => Promise<T>,
    options?: MarketStateCacheOptions,
  ): Promise<MarketStateCacheResult<T>>;
}

export const canonicalMarketStateProvider: CanonicalMarketStateProvider<UnifiedSeismographIntelligence> = {
  id: "unified-seismograph",
  load: getUnifiedSeismographIntelligence,
};

function buildSourceHealth(
  source: CanonicalMarketStateSource,
  cacheStatus: MarketStateCacheStatus,
): MarketStateSourceHealth[] {
  const stale = cacheStatus === "stale-if-error" || source.dataFreshness === "stale";
  const historicalAvailable = source.memory.observationCount > 0;
  const fred = source.providerProvenance.fred;
  const fredStatus = fred.status === "live"
    ? "healthy"
    : fred.status === "fallback"
      ? "degraded"
      : "unavailable";
  const fredAsOf = Number.isFinite(fred.asOf)
    ? new Date(fred.asOf).toISOString()
    : source.lastUpdated;

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
      status: fredStatus,
      required: true,
      asOf: fredAsOf,
      detail: fred.detail,
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
  const classified = classifyEvidenceFamilies(source.evidenceFamilies);
  // Probability contract overlay. Applied after (not through)
  // normalizeCanonicalMetric, which would turn a withheld NaN into 0.
  // The raw seismographUnified computeProbabilities (64/21/15-style) and the
  // 5-way regime split are retired generators: they never reach this payload.
  const contract = options.probabilityContract ?? null;
  const probabilities = {
    ...source.probabilities,
    bull: contractPercent(scenarioClaim(contract, "bull")),
    neutral: contractPercent(scenarioClaim(contract, "neutral")),
    bear: contractPercent(scenarioClaim(contract, "bear")),
    // Forecast confidence starts from a 50 baseline and is not calibrated.
    confidence: Number.NaN,
  };
  // Posture is a calculated output: it keeps reading the source scenario
  // weights exactly as before the contract (unchanged calculation). The
  // contract only governs what is displayed.
  const posture = marketPosture(source.currentStressLevel, {
    ...source.probabilities,
    bull: normalizeCanonicalMetric(source.probabilities.bull),
    neutral: normalizeCanonicalMetric(source.probabilities.neutral),
    bear: normalizeCanonicalMetric(source.probabilities.bear),
    confidence: normalizeCanonicalMetric(source.probabilities.confidence),
  });

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
      threats: classified.threats,
      supports: classified.supports,
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
      evidenceAsOfMonth: source.macroTicker?.dataMonth ?? null,
    },
    outlook: {
      probabilities,
      // Retired 5-way split (G3): NOT_OFFERED, so every member is withheld.
      regimeProbabilities: {
        bull: Number.NaN,
        softLanding: Number.NaN,
        stagflation: Number.NaN,
        recession: Number.NaN,
        crash: Number.NaN,
      },
      transitionProbabilities: {
        ...source.transitionProbabilities,
        remainInRegime: contractPercent(transitionClaim(contract, "remainInRegime")),
        transitionToElevated: contractPercent(transitionClaim(contract, "transitionToElevated")),
        transitionToLow: contractPercent(transitionClaim(contract, "transitionToLow")),
        transitionToCrisis: contractPercent(transitionClaim(contract, "transitionToCrisis")),
        confidence: Number.NaN,
      },
      highestProbabilityPath: source.marketNarrative.highestProbabilityPath,
      probabilityContract: contract,
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

async function loadWithOneRetry<T extends CanonicalMarketStateSource>(
  provider: CanonicalMarketStateProvider<T>,
): Promise<T> {
  let firstError: unknown;
  try {
    return await provider.load();
  } catch (error) {
    firstError = error;
  }

  try {
    return await provider.load();
  } catch (secondError) {
    throw new Error(
      `MarketState provider failed twice: ${errorMessage(firstError)}; retry: ${errorMessage(secondError)}`,
    );
  }
}

export function createCanonicalMarketStateReader<T extends CanonicalMarketStateSource>(dependencies: {
  provider: CanonicalMarketStateProvider<T>;
  cache: CanonicalMarketStateCachePort<T>;
  now?: () => Date;
  /** Loads the authoritative canonical probability contract. Failure withholds every number. */
  loadProbabilityContract?: () => Promise<CanonicalProbabilityContract | null>;
}) {
  return async function readCanonicalMarketState(
    options: { forceRefresh?: boolean } = {},
  ): Promise<CanonicalMarketState> {
    const result = await dependencies.cache.getOrLoad(
      () => loadWithOneRetry(dependencies.provider),
      { forceRefresh: options.forceRefresh },
    );
    const staleReason = result.status === "stale-if-error"
      ? `Refresh failed; serving the last known-good MarketState. ${errorMessage(result.error)}`
      : null;

    const probabilityContract = dependencies.loadProbabilityContract
      ? await dependencies.loadProbabilityContract().catch(() => null)
      : null;

    return assembleCanonicalMarketState(result.value, {
      probabilityContract,
      generatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      cacheStatus: result.status,
      cacheAgeMs: result.ageMs,
      staleReason,
    });
  };
}

export const getCanonicalMarketState = createCanonicalMarketStateReader({
  provider: canonicalMarketStateProvider,
  cache: canonicalMarketStateCache,
  loadProbabilityContract: async () => {
    const { getAuthoritativeCanonicalIntelligenceState } = await import("./canonicalIntelligenceState");
    return (await getAuthoritativeCanonicalIntelligenceState())?.probabilityContract ?? null;
  },
});
