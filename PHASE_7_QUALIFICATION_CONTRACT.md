# Phase 7 Qualification Contract

The pipeline is **Candidate → Score → Qualification Gate → Internal Qualified / Not Qualified Result**. Scoring does not itself qualify a candidate.

| Gate | Behavior |
|---|---|
| Threshold | Score must be at least 72/100 |
| Freshness | `STALE` or `UNAVAILABLE` is suppressed |
| Confidence | `LOW` or `INSUFFICIENT` is suppressed or insufficient evidence |
| Evidence strength | `PRELIMINARY` is suppressed |
| Structured conflict | Supplied blocking conflict suppresses qualification |
| Degraded quality | Score above 69 with degraded freshness is suppressed by the quality ceiling |
| Duplicates | One best candidate per deterministic relationship family is eligible |
| Tie break | Score → data confidence → systemic importance → persistence → candidate ID |
| Scarcity | One primary maximum, 0–2 secondaries maximum; cap is not a quota |
| No material state | `noMaterialEarlyWarning: true` when no candidate qualifies |

Qualification states are only `QUALIFIED`, `NOT_QUALIFIED`, `SUPPRESSED`, and `INSUFFICIENT_EVIDENCE`. There are no lifecycle states, confirmation/invalidation conditions, public warning outputs, probability, target, timing, or forecast fields.
