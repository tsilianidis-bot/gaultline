import { createHash, randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import {
  governedIntelligenceClaims,
  governedResearchObservations,
  governedResearchResolutions,
  intelligenceStateManifests,
} from "../drizzle/schema";
import { getDb } from "./db";
import type { FaultlinePressureOutput, DataStatus, RiskVector } from "./pressure/engine";
import type { SeismographOutput } from "./seismographCore";

export const PHASE_1B_GOVERNANCE_VERSION = "phase1b-governance-v1";
export const CHAMPION_V1_GOVERNANCE_VERSION = "champion-v1-frozen";
export const V3H_GOVERNANCE_VERSION = "v3-h-shadow-only";

export type GovernanceEvidenceStatus = "SUPPORTED" | "SUPPORTED_WITH_QUALIFICATION" | "UNSUPPORTED" | "UNVERIFIED" | "RESEARCH_ONLY";
export type GovernanceDisplayStatus = "PREDICTIVE_ELIGIBLE" | "DISPLAY_WITH_QUALIFICATION" | "SUPPRESS_PREDICTIVE_PRESENTATION" | "INTERNAL_ONLY";
export type GovernedClaimType = "MODEL_PROBABILITY" | "HISTORICAL_FREQUENCY" | "ANALOG_SIMILARITY" | "EVIDENCE_CONFIDENCE" | "DERIVED_SCENARIO_SCORE" | "DERIVED_SCENARIO_COMPONENT" | "UNSUPPORTED";

export interface LiveInputQualityManifestEntry {
  inputId: string;
  metric: string;
  source: string;
  provider: string;
  sourceSeriesId: string | null;
  observedAt: string | null;
  fetchedAt: string;
  expectedUpdateFrequency: "daily" | "monthly" | "static";
  maxAgeHours: number | null;
  freshnessStatus: "LIVE" | "CURRENT" | "DELAYED" | "STALE" | "UNAVAILABLE" | "UNKNOWN";
  availabilityStatus: "AVAILABLE" | "FALLBACK_ACTIVE" | "UNAVAILABLE" | "STATIC_MODEL_INPUT";
  fallbackUsed: boolean;
  fallbackType: string | null;
  revisionStatus: string;
  qualityStatus: string;
  contributesTo: string[];
  value: number | null;
  confidenceImpact: "NONE" | "QUALIFIED" | "MATERIAL";
  publicClaimEligible: boolean;
}

export interface GovernedClaimRecord {
  claimId: string;
  claimType: GovernedClaimType;
  eventDefinition: string | null;
  timeHorizon: string | null;
  value: number | null;
  unit: string;
  sourceModel: string;
  modelVersion: string;
  methodology: string;
  sampleSize: number | null;
  datasetSpan: string | null;
  confidence: string;
  generatedAt: string;
  evidenceStatus: GovernanceEvidenceStatus;
  displayStatus: GovernanceDisplayStatus;
  metadata: Record<string, unknown>;
}

export interface AtomicIntelligenceStateManifest {
  stateId: string;
  generatedAt: string;
  championVersion: string;
  modelVersion: string;
  scoringVersion: string;
  configurationVersion: string;
  inputSnapshotId: string;
  engineValues: Record<string, number>;
  engineDirections: Record<string, string>;
  domainValues: Record<string, unknown>;
  pressureIndex: number;
  regime: string;
  scenarioOutputs: Record<string, number>;
  probabilityClaimIds: string[];
  analogClaimIds: string[];
  dataQualitySummary: {
    totalInputs: number;
    liveInputs: number;
    delayedInputs: number;
    staleInputs: string[];
    unavailableInputs: string[];
    fallbackInputs: string[];
    staticInputs: string[];
    publicClaimEligible: boolean;
  };
  staleInputs: string[];
  unavailableInputs: string[];
  fallbackInputs: string[];
  historicalDatasetVersion: string;
  researchDatasetVersion: string;
  coherenceStatus: "COHERENT" | "EXPLICIT_MISMATCH" | "UNAVAILABLE";
  coherenceNotes: string[];
  stateHash: string;
}

const INPUT_SPECS: Record<string, Omit<LiveInputQualityManifestEntry, "observedAt" | "fetchedAt" | "freshnessStatus" | "availabilityStatus" | "fallbackUsed" | "fallbackType" | "qualityStatus" | "contributesTo" | "value" | "confidenceImpact" | "publicClaimEligible">> = {
  hySpread: { inputId: "hy_credit_spread", metric: "ICE BofA US High Yield Option-Adjusted Spread", source: "FRED", provider: "Federal Reserve Economic Data", sourceSeriesId: "BAMLH0A0HYM2", expectedUpdateFrequency: "daily", maxAgeHours: 36, revisionStatus: "CURRENT_PROVIDER_VALUE_NO_VINTAGE_CAPTURE" },
  sofr: { inputId: "secured_overnight_financing_rate", metric: "Secured Overnight Financing Rate", source: "FRED", provider: "Federal Reserve Economic Data", sourceSeriesId: "SOFR", expectedUpdateFrequency: "daily", maxAgeHours: 36, revisionStatus: "CURRENT_PROVIDER_VALUE_NO_VINTAGE_CAPTURE" },
  tsy10y: { inputId: "ten_year_treasury_yield", metric: "10-Year Treasury Constant Maturity Rate", source: "FRED", provider: "Federal Reserve Economic Data", sourceSeriesId: "DGS10", expectedUpdateFrequency: "daily", maxAgeHours: 36, revisionStatus: "CURRENT_PROVIDER_VALUE_NO_VINTAGE_CAPTURE" },
  tsy2y: { inputId: "two_year_treasury_yield", metric: "2-Year Treasury Constant Maturity Rate", source: "FRED", provider: "Federal Reserve Economic Data", sourceSeriesId: "DGS2", expectedUpdateFrequency: "daily", maxAgeHours: 36, revisionStatus: "CURRENT_PROVIDER_VALUE_NO_VINTAGE_CAPTURE" },
  cpi: { inputId: "consumer_price_index_yoy", metric: "Consumer Price Index YoY", source: "FRED", provider: "Federal Reserve Economic Data", sourceSeriesId: "CPIAUCSL", expectedUpdateFrequency: "monthly", maxAgeHours: 1080, revisionStatus: "CURRENT_PROVIDER_VALUE_WITH_PUBLICATION_LAG" },
  ppi: { inputId: "producer_price_index_yoy", metric: "Producer Price Index YoY", source: "FRED", provider: "Federal Reserve Economic Data", sourceSeriesId: "PPIACO", expectedUpdateFrequency: "monthly", maxAgeHours: 1080, revisionStatus: "CURRENT_PROVIDER_VALUE_WITH_PUBLICATION_LAG" },
  fedFunds: { inputId: "federal_funds_rate", metric: "Effective Federal Funds Rate", source: "FRED", provider: "Federal Reserve Economic Data", sourceSeriesId: "FEDFUNDS", expectedUpdateFrequency: "monthly", maxAgeHours: 1080, revisionStatus: "CURRENT_PROVIDER_VALUE_WITH_PUBLICATION_LAG" },
  unemployment: { inputId: "unemployment_rate", metric: "Civilian Unemployment Rate", source: "FRED", provider: "Federal Reserve Economic Data", sourceSeriesId: "UNRATE", expectedUpdateFrequency: "monthly", maxAgeHours: 1080, revisionStatus: "CURRENT_PROVIDER_VALUE_WITH_PUBLICATION_LAG" },
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function supportingVectors(pressure: FaultlinePressureOutput, rawKey: string): RiskVector[] {
  return pressure.vectors.filter(vector => vector.id !== "ai-bubble" && Object.prototype.hasOwnProperty.call(vector.rawInputs, rawKey));
}

function worstStatus(statuses: DataStatus[]): DataStatus {
  const order: DataStatus[] = ["unavailable", "fallback", "stale", "cached", "delayed", "static", "live"];
  return statuses.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? "unavailable";
}

function translateQuality(status: DataStatus, hasValue: boolean) {
  if (!hasValue || status === "unavailable") return { freshnessStatus: "UNAVAILABLE" as const, availabilityStatus: "UNAVAILABLE" as const, fallbackUsed: false, confidenceImpact: "MATERIAL" as const };
  if (status === "fallback") return { freshnessStatus: "STALE" as const, availabilityStatus: "FALLBACK_ACTIVE" as const, fallbackUsed: true, confidenceImpact: "MATERIAL" as const };
  if (status === "stale" || status === "cached") return { freshnessStatus: "STALE" as const, availabilityStatus: "AVAILABLE" as const, fallbackUsed: false, confidenceImpact: "QUALIFIED" as const };
  if (status === "delayed") return { freshnessStatus: "DELAYED" as const, availabilityStatus: "AVAILABLE" as const, fallbackUsed: false, confidenceImpact: "QUALIFIED" as const };
  if (status === "static") return { freshnessStatus: "CURRENT" as const, availabilityStatus: "STATIC_MODEL_INPUT" as const, fallbackUsed: false, confidenceImpact: "QUALIFIED" as const };
  return { freshnessStatus: "LIVE" as const, availabilityStatus: "AVAILABLE" as const, fallbackUsed: false, confidenceImpact: "NONE" as const };
}

export function buildLiveInputQualityManifest(pressure: FaultlinePressureOutput): LiveInputQualityManifestEntry[] {
  const fetchedAt = pressure.lastUpdated;
  const entries = Object.entries(INPUT_SPECS).map(([rawKey, spec]) => {
    const vectors = supportingVectors(pressure, rawKey);
    const sourceStatus = worstStatus(vectors.map(vector => vector.dataStatus));
    const value = vectors.map(vector => vector.rawInputs[rawKey]).find((candidate): candidate is number => typeof candidate === "number") ?? null;
    const quality = translateQuality(sourceStatus, value !== null);
    const fallbackReason = vectors.find(vector => vector.fallbackReason)?.fallbackReason ?? null;
    return {
      ...spec,
      observedAt: null,
      fetchedAt,
      value,
      contributesTo: vectors.map(vector => vector.id),
      freshnessStatus: quality.freshnessStatus,
      availabilityStatus: quality.availabilityStatus,
      fallbackUsed: quality.fallbackUsed,
      fallbackType: quality.fallbackUsed ? (fallbackReason ?? "ENGINE_FALLBACK_PATH_NOT_FULLY_CLASSIFIED") : null,
      qualityStatus: value === null ? "MISSING_VALUE_EXPLICIT" : sourceStatus === "live" ? "CURRENT_PROVIDER_VALUE" : `ENGINE_${sourceStatus.toUpperCase()}_STATUS`,
      confidenceImpact: quality.confidenceImpact,
      publicClaimEligible: quality.freshnessStatus !== "UNAVAILABLE" && !quality.fallbackUsed,
    } satisfies LiveInputQualityManifestEntry;
  });
  entries.push({
    inputId: "ai_concentration_static_baseline",
    metric: "AI / speculation concentration baseline",
    source: "Frozen Champion V1 configuration",
    provider: "FAULTLINE",
    sourceSeriesId: null,
    observedAt: null,
    fetchedAt,
    expectedUpdateFrequency: "static",
    maxAgeHours: null,
    freshnessStatus: "CURRENT",
    availabilityStatus: "STATIC_MODEL_INPUT",
    fallbackUsed: false,
    fallbackType: null,
    revisionStatus: "FROZEN_STATIC_MODEL_ASSUMPTION",
    qualityStatus: "STATIC_MODEL_ESTIMATE",
    contributesTo: ["ai-bubble"],
    value: 65,
    confidenceImpact: "QUALIFIED",
    publicClaimEligible: false,
  });
  return entries;
}

function claimBase(generatedAt: string): Pick<GovernedClaimRecord, "sourceModel" | "modelVersion" | "methodology" | "sampleSize" | "datasetSpan" | "confidence" | "generatedAt" | "evidenceStatus" | "displayStatus"> {
  return {
    sourceModel: "seismograph-assembled-output",
    modelVersion: "seismograph-core-v1",
    methodology: "Derived presentation-layer composition. No calibrated event model, registered forecast horizon, or out-of-sample calibration has been established.",
    sampleSize: null,
    datasetSpan: null,
    confidence: "UNVERIFIED",
    generatedAt,
    evidenceStatus: "UNVERIFIED",
    displayStatus: "SUPPRESS_PREDICTIVE_PRESENTATION",
  };
}

export function buildGovernedClaims(seismograph: SeismographOutput | null, generatedAt: string): GovernedClaimRecord[] {
  if (!seismograph) return [];
  const base = claimBase(generatedAt);
  const scenarioClaims: GovernedClaimRecord[] = [
    ["bull", seismograph.probabilities.bull],
    ["neutral", seismograph.probabilities.neutral],
    ["bear", seismograph.probabilities.bear],
  ].map(([label, value]) => ({
    ...base,
    claimId: `seismograph.scenario.${label}`,
    claimType: "DERIVED_SCENARIO_SCORE",
    eventDefinition: null,
    timeHorizon: null,
    value: Number(value),
    unit: "score_percent",
    metadata: { label, primaryDriver: seismograph.probabilities.primaryDriver, rule: "Not a calibrated probability; predictive presentation suppressed." },
  }));
  const transitionClaims: GovernedClaimRecord[] = Object.entries(seismograph.transitionProbabilities)
    .filter(([key, value]) => key !== "primaryDriver" && typeof value === "number")
    .map(([label, value]) => ({
      ...base,
      claimId: `seismograph.transition.${label}`,
      claimType: "DERIVED_SCENARIO_COMPONENT",
      eventDefinition: null,
      timeHorizon: null,
      value: Number(value),
      unit: "component_percent",
      metadata: { label, primaryDriver: seismograph.transitionProbabilities.primaryDriver, rule: "Component is not a complete mutually exclusive or calibrated forecast distribution." },
    }));
  const analogClaims = seismograph.analogMatches.map((analog, index): GovernedClaimRecord => ({
    claimId: `seismograph.analog.${index}.${analog.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    claimType: "ANALOG_SIMILARITY",
    eventDefinition: "Feature-set similarity only; no recurrence event has been defined.",
    timeHorizon: null,
    value: analog.similarity,
    unit: "similarity_percent",
    sourceModel: "seismograph-assembled-analog",
    modelVersion: "seismograph-core-v1",
    methodology: "Similarity result emitted by the Seismograph assembled output. Similarity is not probability of recurrence, outcome, or forecast accuracy.",
    sampleSize: null,
    datasetSpan: null,
    confidence: "UNVERIFIED",
    generatedAt,
    evidenceStatus: "UNVERIFIED",
    displayStatus: "DISPLAY_WITH_QUALIFICATION",
    metadata: { label: analog.label, historicalPeriod: analog.period ?? null, analogType: "SYNTHESIS_ANALOG", outcomeDisplay: "SUPPRESSED_UNLESS_SOURCE_BACKED_RESOLUTION" },
  }));
  const patternClaims = seismograph.activePatterns.map((pattern): GovernedClaimRecord => ({
    claimId: `seismograph.pattern.${pattern.patternId}`,
    claimType: "UNSUPPORTED",
    eventDefinition: null,
    timeHorizon: null,
    value: pattern.confidence,
    unit: "pattern_confidence_score",
    sourceModel: "seismograph-pattern-engine",
    modelVersion: "seismograph-pattern-v1",
    methodology: "Current pattern-state classification. Historical outcome display requires a separate immutable original-observation and source-backed resolution record.",
    sampleSize: null,
    datasetSpan: null,
    confidence: "UNVERIFIED",
    generatedAt,
    evidenceStatus: "UNSUPPORTED",
    displayStatus: "SUPPRESS_PREDICTIVE_PRESENTATION",
    metadata: { patternId: pattern.patternId, name: pattern.name, historicalOutcome: pattern.historicalOutcome ?? null },
  }));
  return [...scenarioClaims, ...transitionClaims, ...analogClaims, ...patternClaims];
}

export function buildAtomicIntelligenceStateManifest({ pressure, seismograph, generatedAt = new Date().toISOString() }: { pressure: FaultlinePressureOutput; seismograph: SeismographOutput | null; generatedAt?: string }): { manifest: AtomicIntelligenceStateManifest; claims: GovernedClaimRecord[]; inputQuality: LiveInputQualityManifestEntry[] } {
  const inputQuality = buildLiveInputQualityManifest(pressure);
  const inputSnapshotId = `input:${sha256(inputQuality).slice(0, 32)}`;
  const claims = buildGovernedClaims(seismograph, generatedAt);
  const mismatchNotes: string[] = [];
  if (!seismograph) mismatchNotes.push("canonical-seismograph-output-unavailable");
  if (seismograph && seismograph.pressureScore !== pressure.overallPressure) mismatchNotes.push(`pressure-score-mismatch:${pressure.overallPressure}:${seismograph.pressureScore}`);
  if (seismograph && seismograph.regime !== pressure.regime) mismatchNotes.push(`regime-mismatch:${pressure.regime}:${seismograph.regime}`);
  const coherenceStatus = !seismograph ? "UNAVAILABLE" : mismatchNotes.length ? "EXPLICIT_MISMATCH" : "COHERENT";
  const staleInputs = inputQuality.filter(input => input.freshnessStatus === "STALE").map(input => input.inputId);
  const unavailableInputs = inputQuality.filter(input => input.freshnessStatus === "UNAVAILABLE").map(input => input.inputId);
  const fallbackInputs = inputQuality.filter(input => input.fallbackUsed).map(input => input.inputId);
  const staticInputs = inputQuality.filter(input => input.availabilityStatus === "STATIC_MODEL_INPUT").map(input => input.inputId);
  const engineValues = Object.fromEntries(pressure.vectors.map(vector => [vector.id, vector.score]));
  const engineDirections = Object.fromEntries(pressure.vectors.map(vector => [vector.id, vector.trend]));
  const scenarioOutputs = seismograph ? { bull: seismograph.probabilities.bull, neutral: seismograph.probabilities.neutral, bear: seismograph.probabilities.bear } : {};
  const core = {
    championVersion: CHAMPION_V1_GOVERNANCE_VERSION,
    modelVersion: seismograph?.version ?? "seismograph-unavailable",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: PHASE_1B_GOVERNANCE_VERSION,
    inputSnapshotId,
    engineValues,
    engineDirections,
    domainValues: { activeContributors: seismograph?.activeContributors ?? [], evidenceConsensus: seismograph?.evidenceConsensus ?? "unavailable", providerProvenance: seismograph?.providerProvenance ?? null },
    pressureIndex: seismograph?.pressureScore ?? pressure.overallPressure,
    regime: seismograph?.regime ?? pressure.regime,
    scenarioOutputs,
    probabilityClaimIds: claims.filter(claim => claim.claimType === "DERIVED_SCENARIO_SCORE" || claim.claimType === "DERIVED_SCENARIO_COMPONENT").map(claim => claim.claimId),
    analogClaimIds: claims.filter(claim => claim.claimType === "ANALOG_SIMILARITY").map(claim => claim.claimId),
    dataQualitySummary: {
      totalInputs: inputQuality.length,
      liveInputs: inputQuality.filter(input => input.freshnessStatus === "LIVE").length,
      delayedInputs: inputQuality.filter(input => input.freshnessStatus === "DELAYED").length,
      staleInputs,
      unavailableInputs,
      fallbackInputs,
      staticInputs,
      publicClaimEligible: coherenceStatus === "COHERENT" && unavailableInputs.length === 0 && fallbackInputs.length === 0,
    },
    staleInputs,
    unavailableInputs,
    fallbackInputs,
    historicalDatasetVersion: "legacy-317-unreconciled",
    researchDatasetVersion: "reconstructed-champion-v1-2000-2026-research-only",
    coherenceStatus,
    coherenceNotes: mismatchNotes,
  } satisfies Omit<AtomicIntelligenceStateManifest, "stateId" | "generatedAt" | "stateHash">;
  const stateHash = sha256(core);
  const manifest: AtomicIntelligenceStateManifest = {
    stateId: `state:${generatedAt}:${stateHash.slice(0, 16)}`,
    generatedAt,
    ...core,
    stateHash,
  };
  return { manifest, claims, inputQuality };
}

export async function persistAtomicIntelligenceStateManifest(result: ReturnType<typeof buildAtomicIntelligenceStateManifest>): Promise<{ stateId: string; created: boolean; claimsCreated: number }> {
  const db = await getDb();
  if (!db) return { stateId: result.manifest.stateId, created: false, claimsCreated: 0 };
  const existing = await db.select({ id: intelligenceStateManifests.id }).from(intelligenceStateManifests).where(eq(intelligenceStateManifests.stateId, result.manifest.stateId)).limit(1);
  if (existing[0]) return { stateId: result.manifest.stateId, created: false, claimsCreated: 0 };
  await db.insert(intelligenceStateManifests).values({
    stateId: result.manifest.stateId,
    generatedAt: new Date(result.manifest.generatedAt),
    championVersion: result.manifest.championVersion,
    modelVersion: result.manifest.modelVersion,
    scoringVersion: result.manifest.scoringVersion,
    configurationVersion: result.manifest.configurationVersion,
    inputSnapshotId: result.manifest.inputSnapshotId,
    stateHash: result.manifest.stateHash,
    coherenceStatus: result.manifest.coherenceStatus,
    manifestJson: JSON.stringify({ ...result.manifest, inputQuality: result.inputQuality }),
  });
  if (result.claims.length) {
    await db.insert(governedIntelligenceClaims).values(result.claims.map(claim => ({
      claimObservationKey: `${result.manifest.stateId}:${claim.claimId}`,
      stateId: result.manifest.stateId,
      claimId: claim.claimId,
      claimType: claim.claimType,
      eventDefinition: claim.eventDefinition,
      timeHorizon: claim.timeHorizon,
      valueNumeric: claim.value,
      unit: claim.unit,
      sourceModel: claim.sourceModel,
      modelVersion: claim.modelVersion,
      methodology: claim.methodology,
      sampleSize: claim.sampleSize,
      datasetSpan: claim.datasetSpan,
      confidence: claim.confidence,
      generatedAt: new Date(claim.generatedAt),
      evidenceStatus: claim.evidenceStatus,
      displayStatus: claim.displayStatus,
      metadataJson: JSON.stringify(claim.metadata),
    })));
  }
  return { stateId: result.manifest.stateId, created: true, claimsCreated: result.claims.length };
}

export function buildGovernedResearchObservation(input: {
  observationKey?: string;
  observationVersion: string;
  historyClass: "live_verified" | "reconstructed_research" | "revised_data_reconstruction" | "proxy_reconstruction";
  observationDate: string;
  informationCutoff: string;
  inputSnapshotId?: string | null;
  sourceModel: string;
  modelVersion: string;
  originalState: unknown;
  originalInterpretation?: string | null;
  outcomeDefinition?: string | null;
  outcomeWindow?: string | null;
  sourceDataVersions: unknown;
}) {
  return { ...input, observationKey: input.observationKey ?? `research:${randomUUID()}` };
}

export async function persistGovernedResearchObservation(record: ReturnType<typeof buildGovernedResearchObservation>): Promise<{ id: number | null; created: boolean }> {
  const db = await getDb();
  if (!db) return { id: null, created: false };
  const existing = await db.select({ id: governedResearchObservations.id }).from(governedResearchObservations).where(eq(governedResearchObservations.observationKey, record.observationKey)).limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };
  const inserted = await db.insert(governedResearchObservations).values({
    observationKey: record.observationKey,
    observationVersion: record.observationVersion,
    historyClass: record.historyClass,
    observationDate: new Date(record.observationDate),
    informationCutoff: new Date(record.informationCutoff),
    inputSnapshotId: record.inputSnapshotId ?? null,
    sourceModel: record.sourceModel,
    modelVersion: record.modelVersion,
    originalStateJson: JSON.stringify(record.originalState),
    originalInterpretation: record.originalInterpretation ?? null,
    outcomeDefinition: record.outcomeDefinition ?? null,
    outcomeWindow: record.outcomeWindow ?? null,
    sourceDataVersionsJson: JSON.stringify(record.sourceDataVersions),
  }).$returningId();
  return { id: inserted[0]?.id ?? null, created: true };
}

export async function appendGovernedResearchResolution(input: { observationId: number; resolutionVersion: string; outcomeValue: unknown; resolvedAt: string; sourceDataVersions: unknown; resolutionKey?: string }): Promise<{ id: number | null; created: boolean }> {
  const db = await getDb();
  if (!db) return { id: null, created: false };
  const resolutionKey = input.resolutionKey ?? `resolution:${input.observationId}:${input.resolutionVersion}:${input.resolvedAt}`;
  const existing = await db.select({ id: governedResearchResolutions.id }).from(governedResearchResolutions).where(eq(governedResearchResolutions.resolutionKey, resolutionKey)).orderBy(asc(governedResearchResolutions.id)).limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };
  const inserted = await db.insert(governedResearchResolutions).values({
    resolutionKey,
    observationId: input.observationId,
    resolutionVersion: input.resolutionVersion,
    outcomeValueJson: JSON.stringify(input.outcomeValue),
    resolvedAt: new Date(input.resolvedAt),
    sourceDataVersionsJson: JSON.stringify(input.sourceDataVersions),
  }).$returningId();
  return { id: inserted[0]?.id ?? null, created: true };
}
