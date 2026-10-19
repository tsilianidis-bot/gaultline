# Pressure Index remediation — Oct 13 2026 (branch off live 928b385)

Status: **DRAFT PR — NOT MERGED, NOT DEPLOYED.** Migration 0073 **not applied** (requires founder approval). No production DB writes, no Railway changes.

## Before → after, per defect
| # | Defect (evidence id) | Before (928b385) | After (this branch) | Frozen engine? |
|---|---|---|---|---|
| 1 | CPI/PPI YoY positional (R05/R06) | `obs[12]`; Oct-2026 CPI release with missing Oct-2025 → NaN composite | date-matched YoY; missing base → latest month with valid base, dated; NaN/±Inf rejected; composite/vector finiteness asserted | **Yes — authorized** |
| 2 | Silent constant fallback (R10) | any 1/8 series ⇒ "live", missing filled by constants; stale snapshot re-dated to now | all 8 inputs verified or no new reading; last verified reading served stale with original timestamps (≤7 d) else `PressureInputsUnavailableError`; per-input observation dates; scheduled pipeline refuses unverified readings | **Yes — authorized** |
| 3 | Unsupported crisis / early-warning copy (R21 etc.) | "historically been a reliable early indicator", "most reliable leading indicator", "early-warning signal", "5–15% move within 60 days", "pressure composite crossed 65/100 before Lehman by 14 months", "would have registered Critical Stress (80+) under the current framework" | qualified: describes current conditions; states no validated lead time; cites own reconstruction (max 56, 16/26 missed) | No |
| 4 | Public uncalibrated probabilities (R16/R17) | `systemicRegime.current/history` return crisis/transition/confidence; `marketState.current` serialises withheld values as "NaN" strings | public responses null + `probabilitiesWithheld`; admin-only `systemicRegime.currentInternal`; DB untouched; marketState wire null (client restores NaN sentinel) | No |
| 5 | "Today" label (R18/R19) | newest pressureRuns row labelled "Today" regardless of age (31 vs headline 33) | every point labelled with actual ET observation date; final point is the canonical state that drives the headline; bands from score via `pressureRegimeLabel()` | No |
| 6 | Recovery from levels (R21/R22/R23) | "recovering/bullish" = engine level < 40; trend vs 6-mo average | `classifyCondition()` from actual change vs prior observation (±3 pts): Low current stress / Improving / Deteriorating / Elevated stress / Insufficient evidence; Broad Recovery needs ≥2 of Credit/Liquidity/Macro Improving, none Deteriorating/Elevated, ≥3 Improving overall. With Sep→Oct 2026 values Liquidity and Credit are Deteriorating | No |
| 7 | Public GET writes DB (R20) | `pressure.getCurrentPressure` inserted a pressureRuns row and V3-H shadow rows on every call (engine also wrote V3-H on every compute) | public query read-only; pressureRuns + V3-H + v2 shadow written only by the scheduled/admin Seismograph pipeline, only from verified readings | engine: only removal of the V3-H side-effect call |
| 8 | Legacy band labels in history (R14) | stored labels (e.g. 35 stored as ELEVATED) rendered | rendered via canonical `pressureRegimeLabel(score)`; stored rows untouched | No |

## Not changed
Pricing, bands/cut-points, Pre-Flight (stays removed), PLATO/Gemini, NOW/OUTLOOK/WATCH/ACT navigation, v1 scoring.

## Validation (box, Oct 13 2026)
* Unit tests: 275 files / 3,533 tests — 3,486 passed, 41 skipped, **6 failed; all 6 also fail on unmodified 928b385** (4× getISOWeek timezone-dependent — pass with TZ=UTC; 1× live Polygon API key/network). No new failures.
* `tsc --noEmit`: clean. `pnpm run build`: success (dist/index.js 3.8 MB; includes the 1.2 MB v2 reference dataset).
* v1 reproduction: Oct 12 inputs → 22/22/40/44/29/44 → 33.1 → 33.
* v1 scoring sections byte-identical to 928b385 (string comparison).
* v2: full 2000–2026 weekly reproduction of the research panel, 0 mismatches.
* Unrelated suites green: signals, crypto, sector rotation, billing/Stripe/entitlement, tiers, public pricing.
