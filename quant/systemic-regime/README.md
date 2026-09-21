# FAULTLINE Systemic Regime Engine

Independent statistical worker. **Not AI.** Ordinary `StandardScaler + PCA`
(`n_components=1`) plus `hmmlearn.GaussianHMM`. This is **not** Dynamic PCA.

This engine is **additive**. It does not replace Pressure Index, PLATO, the
canonical state pipeline, or existing intelligence engines. It does **not**
change Pressure Index weights.

## Why 3-state

| Spec | Labels | Early-warning usefulness |
| --- | --- | --- |
| 2-state | NORMAL / CRISIS | No building-stress state; jumps late |
| **3-state (chosen)** | **NORMAL / STRESS BUILDING / CRISIS** | Lead-time state without 4-state chatter |
| 4-state | RISK ON / TRANSITION / STRESS / CRISIS | More false transitions; RISK ON vs NORMAL split is unstable OOS |

HMM integers are mapped by observable stress (PC1, HY OAS, vol, drawdown) on
the **training window only**. State 0 is never assumed to be low risk. The
transition matrix is sticky (self-transition 0.97, not re-estimated) so regimes
persist instead of flickering.

## Validation (synthetic FRED-like panel, expanding-window OOS)

Planted windows: GFC, 2011 EMU, 2015–16, Q4 2018, COVID, 2022 hike. Research-only;
not CURRENT product truth.

| Spec | Precision | Recall | False transitions | Mean dwell | Mean lead (days) | Warning share |
| --- | --- | --- | --- | --- | --- | --- |
| 2-state | 0.89 | 0.67 | 18 | 192 | 35 | 0.15 |
| **3-state (chosen)** | **0.45** | **0.80** | **31** | **114** | **41** | **0.36** |
| 4-state | 0.31 | 0.91 | 64 | 56 | 91 | 0.60 (rejected: always-on) |

3-state lead times where a warning existed in the 180d pre-window: taper 66d, COVID 17d, 2022 40d. Early events can fall before the expanding OOS start. Crisis-probability ECE ≈ 0.12. 4-state is not used because it warned on ~60% of days vs ~20% event share.

## Data (existing FRED provider only)

| Domain | Series | FAULTLINE source |
| --- | --- | --- |
| Credit | `BAMLH0A0HYM2`, `BAMLC0A0CM`, `NFCI` | Pressure / client |
| Rates | `DGS10`, `DGS2`, `T10Y2Y` | Pressure / client |
| Vol | `VIXCLS` + SPX realized vol | Guide / FRED; computed from `SP500` |
| Equity | `SP500` returns + 252d drawdown | Same FRED provider as Champion history |
| Liquidity | `SOFR`, `STLFSI4` | Pressure / shadow |

MOVE, TIPS real yields, true equity breadth, and cross-sectional dispersion
are **not** in existing FAULTLINE stores and are not invented here.

## Run

```bash
# weekly train (scheduled path only)
python3 train.py --from-csv fixtures/synthetic_panel.csv --model-dir artifacts/approved --skip-compare

# inference — load approved bundle, never fit
python3 inference.py --model-dir artifacts/approved --from-csv fixtures/synthetic_panel.csv --out artifacts/latest_inference.json

# expanding-window OOS
python3 validate.py --from-csv fixtures/synthetic_panel.csv --out artifacts/validation_report.json
```

Node scheduled jobs spawn these CLIs, persist JSON to MySQL, and expose tRPC
reads. HTTP/tRPC handlers never fit or retrain.

## Canonical / Pressure / PLATO hooks (not activated as weights)

Persisted output is attached to `domainValues.systemicRegime` and
`domainValues.signalConvergence` when the seismograph pipeline **reads** the
latest row. It is **not** added to `engineValues` and
`contributesToPressureIndex` is always false.

Future ingestion points (after validation, not this PR): Pressure Index
weighting, Early Warning candidate detection, Validation Lab CURRENT claims,
Historical Truth live archive, richer PLATO claims. Documented only.
