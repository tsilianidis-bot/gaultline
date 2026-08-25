# Phase 6 Candidate Schema

**Authoritative type:** `CandidateDetection` in `shared/candidateDetection.ts`.

| Field group | Actual fields |
|---|---|
| Identity | `candidateId`, `candidateType`, `title` |
| State binding | `originatingStateId`, `originatingSynthesisId`, `effectiveAt`, `firstObservedAt`, `latestObservedAt` |
| Structured evidence | `participatingEngines`, `participatingRelationships`, `supportingDivergences`, `evidenceClaimIds`, `relevantArchiveEventIds` |
| Measured features | `magnitude`, `acceleration`, `persistence` |
| Quality | `dataConfidence`, `dataFreshness`, `dataQuality`, `evidenceStrength`, `limitations` |
| Detector provenance | `detectorId`, `detectorVersion`, `detectorConfigVersion`, canonical/synthesis provenance |

The schema deliberately has no warning ID, importance score, qualification state, lifecycle state, confirmation condition, invalidation condition, publication state, priority, target, probability, or forecast horizon.
