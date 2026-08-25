import { createHash } from "node:crypto";
import type { PublicCanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import type { EvidenceClaim, EvidencePacket, EvidenceStrength } from "../shared/evidenceContract";
import {
  CROSS_ENGINE_SYNTHESIS_CONTRACT_VERSION,
  type CrossEngineConfirmation,
  type CrossEngineDivergence,
  type CrossEngineObservation,
  type CrossEngineRelationship,
  type CrossEngineSynthesis,
  type EvidenceIndependence,
  type SynthesisAvailability,
  type SynthesisDirection,
} from "../shared/crossEngineSynthesis";
import { getAuthoritativeCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { buildCanonicalEvidencePacket } from "./evidencePacket";
import { memoryGetJson, memorySetJson } from "./seismographEngine";
import { recordVerifiedInstitutionalEvent, type InstitutionalDirection, type InstitutionalSeverity } from "./institutionalMemory";

export const CROSS_ENGINE_SYNTHESIS_MEMORY_KEY = "cross_engine_synthesis:latest";

function direction(value: string): SynthesisDirection {
  if (value === "Improving") return "IMPROVING";
  if (value === "Deteriorating") return "DETERIORATING";
  if (value === "Stable") return "STABLE";
  return "UNAVAILABLE";
}

function availability(quality: string, freshness: string, value: number | null): SynthesisAvailability {
  if (value === null || quality === "UNAVAILABLE") return "UNAVAILABLE";
  if (/STALE|DELAYED/i.test(freshness)) return "STALE";
  if (quality !== "HEALTHY") return "DEGRADED";
  return "AVAILABLE";
}

function strength(quality: string): EvidenceStrength {
  return quality === "HEALTHY" ? "MODERATE" : "PRELIMINARY";
}

function overlap(a: string[], b: string[]): EvidenceIndependence {
  if (!a.length || !b.length) return "UNKNOWN";
  const shared = a.filter(id => b.includes(id));
  if (!shared.length) return "INDEPENDENT";
  if (shared.length === Math.min(a.length, b.length)) return "HIGHLY_OVERLAPPING";
  return "PARTIALLY_OVERLAPPING";
}

function claimIdsFor(engineId: string, claims: EvidenceClaim[]) {
  return claims.filter(claim => claim.claimId.endsWith(`:engine:${engineId}`)).map(claim => claim.claimId);
}

function stableId(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

function observations(state: PublicCanonicalIntelligenceState, packet: EvidencePacket): CrossEngineObservation[] {
  return state.engines.map(engine => {
    const status = availability(engine.qualityStatus, engine.freshnessStatus, engine.value);
    return {
      engineId: engine.engineId,
      engineName: engine.engineName,
      availability: status,
      observedAt: engine.observedAt ?? engine.calculatedAt,
      freshness: engine.freshnessStatus,
      dataQuality: engine.qualityStatus,
      evidenceStrength: strength(engine.qualityStatus),
      currentState: { value: engine.value, unit: engine.unit, classification: engine.classification },
      previousState: null,
      direction: status === "UNAVAILABLE" ? "UNAVAILABLE" : direction(engine.direction),
      magnitude: null,
      changeRate: null,
      evidenceClaimIds: claimIdsFor(engine.engineId, packet.claims),
      historicalClaimIds: [],
      sourceInputIds: engine.sourceInputIds,
      limitations: [
        ...(status === "UNAVAILABLE" ? ["Engine unavailable; it is not treated as neutral or current evidence."] : []),
        ...(status === "STALE" ? ["Engine stale; it is excluded from current cross-engine confirmation."] : []),
        ...(status === "DEGRADED" ? ["Engine degraded; interpretation is quality-bounded."] : []),
      ],
    };
  });
}

function relationshipsFor(observed: CrossEngineObservation[], state: PublicCanonicalIntelligenceState, previous: CrossEngineSynthesis | null): CrossEngineRelationship[] {
  const usable = observed.filter(item => item.availability === "AVAILABLE" || item.availability === "DEGRADED").filter(item => item.direction !== "STABLE" && item.direction !== "UNAVAILABLE");
  const relationships: CrossEngineRelationship[] = [];
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      const [a, b] = [usable[i], usable[j]];
      const independence = overlap(a.sourceInputIds, b.sourceInputIds);
      const aligned = a.direction === b.direction;
      const participatingEngines = [a.engineId, b.engineId].sort();
      const relationshipId = stableId([state.stateId, participatingEngines, aligned ? "alignment" : "divergence"]);
      const prior = previous?.relationships.find(item => item.participatingEngines.join("|") === participatingEngines.join("|") && item.relationshipType === (aligned ? "ENGINE_DIRECTION_ALIGNMENT" : "ENGINE_DIRECTION_DIVERGENCE"));
      relationships.push({
        relationshipId,
        relationshipType: aligned ? "ENGINE_DIRECTION_ALIGNMENT" : "ENGINE_DIRECTION_DIVERGENCE",
        participatingEngines,
        direction: aligned ? (a.direction === "IMPROVING" ? "ALIGNED_IMPROVING" : "ALIGNED_DETERIORATING") : "DIVERGENT",
        magnitude: null,
        firstObservedAt: prior?.firstObservedAt ?? state.effectiveAt,
        latestObservedAt: state.effectiveAt,
        persistence: prior ? "PERSISTING" : "NEW",
        evidenceClaimIds: [...a.evidenceClaimIds, ...b.evidenceClaimIds],
        dataQuality: state.confidenceOrEvidenceQuality,
        evidenceStrength: state.confidenceOrEvidenceQuality === "HEALTHY" ? "MODERATE" : "PRELIMINARY",
        independence,
        limitations: independence === "INDEPENDENT" ? [] : ["Evidence overlap is documented; this relationship is not independent confirmation."],
      });
    }
  }
  return relationships;
}

export function buildCrossEngineSynthesis(state: PublicCanonicalIntelligenceState, packet: EvidencePacket, previous: CrossEngineSynthesis | null = null): CrossEngineSynthesis {
  if (packet.canonicalState?.stateId !== state.stateId) throw new Error("Phase 5 synthesis packet state does not match canonical state.");
  const engineObservations = observations(state, packet);
  const relationships = relationshipsFor(engineObservations, state, previous);
  const confirmations: CrossEngineConfirmation[] = relationships
    .filter(item => item.relationshipType === "ENGINE_DIRECTION_ALIGNMENT" && item.independence === "INDEPENDENT" && item.evidenceClaimIds.length >= 2)
    .map(item => ({
      confirmationId: stableId([state.stateId, item.relationshipId, "confirmation"]),
      participatingEngines: item.participatingEngines,
      relationshipRule: "same_direction_independent_observations",
      supportingClaimIds: item.evidenceClaimIds,
      independenceAssessment: item.independence,
      confirmationStrength: item.evidenceStrength === "MODERATE" ? "MODERATE" : "LIMITED",
      limitations: item.limitations,
    }));
  const divergences: CrossEngineDivergence[] = relationships
    .filter(item => item.relationshipType === "ENGINE_DIRECTION_DIVERGENCE")
    .map(item => ({
      divergenceId: stableId([state.stateId, item.relationshipId, "divergence"]),
      participatingEngines: item.participatingEngines,
      direction: "DIVERGENT",
      firstObservedAt: item.firstObservedAt,
      latestObservedAt: item.latestObservedAt,
      magnitude: null,
      persistence: item.persistence,
      acceleration: null,
      supportingClaimIds: item.evidenceClaimIds,
      evidenceIndependence: item.independence,
      dataQuality: item.dataQuality,
      limitations: item.limitations,
    }));
  const available = engineObservations.filter(item => item.availability === "AVAILABLE");
  const deteriorating = engineObservations.filter(item => item.direction === "DETERIORATING").map(item => item.engineId);
  const improving = engineObservations.filter(item => item.direction === "IMPROVING").map(item => item.engineId);
  const stable = engineObservations.filter(item => item.direction === "STABLE").map(item => item.engineId);
  const conflicts = divergences.map(item => `Direction conflict: ${item.participatingEngines.join(" vs ")}.`);
  const conclusion = !available.length ? "INSUFFICIENT_CROSS_ENGINE_EVIDENCE" : conflicts.length ? "CONFLICTED" : confirmations.length ? "ALIGNED" : "NO_MATERIAL_CROSS_ENGINE_ALIGNMENT";
  const independentEngineIds = new Set<string>();
  confirmations.forEach(item => item.participatingEngines.forEach(id => independentEngineIds.add(id)));
  const breadth = independentEngineIds.size >= 2 ? "BROAD" : available.length ? "NARROW" : "INSUFFICIENT";
  const limitations = [
    ...state.warnings,
    ...engineObservations.flatMap(item => item.limitations),
    ...(conclusion === "INSUFFICIENT_CROSS_ENGINE_EVIDENCE" ? ["Insufficient available current engine evidence for governed synthesis."] : []),
  ];
  const synthesisId = stableId([CROSS_ENGINE_SYNTHESIS_CONTRACT_VERSION, state.stateId, packet.claims.map(claim => claim.claimId)]);
  const summary = {
    overallSynthesis: conclusion,
    dominantRelationship: confirmations[0]?.confirmationId ?? divergences[0]?.divergenceId ?? null,
    confirmedAlignments: confirmations.map(item => `${item.participatingEngines.join(" + ")} share a governed independent directional relationship.`),
    importantDivergences: divergences.map(item => `${item.participatingEngines.join(" vs ")} are directionally divergent.`),
    whatChanged: previous ? [previous.summary.overallSynthesis === conclusion ? "No material synthesis conclusion change." : `Synthesis conclusion changed from ${previous.summary.overallSynthesis} to ${conclusion}.`] : ["Initial state-locked synthesis generated."],
    conflictingEvidence: conflicts,
    dataQuality: state.confidenceOrEvidenceQuality,
    limitations,
  } as const;
  return {
    contractVersion: CROSS_ENGINE_SYNTHESIS_CONTRACT_VERSION,
    synthesisId,
    originatingStateId: state.stateId,
    originatingEffectiveAt: state.effectiveAt,
    generatedAt: state.generatedAt,
    modelVersion: state.modelVersion,
    configurationVersion: state.configurationVersion,
    inputSnapshotId: state.inputSnapshotId,
    availableEngines: engineObservations.filter(item => item.availability === "AVAILABLE").map(item => item.engineId),
    unavailableEngines: engineObservations.filter(item => item.availability === "UNAVAILABLE").map(item => item.engineId),
    degradedEngines: engineObservations.filter(item => item.availability === "DEGRADED").map(item => item.engineId),
    staleEngines: engineObservations.filter(item => item.availability === "STALE").map(item => item.engineId),
    engineObservations,
    relationships,
    confirmations,
    divergences,
    conflicts,
    improvingDomains: improving,
    deterioratingDomains: deteriorating,
    stableDomains: stable,
    dominantDrivers: [...deteriorating, ...improving].slice(0, 2),
    secondaryDrivers: [...deteriorating, ...improving].slice(2, 5),
    breadthOfEvidence: { participatingEngineCount: available.length, independentEngineCount: independentEngineIds.size, conclusion: breadth },
    independenceOfEvidence: confirmations.length ? "INDEPENDENT" : relationships.some(item => item.independence === "HIGHLY_OVERLAPPING") ? "HIGHLY_OVERLAPPING" : relationships.some(item => item.independence === "PARTIALLY_OVERLAPPING") ? "PARTIALLY_OVERLAPPING" : "UNKNOWN",
    persistence: previous ? "PERSISTING" : "NEW",
    acceleration: null,
    dataQuality: state.confidenceOrEvidenceQuality,
    evidenceStrength: state.confidenceOrEvidenceQuality === "HEALTHY" ? "MODERATE" : "PRELIMINARY",
    limitations: Array.from(new Set(limitations)),
    provenance: { canonicalStateSchemaVersion: state.schemaVersion, evidencePacketContractVersion: packet.contractVersion, deterministic: true },
    supportingClaimIds: packet.claims.map(claim => claim.claimId),
    historicalClaimIds: packet.claims.filter(claim => claim.evidenceClass === "HISTORICAL").map(claim => claim.claimId),
    summary,
  };
}

/** Converts only already-structured synthesis facts into a prompt boundary for AI consumers. */
export function buildCrossEngineSynthesisPromptContract(synthesis: CrossEngineSynthesis | null): string {
  if (!synthesis) return [
    "CROSS-ENGINE SYNTHESIS: unavailable.",
    "Do not infer collective agreement, confirmation, divergence, or system-wide scope from individual engine claims.",
  ].join("\n");
  return [
    "GOVERNED CROSS-ENGINE SYNTHESIS (STRUCTURED FACTS ONLY):",
    `Synthesis ID: ${synthesis.synthesisId}`,
    `Canonical State ID: ${synthesis.originatingStateId}`,
    `Overall conclusion: ${synthesis.summary.overallSynthesis}`,
    `Confirmed alignments: ${synthesis.summary.confirmedAlignments.join(" | ") || "none"}`,
    `Important divergences: ${synthesis.summary.importantDivergences.join(" | ") || "none"}`,
    `Conflicting evidence: ${synthesis.summary.conflictingEvidence.join(" | ") || "none"}`,
    `Unavailable engines: ${synthesis.unavailableEngines.join(", ") || "none"}`,
    `Stale engines: ${synthesis.staleEngines.join(", ") || "none"}`,
    `Limitations: ${synthesis.limitations.join(" | ") || "none"}`,
    "Use only these structured relationships. Do not invent additional cross-engine confirmation, divergence, causality, probability, warning state, or Early Warning conclusion.",
  ].join("\n");
}

export async function getAuthoritativeCrossEngineSynthesis(): Promise<CrossEngineSynthesis | null> {
  const state = await getAuthoritativeCanonicalIntelligenceState();
  if (!state) return null;
  const publicState = toPublicCanonicalIntelligenceState(state);
  return buildCrossEngineSynthesis(publicState, buildCanonicalEvidencePacket(publicState));
}

export async function getLatestCrossEngineSynthesis(): Promise<CrossEngineSynthesis | null> {
  return memoryGetJson<CrossEngineSynthesis | null>(CROSS_ENGINE_SYNTHESIS_MEMORY_KEY, null);
}

function synthesisDirection(synthesis: CrossEngineSynthesis): InstitutionalDirection {
  if (synthesis.deterioratingDomains.length > synthesis.improvingDomains.length) return "deteriorating";
  if (synthesis.improvingDomains.length > synthesis.deterioratingDomains.length) return "improving";
  return "neutral";
}

function synthesisSeverity(synthesis: CrossEngineSynthesis): InstitutionalSeverity {
  if (synthesis.dataQuality === "UNAVAILABLE") return "low";
  if (synthesis.divergences.length || synthesis.confirmations.length >= 2) return "moderate";
  return "info";
}

function relationshipKeys(synthesis: CrossEngineSynthesis) {
  return new Set(synthesis.relationships.map(item => `${item.relationshipType}:${item.participatingEngines.join("|")}`));
}

/**
 * Stores the latest deterministic synthesis for state-to-state comparison and
 * emits only material, append-only archive events. It deliberately has no
 * warning score, lifecycle state, ranking, or promotion behavior.
 */
export async function persistCrossEngineSynthesis(synthesis: CrossEngineSynthesis) {
  const previous = await getLatestCrossEngineSynthesis();
  const state = {
    synthesisId: synthesis.synthesisId,
    originatingStateId: synthesis.originatingStateId,
    conclusion: synthesis.summary.overallSynthesis,
    dominantDrivers: synthesis.dominantDrivers,
    dataQuality: synthesis.dataQuality,
    relationships: synthesis.relationships.map(item => ({ type: item.relationshipType, engines: item.participatingEngines })),
    supportingClaimIds: synthesis.supportingClaimIds,
  };
  const writes: Promise<unknown>[] = [];
  if (previous && previous.originatingStateId !== synthesis.originatingStateId) {
    const previousKeys = relationshipKeys(previous);
    const currentKeys = relationshipKeys(synthesis);
    const emergedDivergences = synthesis.divergences.filter(item => !previousKeys.has(`ENGINE_DIRECTION_DIVERGENCE:${item.participatingEngines.join("|")}`));
    const resolvedDivergences = previous.divergences.filter(item => !currentKeys.has(`ENGINE_DIRECTION_DIVERGENCE:${item.participatingEngines.join("|")}`));
    const changedConclusion = previous.summary.overallSynthesis !== synthesis.summary.overallSynthesis;
    const changedDriver = previous.dominantDrivers.join("|") !== synthesis.dominantDrivers.join("|");
    const qualityDegraded = previous.dataQuality === "HEALTHY" && synthesis.dataQuality !== "HEALTHY";
    const events = [
      ...(changedConclusion ? [{ type: "cross_engine_synthesis_changed", headline: `Cross-engine synthesis changed from ${previous.summary.overallSynthesis} to ${synthesis.summary.overallSynthesis}.`, explanation: "A deterministic, state-locked cross-engine conclusion changed between consecutive canonical states." }] : []),
      ...emergedDivergences.map(item => ({ type: "cross_engine_divergence_emerged", headline: `Cross-engine divergence emerged: ${item.participatingEngines.join(" vs ")}.`, explanation: "A deterministic structured direction divergence emerged; it is not an Early Warning state." })),
      ...resolvedDivergences.map(item => ({ type: "cross_engine_divergence_resolved", headline: `Cross-engine divergence resolved: ${item.participatingEngines.join(" vs ")}.`, explanation: "A previously recorded structured direction divergence is absent in the current canonical synthesis." })),
      ...(changedDriver ? [{ type: "cross_engine_dominant_driver_changed", headline: "Cross-engine dominant driver changed.", explanation: "The deterministic ranked set of observed directional drivers changed between canonical synthesis snapshots." }] : []),
      ...(qualityDegraded ? [{ type: "cross_engine_evidence_quality_degraded", headline: "Cross-engine evidence quality degraded.", explanation: "Current synthesis quality is lower than the prior healthy canonical synthesis; no directional conclusion is inferred from this quality change." }] : []),
    ];
    for (const event of events) {
      writes.push(recordVerifiedInstitutionalEvent({
        eventKey: `cross_engine_synthesis:${synthesis.originatingStateId}:${event.type}:${synthesis.synthesisId}`,
        eventType: event.type,
        sourceEngine: "cross_engine_synthesis",
        entityType: "market",
        severity: synthesisSeverity(synthesis),
        direction: synthesisDirection(synthesis),
        eventAt: new Date(synthesis.generatedAt),
        sourceObservedAt: new Date(synthesis.originatingEffectiveAt),
        dataFreshness: synthesis.dataQuality,
        headline: event.headline,
        explanation: event.explanation,
        previousState: { synthesisId: previous.synthesisId, stateId: previous.originatingStateId, conclusion: previous.summary.overallSynthesis },
        newState: { ...state, historyClass: "live_verified" },
        supportingState: { participatingEngines: synthesis.engineObservations.map(item => item.engineId), supportingClaimIds: synthesis.supportingClaimIds, confirmations: synthesis.confirmations, divergences: synthesis.divergences },
      }));
    }
  }
  await memorySetJson(CROSS_ENGINE_SYNTHESIS_MEMORY_KEY, synthesis, "Latest deterministic Phase 5 cross-engine synthesis");
  const results = await Promise.all(writes);
  return { previousSynthesisId: previous?.synthesisId ?? null, archivedMaterialEventCount: results.length };
}
