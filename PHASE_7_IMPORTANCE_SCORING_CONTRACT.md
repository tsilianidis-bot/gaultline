# Phase 7 Importance Scoring Contract

Phase 7 receives **only structured Phase 6 `CandidateDetection` objects** and performs a deterministic materiality evaluation. It does not receive ASHA, Oracle, UI, social, or freeform LLM opinion as a score input.

> **Importance score is not probability.** A score of 82 means high importance under `faultline-candidate-materiality` version `1.0.0`; it does not mean an 82% probability of any market outcome.

| Contract item | Authoritative implementation |
|---|---|
| Shared type/configuration | `shared/importanceQualification.ts` |
| Deterministic evaluator | `server/importanceQualification.ts` |
| Model/config identity | `faultline-candidate-materiality` / `1.0.0` / `phase7-governance-v1` |
| Score semantics | Integer 0–100 importance/materiality, not forecast calibration |
| Input authority | Candidate state/synthesis/evidence provenance only |
| Missing policy | Explicit `UNAVAILABLE`, `INSUFFICIENT_EVIDENCE`, or `NOT_APPLICABLE`; no zero/50/average imputation |
| Qualification | Separate deterministic gate after scoring |
| Output scope | Internal machine-readable Phase 7 result only |

Every evaluation preserves candidate ID, originating canonical state ID, synthesis ID, factor trace, evidence/relationship IDs, model/config versions, limitations, qualification reasons, and suppression reasons. The Phase 6 original candidate remains immutable; each Phase 7 result is a separate append-only evaluation.
