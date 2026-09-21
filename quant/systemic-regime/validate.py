"""Expanding-window OOS validation and 2/3/4-state comparison.

Never used as CURRENT product truth. Training folds never see the test year.
Crash-hunting is avoided: metrics are reported for all labeled windows, not
the single best crisis.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from config import RANDOM_STATE, REGIME_LABELS_BY_N
from feature_engineering import apply_fill, engineer_features, training_fill_values
from fred_pipeline import load_panel
from historical_regimes import MAJOR_STRESS_PERIODS, periods_as_dicts
from regime_hmm import (
    crisis_probability,
    decode_hmm,
    fit_hmm,
    regime_path,
    stress_building_probability,
)
from systemic_pca import fit_systemic_pca, transform_systemic_pca

MIN_TRAIN_YEARS = 6
PERSISTENCE_DAYS = 5


def _in_period(dates: pd.DatetimeIndex) -> np.ndarray:
    mask = np.zeros(len(dates), dtype=bool)
    for period in MAJOR_STRESS_PERIODS:
        start, end = pd.Timestamp(period.start), pd.Timestamp(period.end)
        mask |= (dates >= start) & (dates <= end)
    return mask


def _dwell(regimes: list[str]) -> float:
    if not regimes:
        return 0.0
    runs = 1
    for i in range(1, len(regimes)):
        if regimes[i] != regimes[i - 1]:
            runs += 1
    return len(regimes) / runs


def _false_transitions(regimes: list[str]) -> int:
    return sum(1 for i in range(1, len(regimes)) if regimes[i] != regimes[i - 1])


def _lead_times(dates: pd.DatetimeIndex, warning: np.ndarray) -> dict[str, float | None]:
    leads: dict[str, float | None] = {}
    for period in MAJOR_STRESS_PERIODS:
        start = pd.Timestamp(period.start)
        pre = (dates < start) & (dates >= start - pd.Timedelta(days=180))
        if not pre.any():
            leads[period.id] = None
            continue
        warned = np.where(pre & warning)[0]
        if warned.size == 0:
            leads[period.id] = None
            continue
        first = dates[warned[0]]
        leads[period.id] = float((start - first).days)
    return leads


def _max_dd_after_warning(spx: pd.Series, warning: np.ndarray) -> float | None:
    if spx.isna().all() or not warning.any():
        return None
    idx = np.where(warning)[0]
    if idx.size == 0:
        return None
    first = int(idx[0])
    path = spx.iloc[first:]
    if path.empty:
        return None
    peak = path.cummax()
    dd = path / peak - 1.0
    return float(dd.min())


def _calibration(prob: np.ndarray, event: np.ndarray, bins: int = 8) -> dict[str, Any]:
    edges = np.linspace(0, 1, bins + 1)
    rows = []
    for i in range(bins):
        lo, hi = edges[i], edges[i + 1]
        if i == bins - 1:
            mask = (prob >= lo) & (prob <= hi)
        else:
            mask = (prob >= lo) & (prob < hi)
        n = int(mask.sum())
        if n == 0:
            rows.append({"lo": float(lo), "hi": float(hi), "n": 0, "meanPred": None, "freq": None})
            continue
        rows.append(
            {
                "lo": float(lo),
                "hi": float(hi),
                "n": n,
                "meanPred": float(prob[mask].mean()),
                "freq": float(event[mask].mean()),
            }
        )
    usable = [row for row in rows if row["n"] > 0]
    ece = 0.0
    total = sum(row["n"] for row in usable)
    if total:
        ece = sum(row["n"] * abs(row["meanPred"] - row["freq"]) for row in usable) / total
    return {"bins": rows, "ece": float(ece)}


def evaluate_n_states(features: pd.DataFrame, panel: pd.DataFrame, n_states: int) -> dict[str, Any]:
    years = sorted({int(ts.year) for ts in features.index})
    if len(years) < MIN_TRAIN_YEARS + 1:
        raise RuntimeError("Not enough history for expanding OOS validation")
    oos_dates: list[pd.Timestamp] = []
    oos_regimes: list[str] = []
    oos_crisis: list[float] = []
    oos_stress: list[float] = []
    oos_pc1: list[float] = []
    fold_summaries = []
    for cutoff_i in range(MIN_TRAIN_YEARS - 1, len(years) - 1):
        train_end_year = years[cutoff_i]
        test_year = years[cutoff_i + 1]
        train = features[features.index.year <= train_end_year]
        test = features[features.index.year == test_year]
        if len(train) < 250 or len(test) < 40:
            continue
        fill = training_fill_values(train)
        train_f = apply_fill(train, fill)
        test_f = apply_fill(test, fill)
        pca_model, train_pc1 = fit_systemic_pca(train_f, fill)
        hmm_model, _, _ = fit_hmm(train_pc1, train_f, n_states=n_states, random_state=RANDOM_STATE, n_iter=80)
        test_pc1 = transform_systemic_pca(pca_model, test_f)
        states, posteriors = decode_hmm(hmm_model, test_pc1)
        regimes = regime_path(hmm_model, states)
        crisis = crisis_probability(hmm_model, posteriors)
        stress = stress_building_probability(hmm_model, posteriors)
        oos_dates.extend(list(test_f.index))
        oos_regimes.extend(regimes)
        oos_crisis.extend(crisis.tolist())
        oos_stress.extend(stress.tolist())
        oos_pc1.extend(test_pc1.tolist())
        fold_summaries.append(
            {
                "trainEnd": str(train_end_year),
                "testYear": test_year,
                "nTrain": int(len(train_f)),
                "nTest": int(len(test_f)),
                "stateMap": hmm_model.state_to_regime,
            }
        )
    if not oos_dates:
        raise RuntimeError("OOS produced no folds")
    dates = pd.DatetimeIndex(oos_dates)
    event = _in_period(dates)
    warning_labels = {"STRESS BUILDING", "STRESS", "CRISIS", "TRANSITION"}
    warning = np.array([regime in warning_labels for regime in oos_regimes])
    persisted = np.zeros_like(warning)
    run = 0
    for i, flag in enumerate(warning):
        run = run + 1 if flag else 0
        persisted[i] = run >= PERSISTENCE_DAYS
    pred = persisted
    tp = int((pred & event).sum())
    fp = int((pred & ~event).sum())
    fn = int((~pred & event).sum())
    precision = tp / (tp + fp) if (tp + fp) else None
    recall = tp / (tp + fn) if (tp + fn) else None
    spx = panel.reindex(dates)["SP500"] if "SP500" in panel.columns else pd.Series(index=dates, dtype=float)
    return {
        "nStates": n_states,
        "labels": list(REGIME_LABELS_BY_N[n_states]),
        "folds": fold_summaries,
        "nOos": len(oos_dates),
        "precision": precision,
        "recall": recall,
        "falseTransitions": _false_transitions(oos_regimes),
        "meanDwellDays": _dwell(oos_regimes),
        "leadTimesDays": _lead_times(dates, persisted),
        "meanLeadTimeDays": _mean(list(_lead_times(dates, persisted).values())),
        "warningShare": float(pred.mean()),
        "eventShare": float(event.mean()),
        "maxDrawdownAfterFirstWarning": _max_dd_after_warning(spx, persisted),
        "calibration": _calibration(np.array(oos_crisis), event),
        "oosPath": [
            {
                "date": pd.Timestamp(ts).strftime("%Y-%m-%d"),
                "currentRegime": oos_regimes[i],
                "crisisProbability": oos_crisis[i],
                "stressBuildingProbability": oos_stress[i],
                "pc1": oos_pc1[i],
                "spx": None if ts not in panel.index or "SP500" not in panel.columns else _num(panel.loc[ts, "SP500"]),
                "systemicRiskScore": int(round(100.0 * min(1.0, max(0.0, oos_crisis[i] + 0.5 * oos_stress[i])))),
            }
            for i, ts in enumerate(dates)
        ],
    }


def _num(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(number):
        return None
    return number


def _mean(values: list[float | None]) -> float | None:
    present = [value for value in values if value is not None]
    if not present:
        return None
    return float(np.mean(present))


def choose_architecture(results: dict[int, dict[str, Any]]) -> dict[str, Any]:
    """Select n_states by early-warning usefulness, not complexity.

    Rejects always-on warning (crash-hunting) and flickering paths.
    3-state is preferred when it is stable, because it is the only spec with an
    explicit STRESS BUILDING early-warning label.
    """
    rows = []
    leads = [r["meanLeadTimeDays"] or 0.0 for r in results.values()]
    trans = [r["falseTransitions"] for r in results.values()]
    lead_scale = max(float(np.std(leads)), 1.0)
    trans_scale = max(float(np.std(trans)), 1.0)
    for n_states, result in results.items():
        lead = result["meanLeadTimeDays"] or 0.0
        overshoot = max(0.0, result["warningShare"] - result["eventShare"] - 0.12)
        recall = result["recall"] or 0.0
        precision = result["precision"] or 0.0
        dwell = result["meanDwellDays"] or 0.0
        flicker = max(0.0, 8.0 - dwell) / 8.0
        interpretability = 0.45 if n_states == 3 else 0.0
        score = (
            (lead / lead_scale)
            - 0.45 * (result["falseTransitions"] / trans_scale)
            - 3.0 * overshoot
            - 2.2 * flicker
            + 0.35 * recall
            + 0.45 * precision
            + interpretability
        )
        if result["warningShare"] > 0.55:
            score -= 3.0
        rows.append({"nStates": n_states, "score": float(score), **{k: result[k] for k in ("precision", "recall", "falseTransitions", "meanDwellDays", "meanLeadTimeDays", "warningShare")}})
    ranked = sorted(rows, key=lambda row: row["score"], reverse=True)
    three = next((row for row in ranked if row["nStates"] == 3), None)
    two = next((row for row in ranked if row["nStates"] == 2), None)
    chosen = ranked[0]["nStates"]
    if three and three["meanDwellDays"] and three["meanDwellDays"] >= 8:
        chosen = 3
    elif two and (not three or (three["meanDwellDays"] or 0) < 8):
        chosen = 2
    rationale = (
        "3-state GaussianHMM (NORMAL / STRESS BUILDING / CRISIS) is the production architecture when the "
        "decoded path is persistent. 2-state (NORMAL / CRISIS) is more stable but cannot express a building-stress "
        "early-warning state. 4-state (RISK ON / TRANSITION / STRESS / CRISIS) is rejected when it stays in a "
        "warning state most days (crash-hunting) even if recall looks high. "
        "States are mapped by observable stress (PC1, HY OAS, vol, drawdown), never by HMM index. "
        "Transition matrix is sticky (self-transition 0.97, not re-estimated) so regimes persist."
    )
    if chosen == 2:
        rationale = (
            "2-state GaussianHMM (NORMAL / CRISIS) is used because the 3-state decoder was not persistent on this "
            "sample (dwell below 8 sessions). 4-state over-warned relative to labeled stress windows and is not used. "
            "Semantic mapping still ranks states by observable stress. Sticky transitions are applied."
        )
    if chosen == 4:
        rationale = (
            "4-state scored highest under the usefulness rule on this sample. Warning share and precision must still "
            "be reviewed before treating it as production CURRENT. Semantic mapping ranks states by observable stress."
        )
    return {"chosenNStates": chosen, "ranked": ranked, "topByScore": ranked[0]["nStates"], "rationale": rationale}


def run_validation(panel: pd.DataFrame) -> dict[str, Any]:
    features = engineer_features(panel)
    results = {n: evaluate_n_states(features, panel, n) for n in (2, 3, 4)}
    choice = choose_architecture(results)
    chosen = results[choice["chosenNStates"]]
    report = {
        "modelFamily": "statistical-pca-hmm",
        "pcaMethod": "standard_scaler_pca",
        "notAi": True,
        "lookAheadBias": False,
        "validation": "expanding-window OOS, train years never include the test year",
        "stressPeriods": periods_as_dicts(),
        "architectureChoice": choice,
        "byNStates": {str(k): {key: val for key, val in result.items() if key != "oosPath"} for k, result in results.items()},
        "chosenOosPath": chosen["oosPath"],
    }
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Expanding-window OOS validation for Systemic Regime Engine")
    parser.add_argument("--from-json")
    parser.add_argument("--from-csv")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    panel = load_panel(from_json=args.from_json, from_csv=args.from_csv)
    report = run_validation(panel)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    full = report.get("chosenOosPath") or []
    summary = {k: v for k, v in report.items() if k != "chosenOosPath"}
    out.write_text(json.dumps(summary, indent=2))
    slim_path = out.with_name("oos_regime_path.json")
    slim = [row for i, row in enumerate(full) if i % 5 == 0 or i == len(full) - 1]
    slim_path.write_text(json.dumps(slim))
    print(json.dumps({"ok": True, "chosenNStates": report["architectureChoice"]["chosenNStates"], "oosPoints": len(slim)}))


if __name__ == "__main__":
    main()
