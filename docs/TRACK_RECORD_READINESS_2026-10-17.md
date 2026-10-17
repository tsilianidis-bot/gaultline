# Track record readiness — 2026-10-17

Draft review of PR #95 (`cursor/track-record-core-integration-f2f3`). Code commit `1b1bd44d052a958b1c150de5bffe8614538716f4`. This file is the readiness commit directly above that code. No production database was written. No migration was applied outside a disposable local MariaDB. No pull request was merged. No flag, cron writer, evidence collector, or checkout runtime was enabled. Pressure Index math and canonical MarketState calculations were not changed on this branch. Visual designs were not changed.

**Integration: NO-GO to merge into `release/2026-10-05-ux-r3`.** The immutability script, the NYSE window, and the skipping FRED check are in the draft. Merge still waits on a live FRED run, an in-session quote, retargeting #88 off `main`, and a separate review before #97's non-schedule edits land with this branch.

**Production activation: NO-GO.** The trigger script is unapplied, both track-record switches stay off, and live FRED has not been admitted.

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
| #95 | `1b1bd44d052a958b1c150de5bffe8614538716f4` plus this readiness commit | release | yes | Integration vehicle. Contains #90 and #91. Stays draft |
| #97 | `d119512881942bfbc8897b3c36a93aebcbe78f13` | release | no | Session-aware MarketState freshness. Schedule helper consumed here. Not merged into #95 |
| #94 | `a84b074a0ca5` | #87 | yes | Checkout enablement, ancestor of #96 |
| #96 | `fe90d8a13ba8` | #94 | yes | Checkout kill switch. Separate from this release |
| #100 | `51d94e899f65b9026925e927c6f43f941dbdce74` | release | yes | Visual presentation. Separate from this release |

#95 parents already on the branch: `b60a07efdf934e3273e1822586e1b3c5acaa3903` (merge of #91 onto #90's release merge `afbd8de`), integration commit `33df1d0`, readiness commit `2f565fb`, code commit `1b1bd44`. Tests below were run on `1b1bd44`.

## 2. End-to-end evidence

Disposable MariaDB on `127.0.0.1:3308`, database `track_record_pipeline`. Production-looking URLs are refused. The happy path uses gate-verified **fixture** inputs passed through `buildEvidenceSnapshot` and `IntelligenceEvidenceCollector`. Those fixtures are not live prints.

`server/trackRecordPipeline.e2e.test.ts`: 2 passed.

| Check | Result |
| --- | --- |
| Gate-verified fixture snapshot | `quote:SPY`, `fred:DGS10`, and `fred:BAMLH0A0HYM2` are `verified` / `observed`. Canonical credit engine stays `modeled` / `delayed`. |
| Identity, timestamps, hashes, state id | Source ids, observation and receipt timestamps, sha256 references, and canonical state `state-pipeline-fixture-1` survive store readback. Reference JSON has no measurement `value`. |
| Only `SCHEDULED_CRON` | `CRON_DEPLOY`, `MANUAL`, `AD_HOC`, and `BACKFILL_RECOVERY` return `not_scheduled` and write nothing. |
| One assessment | One `live_verified` row after the authorized run. |
| No duplicate | A second run with a different Pressure Index returns `already_recorded`. A third run one minute later, still the same Eastern session date, also returns `already_recorded`. Stored pressure stays 42. |
| Bad evidence | `evidence_missing`, `evidence_stale`, `evidence_failed`, `integrity_gate_failed`, `reconstructed_input`. Each leaves the ledger empty before the authorized append. |
| Reconstructions stay distinct | A reconstruction row is `historical_reconstruction` / `reconstructed_research`. Directional sample size stays 1. |
| Rewrite and delete | Application insert-if-absent does not replace the original JSON. After `scripts/governed-research-append-only.sql` is applied on this disposable database, direct SQL `UPDATE`, `DELETE` of the parent, and `DELETE` of the childless reconstruction all fail `SQLSTATE 45000`. The probe rolled back; the two rows remained and the interpretation was not `mutated`. |
| Scenario C | A, B, and C share one invalidation. A founder-thesis affinity throws and writes nothing. |
| Classification | A later development equal to the frozen invalidation classifies `contradicted` twice. A stored resolution label of `supported` does not change that. Directional accuracy stays withheld at sample 1. |

Earlier isolated workflow (`server/trackRecordWorkflow.e2e.test.ts`, port 3307): 2 passed. Capture and accountability unit tests passed inside the full suite.

## 3. Live providers versus fixtures

Read-only. Nothing was written to a database. This remediation did not repeat the Yahoo or CoinGecko calls and did not call FRED.

| Source | State | Used for a forward row |
| --- | --- | --- |
| Yahoo adapter `getQuote("SPY")` | Prior read on 2026-10-17, market closed. `source=yahoo`, `marketState=CLOSED`, observation `2026-10-16T20:00:00.000Z`, age about 1395 minutes. Gate: `stale`. | No |
| CoinGecko `getGlobalStats()` | Prior read. One HTTP 429, then a response. Observation age about 9 minutes. Gate: `verified`. Not a required track-record input. | No |
| FRED | `FRED_API_KEY` is unset. `server/fredIntegrityGate.live.test.ts` skipped the live case with "FRED live verification skipped: FRED_API_KEY is unset" and asserted that `fetchFredBulk` made no HTTP call. The configured-key case did not run. No key was printed. | Outstanding |

Fixture tests prove the gate and the recorder. They do not prove a weekday quote inside the 20-minute window, and they do not prove FRED observations. When a key is present in the authorized environment, the live test reads `DGS10`, `DGS2`, and `BAMLH0A0HYM2`, classifies each with `evaluateIntelligenceEvidence` at the collector's 96-hour maximum age, and writes nothing.

## 4. Migration 0074

File: `drizzle/0074_pi_v2_research_private.sql` on #84. Journal idx 74, tag `0074_pi_v2_research_private`, `when` 1791936000000. Release already ends at idx 73, `0073_pressure_v2_shadow`, `when` 1791864000000. This branch does not add a journal entry.

The SQL creates four new tables (`piV2ResearchRawInputs`, `piV2ResearchSnapshots`, `piV2ResearchLedger`, `piV2ResearchMonitorEvents`), unique keys, check constraints, and append-only triggers. It does not alter `governedResearchObservations` or `governedResearchResolutions`.

Applied earlier on disposable MariaDB 10.11 at `127.0.0.1:3309`, database `pi_v2_migration`, 20 statements, then dropped with the datadir. Not applied to any other database in that pass.

| Probe | Result |
| --- | --- |
| Insert raw input and read it back | Passed |
| Same series, date, vintage, and value again | Duplicate key |
| Second snapshot for the same spec and date | Duplicate key |
| Snapshot `recordClass=RETROSPECTIVE` | Rejected (enum) |
| Snapshot date before 2026-10-16 | Check `piV2Snap_on_grid` failed |
| Retrospective ledger row pointing at a snapshot | Check `piV2Ledger_class_origin` failed |
| `UPDATE` snapshot / `DELETE` raw input | Trigger: append-only |

Ordering with the new governed-research script, disposable MariaDB on `127.0.0.1:3311`, then discarded:

| Order | Governed insert | PI v2 insert | Governed `UPDATE` | PI v2 `UPDATE` |
| --- | --- | --- | --- | --- |
| 0074, then governed triggers | 1 row | 1 row | `45000` `governedResearchObservations append-only` | `45000` `piV2ResearchRawInputs append-only` |
| Governed triggers, then 0074 | 1 row | 1 row | `45000` `governedResearchObservations append-only` | `45000` `piV2ResearchRawInputs append-only` |

The two scripts do not share tables. Either apply order leaves both writers able to insert and both families append-only. Do not register the governed-research script as idx 74. If it is journaled later, use idx 75 after 0074. Do not apply 0074 as part of the track-record release.

## 5. Evidence collector

`FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED` is on only when the value is exactly `true`. Unset is off. `server/_core/index.ts` starts the collector only inside that check. Sector rotation still starts with the process. The regime route remains infer only.

The collector's `refresh()` itself does not re-check the env flag. Process start is the gate. Turning the variable off does not stop an already running timer until the process restarts.

## 6. Scheduled writer

`TRACK_RECORD_CRON_WRITES` is on only when the value is exactly `true`. The publication flag `intelligence_track_record` is on only when the row exists and `enabled = 1`. A missing row stays off. The inert script `scripts/intelligence-track-record-flag.sql` inserts `enabled=0` and was not run.

Isolated sequence, in order: cron unset blocks before the flag; cron on with the flag at 0 returns `flag_disabled`; flag on with cron unset still returns `cron_writes_disabled`. The flag cannot bypass a missing, stale, failed, reconstructed, or integrity-rejected snapshot. A passing snapshot still requires `SCHEDULED_CRON`.

New callbacks use `nyseSeismographRunWindow` from `shared/nyseSession.ts`. The file blob matches PR #97 at `d119512881942bfbc8897b3c36a93aebcbe78f13` (`git hash-object` `986d1609e6408089c3eb748d7bbdf323aea28f50`). This branch does not keep a second calendar. #97 is not merged here. Its MarketState freshness, CoinGecko timestamp, and cross-engine edits stay on that branch. This branch also does not copy #97's in-process `runScheduledSeismographOnce` map and does not change `runSeismographPipeline`'s `today` from the UTC date to the Eastern date.

Authorized window for a new cron callback: 16:15–16:45 America/New_York, start inclusive and end exclusive. Intl supplies the DST offset. Weekends and full-day holidays are `CLOSED` and classify as `CRON_DEPLOY`. Early-close sessions still run at 16:15 ET; the close is labeled 13:00 ET and is not the run time. The handler returns `{ ok: true, skipped: "outside_nyse_post_close_window" }` without running the pipeline. The host crontab was not changed.

Rows that already have `runProvenance.trigger` keep that trigger. Rows with no run provenance still use the historical classifier `[18:00, 18:30)` UTC (`LEGACY_SCHEDULED_WINDOW` / `LEGACY_OUTSIDE_WINDOW`). A new cron callback at 18:00 UTC is `CRON_DEPLOY`. It is 14:00 EDT or 13:00 EST, before the cash close.

Scheduled assessments use the key `scheduled:nyse:<Eastern session date>`. The original timestamp stays on `assessedAt`. Two authorized captures on the same Eastern date do not create a second row. The database insert-if-absent returns `already_recorded`. The in-memory ledger throws if a later body would rewrite the stored JSON. The next Eastern session date is a different key. Existing stored rows are not rewritten.

Verified by `shared/nyseSession.test.ts` and `server/forwardRunProvenance.test.ts`:

| Instant | Classification |
| --- | --- |
| 2026-03-09 20:15Z | 16:15 EDT, in window |
| 2026-03-09 21:15Z | 17:15 EDT, outside |
| 2026-11-02 21:15Z | 16:15 EST, in window |
| 2026-11-02 20:15Z | 15:15 EST, outside |
| 2026-10-05 20:14:59.999Z / 20:45:00Z | outside; 20:44:59.999Z inside |
| 2026-10-17 20:15Z | Saturday, closed, `CRON_DEPLOY` |
| 2026-11-26 21:15Z | Thanksgiving, closed, `CRON_DEPLOY` |
| 2026-07-03 20:15Z | Observed Independence Day, closed, not an early close |
| 2026-11-27 21:15Z | Day after Thanksgiving, early close, 16:15 EST, `SCHEDULED_CRON` |
| 2026-11-27 18:15Z | 13:15 EST on that early close, `CRON_DEPLOY` |
| Unlabeled row at 18:00Z | `LEGACY_SCHEDULED_WINDOW` |
| Unlabeled row at 20:15Z | `LEGACY_OUTSIDE_WINDOW` |
| Row already marked `SCHEDULED_CRON` | stays `SCHEDULED_CRON` |

`POST /api/scheduled/systemic-regime-infer` remains documented at 19:00 UTC. That is before a 16:15 ET seismograph (20:15Z during EDT, 21:15Z during EST). This branch does not move that job.

## 7. Persistence and readback

Forward and reconstruction rows were read back from the disposable database with the classes above. Developments and resolutions are additional rows. The original assessment JSON did not change. Metrics ignored the stored `supported` label and stayed withheld.

Database protection is `scripts/governed-research-append-only.sql`. It is inert, starts with `-- INERT`, and is not listed in `drizzle/meta/_journal.json`. `drizzle-kit migrate` will not apply it. Current application writers only `INSERT` into these two tables. `marketMemory` and the PI v2 tables are not mentioned. `SELECT` is unaffected.

Direct SQL on disposable MariaDB `127.0.0.1:3310`, database `governed_append_only`, 8 statements, applied twice. Then discarded.

| Statement | Result |
| --- | --- |
| `INSERT` live_verified observation | Allowed |
| `INSERT` unresolved `reconstructed_research` observation | Allowed |
| `INSERT` resolution on the forward row | Allowed |
| `UPDATE` forward row | `45000` `governedResearchObservations append-only` |
| `UPDATE` unresolved reconstruction | `45000` `governedResearchObservations append-only` |
| `DELETE` unresolved reconstruction | `45000` `governedResearchObservations append-only` |
| `UPDATE` resolution | `45000` `governedResearchResolutions append-only` |
| `DELETE` resolution | `45000` `governedResearchResolutions append-only` |
| `DELETE` forward parent | `45000` `governedResearchObservations append-only` |
| `INSERT` another reconstruction after the failures | Allowed |
| `UPDATE` `marketMemory` | Allowed |

Row text was unchanged after the refused statements: forward interpretation stayed `forward`, the unresolved reconstruction stayed `unresolved reconstruction`, and the resolution JSON stayed `{}`.

The same script on the pipeline database (port 3308) made the forward `UPDATE`, the parent `DELETE`, and the childless reconstruction `DELETE` fail `45000`. Application inserts of the assessment and the resolution had already succeeded before that probe. The triggers do not block those inserts.

This script was not applied to production. Protection is absent until an operator runs it.

## 8. Event registry

Proposal: `docs/STRESS_EVENT_REGISTRY_PROPOSAL.md`. Version 1 was not populated. No event counts or benchmark results were added. The registry hash is unchanged.

## 9. Blockers

1. **Production activation.** Collector, cron writer, publication flag, and checkout runtime stay off. Activation is a separate NO-GO.
2. **Trigger script is unapplied.** The SQL exists and was proven on disposable databases. It is not in the journal and was not applied to production. Merging #95 does not install it.
3. **Live evidence.** FRED was not verified. The live test skips while `FRED_API_KEY` is unset. The prior Yahoo quote was stale because the session was closed. CoinGecko verified and is not sufficient for a forward assessment.
4. **Host crontab.** The process now refuses a callback outside 16:15–16:45 America/New_York. The host schedule that still fires at 18:00 UTC would be classified `CRON_DEPLOY` and would record nothing. Changing the host schedule is an activation step, not part of this commit.
5. **#97 is a separate change.** The calendar helper matches. A textual merge also brings #97's Eastern pipeline date, its in-process coalescer, and its MarketState, CoinGecko, and cross-engine edits. Those are not in #95. See the trial below.
6. **Empty registry.** Missed-warning and benchmark rates stay at sample 0 until a new version is frozen. That is intentional.
7. **#88 base.** The trial merge onto release was clean. The GitHub PR still targets `main`.
8. **#90, #85, and #97 are not drafts.** They were not merged by this work.
9. **Checkout stack.** #94 and #96 compile `CHECKOUT_ENABLED` true. `CHECKOUT_RUNTIME_ENABLED` still defaults off. Keep them out of this release.
10. **0074.** Reviewed and proven only on a disposable database. Do not apply it for track record. It does not collide with the governed-research triggers.

## 10. Release sequence

Do not merge this sequence now. If a later review merges with every switch left off:

1. #87 onto release.
2. #85 onto that.
3. #84 onto that. Leave `0074` unapplied.
4. Retarget #88 from `main` to `release/2026-10-05-ux-r3`, then merge it.
5. #95. It already contains #90 and #91. Do not merge #90, #91, or #93 as well.
6. #97 only after a review that accepts its MarketState freshness, CoinGecko timestamp, cross-engine isolation, Eastern pipeline date, and in-process coalescer. Resolve the five files listed below by keeping the track-record capture hook. Do not treat #97 as part of #95.
7. Apply `scripts/governed-research-append-only.sql` only when an operator accepts it, and only after deciding whether to journal it as idx 75. Do not apply it by merging this PR.

Local detached trial, not pushed. Worktree `/tmp/merge-remediation` was discarded from the branch history of this PR.

- After #87 `bd5f5d5e5489ee224e8def007dce38ed60ac0871` (fast-forward)
- After #85 `1b4a514c79aede5d7bf16ce009a664d900a00f9f`
- After #84 `990255a1c5b89ea98768c070d4e9babd95efb600` (0074 file present, not applied)
- After #88 `8117320750347d18ff705854394cf474f8e299ee` (clean)
- After #95 `8a557055bc03285ff9b800a1f3df0465e0b39672` (clean)
- After #97 `6351404591a14a7051625faa9157c71b4a8d5f4f` (resolved locally)
- After #100 `56ed8910d882708999d7e5e10e33533d5e494c5e` (clean)

#97 conflicts, trial resolution only:

| File | Resolution |
| --- | --- |
| `shared/nyseSession.ts` | No conflict. Identical helper. |
| `server/forwardRunProvenance.ts` | Same window logic. Comment conflict only. |
| `server/forwardRunProvenance.test.ts` | Kept the legacy 18:00 UTC cases and the track-record capture assertion. |
| `server/scheduledSeismograph.ts` | Kept the track-record hook inside the pipeline and #97's window skip plus its in-process coalescer. The merge also takes #97's `today = etDateOf(...)` because that line did not conflict. |
| `docs/RC_CRON_HEARTBEAT_REGISTRY.md` | Kept #97's host-schedule row. |
| `todo.md` | Kept both checklists. |

#100 added no conflict. #96 was not retried in this pass; the earlier trial at `2f565fb` merged it clean and it stays out of this release. Checkout and the visual PR stay separate.

## 11. Integration verdict

**NO-GO to merge.** The draft now has database-level append-only SQL, one NYSE schedule helper, session-level duplicate prevention, and a FRED check that skips without a key. Merging still waits on a live FRED admission, an in-session quote, retargeting #88, and an explicit decision on #97's non-schedule edits. Merging does not apply the trigger script and does not turn a flag on.

## 12. Production activation plan (not approved)

Do not execute this list.

1. Railway: confirm `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED` is absent and `TRACK_RECORD_CRON_WRITES` is absent. Confirm `CHECKOUT_RUNTIME_ENABLED` is absent. Confirm `FRED_API_KEY` and the quote provider used by the collector are the intended credentials. Do not print the values.
2. Migrations: track record adds no journal entry. Do not apply 0074 unless PI v2 research is explicitly in scope, and then only after 0073. Apply `scripts/governed-research-append-only.sql` only under a separate acceptance, after 0074 if both are in scope. If it is journaled, use idx 75.
3. Collector: a restart with the evidence env set to `true` starts the in-process timer. A restart without it is what stops the timer.
4. Cron host: `15 16 * * 1-5` in `America/New_York`, so the callback lands in 16:15–16:45 ET. Weekends, holidays, and early-close sessions are decided by `nyseSeismographRunWindow`. A callback outside that window returns the skip payload and records nothing. The old 18:00 UTC callback is `CRON_DEPLOY`.
5. Freshness: require a recorded snapshot whose SPY, DGS10, and HY OAS observations are `verified`, newer than 20 minutes for the snapshot, and whose canonical state id is present. Run `server/fredIntegrityGate.live.test.ts` with `FRED_API_KEY` set in the environment, not on a command line. A closed-market Yahoo print like the one on 2026-10-17 must record nothing.
6. Flag: insert the flag row at `enabled=0` only when an operator chooses to. Set `enabled=1` only after a scheduled run has been shown to no-op or to append exactly one row in a non-production database.
7. Public page: `/intelligence-track-record` stays "This record is not published." until `enabled=1`. The dev `?preview=example` path is not that switch.
8. Logs: capture logs a non-secret reason when it refuses bad evidence. Silent no-ops are cron off, flag off, and non-scheduled triggers. Alert on `evidence_failed`, `integrity_gate_failed`, and `database_unavailable`. Do not alert on the silent no-ops.
9. Emergency disable: set the flag row to `0` (stops new assessments on the next read). Unset `TRACK_RECORD_CRON_WRITES`. Unset the evidence env and restart to stop collection. Existing rows stay. The triggers, once applied, still refuse `UPDATE` and `DELETE`. The public page hides when the flag is off.
10. Rollback: revert the release commit. Drop 0074 tables only if that migration was applied. Drop the four governed-research triggers only if that script was applied; do not drop the tables to remove the triggers. Do not delete governed research rows to undo a record; append a later observation instead. If a bad forward row was created, disable the flag and cron writer first.

## Test counts from this remediation

- `tsc --noEmit`: passed on `1b1bd44`. The following commit only updates this document.
- Full suite on `1b1bd44`: 283 files passed, 7 skipped; 3,557 tests passed, 45 skipped, 0 failed. The previous tip `2f565fb` was 280 files passed, 7 skipped; 3,550 passed, 44 skipped, 0 failed. Added passing tests: NYSE window (4), append-only SQL (2), FRED unset path (1). The live FRED case is the additional skip. No new failures. This VM is UTC, so `getISOWeek` passes. `polygon.key.test.ts` stayed skipped.
- Pipeline e2e: 2 passed, including `45000` on direct SQL mutation and a same-session duplicate. Append-only e2e: 2 passed. Workflow e2e remained in the full suite.
- 0074 disposable apply from the prior review: 20 SQL statements. Ordering probe on port 3311: both orders, inserts allowed, updates `45000`.
