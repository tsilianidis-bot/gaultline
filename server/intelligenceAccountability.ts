/**
 * Persistence for the intelligence accountability ledger.
 *
 * Rows are appended to the existing governed research tables:
 *   governedResearchObservations — the original assessment (insert if absent)
 *   governedResearchResolutions  — later developments and resolutions
 *
 * The public reader is inert unless featureFlags.intelligence_track_record
 * exists and is enabled. A missing row stays off (this flag does not use the
 * repository-wide default of "on"). Example data is refused here.
 */
import { asc, eq } from "drizzle-orm";
import { featureFlags, governedResearchObservations, governedResearchResolutions } from "../drizzle/schema";
import {
  ACCOUNTABILITY_SCHEMA,
  ACCOUNTABILITY_SOURCE_MODEL,
  ACCOUNTABILITY_FLAG_KEY,
  PROVENANCE_FORWARD,
  agreedProvenance,
  historyClassForProvenance,
  type StoredAssessment,
  type StoredDevelopment,
  type StoredResolution,
} from "../shared/intelligenceAccountability";
import { getDb } from "./db";
import { appendGovernedResearchResolution, buildGovernedResearchObservation, persistGovernedResearchObservation } from "./intelligenceGovernance";

/** Missing row and any value other than 1 stay off. This flag does not default on. */
export function intelligenceTrackRecordFlagEnabled(row: { enabled: number } | null | undefined): boolean {
  return row?.enabled === 1;
}

export async function isIntelligenceTrackRecordEnabled(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const rows = await db.select({ enabled: featureFlags.enabled }).from(featureFlags).where(eq(featureFlags.key, ACCOUNTABILITY_FLAG_KEY)).limit(1);
    return intelligenceTrackRecordFlagEnabled(rows[0]);
  } catch {
    return false;
  }
}

export function assessmentToResearchRecord(assessment: StoredAssessment) {
  if (assessment.exampleData) {
    throw new Error("Example data is not written to the accountability ledger.");
  }
  const body = {
    schema: ACCOUNTABILITY_SCHEMA,
    provenance: assessment.provenance,
    exampleData: false as const,
    assessmentKey: assessment.assessmentKey,
    assessedAt: assessment.assessedAt,
    summary: assessment.summary,
    canonicalStateId: assessment.canonicalStateId,
    pressureIndex: assessment.pressureIndex,
    regime: assessment.regime,
    scenarios: assessment.scenarios,
    supportingObservations: assessment.supportingObservations,
    evidence: assessment.evidence,
    assessmentKind: assessment.assessmentKind,
    direction: assessment.direction,
  };
  return buildGovernedResearchObservation({
    observationKey: `intelligence-accountability:${assessment.assessmentKey}`,
    observationVersion: ACCOUNTABILITY_SCHEMA,
    historyClass: historyClassForProvenance(assessment.provenance),
    observationDate: assessment.assessedAt,
    informationCutoff: assessment.assessedAt,
    inputSnapshotId: assessment.canonicalStateId,
    sourceModel: ACCOUNTABILITY_SOURCE_MODEL,
    modelVersion: ACCOUNTABILITY_SCHEMA,
    originalState: body,
    originalInterpretation: assessment.summary,
    outcomeDefinition: "Append-only later observation. Status is supported, contradicted, or unresolved.",
    outcomeWindow: "appended_when_observed",
    sourceDataVersions: { schema: ACCOUNTABILITY_SCHEMA, provenance: assessment.provenance },
  });
}

export async function persistAccountabilityAssessment(assessment: StoredAssessment): Promise<{ created: boolean }> {
  const record = assessmentToResearchRecord(assessment);
  const saved = await persistGovernedResearchObservation(record);
  return { created: saved.created };
}

export async function persistAccountabilityDevelopment(observationId: number, development: StoredDevelopment): Promise<{ created: boolean }> {
  return appendGovernedResearchResolution({
    observationId,
    resolutionKey: `intelligence-accountability:development:${development.developmentKey}`,
    resolutionVersion: ACCOUNTABILITY_SCHEMA,
    resolvedAt: development.observedAt,
    outcomeValue: { schema: ACCOUNTABILITY_SCHEMA, kind: "development", ...development },
    sourceDataVersions: { schema: ACCOUNTABILITY_SCHEMA },
  });
}

export async function persistAccountabilityResolution(observationId: number, resolution: StoredResolution): Promise<{ created: boolean }> {
  return appendGovernedResearchResolution({
    observationId,
    resolutionKey: `intelligence-accountability:resolution:${resolution.resolutionKey}`,
    resolutionVersion: ACCOUNTABILITY_SCHEMA,
    resolvedAt: resolution.resolvedAt,
    outcomeValue: { schema: ACCOUNTABILITY_SCHEMA, kind: "resolution", ...resolution },
    sourceDataVersions: { schema: ACCOUNTABILITY_SCHEMA },
  });
}

interface StoredBody {
  schema?: string;
  provenance?: string;
  exampleData?: boolean;
  assessmentKey?: string;
  assessedAt?: string;
  summary?: string;
  canonicalStateId?: string | null;
  pressureIndex?: number | null;
  regime?: string | null;
  scenarios?: StoredAssessment["scenarios"];
  supportingObservations?: StoredAssessment["supportingObservations"];
  evidence?: StoredAssessment["evidence"];
  assessmentKind?: StoredAssessment["assessmentKind"];
  direction?: StoredAssessment["direction"];
}

function asAssessment(historyClass: string, raw: unknown, developments: StoredDevelopment[], resolutions: StoredResolution[]): StoredAssessment | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as StoredBody;
  if (body.schema !== ACCOUNTABILITY_SCHEMA || !body.assessmentKey || !body.assessedAt || !body.summary) return null;
  const provenance = agreedProvenance(historyClass, body.provenance ?? "");
  if (provenance === "conflict") return null;
  const assessment: StoredAssessment = {
    assessmentKey: body.assessmentKey,
    provenance,
    exampleData: body.exampleData === true,
    assessedAt: body.assessedAt,
    summary: body.summary,
    canonicalStateId: body.canonicalStateId ?? null,
    pressureIndex: body.pressureIndex ?? null,
    regime: body.regime ?? null,
    scenarios: body.scenarios ?? [],
    supportingObservations: body.supportingObservations ?? [],
    evidence: body.evidence ?? { availableInputs: 0, requiredInputs: 0, unavailableInputs: [] },
    assessmentKind: body.assessmentKind === "early_warning" ? "early_warning" : "market_assessment",
    direction: body.direction ?? "unspecified",
    originalJson: JSON.stringify(body),
    developments,
    resolutions,
  };
  if (provenance === PROVENANCE_FORWARD && historyClass !== "live_verified") return null;
  return assessment;
}

export async function loadAccountabilityLedger(): Promise<StoredAssessment[]> {
  const db = await getDb();
  if (!db) return [];
  const observations = await db.select().from(governedResearchObservations)
    .where(eq(governedResearchObservations.sourceModel, ACCOUNTABILITY_SOURCE_MODEL))
    .orderBy(asc(governedResearchObservations.observationDate));
  const loaded: StoredAssessment[] = [];
  for (const observation of observations) {
    if (observation.observationVersion !== ACCOUNTABILITY_SCHEMA) continue;
    const resolutions = await db.select().from(governedResearchResolutions)
      .where(eq(governedResearchResolutions.observationId, observation.id))
      .orderBy(asc(governedResearchResolutions.resolvedAt));
    const developments: StoredDevelopment[] = [];
    const decisions: StoredResolution[] = [];
    for (const resolution of resolutions) {
      let parsed: { kind?: string; developmentKey?: string; resolutionKey?: string; observedAt?: string; resolvedAt?: string; statement?: string; status?: StoredResolution["status"]; benchmark?: StoredDevelopment["benchmark"]; confirmsWarning?: boolean };
      try {
        parsed = JSON.parse(resolution.outcomeValueJson);
      } catch {
        continue;
      }
      if (parsed.kind === "development" && parsed.developmentKey && parsed.statement) {
        developments.push({
          developmentKey: parsed.developmentKey,
          observedAt: parsed.observedAt ?? resolution.resolvedAt.toISOString(),
          statement: parsed.statement,
          benchmark: parsed.benchmark ?? null,
          confirmsWarning: parsed.confirmsWarning === true,
        });
      } else if (parsed.kind === "resolution" && parsed.resolutionKey && parsed.statement && parsed.status) {
        decisions.push({
          resolutionKey: parsed.resolutionKey,
          resolvedAt: parsed.resolvedAt ?? resolution.resolvedAt.toISOString(),
          status: parsed.status,
          statement: parsed.statement,
        });
      }
    }
    let original: unknown;
    try {
      original = JSON.parse(observation.originalStateJson);
    } catch {
      continue;
    }
    const assessment = asAssessment(observation.historyClass, original, developments, decisions);
    if (assessment) loaded.push(assessment);
  }
  return loaded;
}
