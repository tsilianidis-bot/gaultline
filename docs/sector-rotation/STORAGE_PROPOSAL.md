# Sector Rotation — storage proposal (design only; NOT implemented)

Status: **proposal**. This branch ships no migration, no table, no writer and performs no writes. Reads of
`sectorRotation.current` are cache-only and read-only.

## What would be stored
One `SectorRotationReading` (see `shared/sectorRotation.ts`, `schemaVersion` 1, `methodVersion` `sector-rotation-v1.0.0`)
per scheduled FAULTLINE run, produced by the pure function `buildSectorRotationReading(inputs)` at capture time. It already
contains: methodVersion, generatedAt, canonical link (stateId, stateHash, stateGeneratedAt, runId, regime, Pressure Index),
benchmark, the 11 sector rows (returns, RS-Ratio, RS-Momentum, quadrant, arrow, rank, prior rank, rank change, breadth,
action class with evidence), leadership changes, macro drivers each with its own `asOf` and status, driver links, watch
indicators, top 5 winners / losers (today %, basis/as-of, 5D, volume ratio, catalyst class, verbatim headline + publisher + URL +
publishedAt, co-move evidence, Q3 alignment, early-indicator flag), summary counts, narrative and `missingData` flags.

## Proposed table (MySQL, drizzle style — not created)
```sql
CREATE TABLE sector_rotation_readings (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  reading_id       VARCHAR(96)  NOT NULL UNIQUE,   -- "sr:<generatedAt>:<sha256(readingJson) first 16>"
  schema_version   INT          NOT NULL,
  method_version   VARCHAR(64)  NOT NULL,
  generated_at     TIMESTAMP(3) NOT NULL,
  run_id           VARCHAR(128) NULL,              -- scheduled run that captured it
  state_id         VARCHAR(160) NULL,              -- intelligenceStateManifests.stateId read beside it
  regime           VARCHAR(64)  NULL,
  pressure_index   DECIMAL(6,2) NULL,
  status           VARCHAR(16)  NOT NULL,          -- OK | STALE | UNAVAILABLE
  benchmark_session DATE        NULL,              -- latest completed SPY session
  reading_hash     CHAR(64)     NOT NULL,          -- sha256 of reading_json
  reading_json     LONGTEXT     NOT NULL,          -- full SectorRotationReading
  created_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_generated (generated_at),
  INDEX idx_state (state_id),
  INDEX idx_method_session (method_version, benchmark_session)
);
```
Optional denormalised child table for querying movers across time (also append-only):
`sector_rotation_movers(reading_id, side ENUM('winner','loser'), position TINYINT, ticker, sector_etf, today_pct, basis_kind,
basis_as_of, return_5d_pct, volume_ratio, catalyst_class, event_family, news_id, news_publisher, news_published_at, news_url,
thesis_alignment, early_indicator)`.

## Rules
- **Append-only.** No UPDATE / DELETE paths. Corrections are new rows with `correction_of` (reading_id) and a reason, mirroring
  `intelligenceStateManifests`.
- **Versioned.** `schema_version` and `method_version` on every row; a method change never rewrites old rows. Comparisons across
  readings are only made within the same `method_version`.
- **Captured, not recomputed.** Rows store the inputs-as-seen result at capture time (including catalyst classification and its
  source item). Historical validation must not re-tune parameters after seeing outcomes.
- **Linked.** `run_id` / `state_id` tie each reading to the FAULTLINE run/state it was captured beside; the writer would run inside the
  scheduled job after the canonical manifest is committed, never on a user read.
- **Fail closed.** UNAVAILABLE readings are stored as such (with `missingData`), never skipped or back-filled.

## Out of scope for this branch
Migration file, schema change in `drizzle/`, writer, scheduler hook, backfill. Each needs its own approval (DB migration is not
allowed on this branch).
