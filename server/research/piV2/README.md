# Private Pressure Index v2 research

This module is a private research path for spec `FL-PI-v2-research-0`. It does not replace the production Pressure Index in `server/pressure/engine.ts`, and the public server does not import it.

Production v1 remains the only public pressure score. v1 still loads FRED through `server/fredClient.ts` and `calculateFaultlinePressure()`. Scheduled production jobs stay in `server/_core/index.ts`. This research tick is not one of them.

## What is frozen

Five pillars, equal weight among the pillars that have a score:

| Pillar | Series | Transform |
| --- | --- | --- |
| Credit stress | FRED `BAA10Y` | Level, expanding midrank percentile. Labeled `IG_SPREAD_PROXY`. |
| Funding stress | FRED `TEDRATE` through 2022-01-21 | Same percentile. After the series ends, the pillar is `UNAVAILABLE` with reason `FUNDING_SUCCESSOR_NOT_APPROVED`. |
| Market volatility | FRED `VIXCLS` | Level, expanding midrank percentile. |
| Equity drawdown | FRED `SP500` | Percent decline from the 252-session high, then the same percentile. |
| Unemployment deterioration | `UNRATE` real-time vintages | Sahm-type gap, then the same percentile. |

A pillar score is `100 * clip((percentile - 50) / 50, 0, 1)`. Values at or below the expanding median score 0. The total is the arithmetic mean of available pillar scores. Fewer than three available pillars produces `status: unavailable` and the Friday row is still appended. Nothing is imputed.

The spec file is `spec/FL-PI-v2-research-0.json`. Its SHA-256 is locked in `lock.ts`. A methodology change needs a new spec id and a new hash. `implementationVersion` can move for engineering fixes that keep the same spec.

## Clocks

Each used input keeps an observation date, a release time or ALFRED `realtime_start`, a vintage id, and an ingestion time. Market rows downloaded from FRED without an exchange timestamp use an assumed release of 21:00 UTC on the observation date, which treats the US cash session as complete. The Friday decision clock is 14:00 America/New_York, so the same Friday's 21:00 UTC close is not yet eligible during daylight time.

## Friday record

The first official date is Friday 2026-10-16. Each later Friday gets one append-only `FORWARD_LIVE` snapshot. Historical replays are `RETROSPECTIVE` / `BACKFILL` artifacts and are rejected by the snapshot table. A backfilled row cannot be labeled forward.

## Schedule

`runResearchTick` exists and defaults to off. It stays off when `NODE_ENV` is production or when Railway environment variables are present. Turning it on outside those environments also requires `PI_V2_RESEARCH_SCHEDULE_ENABLED=true` and `PI_V2_RESEARCH_ISOLATED_ACK=research-only-not-production`. The route `/api/scheduled/pi-v2-research-tick` is not mounted.

## Commands

```bash
pnpm exec vitest run server/research/piV2 server/pressure/engine.test.ts
pnpm exec tsx server/research/piV2/eval/runHistoricalEval.ts
pnpm exec tsx server/research/piV2/eval/cpTbillCandidate.ts
```

The historical script exits 2 when no panel file is supplied. It does not invent scores. The CP−T-bill script is a candidate note, not an input to the frozen spec.

Licensing is listed in `LICENSING.md`. Alert checks are listed in `MONITORING.md`. Open gaps are listed in `BLOCKERS.md`.
