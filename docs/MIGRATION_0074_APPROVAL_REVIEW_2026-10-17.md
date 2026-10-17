# Migration 0074 / immutability approval review — October 17, 2026

**Status: review-only; production application NOT APPROVED and NOT PERFORMED.** Repository `tsilianidis-bot/gaultline`, candidate branch `repair/2026-10-17-source-truth`, implementation SHA `cfb1731d516a41b46f1ba6dcd5cbb642ec44808c`. This is a DDL/source review, not a production migration test or certification.

## Actual scope

The captured PR #84 `0074_pi_v2_research_private.sql` creates four **private PI-v2 research** tables: `piV2ResearchRawInputs`, `piV2ResearchSnapshots`, `piV2ResearchLedger`, and `piV2ResearchMonitorEvents`. It is not the application’s Track Record store. Do not describe applying it as activating the current public Pressure Index or the Track Record.

Raw inputs preserve original value text, reference date, nullable release time, vintage, ingestion time/provider and input hash; the unique index covers series/date/vintage/value text. Snapshots preserve spec/version/reference/input hashes, decision time and source-provenance JSON; a unique spec/date index prevents duplicate snapshots. Snapshot CHECK constraints require `FORWARD_LIVE`, an on-spec grid, and date >= 2026-10-16. Nullable score/status explicitly allow unavailable data.

The ledger distinguishes retrospective/backfill/null-snapshot rows from forward/observed-at-decision/non-null-snapshot rows. SCORE rows have no parent/outcome; OUTCOME rows require both. Snapshot and parent foreign keys use no-action deletion/update. Before-update and before-delete triggers reject changes on all four research tables. This preserves append-only rows; it does not alone prove live capture, a trustworthy vintage or reproducible classification.

## Associated protection script

`scripts/governed-research-append-only.sql` is deliberately inert and not registered in the Drizzle journal. Its four triggers protect only `governedResearchObservations` and `governedResearchResolutions`, not PI-v2 tables, `marketMemory` or every application writer. It drops/recreates named triggers, so application is an explicit database change, not a harmless read. The existing application writers insert; an incompatible future update/delete fails closed.

The script states #84 owns journal index 74 and proposes any later registration at 75 after 0074. Actual production journal/table/trigger state remains unverified because Railway token scope is unavailable. No index/order compatibility claim is made from source comments alone. Parent/owner must inspect the target journal and existing objects before approval. No migration or journal file was altered during this repair.

## Test evidence and decision

Existing disposable-local-database tests cover Track Record append/duplicate/readback/later resolution and the separate governed-research protections; use the final verification report for exact executed results. Those tests are not evidence that 0074 is applied, syntactically accepted on the production engine, or compatible with current production objects. This review did not execute 0074 on production or activate the Friday research recorder.

**Next action:** obtain valid read-only production diagnostics; confirm the target DB engine/version, migration journal, existing tables/indexes/triggers and writer compatibility; stage the exact reviewed DDL on a disposable equivalent; obtain founder approval for a separately scoped application and verification. Do not use reconstruction/admin seed as proof of actual forward observation. No production application, schedule registration, source/billing change or recording/publication activation is authorized now.

**Release decision: NO-GO for these production changes pending diagnostics, independent review and explicit approval.**
