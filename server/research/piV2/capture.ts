import { decisionInstantUtc } from "./calendar";
import { computeV2At } from "./compute";
import { ResearchSpecError } from "./errors";
import { canonicalSha256 } from "./hash";
import { IMPLEMENTATION_VERSION } from "./lock";
import { loadLockedSpec } from "./spec";
import type { ResearchRepository, SnapshotInsert } from "./repository";
import type { InputPanel, Observation, ProvenanceRecord, RawDraft, RawInputRow, V2Computation } from "./types";

export type ExclusionNote = ProvenanceRecord & { inComposite: false };

function parseValue(valueText: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(valueText)) {
    throw new ResearchSpecError("SPEC_VIOLATION", `Cannot parse raw value ${valueText}`);
  }
  const value = Number(valueText);
  if (!Number.isFinite(value)) throw new ResearchSpecError("SPEC_VIOLATION", `Non-finite raw value ${valueText}`);
  return value;
}

export function panelFromOfficialRaw(rows: readonly RawInputRow[], asOfDate: string, decisionTimeUtc: string, visibleThroughIso = decisionTimeUtc): {
  panel: InputPanel;
  exclusions: ExclusionNote[];
} {
  const spec = loadLockedSpec().spec;
  const visible = rows.filter(row => row.ingestionTime <= visibleThroughIso);
  const sidelined = new Set(spec.documentedNonComposite.map(item => item.seriesId));
  const exclusions: ExclusionNote[] = visible.filter(row => sidelined.has(row.seriesId)).map(row => ({
    pillarId: null,
    seriesId: row.seriesId,
    used: false,
    observationDate: row.observationDate,
    releaseTime: row.releaseTime,
    realtimeStart: row.realtimeStart,
    vintageId: row.vintageId,
    ingestionTime: row.ingestionTime,
    provider: row.provider,
    coverageLabel: row.coverageLabel,
    reason: "NOT_IN_SPEC_FRED_WINDOW_ONLY",
    inComposite: false,
  }));
  const observations: Observation[] = visible.filter(row => !sidelined.has(row.seriesId)).map(row => ({
    seriesId: row.seriesId,
    observationDate: row.observationDate,
    value: parseValue(row.valueText),
    releaseTime: row.releaseTime,
    realtimeStart: row.realtimeStart,
    vintageId: row.vintageId,
    provider: row.provider,
    ingestionTime: row.ingestionTime,
  }));
  return { panel: { asOfDate, decisionTimeUtc, observations }, exclusions };
}

export function snapshotInsertFromComputation(
  computation: V2Computation,
  exclusions: ExclusionNote[],
  runTrigger: "SCHEDULED_CRON" | "ADMIN_SEED",
  v1Reading: number | null = null,
  v1MethodologyVersion: string | null = null,
): SnapshotInsert {
  const provenance = [...computation.inputsProvenance, ...exclusions];
  return {
    asOfDate: computation.asOfDate,
    onSpecGrid: true,
    recordClass: "FORWARD_LIVE",
    specId: computation.specId,
    specSha256: computation.specSha256,
    implementationVersion: computation.implementationVersion || IMPLEMENTATION_VERSION,
    referenceSha256: computation.referenceSha256,
    runTrigger,
    status: computation.status,
    v2Score: computation.v2Score,
    band: computation.band,
    nPillars: computation.nPillars,
    missingDataStatus: computation.missingDataStatus,
    pillarsJson: JSON.stringify(computation.pillars),
    benchmarksJson: JSON.stringify(computation.benchmarks),
    inputsProvenanceJson: JSON.stringify(provenance),
    inputSnapshotHash: canonicalSha256({
      pillars: computation.pillars,
      benchmarks: computation.benchmarks,
      provenance,
      referenceSha256: computation.referenceSha256,
    }),
    decisionTimeUtc: computation.decisionTimeUtc,
    v1Reading,
    v1MethodologyVersion,
  };
}

export type CaptureResult = {
  rawInserted: number;
  rawDuplicates: number;
  snapshot: "appended" | "already_exists" | "not_requested" | "calculation_failure";
  computation: V2Computation | null;
  conflict: boolean;
};

export function runCapture(args: {
  repo: ResearchRepository;
  drafts: RawDraft[];
  asOfDate: string;
  nowIso: string;
  runTrigger: "SCHEDULED_CRON" | "ADMIN_SEED";
  writeSnapshot: boolean;
  v1Reading?: number | null;
  v1MethodologyVersion?: string | null;
}): CaptureResult {
  let rawInserted = 0;
  let rawDuplicates = 0;
  for (const draft of args.drafts) {
    const result = args.repo.appendRaw(draft, args.nowIso);
    if (result.inserted) rawInserted += 1;
    else rawDuplicates += 1;
  }
  if (!args.writeSnapshot) {
    return { rawInserted, rawDuplicates, snapshot: "not_requested", computation: null, conflict: false };
  }
  const decisionTimeUtc = decisionInstantUtc(args.asOfDate).toISOString();
  let computation: V2Computation;
  let exclusions: ExclusionNote[] = [];
  try {
    const built = panelFromOfficialRaw(args.repo.listRaw(), args.asOfDate, decisionTimeUtc, args.nowIso);
    exclusions = built.exclusions;
    computation = computeV2At(built.panel);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    args.repo.appendMonitor({
      detectedAt: args.nowIso,
      kind: error instanceof ResearchSpecError && error.code === "SPEC_HASH_DRIFT" ? "SPEC_HASH_DRIFT" : "CALCULATION_FAILURE",
      severity: "alert",
      specId: "FL-PI-v2-research-0",
      specSha256: null,
      asOfDate: args.asOfDate,
      detailJson: JSON.stringify({ message }),
    }, args.nowIso);
    return { rawInserted, rawDuplicates, snapshot: "calculation_failure", computation: null, conflict: false };
  }
  const insert = snapshotInsertFromComputation(
    { ...computation, decisionTimeUtc },
    exclusions,
    args.runTrigger,
    args.v1Reading ?? null,
    args.v1MethodologyVersion ?? null,
  );
  try {
    const stored = args.repo.appendSnapshot(insert, args.nowIso);
    args.repo.appendLedger({
      recordClass: "FORWARD_LIVE",
      origin: "OBSERVED_AT_DECISION",
      rowKind: "SCORE",
      asOfDate: stored.asOfDate,
      specId: stored.specId,
      specSha256: stored.specSha256,
      implementationVersion: stored.implementationVersion,
      targetId: "PI_V2_SCORE",
      horizon: "spot",
      snapshotId: stored.id,
      parentLedgerId: null,
      score: stored.v2Score,
      outcome: null,
      artifactKind: "FORWARD_SCORE",
      notes: stored.missingDataStatus,
    }, args.nowIso);
    return { rawInserted, rawDuplicates, snapshot: "appended", computation, conflict: false };
  } catch (error) {
    if (!(error instanceof ResearchSpecError) || error.code !== "DUPLICATE_SNAPSHOT") throw error;
    const existing = args.repo.listSnapshots().find(row => row.asOfDate === args.asOfDate);
    const conflict = existing != null && existing.inputSnapshotHash !== insert.inputSnapshotHash;
    if (conflict) {
      args.repo.appendMonitor({
        detectedAt: args.nowIso,
        kind: "CALCULATION_FAILURE",
        severity: "alert",
        specId: "FL-PI-v2-research-0",
        specSha256: insert.specSha256,
        asOfDate: args.asOfDate,
        detailJson: JSON.stringify({ message: "A second Friday run disagreed with the stored snapshot. The stored row was left unchanged." }),
      }, args.nowIso);
    }
    return { rawInserted, rawDuplicates, snapshot: "already_exists", computation, conflict };
  }
}
