# Phase 1 — Current-State and Public-Claim Audit

## Current-State Consistency Observation

The latest observed V1 run was **27 / MODERATE RISK** at `2026-08-20 16:08:08` with `dataSource = live`. The most recent persisted daily Seismograph reading available for `2026-08-19` was also **27 / MODERATE RISK**. This is a narrow score/regime consistency observation, not proof that every downstream payload is synchronized.

The daily Seismograph record had null bull and crash fields in the audited row, while other current-state code can manufacture multiple derived probability formats. The selected market-memory keys did not provide a direct canonical-payload comparison in the read-only query. Current state therefore has **partial score/regime consistency but incomplete direct evidence of cross-surface probability synchronization**.

## Critical Public Claim Containment

The public `MarketCrashProbability2026` page contained material conflicts with the audited system: it called the current six-vector Pressure Index a seven-vector, VIX-enabled, continuously updated 0–100 crash probability; used non-current 60–79 stress thresholds; and described historical FAULTLINE-equivalent or historical High Stress readings as though they were established. These were critical false statements requiring immediate containment under the Phase 1 instruction.

The page now states that the Pressure Index is a proprietary **six-vector systemic-stress measure**, not a calibrated crash probability. It documents the actual proxy/staleness boundaries, removes VIX, intraday-continuous, and unvalidated historical-warning claims, retains the correct 0–24 / 25–44 / 45–64 / 65–79 / 80–100 regime labels, and includes the separate-history limitation. A regression test protects those specific corrections.

## Remaining Claim-Integrity Inventory

| Location / output class | Observed wording or behavior | Severity | Required containment / repair |
|---|---|---|---|
| `server/seismographEngine.ts` patterns | Static outcome / historical-rate labels are packaged with current detected patterns | **CRITICAL** | Do not display as validated historical statistics until sourced to immutable event/outcome records |
| `server/seismographCore.ts` / `seismographUnified.ts` | Packet shares and heuristic scenario logic appear as probability percentages | **CRITICAL** | Label as derived scenario composition; do not call calibrated likelihood or probability |
| `server/altRotationEngine.ts`, `cryptoIntelligence.ts`, `crossMarketEngine.ts` | “Historically precedes” / “historically associated” language without a registered study in the audited path | **HIGH** | Add source/evidence qualifier or contain the claim pending validation |
| SEO routes named “crash probability” / “recession probability” | Route names and some support copy can imply forecasting beyond the audited contracts | **HIGH** | Audit all public SEO pages before Phase 2; use context / scenario language unless calibrated evidence exists |
| ASHA and content-generation prompts | Many prompts state “probability over certainty” and name bull/bear/crash distributions | **HIGH** | Provide model provenance, horizon, and calibration state to generation context or force non-probabilistic wording |
| Historical analog UI | The dedicated canonical page has a correct retrospective disclaimer, but other analog surfaces use incompatible math and terms | **HIGH** | Standardize provenance and no-forecast language before expanding analog features |

## Current Phase 1 Claim Rule

> A percentage may be shown only as a **FAULTLINE derived scenario score** unless the system can show its precise event definition, horizon, data tier, sample selection, calibration method, out-of-sample result, source provenance, and model version.

The rule does not prohibit the existing engine from operating. It blocks the interpretation of heuristic output as measured market likelihood until the missing evidence is produced.

## Repair Classification

| Item | Classification |
|---|---|
| Critical public Market Crash Probability page conflict | **CONTAINED IN PHASE 1** |
| Calibrated-probability / fixed pattern outcome claims elsewhere | **MUST FIX BEFORE PHASE 2** |
| Cross-engine model-version manifest and canonical state comparison record | **MUST FIX BEFORE PHASE 2** |
| Source-qualified macro / crypto historical-relationship copy | **SHOULD FIX BEFORE EARLY WARNING DETECTION** |
| Broad public SEO route inventory | **SHOULD FIX BEFORE EARLY WARNING DETECTION** |

## Evidence

`server/pressure/engine.ts`, `server/seismographEngine.ts`, `server/seismographCore.ts`, `server/seismographUnified.ts`, `server/marketStateService.ts`, `server/altRotationEngine.ts`, `server/cryptoIntelligence.ts`, `server/crossMarketEngine.ts`, `client/src/pages/seo/MarketCrashProbability2026.tsx`, and `server/publicClaimContainment.test.ts`.
