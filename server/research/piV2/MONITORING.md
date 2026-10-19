# Research monitoring

These checks are functions in `monitor.ts`. They run inside `runResearchTick` only when that tick is explicitly enabled outside production. They are not mounted on the public server and they do not page production.

| Check | Kind | When it fires |
| --- | --- | --- |
| Missing Friday snapshot | `MISSING_FRIDAY_SNAPSHOT` | After 14:00 America/New_York, any official Friday from the watch date through today has no append-only snapshot. |
| Late or stale inputs | `STALE_DATA` | `BAA10Y`, `VIXCLS`, or `SP500` is older than 10 calendar days, or `UNRATE` is older than 70 calendar days. |
| Calculation failure | `CALCULATION_FAILURE` | The pure calculator throws, including ambiguous duplicate observations. A second Friday pass that disagrees with the stored snapshot also records this and leaves the stored row unchanged. |
| Spec-hash drift | `SPEC_HASH_DRIFT` | The spec file's SHA-256 differs from the hash locked in `lock.ts`. |
| Expected funding gap | `EXPECTED_UNAVAILABLE` | Informational. TED has no approved successor, so the post-2022 gap is the spec, not an outage. |

Monitor rows are append-only. Closing an alert is a later row, not an update.

`PI_V2_RESEARCH_WATCH_FROM` limits the missing-Friday scan to the date recording actually starts. Leaving it unset watches from 2026-10-16. Missed Fridays are reported. They are not backfilled into `FORWARD_LIVE`.

Nothing in this module promotes v2, emails customers, or writes the production Pressure Index.
