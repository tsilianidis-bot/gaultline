"""Gaussian HMM regime model (hmmlearn) plus deterministic semantic mapping.

HMM state integers are NEVER treated as ordered risk labels.
States are mapped by observable stress (PC1, credit, vol, drawdown)
computed on the training window only.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM

from config import CHOSEN_N_STATES, RANDOM_STATE, REGIME_LABELS_BY_N

HMM_N_ITER = 200
HMM_COVARIANCE = "diag"
STICKY_SELF_TRANSITION = 0.97


def _sticky_transmat(n_states: int, stay: float = STICKY_SELF_TRANSITION) -> np.ndarray:
    off = (1.0 - stay) / max(n_states - 1, 1)
    matrix = np.full((n_states, n_states), off, dtype=float)
    np.fill_diagonal(matrix, stay)
    return matrix


@dataclass
class RegimeHmmModel:
    hmm: GaussianHMM
    n_states: int
    state_to_regime: dict[int, str]
    regime_to_state: dict[str, int]
    train_state_stress: dict[int, float]
    covariance_type: str = HMM_COVARIANCE

    def to_registry_meta(self) -> dict[str, Any]:
        return {
            "nStates": self.n_states,
            "stateToRegime": {str(k): v for k, v in self.state_to_regime.items()},
            "regimeToState": self.regime_to_state,
            "trainStateStress": {str(k): v for k, v in self.train_state_stress.items()},
            "covarianceType": self.covariance_type,
            "nMix": 1,
            "modelFamily": "hmmlearn.GaussianHMM",
        }


def _stress_vector(
    pc1: np.ndarray,
    features: pd.DataFrame,
) -> np.ndarray:
    pieces = [pc1]
    if "hy_oas" in features.columns:
        hy = features["hy_oas"].to_numpy(dtype=float)
        pieces.append((hy - np.nanmean(hy)) / (np.nanstd(hy) or 1.0))
    if "vix" in features.columns and features["vix"].notna().any():
        vix = features["vix"].to_numpy(dtype=float)
        pieces.append((vix - np.nanmean(vix)) / (np.nanstd(vix) or 1.0))
    if "spx_realized_vol_21d" in features.columns:
        vol = features["spx_realized_vol_21d"].to_numpy(dtype=float)
        pieces.append((vol - np.nanmean(vol)) / (np.nanstd(vol) or 1.0))
    if "spx_drawdown_252d" in features.columns:
        dd = features["spx_drawdown_252d"].to_numpy(dtype=float)
        pieces.append((-dd - np.nanmean(-dd)) / (np.nanstd(-dd) or 1.0))
    stacked = np.vstack(pieces)
    stacked = np.nan_to_num(stacked, nan=0.0)
    return stacked.mean(axis=0)


def map_states_by_observable_stress(
    states: np.ndarray,
    pc1: np.ndarray,
    features: pd.DataFrame,
    n_states: int,
) -> tuple[dict[int, str], dict[int, float]]:
    labels = REGIME_LABELS_BY_N[n_states]
    stress = _stress_vector(pc1, features)
    means: dict[int, float] = {}
    for state in range(n_states):
        mask = states == state
        means[state] = float(stress[mask].mean()) if mask.any() else float("-inf")
    ordered = sorted(means.keys(), key=lambda s: means[s])
    state_to_regime = {state: labels[rank] for rank, state in enumerate(ordered)}
    return state_to_regime, means


def fit_hmm(
    pc1: np.ndarray,
    features: pd.DataFrame,
    n_states: int = CHOSEN_N_STATES,
    random_state: int = RANDOM_STATE,
    n_iter: int = HMM_N_ITER,
) -> tuple[RegimeHmmModel, np.ndarray, np.ndarray]:
    x = pc1.reshape(-1, 1)
    hmm = GaussianHMM(
        n_components=n_states,
        covariance_type=HMM_COVARIANCE,
        n_iter=n_iter,
        random_state=random_state,
        tol=1e-3,
        init_params="mc",
        params="smc",
    )
    hmm.startprob_ = np.full(n_states, 1.0 / n_states)
    hmm.transmat_ = _sticky_transmat(n_states)
    hmm.fit(x)
    states = hmm.predict(x)
    posteriors = hmm.predict_proba(x)
    state_to_regime, means = map_states_by_observable_stress(states, pc1, features, n_states)
    model = RegimeHmmModel(
        hmm=hmm,
        n_states=n_states,
        state_to_regime=state_to_regime,
        regime_to_state={regime: state for state, regime in state_to_regime.items()},
        train_state_stress=means,
    )
    return model, states, posteriors


def decode_hmm(model: RegimeHmmModel, pc1: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    x = pc1.reshape(-1, 1)
    states = model.hmm.predict(x)
    posteriors = model.hmm.predict_proba(x)
    return states, posteriors


def regime_path(model: RegimeHmmModel, states: np.ndarray) -> list[str]:
    return [model.state_to_regime[int(state)] for state in states]


def crisis_probability(model: RegimeHmmModel, posteriors: np.ndarray) -> np.ndarray:
    crisis_state = model.regime_to_state.get("CRISIS")
    if crisis_state is None:
        return np.zeros(len(posteriors))
    return posteriors[:, crisis_state]


def stress_building_probability(model: RegimeHmmModel, posteriors: np.ndarray) -> np.ndarray:
    state = model.regime_to_state.get("STRESS BUILDING")
    if state is None:
        state = model.regime_to_state.get("STRESS")
    if state is None:
        return np.zeros(len(posteriors))
    return posteriors[:, state]


def transition_probability(model: RegimeHmmModel, states: np.ndarray, posteriors: np.ndarray) -> np.ndarray:
    """Probability of leaving the current decoded state (row-normalized transmat)."""
    trans = model.hmm.transmat_
    out = np.zeros(len(states))
    for i, state in enumerate(states):
        out[i] = float(1.0 - trans[int(state), int(state)])
    return out
