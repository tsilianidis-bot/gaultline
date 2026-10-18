import type { IntelligenceIntegrityStatus, IntelligenceOrigin } from "./intelligenceIntegrity";

/**
 * Phase 1 is deliberately data-only: no event inference, score synthesis, or
 * browser visualization is defined here. The payload is a read-only record of
 * source observations after the provenance gate has evaluated them.
 */
export const INTELLIGENCE_EVIDENCE_METHOD_VERSION = "intelligence-evidence-v1-2026-10-16" as const;

export type EvidenceProviderStatus = "healthy" | "degraded" | "unavailable";
export type EvidenceInterfaceStatus = "CURRENT" | "DEGRADED" | "UNAVAILABLE" | "DISABLED";
export type EvidenceKind = "market_quote" | "macro_release" | "canonical_model" | "crypto_aggregate";
export type EvidenceTemporalStatus = "live" | "delayed" | "completed_session" | "released" | "modeled" | "stale" | "unavailable";
export type IntelligenceEvidenceDomain = "equities" | "bonds_rates" | "credit" | "liquidity" | "volatility" | "crypto";

export interface LastVerifiedEvidence {
  value: number | string;
  observedAt: string;
  provider: string;
  validationStatus: IntelligenceIntegrityStatus;
  reason: string;
}

export interface ValidatedIntelligenceEvidence {
  id: string;
  label: string;
  kind: EvidenceKind;
  provider: string;
  origin: IntelligenceOrigin;
  /** Null when the Integrity Gate rejects the current measurement. */
  value: number | string | null;
  unit: string | null;
  observedAt: string | null;
  receivedAt: string | null;
  maxAgeMs: number;
  /** Canonical Integrity Gate deadline derived server-side from observedAt + maxAgeMs. */
  validUntil: string | null;
  validationStatus: IntelligenceIntegrityStatus;
  supportsCurrentClaim: boolean;
  validationReason: string;
  modelVersion: string | null;
  sourceIdentifier: string;
  /** Source timing is explicit and does not alter the Integrity Gate result. */
  temporalStatus: EvidenceTemporalStatus;
  temporalDetail: string;
  /** A stale or rejected current reading can only be displayed as history. */
  historicalValue: LastVerifiedEvidence | null;
  /** Previously verified reading, retained without changing its source timestamp. */
  lastVerified: LastVerifiedEvidence | null;
}

export interface EvidenceProviderHealth {
  id: "canonical" | "yahoo" | "fred" | "coingecko";
  label: string;
  provider: string;
  status: EvidenceProviderStatus;
  observedAt: string | null;
  checkedAt: string;
  detail: string;
}

/**
 * A domain projection groups existing validated observations. It does not
 * calculate a new score, infer a relationship, or turn unavailable inputs into
 * a neutral market condition.
 */
export interface IntelligenceEvidenceDomainProjection {
  id: IntelligenceEvidenceDomain;
  label: string;
  status: EvidenceProviderStatus;
  observationIds: string[];
  currentObservationIds: string[];
  historicalObservationIds: string[];
  limitation: string | null;
}

export interface IntelligenceEvidenceSnapshot {
  kind: "intelligence-evidence-snapshot";
  methodVersion: typeof INTELLIGENCE_EVIDENCE_METHOD_VERSION;
  capturedAt: string;
  canonicalStateId: string | null;
  observations: ValidatedIntelligenceEvidence[];
  providerHealth: EvidenceProviderHealth[];
  /** Fixed six-domain projection for the future Intelligence Core. */
  domains: IntelligenceEvidenceDomainProjection[];
  limitations: string[];
  persistence: "recorded" | "in_memory_only";
}

export interface IntelligenceEvidenceResponse {
  enabled: boolean;
  status: EvidenceInterfaceStatus;
  snapshot: IntelligenceEvidenceSnapshot | null;
  reason: string | null;
  nextCollectionAt: string | null;
}

export function intelligenceEvidenceDisabledResponse(): IntelligenceEvidenceResponse {
  return {
    enabled: false,
    status: "DISABLED",
    snapshot: null,
    reason: "Verified evidence collection is not enabled in this environment.",
    nextCollectionAt: null,
  };
}
