# FAULTLINE Systemic Regime Engine

Independent statistical worker. **Not AI.** Ordinary `StandardScaler + PCA`
(`n_components=1`) plus `hmmlearn.GaussianHMM`. This is **not** Dynamic PCA.

This engine is **additive**. It does not replace Pressure Index, PLATO, the
canonical state pipeline, or existing intelligence engines. It does **not**
change Pressure Index weights.

LIVE inference is `LIVE_INFERENCE` only. Packaged synthetic OOS
(`artifacts/oos_regime_path.json`) is **research-only** and is never served as
CURRENT. Real-FRED expanding-window OOS is `artifacts/fred_oos_regime_path.json`
(also research, not LIVE).

## Production architecture (chosen on real FRED OOS)

FRED `SP500` history available to this worker starts 2016-09. ICE HY OAS
(`BAMLH0A0HYM2`) starts 2023-09 and is **optional** so the 2016–2026 panel can
still hold COVID and 2022 out of sample. Expanding-window OOS uses a 3-year
minimum train so 2020 and 2022 are test years. HY/IG credit features are
median-filled from the training window when missing.

| Spec | Precision | Recall | False transitions | Mean dwell | Mean lead (days) | Warning share |
| --- | --- | --- | --- | --- | --- | --- |
| **2-state (chosen)** | **0.17** | **0.78** | **29** | **65** | **179** | **0.60** |
| 3-state | 0.18 | 0.98 | 55 | 35 | 179 | 0.73 |
| 4-state | 0.17 | 0.98 | 68 | 28 | 179 | 0.77 (rejected: always-on) |

Labeled OOS events on this sample: COVID (lead 178d) and 2022 hike (lead 180d,
capped by the 180d pre-window). GFC / EMU / taper / Q4 2018 are not in the
FRED SPX window. Event share ≈ 0.13. Both 2-state and 3-state over-warn versus
that label set; **2-state is used** because it is more persistent, has fewer
false transitions, and 3-state warned on 73% of sessions. 4-state is not used.
Max drawdown after first persisted 2-state warning ≈ 34%.

HMM integers are mapped by observable stress (PC1, HY OAS, vol, drawdown) on
the **training window only**. State 0 is never assumed to be low risk. The
transition matrix is sticky (self-transition 0.97, not re-estimated) so regimes
persist instead of flickering.

Model identity: `sre-hmm2-v1.0.0` / `gaussian-hmm-2state` (NORMAL / CRISIS).
Set `SYSTEMIC_REGIME_N_STATES=3` on the weekly train job only if a later FRED
sample reverses this comparison. Pressure Index weights stay unchanged.

## Validation (synthetic FRED-like panel, research-only)

Planted windows: GFC, 2011 EMU, 2015–16, Q4 2018, COVID, 2022 hike. Research-only;
not CURRENT product truth and not the production n_states decision.

| Spec | Precision | Recall | False transitions | Mean dwell | Mean lead (days) | Warning share |
| --- | --- | --- | --- | --- | --- | --- |
| 2-state | 0.89 | 0.53 | 14 | 243 | 66 | 0.12 |
| 3-state | 0.36 | 0.72 | 33 | 107 | 98 | 0.42 |
| 4-state | 0.27 | 0.80 | 56 | 64 | 115 | 0.61 (rejected: always-on) |

On the synthetic panel 3-state is the more useful early-warning spec. That
result does **not** override the real-FRED comparison above.

## Data (existing FRED provider only)

| Domain | Series | FAULTLINE source |
| --- | --- | --- |
| Credit | `BAMLH0A0HYM2`, `BAMLC0A0CM`, `NFCI` | Pressure / client |
| Rates | `DGS10`, `DGS2`, `T10Y2Y` | Pressure / client |
| Vol | `VIXCLS` + SPX realized vol | Guide / FRED; computed from `SP500` |
| Equity | `SP500` returns + 252d drawdown | Same FRED provider as Champion history |
| Liquidity | `SOFR`, `STLFSI4` | Pressure / shadow |

FRED pulls use `sort_order=desc` then chronological sort so the 10,000-observation
cap returns the **latest** history (ascending order truncated DGS10 at 2000).
SPX features are computed on trading sessions so a holiday gap cannot poison
21-day realized vol and drop the live as-of date.

MOVE, TIPS real yields, true equity breadth, and cross-sectional dispersion
are **not** in existing FAULTLINE stores and are not invented here.

## Run

```bash
# weekly train (scheduled path only; production uses real FRED JSON from Node)
python3 train.py --from-json artifacts/fred_panel.json --model-dir artifacts/approved --n-states 2 --skip-compare

# inference — load approved bundle, never fit
python3 inference.py --model-dir artifacts/approved --from-json artifacts/fred_panel.json --out artifacts/latest_inference.json --history-out artifacts/live_regime_path.json

# expanding-window OOS on real FRED (writes research path, not LIVE)
python3 validate.py --from-json artifacts/fred_panel.json --out artifacts/fred_validation_report.json --history-out artifacts/fred_oos_regime_path.json
```

Node scheduled jobs spawn these CLIs, persist JSON to MySQL, and expose tRPC
reads. HTTP/tRPC handlers never fit or retrain.

Railway: `POST /api/scheduled/systemic-regime-infer` daily 19:00 UTC;
`POST /api/scheduled/systemic-regime-train` weekly Monday 06:15 UTC. Same
curl + `CRON_SECRET` pattern as `seismograph-cron`.

## Canonical / Pressure / PLATO hooks (not activated as weights)

Persisted output is attached to `domainValues.systemicRegime` and
`domainValues.signalConvergence` when the seismograph pipeline **reads** the
latest row. It is **not** added to `engineValues` and
`contributesToPressureIndex` is always false.

Future ingestion points (after validation, not this PR): Pressure Index
weighting, Early Warning candidate detection, Validation Lab CURRENT claims,
Historical Truth live archive, richer PLATO claims. Documented only.
