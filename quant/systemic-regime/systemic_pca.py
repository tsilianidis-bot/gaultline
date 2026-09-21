"""Ordinary StandardScaler + PCA systemic stress factor.

This is NOT Dynamic PCA. Rolling or expanding PCA, if used for research
comparisons, must be named rolling PCA or expanding-window PCA.
The approved production model is a frozen StandardScaler + PCA fit on the
training window only (n_components=1).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from config import FEATURE_COLUMNS, N_PCA_COMPONENTS, PCA_METHOD, STRESS_ORIENTATION_FEATURES


@dataclass
class SystemicPcaModel:
    scaler: StandardScaler
    pca: PCA
    feature_schema: list[str]
    pc1_sign: int
    training_start: str
    training_end: str
    method: str = PCA_METHOD
    n_components: int = N_PCA_COMPONENTS
    explained_variance_ratio: float = 0.0
    fill_values: dict[str, float] = field(default_factory=dict)

    def to_registry_meta(self) -> dict[str, Any]:
        return {
            "pcaMethod": self.method,
            "pcaNComponents": self.n_components,
            "pc1Sign": self.pc1_sign,
            "explainedVarianceRatio": self.explained_variance_ratio,
            "featureSchema": self.feature_schema,
            "trainingStart": self.training_start,
            "trainingEnd": self.training_end,
            "fillValues": self.fill_values,
        }


def _orient_pc1(pca: PCA, scaled: np.ndarray, features: pd.DataFrame) -> int:
    """Flip PC1 so higher values correspond to observable stress, not state index."""
    scores = scaled @ pca.components_[0]
    stress = pd.Series(0.0, index=features.index)
    n = 0
    for column in STRESS_ORIENTATION_FEATURES:
        if column not in features.columns or features[column].isna().all():
            continue
        series = features[column].astype(float)
        if column == "spx_drawdown_252d":
            series = -series  # deeper drawdown = more stress
        z = (series - series.mean()) / (series.std(ddof=0) or 1.0)
        stress = stress.add(z.fillna(0.0), fill_value=0.0)
        n += 1
    if n == 0:
        return 1
    corr = np.corrcoef(scores, stress.to_numpy())[0, 1]
    if np.isnan(corr):
        return 1
    return 1 if corr >= 0 else -1


def fit_systemic_pca(features: pd.DataFrame, fill_values: dict[str, float]) -> tuple[SystemicPcaModel, np.ndarray]:
    schema = [column for column in FEATURE_COLUMNS if column in features.columns]
    matrix = features[schema].to_numpy(dtype=float)
    scaler = StandardScaler()
    scaled = scaler.fit_transform(matrix)
    pca = PCA(n_components=N_PCA_COMPONENTS, random_state=42)
    pca.fit(scaled)
    sign = _orient_pc1(pca, scaled, features)
    scores = (scaled @ pca.components_[0]) * sign
    model = SystemicPcaModel(
        scaler=scaler,
        pca=pca,
        feature_schema=schema,
        pc1_sign=sign,
        training_start=pd.Timestamp(features.index.min()).strftime("%Y-%m-%d"),
        training_end=pd.Timestamp(features.index.max()).strftime("%Y-%m-%d"),
        explained_variance_ratio=float(pca.explained_variance_ratio_[0]),
        fill_values=fill_values,
    )
    return model, scores.astype(float)


def transform_systemic_pca(model: SystemicPcaModel, features: pd.DataFrame) -> np.ndarray:
    schema = model.feature_schema
    matrix = features[schema].to_numpy(dtype=float)
    scaled = model.scaler.transform(matrix)
    scores = (scaled @ model.pca.components_[0]) * model.pc1_sign
    return scores.astype(float)
