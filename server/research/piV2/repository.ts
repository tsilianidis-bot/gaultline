import { ResearchSpecError } from "./errors";
import { canonicalSha256 } from "./hash";
import { SPEC_ID } from "./lock";
import { isFridayDate } from "./dates";
import { FIRST_OFFICIAL_FRIDAY, loadLockedSpec } from "./spec";
import type { LedgerRow, MonitorRow, RawDraft, RawInputRow, SnapshotRow } from "./types";

export type SnapshotInsert = Omit<SnapshotRow, "id" | "createdAt">;
export type LedgerInsert = Omit<LedgerRow, "id" | "createdAt">;
export type MonitorInsert = Omit<MonitorRow, "id" | "createdAt">;

export type ResearchRepository = {
  appendRaw(draft: RawDraft, ingestionTime: string): { inserted: true; row: RawInputRow } | { inserted: false; reason: "duplicate" };
  appendSnapshot(row: SnapshotInsert, createdAt: string): SnapshotRow;
  appendLedger(row: LedgerInsert, createdAt: string): LedgerRow;
  appendMonitor(row: MonitorInsert, createdAt: string): MonitorRow;
  listRaw(): readonly RawInputRow[];
  listSnapshots(): readonly SnapshotRow[];
  listLedger(): readonly LedgerRow[];
  listMonitor(): readonly MonitorRow[];
};

const VALUE_TEXT = /^-?\d+(\.\d+)?$/;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const entry of Object.values(value as Record<string, unknown>)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

export function assertOfficialRaw(draft: RawDraft): void {
  const spec = loadLockedSpec().spec;
  if (!VALUE_TEXT.test(draft.valueText)) {
    throw new ResearchSpecError("SPEC_VIOLATION", `Raw value ${draft.valueText} is not a plain decimal`);
  }
  if (spec.forbiddenFundingSubstitutes.includes(draft.seriesId)) {
    throw new ResearchSpecError("SPEC_VIOLATION", `${draft.seriesId} cannot be stored on the official ${SPEC_ID} raw ledger`);
  }
  const pillar = spec.pillars.find(item => item.seriesId === draft.seriesId);
  const sidelined = spec.documentedNonComposite.find(item => item.seriesId === draft.seriesId);
  if (!pillar && !sidelined) {
    throw new ResearchSpecError("SPEC_VIOLATION", `${draft.seriesId} is outside the frozen raw catalog`);
  }
  if (sidelined) {
    if (draft.inComposite) throw new ResearchSpecError("SPEC_VIOLATION", `${draft.seriesId} is label-only and cannot enter the composite`);
    if (draft.coverageLabel !== "FRED_WINDOW_FROM_2023_10_16") {
      throw new ResearchSpecError("SPEC_VIOLATION", "HY OAS rows must carry the FRED window coverage label");
    }
  }
  if (pillar && !draft.inComposite) {
    throw new ResearchSpecError("SPEC_VIOLATION", `${draft.seriesId} is a pillar series`);
  }
  if (pillar?.seriesId === "TEDRATE" && draft.observationDate > (pillar.seriesEnd ?? "2022-01-21")) {
    throw new ResearchSpecError("SPEC_VIOLATION", "TED observations after 2022-01-21 are not part of the frozen funding pillar");
  }
}

export function assertSnapshotInsert(row: SnapshotInsert, existing: readonly SnapshotRow[]): void {
  const { sha256 } = loadLockedSpec();
  if (row.recordClass !== "FORWARD_LIVE") {
    throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "Official snapshots accept FORWARD_LIVE rows only");
  }
  if (row.onSpecGrid !== true || !isFridayDate(row.asOfDate) || row.asOfDate < FIRST_OFFICIAL_FRIDAY) {
    throw new ResearchSpecError("NOT_ON_SPEC_GRID", `${row.asOfDate} is not an official Friday on or after ${FIRST_OFFICIAL_FRIDAY}`);
  }
  if (row.specId !== SPEC_ID || row.specSha256 !== sha256) {
    throw new ResearchSpecError("SPEC_HASH_DRIFT", "Snapshot spec hash does not match the locked spec");
  }
  if (row.status === "unavailable" && (row.v2Score != null || row.band != null)) {
    throw new ResearchSpecError("SPEC_VIOLATION", "Unavailable snapshots do not carry a score or band");
  }
  if (row.status === "ok" && (row.v2Score == null || row.band == null || row.nPillars < 3)) {
    throw new ResearchSpecError("SPEC_VIOLATION", "An ok snapshot needs a score, a band, and at least three pillars");
  }
  if (existing.some(snapshot => snapshot.specId === row.specId && snapshot.asOfDate === row.asOfDate)) {
    throw new ResearchSpecError("DUPLICATE_SNAPSHOT", `Official snapshot already exists for ${row.asOfDate}`);
  }
}

export function assertLedgerInsert(row: LedgerInsert, snapshots: readonly SnapshotRow[], ledger: readonly LedgerRow[]): void {
  const forward = row.recordClass === "FORWARD_LIVE";
  const backfill = row.origin === "BACKFILL";
  if (forward && backfill) {
    throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "A backfilled row cannot be labeled FORWARD_LIVE");
  }
  if (!forward && !backfill) {
    throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "RETROSPECTIVE rows are backfills");
  }
  if (forward) {
    if (row.origin !== "OBSERVED_AT_DECISION" || row.snapshotId == null) {
      throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "FORWARD_LIVE rows reference an official snapshot and an observed origin");
    }
    if (row.asOfDate < FIRST_OFFICIAL_FRIDAY || !isFridayDate(row.asOfDate)) {
      throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "FORWARD_LIVE dates stay on the official Friday grid");
    }
    if (!snapshots.some(snapshot => snapshot.id === row.snapshotId && snapshot.asOfDate === row.asOfDate)) {
      throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "FORWARD_LIVE ledger row has no matching snapshot");
    }
  }
  if (!forward && row.snapshotId != null) {
    throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "RETROSPECTIVE rows do not reference the forward snapshot table");
  }
  if (row.rowKind === "SCORE" && (row.parentLedgerId != null || row.outcome != null)) {
    throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "Score rows are parentless and have no outcome yet");
  }
  if (row.rowKind === "OUTCOME") {
    if (row.parentLedgerId == null || (row.outcome !== 0 && row.outcome !== 1)) {
      throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "Outcome rows append to a score row");
    }
    const parent = ledger.find(entry => entry.id === row.parentLedgerId);
    if (!parent || parent.rowKind !== "SCORE" || parent.recordClass !== row.recordClass || parent.asOfDate !== row.asOfDate || parent.targetId !== row.targetId) {
      throw new ResearchSpecError("LEDGER_CLASS_VIOLATION", "Outcome row does not match its score row class, date, and target");
    }
  }
  if (row.specId !== SPEC_ID) throw new ResearchSpecError("SPEC_VIOLATION", "Ledger rows stay on the frozen spec id");
}

export function createMemoryRepository(): ResearchRepository {
  const raw: RawInputRow[] = [];
  const snapshots: SnapshotRow[] = [];
  const ledger: LedgerRow[] = [];
  const monitor: MonitorRow[] = [];
  let nextId = 1;

  return {
    appendRaw(draft, ingestionTime) {
      assertOfficialRaw(draft);
      const inputHash = canonicalSha256({
        seriesId: draft.seriesId,
        observationDate: draft.observationDate,
        vintageId: draft.vintageId,
        valueText: draft.valueText,
      });
      const duplicate = raw.some(row =>
        row.seriesId === draft.seriesId
        && row.observationDate === draft.observationDate
        && row.vintageId === draft.vintageId
        && row.valueText === draft.valueText,
      );
      if (duplicate) return { inserted: false, reason: "duplicate" };
      const row = deepFreeze({
        ...draft,
        id: nextId++,
        specId: SPEC_ID,
        ingestionTime,
        inputHash,
        createdAt: ingestionTime,
      });
      raw.push(row);
      return { inserted: true, row };
    },
    appendSnapshot(insert, createdAt) {
      assertSnapshotInsert(insert, snapshots);
      const row = deepFreeze({ ...insert, id: nextId++, createdAt });
      snapshots.push(row);
      return row;
    },
    appendLedger(insert, createdAt) {
      assertLedgerInsert(insert, snapshots, ledger);
      const row = deepFreeze({ ...insert, id: nextId++, createdAt });
      ledger.push(row);
      return row;
    },
    appendMonitor(insert, createdAt) {
      if (insert.specId !== SPEC_ID) throw new ResearchSpecError("SPEC_VIOLATION", "Monitor events stay on the frozen spec");
      const row = deepFreeze({ ...insert, id: nextId++, createdAt });
      monitor.push(row);
      return row;
    },
    listRaw: () => raw.map(row => deepFreeze({ ...row })),
    listSnapshots: () => snapshots.map(row => deepFreeze({ ...row })),
    listLedger: () => ledger.map(row => deepFreeze({ ...row })),
    listMonitor: () => monitor.map(row => deepFreeze({ ...row })),
  };
}
