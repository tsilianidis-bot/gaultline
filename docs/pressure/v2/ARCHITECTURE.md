# Pressure Index v2 — SHADOW architecture (non-public)

Spec: `FL-PI-v2-research-0` — `docs/pressure/v2/PRESPEC_V2.md`, sha256 `3ce5661ed0929fb391aca67329a8d339ecea54ee2edbb225f2e99c8569910b82` (asserted by test). Used **unchanged**: no weight, threshold or transform was altered or tuned.

## Status
* Shadow only. Not exposed by any public or authenticated route; no UI. v1 remains the production index.
* Promotion to production requires explicit founder authorization (and a new pre-registration if anything changes).

## Pillars (as locked)
| Pillar | Live source | Reference (≤ 2026-09-11) | Live status |
|---|---|---|---|
| Credit | FRED BAA10Y (daily) | FRED BAA10Y | available |
| Funding | none | FRED TEDRATE (discontinued 2022-01-21) | **UNAVAILABLE** (spec: no free LIBOR-OIS/FRA-OIS) |
| Volatility | FRED VIXCLS | FRED VIXCLS | available |
| Equity drawdown | FRED SP500 closes → drawdown from trailing 252-session high | Yahoo ^GSPC closes | available |
| Unemployment deterioration | FRED UNRATE current vintage → Sahm-type gap | weekly point-in-time values from ALFRED vintages | available |
| Contagion (P6) | not included in v2-research-0 (spec gap) | — | — |

Normalisation: expanding-window mid-rank percentile vs the indicator's own point-in-time history from series start through D (≥5 years, else unavailable); pillar score `100·clip((p−50)/50,0,1)`; composite = mean of available pillars, ≥3 required else UNAVAILABLE; bands = existing labels/cut-points.

## Code
| File | Role |
|---|---|
| `server/pressure/v2/spec.ts` | locked constants, spec id/hash, implementation version |
| `server/pressure/v2/engine.ts` | pure `computeV2At(data, D)` (only data dated ≤ D) |
| `server/pressure/v2/reference.ts` + `reference/v2-reference-2026-09-11.json` | frozen normalisation history (built by `scripts/pressure-v2/build_reference.py` from the Oct 12 reconstruction data); fingerprint recorded per observation |
| `server/pressure/v2/liveInputs.ts` | appends FRED observations after the cutoff; drawdown and Sahm gap |
| `server/pressure/v2/shadowRecorder.ts` | builds + appends one observation; failures recorded as `status=unavailable` |
| `server/pressure/scheduledPersistence.ts` | the only caller (scheduled cron / admin seed run; never AD_HOC, never public) |
| `server/pressure/v2/benchmarkHarness.ts` | events, warnings, false alarms, lead/lag, rank AUC, outcomes by band |
| `scripts/pressure-v2/run_backtest.ts` → `BACKTEST_HISTORICAL.json` | HISTORICAL_BACKTEST output |

## Storage — migration `drizzle/0073_pressure_v2_shadow.sql` (REQUIRES FOUNDER APPROVAL TO APPLY)
New table `pressureV2ShadowObservations` (additive; no existing table touched). Application code only INSERTs. Each row: asOfDate (ET), onSpecGrid (Friday), recordClass `FORWARD_LIVE`, specId/specSha256, implementationVersion, referenceSha256, runTrigger, status, v2Score, band, nPillars, pillars (raw, observation date, percentile, score, reason), benchmarks (VIX, S&P drawdown, EW-z), input provenance + FRED errors, v1 reading and methodology version. Until the migration is applied, inserts fail and are logged; v1 is unaffected.

## Separation of evidence
* `HISTORICAL_BACKTEST` (in-sample, hindsight-informed design): `docs/pressure/v2/BACKTEST_HISTORICAL.json`, never written to the table.
* `FORWARD_LIVE`: only rows in `pressureV2ShadowObservations`, starting the day the migration is applied. Evaluation uses on-grid Friday rows from the first SCHEDULED_CRON run per date; nothing is deleted or edited.

## Verified reproduction
`server/pressure/v2/v2.test.ts` recomputes every weekly date 2000-01-07 … 2026-09-11 and matches the Oct 12 research panel exactly (0 mismatches; e.g. 2008-11-21 = 98.85, 2026-09-11 = 0.00 with 4 pillars); the harness reproduces 26 events and v2 14 warned / 12 missed, and the AUCs in BACKTEST_HISTORICAL.json equal the research values (v2 0.722, VIX 0.677).
Known discrepancy: the band-outcome table differs from the research summary by ≤6 weeks per band (harness bands on the unrounded score); AUCs/events/warnings match exactly.

## Implementation notes (not methodology changes)
* Live drawdown uses FRED SP500 closes (same index) because Yahoo is not used server-side for this; the reference uses Yahoo ^GSPC.
* Live macro pool = reference weekly point-in-time values + the current reading; intermediate weeks after the cutoff are not back-filled (would require revised data).
* Live daily series are fetched 400 rows deep; after ~1.5 years past the cutoff the reference must be rebuilt (new implementationVersion, same spec).
