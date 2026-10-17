# Disposable integration — #97, #98, and unique #95

This branch is a review artifact. It is not a release branch. It was not pushed. No pull request was opened. Existing branches and pull requests were not retargeted, force-pushed, or changed in draft status.

Lineage, in order:

1. `release/2026-10-05-ux-r3` at `1cb5dee13832c0556ec5a380ecc4ffb02513e875`
2. Fast-forward PR #97 `fix/release-readiness-integrity` at `d119512881942bfbc8897b3c36a93aebcbe78f13`
3. Fast-forward PR #98 `feature/intelligence-core-phase1-rebased` at `4191b447bb59d61e5b28b64cdb149b8eaf046816`
4. Unique Track Record changes from PR #95 `a38f5c2ae07a16abd84ea49cad460469397e786b` (tested implementation `1b1bd44d052a958b1c150de5bffe8614538716f4`)

#98 already contains #97, which already contains the release commit. The fast-forwards did not rewrite either branch.

## Ownership

| Area | Owner | This branch |
| --- | --- | --- |
| MarketState freshness, source provenance, `shared/nyseSession.ts` | #97 | Kept #97/#98 bytes |
| Verified evidence collector, store, integrity gate, evidence router | #98 | Kept #98 bytes |
| Append-only assessments, capture guards, outcome resolution, read-only publication | #95 | Added from `a38f5c2` |
| Pressure Index methodology | unchanged | Not edited |
| Host scheduler, flags, production database | unchanged | Not activated |

## What was dropped from #95

These #95 edits duplicate #97 or #98 and were not reapplied.

| Path | Decision |
| --- | --- |
| `server/intelligenceEvidence/**`, `shared/intelligenceEvidence.ts`, `shared/intelligenceIntegrity.ts` | Blobs already match #98. #95's copy is the same pipeline #98 owns. Not reintroduced as a second implementation. |
| `shared/nyseSession.ts`, `shared/nyseSession.test.ts` | Identical to #97. #97 remains the calendar. |
| `server/yahooProxy.ts`, `server/coingeckoProxy.ts` | Identical to #98/#97. #95 had no unique source change. |
| `server/canonicalIntelligenceState.ts` and its test | #95 lacks #97's freshness rules. Kept #98. |
| `server/marketStateService.ts` and its test | #95 lacks #97's source-age behavior. Kept #98. |
| `server/crossEngineSynthesis.ts`, `shared/crossEngineSynthesis.ts`, and the synthesis test | #95 lacks #97's domain isolation. Kept #98. |
| `server/coingeckoProxy.test.ts`, `server/coingeckoProxy.timestamp.test.ts`, `server/yahooProxy.freshness.test.ts` | Kept #98's tests. |
| `server/scheduledSeismograph.idempotency.test.ts`, `server/scheduledSeismograph.window.test.ts` | Kept #97. They cover the in-process coalescer and the Thanksgiving skip. |
| `server/_core/index.ts` | #98 already starts the evidence collector only when `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED` is exactly `true`. #95 changed a comment only. Left #98's wording. |
| `server/forwardRunProvenance.ts` | #97 already classifies new runs with `nyseSeismographRunWindow` and keeps `[18:00, 18:30)` UTC for unlabeled history. Dropped #95's comment that said #97 was not merged. |
| `const today = new Date().toISOString().split("T")[0]` inside the seismograph pipeline | #95 had reverted this to UTC. Kept #97's `etDateOf(runContext.runStartedAt)`. |
| `runScheduledSeismographOnce` removal | #95 omitted the in-process guard. Kept #97's guard. The handler still skips outside the NYSE window before that guard runs. |
| `todo.md` replacement of the #97 and #98 checklists with the older #90 evidence checklist | Kept both #97 and #98 sections. Appended a Track Record note. |
| Cron-registry row that said the host crontab was unchanged | Kept #97's required host schedule `15 16 * * 1-5` America/New_York. Added a comment that Track Record has its own gates. The host scheduler was not modified. |

## What was kept from #95

| Path | Why it is unique |
| --- | --- |
| `shared/intelligenceAccountability.ts` | Append-only ledger, Scenario C, session key `scheduled:nyse:<Eastern date>` |
| `server/intelligenceAccountability.ts`, `server/routers/intelligenceAccountability.ts` | Persistence and read-only publication |
| `server/trackRecordCapture.ts` | Independent gates: `SCHEDULED_CRON`, `TRACK_RECORD_CRON_WRITES` exactly `true`, `intelligence_track_record`, fresh verified evidence, reconstruction refusal |
| Track Record tests, including the pipeline and workflow disposable-database tests | Admission, duplicate capture, freshness, reconstruction separation, fail-closed behavior |
| `server/fredIntegrityGate.live.test.ts` | Skips when `FRED_API_KEY` is unset. Live FRED stays outstanding. |
| `scripts/governed-research-append-only.sql` | Inert. Not in `drizzle/meta/_journal.json`. Not applied. |
| `scripts/intelligence-track-record-flag.sql` | Inert insert of `enabled=0`. Not applied. |
| `shared/stressBenchmarkRegistry.ts`, `docs/STRESS_EVENT_REGISTRY_PROPOSAL.md` | Empty frozen registry. Not populated. |
| Client route, page, and flag-gated nav link | Read-only publication surface |
| `closeDbForTests` in `server/db.ts` | Lets the disposable database tests replace the cached connection |
| `vitest.config.ts` include of `shared/nyseSession.test.ts` | Runs #97's calendar tests. Does not add a second calendar. |

## How the overlaps were resolved

`server/scheduledSeismograph.ts` is #97's file plus the capture call at the end of `runSeismographPipeline`. The call is reached only when that pipeline runs. The HTTP handler still returns `outside_nyse_post_close_window` before `runScheduledSeismographOnce`. A repeated callback in the same process does not enter the pipeline again. A later process still cannot append a second assessment for the same Eastern session date. Non-scheduled callers hit `not_scheduled` inside `captureTrackRecordFromScheduledRun` before the flag, the evidence store, or the ledger.

`server/forwardRunProvenance.test.ts` keeps #97's DST, holiday, early-close, and legacy-window cases. It also requires the capture call, the Eastern pipeline date, and the in-process coalescer to all be present. Unlabeled 18:00 UTC rows still resolve to `LEGACY_SCHEDULED_WINDOW`, and the earliest of two unlabeled in-window rows wins.

`server/intelligenceGovernance.ts` keeps #98's manifest code. The `scheduledWindow` comment now names the 16:15–16:45 America/New_York window so it does not still describe the retired 18:00 UTC callback.

## Migration ordering

Neither `scripts/governed-research-append-only.sql` nor #84's `0074_pi_v2_research_private.sql` is in the journal on this branch, and neither was applied. Release still ends at idx 73. #84 owns idx 74. The governed-research script, if an operator later journals it, belongs at idx 75. The two scripts touch disjoint tables. Prior disposable probes showed either order leaves inserts working and `UPDATE` blocked with `SQLSTATE 45000`. That is an ordering note, not an instruction to apply either file.

## Tests on `5b54c286af5cd1f5dc0ee54e5d60bf335c9618ba`

`tsc --noEmit` passed. `FRED_API_KEY` was unset and was not printed.

Focused regressions: 13 files passed; 83 tests passed, 1 skipped. That skip is the live FRED case in `server/fredIntegrityGate.live.test.ts`. The unset path ran and made no request. Covered there: NYSE window, Thanksgiving skip, in-process duplicate callback guard, legacy 18:00 UTC provenance, Track Record gates, evidence collector fixtures, MarketState and Yahoo/CoinGecko freshness tests from #97/#98.

Full suite, once: **285 files passed, 7 skipped; 3,567 tests passed, 45 skipped, 0 failed.** The live FRED case remains inside the 45 skipped tests. It is outstanding, not passed. #95's prior suite was 283 files and 3,557 tests passed, with the same 45 skips. The extra files are #97's seismograph admission tests, which this branch keeps.

Disposable database tests in that suite applied the append-only script only on `127.0.0.1`. They did not apply `0074`.

## Not done

No merge into release. No deploy. No Railway change. No flag or cron activation. No production database write. No billing action. `FRED_API_KEY` was not set and was not printed. The live FRED test is outstanding, not passed.
