# Proposed stress-event taxonomy

Status: proposal only. Registry `stress-benchmark-registry-v1` stays empty. This document does not add events, benchmarks, or statistics, and it does not change the published content hash `593b36b087080b50eb31598e1a2e2facf3ce5bf27316c7b387b48d9abfedbe6e`.

A later registry version is a new `versionId` plus a new content hash. Assessments keep the version and hash they were recorded under. An existing version is not edited. Missed-warning and benchmark rates count only ids in that frozen version. Until the sample floors in the ledger are met (30 directional, 20 lead-time, 20 missed-warning, 30 benchmark, plus the diversity guard), every rate stays withheld.

No historical episode is backfilled into version 1.

## Shared rules

Observable evidence is limited to series the integrity gate already knows how to judge: `quote:SPY`, `quote:VIX`, `fred:DGS10`, `fred:DGS2`, and `fred:BAMLH0A0HYM2`. A reading counts only when the gate marks it `verified` for that observation. Stale, unavailable, modeled, or reconstructed values do not qualify an event and do not count as a calm reading.

Start: the first scheduled forward assessment whose verified inputs meet the event's qualification rule. The start timestamp is that assessment's `assessedAt`, not a later revision.

Resolution: the first later forward assessment, at least one scheduled run after the start, whose verified inputs no longer meet the rule. If the inputs are missing, the event stays open. It is not resolved by a gap.

Benchmark: a preregistered comparison id stored on the assessment at record time. The comparison uses later observations of the same series. This proposal names the comparison. It does not publish a result.

Minimum data: the gate's required verified inputs for a forward assessment (`quote:SPY`, `fred:DGS10`, `fred:BAMLH0A0HYM2`), a canonical state id, and a recorded snapshot no older than 20 minutes. Missed-warning and benchmark figures additionally wait for the ledger sample floors.

Versioning: qualification thresholds below are the text that would be frozen in a future version. Changing a threshold, a series, or a benchmark id requires a new version.

## Equity drawdown

Qualification: a verified `quote:SPY` close is at or below a threshold defined as a percentage decline from the highest verified SPY close in the prior 20 scheduled forward assessments. The percentage is chosen and frozen in the registry version before the first assessment that uses it.

Evidence: `quote:SPY`, provider timestamp, validation status `verified`.

Start: first scheduled assessment that meets the decline rule.

Resolution: first later scheduled assessment whose verified SPY close is back above the frozen threshold.

Benchmark id shape: `spy-drawdown-recovery`. Comparison: whether the later verified SPY close has retraced the frozen decline. No result is computed here.

## Credit widening

Qualification: verified `fred:BAMLH0A0HYM2` is at or above a frozen spread level, or its change from the prior verified release is at or above a frozen change. One of those two tests is chosen in the registry version, not both after the fact.

Evidence: `fred:BAMLH0A0HYM2` release date and value, validation status `verified`.

Start: first scheduled assessment that meets the frozen credit rule.

Resolution: first later scheduled assessment whose verified release is back through the same frozen level or change.

Benchmark id shape: `hy-oas-reversion`. Comparison: later verified OAS against the frozen start level. No result is computed here.

## Rates move

Qualification: verified `fred:DGS10` differs from the prior verified release by at least a frozen absolute amount, in either direction. The amount is part of the registry version. `fred:DGS2` may be required as a second verified input in that same version; it is not optional after the version is frozen.

Evidence: `fred:DGS10` and, if the version requires it, `fred:DGS2`.

Start: first scheduled assessment that meets the frozen move.

Resolution: first later scheduled assessment whose verified 10-year yield has moved back inside the frozen band around the start value.

Benchmark id shape: `dgs10-band-reentry`. Comparison: later verified yield against the frozen band. No result is computed here.

## Volatility elevation

Qualification: verified `quote:VIX` is at or above a frozen level. The level is part of the registry version.

Evidence: `quote:VIX`, provider timestamp, validation status `verified`. VIX is not one of the three inputs required to create a forward assessment. An assessment can exist without a VIX event. A VIX event cannot be opened from an unavailable or stale VIX print.

Start: first scheduled assessment with a verified VIX print that meets the level.

Resolution: first later scheduled assessment whose verified VIX print is below that level.

Benchmark id shape: `vix-below-level`. Comparison: later verified VIX against the frozen level. No result is computed here.

## Cross-asset confirmation

Qualification: at least two of the equity, credit, and rates rules in the same registry version are true on the same scheduled assessment. Volatility may be recorded beside them. It does not substitute for one of the two.

Evidence: the verified inputs of each constituent rule.

Start: the scheduled assessment on which the second constituent rule becomes true.

Resolution: the scheduled assessment on which fewer than two constituent rules remain true. One remaining rule does not keep the cross-asset event open, and it does not close the constituent event.

Benchmark id shape: `cross-asset-two-rule`. Comparison: whether both constituent benchmarks later match their own frozen rules. No joint statistic is computed here.
