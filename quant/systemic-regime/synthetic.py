"""Deterministic synthetic FRED-like panel for tests and offline validation.

Planted stress windows match historical_regimes.MAJOR_STRESS_PERIODS so
OOS metrics are meaningful without network FRED access.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from historical_regimes import MAJOR_STRESS_PERIODS


def _stress_intensity(index: pd.DatetimeIndex) -> np.ndarray:
    intensity = np.zeros(len(index))
    for period in MAJOR_STRESS_PERIODS:
        start, end = pd.Timestamp(period.start), pd.Timestamp(period.end)
        inside = (index >= start) & (index <= end)
        if not inside.any():
            continue
        pos = np.linspace(0, np.pi, int(inside.sum()))
        wave = np.sin(pos) ** 1.2
        scale = {"critical": 1.0, "high": 0.72, "moderate": 0.48}.get(period.severity, 0.5)
        intensity[inside] = np.maximum(intensity[inside], wave * scale)
        # lead-in ramp so a STRESS BUILDING state can exist
        lead = (index >= start - pd.Timedelta(days=90)) & (index < start)
        if lead.any():
            ramp = np.linspace(0, 0.35 * scale, int(lead.sum()))
            intensity[lead] = np.maximum(intensity[lead], ramp)
    return intensity


def generate_synthetic_panel(start: str = "2005-01-03", end: str = "2024-12-31", seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    index = pd.bdate_range(start, end)
    n = len(index)
    t = np.arange(n)
    stress = _stress_intensity(index)
    noise = rng.normal(0, 1, n)

    hy = 4.2 + 8.5 * stress + 0.35 * noise + 0.4 * np.sin(t / 260)
    ig = 1.1 + 3.2 * stress + 0.12 * noise
    nfci = -0.4 + 1.8 * stress + 0.08 * noise
    dgs10 = 3.2 + 0.9 * np.sin(t / 400) + 0.6 * stress
    dgs2 = 2.4 + 1.1 * np.sin(t / 380) + 0.8 * stress
    curve = dgs10 - dgs2
    sofr = np.clip(dgs2 - 0.3 + 0.15 * noise, 0.01, None)
    stlfsi = -0.5 + 2.2 * stress + 0.1 * noise
    vix = 14 + 32 * stress + 1.5 * np.abs(noise)
    log_ret = rng.normal(0.00025, 0.009, n) - 0.045 * stress + 0.01 * stress * noise
    spx = 1200 * np.exp(np.cumsum(log_ret))

    # Weekly-ish missingness for NFCI / STLFSI
    nfci_series = pd.Series(nfci, index=index)
    nfci_series.iloc[np.arange(n) % 5 != 0] = np.nan
    stlfsi_series = pd.Series(stlfsi, index=index)
    stlfsi_series.iloc[np.arange(n) % 5 != 0] = np.nan

    return pd.DataFrame(
        {
            "BAMLH0A0HYM2": hy,
            "BAMLC0A0CM": ig,
            "NFCI": nfci_series.to_numpy(),
            "DGS10": dgs10,
            "DGS2": dgs2,
            "T10Y2Y": curve,
            "SOFR": sofr,
            "STLFSI4": stlfsi_series.to_numpy(),
            "VIXCLS": vix,
            "SP500": spx,
        },
        index=index,
    )


def write_fixture_csv(path: str | Path, **kwargs) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    panel = generate_synthetic_panel(**kwargs)
    out = panel.reset_index().rename(columns={"index": "date"})
    out.to_csv(path, index=False)
    return path
