# FAULTLINE Pressure Index — v1 methodology (version record)

| Field | Value |
|---|---|
| Methodology | Champion V1 (frozen) — unchanged scoring |
| Version id | `faultline-pressure-v1.0.1-integrity` (`PRESSURE_V1_METHODOLOGY_VERSION`, server/pressure/engine.ts) |
| Previous | `faultline-pressure-v1-frozen` / pressureRuns `engineVersion` "1.0.0" (kept for continuity) |
| Change authority | Founder authorization, Oct 13 2026 (brief "PRESSURE INDEX REMEDIATION & V2 SHADOW DEVELOPMENT", Phase 1 items 1–2 only) |
| Branch base | live commit `928b385` |

## What v1 is
A macro and interest-rate **conditions gauge** on 0–100 built from 8 FRED series. It is **not** a validated systemic-crisis or early-warning model. Under its formulas the composite can only range ≈ 6.75–72.35, so the 80–100 band is unreachable (Oct 12 2026 reconstruction, R03).

## Unchanged (byte-identical to 928b385)
* Six vector scoring functions, linear anchors and caps, analogs, alerts (`/** Clamp a value` … `// ── Main export`), and steps 3–8 of the main function (vector objects, weights .20/.20/.15/.20/.10/.15, `Math.round` composite, band classification). Verified by string comparison against the 928b385 file in this PR's validation.
* Band cut-points 0–24 / 25–44 / 45–64 / 65–79 / 80–100 and labels.
* HY spread percent→bps rule; static AI baseline (65) and its "static" label.

## Changed (the only two authorized repairs)
### 1. CPI / PPI year-over-year — date-matched
* Before: `obs[12]` of a 14-row descending pull (positional). A missing FRED month ('.'), e.g. CPIAUCSL 2025-10, makes `parseFloat('.') = NaN`; `?? 3.4` does not catch NaN, so the Oct-2026 CPI release (~mid-Nov 2026) would have produced a NaN composite.
* After: `dateMatchedYoY()` uses the most recent month M for which both M and M−12 months (same calendar day) are valid finite positive values; result rounded to 2 dp exactly as before. If the newest month's base is missing, it uses the latest month that has a valid base and records that month as the input's observation date. Fetch limit 14→15 rows. If no month qualifies the input is *missing* (fail closed).
* `parseFredValue()` rejects '.', '', NaN, ±Infinity everywhere.

### 2. FRED loading — fail closed
* Before: if ≥1 of 8 series loaded, every missing series was silently replaced by constants (HY 283, 10Y 4.61, 2Y 4.07, SOFR 3.53, CPI 3.4, PPI 2.8, FF 5.25, UR 4.1) and labelled live/delayed. A preserved snapshot was re-stamped with the *current* time.
* After: `resolveVerifiedInputs()` requires all 8 inputs present, finite, plausible and fresh (daily ≤10 days, FEDFUNDS/UNRATE ≤100 days, CPI/PPI month ≤130 days). Only then does `computePressureFromVerifiedInputs()` run. Otherwise: the last verified reading (≤7 days old, in-process) is returned with `dataSource: "fallback"`, vectors `dataStatus: "stale"`, its **original** `timestamp`/`lastUpdated`, and `verification.status: "stale"`; if none exists the engine throws `PressureInputsUnavailableError` (public route → `SERVICE_UNAVAILABLE`). No constants are ever substituted.
* Daily series fetch 2→10 rows so a holiday '.' does not trip fail-closed.
* Provenance: `verification.inputs[]` (series, value, observationDate, baseObservationDate for YoY, status) and `vectors[].observationDates`; canonical manifest `inputQuality[].observedAt` now carries the FRED observation date.
* Scheduled pipeline records a new canonical state only from `verification.status === "verified"`; otherwise it throws and the previous canonical state stays in force.

## Reproducibility proof
`server/pressure/engine.test.ts` → "v1 reproducibility (Oct 12 2026 inputs)": FRED values ≤ 2026-10-09 (fixture `server/pressure/__fixtures__/fred-2026-10-12.json`) give vectors 22/22/40/44/29/44, unrounded composite 33.1, published 33, Moderate.
