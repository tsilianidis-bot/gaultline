# RC Drizzle migration chain risks

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Policy:** inspect only. **No** `drizzle-kit migrate`, **no** destructive SQL, **no** journal rewrite.

## Authority

| Artifact | Role |
| --- | --- |
| `drizzle/meta/_journal.json` | **Executable apply order** (idx 0–71, tags `0000`…`0071` drizzle-kit names) |
| `drizzle/*.sql` on disk | Files that *may* be applied if named in the journal |
| `drizzle/schema.ts` | Desired TypeScript schema (can drift from applied SQL) |
| `FAULTLINE_DATABASE_SCHEMA.md` | Readable backup map (2026-08-13; older than 0070) |

Dialect: **mysql**. Journal `version: 7`, entries `version: 5`.

## Journal chain (clean)

`_journal.json` has **72** entries, idx 0–71, unique tags:

`0000_solid_martin_li` … `0071_systemic_regime_engine`

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
- No journal edit.
- No applying repairs.

## Owner restore order (safe)

1. Provision empty MySQL.
2. Apply **only** tags in `_journal.json` in idx order (`drizzle-kit migrate`).
3. Diff `information_schema` vs `schema.ts` for `shadowModelReadings` / `shadowForwardOutcomes`.
4. If columns missing, add a **new** 0071+ migration — do not execute the orphan `0056_*repair*` files unless their `ADD COLUMN` is proven absent and wrapped in a checked migration.
5. Never filename-glob `0056_*.sql`.

## Acceptance

| Item | Label |
| --- | --- |
| Journal 0000–0071 unique and ordered | CLEANUP / documented |
| Orphan repair SQL reusing 0056–0059 | **IMPORTANT** — restore footgun; no prod change here |
| schema vs prod unknown (no DB in this agent) | **IMPORTANT** — owner must diff |
| Destructive migrate | Not done |

## Related

- `drizzle/meta/_journal.json`
- `docs/RC_PROJECT_CONFIG_SHAPES.md` (`DATABASE_URL` / `DRIZZLE_DATABASE_URL` slots)
