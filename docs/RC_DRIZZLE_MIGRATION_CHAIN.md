# RC Drizzle migration chain risks

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Policy:** inspect only. **No** `drizzle-kit migrate`, **no** destructive SQL, and no journal rewrite; this accepted-subset integration appends only the reviewed 0078–0082 tail.

## Authority

| Artifact | Role |
| --- | --- |
| `drizzle/meta/_journal.json` | **Executable apply order** (idx 0–82, tags `0000`…`0082`) |
| `drizzle/*.sql` on disk | Files that *may* be applied if named in the journal |
| `drizzle/schema.ts` | Desired TypeScript schema (can drift from applied SQL) |
| `FAULTLINE_DATABASE_SCHEMA.md` | Readable backup map (2026-08-13; older than 0070) |

Dialect: **mysql**. Journal `version: 7`, entries `version: 5`.

## Journal chain (clean)

`_journal.json` has **83** entries, idx 0–82, unique tags:

`0000_solid_martin_li` … `0082_durable_alert_events`

No duplicate **tags** in the journal. Numeric prefixes in the journal are unique.

## Dual / repair numbering (files **not** in the journal)

These SQL files exist beside the journaled twins. Drizzle Kit will **not** apply them unless someone runs them by hand.

| Disk file | Journaled sibling (applied order) | Repair intent (non-destructive read) |
| --- | --- | --- |
| `0056_shadow_model_engine_version_repair.sql` | `0056_wandering_menace` | `ADD COLUMN engineVersion varchar(20) DEFAULT 'v3h-1.0.0'` on `shadowModelReadings` |
| `0057_shadow_model_legacy_flag_default_repair.sql` | `0057_flawless_nuke` | `MODIFY COLUMN v3hHigher boolean NOT NULL DEFAULT false` |
| `0058_shadow_forward_outcomes_compatibility_repair.sql` | `0058_lovely_skin` | `ADD COLUMN` horizon + return/VIX/stress fields on `shadowForwardOutcomes` |
| `0059_shadow_forward_outcomes_legacy_horizon_nullable.sql` | `0059_futuristic_daredevil` | `MODIFY COLUMN horizonDays int NULL` |

**Risk:** a restore script that applies `drizzle/*.sql` in **filename sort order** (or applies every `0056_*.sql`) can double-apply or apply repairs **before/after** the official tag and fail on “duplicate column.” A host that only uses `drizzle-kit migrate` follows the journal and **skips** the repair files.

`schema.ts` currently declares the shadow columns those repairs add. If production was repaired by hand, journal-only migrate on a fresh DB may be **missing** those columns until a **new numbered** migration (not a second `0056_`) is added. Conversely, if production only ran the journal, the repair files are leftover and must not be replayed blindly.

## Undocumented order

1. Repair filenames reuse `0056`–`0059` but are **outside** `_journal.json`.
2. Snapshot JSON exists for journaled ids (`meta/0056_snapshot.json` = wandering_menace, etc.). There are **no** snapshots for `*_repair` tags.
3. `package.json` `db:push` = `drizzle-kit generate && drizzle-kit migrate` — would generate a **new** tag, not consume repair files.
4. `FAULTLINE_DATABASE_SCHEMA.md` predates 0060–0070 and does not list the dual-number trap.

## What this RC does **not** do

- No `DROP TABLE` / `DROP COLUMN` / data backfill.
- No rewrite of preexisting journal records; accepted entries 0078–0082 are append-only after 0077.
- No migration application, restored-database rehearsal, deployment, or boot migration.
- No applying repairs.

## Owner restore order (safe)

1. Provision empty MySQL.
2. Apply **only** tags in `_journal.json` in idx order (`drizzle-kit migrate`).
3. Diff `information_schema` vs `schema.ts` for `shadowModelReadings` / `shadowForwardOutcomes`.
4. If columns missing, add a **new** 0083+ migration — do not execute the orphan `0056_*repair*` files unless their `ADD COLUMN` is proven absent and wrapped in a checked migration.
5. Never filename-glob migrations, including `0056_*.sql`; apply only ordered tags in `_journal.json`, never orphan or rejected files.

## Acceptance

| Item | Label |
| --- | --- |
| Journal 0000–0082 unique and ordered | SOURCE REGISTRATION ONLY / operationally blocked |
| Orphan repair SQL reusing 0056–0059 | **IMPORTANT** — restore footgun; no prod change here |
| schema vs prod unknown (no DB in this agent) | **IMPORTANT** — owner must diff |
| Destructive migrate | Not done |

## 0077 governed-research immutability acceptance (local implementation completeness)

- **Journal placement:** `0077_governed_research_immutability` is appended as
  idx 77 immediately after `0076_algorithm_outcome_fk_name`; no earlier journal
  record is changed.
- **Scope:** the migration creates the four established `BEFORE UPDATE` and
  `BEFORE DELETE` guards for `governedResearchObservations` and
  `governedResearchResolutions`. It does not recreate or drop data tables,
  backfill data, modify unrelated writers, or add automatic migration at boot.
- **Local acceptance:** an isolated MariaDB test seeds forward and reconstructed
  history before applying the migration, verifies the preexisting rows remain,
  exercises all four guards for both history paths, and confirms follow-up
  inserts and an unrelated writer still succeed.
- **Repeat and rollback policy:** Drizzle applies this creation-only migration
  once through the journal. Do not replay its raw SQL as a retry: an existing
  trigger is a condition to inspect, not a reason to issue `DROP TRIGGER`.
  Removing any guard requires explicit owner/operator approval and a separately
  reviewed rollback migration; this change does not silently disable a guard.
- **Deployed gate:** this is local source completeness evidence only. It does
  not prove deployed or production immutability; an authorized deployment
  operator must confirm the journaled migration and restrictive DDL privileges
  in the target environment.

## 0078–0082 accepted Wave 2 registration

- **Journal placement:** the accepted additive migrations are appended directly
  after unchanged `0077_governed_research_immutability` as idx 78–82 in this
  exact order: `0078_payment_event_linkage`, `0079_decision_outcome_provenance`,
  `0080_publishing_delivery_claims`, `0081_admin_audit_events`, and
  `0082_durable_alert_events`.
- **Scope:** registration records only these accepted source artifacts. It does
  not modify earlier history, alter `drizzle/schema.ts`, apply SQL, generate
  metadata snapshots, or authorize provider, deployment, customer, or
  production activity.
- **Required independent gate:** final QA must review this wiring and rehearse
  the complete ordered chain against an isolated restored database before any
  deployment decision. Startup and manual migration execution remain excluded.

## Related

- `drizzle/meta/_journal.json`
- `docs/RC_PROJECT_CONFIG_SHAPES.md` (`DATABASE_URL` / `DRIZZLE_DATABASE_URL` slots)
