# Phase 6 — Early Warning Intelligence Acceptance Gate

| # | Requirement | Result | Evidence |
|---:|---|---|---|
| 1 | Phase 5 remains the only primary input | PASS | `server/earlyWarningIntelligence.ts` |
| 2 | Candidate is structured before any narrative use | PASS | `shared/earlyWarningIntelligence.ts` |
| 3 | Candidate retains state, synthesis, time, engines, claims, quality, and freshness | PASS | Contract and candidate audit |
| 4 | Warning score has all eight required dimensions | PASS | Contract score table |
| 5 | Score is not probability or forecast | PASS | Contract, prompt, UI disclaimer, tests |
| 6 | Historical lead strength is unavailable rather than invented | PASS | `historicalLeadStrength: null` |
| 7 | LLM cannot calculate warning score | PASS | Deterministic evaluator only |
| 8 | Qualification is strict and bounded | PASS | Score, magnitude, persistence, independence, freshness gates |
| 9 | Output is capped at 0–3 material warnings | PASS | `MAX_MATERIAL_EARLY_WARNINGS = 3` |
| 10 | No-warning outcome is explicit | PASS | HOME panel and evaluator tests |
| 11 | Approved lifecycle states are represented | PASS | Contract and evaluator |
| 12 | Lifecycle transitions are deterministic | PASS | Evaluator tests |
| 13 | Confirmation is explicit and independent | PASS | Phase 5 confirmation dependency |
| 14 | Invalidation is explicit and append-only | PASS | Persistence service |
| 15 | Warning identity persists across evaluation | PASS | Stable `warningId` tests |
| 16 | Original warning is immutable | PASS | `originalPayloadJson` only on insert |
| 17 | Later observations append separately | PASS | `earlyWarningObservations` |
| 18 | Original score/lifecycle/context are retained | PASS | Warning table and payload |
| 19 | No hindsight rewriting occurs | PASS | Immutable event keys and append-only observations |
| 20 | Scheduled run uses one state-locked synthesis | PASS | Scheduled pipeline integration test |
| 21 | API uses authoritative synthesis only | PASS | `marketState.earlyWarningsCurrent` |
| 22 | History returns only recorded observations | PASS | `earlyWarningHistory` |
| 23 | ASHA cannot independently invent warning | PASS | Governed prompt contract test |
| 24 | Oracle cannot independently invent warning | PASS | Governed prompt contract test |
| 25 | Home panel is high on canonical dashboard | PASS | `Dashboard.tsx` |
| 26 | Warning card is concise and premium | PASS | `EarlyWarningIntelligencePanel.tsx` |
| 27 | Full warning exposes confirmation and invalidation | PASS | Panel detail boundary |
| 28 | Warning evolution is append-only and visible | PASS | Timeline detail boundary |
| 29 | Original pressure/regime context is retained | PASS | State-locked `marketContext` |
| 30 | Single-engine condition is withheld | PASS | Adversarial A1 |
| 31 | Overlapping evidence is withheld | PASS | Adversarial A2 |
| 32 | New condition without persistence is withheld | PASS | Adversarial A3 |
| 33 | Stale or unavailable evidence is withheld | PASS | Adversarial A4–A5 |
| 34 | Missing magnitude is withheld | PASS | Adversarial A7 |
| 35 | Candidate never claims target/probability/outcome | PASS | Adversarial A8–A9 |
| 36 | Candidate never mixes canonical states | PASS | Adversarial A10 |
| 37 | No unlimited daily alerting | PASS | Adversarial A11 |
| 38 | No Early Warning lifecycle is created from AI output | PASS | Adversarial A12 |
| 39 | Previous Phase 2 state integrity remains preserved | PASS | Phase 6 state-binding tests |
| 40 | Previous Phase 3 evidence integrity remains preserved | PASS | Prompt and claim-ID retention |
| 41 | Previous Phase 4 narrative integrity remains preserved | PASS | Shared prompt contract layering |
| 42 | Previous Phase 5 independence rules remain preserved | PASS | Phase 5 divergence/confirmation inputs |

**Gate result: PASS.** Closure review identified and corrected two Phase 6 completion gaps: original warning detections are now eligible for append-only broad follow-through while later lifecycle events remain non-outcome observations; and a dedicated owner-only warning inspection boundary is now available. Final full regression: **149 test files passed; 1 skipped; 1,806 tests passed; 22 skipped; 0 failed.**
