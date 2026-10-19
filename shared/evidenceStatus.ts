/**
 * Customer-facing evidence status. LIVE is allowed only when the observation
 * itself is current and no supplied quality or source status contradicts it.
 * A missing observation is UNAVAILABLE. Receipt of a payload is not enough.
 */
export const EVIDENCE_STATUS_LABELS = ["LIVE", "RECENT", "DELAYED", "STALE", "UNAVAILABLE"] as const;

export type EvidenceStatusLabel = (typeof EVIDENCE_STATUS_LABELS)[number];

export const EVIDENCE_LIVE_MAX_AGE_MS = 20 * 60 * 1000;
export const EVIDENCE_RECENT_MAX_AGE_MS = 18 * 60 * 60 * 1000;

const DEGRADED_SOURCES = new Set(["delayed", "fallback", "degraded", "polygon-prev", "cached"]);
const STALE_SOURCES = new Set(["stale"]);
const UNAVAILABLE_SOURCES = new Set(["unavailable", "error", "missing", "none"]);

export interface EvidenceStatusInput {
  observedAtMs?: number | null;
  nowMs?: number;
  /** Canonical quality such as HEALTHY, DEGRADED, PARTIAL, UNAVAILABLE. Omitted quality cannot verify LIVE. */
  quality?: string | null;
  /** Provider status such as live, healthy, delayed, fallback, stale, unavailable. */
  sourceStatus?: string | null;
  /** When false, the caller has already established that no observation exists. */
  hasObservation?: boolean;
  /**
   * Social caches and other receipt-only feeds cannot be LIVE even when the
   * fetch timestamp is new. They cap at RECENT.
   */
  liveEligible?: boolean;
}

export function evidenceStatusLabel(input: EvidenceStatusInput): EvidenceStatusLabel {
  if (input.hasObservation === false) return "UNAVAILABLE";
  const quality = String(input.quality ?? "").trim().toUpperCase();
  const source = String(input.sourceStatus ?? "").trim().toLowerCase();
  if (quality === "UNAVAILABLE" || UNAVAILABLE_SOURCES.has(source)) return "UNAVAILABLE";
  if (quality === "STALE" || STALE_SOURCES.has(source)) return "STALE";

  const observed = input.observedAtMs;
  const now = input.nowMs ?? Date.now();
  const ageMs = typeof observed === "number" && Number.isFinite(observed)
    ? Math.max(0, now - observed)
    : Number.POSITIVE_INFINITY;
  if (ageMs === Number.POSITIVE_INFINITY) return "UNAVAILABLE";
  if (ageMs > EVIDENCE_RECENT_MAX_AGE_MS) return "STALE";

  const degraded = DEGRADED_SOURCES.has(source)
    || quality === "DEGRADED"
    || quality === "PARTIAL"
    || quality === "FALLBACK";
  if (degraded) return "DELAYED";
  if (ageMs > EVIDENCE_LIVE_MAX_AGE_MS) return "RECENT";
  if (input.liveEligible === false) return "RECENT";
  if (quality !== "" && quality !== "HEALTHY") return "DELAYED";
  if (source !== "" && source !== "live" && source !== "healthy") return "DELAYED";
  if (quality === "" && source === "") return "RECENT";
  return "LIVE";
}

const RANK: Record<EvidenceStatusLabel, number> = {
  LIVE: 0,
  RECENT: 1,
  DELAYED: 2,
  STALE: 3,
  UNAVAILABLE: 4,
};

/** The least-fresh status in the set. An empty set is UNAVAILABLE. */
export function worstEvidenceStatus(labels: EvidenceStatusLabel[]): EvidenceStatusLabel {
  if (labels.length === 0) return "UNAVAILABLE";
  return labels.reduce((worst, label) => RANK[label] > RANK[worst] ? label : worst, "LIVE" as EvidenceStatusLabel);
}

/** Map the canonical customer integrity chip onto the five evidence statuses. */
export function evidenceStatusFromIntegrity(label: string | null | undefined): EvidenceStatusLabel {
  switch (String(label ?? "").toUpperCase()) {
    case "LIVE": return "LIVE";
    case "CACHED": return "RECENT";
    case "DELAYED": return "DELAYED";
    case "FALLBACK": return "DELAYED";
    case "STALE": return "STALE";
    default: return "UNAVAILABLE";
  }
}

/**
 * A provider failure counter is not an observation time. Missing stats are
 * UNAVAILABLE. A clean counter is RECENT. Failures degrade from there.
 */
export function evidenceStatusFromFailureStats(stats?: { total?: number; failures?: number } | null): EvidenceStatusLabel {
  if (!stats || !stats.total || stats.total <= 0) return "UNAVAILABLE";
  const failures = stats.failures ?? 0;
  if (failures / stats.total >= 0.2) return "STALE";
  if (failures > 0) return "DELAYED";
  return "RECENT";
}

export function evidenceStatusBadgeColor(label: EvidenceStatusLabel): "green" | "amber" | "gray" {
  if (label === "LIVE") return "green";
  if (label === "UNAVAILABLE" || label === "STALE") return "gray";
  return "amber";
}
