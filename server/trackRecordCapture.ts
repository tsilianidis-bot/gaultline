/**
 * Read-only bridge from a scheduled Seismograph run to the track record.
 *
 * Both switches default off. The feature flag must be enabled AND
 * TRACK_RECORD_CRON_WRITES must be the string "true". Otherwise this records
 * nothing. It reads the Intelligence Core evidence store and does not write
 * to that store, the collector, or canonical MarketState.
 *
 * Only SCHEDULED_CRON can create a forward-recorded row. Missing, stale,
 * failed, or integrity-gate-failed evidence records nothing.
 */
import { createHash } from "node:crypto";
import type { IntelligenceEvidenceSnapshot, ValidatedIntelligenceEvidence } from "../shared/intelligenceEvidence";
import {
  AccountabilityLedger,
  AccountabilityValidationError,
  PROVENANCE_FORWARD,
  buildScheduledAssessment,
  type EvidenceReference,
} from "../shared/intelligenceAccountability";
import {
  activeStressBenchmarkRegistry as publishedRegistry,
  registryCanonicalJson,
  type StressBenchmarkRegistry,
} from "../shared/stressBenchmarkRegistry";
import { isIntelligenceTrackRecordEnabled, persistAccountabilityAssessment } from "./intelligenceAccountability";
import { IntelligenceEvidenceStore } from "./intelligenceEvidence/store";

export const TRACK_RECORD_CRON_WRITES = "TRACK_RECORD_CRON_WRITES" as const;
export const REQUIRED_VERIFIED_EVIDENCE_IDS = ["quote:SPY", "fred:DGS10", "fred:BAMLH0A0HYM2"] as const;
/** Same freshness window the evidence collector uses before a snapshot is current. */
export const EVIDENCE_SNAPSHOT_MAX_AGE_MS = 20 * 60_000;

export const FORWARD_INVALIDATION_CONDITION = "The recorded regime label is no longer the label stored on this assessment.";

export type TrackRecordCaptureReason =
  | "not_scheduled"
  | "cron_writes_disabled"
  | "flag_disabled"
  | "evidence_missing"
  | "evidence_stale"
  | "evidence_failed"
  | "integrity_gate_failed"
  | "canonical_state_missing"
  | "reconstructed_input"
  | "already_recorded"
  | "database_unavailable"
  | "appended";

export function trackRecordCronWritesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[TRACK_RECORD_CRON_WRITES]?.trim().toLowerCase() === "true";
}

export function evidenceReferenceHash(parts: {
  id: string;
  observedAt: string | null;
  receivedAt: string | null;
  validationStatus: string;
  methodVersion: string;
}): string {
  return createHash("sha256").update(JSON.stringify({
    id: parts.id,
    methodVersion: parts.methodVersion,
    observedAt: parts.observedAt,
    receivedAt: parts.receivedAt,
    validationStatus: parts.validationStatus,
  })).digest("hex");
}

export function hashStressBenchmarkRegistry(registry: Pick<StressBenchmarkRegistry, "versionId" | "events" | "benchmarks">): string {
  return createHash("sha256").update(registryCanonicalJson(registry)).digest("hex");
}

const RECONSTRUCTION = /reconstruct|backfill|historical_reconstruction|proxy_reconstruction|revised_data_reconstruction/i;

export function reconstructionRefusalReason(input: {
  provenance?: string | null;
  historyClass?: string | null;
  reconstructed?: boolean;
  persistence?: string | null;
  summary?: string | null;
}): "reconstructed_input" | null {
  if (input.reconstructed) return "reconstructed_input";
  if (input.provenance && input.provenance !== PROVENANCE_FORWARD) return "reconstructed_input";
  if (input.historyClass && input.historyClass !== "live_verified") return "reconstructed_input";
  if (input.persistence && input.persistence !== "recorded" && RECONSTRUCTION.test(input.persistence)) return "reconstructed_input";
  return null;
}

export function selectVerifiedEvidenceReferences(
  snapshot: IntelligenceEvidenceSnapshot | null,
  nowMs: number,
): { ok: true; canonicalStateId: string; references: EvidenceReference[] } | { ok: false; reason: TrackRecordCaptureReason } {
  if (!snapshot) return { ok: false, reason: "evidence_missing" };
  if (reconstructionRefusalReason({ persistence: snapshot.persistence })) {
    return { ok: false, reason: "reconstructed_input" };
  }
  if (snapshot.persistence !== "recorded") return { ok: false, reason: "evidence_missing" };
  if (!snapshot.canonicalStateId?.trim()) return { ok: false, reason: "canonical_state_missing" };
  const capturedMs = Date.parse(snapshot.capturedAt);
  if (!Number.isFinite(capturedMs) || nowMs - capturedMs > EVIDENCE_SNAPSHOT_MAX_AGE_MS || capturedMs > nowMs + 60_000) {
    return { ok: false, reason: "evidence_stale" };
  }
  const failedProvider = snapshot.providerHealth.some(provider => provider.status === "unavailable" && (provider.id === "yahoo" || provider.id === "fred"));
  if (failedProvider) return { ok: false, reason: "evidence_failed" };
  const byId = new Map(snapshot.observations.map(item => [item.id, item]));
  const references: EvidenceReference[] = [];
  for (const id of REQUIRED_VERIFIED_EVIDENCE_IDS) {
    const observation = byId.get(id);
    const gate = gateFailure(observation);
    if (gate) return { ok: false, reason: gate };
    references.push(toReference(observation!, snapshot.methodVersion));
  }
  return { ok: true, canonicalStateId: snapshot.canonicalStateId, references };
}

function gateFailure(observation: ValidatedIntelligenceEvidence | undefined): TrackRecordCaptureReason | null {
  if (!observation) return "evidence_missing";
  if (observation.validationStatus === "stale") return "evidence_stale";
  if (observation.validationStatus === "unavailable" || observation.value === null) return "integrity_gate_failed";
  if (!observation.supportsCurrentClaim || observation.validationStatus !== "verified") return "integrity_gate_failed";
  return null;
}

function toReference(observation: ValidatedIntelligenceEvidence, methodVersion: string): EvidenceReference {
  const observedAt = observation.observedAt;
  const receivedAt = observation.receivedAt;
  return {
    id: observation.id,
    observedAt,
    receivedAt,
    contentHash: evidenceReferenceHash({
      id: observation.id,
      observedAt,
      receivedAt,
      validationStatus: observation.validationStatus,
      methodVersion,
    }),
  };
}

export async function captureTrackRecordFromScheduledRun(args: {
  run: { trigger?: string | null };
  pressureIndex: number | null;
  regime: string | null;
  generatedAt: string;
  env?: NodeJS.ProcessEnv;
  flagEnabled?: boolean;
  nowMs?: number;
  loadSnapshot?: () => Promise<IntelligenceEvidenceSnapshot | null>;
  registry?: StressBenchmarkRegistry;
  reconstructed?: boolean;
  historyClass?: string | null;
}): Promise<{ recorded: boolean; reason: TrackRecordCaptureReason }> {
  if (args.run?.trigger !== "SCHEDULED_CRON") return { recorded: false, reason: "not_scheduled" };
  if (reconstructionRefusalReason({ reconstructed: args.reconstructed, historyClass: args.historyClass })) {
    console.warn("[TrackRecord] No forward assessment recorded: reconstructed_input");
    return { recorded: false, reason: "reconstructed_input" };
  }
  if (!trackRecordCronWritesEnabled(args.env ?? process.env)) return { recorded: false, reason: "cron_writes_disabled" };
  const enabled = args.flagEnabled ?? await isIntelligenceTrackRecordEnabled();
  if (!enabled) return { recorded: false, reason: "flag_disabled" };
  const snapshot = await (args.loadSnapshot ?? (() => new IntelligenceEvidenceStore().loadLatest()))();
  const selected = selectVerifiedEvidenceReferences(snapshot, args.nowMs ?? Date.now());
  if (!selected.ok) {
    console.warn(`[TrackRecord] No forward assessment recorded: ${selected.reason}`);
    return { recorded: false, reason: selected.reason };
  }
  const registry = args.registry ?? publishedRegistry();
  const contentHash = hashStressBenchmarkRegistry(registry);
  if (contentHash !== registry.contentHash) {
    console.warn("[TrackRecord] No forward assessment recorded: registry_hash_mismatch");
    return { recorded: false, reason: "evidence_failed" };
  }
  try {
    const ledger = new AccountabilityLedger();
    const stored = ledger.recordAssessment(buildScheduledAssessment({
      run: args.run,
      stateId: selected.canonicalStateId,
      generatedAt: args.generatedAt,
      pressureIndex: args.pressureIndex,
      regime: args.regime,
      summary: "Scheduled assessment. Verified evidence references and the canonical state id were recorded. No later outcome is implied.",
      invalidationConditions: [FORWARD_INVALIDATION_CONDITION],
      supportingObservations: [],
      evidence: { availableInputs: selected.references.length, requiredInputs: REQUIRED_VERIFIED_EVIDENCE_IDS.length, unavailableInputs: [] },
      evidenceReferences: selected.references,
      registryVersionId: registry.versionId,
      registryContentHash: contentHash,
    })).assessment;
    const saved = await persistAccountabilityAssessment(stored);
    if (saved.id == null) {
      console.warn("[TrackRecord] No forward assessment recorded: database_unavailable");
      return { recorded: false, reason: "database_unavailable" };
    }
    return { recorded: saved.created, reason: saved.created ? "appended" : "already_recorded" };
  } catch (error) {
    if (error instanceof AccountabilityValidationError && /reconstructed|historical/i.test(error.message)) {
      console.warn("[TrackRecord] No forward assessment recorded: reconstructed_input");
      return { recorded: false, reason: "reconstructed_input" };
    }
    throw error;
  }
}
