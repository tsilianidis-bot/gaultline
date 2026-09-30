/**
 * One definition of fallback / stale / delayed / unavailable evidence and of
 * pressure direction, shared by the server's canonical-state builder and every
 * client surface. Display/derivation only: nothing here changes engine scores,
 * weights, thresholds or access.
 *
 *   fallback    — an input is served by a governed fallback source
 *                 (listed in fallbackInputs / fallbackInputCount).
 *   stale       — an input is older than its allowed age (staleInputs).
 *   delayed     — an input is within its allowed age but carries publication lag,
 *                 e.g. monthly FRED series (delayedInputs). Delayed is NOT stale
 *                 and NOT fallback.
 *   unavailable — an input has no usable value (unavailableInputs).
 */
import type { CanonicalDirection } from "./canonicalIntelligenceState";

export interface EvidenceSnapshotLike {
  staleInputs?: readonly string[] | null;
  delayedInputs?: readonly string[] | null;
  fallbackInputs?: readonly string[] | null;
  unavailableInputs?: readonly string[] | null;
  dataQualitySummary?: {
    staleInputCount?: number;
    delayedInputCount?: number;
    fallbackInputCount?: number;
    unavailableInputCount?: number;
  } | null;
}

export interface EvidenceCounts {
  stale: number;
  delayed: number;
  fallback: number;
  unavailable: number;
}

function count(list: readonly string[] | null | undefined, summary: number | undefined): number {
  if (Array.isArray(list)) return list.length;
  return typeof summary === "number" && Number.isFinite(summary) ? summary : 0;
}

/** Counts from the snapshot's input lists (preferred) or its summary counts. */
export function snapshotEvidenceCounts(snapshot: EvidenceSnapshotLike | null | undefined): EvidenceCounts {
  const s = snapshot ?? {};
  const q = s.dataQualitySummary ?? {};
  return {
    stale: count(s.staleInputs, q.staleInputCount),
    delayed: count(s.delayedInputs, q.delayedInputCount),
    fallback: count(s.fallbackInputs, q.fallbackInputCount),
    unavailable: count(s.unavailableInputs, q.unavailableInputCount),
  };
}

export type EngineEvidenceStatus = "UNAVAILABLE" | "STALE" | "FALLBACK" | "DELAYED" | "CURRENT";

/** Per-engine freshness from the same input lists. Priority: unavailable > stale > fallback > delayed > current. */
export function engineEvidenceStatus(
  sourceInputIds: readonly string[],
  lists: { stale?: readonly string[]; delayed?: readonly string[]; fallback?: readonly string[]; unavailable?: readonly string[] },
): EngineEvidenceStatus {
  const has = (list?: readonly string[]) => Boolean(list && sourceInputIds.some(id => list.includes(id)));
  if (has(lists.unavailable)) return "UNAVAILABLE";
  if (has(lists.stale)) return "STALE";
  if (has(lists.fallback)) return "FALLBACK";
  if (has(lists.delayed)) return "DELAYED";
  return "CURRENT";
}

/**
 * Vector trends from the pressure engine describe STRESS: "rising" stress means
 * conditions are deteriorating, "falling" stress means they are improving.
 */
export function stressTrendDirection(value: unknown): CanonicalDirection {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "rising" || normalized === "deteriorating") return "Deteriorating";
  if (normalized === "falling" || normalized === "improving") return "Improving";
  if (normalized === "stable") return "Stable";
  return "Unknown";
}

/**
 * Minimum composite change (index points) that counts as a move. Same rule the
 * seismograph uses for its composite direction (server/seismographEngine.ts
 * computeDirection: ±3 points versus the prior reading).
 */
export const COMPOSITE_DIRECTION_MIN_CHANGE = 3;

/** Direction of the composite Pressure Index versus a prior reading; Unknown without a valid prior. */
export function compositePressureDirection(current: unknown, prior: unknown): CanonicalDirection {
  if (typeof current !== "number" || !Number.isFinite(current)) return "Unknown";
  if (typeof prior !== "number" || !Number.isFinite(prior)) return "Unknown";
  const delta = current - prior;
  if (delta >= COMPOSITE_DIRECTION_MIN_CHANGE) return "Deteriorating";
  if (delta <= -COMPOSITE_DIRECTION_MIN_CHANGE) return "Improving";
  return "Stable";
}

export type DirectionDisplay = "Improving" | "Stable" | "Deteriorating" | "Unavailable";

export function directionDisplay(direction: string | null | undefined): DirectionDisplay {
  if (direction === "Improving" || direction === "Stable" || direction === "Deteriorating") return direction;
  return "Unavailable";
}

/**
 * Per-engine evidence status for a published canonical snapshot, recomputed from
 * the snapshot's own input lists so every surface (and older payloads that
 * reported delayed inputs as STALE) uses the same definition.
 */
export function canonicalEngineEvidence(
  engine: { sourceInputIds?: readonly string[] | null; freshnessStatus?: string | null },
  state: EvidenceSnapshotLike,
): EngineEvidenceStatus | string {
  const status = engineEvidenceStatus(engine.sourceInputIds ?? [], {
    stale: state.staleInputs ?? undefined,
    delayed: state.delayedInputs ?? undefined,
    fallback: state.fallbackInputs ?? undefined,
    unavailable: state.unavailableInputs ?? undefined,
  });
  if (status !== "CURRENT") return status;
  const reported = String(engine.freshnessStatus ?? "").toUpperCase();
  if (reported === "UNAVAILABLE") return "UNAVAILABLE";
  const listsPublished = Array.isArray(state.staleInputs) && Array.isArray(state.delayedInputs) && Array.isArray(state.fallbackInputs);
  // When the snapshot publishes its input lists they are authoritative for freshness;
  // overall evidence quality (PARTIAL / DEGRADED) is reported separately, not as freshness.
  if (listsPublished || !reported || reported === "CURRENT" || reported === "HEALTHY") return "CURRENT";
  return reported;
}
