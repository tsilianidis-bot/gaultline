# Track record readiness — 2026-10-17

Draft review of PR #95 (`cursor/track-record-core-integration-f2f3`). No production database was written. No migration was applied outside a disposable local MariaDB. No pull request was merged. No flag, cron writer, evidence collector, or checkout runtime was enabled. Pressure Index math, canonical MarketState calculations, and visual designs were not changed.

**Integration: NO-GO to merge into `release/2026-10-05-ux-r3`.** The draft stack merges cleanly and the isolated tests passed. Merge still waits on the blockers below, especially database-level immutability and unfinished live-provider proof.

**Production activation: NO-GO.** A clean branch is not permission to turn collection or publication on.

## 1. Commits and pull requests

| PR | Head | Base | Draft | Role |
| --- | --- | --- | --- | --- |
| release | `1cb5dee13832c0556ec5a380ecc4ffb02513e875` | live | — | Production branch |
| #87 | `bd5f5d5e5489ee224e8def007dce38ed60ac0871` | release | yes | Stripe webhook fixes |
| #85 | `fc67d43a3947dafc21ac1f1269780fba81e15026` | release | no | Public-answer polish. This environment cannot convert a GitHub PR back to draft |
| #84 | `a0d7f47754311093110c42384380b1e0397b571e` | release | yes | PI v2 research. Contains `drizzle/0074_pi_v2_research_private.sql`. Do not apply it |
| #88 | `3eb4281157f1d34aa41277a53ee13e998755f835` | `main` | yes | Integrity gate. Retarget the GitHub base to release before any later landing |
| #90 | `afbd8dea48520a63e58213ad690d6e4f4418de9b` | release | no | Evidence pipeline, already merged with release. Contained in #95 |
| #91 | `06dc2305ceaf6b91e310b289b96352d7d206d9df` | release | yes | Track record ledger. Contained in #95 |
| #93 | `5988f75e27f0ddcd091120083f4b8dffc7f22339` | release | yes | Review patch only. Do not merge |
| #95 | `33df1d05d22e3e3a875ec82f17f2467851bd546d` plus the readiness commit on this branch | release | yes | Integration vehicle. Contains #90 and #91 |
| #94 | `a84b074a0ca5` | #87 | yes | Checkout enablement, ancestor of #96 |
| #96 | `fe90d8a13ba8` | #94 | yes | Checkout kill switch. Separate from this release |
| #100 | `51d94e899f65` | release | yes | Visual presentation. Separate from this release |

#95 parents already on the branch before this readiness commit: `b60a07efdf934e3273e1822586e1b3c5acaa3903` (merge of #91 onto #90's release merge `afbd8de`) and integration commit `33df1d0`.

## 2. End-to-end evidence

Disposable MariaDB on `127.0.0.1:3308`, database `track_record_pipeline`. Production-looking URLs are refused. The happy path uses gate-verified **fixture** inputs passed through `buildEvidenceSnapshot` and `IntelligenceEvidenceCollector`. Those fixtures are not live prints and were not described as live-verified market data from Yahoo or FRED.

`server/trackRecordPipeline.e2e.test.ts`: 2 passed.

| Check | Result |
| --- | --- |
| Gate-verified fixture snapshot | `quote:SPY`, `fred:DGS10`, and `fred:BAMLH0A0HYM2` are `verified` / `observed`. Canonical credit engine stays `modeled` / `delayed`. |
| Identity, timestamps, hashes, state id | Source ids, observation and receipt timestamps, sha256 references, and canonical state `state-pipeline-fixture-1` survive store readback. Reference JSON has no measurement `value`. |
| Only `SCHEDULED_CRON` | `CRON_DEPLOY`, `MANUAL`, `AD_HOC`, and `BACKFILL_RECOVERY` return `not_scheduled` and write nothing. |
| One assessment | One `live_verified` row after the authorized run. |
| No duplicate | A second run, including one with a different Pressure Index, returns `already_recorded`. Stored pressure stays 42. |
| Bad evidence | `evidence_missing`, `evidence_stale`, `evidence_failed`, `integrity_gate_failed`, `reconstructed_input`. Each leaves the ledger empty. |
| Reconstructions stay distinct | A reconstruction row is `historical_reconstruction` / `reconstructed_research`. Directional sample size stays 1. |
| Rewrite and delete | Application insert-if-absent does not replace the original JSON. Deleting the parent of a resolution fails the foreign key. A direct SQL `UPDATE`, and a `DELETE` of a childless reconstruction row, are **not** blocked. The probe rolled back; the two rows remained. |
| Scenario C | A, B, and C share one invalidation. A founder-thesis affinity throws and writes nothing. |
| Classification | A later development equal to the frozen invalidation classifies `contradicted` twice. A stored resolution label of `supported` does not change that. Directional accuracy stays withheld at sample 1. |

Earlier isolated workflow (`server/trackRecordWorkflow.e2e.test.ts`, port 3307): 2 passed. Capture and accountability unit tests: 22 passed.

## 3. Live providers versus fixtures

Read-only. Nothing was written to a database.

| Source | This run (2026-10-17, market closed) | Used for a forward row |
| --- | --- | --- |
| Yahoo adapter `getQuote("SPY")` | HTTP path succeeded. `source=yahoo`, `marketState=CLOSED`, observation `2026-10-16T20:00:00.000Z`, age 1395 minutes. Gate: `stale`. Does not support a current claim. | No |
| CoinGecko `getGlobalStats()` | One HTTP 429, then a response. Observation age 9 minutes. Gate: `verified`. CoinGecko is not one of the three required track-record inputs. | No |
| FRED | Not called. `FRED_API_KEY` is unset. Unauthenticated observations endpoint returned HTTP 400. | Outstanding |

Fixture tests prove the gate and the recorder. They do not prove a weekday quote inside the 20-minute window, and they do not prove FRED. Those two live checks remain outstanding before any activation.

## 4. Migration 0074

File: `drizzle/0074_pi_v2_research_private.sql` on #84. Journal idx 74, tag `0074_pi_v2_research_private`, `when` 1791936000000. Release already ends at idx 73, `0073_pressure_v2_shadow`, `when` 1791864000000. No other PR in this set adds a migration. #88's drizzle diff against release is the `main` base, not a new migration.

The SQL creates four new tables (`piV2ResearchRawInputs`, `piV2ResearchSnapshots`, `piV2ResearchLedger`, `piV2ResearchMonitorEvents`), unique keys, check constraints, and append-only triggers. It does not alter an existing production table. Existing production rows are untouched if it is applied. It has no foreign key into current tables.

Applied on disposable MariaDB 10.11 at `127.0.0.1:3309`, database `pi_v2_migration`, 20 statements, then dropped with the datadir. Not applied to any other database.

| Probe | Result |
| --- | --- |
| Insert raw input and read it back | Passed |
| Same series, date, vintage, and value again | Duplicate key |
| Second snapshot for the same spec and date | Duplicate key |
| Snapshot `recordClass=RETROSPECTIVE` | Rejected (enum) |
| Snapshot date before 2026-10-16 | Check `piV2Snap_on_grid` failed |
| Retrospective ledger row pointing at a snapshot | Check `piV2Ledger_class_origin` failed |
| `UPDATE` snapshot / `DELETE` raw input | Trigger: append-only |

Rollback, if it were ever applied, is drop `piV2ResearchLedger`, `piV2ResearchMonitorEvents`, `piV2ResearchSnapshots`, then `piV2ResearchRawInputs`. Triggers drop with the tables. Do not apply 0074 as part of the track-record release. A corrected value for the same vintage is a new row, because the unique key includes `valueText`. That matches the append-only design.

## 5. Evidence collector

`FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED` is on only when the value is exactly `true`. Unset is off. `server/_core/index.ts` starts the collector only inside that check. Sector rotation still starts with the process. The regime route remains infer only.

The collector's `refresh()` itself does not re-check the env flag. Process start is the gate. Turning the variable off does not stop an already running timer until the process restarts.

## 6. Scheduled writer

`TRACK_RECORD_CRON_WRITES` is on only when the value is exactly `true`. The publication flag `intelligence_track_record` is on only when the row exists and `enabled = 1`. A missing row stays off. The inert script `scripts/intelligence-track-record-flag.sql` inserts `enabled=0` and was not run.

Isolated sequence, in order: cron unset blocks before the flag; cron on with the flag at 0 returns `flag_disabled`; flag on with cron unset still returns `cron_writes_disabled`. The flag cannot bypass a missing, stale, failed, reconstructed, or integrity-rejected snapshot. A passing snapshot still requires `SCHEDULED_CRON`.

The authorized window is `[18:00, 18:30) UTC`, which is 14:00–14:30 America/New_York during EDT and 13:00–13:30 during EST. That is before the 16:00 ET cash close. `server/scheduledSeismograph.ts` comments "after market close." The code, not that comment, decides the trigger. A hit outside the window is `CRON_DEPLOY` and records nothing.

## 7. Persistence and readback

Forward and reconstruction rows were read back from the disposable database with the classes above. Developments and resolutions are additional rows. The original assessment JSON did not change. Metrics ignored the stored `supported` label and stayed withheld.

Database gap, confirmed inside a transaction that was rolled back: `UPDATE` of a forward row succeeds, and `DELETE` of a reconstruction row with no resolution succeeds. `DELETE` of a forward row that has a resolution fails `ON DELETE RESTRICT`. The application code has no update or delete of these tables. 0074's trigger pattern was not copied onto the track-record tables, and this review did not add a migration.

## 8. Event registry

Proposal: `docs/STRESS_EVENT_REGISTRY_PROPOSAL.md`. Version 1 was not populated. No event counts or benchmark results were added.

## 9. Blockers

1. **Production activation.** Collector, cron writer, publication flag, and checkout runtime stay off. Activation is a separate NO-GO.
2. **Database immutability.** Governed research rows are append-only in application code only. SQL can update them, and can delete a row that has no resolution.
3. **Live evidence.** FRED was not verified. The live Yahoo quote was stale because the session was closed. CoinGecko verified and is not sufficient for a forward assessment.
4. **Schedule comment.** 18:00 UTC is not after the US cash close. Do not activate against the comment.
5. **Empty registry.** Missed-warning and benchmark rates stay at sample 0 until a new version is frozen. That is intentional.
6. **#88 base.** The trial merge onto release was clean. The GitHub PR still targets `main`.
7. **#90 and #85 are not drafts.** They were not merged.
8. **Checkout stack.** #94 and #96 compile `CHECKOUT_ENABLED` true. `CHECKOUT_RUNTIME_ENABLED` still defaults off. Keep them out of this release.
9. **0074.** Reviewed and proven only on a disposable database. Do not apply it for track record.

## 10. Release sequence

Do not merge this sequence now. If a later review merges with every switch left off:

1. #87 onto release.
2. #85 onto that.
3. #84 onto that. Leave `0074` unapplied.
4. Retarget #88 from `main` to `release/2026-10-05-ux-r3`, then merge it.
5. #95. It already contains #90 and #91. Do not merge #90, #91, or #93 as well.

Local detached trial, not pushed:

- After #87 `7cad11fb214910f3ec83f4b949f901b1cb419523`
- After #85 `d3fc7fcf21df462b3710e0d0410e8690a8fda67a`
- After #84 `596f77993062d3273af9f4bc800d78bd80348c69`
- After #88 `caf89dee7387fef86c3fe8de2df157ae601beb98`
- After #95 `30ab1d13269075cad4a960589fddd11366e1f11b` (clean)
- #96 onto that tip, which already contains #94: `98c408388e773178080589f1530eda2a180deede` (clean)
- #100 onto that: `ded942e61883a42d2157748f73e3067cf446f6f7` (clean)

#96 and #100 did not conflict with the track-record files. They are still separate releases. #96 changes checkout code. #100 adds visual files only. Neither was merged.

## 11. Integration verdict

**NO-GO to merge.** The draft is the right review vehicle: one clean tip, switches off, tests passing. Merging waits until the database immutability gap is accepted or closed without a production migration, live FRED and an in-session quote check are recorded, and #88's base is retargeted.

## 12. Production activation plan (not approved)

Do not execute this list.

1. Railway: confirm `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED` is absent and `TRACK_RECORD_CRON_WRITES` is absent. Confirm `CHECKOUT_RUNTIME_ENABLED` is absent. Confirm `FRED_API_KEY` and the quote provider used by the collector are the intended credentials. Do not print the values.
2. Migrations: track record needs none. Do not apply 0074 unless PI v2 research is explicitly in scope, and then only after 0073.
3. Collector: a restart with the evidence env set to `true` starts the in-process timer. A restart without it is what stops the timer.
4. Cron: `POST /api/scheduled/seismograph-daily` with the existing bearer, only inside `[18:00, 18:30) UTC`. Any other trigger records nothing even if both track-record switches are on.
5. Freshness: require a recorded snapshot whose SPY, DGS10, and HY OAS observations are `verified`, newer than 20 minutes for the snapshot, and whose canonical state id is present. A closed-market Yahoo print like the one on 2026-10-17 must record nothing.
6. Flag: insert the flag row at `enabled=0` only when an operator chooses to. Set `enabled=1` only after a scheduled run has been shown to no-op or to append exactly one row in a non-production database.
7. Public page: `/intelligence-track-record` stays "This record is not published." until `enabled=1`. The dev `?preview=example` path is not that switch.
8. Logs: capture logs a non-secret reason when it refuses bad evidence. Silent no-ops are cron off, flag off, and non-scheduled triggers. Alert on `evidence_failed`, `integrity_gate_failed`, and `database_unavailable`. Do not alert on the silent no-ops.
9. Emergency disable: set the flag row to `0` (stops new assessments on the next read). Unset `TRACK_RECORD_CRON_WRITES`. Unset the evidence env and restart to stop collection. Existing rows stay. The public page hides when the flag is off.
10. Rollback: revert the release commit. Drop 0074 tables only if that migration was applied. Do not delete governed research rows to "undo" a record; append a later observation instead. If a bad forward row was created, disable the flag and cron writer first.

## Test counts from this review

- `tsc --noEmit`: passed.
- Full suite on this branch: 280 files passed, 7 skipped; 3,550 tests passed, 44 skipped, 0 failed. Release `1cb5dee` on the same VM was 270 files passed, 7 skipped; 3,500 tests passed, 44 skipped, 0 failed. The added file is the pipeline e2e (2 tests). No new failures. This VM is UTC, so `getISOWeek` passes. `polygon.key.test.ts` stayed inside the 44 skipped tests.
- Pipeline e2e: 2 passed. Workflow e2e: 2 passed. Capture and accountability unit tests: 22 passed.
- 0074 disposable apply: 20 SQL statements, constraint probes listed above, 0 statements failed.
