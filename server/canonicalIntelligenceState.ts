import { and, desc, gte, lte } from "drizzle-orm";
import { intelligenceStateManifests } from "../drizzle/schema";
import {
  CANONICAL_STATE_SCHEMA_VERSION,
  type CanonicalDirection,
  type CanonicalEngineState,
  type CanonicalIntelligenceState,
  type CanonicalQualityStatus,
  type CanonicalStateConflict,
  type PublicCanonicalIntelligenceState,
} from "../shared/canonicalIntelligenceState";
import { getDb } from "./db";
import { compositePressureDirection, engineEvidenceStatus, stressTrendDirection } from "../shared/snapshotEvidence";

type StoredManifest = Record<string, any>;

/**
 * Vectors whose engine trend is a fixed constant rather than an observation
 * (server/pressure/engine.ts: ai-bubble trend is a hard-coded "secular" value).
 * Their direction cannot be derived truthfully, so it is reported as Unknown.
 */
const STATIC_TREND_ENGINES = new Set(["ai-bubble"]);

/** Engine vector trends describe stress: rising stress = Deteriorating (shared/snapshotEvidence.ts). */
function direction(value: unknown, engineId?: string): CanonicalDirection {
  if (engineId && STATIC_TREND_ENGINES.has(engineId)) return "Unknown";
  return stressTrendDirection(value);
}

function quality(manifest: StoredManifest): CanonicalQualityStatus {
  const summary = manifest.dataQualitySummary ?? {};
  const inputQuality = Array.isArray(manifest.inputQuality) ? manifest.inputQuality : [];
  const unavailable = Array.isArray(manifest.unavailableInputs)
    ? manifest.unavailableInputs
    : Array.isArray(summary.unavailableInputs) ? summary.unavailableInputs : [];
  const fallback = Array.isArray(manifest.fallbackInputs)
    ? manifest.fallbackInputs
    : Array.isArray(summary.fallbackInputs) ? summary.fallbackInputs : [];
  const requiredUnavailable = unavailable.filter((inputId: string) => {
    const input = inputQuality.find((candidate: any) => candidate.inputId === inputId);
    return !input || input.required !== false;
  });
  if (manifest.coherenceStatus === "UNAVAILABLE" || requiredUnavailable.length > 0) return "UNAVAILABLE";
  if (unavailable.length > 0) return "PARTIAL";
  if (fallback.length > 0 || manifest.coherenceStatus === "EXPLICIT_MISMATCH") return "DEGRADED";
  if ((summary.staleInputs?.length ?? 0) > 0 || (summary.delayedInputs ?? 0) > 0 || (summary.staticInputs?.length ?? 0) > 0) return "PARTIAL";
  return "HEALTHY";
}

function coherence(manifest: StoredManifest): CanonicalIntelligenceState["provenance"]["coherenceStatus"] {
  if (manifest.coherenceStatus === "COHERENT") return "COHERENT";
  if (manifest.coherenceStatus === "EXPLICIT_MISMATCH") return "DEGRADED";
  return "UNAVAILABLE";
}

export interface CanonicalStateBuildOptions {
  /** Composite Pressure Index of the prior comparable manifest (about a day earlier), if any. */
  priorPressureIndex?: number | null;
}

export function buildCanonicalIntelligenceState(manifest: StoredManifest, options: CanonicalStateBuildOptions = {}): CanonicalIntelligenceState {
  const inputQuality = Array.isArray(manifest.inputQuality) ? manifest.inputQuality : [];
  const stateQuality = quality(manifest);
  const staleInputs = Array.isArray(manifest.staleInputs) ? manifest.staleInputs : [];
  const unavailableInputs = Array.isArray(manifest.unavailableInputs) ? manifest.unavailableInputs : [];
  const fallbackInputs = Array.isArray(manifest.fallbackInputs) ? manifest.fallbackInputs : [];
  const delayedInputs = inputQuality.filter((input: any) => input.freshnessStatus === "DELAYED").map((input: any) => input.inputId);
  const notes = Array.isArray(manifest.coherenceNotes) ? manifest.coherenceNotes : [];
  const inputById = new Map(inputQuality.map((input: any) => [input.inputId, input]));
  const conflicts: CanonicalStateConflict[] = [
    ...notes.map((note: string) => ({
      conflictType: note.startsWith("pressure-score") ? "PRESSURE_MISMATCH" : note.startsWith("regime-") ? "REGIME_MISMATCH" : "TEMPORAL_MISMATCH",
      components: ["champion-v1", "seismograph"], description: note, severity: "HIGH", resolutionStatus: "UNRESOLVED",
    } as CanonicalStateConflict)),
    ...staleInputs.map((inputId: string) => ({ conflictType: "STALE_INPUT", components: [inputId], description: `${inputId} is stale.`, severity: "MEDIUM", resolutionStatus: "UNRESOLVED" } as CanonicalStateConflict)),
    ...unavailableInputs.map((inputId: string) => ({ conflictType: "UNAVAILABLE_INPUT", components: [inputId], description: `${inputId} is unavailable.`, severity: "HIGH", resolutionStatus: "UNRESOLVED" } as CanonicalStateConflict)),
    ...fallbackInputs.map((inputId: string) => {
      const input = inputById.get(inputId) as any;
      const originalSource = input?.originalSource ?? input?.source ?? null;
      const fallbackSource = input?.fallbackSource ?? null;
      const fallbackReason = input?.fallbackReason ?? null;
      return {
        conflictType: "FALLBACK_INPUT",
        components: [inputId],
        description: `${inputId} used a governed fallback${fallbackReason ? `: ${fallbackReason}` : "."}`,
        severity: "MEDIUM",
        resolutionStatus: "UNRESOLVED",
        originalSource,
        fallbackSource,
        fallbackReason,
      } as CanonicalStateConflict;
    }),
  ];
  const engines: CanonicalEngineState[] = Object.entries(manifest.engineValues ?? {}).map(([engineId, value]) => {
    const engineInputs = inputQuality.filter((input: any) => input.contributesTo?.includes(engineId));
    const sourceInputIds = engineInputs.map((input: any) => input.inputId);
    const byStatus = (status: string) => engineInputs.filter((input: any) => String(input.freshnessStatus).toUpperCase() === status).map((input: any) => input.inputId);
    // One definition of stale / delayed / fallback / unavailable (shared/snapshotEvidence.ts).
    // Delayed (publication lag within the allowed age) is reported as DELAYED, not STALE.
    const evidence = engineEvidenceStatus(sourceInputIds, {
      unavailable: [...unavailableInputs, ...byStatus("UNAVAILABLE")],
      stale: [...staleInputs, ...byStatus("STALE")],
      fallback: [...fallbackInputs, ...byStatus("FALLBACK")],
      delayed: [...delayedInputs, ...byStatus("DELAYED")],
    });
    const engineUnavailable = evidence === "UNAVAILABLE";
    const engineStale = evidence === "STALE" || evidence === "DELAYED";
    const engineFallback = evidence === "FALLBACK" || engineInputs.some((input: any) => fallbackInputs.includes(input.inputId) || input.freshnessStatus === "FALLBACK");
    const engineQuality: CanonicalQualityStatus = engineUnavailable ? "UNAVAILABLE" : engineStale ? "PARTIAL" : engineFallback ? "DEGRADED" : stateQuality;
    return {
      engineId, engineName: engineId, value: typeof value === "number" ? value : null, unit: "score_0_to_100",
      classification: null, direction: direction(manifest.engineDirections?.[engineId], engineId), acceleration: null, persistence: null,
      observedAt: null, calculatedAt: manifest.generatedAt ?? null,
      sourceInputIds,
      qualityStatus: engineQuality, freshnessStatus: evidence,
      fallbackStatus: engineFallback ? "ACTIVE" : "NONE", modelVersion: manifest.championVersion,
      calculationVersion: manifest.scoringVersion, contributionToComposite: true,
    };
  });
  return {
    schemaVersion: CANONICAL_STATE_SCHEMA_VERSION, stateId: manifest.stateId, generatedAt: manifest.generatedAt,
    effectiveAt: manifest.generatedAt, calculationStartedAt: null, calculationCompletedAt: manifest.generatedAt,
    championVersion: manifest.championVersion, modelVersion: manifest.modelVersion, scoringVersion: manifest.scoringVersion,
    configurationVersion: manifest.configurationVersion, inputSnapshotId: manifest.inputSnapshotId, stateHash: manifest.stateHash,
    regime: manifest.regime ?? null, pressureIndex: manifest.pressureIndex ?? null, pressureLevel: manifest.regime ?? null,
    // Direction of the composite index versus the prior comparable reading, not of any single vector.
    pressureDirection: compositePressureDirection(manifest.pressureIndex, options.priorPressureIndex), pressureAcceleration: null, pressurePersistence: null,
    engines, domains: manifest.domainValues ?? {}, scenarioOutputs: manifest.scenarioOutputs ?? {},
    probabilityClaimIds: manifest.probabilityClaimIds ?? [], analogClaimIds: manifest.analogClaimIds ?? [],
    historicalContext: {
      canonicalLiveHistory: "intelligenceStateManifests append-only operational snapshots only",
      reconstructedResearch: "reconstructed-champion-v1-2000-2026-research-only",
      historicalAnalogOutput: "governed analog claim references only", patternResolution: "governedResearchResolutions append-only later outcomes",
    },
    dataQualitySummary: manifest.dataQualitySummary ?? {}, confidenceOrEvidenceQuality: stateQuality, staleInputs, delayedInputs,
    unavailableInputs, fallbackInputs, warnings: [...notes, ...staleInputs.map((id: string) => `${id}: stale`), ...unavailableInputs.map((id: string) => `${id}: unavailable`)],
    conflicts, historicalDatasetVersion: manifest.historicalDatasetVersion, researchDatasetVersion: manifest.researchDatasetVersion,
    provenance: { manifestSource: "intelligenceStateManifests", governanceVersion: manifest.configurationVersion, coherenceStatus: coherence(manifest) },
  };
}

export async function getAuthoritativeCanonicalIntelligenceState(): Promise<CanonicalIntelligenceState | null> {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select().from(intelligenceStateManifests).orderBy(desc(intelligenceStateManifests.generatedAt)).limit(1))[0];
  if (!row) return null;
  const manifest = JSON.parse(row.manifestJson);
  const priorPressureIndex = await readPriorPressureIndex(db, row, manifest).catch(() => null);
  return buildCanonicalIntelligenceState(manifest, { priorPressureIndex });
}

/** Composite direction compares against the latest manifest at least this old. */
export const PRIOR_READING_MIN_AGE_MS = 20 * 60 * 60 * 1000;
/** A prior older than this is too far back to call a direction. */
export const PRIOR_READING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Read-only lookup of the prior comparable Pressure Index (same scoring version,
 * 20 h – 7 days earlier) from the append-only manifest table. Null when none exists,
 * in which case direction is Unknown and surfaces show it as unavailable.
 */
export function selectPriorPressureIndex(currentManifest: StoredManifest, prior: StoredManifest | null | undefined): number | null {
  if (!prior) return null;
  if (prior.scoringVersion !== currentManifest.scoringVersion) return null;
  return typeof prior.pressureIndex === "number" && Number.isFinite(prior.pressureIndex) ? prior.pressureIndex : null;
}

async function readPriorPressureIndex(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, row: { generatedAt: Date }, manifest: StoredManifest): Promise<number | null> {
  const current = new Date(row.generatedAt).getTime();
  if (!Number.isFinite(current)) return null;
  const prior = (await db.select().from(intelligenceStateManifests)
    .where(and(
      lte(intelligenceStateManifests.generatedAt, new Date(current - PRIOR_READING_MIN_AGE_MS)),
      gte(intelligenceStateManifests.generatedAt, new Date(current - PRIOR_READING_MAX_AGE_MS)),
    ))
    .orderBy(desc(intelligenceStateManifests.generatedAt)).limit(1))[0];
  return selectPriorPressureIndex(manifest, prior ? JSON.parse(prior.manifestJson) : null);
}

export function toPublicCanonicalIntelligenceState(state: CanonicalIntelligenceState): PublicCanonicalIntelligenceState {
  const { domains: _domains, dataQualitySummary: _quality, ...safe } = state;
  return {
    ...safe,
    dataQualitySummary: {
      status: state.confidenceOrEvidenceQuality, staleInputCount: state.staleInputs.length, delayedInputCount: state.delayedInputs.length,
      unavailableInputCount: state.unavailableInputs.length, fallbackInputCount: state.fallbackInputs.length,
    },
  };
}
