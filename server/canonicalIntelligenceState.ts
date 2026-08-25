import { desc } from "drizzle-orm";
import { intelligenceStateManifests } from "../drizzle/schema";
import { desc } from "drizzle-orm";
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

type StoredManifest = Record<string, any>;

function direction(value: unknown): CanonicalDirection {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "improving" || normalized === "rising") return "Improving";
  if (normalized === "deteriorating" || normalized === "falling") return "Deteriorating";
  if (normalized === "stable") return "Stable";
  return "Unknown";
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

export function buildCanonicalIntelligenceState(manifest: StoredManifest): CanonicalIntelligenceState {
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
    const engineUnavailable = engineInputs.some((input: any) => unavailableInputs.includes(input.inputId) || input.freshnessStatus === "UNAVAILABLE");
    const engineStale = engineInputs.some((input: any) => staleInputs.includes(input.inputId) || delayedInputs.includes(input.inputId) || /STALE|DELAYED/i.test(String(input.freshnessStatus)));
    const engineFallback = engineInputs.some((input: any) => fallbackInputs.includes(input.inputId) || input.freshnessStatus === "FALLBACK");
    const engineQuality: CanonicalQualityStatus = engineUnavailable ? "UNAVAILABLE" : engineStale ? "PARTIAL" : engineFallback ? "DEGRADED" : stateQuality;
    return {
      engineId, engineName: engineId, value: typeof value === "number" ? value : null, unit: "score_0_to_100",
      classification: null, direction: direction(manifest.engineDirections?.[engineId]), acceleration: null, persistence: null,
      observedAt: null, calculatedAt: manifest.generatedAt ?? null,
      sourceInputIds,
      qualityStatus: engineQuality, freshnessStatus: engineUnavailable ? "UNAVAILABLE" : engineStale ? "STALE" : engineFallback ? "FALLBACK" : engineQuality === "HEALTHY" ? "CURRENT" : engineQuality,
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
    pressureDirection: direction(manifest.engineDirections?.["liquidity-stress"]), pressureAcceleration: null, pressurePersistence: null,
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
  return buildCanonicalIntelligenceState(JSON.parse(row.manifestJson));
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
