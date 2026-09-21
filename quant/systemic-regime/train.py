"""Weekly training path. Fits scaler + PCA + HMM on history through as-of. Never invoked from an API request."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from config import CHOSEN_N_STATES
from feature_engineering import apply_fill, engineer_features, training_fill_values
from fred_pipeline import load_panel
from model_registry import save_bundle
from regime_hmm import fit_hmm
from systemic_pca import fit_systemic_pca
from validate import choose_architecture, evaluate_n_states


def train(
    panel,
    model_dir: Path,
    *,
    n_states: int | None = None,
    approve: bool = True,
    compare_states: bool = True,
) -> dict:
    features = engineer_features(panel)
    if features.empty:
        raise RuntimeError("No training rows after feature engineering")
    fill = training_fill_values(features)
    filled = apply_fill(features, fill)
    selected = n_states or CHOSEN_N_STATES
    comparison = None
    if compare_states:
        by_n = {n: evaluate_n_states(features, panel, n) for n in (2, 3, 4)}
        comparison = choose_architecture(by_n)
        selected = comparison["chosenNStates"]
    pca_model, pc1 = fit_systemic_pca(filled, fill)
    hmm_model, _, _ = fit_hmm(pc1, filled, n_states=selected)
    extra = {
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "nRows": int(len(filled)),
        "architectureComparison": comparison,
        "note": "Ordinary StandardScaler + PCA (n_components=1) plus hmmlearn GaussianHMM. Statistical, not AI.",
    }
    save_bundle(model_dir, pca_model, hmm_model, approved=approve, extra=extra)
    model_type = f"gaussian-hmm-{selected}state"
    model_version = f"sre-hmm{selected}-v1.0.0"
    return {
        "ok": True,
        "modelVersion": model_version,
        "modelType": model_type,
        "nStates": selected,
        "nRows": int(len(filled)),
        "trainingStart": pca_model.training_start,
        "trainingEnd": pca_model.training_end,
        "explainedVarianceRatio": pca_model.explained_variance_ratio,
        "stateMap": hmm_model.state_to_regime,
        "architectureComparison": comparison,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Weekly Systemic Regime Engine training (not for API requests)")
    parser.add_argument("--from-json")
    parser.add_argument("--from-csv")
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--n-states", type=int, choices=(2, 3, 4))
    parser.add_argument("--skip-compare", action="store_true")
    args = parser.parse_args()
    panel = load_panel(from_json=args.from_json, from_csv=args.from_csv)
    result = train(
        panel,
        Path(args.model_dir),
        n_states=args.n_states,
        compare_states=not args.skip_compare,
    )
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
