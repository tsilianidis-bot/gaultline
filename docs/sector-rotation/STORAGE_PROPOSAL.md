# Sector Rotation — snapshot storage

Status: **implemented without a migration.** Snapshots are persisted append-only in the **existing** `marketMemory` table
(`drizzle/schema.ts`: `id`, `memoryKey VARCHAR(128) UNIQUE`, `memoryValue TEXT`, `description`, `writtenBy`, `updatedAt`) — a
generic key → JSON store already used for cross-session market state. No table, column or index is added.

## Why `marketMemory`
- Railway's filesystem is ephemeral across deploys and an in-process cache is not persistence; the database is the only durable store.
- `marketMemory` is a generic key/JSON table already used for comparable cross-session market data, so a versioned JSON snapshot fits
  its purpose without a schema change.
- Its unique `memoryKey` gives one row per (method version, session) and makes concurrent builds from several instances safe: the second
  insert fails with a duplicate-key error and is reported as `DUPLICATE`; nothing is overwritten.

## Row format
- `memoryKey` = `sector-rotation:<methodVersion>:<YYYY-MM-DD completed session>` (≤ 50 chars), `writtenBy` = `sectorRotationCollector`.
- `memoryValue` = JSON envelope `{ kind, envelopeVersion: 1, methodVersion, sessionDate, generatedAt, stateId, readingHash, reading }`,
  `reading` = the full `SectorRotationReading`; `readingHash` = sha256 of the reading JSON, verified on every load (a mismatch, a foreign
  method version or a key/session mismatch is ignored).

## Rules
- **Append-only.** The only write is `INSERT`. No UPDATE, DELETE, upsert or `onDuplicateKeyUpdate` exists in the sector code (enforced by
  `server/sectorRotation.source.test.ts`). Corrections would be a new method version, never an edit.
- **Versioned.** A method change writes new keys; old rows are untouched and never compared across versions.
- **Captured, not recomputed.** Each row is the result as seen at capture time, including the catalyst source item.
- **Written by the collector only**, never on a user read.

## Caveats (accepted for launch)
- `memoryValue` is `TEXT` (64 KB). Snapshots are ~32 KB; anything over 60 000 bytes is refused (not truncated) and the build is marked
  failed, so the last valid snapshot stays in service.
- Growth: one ~32 KB row per completed session (~8 MB/year). No pruning job ships (pruning would be a delete).
- The existing public `seismograph.getMarketMemory` listing now excludes `sector-rotation:%` and `sector-rotation-claim:%` keys so its output is unchanged.
- Build claims: `sector-rotation-claim:<methodVersion>:<session>:<bucket>` — insert-only 10-minute leases so two Railway instances do not fan out together. No UPDATE/DELETE; the next bucket supersedes a crashed holder. The snapshot unique key remains the once-per-session write gate.
- No pre-production writes have been made; the first row is written by the deployed collector after the first post-close session.

## Future (not in this branch; needs its own approval)
A dedicated table remains the long-term option if snapshots need querying by column:

```sql
CREATE TABLE sector_rotation_snapshots (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  snapshot_key      VARCHAR(96)  NOT NULL UNIQUE,   -- method_version + session
  method_version    VARCHAR(64)  NOT NULL,
  session_date      DATE         NOT NULL,
  generated_at      TIMESTAMP(3) NOT NULL,
  state_id          VARCHAR(160) NULL,
  status            VARCHAR(16)  NOT NULL,
  reading_hash      CHAR(64)     NOT NULL,
  reading_json      MEDIUMTEXT   NOT NULL,
  created_at        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_method_session (method_version, session_date)
);
```
