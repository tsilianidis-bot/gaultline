"""FAULTLINE Systemic Regime Engine — independent statistical worker.

This package is additive. It does not replace Pressure Index, PLATO,
canonical state, or existing intelligence engines.

PCA and HMM here are statistical methods, not AI.
PCA is ordinary StandardScaler + PCA (n_components=1), never "Dynamic PCA".
"""

__version__ = "1.0.0"
MODEL_VERSION = "sre-hmm3-v1.0.0"
FEATURE_SCHEMA_VERSION = "sre-features-v1"
MODEL_TYPE = "gaussian-hmm-3state"
