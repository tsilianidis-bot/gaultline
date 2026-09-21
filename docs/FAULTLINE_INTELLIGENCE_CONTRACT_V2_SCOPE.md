# FAULTLINE Intelligence Contract v2 — scope only

**Status:** APPROVED SCOPE — **not implemented** on this RC.  
**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Policy:** preserve the contract. Do not ship a v2 engine, scores, or invented triggers.

`FAULTLINE_BUILD_POLICY.md` lists Intelligence Contract v2 as out of scope for baseline stabilization. This file is the durable reminder of the **approved stages** so later work does not shrink or improvise the contract.

## Stages (in order)

1. **REALITY** — what is actually observed now (sources, freshness, gaps).
2. **CAUSATION** — what mechanisms could produce that reality (named, not scored from nothing).
3. **CONSEQUENCE** — what follows if those mechanisms persist or break.
4. **VERIFICATION** — what would confirm or invalidate the reading.
5. **ACTION** — what a user might do only after the prior stages are evidenced.

## Mandatory fields on every stage

Each stage, when it exists in a stored record, must carry:

| Field | Rule |
| --- | --- |
| **confidence + basis** | A confidence value is illegal without an explicit basis (sources, method, limits). |
| **assumptions** | Stated; never implied by a leftover score. |
| **supporting evidence** | Pointers to real observations / claims. Empty list is allowed; invented rows are not. |
| **What Would Change My Mind?** | Mandatory prose. Missing this field means the stage is incomplete, not “default skeptical.” |
| **confirmation triggers** | Observable conditions that would support the stage. Omit if unknown — do not fabricate. |
| **invalidation triggers** | Observable conditions that would kill the stage. Same: omit, don’t invent. |

## Storage and evaluation

- Persist and evaluate v2 stage records in the **Decision Ledger** (`decision_ledger` / `server/decisionLedgerEvaluator.ts` / `client/src/pages/DecisionLedger.tsx`) and the **Intelligence Validation Center** (`server/routers/intelligenceValidation.ts` / `client/src/pages/IntelligenceValidation.tsx`).
- Lightweight **comments only** on this RC point those modules at this file. No new score columns, no placeholder percentages, no synthetic triggers.
- Missing evidence stays missing. Validation Center must not fill gaps with generated confidence, fake confirmation lists, or invented WWCMIM text.

## Explicit non-goals (this RC)

- No v2 runtime engine.
- No replacement of Champion / Decision-Light / canonical CURRENT.
- No “helpful” default scores when a stage has no evidence.
- No merge to `main`, no production deploy.

When implementation is later authorized, implement stages in order, fail closed on missing evidence, and add tests that reject invented scores/triggers before any UI lights.
