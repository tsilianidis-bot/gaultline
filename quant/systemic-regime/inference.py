"""Load the approved frozen model and score the latest panel. Never fit."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from config import MODEL_TYPE, MODEL_VERSION
from feature_engineering import apply_fill, engineer_features
from fred_pipeline import load_panel, panel_freshness
from model_registry import load_bundle, load_meta
from regime_hmm import (
    crisis_probability,
    decode_hmm,
    regime_path,
    stress_building_probability,
    transition_probability,
)
from systemic_pca import transform_systemic_pca


def _z(series: pd.Series, value: float) -> float | None:
    if series.isna().all() or not np.isfinite(value):
        return None
    std = float(series.std(ddof=0) or 0.0)
    if std == 0:
        return 0.0
    return float((value - float(series.mean())) / std)


def _arrow(current: float | None, prior: float | None) -> str:
    if current is None or prior is None:
        return "flat"
    delta = current - prior
    if abs(delta) < 1e-9:
        return "flat"
    return "up" if delta > 0 else "down"


def score_panel(bundle: dict[str, Any], panel: pd.DataFrame) -> dict[str, Any]:
    pca_model = bundle["pca"]
    hmm_model = bundle["hmm"]
    features = engineer_features(panel)
    features = apply_fill(features, pca_model.fill_values)
    if features.empty:
        raise RuntimeError("No complete feature rows after alignment")
    pc1 = transform_systemic_pca(pca_model, features)
    states, posteriors = decode_hmm(hmm_model, pc1)
    regimes = regime_path(hmm_model, states)
    crisis = crisis_probability(hmm_model, posteriors)
    stress = stress_building_probability(hmm_model, posteriors)
    leave = transition_probability(hmm_model, states, posteriors)

    last_i = len(features) - 1
    last_ts = pd.Timestamp(features.index[last_i])
    last_row = features.iloc[last_i]
    prior_row = features.iloc[last_i - 1] if last_i > 0 else last_row
    current_regime = regimes[last_i]
    current_state = int(states[last_i])
    posterior = posteriors[last_i]
    regime_confidence = float(posterior[current_state])
    crisis_p = float(crisis[last_i])
    stress_p = float(stress[last_i])
    systemic_risk_score = int(round(100.0 * min(1.0, max(0.0, crisis_p + 0.5 * stress_p))))

    hy_z = _z(features["hy_oas"], float(last_row["hy_oas"])) if "hy_oas" in features else None
    vol_series = features["vix"] if "vix" in features and features["vix"].abs().sum() else features["spx_realized_vol_21d"]
    vol_value = float(last_row["vix"]) if "vix" in last_row.index and np.isfinite(last_row.get("vix", np.nan)) and last_row.get("vix", 0) != 0 else float(last_row["spx_realized_vol_21d"])
    vol_z = _z(vol_series.replace(0, np.nan), vol_value)
    curve = last_row.get("curve_10y2y")
    rates_z = _z(-features["curve_10y2y"], float(-curve)) if "curve_10y2y" in features and np.isfinite(curve) else None

    freshness = panel_freshness(panel)
    computed_at = datetime.now(timezone.utc).isoformat()
    return {
        "systemicRiskScore": systemic_risk_score,
        "crisisProbability": crisis_p,
        "stressBuildingProbability": stress_p,
        "transitionProbability": float(leave[last_i]),
        "currentRegime": current_regime,
        "regimeConfidence": regime_confidence,
        "creditStressZ": hy_z,
        "volStressZ": vol_z,
        "ratesStressZ": rates_z,
        "pc1": float(pc1[last_i]),
        "factorArrows": {
            "credit": _arrow(float(last_row.get("hy_oas")) if np.isfinite(last_row.get("hy_oas", np.nan)) else None, float(prior_row.get("hy_oas")) if np.isfinite(prior_row.get("hy_oas", np.nan)) else None),
            "vol": _arrow(vol_value, float(prior_row.get("spx_realized_vol_21d"))),
            "rates": _arrow(float(last_row.get("tsy_10y")) if np.isfinite(last_row.get("tsy_10y", np.nan)) else None, float(prior_row.get("tsy_10y")) if np.isfinite(prior_row.get("tsy_10y", np.nan)) else None),
        },
        "modelVersion": bundle.get("modelVersion", MODEL_VERSION),
        "modelType": bundle.get("modelType", MODEL_TYPE),
        "nStates": hmm_model.n_states,
        "pcaMethod": "standard_scaler_pca",
        "dataAsOf": last_ts.strftime("%Y-%m-%d"),
        "computedAt": computed_at,
        "freshnessStatus": freshness["freshnessStatus"],
        "historyClass": "LIVE_INFERENCE",
        "contributesToPressureIndex": False,
    }


def score_history(bundle: dict[str, Any], panel: pd.DataFrame) -> list[dict[str, Any]]:
    pca_model = bundle["pca"]
    hmm_model = bundle["hmm"]
    features = apply_fill(engineer_features(panel), pca_model.fill_values)
    if features.empty:
        return []
    pc1 = transform_systemic_pca(pca_model, features)
    states, posteriors = decode_hmm(hmm_model, pc1)
    regimes = regime_path(hmm_model, states)
    crisis = crisis_probability(hmm_model, posteriors)
    stress = stress_building_probability(hmm_model, posteriors)
    leave = transition_probability(hmm_model, states, posteriors)
    rows = []
    for i, ts in enumerate(features.index):
        crisis_p = float(crisis[i])
        stress_p = float(stress[i])
        rows.append(
            {
                "date": pd.Timestamp(ts).strftime("%Y-%m-%d"),
                "currentRegime": regimes[i],
                "crisisProbability": crisis_p,
                "stressBuildingProbability": stress_p,
                "transitionProbability": float(leave[i]),
                "regimeConfidence": float(posteriors[i, int(states[i])]),
                "systemicRiskScore": int(round(100.0 * min(1.0, max(0.0, crisis_p + 0.5 * stress_p)))),
                "pc1": float(pc1[i]),
                "spx": float(panel.loc[ts, "SP500"]) if "SP500" in panel.columns and ts in panel.index and np.isfinite(panel.loc[ts, "SP500"]) else None,
            }
        )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Systemic Regime Engine inference (load approved model; never fit)")
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--from-json")
    parser.add_argument("--from-csv")
    parser.add_argument("--out", required=True)
    parser.add_argument("--history-out")
    args = parser.parse_args()
    bundle = load_bundle(args.model_dir, approved_only=True)
    panel = load_panel(from_json=args.from_json, from_csv=args.from_csv)
    result = score_panel(bundle, panel)
    result["registry"] = load_meta(args.model_dir)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2))
    if args.history_out:
        history = score_history(bundle, panel)
        Path(args.history_out).write_text(json.dumps(history))
    print(json.dumps({"ok": True, "dataAsOf": result["dataAsOf"], "currentRegime": result["currentRegime"]}))


if __name__ == "__main__":
    main()
