/**
 * Phase 3 authoritative evidence contract.
 *
 * Evidence class is system-owned metadata. Narrative systems may consume this
 * contract, but may not choose an evidence class or upgrade an unauthorized
 * claim into a forecast.
 */
export const EVIDENCE_CLASSES = ["OBSERVED", "DERIVED", "HISTORICAL", "INTERPRETED", "FORECAST"] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export const EVIDENCE_STRENGTHS = ["PRELIMINARY", "MODERATE", "STRONG", "VERY_STRONG"] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export const CLAIM_VALIDATION_STATUSES = ["VALID", "DEGRADED", "INSUFFICIENT_EVIDENCE", "INVALID", "UNAVAILABLE", "WITHHELD"] as const;
export type ClaimValidationStatus = (typeof CLAIM_VALIDATION_STATUSES)[number];

export const PROBABILITY_TYPES = ["MODEL_PROBABILITY", "HISTORICAL_FREQUENCY", "SCENARIO_SCORE", "NONE"] as const;
export type ProbabilityType = (typeof PROBABILITY_TYPES)[number];

export type SourceType = "MARKET_DATA" | "MACRO_DATA" | "ENGINE" | "MODEL" | "MANIFEST" | "DATASET" | "ANALYST_RULE" | "ARCHIVE";

export interface CanonicalClaimBinding {
  stateId: string;
  effectiveAt: string;
  inputSnapshotId?: string | null;
  modelVersion?: string | null;
  configurationVersion?: string | null;
}

export interface ForecastAuthorization {
  forecastContractId: string;
  forecastType: string;
  eventDefinition: string;
  forecastHorizon: string;
  modelId: string;
  modelVersion: string;
  methodology: string;
  calibrationBasis: string;
  probabilityDefinition: string;
  evidenceBasis: string;
  generatedAt: string;
}

export interface EvidenceClaim {
  claimId: string;
  evidenceClass: EvidenceClass;
  statement: string;
  value?: number | string | boolean | null;
  unit?: string | null;
  canonical: CanonicalClaimBinding | null;
  sourceIds?: string[];
  sourceType?: SourceType;
  sourceTimestamp?: string | null;
  derivedFromClaimIds?: string[];
  methodologyId?: string;
  methodologyVersion?: string;
  modelId?: string;
  modelVersion?: string;
  datasetId?: string;
  sampleSize?: number | null;
  historicalPeriod?: string | null;
  eventDefinition?: string | null;
  horizon?: string | null;
  probabilityType?: ProbabilityType;
  probabilityValue?: number | null;
  analogModelId?: string;
  analogSimilarity?: number | null;
  qualityStatus: string;
  evidenceStrength: EvidenceStrength;
  modelConfidence?: string | number | null;
  limitations: string[];
  createdAt: string;
  effectiveAt: string;
  forecastAuthorized: boolean;
  forecastContract?: ForecastAuthorization | null;
  confirmationProvenance?: "STRUCTURED_MODEL" | "DETERMINISTIC_RULE" | "HISTORICAL_RULE" | "ANALYST_INTERPRETATION" | null;
}

export interface EvidencePacket {
  contractVersion: "phase3-evidence-contract-v1";
  canonicalState: CanonicalClaimBinding | null;
  claims: EvidenceClaim[];
  createdAt: string;
}

export interface ClaimValidationResult {
  status: ClaimValidationStatus;
  issues: string[];
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function invalidForecastFields(claim: EvidenceClaim): boolean {
  return Boolean(claim.horizon || claim.probabilityValue !== undefined || claim.forecastContract || claim.probabilityType === "MODEL_PROBABILITY");
}

export function validateEvidenceClaim(claim: EvidenceClaim): ClaimValidationResult {
  const issues: string[] = [];
  const sourceIds = claim.sourceIds ?? [];
  const dependencies = claim.derivedFromClaimIds ?? [];

  if (!hasText(claim.claimId) || !hasText(claim.statement)) issues.push("Claim identity and statement are required.");
  if (!claim.canonical && claim.evidenceClass !== "HISTORICAL") issues.push("Current claim requires canonical state binding.");
  if (claim.canonical && claim.canonical.stateId.trim().length === 0) issues.push("Canonical state ID is required when a canonical binding is present.");

  if (claim.evidenceClass === "OBSERVED") {
    if (!sourceIds.length || !claim.sourceType || !hasText(claim.sourceTimestamp)) issues.push("OBSERVED claim requires source identity, source type, and source timestamp.");
  }
  if (claim.evidenceClass === "DERIVED") {
    if (!dependencies.length || !hasText(claim.methodologyId) || !hasText(claim.methodologyVersion)) issues.push("DERIVED claim requires source-claim dependencies and deterministic methodology identity.");
  }
  if (claim.evidenceClass === "HISTORICAL") {
    if (!hasText(claim.datasetId) || !hasText(claim.methodologyId) || !hasText(claim.historicalPeriod) || !hasText(claim.eventDefinition)) issues.push("HISTORICAL claim requires dataset, methodology, source period, and event definition.");
    if (claim.probabilityType === "MODEL_PROBABILITY" || claim.probabilityValue !== undefined) issues.push("Historical frequency cannot be represented as a model probability.");
  }
  if (claim.evidenceClass === "INTERPRETED" && !dependencies.length) issues.push("INTERPRETED claim requires supporting claim references.");
  if (claim.evidenceClass === "FORECAST") {
    const authorization = claim.forecastContract;
    if (!claim.forecastAuthorized || !authorization || ![authorization.forecastContractId, authorization.forecastType, authorization.eventDefinition, authorization.forecastHorizon, authorization.modelId, authorization.modelVersion, authorization.methodology, authorization.calibrationBasis, authorization.probabilityDefinition, authorization.evidenceBasis, authorization.generatedAt].every(hasText)) issues.push("FORECAST claim requires a complete authorized forecast contract.");
  }
  if (claim.evidenceClass !== "FORECAST" && invalidForecastFields(claim)) issues.push("Only an authorized FORECAST claim may carry forecast probability, horizon, or contract fields.");
  if (claim.analogSimilarity !== undefined && claim.analogSimilarity !== null && (claim.probabilityValue !== undefined || claim.probabilityType === "MODEL_PROBABILITY")) issues.push("Analog similarity cannot be transformed into probability.");
  if (claim.confirmationProvenance === "ANALYST_INTERPRETATION" && /\bconfirmed|invalidation\b/i.test(claim.statement)) issues.push("Analyst interpretation cannot be presented as structured confirmation or invalidation.");

  if (issues.length) return { status: claim.evidenceClass === "FORECAST" && !claim.forecastAuthorized ? "WITHHELD" : "INVALID", issues };
  if (/UNAVAILABLE|STALE|FALLBACK/i.test(claim.qualityStatus)) return { status: "DEGRADED", issues };
  return { status: "VALID", issues };
}

/** Returns an explicit non-forecast claim when a requested forecast lacks authorization. */
export function withholdUnsupportedForecast(input: Omit<EvidenceClaim, "evidenceClass" | "forecastAuthorized" | "forecastContract" | "probabilityType" | "probabilityValue" | "horizon" | "statement"> & { statement?: string }): EvidenceClaim {
  return {
    ...input,
    evidenceClass: "INTERPRETED",
    statement: input.statement ?? "No governed forecast available. Insufficient evidence for a reliable estimate.",
    forecastAuthorized: false,
    forecastContract: null,
    probabilityType: "NONE",
    limitations: [...input.limitations, "Forecast withheld: no valid forecast authorization contract."],
  };
}

export function createEvidencePacket(canonicalState: CanonicalClaimBinding | null, claims: EvidenceClaim[], createdAt = new Date().toISOString()): EvidencePacket {
  for (const claim of claims) {
    const validation = validateEvidenceClaim(claim);
    if (validation.status === "INVALID") throw new Error(`Invalid evidence claim ${claim.claimId}: ${validation.issues.join(" ")}`);
    if (canonicalState && claim.canonical && claim.canonical.stateId !== canonicalState.stateId) throw new Error(`State-mixed evidence packet rejected: ${claim.claimId} belongs to ${claim.canonical.stateId}, expected ${canonicalState.stateId}.`);
  }
  return { contractVersion: "phase3-evidence-contract-v1", canonicalState, claims, createdAt };
}

/** Minimum instruction appended to market-intelligence narrative prompts. */
export function evidenceNarrativePromptContract(): string {
  return [
    "EVIDENCE INTEGRITY RULES:",
    "- Treat OBSERVED, DERIVED, HISTORICAL, INTERPRETED, and FORECAST as different classes; do not upgrade one class into another.",
    "- Cite only structured evidence supplied in the packet. Do not invent metrics, history, timing, targets, probabilities, causality, confirmation, or cross-engine confirmation.",
    "- Historical frequency is not current model probability. Analog similarity is not recurrence probability or forecast confidence.",
    "- A FORECAST is allowed only when an explicit authorized forecast contract is supplied. Otherwise state: 'No governed forecast available' or 'Insufficient evidence for a reliable estimate.'",
    "- Keep claims bound to the supplied canonical state. Do not mix evidence from another state or present a single-engine observation as system-wide confirmation.",
  ].join("\n");
}
