import type { CanonicalProbabilityContract } from "./probabilityContract";
export type MarketStateFreshness = "live" | "recent" | "stale";
export type MarketStateCacheStatus = "fresh-cache" | "refreshed" | "stale-if-error";
export type MarketStateSourceStatus = "healthy" | "degraded" | "unavailable";

export interface MarketStateSourceHealth {
  id: "seismograph" | "historical-memory" | "fred" | "coingecko";
  label: string;
  status: MarketStateSourceStatus;
  required: boolean;
  asOf: string;
  detail: string;
}

export interface MarketStateProbabilityDistribution {
  bull: number;
  neutral: number;
  bear: number;
  confidence: number;
  primaryDriver: string;
  evidenceBasis: string;
  historicalBasis: string;
}

export interface CanonicalMarketState {
  version: "1.0";
  generatedAt: string;
  sourceUpdatedAt: string;
  freshness: MarketStateFreshness;
  cache: {
    status: MarketStateCacheStatus;
    ageMs: number;
    staleReason: string | null;
  };
  sourceHealth: MarketStateSourceHealth[];
  warnings: string[];
  now: {
    pressureScore: number;
    regime: string;
    /** Legacy seismograph labels, or the engine band level ("Moderate", "Critical") once projected from canonical state. */
    stressLevel: "Low" | "Moderate" | "Elevated" | "High" | "Critical" | "Crisis";
    /** "Unavailable" when the canonical composite direction cannot be derived (no prior comparable reading). */
    direction: "Improving" | "Stable" | "Deteriorating" | "Accelerating" | "Unavailable";
    historicalPercentile: number;
    headline: string;
    /** Strongest evidence families by strength. Ordering only — NOT a threat/support classification. */
    topDrivers: string[];
    /** Families whose own signal is bearish/stressed (shared/canonicalReadout classifyEvidenceFamilies). */
    threats: string[];
    /** Families whose own signal is bullish/recovering (same classifier). */
    supports: string[];
  };
  why: {
    story: string;
    whyThisScore: string;
    whyThisRegime: string;
    keyDevelopments: string[];
    narrative: {
      whatIsHappening: string;
      whyIsItHappening: string;
      whatHasChanged: string;
      whatIsBuildingBeneathSurface: string;
    };
    evidenceFamilies: Array<{
      name: string;
      signal: "bullish" | "bearish" | "neutral" | "stressed" | "recovering";
      strength: number;
      trend: "improving" | "deteriorating" | "stable";
      currentValue: string;
      historicalContext: string;
      whyItMatters: string;
    }>;
    evidenceConsensus: "strong" | "moderate" | "weak" | "divergent";
    /**
     * Month ("YYYY-MM") of the pressure-history record the evidence families are
     * read from. They are a MONTHLY record, not the current canonical run
     * (canonicalCurrent.engines), so the same label can carry a different value.
     */
    evidenceAsOfMonth?: string | null;
  };
  outlook: {
    probabilities: MarketStateProbabilityDistribution;
    regimeProbabilities: {
      bull: number;
      softLanding: number;
      stagflation: number;
      recession: number;
      crash: number;
    };
    transitionProbabilities: {
      remainInRegime: number;
      transitionToElevated: number;
      transitionToLow: number;
      transitionToCrisis: number;
      confidence: number;
      historicalBasis: string;
      currentEvidence: string[];
    };
    highestProbabilityPath: string;
    /**
     * The canonical probability contract for this state. Every number in
     * probabilities / transitionProbabilities is NaN unless its claim here is
     * AVAILABLE; render probabilityText(claim) instead. regimeProbabilities is a
     * retired generator and is always NaN (NOT_OFFERED).
     */
    probabilityContract?: CanonicalProbabilityContract | null;
    invalidationConditions: string[];
    topAnalog: {
      period: string;
      label: string;
      similarity: number;
      resolution: string;
    } | null;
  };
  watch: {
    developingConditions: Array<{
      title: string;
      description: string;
      severity: "Low" | "Moderate" | "High" | "Critical";
      trend: "building" | "stable" | "easing";
      durationDescription: string;
      evidence: string;
      expectedImpact: string;
    }>;
    activePatterns: Array<{
      name: string;
      description: string;
      confidence: number;
      daysActive: number;
      invalidationConditions: string;
    }>;
    whatChanged: string[];
    whatToWatch: string[];
    accelerating: boolean;
    buildingPressure: boolean;
  };
  act: {
    marketPosture: "defensive" | "balanced" | "opportunistic";
    decisionSummary: string;
    whatWouldInvalidate: string;
    riskControls: string[];
  };
  history: {
    observationCount: number;
    datasetSpan: string;
    currentStreakDescription: string;
    lastMajorShift: string | null;
    analogSummary: string;
  };
}
