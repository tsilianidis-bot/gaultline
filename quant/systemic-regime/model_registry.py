"""Frozen model registry. Fit artifacts are never rewritten during inference."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib

from config import (
    CHOSEN_N_STATES,
    FEATURE_SCHEMA_VERSION,
    MODEL_TYPE,
    MODEL_VERSION,
    PCA_METHOD,
)
from regime_hmm import RegimeHmmModel
from systemic_pca import SystemicPcaModel

APPROVED_NAME = "approved.joblib"
META_NAME = "registry.json"


def save_bundle(
    directory: str | Path,
    pca_model: SystemicPcaModel,
    hmm_model: RegimeHmmModel,
    *,
    approved: bool = False,
    extra: dict[str, Any] | None = None,
) -> Path:
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    bundle = {
        "pca": pca_model,
        "hmm": hmm_model,
        "modelVersion": MODEL_VERSION,
        "modelType": MODEL_TYPE,
        "featureSchemaVersion": FEATURE_SCHEMA_VERSION,
        "pcaMethod": PCA_METHOD,
        "nStates": hmm_model.n_states,
        "savedAt": datetime.now(timezone.utc).isoformat(),
    }
    path = directory / ("approved.joblib" if approved else f"{MODEL_VERSION}.joblib")
    joblib.dump(bundle, path)
    meta = {
        "modelVersion": MODEL_VERSION,
        "modelType": MODEL_TYPE,
        "featureSchemaVersion": FEATURE_SCHEMA_VERSION,
        "approved": approved,
        "nStates": hmm_model.n_states,
        "chosenNStates": CHOSEN_N_STATES,
        "pca": pca_model.to_registry_meta(),
        "hmm": hmm_model.to_registry_meta(),
        "artifact": path.name,
        **(extra or {}),
    }
    (directory / META_NAME).write_text(json.dumps(meta, indent=2, sort_keys=True))
    if approved:
        joblib.dump(bundle, directory / APPROVED_NAME)
    return path


def load_bundle(directory: str | Path, *, approved_only: bool = True) -> dict[str, Any]:
    directory = Path(directory)
    path = directory / APPROVED_NAME if approved_only else _latest_joblib(directory)
    if not path.exists():
        raise FileNotFoundError(f"No {'approved' if approved_only else 'saved'} model in {directory}")
    bundle = joblib.load(path)
    if "pca" not in bundle or "hmm" not in bundle:
        raise ValueError("Model bundle missing pca/hmm payloads")
    return bundle


def load_meta(directory: str | Path) -> dict[str, Any]:
    path = Path(directory) / META_NAME
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def _latest_joblib(directory: Path) -> Path:
    approved = directory / APPROVED_NAME
    if approved.exists():
        return approved
    candidates = sorted(directory.glob("*.joblib"))
    if not candidates:
        raise FileNotFoundError(f"No joblib artifacts in {directory}")
    return candidates[-1]
