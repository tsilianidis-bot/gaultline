import type { CanonicalIntelligenceState } from "@shared/canonicalIntelligenceState";
import type {
  IntelligenceEvidenceResponse,
  IntelligenceEvidenceSnapshot,
  ValidatedIntelligenceEvidence,
} from "@shared/intelligenceEvidence";
import { DOMAIN_VECTOR_ID, adaptIntelligenceCore, createUnavailableCore } from "./adapter";
import {
  DOMAIN_IDS,
  type CoreDomain,
  type CoreEvidence,
  type EvidenceStatus,
  type IntelligenceCoreInput,
  type IntelligenceCoreViewModel,
} from "./types";

type CanonicalPresentationState = Pick<
  CanonicalIntelligenceState,
  "stateId" | "generatedAt" | "pressureIndex" | "regime"
>;

/**
 * Visual node → canonical Pressure vector. Source series are included only when
 * that exact observation is already in the snapshot. CPI, PPI, Fed funds, SOFR
 * and UNRATE are not collected, so those inputs stay unbound. quote:VIX is the
 * Cboe quote and is not an input of the yield-curve vector.
 */
const DOMAIN_SOURCE_SERIES: Record<CoreDomain["id"], readonly string[]> = {
  liquidity: [],
  credit: ["fred:BAMLH0A0HYM2"],
  volatility: ["fred:DGS10", "fred:DGS2"],
  macro: [],
  breadth: [],
  ai: [],
};

function timestampMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSourceTimestampCurrentOrHistorical(value: string | null): boolean {
  const parsed = timestampMs(value);
  return parsed !== null && parsed <= Date.now();
}

function hasUsableValue(value: ValidatedIntelligenceEvidence["value"]): boolean {
  return typeof value === "number" ? Number.isFinite(value) : typeof value === "string" && value.trim().length > 0;
}

function toVisualStatus(observation: ValidatedIntelligenceEvidence): EvidenceStatus {
  if (!hasUsableValue(observation.value)) return "unavailable";
  if (observation.validationStatus === "historical" || observation.temporalStatus === "completed_session") return "unavailable";
  if (observation.validationStatus === "stale") return "stale";
  if (observation.validationStatus === "unavailable" || observation.value === null)
    return "unavailable";
  const validUntil = timestampMs(observation.validUntil);
  if (!isSourceTimestampCurrentOrHistorical(observation.observedAt) || validUntil === null)
    return "unavailable";
  // This must apply to every evidence class, not only live quotes. A cache refresh
  // does not extend a source observation's server-declared validity deadline.
  if (validUntil < Date.now()) return "stale";
  if (observation.kind === "canonical_model" || observation.temporalStatus === "modeled")
    return "static";
  // FRED's dated releases are inspectable evidence, not intraday live market data.
  if (observation.kind === "macro_release" && observation.temporalStatus === "released")
    return "recent";
  if (!observation.supportsCurrentClaim) return "degraded";
  // A current/LIVE visual claim requires the provider to say live, plus the
  // upstream Integrity Gate admission and a non-expired canonical deadline.
  if (observation.validationStatus === "verified" && observation.temporalStatus === "live")
    return "current";
  if (observation.temporalStatus === "delayed") return "delayed";
  if (observation.temporalStatus === "stale") return "stale";
  // New or malformed temporal values are not promoted to a market condition.
  return "unavailable";
}

function formatValue(value: ValidatedIntelligenceEvidence["value"], unit: string | null): string | null {
  if (value === null || !hasUsableValue(value)) return null;
  const rendered = typeof value === "number" ? String(value) : value.trim();
  return rendered ? (unit ? `${rendered} ${unit}` : rendered) : null;
}

function fredSourceUrl(observation: ValidatedIntelligenceEvidence): string | null {
  if (observation.kind !== "macro_release") return null;
  const match = /^fred:([^:]+)$/i.exec(observation.sourceIdentifier.trim());
  return match ? `https://fred.stlouisfed.org/series/${encodeURIComponent(match[1])}` : null;
}

function toCoreEvidence(observation: ValidatedIntelligenceEvidence): CoreEvidence {
  const status = toVisualStatus(observation);
  return {
    id: observation.id,
    label: observation.label,
    source: observation.provider,
    sourceUrl: fredSourceUrl(observation),
    observationAt: observation.observedAt,
    status,
    value: formatValue(observation.value, observation.unit),
    explanation: `${observation.temporalDetail} ${observation.validationReason}`.trim(),
    admitted: status !== "unavailable" && observation.validationStatus !== "unavailable" && hasUsableValue(observation.value),
    validUntil: observation.validUntil,
  };
}

/** A domain cannot look healthy if any of its declared source lineage is unavailable. */
function domainStatus(
  observations: ValidatedIntelligenceEvidence[],
  evidenceById: Map<string, CoreEvidence>,
): EvidenceStatus {
  if (!observations.length) return "unavailable";
  const statuses = observations.map(observation => evidenceById.get(observation.id)?.status ?? "unavailable");
  if (statuses.some(status => status === "unavailable")) return "unavailable";
  if (statuses.every(status => status === "current")) return "current";
  if (statuses.some(status => status === "stale")) return "stale";
  if (statuses.some(status => status === "degraded")) return "degraded";
  if (statuses.some(status => status === "delayed")) return "delayed";
  if (statuses.some(status => status === "recent")) return "recent";
  if (statuses.some(status => status === "static")) return "static";
  return "unavailable";
}

function admittedCurrentSourceObservation(observation: ValidatedIntelligenceEvidence): boolean {
  return (
    observation.validationStatus !== "unavailable" &&
    hasUsableValue(observation.value) &&
    observation.supportsCurrentClaim &&
    isSourceTimestampCurrentOrHistorical(observation.observedAt)
  );
}

function previousObservation(
  observations: ValidatedIntelligenceEvidence[],
  previous: IntelligenceEvidenceSnapshot | null | undefined,
): string | null {
  if (!previous) return null;
  const priorById = new Map(previous.observations.map(observation => [observation.id, observation]));
  const changes: string[] = [];
  for (const current of observations) {
    const prior = priorById.get(current.id);
    if (!prior || !admittedCurrentSourceObservation(prior) || !admittedCurrentSourceObservation(current)) continue;
    if (
      prior.id !== current.id ||
      prior.sourceIdentifier !== current.sourceIdentifier ||
      prior.unit !== current.unit ||
      prior.modelVersion !== current.modelVersion
    ) continue;
    const priorAt = timestampMs(prior.observedAt);
    const currentAt = timestampMs(current.observedAt);
    // A request/capture refresh or a same-timestamp revision is not a later source observation.
    if (priorAt === null || currentAt === null || currentAt <= priorAt) continue;
    const priorValue = formatValue(prior.value, prior.unit);
    const currentValue = formatValue(current.value, current.unit);
    if (!priorValue || !currentValue || !prior.observedAt || !current.observedAt) continue;
    changes.push(
      `${current.id} (${current.sourceIdentifier}): ${priorValue} at ${prior.observedAt} → ${currentValue} at ${current.observedAt}`,
    );
  }
  return changes.length ? changes.join("; ") : null;
}

function domainObservationIds(
  snapshot: IntelligenceEvidenceSnapshot,
  domainId: CoreDomain["id"],
): string[] {
  const present = new Set(snapshot.observations.map(observation => observation.id));
  const modelObservationId = `canonical:${DOMAIN_VECTOR_ID[domainId]}`;
  return [...DOMAIN_SOURCE_SERIES[domainId], modelObservationId].filter(id => present.has(id));
}

function toCoreDomains(
  snapshot: IntelligenceEvidenceSnapshot,
  evidence: CoreEvidence[],
  previous?: IntelligenceEvidenceSnapshot | null,
): CoreDomain[] {
  const evidenceById = new Map(evidence.map(item => [item.id, item]));
  const observationById = new Map(snapshot.observations.map(observation => [observation.id, observation]));
  return DOMAIN_IDS.map(id => {
    const evidenceIds = domainObservationIds(snapshot, id);
    const domainObservations = evidenceIds
      .map(itemId => observationById.get(itemId))
      .filter((item): item is ValidatedIntelligenceEvidence => item !== undefined);
    return {
      id,
      // The visual adapter supplies the fixed public names for each domain.
      label: id,
      status: domainStatus(domainObservations, evidenceById),
      assessment: null,
      direction: "unknown",
      observationAt: domainObservations
        .map(item => item.observedAt)
        .filter((item): item is string => Boolean(item))
        .sort()
        .at(-1) ?? null,
      evidenceIds,
      significance: "Source evidence is available without an approved domain assessment.",
      context: null,
      developingSince: null,
      historicalComparison: null,
      confidence: null,
      confirmationConditions: [],
      invalidationConditions: [],
      pressureContribution: null,
      previousObservation: previousObservation(domainObservations, previous),
    };
  });
}

function unavailable(reason: string): IntelligenceCoreViewModel {
  return createUnavailableCore(reason);
}

function isOlderSnapshotForSameCanonicalState(
  snapshot: IntelligenceEvidenceSnapshot,
  previous: IntelligenceEvidenceSnapshot | null | undefined,
  canonicalStateId: string,
): boolean {
  if (!previous || previous.canonicalStateId !== canonicalStateId || snapshot.canonicalStateId !== canonicalStateId)
    return false;
  const currentCapturedAt = timestampMs(snapshot.capturedAt);
  const previousCapturedAt = timestampMs(previous.capturedAt);
  // An unparsable capture time cannot establish ordering, so the adapter's own
  // timestamp gates remain responsible for withholding malformed evidence.
  return currentCapturedAt !== null && previousCapturedAt !== null && previousCapturedAt > currentCapturedAt;
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
  previous?: IntelligenceEvidenceSnapshot | null,
): IntelligenceCoreViewModel {
  if (!response?.enabled)
    return unavailable(response?.reason ?? "Verified evidence collection is not enabled in this environment.");
  if (!response.snapshot)
    return unavailable(response.reason ?? "No validated evidence snapshot is available yet.");
  if (!canonical || response.snapshot.canonicalStateId !== canonical.stateId)
    return unavailable("The verified evidence snapshot does not match the current canonical state.");
  if (isOlderSnapshotForSameCanonicalState(response.snapshot, previous, canonical.stateId))
    return unavailable("An older verified evidence snapshot cannot replace a newer snapshot for this canonical state.");

  const evidence = response.snapshot.observations.map(toCoreEvidence);
  const domains = toCoreDomains(response.snapshot, evidence, previous);
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
    domains,
    relationships: [],
    scenarios: [],
    emergingStress: [],
    trackRecord: { records: [], metrics: [] },
  };
  const model = adaptIntelligenceCore(input);
  const sourceDomains = new Map(domains.map(domain => [domain.id, domain]));
  // The adapter retains its evidence-lineage gates. These fields make the absence
  // of calibrated confidence, conditions and weights explicit without synthesizing
  // any of them, and expose a prior source observation only after those gates pass.
  return {
    ...model,
    domains: model.domains.map(domain => ({
      ...domain,
      confidence: null,
      confirmationConditions: [],
      invalidationConditions: [],
      pressureContribution: null,
      previousObservation: domain.status === "unavailable"
        ? null
        : sourceDomains.get(domain.id)?.previousObservation ?? null,
    })),
  };
}
