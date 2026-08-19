# Reconstructed Champion V1 Historical Dataset Manifest

## Identity and Boundary

| Field | Value |
|---|---|
| Dataset label | `RECONSTRUCTED_HISTORICAL_RESEARCH_HISTORY` |
| Formula | Exact frozen `CHAMPION_V1_FROZEN_20260819` |
| Reconstructed policy | `RECONSTRUCTED_CHAMPION_V1_POLICY_20260819` |
| Evaluation protocol | `RECONSTRUCTED_CHAMPION_V1_EVALUATION_PROTOCOL.md` |
| Requested coverage | 2000-01 through 2026-07 |
| Complete monthly scores | **318** |
| Incomplete monthly scores | **1** — 2018-03, missing `sofr` |
| Point-in-time status | **Not point-in-time verified** |
| Production relationship | Research-only. It is separate from `pressureHistory`, existing verified history, live Champion, and V3-H. |

> **Use limitation:** These are retrospective reconstructed research scores. They must not be presented as historical FAULTLINE live observations, warnings, alerts, or investor guidance at the time of the underlying events.

## Approved Input Registry

| Frozen input | Approved Phase 1B source | Period used | Per-input quality | Material limitation |
|---|---|---|---|---|
| `BAMLH0A0HYM2` | Exact FRED CSV captured by the Internet Archive on 2025-11-04, plus current retained FRED values after the archived endpoint | 1996-12-31–2026-07 | `ARCHIVED_OFFICIAL_REVISED` / `CURRENT_OFFICIAL_REVISED` | The exact ICE series is revised history, not ALFRED vintage evidence; ICE/FRED restrictions apply. FRED states that from April 2026 it retains only three years of this series.[1] [2] |
| `SOFR` | New York Fed primary-dealer overnight Treasury GC repo survey rate, then official SOFR | 2000-01–2018-02 proxy; 2018-04 onward official | `OFFICIAL_PROXY_RECONSTRUCTED` / `CURRENT_OFFICIAL_REVISED` | The official proxy is a narrower volume-weighted mean, while SOFR is a broader volume-weighted median. The New York Fed does not provide a direct source for March 2018, so that month is unscored.[3] [4] |
| `DGS10`, `DGS2` | Current official FRED historical observations | Full target window | `CURRENT_OFFICIAL_REVISED` | Reconstructed tier does not assert a vintage for early dates. |
| `CPIAUCSL`, `PPIACO`, `FEDFUNDS`, `UNRATE` | Current official FRED historical observations | Full target window | `CURRENT_OFFICIAL_REVISED` | Conservative prior-reference-month policy applies; CPI/PPI use 12-month change. |
| Static AI concentration | Frozen constant | Full target window | `STATIC_MODEL_ESTIMATE` | The frozen Champion baseline is 65; no historical market-cap backfill was performed. |

## Timestamp, Eligibility, and Missing-Data Rules

Each monthly score is timestamped on the last U.S. business day. Daily variables use the final same-month observation. Monthly variables use the latest reference month no later than the preceding calendar month, and CPI/PPI require a valid observation 12 months earlier. A missing required input produces `INCOMPLETE`; no constant, interpolation, or undocumented cross-month carry is permitted.

The March 2018 result is intentionally incomplete because the approved primary-dealer proxy ends on 2018-02-28 and official SOFR begins on 2018-04-03. This is a preserved source gap, not a value filled from Fed Funds, EFFR, BGCR, TGCR, or another rate.

## Outcome Ledger

Independent S&P 500 price outcomes were calculated after each complete monthly score at 1, 5, 20, 60, 120, and 252 trading days. The ledger contains **1,886 complete** daily-cadence-confirmed observations and **22 pending** observations. A first append-only load that received provider-downsampled monthly bars remains stored as non-evaluable audit evidence; it is excluded by the locked `DAILY_CONFIRMED_PERIOD_QUERY` selection rule. Outcomes are not model inputs.

## Reproduction Inputs

The research build uses `scripts/buildReconstructedChampionHistory.mjs` and `scripts/buildReconstructedChampionOutcomes.mjs`. It requires two source artifacts outside the web deployment bundle: the official New York Fed workbook and the retained Internet Archive FRED capture. The service records source class, dates, transformations, checksum metadata, and source-observation keys in the reconstructed research tables. The data artifacts themselves must not be publicly redistributed because the exact ICE series carries explicit source restrictions.[1]

## References

[1] [FRED — ICE BofA US High Yield Index Option-Adjusted Spread](https://fred.stlouisfed.org/series/BAMLH0A0HYM2)

[2] [Internet Archive CDX index — exact FRED CSV capture](https://web.archive.org/cdx/search/cdx?url=fred.stlouisfed.org%2Fgraph%2Ffredgraph.csv%3Fid%3DBAMLH0A0HYM2&output=json&filter=statuscode:200&collapse=digest&fl=timestamp,original,statuscode,mimetype,digest,length)

[3] [Federal Reserve — Historical Proxies for the Secured Overnight Financing Rate](https://www.federalreserve.gov/econres/notes/feds-notes/historical-proxies-for-the-secured-overnight-financing-rate-20190715.html)

[4] [New York Fed — Statement Regarding the Publication of Historical Repo Rate Data](https://www.newyorkfed.org/markets/opolicy/operating_policy_180309)
