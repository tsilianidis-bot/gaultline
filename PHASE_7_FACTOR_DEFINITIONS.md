# Phase 7 Factor Definitions

| Factor | Weight | Implemented source/transform | Missing behavior |
|---|---:|---|---|
| Magnitude | 20 | Governed Phase 6 magnitude, normalized 0–100 | `UNAVAILABLE`; no score contribution |
| Acceleration | 10 | Governed Phase 6 acceleration, normalized 0–100 | `UNAVAILABLE`; no score contribution |
| Persistence | 10 | Phase 6 `PERSISTING` = 1; `NEW` = 0 | Always explicit; not lifecycle |
| Historical lead strength | 10 | Reserved governed historical factor | Currently `UNAVAILABLE`; no fabricated history and no contribution |
| Cross-engine confirmation | 15 | Structured independent participating-engine breadth | Structural support only, not Phase 9 confirmation |
| Systemic importance | 15 | Central domain taxonomy: LOCAL, SECTOR, CROSS_ASSET, MACRO_SYSTEMIC | Deterministic taxonomy mapping |
| Novelty | 10 | Declines with append-only prior candidate observation count | Never rewards a repeated unchanged candidate as newly novel |
| Data confidence | 10 | Governed Phase 6 `HIGH`/`MODERATE`/`LOW`/`INSUFFICIENT` | `INSUFFICIENT` is explicit and cannot qualify |

The factor weights sum to 100. They are centralized in `IMPORTANCE_SCORING_CONFIG`; no scoring magic numbers are distributed through runtime consumers.
