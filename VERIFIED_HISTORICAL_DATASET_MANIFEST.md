# Verified Historical Dataset Manifest — Champion V1

## Purpose and Status

This manifest describes the research-only `VERIFIED_CHAMPION_V1_HISTORY` dataset. It is separate from both the live Pressure Index and the legacy 317-row historical research series. It does not alter production scores, regimes, thresholds, alerts, V3-H status, public statements, or prior records.

| Field | Recorded value |
|---|---|
| Frozen formula | `CHAMPION_V1_FROZEN_20260819` |
| Frozen source revision | `3a2aa901f9a7dbb4b646e8209a3f2eb12bb0df8c` |
| Score coverage | 2023-08 through 2026-07 |
| Complete monthly scores | 36 |
| Quality classification | `REVISED_HISTORICAL` for every complete score |
| Monthly timestamp | Last valid 10-year Treasury observation on or before month-end cutoff |
| Outcome instrument | S&P 500 Price Index (`^GSPC`) |
| Outcome horizons | 1, 5, 20, and 60 completed trading days |
| Outcome ledger state | 140 complete, 4 pending, 0 unavailable observations |
| Legacy-series relationship | Never used for calibration, score selection, formula inference, or validation targets |

## Source Registry and Coverage Gate

The eight required inputs are persisted as individual immutable source observations with source date, returned vintage fields, transformation, retrieval metadata, and a quality classification. The build refuses to use runtime fallback values. A month is persisted as `INCOMPLETE` when any required frozen input is missing; it is not scored.

| Required series | Role | Coverage/quality treatment |
|---|---|---|
| `BAMLH0A0HYM2` | High-yield spread | The current official endpoint’s earliest observed retained row was 2023-08-21 on 2026-08-19. It is always classified `REVISED_HISTORICAL`; the program does not accept its response as point-in-time ALFRED vintage evidence. |
| `SOFR` | Short-term funding rate | Point-in-time where an official realtime vintage is returned; otherwise explicitly `POINT_IN_TIME_APPROXIMATED`. |
| `DGS10`, `DGS2` | Treasury-yield and curve inputs | `POINT_IN_TIME_CONFIRMED` when returned by the as-of query. |
| `CPIAUCSL`, `PPIACO`, `FEDFUNDS`, `UNRATE` | Monthly macro and labor inputs | `POINT_IN_TIME_CONFIRMED` when returned by the as-of query; monthly release lag is retained in the retrieved observation dates. |

> **Coverage decision:** The defensible common score history begins in August 2023. Earlier 2000–2002, 2007–2008, 2011, 2015–2016, 2018 Q4, 2020, and 2022 periods are outside this dataset and are not scored, inferred, interpolated, or represented as FAULTLINE observations.

## Reproducibility Contract

Each complete score references a frozen formula-version row, a dataset checksum, raw frozen inputs, vector scores, quality summary, and source-observation keys. Each outcome is a separate append-only row. A later completed horizon may be added after an earlier `PENDING` observation, but no outcome changes a score or serves as a score input.

The source ingestion, score builder, outcome builder, protocol registration, and metric runner are available as separate research-only commands under `scripts/`. The frozen formula is documented in `CHAMPION_V1_FROZEN_SPECIFICATION.md`, and the locked test protocol is in `VERIFIED_HISTORICAL_EVALUATION_PROTOCOL.md`.

## Source References

The official macro series are retrieved from the [FRED observations API][1], with realtime/vintage parameters where the provider supports them. The required BAML high-yield series is identified at [FRED][2]. Independent price-outcome observations are retrieved from the Yahoo Finance daily chart endpoint for `^GSPC`; they are documented in each outcome row as a source attribute.

## References

[1]: https://fred.stlouisfed.org/docs/api/fred/series_observations.html "FRED series observations API"
[2]: https://fred.stlouisfed.org/series/BAMLH0A0HYM2 "ICE BofA US High Yield Index Option-Adjusted Spread"
