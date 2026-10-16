/**
 * FAULTLINE intelligence provenance gate.
 * This is a fail-closed, side-effect-free contract for future Intelligence Core consumers.
 * It does not change the Pressure Index or existing production outputs.
 */
export type IntelligenceOrigin = "observed" | "modeled" | "inferred";
export type IntelligenceIntegrityStatus = "verified" | "delayed" | "stale" | "unavailable";

export interface IntelligenceEvidence {
  id: string;
  source: string;
  origin: IntelligenceOrigin;
  value: number | string | null;
  observedAt: string | null;
  receivedAt: string | null;
  maxAgeMs: number;
  sourceHealthy: boolean;
  modelVersion?: string;
  explanation?: string;
}

export interface IntelligenceIntegrityResult {
  status: IntelligenceIntegrityStatus;
  displayValue: number | string | null;
  canSupportCurrentClaim: boolean;
  observedAt: string | null;
  source: string;
  origin: IntelligenceOrigin;
  reason: string;
}

/** Never label an observation live solely because the request or cache refresh is recent. */
export function evaluateIntelligenceEvidence(
  evidence: IntelligenceEvidence,
  nowMs: number = Date.now(),
): IntelligenceIntegrityResult {
  const base = {
    source: evidence.source,
    origin: evidence.origin,
    observedAt: evidence.observedAt,
  };
  const unavailable = (reason: string): IntelligenceIntegrityResult => ({
    ...base,
    status: "unavailable",
    displayValue: null,
    canSupportCurrentClaim: false,
    reason,
  });
  if (!evidence.id.trim() || !evidence.source.trim()) return unavailable("Missing evidence identity or source.");
  if (evidence.value === null || (typeof evidence.value === "number" && !Number.isFinite(evidence.value)))
    return unavailable("Missing or invalid measurement.");
  if (!evidence.observedAt || !evidence.receivedAt) return unavailable("Missing observation or ingestion timestamp.");
  const observed = Date.parse(evidence.observedAt);
  const received = Date.parse(evidence.receivedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(received) ||
      !Number.isFinite(nowMs) || !Number.isFinite(evidence.maxAgeMs) || evidence.maxAgeMs <= 0 ||
      observed > received || received > nowMs + 60_000 || observed > nowMs + 60_000)
    return unavailable("Invalid timestamps or refresh policy.");
  if (evidence.origin === "modeled" && !evidence.modelVersion?.trim())
    return unavailable("Model version required for modeled output.");
  const ageMs = Math.max(0, nowMs - observed);
  if (!evidence.sourceHealthy)
    return { ...base, status: "unavailable", displayValue: evidence.value,
      canSupportCurrentClaim: false, reason: "Source unavailable; last observed value is historical only." };
  if (ageMs > evidence.maxAgeMs)
    return { ...base, status: "stale", displayValue: evidence.value,
      canSupportCurrentClaim: false, reason: "Observation exceeds its declared freshness window." };
  if (evidence.origin !== "observed")
    return { ...base, status: "delayed", displayValue: evidence.value,
      canSupportCurrentClaim: true, reason: "Modeled or inferred interpretation; not directly observed market data." };
  return { ...base, status: "verified", displayValue: evidence.value,
    canSupportCurrentClaim: true, reason: "Valid provenance, timestamps and source health." };
}
