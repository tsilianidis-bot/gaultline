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
    stressLevel: "Low" | "Elevated" | "High" | "Crisis";
    direction: "Improving" | "Stable" | "Deteriorating" | "Accelerating";
    historicalPercentile: number;
    headline: string;
    topDrivers: string[];
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
