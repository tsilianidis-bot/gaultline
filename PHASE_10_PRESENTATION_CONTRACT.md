# Phase 10 — Governed Early Warning Presentation Contract

## Purpose

Phase 10 is **presentation and distribution only**. It reads the governed Phase 5–9 record chain and emits exactly one `phase10-early-warning-presentation-v1` object for public consumption. It cannot calculate, score, qualify, transition, confirm, invalidate, forecast, or mutate any upstream record.

```text
Visible claim
  → Phase 10 presentationId
  → Phase 9 authority event / plan evaluation
  → Phase 8 lifecycle observation
  → Phase 7 qualification evaluation
  → Phase 6 candidate detection
  → Phase 5 synthesis
  → Phase 2 canonical evidence
```

## Authoritative Contract

| Item | Authority |
|---|---|
| Shared type | `shared/earlyWarningPresentation.ts` |
| Read-only assembler | `server/earlyWarningPresentation.ts` |
| Public current API | `marketState.earlyWarningPresentationCurrent` |
| Public timeline API | `marketState.earlyWarningPresentationTimeline` |
| Owner traceability | `admin.getEarlyWarningPresentationDebug` |
| Contract version | `phase10-early-warning-presentation-v1` |
| Social-ready projection | `createSocialReadyWarningPost()` |

## Fail-Closed Semantics

| Condition | Required output |
|---|---|
| No qualifying active lifecycle episode | `NO_MATERIAL_EARLY_WARNING` |
| Required ledger rows absent | `NO_MATERIAL_EARLY_WARNING` with unavailable freshness |
| Invalidated episode | Excluded from current presentation selection |
| Conflicted Phase 9 conditions | `CONFLICTED_CONDITIONS`, not a synthesized conclusion |
| Stale/degraded quality | Preserved as `STALE` / reduced confidence |
| Historical/analog context | Explicitly unavailable unless separately authorized |

## Explicit Non-Authority

The service never invokes Phase 6 candidate evaluation, Phase 7 scoring, Phase 8 lifecycle evaluation, or Phase 9 authority evaluation. Every displayed score, state, timestamp, confirmation/invalidation status, claim reference, freshness label, and limitation is read from governed persisted records.

## Public Semantics

> **Early Warning Score is a prioritization score, not probability.**

`CONFIRMING` communicates additional governed support for the supplied thesis; it is not a forecast. `INVALIDATED` describes a governed terminal lifecycle record; it is not an opposite forecast. `NO MATERIAL EARLY WARNING` does not imply safety, bullishness, or no downside risk.

## Track Record Boundary

The Track Record remains a separately labeled retrospective/historical context surface. It is not a current-warning calculator or a Phase 10 consumer. Phase 10 exposes only **live verified ledger records**; it does not create backfilled historical warnings, reconstruct warning states, or turn historical analogs into current warning evidence.
