"""Causal feature engineering for the Systemic Regime Engine.

Rules:
- Align all series by calendar date.
- Never use t+1 information at date t.
- Forward-fill only within a series-specific max window for publication lag
  (weekly FCI / STLFSI), never across the as-of boundary, never into the future.
- Preserve original timestamps via last_valid observation metadata.
- Missing optional features stay NaN and are median-filled from the *training*
  window only at model fit time.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from config import FEATURE_COLUMNS, FRED_SERIES, REQUIRED_FEATURES


def _spec_map() -> dict[str, Any]:
    return {spec.series_id: spec for spec in FRED_SERIES}


def align_and_ffill(panel: pd.DataFrame, as_of: pd.Timestamp | None = None) -> pd.DataFrame:
    specs = _spec_map()
    frame = panel.copy().sort_index()
    if as_of is not None:
        frame = frame.loc[frame.index <= pd.Timestamp(as_of)]
    filled = pd.DataFrame(index=frame.index)
    for series_id, series in frame.items():
        spec = specs.get(str(series_id))
        if spec is None:
            filled[series_id] = series
            continue
        if spec.max_ffill_calendar_days <= 0:
            filled[series_id] = series
            continue
        filled[series_id] = series.ffill(limit=spec.max_ffill_calendar_days)
    return filled


def engineer_features(panel: pd.DataFrame, as_of: pd.Timestamp | None = None) -> pd.DataFrame:
    aligned = align_and_ffill(panel, as_of=as_of)
    out = pd.DataFrame(index=aligned.index)
    hy = aligned.get("BAMLH0A0HYM2")
    ig = aligned.get("BAMLC0A0CM")
    nfci = aligned.get("NFCI")
    dgs10 = aligned.get("DGS10")
    dgs2 = aligned.get("DGS2")
    curve = aligned.get("T10Y2Y")
    sofr = aligned.get("SOFR")
    stlfsi = aligned.get("STLFSI4")
    vix = aligned.get("VIXCLS")
    spx = aligned.get("SP500")

    if hy is not None:
        out["hy_oas"] = hy
        out["hy_oas_20d_change"] = hy - hy.shift(20)
    if ig is not None:
        out["ig_oas"] = ig
    if nfci is not None:
        out["nfci"] = nfci
    if dgs10 is not None:
        out["tsy_10y"] = dgs10
    if dgs2 is not None:
        out["tsy_2y"] = dgs2
    if curve is not None:
        out["curve_10y2y"] = curve
    elif dgs10 is not None and dgs2 is not None:
        out["curve_10y2y"] = dgs10 - dgs2
    if sofr is not None:
        out["sofr"] = sofr
    if stlfsi is not None:
        out["stlfsi"] = stlfsi
    if vix is not None:
        out["vix"] = vix
    if spx is not None:
        # Equity features are defined on trading sessions. Computing them on the
        # outer-joined calendar (weekends / holidays as NaN) lets a single gap
        # poison rolling vol for 21 sessions and drops the live as-of date.
        spx_session = spx.dropna()
        log_ret = np.log(spx_session / spx_session.shift(1))
        out["spx_return_21d"] = spx_session.pct_change(21, fill_method=None).reindex(out.index)
        out["spx_realized_vol_21d"] = (log_ret.rolling(21, min_periods=21).std() * np.sqrt(252)).reindex(out.index)
        rolling_peak = spx_session.rolling(252, min_periods=21).max()
        out["spx_drawdown_252d"] = (spx_session / rolling_peak - 1.0).reindex(out.index)

    for column in FEATURE_COLUMNS:
        if column not in out.columns:
            out[column] = np.nan

    out = out[list(FEATURE_COLUMNS)]
    required_present = [column for column in REQUIRED_FEATURES if column in out.columns]
    out = out.dropna(subset=required_present, how="any")
    out.attrs["asOf"] = None if as_of is None else pd.Timestamp(as_of).strftime("%Y-%m-%d")
    out.attrs["featureSchema"] = list(FEATURE_COLUMNS)
    return out


def training_fill_values(features: pd.DataFrame) -> dict[str, float]:
    """Medians from the training window only — used to fill optional NaNs."""
    return {column: float(features[column].median()) for column in features.columns if features[column].notna().any()}


def apply_fill(features: pd.DataFrame, fill_values: dict[str, float]) -> pd.DataFrame:
    filled = features.copy()
    for column, value in fill_values.items():
        if column in filled.columns:
            filled[column] = filled[column].fillna(value)
    # Remaining optional NaNs (no training median) drop from the row if required, else 0.
    for column in filled.columns:
        if column in REQUIRED_FEATURES:
            continue
        filled[column] = filled[column].fillna(0.0)
    return filled.dropna(subset=list(REQUIRED_FEATURES))


def latest_row(features: pd.DataFrame) -> tuple[pd.Timestamp, pd.Series]:
    if features.empty:
        raise ValueError("No engineered feature rows")
    timestamp = features.index.max()
    return pd.Timestamp(timestamp), features.loc[timestamp]
