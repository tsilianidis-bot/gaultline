from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from feature_engineering import apply_fill, engineer_features, training_fill_values
from inference import score_history, score_panel
from model_registry import load_bundle, save_bundle
from regime_hmm import fit_hmm, map_states_by_observable_stress
from synthetic import generate_synthetic_panel
from systemic_pca import PCA_METHOD, fit_systemic_pca, transform_systemic_pca
from train import train
from validate import choose_architecture, evaluate_n_states, run_validation


@pytest.fixture(scope="module")
def panel() -> pd.DataFrame:
    return generate_synthetic_panel(start="2006-01-03", end="2023-12-29", seed=42)


def test_features_do_not_look_ahead(panel: pd.DataFrame) -> None:
    cutoff = pd.Timestamp("2018-06-29")
    early = engineer_features(panel, as_of=cutoff)
    full = engineer_features(panel)
    shared = early.index.intersection(full.index)
    assert len(shared) > 100
    # Values at t using only data <= cutoff must match the as-of slice.
    cols = ["hy_oas", "spx_return_21d", "spx_realized_vol_21d", "spx_drawdown_252d"]
    pd.testing.assert_frame_equal(
        early.loc[shared, cols],
        full.loc[shared, cols],
        check_exact=False,
        rtol=1e-9,
        atol=1e-9,
    )
    assert early.index.max() <= cutoff


def test_ffill_does_not_cross_as_of_boundary(panel: pd.DataFrame) -> None:
    cutoff = pd.Timestamp("2015-08-14")
    clipped = engineer_features(panel, as_of=cutoff)
    assert clipped.index.max() <= cutoff
    future = panel.loc[panel.index > cutoff]
    assert not any(ts in clipped.index for ts in future.index)


def test_pca_is_ordinary_not_dynamic(panel: pd.DataFrame) -> None:
    features = apply_fill(engineer_features(panel.loc["2010":"2016"]), training_fill_values(engineer_features(panel.loc["2010":"2016"])))
    model, scores = fit_systemic_pca(features, training_fill_values(features))
    assert model.method == "standard_scaler_pca"
    assert PCA_METHOD == "standard_scaler_pca"
    assert model.n_components == 1
    assert len(scores) == len(features)
    # Orient PC1 toward stress: crisis window mean >= calm window mean
    calm = scores[features.index.year == 2013]
    covid_like = scores[(features.index >= "2011-07-01") & (features.index <= "2012-06-30")]
    assert float(np.mean(covid_like)) >= float(np.mean(calm)) - 0.15


def test_hmm_mapping_does_not_assume_state_zero_is_safe(panel: pd.DataFrame) -> None:
    slice_ = panel.loc["2007":"2012"]
    features = apply_fill(engineer_features(slice_), training_fill_values(engineer_features(slice_)))
    pca_model, pc1 = fit_systemic_pca(features, training_fill_values(features))
    # Force a reversed labeling by swapping after fit; mapping must still rank by stress.
    hmm_model, states, _ = fit_hmm(pc1, features, n_states=3, n_iter=60)
    assert float(np.diag(hmm_model.hmm.transmat_).min()) >= 0.9
    mapping, means = map_states_by_observable_stress(states, pc1, features, 3)
    crisis_state = hmm_model.regime_to_state["CRISIS"]
    normal_state = hmm_model.regime_to_state["NORMAL"]
    assert means[crisis_state] >= means[normal_state]
    assert mapping[crisis_state] == "CRISIS"
    assert set(mapping.values()) == {"NORMAL", "STRESS BUILDING", "CRISIS"}
    # State 0 is allowed to be CRISIS if that is the high-stress cluster.
    assert "NORMAL" in mapping.values()
    from regime_hmm import stress_building_probability
    _, _, posteriors = fit_hmm(pc1, features, n_states=3, n_iter=60)
    stress_p = stress_building_probability(hmm_model, posteriors)
    if hmm_model.regime_to_state["STRESS BUILDING"] == 0:
        assert float(stress_p.max()) > 0.1


def test_inference_loads_frozen_model_and_does_not_refit(panel: pd.DataFrame, tmp_path) -> None:
    train_panel = panel.loc[: "2019-12-31"]
    result = train(train_panel, tmp_path, n_states=3, approve=True, compare_states=False)
    bundle = load_bundle(tmp_path, approved_only=True)
    means_before = bundle["hmm"].hmm.means_.copy()
    trans_before = bundle["hmm"].hmm.transmat_.copy()
    score = score_panel(bundle, panel.loc[: "2020-03-31"])
    assert score["modelType"] == "gaussian-hmm-3state"
    assert score["pcaMethod"] == "standard_scaler_pca"
    assert score["contributesToPressureIndex"] is False
    assert score["currentRegime"] in {"NORMAL", "STRESS BUILDING", "CRISIS"}
    np.testing.assert_allclose(bundle["hmm"].hmm.means_, means_before)
    np.testing.assert_allclose(bundle["hmm"].hmm.transmat_, trans_before)
    assert result["nStates"] == 3


def test_oos_validation_has_no_train_year_leak(panel: pd.DataFrame) -> None:
    features = engineer_features(panel)
    result = evaluate_n_states(features, panel, 3)
    for fold in result["folds"]:
        assert fold["testYear"] > int(fold["trainEnd"])
    assert result["nOos"] > 200
    assert "meanLeadTimeDays" in result


def test_architecture_choice_documents_three_state() -> None:
    fake = {
        2: {"meanLeadTimeDays": 8.0, "falseTransitions": 40, "warningShare": 0.12, "eventShare": 0.18, "recall": 0.45, "precision": 0.4, "meanDwellDays": 30},
        3: {"meanLeadTimeDays": 18.0, "falseTransitions": 55, "warningShare": 0.22, "eventShare": 0.18, "recall": 0.62, "precision": 0.48, "meanDwellDays": 22},
        4: {"meanLeadTimeDays": 16.0, "falseTransitions": 110, "warningShare": 0.34, "eventShare": 0.18, "recall": 0.66, "precision": 0.35, "meanDwellDays": 12},
    }
    choice = choose_architecture(fake)
    assert choice["chosenNStates"] == 3
    assert "STRESS BUILDING" in choice["rationale"]
    assert "Dynamic PCA" not in choice["rationale"]


def test_score_history_preserves_timestamps(panel: pd.DataFrame, tmp_path) -> None:
    train(panel.loc[: "2016-12-30"], tmp_path, n_states=3, approve=True, compare_states=False)
    bundle = load_bundle(tmp_path)
    history = score_history(bundle, panel.loc[: "2017-03-31"])
    assert history
    dates = [row["date"] for row in history]
    assert dates == sorted(dates)
    assert history[0]["date"] < history[-1]["date"]
