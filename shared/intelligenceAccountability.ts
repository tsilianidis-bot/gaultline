/**
 * Intelligence accountability ledger (Validation & Track Record).
 *
 * Append-only record of what was assessed, what was observed later, and how it
 * resolved. This module does not score markets, fit thresholds, or rewrite a
 * past assessment. Forward-recorded rows and historical reconstructions stay
 * on separate provenance values and are never combined in a metric.
 *
 * Persistence reuses governedResearchObservations / governedResearchResolutions
 * (see server/intelligenceAccountability.ts). No new table is required.
 */
import { PUBLIC_DISCLAIMER } from "./publicDisclaimer";
import { nyseSeismographRunWindow } from "./nyseSession";
import { activeStressBenchmarkRegistry, type StressBenchmarkRegistry } from "./stressBenchmarkRegistry";

/** Matches server/forwardRunProvenance capturesForwardEvidence: only SCHEDULED_CRON. */
export function isScheduledForwardRun(run: { trigger?: string | null } | null | undefined): boolean {
  return run?.trigger === "SCHEDULED_CRON";
}

export const ACCOUNTABILITY_SCHEMA = "intelligence-accountability-v1" as const;
export const ACCOUNTABILITY_SOURCE_MODEL = "faultline-intelligence-accountability" as const;
export const ACCOUNTABILITY_FLAG_KEY = "intelligence_track_record" as const;

export const PROVENANCE_FORWARD = "forward_recorded" as const;
export const PROVENANCE_RECONSTRUCTION = "historical_reconstruction" as const;
export type AssessmentProvenance = typeof PROVENANCE_FORWARD | typeof PROVENANCE_RECONSTRUCTION;

export const RESOLUTION_SUPPORTED = "supported" as const;
export const RESOLUTION_CONTRADICTED = "contradicted" as const;
export const RESOLUTION_UNRESOLVED = "unresolved" as const;
export type ResolutionStatus =
  | typeof RESOLUTION_SUPPORTED
  | typeof RESOLUTION_CONTRADICTED
  | typeof RESOLUTION_UNRESOLVED;

export const SCENARIO_IDS = ["A", "B", "C"] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

/** Fixed in advance. This module has no parameter for revising them from outcomes. */
export const MINIMUM_SAMPLES = Object.freeze({
  directionalAccuracy: 30,
  falsePositiveRate: 30,
  missedWarningRate: 20,
  leadTimeDays: 20,
  regimePerformance: 15,
  benchmarkComparison: 30,
  evidenceCoverage: 10,
});

/**
 * Fixed in advance. A count that clears MINIMUM_SAMPLES is still withheld when
 * the eligible sample is concentrated. Not fitted from outcomes.
 * - at least 5 distinct UTC dates
 * - no single UTC date holds more than half the eligible sample
 * - pooled rates also need at least 2 recorded regimes
 * - a single non-null canonical state id is one cluster and is withheld
 */
export const DIVERSITY_GUARD = Object.freeze({
  minimumDistinctUtcDates: 5,
  maxSingleUtcDateShare: 0.5,
  minimumDistinctRegimes: 2,
});

/**
 * Frozen classification rule. Status is not an input.
 * unresolved: no development at or after assessedAt.
 * contradicted: any such development's statement equals a scenario invalidation
 * frozen on the assessment (trimmed, exact).
 * supported: at least one such development exists and none match those invalidations.
 * A later non-matching development does not undo a match.
 */
export const RESOLUTION_RULE_ID = "invalidation-match-v1" as const;

/** How far before a confirmed stress event a recorded stress note can count. Not fitted. */
export const RECORDED_NOTE_WINDOW_DAYS = 60;

const BANNED_KEY = /probab|crash|weight|confidence|percent|likelihood|odds|favou?red|founder/i;

export class AccountabilityImmutabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountabilityImmutabilityError";
  }
}

export class AccountabilityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountabilityValidationError";
  }
}

export interface ScenarioExpectation {
  id: ScenarioId;
  expectation: string;
  invalidation: string;
}

export interface SupportingObservation {
  observedAt: string;
  source: string;
  statement: string;
  verified: true;
}

export interface EvidenceCoverageInput {
  availableInputs: number;
  requiredInputs: number;
  unavailableInputs: string[];
}

export type AssessmentKind = "market_assessment" | "early_warning";
export type AssessmentDirection = "stress_increase" | "stress_decrease" | "unchanged" | "unspecified";

export interface MarketAssessmentInput {
  assessmentKey: string;
  provenance: AssessmentProvenance;
  /** Fixture / preview rows only. Excluded from every metric. */
  exampleData?: boolean;
  assessedAt: string;
  summary: string;
  canonicalStateId: string | null;
  canonicalStateHash?: string | null;
  inputSnapshotId?: string | null;
  pressureIndex: number | null;
  regime: string | null;
  scenarios: ScenarioExpectation[];
  supportingObservations: SupportingObservation[];
  evidence: EvidenceCoverageInput;
  assessmentKind: AssessmentKind;
  direction: AssessmentDirection;
  /** Frozen at assessment time. Later benchmark ids that differ are ignored. */
  preregisteredBenchmarkId?: string | null;
  evidenceReferences?: EvidenceReference[];
  registryVersionId?: string | null;
  registryContentHash?: string | null;
  favoredScenario?: ScenarioId | null;
  founderThesisAffinity?: unknown;
}

export interface BenchmarkMatch {
  id: string;
  matched: boolean;
}

/** Pointer to a verified observation. The measurement value is not copied. */
export interface EvidenceReference {
  id: string;
  observedAt: string | null;
  receivedAt: string | null;
  contentHash: string;
}

export interface ObservedDevelopmentInput {
  developmentKey: string;
  assessmentKey: string;
  observedAt: string;
  statement: string;
  benchmark?: BenchmarkMatch | null;
  confirmsWarning?: boolean;
}

export interface ResolutionInput {
  resolutionKey: string;
  assessmentKey: string;
  resolvedAt: string;
  /** If supplied, it must equal the frozen rule. It is not a way to choose the status. */
  status?: ResolutionStatus;
  statement: string;
}

export interface StoredDevelopment {
  developmentKey: string;
  observedAt: string;
  statement: string;
  benchmark: BenchmarkMatch | null;
  confirmsWarning: boolean;
}

export interface StoredResolution {
  resolutionKey: string;
  resolvedAt: string;
  status: ResolutionStatus;
  statement: string;
}

export interface StoredAssessment {
  canonicalStateHash?: string | null;
  inputSnapshotId?: string | null;
  assessmentKey: string;
  provenance: AssessmentProvenance;
  exampleData: boolean;
  assessedAt: string;
  summary: string;
  canonicalStateId: string | null;
  pressureIndex: number | null;
  regime: string | null;
  scenarios: ScenarioExpectation[];
  supportingObservations: SupportingObservation[];
  evidence: EvidenceCoverageInput;
  assessmentKind: AssessmentKind;
  direction: AssessmentDirection;
  preregisteredBenchmarkId: string | null;
  evidenceReferences: EvidenceReference[];
  registryVersionId: string | null;
  registryContentHash: string | null;
  /** Canonical JSON of the original assessment. Appends must not change it. */
  originalJson: string;
  developments: StoredDevelopment[];
  resolutions: StoredResolution[];
}

export interface PublicScenario {
  id: ScenarioId;
  expectation: string;
  invalidation: string;
}

export interface PublicChronologyItem {
  assessmentKey: string;
  provenance: AssessmentProvenance;
  provenanceLabel: string;
  exampleData: boolean;
  assessedAt: string;
  summary: string;
  pressureIndex: number | null;
  regime: string | null;
  scenarios: PublicScenario[];
  supportingObservations: SupportingObservation[];
  developments: Array<{ observedAt: string; statement: string }>;
  resolutions: Array<{ resolvedAt: string; status: ResolutionStatus; statement: string }>;
  evidenceReferences: EvidenceReference[];
  registryVersionId: string | null;
  registryContentHash: string | null;
  currentStatus: ResolutionStatus;
}

export interface PublicMetric {
  id: keyof typeof MINIMUM_SAMPLES;
  label: string;
  status: "insufficient_evidence" | "reported";
  sampleSize: number;
  minimumSample: number;
  /** Null whenever the sample is below the minimum. Ratios are 0–1; lead time is days. */
  value: number | null;
  unit: "ratio" | "days";
  detail: string;
}

export interface PublicTrackRecord {
  schema: typeof ACCOUNTABILITY_SCHEMA;
  disclaimer: typeof PUBLIC_DISCLAIMER;
  enabled: true;
  examplePreview: boolean;
  inventory: {
    forwardRecorded: number;
    unresolvedForward: number;
    historicalReconstructions: number;
    exampleRows: number;
  };
  metrics: PublicMetric[];
  regimeMetrics: Array<PublicMetric & { regime: string }>;
  chronology: PublicChronologyItem[];
  methodology: string[];
  limitations: string[];
}

function assertNoBannedKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoBannedKeys(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (BANNED_KEY.test(key)) {
      throw new AccountabilityValidationError(
        key.toLowerCase().includes("founder") || key.toLowerCase().includes("favor") || key.toLowerCase().includes("favour")
          ? "Scenario C must not be favored, including where it resembles a founder thesis."
          : `Field "${key}" is not recorded on the public accountability ledger.`,
      );
    }
    assertNoBannedKeys(nested);
  }
}

function requireIso(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new AccountabilityValidationError(`${label} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
}

function requireText(value: string, label: string): string {
  const text = value?.trim() ?? "";
  if (!text) throw new AccountabilityValidationError(`${label} is required.`);
  return text;
}

export function normalizeScenarios(input: MarketAssessmentInput): ScenarioExpectation[] {
  if (input.favoredScenario || input.founderThesisAffinity != null) {
    throw new AccountabilityValidationError("Scenario C must not be favored, including where it resembles a founder thesis.");
  }
  assertNoBannedKeys(input.scenarios);
  const byId = new Map<string, ScenarioExpectation>();
  for (const scenario of input.scenarios ?? []) {
    if (!SCENARIO_IDS.includes(scenario.id)) {
      throw new AccountabilityValidationError("Scenarios must be exactly A, B, and C.");
    }
    if (byId.has(scenario.id)) throw new AccountabilityValidationError(`Scenario ${scenario.id} is duplicated.`);
    byId.set(scenario.id, {
      id: scenario.id,
      expectation: requireText(scenario.expectation, `Scenario ${scenario.id} expectation`),
      invalidation: requireText(scenario.invalidation, `Scenario ${scenario.id} invalidation`),
    });
  }
  if (byId.size !== SCENARIO_IDS.length) {
    throw new AccountabilityValidationError("Scenarios must be exactly A, B, and C, with equal standing.");
  }
  return SCENARIO_IDS.map(id => byId.get(id)!);
}

export function equalStandingScenarios(regime: string | null, invalidationConditions: string[]): ScenarioExpectation[] {
  const recorded = regime?.trim() || "the recorded regime";
  const conditions = invalidationConditions.map(item => item.trim()).filter(Boolean);
  const invalidation = conditions.length ? conditions.join(" ") : "The later observation no longer matches this path.";
  return normalizeScenarios({
    assessmentKey: "scenario-template",
    provenance: PROVENANCE_FORWARD,
    assessedAt: "2026-01-01T00:00:00.000Z",
    summary: "template",
    canonicalStateId: null,
    pressureIndex: null,
    regime,
    scenarios: [
      { id: "A", expectation: `Recorded conditions remain in ${recorded}.`, invalidation },
      { id: "B", expectation: `Recorded conditions move out of ${recorded}.`, invalidation },
      {
        id: "C",
        expectation: "A third recorded path with the same standing as A and B. It is not selected to match a founder thesis.",
        invalidation,
      },
    ],
    supportingObservations: [],
    evidence: { availableInputs: 0, requiredInputs: 0, unavailableInputs: [] },
    assessmentKind: "market_assessment",
    direction: "unspecified",
  });
}

function normalizeEvidence(evidence: EvidenceCoverageInput): EvidenceCoverageInput {
  const availableInputs = evidence?.availableInputs;
  const requiredInputs = evidence?.requiredInputs;
  if (!Number.isInteger(availableInputs) || availableInputs < 0) {
    throw new AccountabilityValidationError("availableInputs must be a non-negative integer.");
  }
  if (!Number.isInteger(requiredInputs) || requiredInputs < 0) {
    throw new AccountabilityValidationError("requiredInputs must be a non-negative integer.");
  }
  return {
    availableInputs,
    requiredInputs,
    unavailableInputs: (evidence.unavailableInputs ?? []).map(item => requireText(item, "unavailable input")),
  };
}

export function normalizeAssessment(input: MarketAssessmentInput): Omit<StoredAssessment, "originalJson" | "developments" | "resolutions"> {
  assertNoBannedKeys({
    summary: input.summary,
    regime: input.regime,
    scenarios: input.scenarios,
    supportingObservations: input.supportingObservations,
  });
  if (input.provenance !== PROVENANCE_FORWARD && input.provenance !== PROVENANCE_RECONSTRUCTION) {
    throw new AccountabilityValidationError("Provenance must be forward_recorded or historical_reconstruction.");
  }
  if (input.pressureIndex != null && (!Number.isFinite(input.pressureIndex) || input.pressureIndex < 0 || input.pressureIndex > 100)) {
    throw new AccountabilityValidationError("Pressure Index must be null or a finite value from 0 to 100.");
  }
  const assessment: Omit<StoredAssessment, "originalJson" | "developments" | "resolutions"> = {
    assessmentKey: requireText(input.assessmentKey, "assessmentKey"),
    provenance: input.provenance,
    exampleData: input.exampleData === true,
    assessedAt: requireIso(input.assessedAt, "assessedAt"),
    summary: requireText(input.summary, "summary"),
    canonicalStateId: input.canonicalStateId?.trim() || null,
    ...(input.canonicalStateHash ? { canonicalStateHash: input.canonicalStateHash } : {}),
    ...(input.inputSnapshotId ? { inputSnapshotId: input.inputSnapshotId } : {}),
    pressureIndex: input.pressureIndex == null ? null : input.pressureIndex,
    regime: input.regime?.trim() || null,
    scenarios: normalizeScenarios(input),
    supportingObservations: (input.supportingObservations ?? []).map(item => {
      if (item.verified !== true) throw new AccountabilityValidationError("Supporting observations must be verified.");
      return {
        observedAt: requireIso(item.observedAt, "supporting observation time"),
        source: requireText(item.source, "supporting observation source"),
        statement: requireText(item.statement, "supporting observation"),
        verified: true as const,
      };
    }),
    evidence: normalizeEvidence(input.evidence),
    assessmentKind: input.assessmentKind,
    direction: input.direction,
    preregisteredBenchmarkId: input.preregisteredBenchmarkId?.trim() || null,
    evidenceReferences: normalizeEvidenceReferences(input.evidenceReferences),
    registryVersionId: input.registryVersionId?.trim() || null,
    registryContentHash: input.registryContentHash?.trim() || null,
  };
  if (assessment.assessmentKind !== "market_assessment" && assessment.assessmentKind !== "early_warning") {
    throw new AccountabilityValidationError("assessmentKind must be market_assessment or early_warning.");
  }
  if (!(["stress_increase", "stress_decrease", "unchanged", "unspecified"] as const).includes(assessment.direction)) {
    throw new AccountabilityValidationError("direction must be stress_increase, stress_decrease, unchanged, or unspecified.");
  }
  return assessment;
}

function normalizeEvidenceReferences(references: EvidenceReference[] | undefined): EvidenceReference[] {
  return (references ?? []).map(item => {
    if (!item || typeof item !== "object") throw new AccountabilityValidationError("Evidence reference is required.");
    if ("value" in item) {
      throw new AccountabilityValidationError("Evidence references store ids, timestamps, and hashes, not measurement copies.");
    }
    const id = requireText(item.id, "evidence reference id");
    const contentHash = requireText(item.contentHash, "evidence reference hash");
    if (!/^[a-f0-9]{64}$/.test(contentHash)) {
      throw new AccountabilityValidationError("Evidence reference hash must be a sha256 hex digest.");
    }
    return {
      id,
      observedAt: item.observedAt ? requireIso(item.observedAt, "evidence observedAt") : null,
      receivedAt: item.receivedAt ? requireIso(item.receivedAt, "evidence receivedAt") : null,
      contentHash,
    };
  });
}

function originalBody(assessment: Omit<StoredAssessment, "originalJson" | "developments" | "resolutions">): string {
  return JSON.stringify(assessment);
}

export class AccountabilityLedger {
  private readonly records = new Map<string, StoredAssessment>();

  constructor(initial: readonly StoredAssessment[] = []) {
    for (const row of initial) this.records.set(row.assessmentKey, structuredClone(row));
  }

  recordAssessment(input: MarketAssessmentInput): { created: boolean; assessment: StoredAssessment } {
    const normalized = normalizeAssessment(input);
    const existing = this.records.get(normalized.assessmentKey);
    if (existing) {
      if (existing.originalJson !== originalBody(normalized)) {
        throw new AccountabilityImmutabilityError("Past assessments are append-only and cannot be rewritten.");
      }
      return { created: false, assessment: structuredClone(existing) };
    }
    const stored: StoredAssessment = { ...normalized, originalJson: originalBody(normalized), developments: [], resolutions: [] };
    this.records.set(stored.assessmentKey, stored);
    return { created: true, assessment: structuredClone(stored) };
  }

  appendDevelopment(input: ObservedDevelopmentInput): { created: boolean } {
    const row = this.require(input.assessmentKey);
    const before = row.originalJson;
    const developmentKey = requireText(input.developmentKey, "developmentKey");
    if (row.developments.some(item => item.developmentKey === developmentKey)) {
      this.assertUntouched(row, before);
      return { created: false };
    }
    assertNoBannedKeys({ statement: input.statement, benchmark: input.benchmark ?? null });
    row.developments.push({
      developmentKey,
      observedAt: requireIso(input.observedAt, "observedAt"),
      statement: requireText(input.statement, "development"),
      benchmark: input.benchmark ? { id: requireText(input.benchmark.id, "benchmark id"), matched: input.benchmark.matched === true } : null,
      confirmsWarning: input.confirmsWarning === true,
    });
    row.developments.sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.developmentKey.localeCompare(b.developmentKey));
    this.assertUntouched(row, before);
    return { created: true };
  }

  appendResolution(input: ResolutionInput): { created: boolean } {
    const row = this.require(input.assessmentKey);
    const before = row.originalJson;
    const resolutionKey = requireText(input.resolutionKey, "resolutionKey");
    if (row.resolutions.some(item => item.resolutionKey === resolutionKey)) {
      this.assertUntouched(row, before);
      return { created: false };
    }
    const status = classifyResolution(row);
    if (input.status != null && input.status !== status) {
      throw new AccountabilityValidationError(
        `Resolution status is classified by ${RESOLUTION_RULE_ID} and cannot be chosen. The rule result is ${status}.`,
      );
    }
    row.resolutions.push({
      resolutionKey,
      resolvedAt: requireIso(input.resolvedAt, "resolvedAt"),
      status,
      statement: requireText(input.statement, "resolution"),
    });
    row.resolutions.sort((a, b) => a.resolvedAt.localeCompare(b.resolvedAt) || a.resolutionKey.localeCompare(b.resolutionKey));
    this.assertUntouched(row, before);
    return { created: true };
  }

  list(): StoredAssessment[] {
    return Array.from(this.records.values())
      .sort((a, b) => a.assessedAt.localeCompare(b.assessedAt) || a.assessmentKey.localeCompare(b.assessmentKey))
      .map(row => structuredClone(row));
  }

  private require(assessmentKey: string): StoredAssessment {
    const row = this.records.get(assessmentKey);
    if (!row) throw new AccountabilityValidationError(`Unknown assessment ${assessmentKey}.`);
    return row;
  }

  private assertUntouched(row: StoredAssessment, before: string): void {
    if (row.originalJson !== before) {
      throw new AccountabilityImmutabilityError("An append changed the original assessment.");
    }
  }
}

export function isForwardEvidence(row: Pick<StoredAssessment, "provenance" | "exampleData">): boolean {
  return row.provenance === PROVENANCE_FORWARD && row.exampleData !== true;
}

export function latestResolution(row: StoredAssessment): StoredResolution | null {
  return row.resolutions.length ? row.resolutions[row.resolutions.length - 1]! : null;
}

/** Status used by metrics and the public current label. Stored resolution labels are not an input. */
export function classifyResolution(row: Pick<StoredAssessment, "assessedAt" | "scenarios" | "developments">): ResolutionStatus {
  const assessedMs = Date.parse(row.assessedAt);
  const invalidations = new Set(row.scenarios.map(scenario => scenario.invalidation.trim()).filter(Boolean));
  const later = row.developments.filter(item => {
    const observedMs = Date.parse(item.observedAt);
    return Number.isFinite(observedMs) && Number.isFinite(assessedMs) && observedMs >= assessedMs;
  });
  if (!later.length) return RESOLUTION_UNRESOLVED;
  const contradicted = later.some(item => invalidations.has(item.statement.trim()));
  return contradicted ? RESOLUTION_CONTRADICTED : RESOLUTION_SUPPORTED;
}

export function currentStatus(row: StoredAssessment): ResolutionStatus {
  return classifyResolution(row);
}

export function utcDateKey(iso: string): string | null {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function sampleConcentrationReason(
  timestamps: readonly string[],
  options?: { regimes?: readonly (string | null | undefined)[]; requireMultipleRegimes?: boolean; clusterIds?: readonly (string | null | undefined)[] },
): string | null {
  const dates = timestamps.map(utcDateKey).filter((date): date is string => date != null);
  if (!dates.length) return null;
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1);
  const distinctDates = counts.size;
  const maxShare = Math.max(...Array.from(counts.values())) / dates.length;
  if (distinctDates < DIVERSITY_GUARD.minimumDistinctUtcDates) {
    return `Sample is concentrated on ${distinctDates} UTC date(s); at least ${DIVERSITY_GUARD.minimumDistinctUtcDates} are required.`;
  }
  if (maxShare > DIVERSITY_GUARD.maxSingleUtcDateShare) {
    return "One UTC date holds more than half the sample.";
  }
  if (options?.requireMultipleRegimes) {
    const regimes = new Set((options.regimes ?? []).map(regime => regime?.trim() || "Unspecified"));
    if (regimes.size < DIVERSITY_GUARD.minimumDistinctRegimes) {
      return "Sample is concentrated in one regime.";
    }
  }
  const clusterIds = options?.clusterIds ?? [];
  const present = clusterIds.map(id => id?.trim() || "").filter(Boolean);
  if (present.length === timestamps.length && new Set(present).size < 2) {
    return "Sample is concentrated in one canonical state.";
  }
  return null;
}

export function provenanceLabel(row: Pick<StoredAssessment, "provenance" | "exampleData">): string {
  if (row.exampleData && row.provenance === PROVENANCE_RECONSTRUCTION) return "Example data — historical reconstruction";
  if (row.exampleData) return "Example data";
  return row.provenance === PROVENANCE_FORWARD ? "Forward-recorded" : "Historical reconstruction";
}

function daysBetween(startIso: string, endIso: string): number {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 86_400_000);
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

interface MetricDraft {
  id: PublicMetric["id"];
  label: string;
  sampleSize: number;
  minimumSample: number;
  value: number | null;
  unit: PublicMetric["unit"];
  emptyDetail: string;
  concentrationReason?: string | null;
}

function gate(draft: MetricDraft): PublicMetric {
  const enough = draft.sampleSize >= draft.minimumSample && draft.value != null && Number.isFinite(draft.value);
  const ready = enough && !draft.concentrationReason;
  return {
    id: draft.id,
    label: draft.label,
    status: ready ? "reported" : "insufficient_evidence",
    sampleSize: draft.sampleSize,
    minimumSample: draft.minimumSample,
    value: ready ? draft.value : null,
    unit: draft.unit,
    detail: ready
      ? `${draft.sampleSize} real forward observations (minimum ${draft.minimumSample}), spread across the diversity guard.`
      : draft.concentrationReason
        ? `${draft.concentrationReason} ${draft.sampleSize} observations are not reported as a rate.`
        : `${draft.emptyDetail} ${draft.sampleSize} of ${draft.minimumSample} required real forward observations.`,
  };
}

function concentrationOf(rows: readonly StoredAssessment[], requireMultipleRegimes: boolean): string | null {
  return sampleConcentrationReason(rows.map(row => row.assessedAt), {
    regimes: rows.map(row => row.regime),
    requireMultipleRegimes,
    clusterIds: rows.map(row => row.canonicalStateId),
  });
}

export interface ConfirmedStressEvent {
  id: string;
  occurredAt: string;
}

export interface PerformanceMeasurement {
  metrics: PublicMetric[];
  regimeMetrics: Array<PublicMetric & { regime: string }>;
}

/**
 * Measure only real forward-recorded rows. Historical reconstructions, example
 * rows, and unresolved rows do not enter a rate. Status comes from
 * RESOLUTION_RULE_ID, not from a stored label. Thresholds are MINIMUM_SAMPLES
 * and DIVERSITY_GUARD; callers cannot pass replacements.
 * Missed-warning and benchmark rates count only preregistered ids: stress
 * events passed in by id, and benchmark ids frozen on the assessment.
 */
export function measurePerformance(
  rows: readonly StoredAssessment[],
  confirmedStressEvents: readonly ConfirmedStressEvent[] = [],
  registry: StressBenchmarkRegistry = activeStressBenchmarkRegistry(),
): PerformanceMeasurement {
  const forward = rows.filter(isForwardEvidence);
  const resolved = forward.filter(row => {
    const status = currentStatus(row);
    return status === RESOLUTION_SUPPORTED || status === RESOLUTION_CONTRADICTED;
  });
  const supported = resolved.filter(row => currentStatus(row) === RESOLUTION_SUPPORTED).length;
  const directional = gate({
    id: "directionalAccuracy",
    label: "Directional agreement of resolved assessments",
    sampleSize: resolved.length,
    minimumSample: MINIMUM_SAMPLES.directionalAccuracy,
    value: resolved.length ? supported / resolved.length : null,
    unit: "ratio",
    emptyDetail: "Insufficient evidence.",
    concentrationReason: concentrationOf(resolved, true),
  });

  const warnings = forward.filter(row => row.assessmentKind === "early_warning" && row.direction === "stress_increase");
  const resolvedWarnings = warnings.filter(row => currentStatus(row) === RESOLUTION_SUPPORTED || currentStatus(row) === RESOLUTION_CONTRADICTED);
  const falsePositives = resolvedWarnings.filter(row => currentStatus(row) === RESOLUTION_CONTRADICTED).length;
  const falsePositive = gate({
    id: "falsePositiveRate",
    label: "Recorded stress notes later contradicted",
    sampleSize: resolvedWarnings.length,
    minimumSample: MINIMUM_SAMPLES.falsePositiveRate,
    value: resolvedWarnings.length ? falsePositives / resolvedWarnings.length : null,
    unit: "ratio",
    emptyDetail: "Insufficient evidence.",
    concentrationReason: concentrationOf(resolvedWarnings, true),
  });

  const allowedEventIds = new Set(registry.events.map(event => event.id));
  const seenEvents = new Set<string>();
  const events = confirmedStressEvents.filter(event => {
    const id = event.id?.trim();
    if (!id || !allowedEventIds.has(id) || seenEvents.has(id) || !Number.isFinite(Date.parse(event.occurredAt))) return false;
    seenEvents.add(id);
    return true;
  });
  const missed = events.filter(event => {
    const eventMs = Date.parse(event.occurredAt);
    return !warnings.some(row => {
      const assessedMs = Date.parse(row.assessedAt);
      const leadDays = (eventMs - assessedMs) / 86_400_000;
      return leadDays >= 0 && leadDays <= RECORDED_NOTE_WINDOW_DAYS;
    });
  }).length;
  const missedWarning = gate({
    id: "missedWarningRate",
    label: "Confirmed stress events with no prior recorded stress note",
    sampleSize: events.length,
    minimumSample: MINIMUM_SAMPLES.missedWarningRate,
    value: events.length ? missed / events.length : null,
    unit: "ratio",
    emptyDetail: "Insufficient evidence. Missed-warning counts only preregistered events.",
    concentrationReason: sampleConcentrationReason(events.map(event => event.occurredAt)),
  });

  const leadRows = warnings
    .filter(row => currentStatus(row) === RESOLUTION_SUPPORTED)
    .map(row => {
      const confirmation = row.developments.find(item => item.confirmsWarning && Date.parse(item.observedAt) >= Date.parse(row.assessedAt));
      return confirmation ? { row, lead: daysBetween(row.assessedAt, confirmation.observedAt) } : null;
    })
    .filter((value): value is { row: StoredAssessment; lead: number } => value != null && value.lead >= 0);
  const leadTime = gate({
    id: "leadTimeDays",
    label: "Days from a recorded stress note to later confirmation",
    sampleSize: leadRows.length,
    minimumSample: MINIMUM_SAMPLES.leadTimeDays,
    value: median(leadRows.map(item => item.lead)),
    unit: "days",
    emptyDetail: "Insufficient evidence.",
    concentrationReason: concentrationOf(leadRows.map(item => item.row), true),
  });

  const allowedBenchmarks = new Set(registry.benchmarks.map(benchmark => benchmark.id));
  const benchmarkEligible = forward.filter(row => {
    const id = row.preregisteredBenchmarkId;
    if (!id) return false;
    return allowedBenchmarks.has(id)
      && row.registryContentHash === registry.contentHash
      && row.registryVersionId === registry.versionId
      && row.developments.some(item => item.benchmark?.id === id);
  });
  const benchmarkRows = benchmarkEligible.map(row => row.developments.find(item => item.benchmark?.id === row.preregisteredBenchmarkId)!.benchmark!);
  const matched = benchmarkRows.filter(item => item.matched).length;
  const benchmark = gate({
    id: "benchmarkComparison",
    label: "Recorded outcomes against the pre-registered benchmark",
    sampleSize: benchmarkRows.length,
    minimumSample: MINIMUM_SAMPLES.benchmarkComparison,
    value: benchmarkRows.length ? matched / benchmarkRows.length : null,
    unit: "ratio",
    emptyDetail: "Insufficient evidence. Benchmark counts only ids frozen on the assessment.",
    concentrationReason: concentrationOf(benchmarkEligible, true),
  });

  const covered = forward.filter(row =>
    row.evidence.requiredInputs > 0
    && row.evidence.availableInputs >= row.evidence.requiredInputs
    && row.evidence.unavailableInputs.length === 0
    && row.supportingObservations.length > 0,
  ).length;
  const coverage = gate({
    id: "evidenceCoverage",
    label: "Assessments with the required verified observations available",
    sampleSize: forward.length,
    minimumSample: MINIMUM_SAMPLES.evidenceCoverage,
    value: forward.length ? covered / forward.length : null,
    unit: "ratio",
    emptyDetail: "Insufficient evidence.",
    concentrationReason: concentrationOf(forward, true),
  });

  const byRegime = new Map<string, StoredAssessment[]>();
  for (const row of resolved) {
    const regime = row.regime?.trim() || "Unspecified";
    byRegime.set(regime, [...(byRegime.get(regime) ?? []), row]);
  }
  const regimeMetrics = Array.from(byRegime.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([regime, group]) => {
      const hits = group.filter(row => currentStatus(row) === RESOLUTION_SUPPORTED).length;
      return {
        regime,
        ...gate({
          id: "regimePerformance",
          label: `Resolved assessments while ${regime} was recorded`,
          sampleSize: group.length,
          minimumSample: MINIMUM_SAMPLES.regimePerformance,
          value: group.length ? hits / group.length : null,
          unit: "ratio",
          emptyDetail: "Insufficient evidence.",
          concentrationReason: concentrationOf(group, false),
        }),
      };
    });

  return {
    metrics: [directional, falsePositive, missedWarning, leadTime, benchmark, coverage],
    regimeMetrics,
  };
}

const METHODOLOGY = [
  "Each assessment is stored once, with its time, the Pressure Index and regime then recorded, scenarios A, B, and C, and the conditions that would invalidate each path.",
  "Later observations and resolutions are appended. The original assessment is not edited.",
  "Forward-recorded assessments come only from a scheduled forward run. Historical reconstructions use a different provenance value and are excluded from every measurement.",
  "Scenarios A, B, and C are stored with equal standing. Scenario C is not preferred where it resembles a founder thesis.",
  "A rate is shown only after the minimum number of real forward observations, and only when those observations are not concentrated on one UTC date, one regime, or one canonical state. Otherwise the status is insufficient evidence.",
  `Resolution status uses ${RESOLUTION_RULE_ID}. Unresolved means no later development. Contradicted means a later development statement equals an invalidation frozen on the assessment. Supported means a later development exists and none match. The status is not chosen, and a later non-matching note does not undo a match.`,
  "Missed-warning counts only preregistered stress events supplied by id. Benchmark comparison counts only a benchmark id frozen on the assessment. Duplicate event ids are counted once.",
];

const LIMITATIONS = [
  "Counts of records are an inventory, not a measure of skill.",
  "Unresolved assessments are not treated as successes or failures.",
  "Example rows are labelled example data and are excluded from measurement.",
  "A sample that all falls on one UTC date, one regime, or one canonical state is not reported as a rate.",
  "Nothing here is optimized against historical outcomes, and nothing here is a forecast.",
  PUBLIC_DISCLAIMER,
];

export function buildPublicTrackRecord(
  rows: readonly StoredAssessment[],
  options?: { includeExamples?: boolean; confirmedStressEvents?: readonly ConfirmedStressEvent[] },
): PublicTrackRecord {
  const includeExamples = options?.includeExamples === true;
  const visible = rows.filter(row => includeExamples || !row.exampleData);
  const forward = rows.filter(isForwardEvidence);
  const measurement = measurePerformance(rows, options?.confirmedStressEvents ?? []);
  const chronology: PublicChronologyItem[] = visible
    .slice()
    .sort((a, b) => a.assessedAt.localeCompare(b.assessedAt) || a.assessmentKey.localeCompare(b.assessmentKey))
    .map(row => ({
      assessmentKey: row.assessmentKey,
      provenance: row.provenance,
      provenanceLabel: provenanceLabel(row),
      exampleData: row.exampleData,
      assessedAt: row.assessedAt,
      summary: row.summary,
      pressureIndex: row.pressureIndex,
      regime: row.regime,
      scenarios: row.scenarios.map(scenario => ({ id: scenario.id, expectation: scenario.expectation, invalidation: scenario.invalidation })),
      supportingObservations: row.supportingObservations.map(item => ({ ...item })),
      developments: row.developments.map(item => ({ observedAt: item.observedAt, statement: item.statement })),
      resolutions: row.resolutions.map(item => ({ resolvedAt: item.resolvedAt, status: item.status, statement: item.statement })),
      evidenceReferences: row.evidenceReferences.map(item => ({ ...item })),
      registryVersionId: row.registryVersionId,
      registryContentHash: row.registryContentHash,
      currentStatus: currentStatus(row),
    }));

  return {
    schema: ACCOUNTABILITY_SCHEMA,
    disclaimer: PUBLIC_DISCLAIMER,
    enabled: true,
    examplePreview: includeExamples && visible.some(row => row.exampleData),
    inventory: {
      forwardRecorded: forward.length,
      unresolvedForward: forward.filter(row => currentStatus(row) === RESOLUTION_UNRESOLVED).length,
      historicalReconstructions: rows.filter(row => row.provenance === PROVENANCE_RECONSTRUCTION && !row.exampleData).length,
      exampleRows: includeExamples ? rows.filter(row => row.exampleData).length : 0,
    },
    metrics: measurement.metrics,
    regimeMetrics: measurement.regimeMetrics,
    chronology,
    methodology: METHODOLOGY,
    limitations: LIMITATIONS,
  };
}

export function historyClassForProvenance(provenance: AssessmentProvenance): "live_verified" | "reconstructed_research" {
  return provenance === PROVENANCE_FORWARD ? "live_verified" : "reconstructed_research";
}

/** Fail closed: the column and the payload must agree, or the row is not forward evidence. */
export function agreedProvenance(historyClass: string, payloadProvenance: string): AssessmentProvenance | "conflict" {
  if (historyClass === "live_verified" && payloadProvenance === PROVENANCE_FORWARD) return PROVENANCE_FORWARD;
  if (historyClass === "reconstructed_research" && payloadProvenance === PROVENANCE_RECONSTRUCTION) return PROVENANCE_RECONSTRUCTION;
  return "conflict";
}

export interface ScheduledAssessmentSnapshot {
  run: { trigger?: string | null };
  stateId: string | null;
  canonicalStateHash?: string | null;
  inputSnapshotId?: string | null;
  generatedAt: string;
  pressureIndex: number | null;
  regime: string | null;
  summary: string;
  invalidationConditions: string[];
  supportingObservations: SupportingObservation[];
  evidence: EvidenceCoverageInput;
  evidenceReferences?: EvidenceReference[];
  registryVersionId?: string | null;
  registryContentHash?: string | null;
  reconstructed?: boolean;
  historyClass?: string | null;
}

/** Only a scheduled forward run may be labelled forward-recorded. Backfills stay reconstructions. */
export function buildScheduledAssessment(snapshot: ScheduledAssessmentSnapshot): MarketAssessmentInput {
  if (!isScheduledForwardRun(snapshot.run)) {
    throw new AccountabilityValidationError("Only a scheduled forward run can be recorded as forward-recorded.");
  }
  if (snapshot.reconstructed || (snapshot.historyClass != null && snapshot.historyClass !== "live_verified")) {
    throw new AccountabilityValidationError("Forward-recorded assessments cannot be created from reconstructed or historical data.");
  }
  const assessedAt = requireIso(snapshot.generatedAt, "generatedAt");
  const session = nyseSeismographRunWindow(assessedAt);
  if (!session.etDate) {
    throw new AccountabilityValidationError("Scheduled assessment requires an Eastern session date.");
  }
  return {
    assessmentKey: `scheduled:nyse:${session.etDate}`,
    provenance: PROVENANCE_FORWARD,
    exampleData: false,
    assessedAt,
    summary: requireText(snapshot.summary, "summary"),
    canonicalStateId: snapshot.stateId,
    ...(snapshot.canonicalStateHash ? { canonicalStateHash: snapshot.canonicalStateHash } : {}),
    ...(snapshot.inputSnapshotId ? { inputSnapshotId: snapshot.inputSnapshotId } : {}),
    pressureIndex: snapshot.pressureIndex,
    regime: snapshot.regime,
    scenarios: equalStandingScenarios(snapshot.regime, snapshot.invalidationConditions),
    supportingObservations: snapshot.supportingObservations,
    evidence: snapshot.evidence,
    assessmentKind: "market_assessment",
    direction: "unspecified",
    preregisteredBenchmarkId: null,
    evidenceReferences: snapshot.evidenceReferences ?? [],
    registryVersionId: snapshot.registryVersionId ?? null,
    registryContentHash: snapshot.registryContentHash ?? null,
  };
}

export function buildReconstructionAssessment(input: Omit<MarketAssessmentInput, "provenance" | "exampleData"> & { exampleData?: boolean }): MarketAssessmentInput {
  return { ...input, provenance: PROVENANCE_RECONSTRUCTION, exampleData: input.exampleData === true };
}

export function captureScheduledAssessment(args: {
  enabled: boolean;
  ledger: AccountabilityLedger;
  snapshot: ScheduledAssessmentSnapshot;
}): { recorded: boolean; reason: "flag_disabled" | "appended" | "already_recorded" } {
  if (!args.enabled) return { recorded: false, reason: "flag_disabled" };
  const created = args.ledger.recordAssessment(buildScheduledAssessment(args.snapshot)).created;
  return { recorded: created, reason: created ? "appended" : "already_recorded" };
}

function exampleRow(row: MarketAssessmentInput): MarketAssessmentInput {
  return { ...row, exampleData: true };
}

/** In-memory EXAMPLE DATA. Never written by the production recorder. */
export function buildExampleLedger(): AccountabilityLedger {
  const ledger = new AccountabilityLedger();
  const first = exampleRow({
    canonicalStateId: null,
    assessmentKey: "example-forward-supported",
    provenance: PROVENANCE_FORWARD,
    assessedAt: "2026-01-06T18:05:00.000Z",
    summary: "EXAMPLE DATA. Conditions were recorded as elevated, with no claim that they would persist.",
    pressureIndex: 42,
    regime: "ELEVATED",
    scenarios: equalStandingScenarios("ELEVATED", ["A regime label other than ELEVATED."]),
    supportingObservations: [{
      observedAt: "2026-01-06T17:40:00.000Z",
      source: "FRED BAMLH0A0HYM2 (example)",
      statement: "EXAMPLE DATA. High-yield spread observation attached to this assessment.",
      verified: true,
    }],
    evidence: { availableInputs: 6, requiredInputs: 6, unavailableInputs: [] },
    assessmentKind: "market_assessment",
    direction: "unchanged",
  });
  const second = exampleRow({
    canonicalStateId: null,
    evidence: { availableInputs: 4, requiredInputs: 6, unavailableInputs: ["hy_spread"] },
    assessmentKey: "example-forward-contradicted",
    provenance: PROVENANCE_FORWARD,
    assessedAt: "2026-02-02T18:05:00.000Z",
    summary: "EXAMPLE DATA. A stress increase was recorded. Later observations did not support it.",
    pressureIndex: 38,
    regime: "MODERATE",
    scenarios: equalStandingScenarios("MODERATE", ["Pressure leaves the recorded band."]),
    assessmentKind: "early_warning",
    direction: "stress_increase",
    supportingObservations: [{
      observedAt: "2026-02-02T16:00:00.000Z",
      source: "FRED DGS10 (example)",
      statement: "EXAMPLE DATA. Treasury yield observation attached to this note.",
      verified: true,
    }],
  });
  const third = exampleRow({
    canonicalStateId: null,
    supportingObservations: [],
    evidence: { availableInputs: 4, requiredInputs: 6, unavailableInputs: ["hy_spread"] },
    assessmentKind: "market_assessment",
    assessmentKey: "example-forward-unresolved",
    provenance: PROVENANCE_FORWARD,
    assessedAt: "2026-03-02T18:05:00.000Z",
    summary: "EXAMPLE DATA. This assessment has no later resolution.",
    pressureIndex: 35,
    regime: "MODERATE",
    scenarios: equalStandingScenarios("MODERATE", ["No invalidation has been observed yet."]),
    direction: "unspecified",
  });
  const reconstructed = exampleRow({
    canonicalStateId: null,
    supportingObservations: [],
    assessmentKind: "market_assessment",
    direction: "unspecified",
    assessmentKey: "example-reconstruction",
    provenance: PROVENANCE_RECONSTRUCTION,
    assessedAt: "2008-10-01T00:00:00.000Z",
    summary: "EXAMPLE DATA. Historical reconstruction, assembled after the period. Not a forward-recorded assessment.",
    pressureIndex: 82,
    regime: "CRITICAL",
    scenarios: equalStandingScenarios("CRITICAL", ["This reconstruction is not a live record."]),
    evidence: { availableInputs: 2, requiredInputs: 6, unavailableInputs: ["point_in_time_vintage"] },
  });
  ledger.recordAssessment(first);
  ledger.recordAssessment(second);
  ledger.recordAssessment(third);
  ledger.recordAssessment(reconstructed);
  ledger.appendDevelopment({
    developmentKey: "example-dev-1",
    assessmentKey: first.assessmentKey,
    observedAt: "2026-02-06T18:00:00.000Z",
    statement: "EXAMPLE DATA. The recorded regime label was still ELEVATED.",
  });
  ledger.appendResolution({
    resolutionKey: "example-res-1",
    assessmentKey: first.assessmentKey,
    resolvedAt: "2026-02-06T18:10:00.000Z",
    status: RESOLUTION_SUPPORTED,
    statement: "EXAMPLE DATA. The recorded path was supported by the later observation.",
  });
  ledger.appendDevelopment({
    developmentKey: "example-dev-2",
    assessmentKey: second.assessmentKey,
    observedAt: "2026-03-02T18:00:00.000Z",
    statement: "Pressure leaves the recorded band.",
  });
  ledger.appendResolution({
    resolutionKey: "example-res-2",
    assessmentKey: second.assessmentKey,
    resolvedAt: "2026-03-02T18:10:00.000Z",
    status: RESOLUTION_CONTRADICTED,
    statement: "EXAMPLE DATA. The recorded stress note was contradicted.",
  });
  return ledger;
}

export function examplePublicTrackRecord(): PublicTrackRecord {
  return buildPublicTrackRecord(buildExampleLedger().list(), { includeExamples: true });
}

export function emptyPublicTrackRecord(): PublicTrackRecord {
  return buildPublicTrackRecord([]);
}

const PRODUCTION_URL = /prod|railway|getfaultline|amazonaws|planetscale/i;

export interface ExampleSeedEnv {
  NODE_ENV?: string;
  TRACK_RECORD_ALLOW_EXAMPLE_SEED?: string;
  DATABASE_URL?: string;
}

function seedEnv(env?: ExampleSeedEnv): ExampleSeedEnv {
  return env ?? {
    NODE_ENV: process.env.NODE_ENV,
    TRACK_RECORD_ALLOW_EXAMPLE_SEED: process.env.TRACK_RECORD_ALLOW_EXAMPLE_SEED,
    DATABASE_URL: process.env.DATABASE_URL,
  };
}

export function assertExampleSeedAllowed(env?: ExampleSeedEnv): void {
  const resolved = seedEnv(env);
  if (resolved.NODE_ENV === "production") {
    throw new AccountabilityValidationError("Refusing to seed example accountability data in production.");
  }
  const url = resolved.DATABASE_URL ?? "";
  if (url && PRODUCTION_URL.test(url)) {
    throw new AccountabilityValidationError("Refusing to seed example data against a production database.");
  }
  if (resolved.TRACK_RECORD_ALLOW_EXAMPLE_SEED !== "1") {
    throw new AccountabilityValidationError("Set TRACK_RECORD_ALLOW_EXAMPLE_SEED=1 to seed example data outside production.");
  }
}

/** Returns an in-memory example ledger. Does not open a database connection. */
export function seedExampleLedger(env?: ExampleSeedEnv): AccountabilityLedger {
  assertExampleSeedAllowed(env);
  return buildExampleLedger();
}
