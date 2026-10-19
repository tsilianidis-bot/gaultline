import {
  DOMAIN_IDS,
  type CoreAssessmentRecord,
  type CoreDomain,
  type CoreEvidence,
  type CorePerformanceMetric,
  type CoreRelationship,
  type CoreScenario,
  type Direction,
  type DomainId,
  type EvidenceStatus,
  type IntelligenceCoreInput,
  type IntelligenceCoreViewModel,
  type ScenarioId,
} from "./types";

/** Fixed UI labels prevent an upstream payload from redefining the topology. */
export const DOMAIN_LABELS: Record<DomainId, string> = {
  liquidity: "Liquidity Stress",
  credit: "Credit Contagion",
  volatility: "Volatility Regime",
  macro: "Macro Sensitivity",
  breadth: "Market Breadth",
  ai: "AI Bubble Risk",
};

/** Educational copy only: these are descriptions of the topology, not market calls. */
const EMPTY_DOMAIN_SIGNIFICANCE: Record<DomainId, string> = {
  liquidity:
    "Educational domain: monitors funding and market-liquidity conditions; no admitted market observation is available.",
  credit:
    "Educational domain: monitors credit transmission and contagion conditions; no admitted market observation is available.",
  volatility:
    "Educational domain: monitors volatility-regime conditions; no admitted market observation is available.",
  macro:
    "Educational domain: monitors macro sensitivity; no admitted market observation is available.",
  breadth:
    "Educational domain: monitors market participation and breadth; no admitted market observation is available.",
  ai: "Educational domain: monitors AI-bubble risk conditions; no admitted market observation is available.",
};

const EVIDENCE_STATUSES = new Set<EvidenceStatus>([
  "current",
  "delayed",
  "recent",
  "stale",
  "static",
  "degraded",
  "unavailable",
]);
const DIRECTIONS = new Set<Direction>([
  "rising",
  "falling",
  "stable",
  "unknown",
]);
const SCENARIO_IDS = ["A", "B", "C"] as const;
const SCENARIO_STATUSES = new Set<CoreScenario["status"]>([
  "favored",
  "conditional",
  "unsupported",
]);
const RELATIONSHIP_KINDS = new Set<CoreRelationship["kind"]>([
  "association",
  "causal",
]);
const RECORD_CLASSIFICATIONS = new Set<CoreAssessmentRecord["classification"]>([
  "forward_recorded",
  "reconstructed",
]);
const RECORD_OUTCOMES = new Set<CoreAssessmentRecord["outcome"]>([
  "supported",
  "contradicted",
  "unresolved",
]);
const METRIC_COHORTS = new Set<CorePerformanceMetric["cohort"]>([
  "forward_recorded",
  "reconstructed",
]);

/* RFC 3339 timestamps are required at this boundary. Date.parse alone normalizes
 * values such as February 30th, so validate calendar fields before parsing. */
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

type EvidenceIndex = Map<string, CoreEvidence>;
type EvidenceLineage = { ids: string[]; complete: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isDomainId(value: unknown): value is DomainId {
  return (
    typeof value === "string" &&
    (DOMAIN_IDS as readonly string[]).includes(value)
  );
}

function isEvidenceStatus(value: unknown): value is EvidenceStatus {
  return (
    typeof value === "string" && EVIDENCE_STATUSES.has(value as EvidenceStatus)
  );
}

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

function validObservedAt(value: unknown, evaluatedAtMs: number): boolean {
  const timestamp = parseTimestamp(value);
  return timestamp !== null && timestamp <= evaluatedAtMs;
}

function isCurrentEvidenceUsable(
  evidence: CoreEvidence,
  evaluatedAtMs: number
): boolean {
  if (evidence.status !== "current" || evidence.admitted !== true) return false;
  const observationAtMs = parseTimestamp(evidence.observationAt);
  const validUntilMs = parseTimestamp(evidence.validUntil);
  const now = Date.now();
  return (
    nonEmptyText(evidence.source) !== null &&
    nonEmptyText(evidence.value) !== null &&
    observationAtMs !== null &&
    observationAtMs <= evaluatedAtMs &&
    observationAtMs <= now &&
    validUntilMs !== null &&
    validUntilMs >= evaluatedAtMs &&
    validUntilMs >= now
  );
}

function isUsableEvidence(evidence: CoreEvidence): boolean {
  return evidence.admitted === true && evidence.status !== "unavailable";
}

/**
 * Return a stable, safe empty model. This is deliberately production-mode: the
 * production presentation must never introduce example data on its own.
 */
export function createUnavailableCore(
  reason = "Canonical intelligence data is unavailable."
): IntelligenceCoreViewModel {
  return {
    canonicalStateId: null,
    observationAt: null,
    evaluatedAt: "",
    integrity: "unavailable",
    integrityReason:
      nonEmptyText(reason) ?? "Canonical intelligence data is unavailable.",
    pressure: { value: null, status: "unavailable", evidenceIds: [] },
    regime: { label: null, evidenceIds: [] },
    overview: null,
    overviewEvidenceIds: [],
    evidence: [],
    domains: DOMAIN_IDS.map(id => unavailableDomain(id)),
    relationships: [],
    scenarios: SCENARIO_IDS.map(id => unavailableScenario(id)),
    emergingStress: [],
    trackRecord: { records: [], metrics: [] },
    mode: "production",
    animateVerifiedChange: false,
  };
}

function unavailableDomain(id: DomainId): CoreDomain {
  return {
    id,
    label: DOMAIN_LABELS[id],
    status: "unavailable",
    assessment: null,
    direction: "unknown",
    observationAt: null,
    evidenceIds: [],
    significance: EMPTY_DOMAIN_SIGNIFICANCE[id],
    context: null,
    developingSince: null,
    historicalComparison: null,
  };
}

function unavailableScenario(id: ScenarioId): CoreScenario {
  return {
    id,
    title: `Scenario ${id}`,
    status: "unsupported",
    summary: null,
    conditions: [],
    invalidations: [],
    evidenceIds: [],
    domainIds: [],
  };
}

function sanitizeEvidence(
  rawEvidence: unknown,
  evaluatedAtMs: number
): CoreEvidence[] {
  if (!Array.isArray(rawEvidence)) return [];

  const candidates: CoreEvidence[] = [];
  for (const raw of rawEvidence) {
    if (!isRecord(raw)) continue;
    const id = nonEmptyText(raw.id);
    const rawStatus = raw.status;
    if (!id || raw.admitted !== true || !isEvidenceStatus(rawStatus)) continue;
    let status: EvidenceStatus = rawStatus;

    const observationAt =
      raw.observationAt === null ? null : stringOrNull(raw.observationAt);
    const validUntil =
      raw.validUntil === null ? null : stringOrNull(raw.validUntil);
    if (
      raw.observationAt !== null &&
      (!observationAt || !validObservedAt(observationAt, evaluatedAtMs))
    )
      continue;
    if (
      raw.validUntil !== null &&
      (!validUntil || parseTimestamp(validUntil) === null)
    )
      continue;
    const source = nonEmptyText(raw.source);
    if (!source) continue;

    // Current evidence missing material provenance/value fields is not useful in a
    // current claim. Do not silently substitute a generic source label.
    if (
      status === "current" &&
      (!observationAt || !validUntil || !nonEmptyText(raw.value))
    )
      continue;

    // Recent is historical-only at this boundary. It needs an actual observation
    // timestamp so an unanchored payload cannot be made to look recently observed.
    if (status === "recent" && !observationAt) continue;

    // A canonical deadline is a freshness boundary, never a refresh policy this
    // view invents. Expired current, delayed, recent, and static/model records
    // remain inspectable as stale history and cannot retain a live/model-recent
    // presentation after their supplied deadline.
    const validUntilMs = validUntil ? parseTimestamp(validUntil) : null;
    if (
      validUntilMs !== null &&
      validUntilMs < Date.now() &&
      (status === "current" ||
        status === "delayed" ||
        status === "recent" ||
        status === "static")
    )
      status = "stale";

    const evidence: CoreEvidence = {
      id,
      label: nonEmptyText(raw.label) ?? id,
      source,
      sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : null,
      observationAt,
      status,
      value: typeof raw.value === "string" ? raw.value : null,
      explanation: typeof raw.explanation === "string" ? raw.explanation : "",
      admitted: true,
      validUntil,
    };

    // A current claim requires an observation, source and value, plus a deadline
    // valid both at canonical evaluation and at the actual presentation time.
    if (
      status === "current" &&
      !isCurrentEvidenceUsable(evidence, evaluatedAtMs)
    )
      continue;
    candidates.push(evidence);
  }

  // Ambiguous duplicate identifiers cannot prove lineage at a presentation boundary.
  const counts = new Map<string, number>();
  for (const evidence of candidates)
    counts.set(evidence.id, (counts.get(evidence.id) ?? 0) + 1);
  return candidates.filter(evidence => counts.get(evidence.id) === 1);
}

function evidenceLineage(
  value: unknown,
  evidenceById: EvidenceIndex
): EvidenceLineage {
  if (!Array.isArray(value) || value.length === 0)
    return { ids: [], complete: false };
  const supplied: string[] = [];
  for (const item of value) {
    const id = nonEmptyText(item);
    if (!id) return { ids: [], complete: false };
    supplied.push(id);
  }
  const ids = Array.from(new Set(supplied));
  const complete = ids.length > 0 && ids.every(id => evidenceById.has(id));
  return { ids: complete ? ids : [], complete };
}

function hasEvidenceWithStatus(
  ids: string[],
  evidenceById: EvidenceIndex,
  status: EvidenceStatus
): boolean {
  return ids.some(id => evidenceById.get(id)?.status === status);
}

function allEvidenceHaveStatus(
  ids: string[],
  evidenceById: EvidenceIndex,
  status: EvidenceStatus
): boolean {
  return (
    ids.length > 0 && ids.every(id => evidenceById.get(id)?.status === status)
  );
}

function hasUsableEvidence(
  ids: string[],
  evidenceById: EvidenceIndex
): boolean {
  return ids.some(id => {
    const evidence = evidenceById.get(id);
    return evidence !== undefined && isUsableEvidence(evidence);
  });
}

function allEvidenceAreExpiredStale(
  ids: string[],
  evidenceById: EvidenceIndex
): boolean {
  const now = Date.now();
  return (
    ids.length > 0 &&
    ids.every(id => {
      const source = evidenceById.get(id);
      const observed = source ? parseTimestamp(source.observationAt) : null;
      const deadline = source ? parseTimestamp(source.validUntil) : null;
      return (
        source?.admitted === true &&
        source.status === "stale" &&
        observed !== null &&
        deadline !== null &&
        deadline >= observed &&
        deadline < now
      );
    })
  );
}

function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const text = nonEmptyText(item);
    return text ? [text] : [];
  });
}

/**
 * Domain-detail copy is canonical metadata, never a calculation or an inferred
 * claim. Keep only bounded strings and unique bounded strings from a complete,
 * admitted domain lineage; numbers and arbitrary objects cannot become labels.
 */
function cleanDomainDetailText(value: unknown): string | null {
  const text = nonEmptyText(value);
  return text && text.length <= 500 ? text : null;
}

function cleanDomainDetailList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const details: string[] = [];
  for (const item of value) {
    const text = cleanDomainDetailText(item);
    if (text && !details.includes(text) && details.length < 12)
      details.push(text);
  }
  return details;
}

function cleanDomainIds(value: unknown): DomainId[] {
  if (!Array.isArray(value)) return [];
  const ids: DomainId[] = [];
  for (const item of value) {
    if (isDomainId(item) && !ids.includes(item)) ids.push(item);
  }
  return ids;
}

function sourceStatusForDomain(
  status: EvidenceStatus,
  lineage: EvidenceLineage,
  evidenceById: EvidenceIndex
): EvidenceStatus {
  if (!lineage.complete || !hasUsableEvidence(lineage.ids, evidenceById))
    return "unavailable";
  if (status === "current") {
    if (allEvidenceHaveStatus(lineage.ids, evidenceById, "current"))
      return "current";
    // Preserve inspectable history only for complete, admitted, actually elapsed
    // source deadlines. This never restores a current assessment or direction.
    return allEvidenceAreExpiredStale(lineage.ids, evidenceById)
      ? "stale"
      : "unavailable";
  }
  if (status === "unavailable") return "unavailable";
  // Do not promote delayed, recent, stale, static, or degraded upstream statuses.
  if (hasEvidenceWithStatus(lineage.ids, evidenceById, status)) return status;
  // A supplied freshness deadline may retire a delayed/recent/static record to
  // stale history. It must not continue to render as delayed, recent, or model.
  if (
    (status === "delayed" || status === "recent" || status === "static") &&
    allEvidenceAreExpiredStale(lineage.ids, evidenceById)
  )
    return "stale";
  return "unavailable";
}

function qualifiedHistorical(
  status: EvidenceStatus,
  label: string,
  value: unknown
): string | null {
  const text = nonEmptyText(value);
  return text ? `Historical ${label} (${status}): ${text}` : null;
}

function sanitizeDomains(
  rawDomains: unknown,
  evidenceById: EvidenceIndex,
  evaluatedAtMs: number
): CoreDomain[] {
  const candidates = new Map<DomainId, Record<string, unknown>>();
  const duplicateIds = new Set<DomainId>();
  if (Array.isArray(rawDomains)) {
    for (const raw of rawDomains) {
      if (!isRecord(raw) || !isDomainId(raw.id)) continue;
      if (candidates.has(raw.id)) {
        duplicateIds.add(raw.id);
      } else {
        candidates.set(raw.id, raw);
      }
    }
  }

  return DOMAIN_IDS.map(id => {
    const raw = candidates.get(id);
    if (!raw || duplicateIds.has(id) || !isEvidenceStatus(raw.status))
      return unavailableDomain(id);

    const lineage = evidenceLineage(raw.evidenceIds, evidenceById);
    const status = sourceStatusForDomain(raw.status, lineage, evidenceById);
    if (status === "unavailable") return unavailableDomain(id);

    const observationAt =
      typeof raw.observationAt === "string" &&
      validObservedAt(raw.observationAt, evaluatedAtMs)
        ? raw.observationAt
        : null;
    const significance =
      nonEmptyText(raw.significance) ??
      "Evidence status is explicitly non-current.";
    // These are retained only after the domain's complete admitted lineage has
    // survived above. They never restore a non-current assessment or direction.
    const confidence = cleanDomainDetailText(raw.confidence);
    const confirmationConditions = cleanDomainDetailList(
      raw.confirmationConditions
    );
    const invalidationConditions = cleanDomainDetailList(
      raw.invalidationConditions
    );
    const pressureContribution = cleanDomainDetailText(
      raw.pressureContribution
    );
    const previousObservation = cleanDomainDetailText(raw.previousObservation);

    if (status !== "current") {
      return {
        id,
        label: DOMAIN_LABELS[id],
        status,
        assessment: null,
        direction: "unknown",
        observationAt,
        evidenceIds: lineage.ids,
        significance,
        context: qualifiedHistorical(status, "context", raw.context),
        developingSince: null,
        historicalComparison: qualifiedHistorical(
          status,
          "comparison",
          raw.historicalComparison
        ),
        confidence,
        confirmationConditions,
        invalidationConditions,
        pressureContribution,
        previousObservation,
      };
    }

    const direction = DIRECTIONS.has(raw.direction as Direction)
      ? (raw.direction as Direction)
      : "unknown";
    const developingSince =
      typeof raw.developingSince === "string" &&
      validObservedAt(raw.developingSince, evaluatedAtMs)
        ? raw.developingSince
        : null;
    return {
      id,
      label: DOMAIN_LABELS[id],
      status,
      assessment: stringOrNull(raw.assessment),
      direction,
      observationAt,
      evidenceIds: lineage.ids,
      significance,
      context: stringOrNull(raw.context),
      developingSince,
      historicalComparison: qualifiedHistorical(
        status,
        "comparison",
        raw.historicalComparison
      ),
      confidence,
      confirmationConditions,
      invalidationConditions,
      pressureContribution,
      previousObservation,
    };
  });
}

function sanitizeRelationships(
  rawRelationships: unknown,
  evidenceById: EvidenceIndex
): CoreRelationship[] {
  if (!Array.isArray(rawRelationships)) return [];
  const relationships: CoreRelationship[] = [];
  const seen = new Set<string>();
  for (const raw of rawRelationships) {
    if (!isRecord(raw)) continue;
    const id = nonEmptyText(raw.id);
    const explanation = nonEmptyText(raw.explanation);
    if (
      !id ||
      seen.has(id) ||
      raw.supported !== true ||
      !isDomainId(raw.from) ||
      !isDomainId(raw.to) ||
      !RELATIONSHIP_KINDS.has(raw.kind as CoreRelationship["kind"]) ||
      !explanation
    )
      continue;
    const lineage = evidenceLineage(raw.evidenceIds, evidenceById);
    if (!lineage.complete || !hasUsableEvidence(lineage.ids, evidenceById))
      continue;
    seen.add(id);
    relationships.push({
      id,
      from: raw.from,
      to: raw.to,
      kind: raw.kind as CoreRelationship["kind"],
      explanation,
      evidenceIds: lineage.ids,
      supported: true,
    });
  }
  return relationships;
}

function sanitizeScenarios(
  rawScenarios: unknown,
  evidenceById: EvidenceIndex
): CoreScenario[] {
  const candidates = new Map<ScenarioId, Record<string, unknown>>();
  const duplicates = new Set<ScenarioId>();
  if (Array.isArray(rawScenarios)) {
    for (const raw of rawScenarios) {
      if (!isRecord(raw) || !SCENARIO_IDS.includes(raw.id as ScenarioId))
        continue;
      const id = raw.id as ScenarioId;
      if (candidates.has(id)) duplicates.add(id);
      else candidates.set(id, raw);
    }
  }

  return SCENARIO_IDS.map(id => {
    const raw = candidates.get(id);
    if (
      !raw ||
      duplicates.has(id) ||
      !SCENARIO_STATUSES.has(raw.status as CoreScenario["status"])
    )
      return unavailableScenario(id);
    const lineage = evidenceLineage(raw.evidenceIds, evidenceById);
    if (!lineage.complete || !hasUsableEvidence(lineage.ids, evidenceById))
      return unavailableScenario(id);

    const sourceStatus = raw.status as CoreScenario["status"];
    // C is deliberately a conditional stress case, never a favored forecast.
    const status: CoreScenario["status"] =
      id === "C"
        ? sourceStatus === "unsupported"
          ? "unsupported"
          : "conditional"
        : sourceStatus === "favored" &&
            !allEvidenceHaveStatus(lineage.ids, evidenceById, "current")
          ? "conditional"
          : sourceStatus;
    const supported = status !== "unsupported";
    if (!supported) return unavailableScenario(id);

    return {
      id,
      title: nonEmptyText(raw.title) ?? `Scenario ${id}`,
      status,
      summary: stringOrNull(raw.summary),
      conditions: cleanStringList(raw.conditions),
      invalidations: cleanStringList(raw.invalidations),
      evidenceIds: lineage.ids,
      domainIds: cleanDomainIds(raw.domainIds),
    };
  });
}

function sanitizeEmergingStress(
  rawEmergingStress: unknown,
  evidenceById: EvidenceIndex,
  integrity: EvidenceStatus
): IntelligenceCoreInput["emergingStress"] {
  if (!Array.isArray(rawEmergingStress)) return [];
  const result: IntelligenceCoreInput["emergingStress"] = [];
  const seen = new Set<string>();
  for (const raw of rawEmergingStress) {
    if (!isRecord(raw)) continue;
    const id = nonEmptyText(raw.id);
    const statement = nonEmptyText(raw.statement);
    if (!id || !statement || seen.has(id)) continue;
    const lineage = evidenceLineage(raw.evidenceIds, evidenceById);
    if (
      integrity !== "current" ||
      !lineage.complete ||
      !allEvidenceHaveStatus(lineage.ids, evidenceById, "current")
    )
      continue;
    seen.add(id);
    result.push({
      id,
      statement,
      evidenceIds: lineage.ids,
      domainIds: cleanDomainIds(raw.domainIds),
    });
  }
  return result;
}

function sanitizeTrackRecords(
  rawTrackRecord: unknown,
  evidenceById: EvidenceIndex,
  evaluatedAtMs: number
): IntelligenceCoreInput["trackRecord"] {
  const empty: IntelligenceCoreInput["trackRecord"] = {
    records: [],
    metrics: [],
  };
  if (!isRecord(rawTrackRecord)) return empty;

  const records: CoreAssessmentRecord[] = [];
  const recordIds = new Set<string>();
  if (Array.isArray(rawTrackRecord.records)) {
    for (const raw of rawTrackRecord.records) {
      if (!isRecord(raw)) continue;
      const id = nonEmptyText(raw.id);
      const summary = nonEmptyText(raw.summary);
      const classification =
        raw.classification as CoreAssessmentRecord["classification"];
      const outcome = raw.outcome as CoreAssessmentRecord["outcome"];
      if (
        !id ||
        !summary ||
        recordIds.has(id) ||
        raw.example === true ||
        !RECORD_CLASSIFICATIONS.has(classification) ||
        !RECORD_OUTCOMES.has(outcome) ||
        typeof raw.assessmentAt !== "string" ||
        !validObservedAt(raw.assessmentAt, evaluatedAtMs)
      )
        continue;
      const lineage = evidenceLineage(raw.evidenceIds, evidenceById);
      if (!lineage.complete || !hasUsableEvidence(lineage.ids, evidenceById))
        continue;
      recordIds.add(id);
      records.push({
        id,
        assessmentAt: raw.assessmentAt,
        classification,
        outcome,
        summary,
        evidenceIds: lineage.ids,
        example: false,
      });
    }
  }

  const metrics: CorePerformanceMetric[] = [];
  const metricIds = new Set<string>();
  if (Array.isArray(rawTrackRecord.metrics)) {
    for (const raw of rawTrackRecord.metrics) {
      if (!isRecord(raw)) continue;
      const id = nonEmptyText(raw.id);
      const label = nonEmptyText(raw.label);
      const displayValue = nonEmptyText(raw.displayValue);
      const cohort = raw.cohort as CorePerformanceMetric["cohort"];
      if (
        !id ||
        !label ||
        !displayValue ||
        metricIds.has(id) ||
        raw.admitted !== true ||
        !Number.isInteger(raw.eligibleSample) ||
        !Number.isInteger(raw.minimumSample) ||
        (raw.eligibleSample as number) < 1 ||
        (raw.minimumSample as number) < 1 ||
        (raw.eligibleSample as number) < (raw.minimumSample as number) ||
        !METRIC_COHORTS.has(cohort)
      )
        continue;
      const lineage = evidenceLineage(raw.evidenceIds, evidenceById);
      if (!lineage.complete || !hasUsableEvidence(lineage.ids, evidenceById))
        continue;
      metricIds.add(id);
      // Preserve the upstream cohort exactly; this adapter never pools cohorts or derives statistics.
      metrics.push({
        id,
        label,
        displayValue,
        eligibleSample: raw.eligibleSample as number,
        minimumSample: raw.minimumSample as number,
        admitted: true,
        cohort,
        evidenceIds: lineage.ids,
      });
    }
  }

  return { records, metrics };
}

function sanitizePressure(
  rawPressure: unknown,
  evidenceById: EvidenceIndex
): IntelligenceCoreInput["pressure"] {
  const unavailable: IntelligenceCoreInput["pressure"] = {
    value: null,
    status: "unavailable",
    evidenceIds: [],
  };
  if (
    !isRecord(rawPressure) ||
    !isEvidenceStatus(rawPressure.status) ||
    !Number.isFinite(rawPressure.value)
  )
    return unavailable;
  const value = rawPressure.value as number;
  if (value < 0 || value > 100) return unavailable;

  const lineage = evidenceLineage(rawPressure.evidenceIds, evidenceById);
  if (!lineage.complete || !hasUsableEvidence(lineage.ids, evidenceById))
    return unavailable;
  let status = rawPressure.status;
  if (
    status === "current" &&
    !allEvidenceHaveStatus(lineage.ids, evidenceById, "current")
  )
    return unavailable;
  if (
    status === "delayed" &&
    !hasEvidenceWithStatus(lineage.ids, evidenceById, "delayed")
  ) {
    if (allEvidenceAreExpiredStale(lineage.ids, evidenceById))
      status = "stale";
    else return unavailable;
  }
  if (
    (status === "recent" ||
      status === "stale" ||
      status === "static" ||
      status === "degraded") &&
    !hasEvidenceWithStatus(lineage.ids, evidenceById, status)
  ) {
    if (
      (status === "recent" || status === "static") &&
      allEvidenceAreExpiredStale(lineage.ids, evidenceById)
    )
      status = "stale";
    else return unavailable;
  }
  if (status === "unavailable") return unavailable;
  // Historical/degraded values remain in evidence lineage, never in the central readout.
  return {
    value: status === "current" || status === "delayed" ? value : null,
    status,
    evidenceIds: lineage.ids,
  };
}

function sanitizeRegime(
  rawRegime: unknown,
  evidenceById: EvidenceIndex,
  integrity: EvidenceStatus
): IntelligenceCoreInput["regime"] {
  if (!isRecord(rawRegime)) return { label: null, evidenceIds: [] };
  const label = nonEmptyText(rawRegime.label);
  const lineage = evidenceLineage(rawRegime.evidenceIds, evidenceById);
  // Regime has no status field. Showing it therefore means making a current claim.
  if (
    !label ||
    integrity !== "current" ||
    !lineage.complete ||
    !allEvidenceHaveStatus(lineage.ids, evidenceById, "current")
  ) {
    return { label: null, evidenceIds: [] };
  }
  return { label, evidenceIds: lineage.ids };
}

function isValidCurrentPressureModel(
  value: unknown
): value is IntelligenceCoreViewModel {
  if (
    !isRecord(value) ||
    value.mode !== "production" ||
    value.pressure === null ||
    !isRecord(value.pressure)
  )
    return false;
  const evaluatedAtMs = parseTimestamp(value.evaluatedAt);
  if (evaluatedAtMs === null || evaluatedAtMs > Date.now()) return false;
  if (
    !nonEmptyText(value.canonicalStateId) ||
    !validObservedAt(value.observationAt, evaluatedAtMs)
  )
    return false;
  if (value.integrity !== "current") return false;
  if (
    value.pressure.status !== "current" ||
    !Number.isFinite(value.pressure.value) ||
    (value.pressure.value as number) < 0 ||
    (value.pressure.value as number) > 100
  )
    return false;
  if (
    !Array.isArray(value.evidence) ||
    !Array.isArray(value.pressure.evidenceIds)
  )
    return false;

  const evidence = sanitizeEvidence(value.evidence, evaluatedAtMs);
  const evidenceById: EvidenceIndex = new Map(
    evidence.map(item => [item.id, item])
  );
  const lineage = evidenceLineage(value.pressure.evidenceIds, evidenceById);
  return (
    lineage.complete &&
    allEvidenceHaveStatus(lineage.ids, evidenceById, "current")
  );
}

function shouldAnimateVerifiedChange(
  previous: IntelligenceCoreViewModel | undefined,
  current: IntelligenceCoreViewModel
): boolean {
  if (
    !previous ||
    !isValidCurrentPressureModel(previous) ||
    !isValidCurrentPressureModel(current)
  )
    return false;
  // A different canonical state is required: changed in-memory props are not a verified transition.
  if (previous.canonicalStateId === current.canonicalStateId) return false;
  const previousObservationAt = parseTimestamp(previous.observationAt);
  const currentObservationAt = parseTimestamp(current.observationAt);
  if (
    previousObservationAt === null ||
    currentObservationAt === null ||
    currentObservationAt <= previousObservationAt
  )
    return false;
  return previous.pressure.value !== current.pressure.value;
}

/**
 * Project an already canonical, upstream-admitted payload into safe visual data.
 * No provider call, validation inference, calculation, or synthetic data is performed here.
 */
export function adaptIntelligenceCore(
  input: IntelligenceCoreInput,
  previous?: IntelligenceCoreViewModel
): IntelligenceCoreViewModel {
  if (!isRecord(input))
    return createUnavailableCore(
      "Canonical intelligence payload is unavailable."
    );

  const evaluatedAtMs = parseTimestamp(input.evaluatedAt);
  if (evaluatedAtMs === null || evaluatedAtMs > Date.now()) {
    return createUnavailableCore(
      "Canonical evaluation timestamp is unavailable."
    );
  }
  const canonicalStateId = nonEmptyText(input.canonicalStateId);
  if (
    !canonicalStateId ||
    !validObservedAt(input.observationAt, evaluatedAtMs)
  ) {
    return createUnavailableCore(
      "Canonical state identifier or observation is unavailable."
    );
  }

  const evidence = sanitizeEvidence(input.evidence, evaluatedAtMs);
  const evidenceById: EvidenceIndex = new Map(
    evidence.map(item => [item.id, item])
  );
  const hasCurrentEvidence = evidence.some(item =>
    isCurrentEvidenceUsable(item, evaluatedAtMs)
  );
  let integrity = isEvidenceStatus(input.integrity)
    ? input.integrity
    : "unavailable";
  // A payload cannot describe itself as verified current when every surviving
  // item is historical, degraded, delayed, static, or unavailable.
  if (integrity === "current" && !hasCurrentEvidence) {
    integrity = evidence.some(isUsableEvidence) ? "stale" : "unavailable";
  }
  if (
    (integrity === "delayed" ||
      integrity === "recent" ||
      integrity === "static") &&
    !evidence.some(item => item.status === integrity) &&
    evidence.some(item => item.status === "stale")
  ) {
    integrity = "stale";
  }
  const pressure = sanitizePressure(input.pressure, evidenceById);
  const regime = sanitizeRegime(input.regime, evidenceById, integrity);
  const overviewLineage = evidenceLineage(
    input.overviewEvidenceIds,
    evidenceById
  );
  const overviewIsCurrent =
    integrity === "current" &&
    overviewLineage.complete &&
    allEvidenceHaveStatus(overviewLineage.ids, evidenceById, "current");

  const model: IntelligenceCoreViewModel = {
    canonicalStateId,
    observationAt: input.observationAt,
    evaluatedAt: input.evaluatedAt,
    integrity,
    integrityReason:
      nonEmptyText(input.integrityReason) ?? "Integrity status unavailable.",
    pressure,
    regime,
    overview: overviewIsCurrent ? stringOrNull(input.overview) : null,
    overviewEvidenceIds: overviewIsCurrent ? overviewLineage.ids : [],
    evidence,
    domains: sanitizeDomains(input.domains, evidenceById, evaluatedAtMs),
    relationships: sanitizeRelationships(input.relationships, evidenceById),
    scenarios: sanitizeScenarios(input.scenarios, evidenceById),
    emergingStress: sanitizeEmergingStress(
      input.emergingStress,
      evidenceById,
      integrity
    ),
    trackRecord: sanitizeTrackRecords(
      input.trackRecord,
      evidenceById,
      evaluatedAtMs
    ),
    // The adapter is a production boundary. Fixtures/demonstrations belong outside this graph.
    mode: "production",
    animateVerifiedChange: false,
  };

  model.animateVerifiedChange = shouldAnimateVerifiedChange(previous, model);
  return model;
}
