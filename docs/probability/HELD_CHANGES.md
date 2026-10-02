# Held methodology changes (not in PR #60)

These are on branch `probability/held-methodology-2026-10-02` at b733dfc, stacked on #60's split commit e51e8f5. The branch is pushed and has no PR.

On James's 2026-10-02 11:42 ET decision, every change below alters a calculated output, so it stays out of #60 until he approves it.

## How the numbers were produced
All numbers come from running one harness on three trees: base `d1834a5`, launch `e51e8f5` (the #60 split commit) and held `b733dfc`.
- The harness is `/workspace/probability/engine-diff/engineDiff.harness.test.ts`, with fixtures in `fixtures.json` and raw output in `out/*.json`.
- The clock is frozen at 2026-10-02 18:01:25.427Z, so `stateHash` is reproducible: base run twice gives 0 differing fields.

Fixtures:
- **oct01:** the 2026-10-01 production replay (`/workspace/repair-failclosed/replay-map.json`): assembled seismograph, canonical state, systemic regime and unified payload. Product-QA used the same replay.
- **oct02_1401:** the 2 PM production snapshot `state:2026-10-02T18:01:25.427Z:57a5d9b62897f5e6` (34/100, MODERATE, 83rd, 33/50/17, PARTIAL), from `/workspace/prod-qa-oct1/snapshot-1401/api/`.
- **unified_complete / unified_sentinel:** a deterministic 121-month `pressureHistory` fixture (2016-10 to 2026-10). It is synthetic and labeled as such, because the production DB is not reachable from the box.
  - Its last row carries the production 2026-10 sub-scores (17/30/40/35/45/44) and the production 2026-04..09 scores.
  - The sentinel variant stores 0 for sub-scores that were "not computed", following the DB's partial-live-run convention. The zeros are in 2026-05..10, the five months that are top analogs in the complete variant, and the all-zero 2020-04 row.
- **frozenChampion:** `calculateFrozenChampionV1` on three FRED-style input sets.

Product-QA's own measurements in `/workspace/prod-qa-oct1/gate-pr60/item10/` (`compare-base.json`/`compare-wt.json`, `preflight-base.json`/`preflight-wt.json`) agree with items 1 and 2.

---

## 1. Analog-neutral evidence vote (evidence-vote v2) and seismograph-core 2.1
**Files:**
- `server/seismographAdapters.ts`: the analog packet is always `neutral`.
- `server/seismographCore.ts`: version `"2.0"` becomes `"2.1"`.
- `shared/probabilityContract.ts`: 2.1 maps to `seismograph-evidence-vote-v2`.

| Fixture | CURRENT (base = #60) | PROPOSED (held) |
|---|---|---|
| oct01 analog packet | `stressed` (Fed Pivot Rally, 91% similarity) | `neutral` |
| oct01 scenario weights bull/neutral/bear | **43 / 43 / 14** | **43 / 57 / 0** |
| oct01 manifest `modelVersion` / `stateHash` | `2.0` / `8acc472e…` | `2.1` / `414d6393…` |
| oct01 governed claims (neutral, bear) | 43, 14 | 57, 0 |
| oct02_1401 scenario weights | **33 / 50 / 17** | **33 / 67 / 0** |
| oct02_1401 `modelVersion` / `stateHash` | `2.0` / `f802a5b8…` | `2.1` / `e6bf4e90…` |

These stay the same on both sides: pressure score (33 and 34), regime, stress level, direction, percentile 83, evidence consensus (weak and divergent), primary driver, and transitions.

User-visible change under #60: none on canonical surfaces, which show "Uncalibrated" either way. The stored `scenarioOutputs`, the claim values and the state identity all change.

**Why it's needed:** similarity measures how much the present looks like a reference period. It is not stress or direction. The adapter maps similarity > 70 to `stressed`, so a 91%-similar bullish analog is the only bearish vote in the set. Today's whole bear weight (14 on Oct 1, 17 on Oct 2) is this artifact. The 2.1 bump keeps old 2.0 states on v1 values and gives new states new hashes.

## 2. preFlight reads the real credit vector (`credit-contagion`)
**File:** `server/preFlight.ts`, 6 call sites. `"credit-stress"` is not an engine vector id, so `getVectorScore` returns its default of 50 whatever credit is doing.

| Fixture | CURRENT (base = #60) | PROPOSED (held) |
|---|---|---|
| oct01 Credit Conditions panel | Caution, **50** | Stable, **22** |
| oct01 Recession Risk condition score | Stable, **37** | Stable, **27** |
| oct01 key risks | credit-stress (moderate), liquidity-risk, ai-concentration, fed-policy | liquidity-risk, ai-concentration, fed-policy |
| oct01 macro driver (credit) | neutral / Neutral / "Moderate" | bullish / Positive / "Benign" |
| oct01 awareness check `credit-check` | warn | pass |
| oct02_1401 Credit Conditions panel | Caution, **50** | Stable, **23** |
| oct02_1401 Recession Risk condition score | **38** | **28** |

Not affected: the other condition panels, awareness score and market status.

Also: base's retired preFlight probabilities (oct01 bull 64 / bear 36 / recession 22 / crash 20; oct02 63/37/23/20) were computed from this constant 50. #60 removes those values (they show "Not offered"), as James approved.

**Why it's needed:** the credit panel, recession condition, key risks, macro drivers and awareness check never respond to credit. They report a constant 50 ("Caution") while the engine's credit-contagion vector reads 22–23.

## 3. Missing sub-scores stay null instead of `|| 50`
**File:** `server/seismographUnified.ts`:
- `normalizeSubScore` for liquidity, credit, volatility, macro and aiBubble
- `computeSimilarity` skips any missing term
- 6-month averages use only measured months
- an evidence family is omitted when its current sub-score is missing
- the credit/liquidity pattern needs measured values

| Fixture | CURRENT (base = #60) | PROPOSED (held) |
|---|---|---|
| unified_complete (no 0 sentinels) | — | **identical to current** (0 fields differ) |
| unified_sentinel top analog | **2019-01, 97%** | **2018-12, 98%** |
| unified_sentinel top-5 analogs | 2019-01:97, 2022-06:97, 2025-10:97, 2018-06:95, 2021-10:95 | 2018-12:98, 2022-05:97, 2025-09:97, 2018-06:96, 2021-10:95 |
| unified_sentinel analog basis text | "5 historical analog periods with 97%+ similarity" | "… 98%+ similarity" |
| unified_sentinel Liquidity Conditions | 6-month avg **36**, trend **improving** | 6-month avg **21**, trend **stable** |
| unified_sentinel Credit Markets | 6-month avg **37**, trend **improving** | 6-month avg **35**, trend **stable** |

These stay the same in both variants: current score 34, percentile, regime, stress level, direction, the 3-way and 5-way splits, transitions and patterns.

**Why it's needed:** the DB stores 0 for a sub-score that a partial live run didn't compute. `|| 50` turns it into a measured-looking neutral 50, with three effects:
- Months with missing scores look alike to the analog matcher.
- 6-month averages are pulled toward 50, which produces a false "improving" trend (liquidity 17 vs a fake average of 36).
- Families can show 50/100 for data that doesn't exist.

The numbers above are synthetic. To size the real effect, ops needs to run:
`SELECT COUNT(*) FROM pressureHistory WHERE liquidityStress=0 OR creditContagion=0 OR volatilityRegime=0 OR macroSensitivity=0 OR aiBubble=0;`

## 4. Yield-curve vector rescale (proposal only, not implemented)
James decided not to rescale. The held branch has **no code** for this. It is recorded here for the decision record.

**File it would touch:** `server/pressure/engine.ts` `scoreVolatilityRegime` (and the frozen champion `verifiedHistoricalValidation.ts`). The score is `0.6 × spreadScore (max 90) + 0.4 × rateScore (max 50)`, so the maximum is **74**.

| frozenChampion inputs | CURRENT vector / Pressure Index | Illustrative ×100/74 rescale (hand-computed from the same weights) |
|---|---|---|
| oct02-like (10Y 4.1, 2Y 3.6) | 33 / **27** | 45 / ≈29 |
| deep inversion, high 10Y (10Y 6.2, 2Y 7.4) | **74** / 48 | 100 / ≈52 |
| steep curve (10Y 2.9, 2Y 0.2) | 14 / 32 | 19 / ≈33 |

**Why it was proposed:** the vector can never reach its own top band (≥75) and never contributes its full 15% weight. A rescale changes the frozen Pressure Index, so James declined it. What #60 does instead is display-only: the copy now matches the engine.

The unreachable ≥75 display band ("Extreme Curve Pressure", 75–100) exists only in `client/src/components/ScoreExplainer.tsx`, which PR #59 owns. #60 cannot remove it without overlapping #59. The exact change for #59 or a follow-up:
- Delete the `if (v >= 75)` branches in `statusLabel` and `meaning`.
- Delete the `75–100` range row.
- Make "High Curve Pressure" `55–74` the top band, and fix `:559` "and/or a high 10Y" (a high 10Y alone maxes at 32).

---

## Not held (kept in #60), because the calculated output is unchanged
- **Governed claim `modelVersion`:** stays `seismograph-core-v1`. The contract model reference is only in `metadata.contractModelVersion`. `stateHash` is identical to base on both production fixtures.
- **Market posture:** still computed from the source scenario weights. It is identical to base, and a test covers Low stress + bull 64 → opportunistic.
- **Display and contract:** these fields differ from base in #60, and only these:
  - `outlook.probabilities` / `regimeProbabilities` / `transitionProbabilities` payload numbers are withheld (NaN), with contract text shown.
  - preFlight bull/bear/recession/crash become `null` ("Not offered").
  - The canonical state gains `probabilityContract` (scenario text "Uncalibrated").
