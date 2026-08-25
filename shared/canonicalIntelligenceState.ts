export const CANONICAL_STATE_SCHEMA_VERSION = "phase2-canonical-state-v1" as const;

export type CanonicalCoherenceStatus = "COHERENT" | "DEGRADED" | "MIXED_FRESHNESS" | "STALE" | "INVALID" | "UNAVAILABLE";
export type CanonicalQualityStatus = "HEALTHY" | "DEGRADED" | "PARTIAL" | "UNAVAILABLE";
export type CanonicalDirection = "Improving" | "Stable" | "Deteriorating" | "Unknown";

export interface CanonicalEngineState {
  engineId: string;
  engineName: string;
  value: number | null;
  unit: string;
  classification: string | null;
  direction: CanonicalDirection;
  acceleration: null;
  persistence: null;
  observedAt: string | null;
  calculatedAt: string | null;
  sourceInputIds: string[];
  qualityStatus: CanonicalQualityStatus;
  freshnessStatus: string;
  fallbackStatus: "NONE" | "ACTIVE" | "UNKNOWN";
  modelVersion: string;
  calculationVersion: string;
  contributionToComposite: boolean;
}

export interface CanonicalStateConflict {
  conflictType: "PRESSURE_MISMATCH" | "REGIME_MISMATCH" | "TEMPORAL_MISMATCH" | "STALE_INPUT" | "UNAVAILABLE_INPUT" | "FALLBACK_INPUT" | "STATE_UNAVAILABLE";
  components: string[];
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  resolutionStatus: "RESOLVED" | "UNRESOLVED" | "SUPPRESSED";
  /** Present for governed fallback conflicts when supplied by the manifest. */
  originalSource?: string | null;
  fallbackSource?: string | null;
  fallbackReason?: string | null;
}

export interface CanonicalIntelligenceState {
  schemaVersion: typeof CANONICAL_STATE_SCHEMA_VERSION;
  stateId: string;
  generatedAt: string;
  effectiveAt: string;
  calculationStartedAt: string | null;
  calculationCompletedAt: string | null;
  championVersion: string;
  modelVersion: string;
  scoringVersion: string;
  configurationVersion: string;
  inputSnapshotId: string;
  stateHash: string;
  regime: string | null;
  pressureIndex: number | null;
  pressureLevel: string | null;
  pressureDirection: CanonicalDirection;
  pressureAcceleration: null;
  pressurePersistence: null;
  engines: CanonicalEngineState[];
  domains: Record<string, unknown>;
  scenarioOutputs: Record<string, number>;
  probabilityClaimIds: string[];
  analogClaimIds: string[];
  historicalContext: {
    canonicalLiveHistory: string;
    reconstructedResearch: string;
    historicalAnalogOutput: string;
    patternResolution: string;
  };
  dataQualitySummary: Record<string, unknown>;
  confidenceOrEvidenceQuality: CanonicalQualityStatus;
  staleInputs: string[];
  delayedInputs: string[];
  unavailableInputs: string[];
  fallbackInputs: string[];
  warnings: string[];
  conflicts: CanonicalStateConflict[];
  historicalDatasetVersion: string;
  researchDatasetVersion: string;
  provenance: {
    manifestSource: "intelligenceStateManifests";
    governanceVersion: string;
    coherenceStatus: CanonicalCoherenceStatus;
  };
}

export type PublicCanonicalIntelligenceState = Omit<CanonicalIntelligenceState, "domains" | "dataQualitySummary"> & {
  dataQualitySummary: Pick<CanonicalIntelligenceState["dataQualitySummary"], never> & {
    status: CanonicalQualityStatus;
    staleInputCount: number;
    delayedInputCount: number;
    unavailableInputCount: number;
    fallbackInputCount: number;
  };
};
