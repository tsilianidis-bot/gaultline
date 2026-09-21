"""FRED ingestion for the Systemic Regime Engine.

Reuses the same FRED provider and series IDs as FAULTLINE Node
(`server/fredClient.ts`). Does not introduce a new vendor.

Sources, in order:
1. Node-exported JSON panel (`--from-json` / FAULTLINE fredClient dump)
2. Direct FRED API with FRED_API_KEY (same env slot as Node)
3. Local fixture CSV for tests / offline validation
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import pandas as pd

from config import FRED_HISTORY_LIMIT, FRED_OBSERVATIONS_ENDPOINT, FRED_SERIES, FredSeriesSpec


def series_by_id() -> dict[str, FredSeriesSpec]:
    return {spec.series_id: spec for spec in FRED_SERIES}


def load_panel_from_json(path: str | Path) -> pd.DataFrame:
    """Load a Node-exported or fixture JSON panel.

    Expected shape: { "series": { "BAMLH0A0HYM2": [{"date": "YYYY-MM-DD", "value": "3.21"}, ...] } }
    """
    payload = json.loads(Path(path).read_text())
    series_map = payload.get("series") or payload.get("results") or payload
    frames: list[pd.DataFrame] = []
    for series_id, raw in series_map.items():
        observations = raw.get("observations", raw) if isinstance(raw, dict) else raw
        if not observations:
            continue
        frame = pd.DataFrame(observations)
        if "date" not in frame.columns or "value" not in frame.columns:
            continue
        frame = frame[["date", "value"]].copy()
        frame["date"] = pd.to_datetime(frame["date"], utc=False)
        frame["value"] = pd.to_numeric(frame["value"].replace(".", pd.NA), errors="coerce")
        frame = frame.rename(columns={"value": series_id}).dropna(subset=[series_id])
        frames.append(frame.set_index("date").sort_index())
    if not frames:
        raise ValueError(f"No usable FRED observations in {path}")
    return _join_frames(frames)


def load_panel_from_csv(path: str | Path) -> pd.DataFrame:
    frame = pd.read_csv(path, parse_dates=["date"])
    if "date" not in frame.columns:
        raise ValueError("CSV panel must include a date column")
    return frame.set_index("date").sort_index()


def fetch_fred_series(series_id: str, api_key: str, limit: int = FRED_HISTORY_LIMIT) -> pd.DataFrame:
    query = urllib.parse.urlencode(
        {
            "series_id": series_id,
            "api_key": api_key,
            "file_type": "json",
            "sort_order": "desc",
            "limit": str(limit),
        }
    )
    url = f"{FRED_OBSERVATIONS_ENDPOINT}?{query}"
    with urllib.request.urlopen(url, timeout=30) as response:
        body = json.loads(response.read().decode("utf-8"))
    observations = body.get("observations") or []
    if not observations:
        return pd.DataFrame(columns=["date", series_id])
    frame = pd.DataFrame(observations)[["date", "value"]]
    frame["date"] = pd.to_datetime(frame["date"])
    frame[series_id] = pd.to_numeric(frame["value"].replace(".", pd.NA), errors="coerce")
    return frame.drop(columns=["value"]).dropna(subset=[series_id]).set_index("date").sort_index()


def fetch_fred_panel(api_key: str | None = None, series_ids: list[str] | None = None) -> pd.DataFrame:
    key = api_key if api_key is not None else os.environ.get("FRED_API_KEY", "")
    if not key:
        raise RuntimeError("FRED_API_KEY is not set; export a Node dump or use a fixture panel")
    ids = series_ids or [spec.series_id for spec in FRED_SERIES]
    frames = []
    errors: dict[str, str] = {}
    for series_id in ids:
        try:
            frames.append(fetch_fred_series(series_id, key))
        except Exception as exc:  # noqa: BLE001 — keep remaining series
            errors[series_id] = str(exc)
    if not frames:
        raise RuntimeError(f"FRED fetch failed for all series: {errors}")
    panel = _join_frames(frames)
    panel.attrs["fred_errors"] = errors
    return panel


def load_panel(
    *,
    from_json: str | Path | None = None,
    from_csv: str | Path | None = None,
    use_fred: bool = False,
) -> pd.DataFrame:
    if from_json:
        return load_panel_from_json(from_json)
    if from_csv:
        return load_panel_from_csv(from_csv)
    if use_fred or os.environ.get("FRED_API_KEY"):
        return fetch_fred_panel()
    raise RuntimeError("No panel source: pass --from-json, --from-csv, or set FRED_API_KEY")


def panel_freshness(panel: pd.DataFrame, as_of: pd.Timestamp | None = None) -> dict[str, Any]:
    if panel.empty:
        return {"dataAsOf": None, "freshnessStatus": "UNAVAILABLE", "seriesAsOf": {}}
    as_of = as_of or pd.Timestamp.utcnow().normalize()
    if as_of.tzinfo is not None:
        as_of = as_of.tz_convert(None).normalize()
    series_as_of = {}
    for column in panel.columns:
        last = panel[column].last_valid_index()
        series_as_of[column] = None if last is None else pd.Timestamp(last).strftime("%Y-%m-%d")
    data_as_of = panel.dropna(how="all").index.max()
    age_days = (as_of.normalize() - pd.Timestamp(data_as_of).normalize()).days
    if age_days <= 3:
        status = "CURRENT"
    elif age_days <= 10:
        status = "DELAYED"
    else:
        status = "STALE"
    return {
        "dataAsOf": pd.Timestamp(data_as_of).strftime("%Y-%m-%d"),
        "freshnessStatus": status,
        "ageCalendarDays": int(age_days),
        "seriesAsOf": series_as_of,
    }


def _join_frames(frames: list[pd.DataFrame]) -> pd.DataFrame:
    panel = frames[0]
    for frame in frames[1:]:
        panel = panel.join(frame, how="outer")
    panel = panel.sort_index()
    panel.index.name = "date"
    return panel
