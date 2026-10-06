/**
 * Sector Rotation snapshot store — append-only rows in the EXISTING generic
 * key/JSON table `marketMemory` (no schema change, no migration).
 *
 *  - One row per (methodVersion, completed session): memoryKey
 *    `sector-rotation:<methodVersion>:<YYYY-MM-DD>` (unique index on memoryKey).
 *  - INSERT only. No UPDATE, no DELETE, no upsert: a second insert for the same
 *    session fails on the unique key and is reported as DUPLICATE (already saved).
 *  - memoryValue holds a versioned envelope {kind, envelopeVersion, methodVersion,
 *    sessionDate, generatedAt, stateId, readingHash, reading}; the hash is verified on load.
 *  - Reads select the newest key under the current method version's prefix only.
 *  - Cross-process build claim (insert-only): memoryKey
 *    `sector-rotation-claim:<methodVersion>:<session>:<bucket>` — first INSERT wins;
 *    a duplicate means another instance already claimed this 10-minute bucket. No UPDATE
 *    / DELETE: a crashed holder is superseded when the next bucket opens. The snapshot
 *    row itself remains the once-per-session gate.
 */
import { createHash } from "node:crypto";
import { desc, like } from "drizzle-orm";
import { marketMemory } from "../../drizzle/schema";
import { getDb } from "../db";
import {
  SECTOR_ROTATION_COLLECTOR_POLICY as POLICY, SECTOR_ROTATION_METHOD_VERSION, SECTOR_ROTATION_SNAPSHOT_ENVELOPE_VERSION,
  type SectorRotationReading, type SectorRotationSnapshotMeta,
} from "../../shared/sectorRotation";

export const SNAPSHOT_KEY_PREFIX = `sector-rotation:${SECTOR_ROTATION_METHOD_VERSION}:` as const;
export const CLAIM_KEY_PREFIX = `sector-rotation-claim:${SECTOR_ROTATION_METHOD_VERSION}:` as const;
export const SNAPSHOT_WRITER = "sectorRotationCollector" as const;
export const snapshotKey = (sessionDate: string) => `${SNAPSHOT_KEY_PREFIX}${sessionDate}`;
/** Insert-only lease key for one claim bucket (no UPDATE/DELETE; next bucket supersedes a crashed holder). */
export const claimKey = (sessionDate: string, nowMs: number) => {
  const bucket = Math.floor(nowMs / (POLICY.claimBucketMinutes * 60_000));
  return `${CLAIM_KEY_PREFIX}${sessionDate}:${bucket}`;
};

export interface StoredSnapshot { meta: SectorRotationSnapshotMeta; reading: SectorRotationReading }
export interface SnapshotStore {
  isAvailable(): Promise<boolean>;
  loadLatest(): Promise<StoredSnapshot | null>;
  insert(snapshot: StoredSnapshot): Promise<"INSERTED" | "DUPLICATE">;
  /** First INSERT for this session+bucket wins. DUPLICATE → another instance holds the lease. */
  tryClaim(sessionDate: string, nowMs: number): Promise<"CLAIMED" | "HELD">;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export class SnapshotTooLargeError extends Error {}

/** Builds the stored form. Throws SnapshotTooLargeError above maxSnapshotBytes (nothing is truncated). */
export function encodeSnapshot(reading: SectorRotationReading): { key: string; value: string; snapshot: StoredSnapshot } {
  const sessionDate = reading.benchmark.latestCompletedSession;
  if (!sessionDate) throw new Error("Reading has no completed session; not a valid snapshot.");
  const readingJson = JSON.stringify(reading);
  const meta: SectorRotationSnapshotMeta = {
    key: snapshotKey(sessionDate), envelopeVersion: SECTOR_ROTATION_SNAPSHOT_ENVELOPE_VERSION, methodVersion: SECTOR_ROTATION_METHOD_VERSION,
    sessionDate, generatedAt: reading.generatedAt, persistedAt: null, stateId: reading.canonical.stateId, readingHash: sha256(readingJson),
  };
  const value = JSON.stringify({ kind: "sector-rotation-snapshot", envelopeVersion: meta.envelopeVersion, methodVersion: meta.methodVersion, sessionDate, generatedAt: meta.generatedAt, stateId: meta.stateId, readingHash: meta.readingHash, reading });
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > POLICY.maxSnapshotBytes) throw new SnapshotTooLargeError(`Snapshot is ${bytes} bytes (limit ${POLICY.maxSnapshotBytes}); not saved.`);
  return { key: meta.key, value, snapshot: { meta, reading } };
}

/** Parses and verifies a stored row. Returns null for anything that is not an intact snapshot of the current method version. */
export function decodeSnapshot(key: string, value: string, persistedAt: string | Date | null): StoredSnapshot | null {
  if (!key.startsWith(SNAPSHOT_KEY_PREFIX)) return null;
  let env: { kind?: string; envelopeVersion?: number; methodVersion?: string; sessionDate?: string; generatedAt?: string; stateId?: string | null; readingHash?: string; reading?: SectorRotationReading };
  try { env = JSON.parse(value); } catch { return null; }
  if (env.kind !== "sector-rotation-snapshot" || env.envelopeVersion !== SECTOR_ROTATION_SNAPSHOT_ENVELOPE_VERSION || env.methodVersion !== SECTOR_ROTATION_METHOD_VERSION) return null;
  if (!env.reading || !env.sessionDate || key !== snapshotKey(env.sessionDate)) return null;
  if (env.reading.methodVersion !== SECTOR_ROTATION_METHOD_VERSION || env.reading.benchmark?.latestCompletedSession !== env.sessionDate) return null;
  if (sha256(JSON.stringify(env.reading)) !== env.readingHash) return null;
  const persisted = persistedAt == null ? null : new Date(persistedAt).toISOString();
  return {
    meta: { key, envelopeVersion: SECTOR_ROTATION_SNAPSHOT_ENVELOPE_VERSION, methodVersion: SECTOR_ROTATION_METHOD_VERSION, sessionDate: env.sessionDate, generatedAt: env.generatedAt ?? env.reading.generatedAt, persistedAt: persisted, stateId: env.stateId ?? null, readingHash: env.readingHash! },
    reading: env.reading,
  };
}

const isDuplicateKey = (error: unknown) => {
  const e = error as { code?: string; errno?: number; message?: string; cause?: { code?: string; errno?: number; message?: string } };
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || e?.cause?.code === "ER_DUP_ENTRY" || e?.cause?.errno === 1062 || /Duplicate entry/i.test(`${e?.message ?? ""} ${e?.cause?.message ?? ""}`);
};

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
/** The production store over `marketMemory`. `dbProvider` is injectable for tests. */
export function createMarketMemorySnapshotStore(dbProvider: () => Promise<Db | null> = getDb): SnapshotStore {
  return {
    async isAvailable() { return (await dbProvider()) != null; },
    async loadLatest() {
      const db = await dbProvider();
      if (!db) return null;
      const rows = await db.select({ memoryKey: marketMemory.memoryKey, memoryValue: marketMemory.memoryValue, updatedAt: marketMemory.updatedAt })
        .from(marketMemory).where(like(marketMemory.memoryKey, `${SNAPSHOT_KEY_PREFIX}%`)).orderBy(desc(marketMemory.memoryKey)).limit(5);
      for (const row of rows) { const s = decodeSnapshot(row.memoryKey, row.memoryValue, row.updatedAt); if (s) return s; }
      return null;
    },
    async insert(snapshot) {
      const db = await dbProvider();
      if (!db) throw new Error("Snapshot store unavailable (no database connection).");
      const { key, value } = encodeSnapshot(snapshot.reading);
      try {
        await db.insert(marketMemory).values({ memoryKey: key, memoryValue: value, description: `Sector Rotation snapshot ${snapshot.meta.sessionDate} (${SECTOR_ROTATION_METHOD_VERSION}, append-only)`, writtenBy: SNAPSHOT_WRITER });
        return "INSERTED";
      } catch (error) {
        if (isDuplicateKey(error)) return "DUPLICATE";
        throw error;
      }
    },
    async tryClaim(sessionDate, nowMs) {
      const db = await dbProvider();
      if (!db) throw new Error("Snapshot store unavailable (no database connection).");
      const key = claimKey(sessionDate, nowMs);
      const value = JSON.stringify({ kind: "sector-rotation-claim", methodVersion: SECTOR_ROTATION_METHOD_VERSION, sessionDate, claimedAt: new Date(nowMs).toISOString(), bucketMinutes: POLICY.claimBucketMinutes });
      try {
        await db.insert(marketMemory).values({ memoryKey: key, memoryValue: value, description: `Sector Rotation build claim ${sessionDate} (insert-only lease)`, writtenBy: SNAPSHOT_WRITER });
        return "CLAIMED";
      } catch (error) {
        if (isDuplicateKey(error)) return "HELD";
        throw error;
      }
    },
  };
}
