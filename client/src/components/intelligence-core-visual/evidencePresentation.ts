import type { CanonicalIntelligenceState } from "@shared/canonicalIntelligenceState";
import type {
  IntelligenceEvidenceResponse,
  IntelligenceEvidenceSnapshot,
  ValidatedIntelligenceEvidence,
} from "@shared/intelligenceEvidence";
import { adaptIntelligenceCore, createUnavailableCore } from "./adapter";
import type {
  CoreDomain,
  CoreEvidence,
  EvidenceStatus,
  IntelligenceCoreInput,
  IntelligenceCoreViewModel,
} from "./types";

type CanonicalPresentationState = Pick<
  CanonicalIntelligenceState,
  "stateId" | "generatedAt" | "pressureIndex" | "regime"
>;

const DOMAIN_SOURCES: Array<{
  id: CoreDomain["id"];
  projectionId: string | null;
}> = [
  { id: "liquidity", projectionId: "liquidity" },
  { id: "credit", projectionId: "credit" },
  { id: "volatility", projectionId: "volatility" },
  { id: "macro", projectionId: "bonds_rates" },
  // The evidence pipeline has no approved breadth or AI-bubble observation yet.
  { id: "breadth", projectionId: null },
  { id: "ai", projectionId: null },
];

function toVisualStatus(observation: ValidatedIntelligenceEvidence): EvidenceStatus {
  if (observation.validationStatus === "stale") return "stale";
  if (observation.validationStatus === "unavailable" || observation.value === null)
    return "unavailable";
  if (!observation.supportsCurrentClaim) return "degraded";
  if (observation.kind === "canonical_model" || observation.temporalStatus === "modeled")
    return "static";
  if (
    observation.temporalStatus === "delayed" ||
    observation.temporalStatus === "completed_session"
  )
    return "delayed";
  if (observation.temporalStatus === "stale") return "stale";
  if (observation.temporalStatus === "unavailable") return "unavailable";
  return "current";
}

function formatValue(value: ValidatedIntelligenceEvidence["value"], unit: string | null): string | null {
  if (value === null) return null;
  const rendered = typeof value === "number" ? String(value) : value.trim();
  return rendered ? (unit ? `${rendered} ${unit}` : rendered) : null;
}

function toCoreEvidence(observation: ValidatedIntelligenceEvidence): CoreEvidence {
  return {
    id: observation.id,
    label: observation.label,
    source: observation.provider,
    sourceUrl: null,
    observationAt: observation.observedAt,
    status: toVisualStatus(observation),
    value: formatValue(observation.value, observation.unit),
    explanation: `${observation.temporalDetail} ${observation.validationReason}`.trim(),
    admitted: observation.validationStatus !== "unavailable" && observation.value !== null,
    validUntil: observation.validUntil,
  };
}

function domainStatus(observations: CoreEvidence[]): EvidenceStatus {
  if (!observations.length) return "unavailable";
  if (observations.every(item => item.status === "current")) return "current";
  if (observations.some(item => item.status === "stale")) return "stale";
  if (observations.some(item => item.status === "delayed")) return "delayed";
  if (observations.some(item => item.status === "static")) return "static";
  if (observations.some(item => item.status === "degraded")) return "degraded";
  return "unavailable";
}

function toCoreDomains(snapshot: IntelligenceEvidenceSnapshot, evidence: CoreEvidence[]): CoreDomain[] {
  const evidenceById = new Map(evidence.map(item => [item.id, item]));
  return DOMAIN_SOURCES.map(({ id, projectionId }) => {
    const projection = projectionId
      ? snapshot.domains.find(item => item.id === projectionId)
      : undefined;
    const evidenceIds = projection?.observationIds ?? [];
    const domainEvidence = evidenceIds
      .map(itemId => evidenceById.get(itemId))
      .filter((item): item is CoreEvidence => item !== undefined);
    const unavailableByDesign = projectionId === null;
    return {
      id,
      // The visual adapter supplies the fixed public names for each domain.
      label: id,
      status: unavailableByDesign ? "unavailable" : domainStatus(domainEvidence),
      assessment: null,
      direction: "unknown",
      observationAt: domainEvidence
        .map(item => item.observationAt)
        .filter((item): item is string => Boolean(item))
        .sort()
        .at(-1) ?? null,
      evidenceIds: unavailableByDesign ? [] : evidenceIds,
      significance: unavailableByDesign
        ? `No approved ${id === "ai" ? "AI-bubble" : "market-breadth"} evidence is available in the verified Core pipeline.`
        : projection?.limitation ?? "Source evidence is available without an approved domain assessment.",
      context: null,
      developingSince: null,
      historicalComparison: null,
    };
  });
}

function unavailable(reason: string): IntelligenceCoreViewModel {
  return createUnavailableCore(reason);
}

/**
 * Strict presentation boundary for the NOW embed. It does not calculate a score,
 * a regime, a scenario, a relationship, or a historical comparison. It only
 * projects the server-admitted evidence snapshot and withholds the Core-wide
 * central assessment until its complete canonical lineage is available.
 */
export function presentVerifiedEvidenceCore(
  response: IntelligenceEvidenceResponse | null | undefined,
  canonical: CanonicalPresentationState | null | undefined,
): IntelligenceCoreViewModel {
  if (!response?.enabled)
    return unavailable(response?.reason ?? "Verified evidence collection is not enabled in this environment.");
  if (!response.snapshot)
    return unavailable(response.reason ?? "No validated evidence snapshot is available yet.");
  if (!canonical || response.snapshot.canonicalStateId !== canonical.stateId)
    return unavailable("The verified evidence snapshot does not match the current canonical state.");

  const evidence = response.snapshot.observations.map(toCoreEvidence);
  const input: IntelligenceCoreInput = {
    canonicalStateId: canonical.stateId,
    // This is the canonical state observation, not the browser request time.
    observationAt: canonical.generatedAt,
    evaluatedAt: response.snapshot.capturedAt,
    // Direct observations can be current while the full Core assessment is still
    // withheld; never turn partial coverage into a canonical market conclusion.
    integrity: evidence.some(item => item.status === "current") ? "degraded" : "unavailable",
    integrityReason:
      "Direct evidence is shown with source timestamps. The Core-wide Pressure Index, regime, scenarios, relationships, and historical comparison remain withheld until their complete approved lineage is supplied.",
    pressure: { value: null, status: "unavailable", evidenceIds: [] },
    regime: { label: null, evidenceIds: [] },
    overview: null,
    overviewEvidenceIds: [],
    evidence,
    domains: toCoreDomains(response.snapshot, evidence),
    relationships: [],
    scenarios: [],
    emergingStress: [],
    trackRecord: { records: [], metrics: [] },
  };
  return adaptIntelligenceCore(input);
}
