import {
  DOMAIN_IDS,
  type DomainId,
  type IntelligenceCoreViewModel,
} from "./types";

/** A finite, evidence-backed visual delta between two canonical Core snapshots. */
export interface CoreVisualTransition {
  id: string;
  regimeChanged: boolean;
  pressureChanged: boolean;
  admittedDomains: DomainId[];
  expiredDomains: DomainId[];
  relationshipIds: string[];
  summary: string[];
}

const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

type SnapshotTimes = {
  observationAtMs: number;
  evaluatedAtMs: number;
};

type EvidenceIndex = Map<string, IntelligenceCoreViewModel["evidence"][number]>;
type DomainIndex = Map<DomainId, IntelligenceCoreViewModel["domains"][number]>;
type RelationshipIndex = Map<
  string,
  IntelligenceCoreViewModel["relationships"][number]
>;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/* Match the presentation boundary's timestamp rules rather than accepting
 * Date.parse's normalized invalid calendar values. */
function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = RFC3339.exec(value);
  if (!match) return null;

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    zone,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  if (zone !== "Z") {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return null;
  }

  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function snapshotTimes(
  model: IntelligenceCoreViewModel,
  now: number
): SnapshotTimes | null {
  if (!nonEmpty(model.canonicalStateId)) return null;
  const observationAtMs = parseTimestamp(model.observationAt);
  const evaluatedAtMs = parseTimestamp(model.evaluatedAt);
  if (
    observationAtMs === null ||
    evaluatedAtMs === null ||
    observationAtMs > evaluatedAtMs ||
    observationAtMs > now ||
    evaluatedAtMs > now
  )
    return null;
  return { observationAtMs, evaluatedAtMs };
}

function uniqueEvidenceIndex(
  model: IntelligenceCoreViewModel
): EvidenceIndex | null {
  const result: EvidenceIndex = new Map();
  for (const evidence of model.evidence) {
    if (!nonEmpty(evidence.id) || result.has(evidence.id)) return null;
    result.set(evidence.id, evidence);
  }
  return result;
}

function uniqueDomainIndex(
  model: IntelligenceCoreViewModel
): DomainIndex | null {
  const result: DomainIndex = new Map();
  for (const domain of model.domains) {
    if (
      !(DOMAIN_IDS as readonly string[]).includes(domain.id) ||
      result.has(domain.id)
    )
      return null;
    result.set(domain.id, domain);
  }
  return result;
}

function uniqueRelationshipIndex(
  model: IntelligenceCoreViewModel
): RelationshipIndex | null {
  const result: RelationshipIndex = new Map();
  for (const relationship of model.relationships) {
    if (!nonEmpty(relationship.id) || result.has(relationship.id)) return null;
    result.set(relationship.id, relationship);
  }
  return result;
}

function completeReferenceIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ids: string[] = [];
  for (const item of value) {
    if (!nonEmpty(item) || ids.includes(item)) return null;
    ids.push(item);
  }
  return ids;
}

function hasCurrentEvidenceAtEvaluation(
  evidence: IntelligenceCoreViewModel["evidence"][number],
  times: SnapshotTimes
): boolean {
  if (
    evidence.admitted !== true ||
    evidence.status !== "current" ||
    !nonEmpty(evidence.source) ||
    !nonEmpty(evidence.value)
  )
    return false;
  const observationAtMs = parseTimestamp(evidence.observationAt);
  const validUntilMs = parseTimestamp(evidence.validUntil);
  return (
    observationAtMs !== null &&
    validUntilMs !== null &&
    observationAtMs <= times.evaluatedAtMs &&
    validUntilMs >= times.evaluatedAtMs
  );
}

function hasCurrentEvidenceNow(
  evidence: IntelligenceCoreViewModel["evidence"][number],
  times: SnapshotTimes,
  now: number
): boolean {
  if (!hasCurrentEvidenceAtEvaluation(evidence, times)) return false;
  const observationAtMs = parseTimestamp(evidence.observationAt);
  const validUntilMs = parseTimestamp(evidence.validUntil);
  return (
    observationAtMs !== null &&
    validUntilMs !== null &&
    observationAtMs <= now &&
    validUntilMs >= now
  );
}

function currentReferences(
  evidenceIds: unknown,
  evidenceById: EvidenceIndex,
  times: SnapshotTimes,
  now: number
): string[] | null {
  const ids = completeReferenceIds(evidenceIds);
  if (!ids) return null;
  return ids.every(id => {
    const evidence = evidenceById.get(id);
    return (
      evidence !== undefined && hasCurrentEvidenceNow(evidence, times, now)
    );
  })
    ? ids
    : null;
}

function admittedReferences(
  evidenceIds: unknown,
  evidenceById: EvidenceIndex,
  times: SnapshotTimes,
  now: number
): string[] | null {
  const ids = completeReferenceIds(evidenceIds);
  if (!ids) return null;
  return ids.every(id => {
    const evidence = evidenceById.get(id);
    const observationAtMs = evidence
      ? parseTimestamp(evidence.observationAt)
      : null;
    return (
      evidence !== undefined &&
      evidence.admitted === true &&
      evidence.status !== "unavailable" &&
      nonEmpty(evidence.source) &&
      observationAtMs !== null &&
      observationAtMs <= times.evaluatedAtMs &&
      observationAtMs <= now
    );
  })
    ? ids
    : null;
}

function currentDomainReferences(
  domain: IntelligenceCoreViewModel["domains"][number],
  evidenceById: EvidenceIndex,
  times: SnapshotTimes,
  now: number
): string[] | null {
  if (domain.status !== "current") return null;
  return currentReferences(domain.evidenceIds, evidenceById, times, now);
}

function hasForwardChronology(
  previous: SnapshotTimes,
  current: SnapshotTimes
): boolean {
  /* A later canonical evaluation is required; equal observations are allowed
   * because a new admitted source can corroborate the same observation. */
  return (
    current.evaluatedAtMs > previous.evaluatedAtMs &&
    current.observationAtMs >= previous.observationAtMs
  );
}

function hasExpiryChronology(
  previous: SnapshotTimes,
  current: SnapshotTimes
): boolean {
  /* Freshness reevaluation may retain precisely the same canonical snapshot. */
  return (
    current.evaluatedAtMs >= previous.evaluatedAtMs &&
    current.observationAtMs >= previous.observationAtMs
  );
}

function isRegimeCurrent(
  model: IntelligenceCoreViewModel,
  evidenceById: EvidenceIndex,
  times: SnapshotTimes,
  now: number
): boolean {
  return (
    model.integrity === "current" &&
    nonEmpty(model.regime.label) &&
    currentReferences(model.regime.evidenceIds, evidenceById, times, now) !==
      null
  );
}

function isPressureCurrent(
  model: IntelligenceCoreViewModel,
  evidenceById: EvidenceIndex,
  times: SnapshotTimes,
  now: number
): boolean {
  const value = model.pressure.value;
  return (
    model.integrity === "current" &&
    model.pressure.status === "current" &&
    Number.isFinite(value) &&
    value !== null &&
    value >= 0 &&
    value <= 100 &&
    currentReferences(model.pressure.evidenceIds, evidenceById, times, now) !==
      null
  );
}

function isCurrentRelationship(
  relationship: IntelligenceCoreViewModel["relationships"][number],
  evidenceById: EvidenceIndex,
  times: SnapshotTimes,
  now: number
): boolean {
  return (
    nonEmpty(relationship.id) &&
    relationship.supported === true &&
    (DOMAIN_IDS as readonly string[]).includes(relationship.from) &&
    (DOMAIN_IDS as readonly string[]).includes(relationship.to) &&
    (relationship.kind === "association" || relationship.kind === "causal") &&
    nonEmpty(relationship.explanation) &&
    currentReferences(relationship.evidenceIds, evidenceById, times, now) !==
      null
  );
}

function evidenceSignature(ids: string[], evidenceById: EvidenceIndex): string {
  return ids
    .slice()
    .sort()
    .map(id => {
      const evidence = evidenceById.get(id);
      return evidence
        ? [
            evidence.id,
            evidence.status,
            evidence.source,
            evidence.observationAt ?? "",
            evidence.validUntil ?? "",
          ].join("~")
        : `${id}~missing`;
    })
    .join("|");
}

function relationshipSignature(
  relationship: IntelligenceCoreViewModel["relationships"][number],
  evidenceById: EvidenceIndex
): string | null {
  const evidenceIds = completeReferenceIds(relationship.evidenceIds);
  if (!evidenceIds) return null;
  /* Explanation copy is deliberately excluded: wording alone is not a market
   * event. Kind remains the upstream-provided classification. */
  return [
    relationship.from,
    relationship.to,
    relationship.kind,
    evidenceSignature(evidenceIds, evidenceById),
  ].join("^");
}

function updatedDomain(
  previousDomain: IntelligenceCoreViewModel["domains"][number],
  currentDomain: IntelligenceCoreViewModel["domains"][number],
  previousIds: string[],
  currentIds: string[],
  previousEvidence: EvidenceIndex,
  currentEvidence: EvidenceIndex,
  previousTimes: SnapshotTimes,
  currentTimes: SnapshotTimes
): boolean {
  if (currentIds.some(id => !previousIds.includes(id))) return true;

  for (const id of currentIds) {
    const oldEvidence = previousEvidence.get(id);
    const newEvidence = currentEvidence.get(id);
    const oldObservation = oldEvidence
      ? parseTimestamp(oldEvidence.observationAt)
      : null;
    const newObservation = newEvidence
      ? parseTimestamp(newEvidence.observationAt)
      : null;
    if (
      oldObservation !== null &&
      newObservation !== null &&
      oldObservation <= previousTimes.evaluatedAtMs &&
      newObservation <= currentTimes.evaluatedAtMs &&
      newObservation > oldObservation
    )
      return true;
  }

  const oldDomainObservation = parseTimestamp(previousDomain.observationAt);
  const newDomainObservation = parseTimestamp(currentDomain.observationAt);
  return (
    oldDomainObservation !== null &&
    newDomainObservation !== null &&
    oldDomainObservation <= previousTimes.evaluatedAtMs &&
    newDomainObservation <= currentTimes.evaluatedAtMs &&
    newDomainObservation > oldDomainObservation
  );
}

function hasMaterialEvidenceAdvance(
  previousIds: string[],
  currentIds: string[],
  previousEvidence: EvidenceIndex,
  currentEvidence: EvidenceIndex,
  previousTimes: SnapshotTimes,
  currentTimes: SnapshotTimes
): boolean {
  if (currentIds.some(id => !previousIds.includes(id))) return true;
  return currentIds.some(id => {
    const oldEvidence = previousEvidence.get(id);
    const newEvidence = currentEvidence.get(id);
    const oldObservation = oldEvidence
      ? parseTimestamp(oldEvidence.observationAt)
      : null;
    const newObservation = newEvidence
      ? parseTimestamp(newEvidence.observationAt)
      : null;
    return (
      oldObservation !== null &&
      newObservation !== null &&
      oldObservation <= previousTimes.evaluatedAtMs &&
      newObservation <= currentTimes.evaluatedAtMs &&
      newObservation > oldObservation
    );
  });
}

function isExpiredRetainedEvidence(
  previousEvidence: IntelligenceCoreViewModel["evidence"][number],
  currentEvidence: IntelligenceCoreViewModel["evidence"][number],
  previousTimes: SnapshotTimes,
  currentTimes: SnapshotTimes,
  now: number
): boolean {
  if (!hasCurrentEvidenceAtEvaluation(previousEvidence, previousTimes))
    return false;
  if (
    previousEvidence.id !== currentEvidence.id ||
    previousEvidence.source !== currentEvidence.source ||
    parseTimestamp(previousEvidence.observationAt) !==
      parseTimestamp(currentEvidence.observationAt) ||
    parseTimestamp(previousEvidence.validUntil) !==
      parseTimestamp(currentEvidence.validUntil) ||
    currentEvidence.admitted !== true ||
    currentEvidence.status !== "stale" ||
    !nonEmpty(currentEvidence.source)
  )
    return false;
  const currentObservation = parseTimestamp(currentEvidence.observationAt);
  const deadline = parseTimestamp(currentEvidence.validUntil);
  return (
    currentObservation !== null &&
    deadline !== null &&
    currentObservation <= currentTimes.evaluatedAtMs &&
    currentObservation <= now &&
    deadline < now
  );
}

function formatPressure(value: number): string {
  return String(value);
}

function relationshipSummary(
  ids: string[],
  relationships: RelationshipIndex
): string | null {
  if (!ids.length) return null;
  const kinds = ids.map(id => relationships.get(id)?.kind);
  const count = ids.length;
  if (kinds.every(kind => kind === "association"))
    return `${count} newly supported ${count === 1 ? "association" : "associations"}`;
  if (kinds.every(kind => kind === "causal"))
    return `${count} newly supported ${count === 1 ? "causal relationship" : "causal relationships"}`;
  return `${count} newly supported ${count === 1 ? "relationship" : "relationships"}`;
}

function hashSignature(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Compare two already-sanitized models and return only finite, recorded deltas.
 * This function performs no market calculation or inference. It rejects initial,
 * replayed, out-of-order, degraded, incomplete, future-dated, and mixed-mode
 * inputs rather than turning them into animation events.
 */
export function detectCoreVisualTransition(
  previous: IntelligenceCoreViewModel | null,
  current: IntelligenceCoreViewModel
): CoreVisualTransition | null {
  if (!previous || previous.mode !== current.mode) return null;

  const now = Date.now();
  const previousTimes = snapshotTimes(previous, now);
  const currentTimes = snapshotTimes(current, now);
  if (!previousTimes || !currentTimes) return null;

  const previousEvidence = uniqueEvidenceIndex(previous);
  const currentEvidence = uniqueEvidenceIndex(current);
  const previousDomains = uniqueDomainIndex(previous);
  const currentDomains = uniqueDomainIndex(current);
  const previousRelationships = uniqueRelationshipIndex(previous);
  const currentRelationships = uniqueRelationshipIndex(current);
  if (
    !previousEvidence ||
    !currentEvidence ||
    !previousDomains ||
    !currentDomains ||
    !previousRelationships ||
    !currentRelationships
  )
    return null;

  const hasNormalChronology =
    previous.canonicalStateId !== current.canonicalStateId &&
    hasForwardChronology(previousTimes, currentTimes);
  const currentCanRecordChange =
    hasNormalChronology && current.integrity === "current";

  const admittedDomains: DomainId[] = [];
  if (currentCanRecordChange) {
    for (const domainId of DOMAIN_IDS) {
      const currentDomain = currentDomains.get(domainId);
      const previousDomain = previousDomains.get(domainId);
      if (!currentDomain || !previousDomain) continue;
      const currentIds = currentDomainReferences(
        currentDomain,
        currentEvidence,
        currentTimes,
        now
      );
      if (!currentIds) continue;

      if (previousDomain.status !== "current") {
        admittedDomains.push(domainId);
        continue;
      }
      const previousIds = currentDomainReferences(
        previousDomain,
        previousEvidence,
        previousTimes,
        now
      );
      if (!previousIds) continue;
      if (
        updatedDomain(
          previousDomain,
          currentDomain,
          previousIds,
          currentIds,
          previousEvidence,
          currentEvidence,
          previousTimes,
          currentTimes
        )
      )
        admittedDomains.push(domainId);
    }
  }

  const expiredDomains: DomainId[] = [];
  if (
    previous.integrity === "current" &&
    hasExpiryChronology(previousTimes, currentTimes)
  ) {
    for (const domainId of DOMAIN_IDS) {
      const previousDomain = previousDomains.get(domainId);
      const currentDomain = currentDomains.get(domainId);
      if (
        !previousDomain ||
        !currentDomain ||
        previousDomain.status !== "current" ||
        currentDomain.status !== "stale"
      )
        continue;
      const previousIds = completeReferenceIds(previousDomain.evidenceIds);
      const currentIds = admittedReferences(
        currentDomain.evidenceIds,
        currentEvidence,
        currentTimes,
        now
      );
      if (!previousIds || !currentIds) continue;
      const hasOnlyCurrentPriorEvidence = previousIds.every(id => {
        const evidence = previousEvidence.get(id);
        return (
          evidence !== undefined &&
          hasCurrentEvidenceAtEvaluation(evidence, previousTimes)
        );
      });
      if (!hasOnlyCurrentPriorEvidence) continue;

      const expired = previousIds.some(id => {
        if (!currentIds.includes(id)) return false;
        const priorEvidence = previousEvidence.get(id);
        const retainedEvidence = currentEvidence.get(id);
        return (
          priorEvidence !== undefined &&
          retainedEvidence !== undefined &&
          isExpiredRetainedEvidence(
            priorEvidence,
            retainedEvidence,
            previousTimes,
            currentTimes,
            now
          )
        );
      });
      if (expired) expiredDomains.push(domainId);
    }
  }

  let regimeChanged = false;
  let pressureChanged = false;
  const relationshipIds: string[] = [];
  if (currentCanRecordChange && previous.integrity === "current") {
    if (
      isRegimeCurrent(previous, previousEvidence, previousTimes, now) &&
      isRegimeCurrent(current, currentEvidence, currentTimes, now) &&
      previous.regime.label !== current.regime.label &&
      hasMaterialEvidenceAdvance(
        currentReferences(
          previous.regime.evidenceIds,
          previousEvidence,
          previousTimes,
          now
        )!,
        currentReferences(
          current.regime.evidenceIds,
          currentEvidence,
          currentTimes,
          now
        )!,
        previousEvidence,
        currentEvidence,
        previousTimes,
        currentTimes
      )
    )
      regimeChanged = true;

    if (
      isPressureCurrent(previous, previousEvidence, previousTimes, now) &&
      isPressureCurrent(current, currentEvidence, currentTimes, now) &&
      previous.pressure.value !== current.pressure.value &&
      hasMaterialEvidenceAdvance(
        currentReferences(
          previous.pressure.evidenceIds,
          previousEvidence,
          previousTimes,
          now
        )!,
        currentReferences(
          current.pressure.evidenceIds,
          currentEvidence,
          currentTimes,
          now
        )!,
        previousEvidence,
        currentEvidence,
        previousTimes,
        currentTimes
      )
    )
      pressureChanged = true;

    for (const relationship of current.relationships) {
      if (
        !isCurrentRelationship(relationship, currentEvidence, currentTimes, now)
      )
        continue;
      const currentSignature = relationshipSignature(
        relationship,
        currentEvidence
      );
      if (!currentSignature) continue;
      const previousRelationship = previousRelationships.get(relationship.id);
      const previousSignature = previousRelationship
        ? relationshipSignature(previousRelationship, previousEvidence)
        : null;
      if (!previousRelationship || previousSignature !== currentSignature)
        relationshipIds.push(relationship.id);
    }
  }

  if (
    !regimeChanged &&
    !pressureChanged &&
    admittedDomains.length === 0 &&
    expiredDomains.length === 0 &&
    relationshipIds.length === 0
  )
    return null;

  const summary: string[] = [];
  for (const domainId of admittedDomains) {
    const currentDomain = currentDomains.get(domainId)!;
    const previousDomain = previousDomains.get(domainId)!;
    const label = nonEmpty(currentDomain.label)
      ? currentDomain.label
      : domainId;
    summary.push(
      previousDomain.status === "current"
        ? `${label}: new admitted source observation`
        : `${label}: ${previousDomain.status} → current`
    );
  }
  for (const domainId of expiredDomains) {
    const currentDomain = currentDomains.get(domainId)!;
    const label = nonEmpty(currentDomain.label)
      ? currentDomain.label
      : domainId;
    summary.push(`${label} observation expired`);
  }
  if (regimeChanged)
    summary.push(
      `Verified regime changed: ${previous.regime.label} → ${current.regime.label}`
    );
  if (pressureChanged)
    summary.push(
      `Verified pressure changed: ${formatPressure(previous.pressure.value!)} → ${formatPressure(current.pressure.value!)}`
    );
  const relationshipChange = relationshipSummary(
    relationshipIds,
    currentRelationships
  );
  if (relationshipChange) summary.push(relationshipChange);

  const evidenceParts = Array.from(
    new Set([
      ...admittedDomains.flatMap(domainId => {
        const domain = currentDomains.get(domainId)!;
        return completeReferenceIds(domain.evidenceIds) ?? [];
      }),
      ...expiredDomains.flatMap(domainId => {
        const domain = currentDomains.get(domainId)!;
        return completeReferenceIds(domain.evidenceIds) ?? [];
      }),
      ...(regimeChanged
        ? (completeReferenceIds(current.regime.evidenceIds) ?? [])
        : []),
      ...(pressureChanged
        ? (completeReferenceIds(current.pressure.evidenceIds) ?? [])
        : []),
      ...relationshipIds.flatMap(id => {
        const relationship = currentRelationships.get(id)!;
        return completeReferenceIds(relationship.evidenceIds) ?? [];
      }),
    ])
  ).sort();
  const signature = [
    current.mode,
    current.canonicalStateId,
    current.observationAt,
    current.evaluatedAt,
    regimeChanged ? "regime" : "",
    pressureChanged ? "pressure" : "",
    admittedDomains.join(","),
    expiredDomains.join(","),
    relationshipIds.slice().sort().join(","),
    evidenceSignature(evidenceParts, currentEvidence),
  ].join(";");

  return {
    id: `core-transition:${current.canonicalStateId}:${hashSignature(signature)}`,
    regimeChanged,
    pressureChanged,
    admittedDomains,
    expiredDomains,
    relationshipIds,
    summary,
  };
}
