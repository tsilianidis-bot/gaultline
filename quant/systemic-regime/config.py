"""Series registry and feature schema for the Systemic Regime Engine.

All FRED series IDs are reused from existing FAULTLINE sources.
This worker does not introduce a new data provider.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

MODEL_VERSION = "sre-hmm2-v1.0.0"
FEATURE_SCHEMA_VERSION = "sre-features-v1"
MODEL_TYPE = "gaussian-hmm-2state"
PCA_METHOD = "standard_scaler_pca"  # ordinary PCA; never labeled Dynamic PCA
N_PCA_COMPONENTS = 1
CHOSEN_N_STATES = 2
RANDOM_STATE = 42

# FAULTLINE-existing FRED series. required=True means a row is dropped if the
# feature cannot be formed after alignment. Optional series are used when present.
@dataclass(frozen=True)
class FredSeriesSpec:
    series_id: str
    name: str
    domain: Literal["credit", "rates", "vol", "equity", "liquidity"]
    required: bool
    frequency: Literal["daily", "weekly", "monthly"]
    max_ffill_calendar_days: int
    already_used_in_faultline: str


FRED_SERIES: tuple[FredSeriesSpec, ...] = (
    FredSeriesSpec("BAMLH0A0HYM2", "hy_oas", "credit", False, "daily", 4, "pressure engine + Champion inputs"),
    FredSeriesSpec("BAMLC0A0CM", "ig_oas", "credit", False, "daily", 4, "client chartData credit series"),
    FredSeriesSpec("NFCI", "nfci", "liquidity", False, "weekly", 10, "client live-data / FCI"),
    FredSeriesSpec("DGS10", "tsy_10y", "rates", True, "daily", 4, "pressure engine"),
    FredSeriesSpec("DGS2", "tsy_2y", "rates", True, "daily", 4, "pressure engine"),
    FredSeriesSpec("T10Y2Y", "curve_10y2y", "rates", False, "daily", 4, "client live-data yield curve"),
    FredSeriesSpec("SOFR", "sofr", "liquidity", False, "daily", 4, "pressure engine liquidity"),
    FredSeriesSpec("STLFSI4", "stlfsi", "liquidity", False, "weekly", 10, "V3-H shadow engine"),
    FredSeriesSpec("VIXCLS", "vix", "vol", False, "daily", 4, "Guide / vol documentation; FRED close"),
    FredSeriesSpec("SP500", "spx", "equity", True, "daily", 0, "verified outcomes use ^GSPC; FRED SP500 is the same provider path"),
)

# Features fed to StandardScaler + PCA. Rolling windows end at t (inclusive);
# no future observations are used.
FEATURE_COLUMNS: tuple[str, ...] = (
    "hy_oas",
    "hy_oas_20d_change",
    "ig_oas",
    "nfci",
    "tsy_10y",
    "tsy_2y",
    "curve_10y2y",
    "sofr",
    "stlfsi",
    "vix",
    "spx_return_21d",
    "spx_realized_vol_21d",
    "spx_drawdown_252d",
)

REQUIRED_FEATURES: tuple[str, ...] = (
    "tsy_10y",
    "tsy_2y",
    "spx_return_21d",
    "spx_realized_vol_21d",
    "spx_drawdown_252d",
)

STRESS_ORIENTATION_FEATURES: tuple[str, ...] = (
    "hy_oas",
    "vix",
    "spx_realized_vol_21d",
    "spx_drawdown_252d",
)

REGIME_LABELS_BY_N: dict[int, tuple[str, ...]] = {
    2: ("NORMAL", "CRISIS"),
    3: ("NORMAL", "STRESS BUILDING", "CRISIS"),
    4: ("RISK ON", "TRANSITION", "STRESS", "CRISIS"),
}

DETERIORATING_REGIMES = frozenset({"STRESS BUILDING", "CRISIS", "STRESS", "TRANSITION"})

FRED_OBSERVATIONS_ENDPOINT = "https://api.stlouisfed.org/fred/series/observations"
FRED_HISTORY_LIMIT = 10000
