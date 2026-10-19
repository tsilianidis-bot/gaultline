# Pre-registration — v2 shadow forward record (FL-PI-v2-research-0)

Written 2026-10-13 before any forward v2 observation exists. Spec unchanged (sha256 3ce5661e…0b82).

* **Record class:** FORWARD_LIVE only (table `pressureV2ShadowObservations`). Starts on the first scheduled run after migration 0073 is applied (founder approval). Earlier history is HISTORICAL_BACKTEST and is reported separately.
* **Observation grid:** Fridays (onSpecGrid = true), first SCHEDULED_CRON row per date. All rows, including `unavailable`, are retained.
* **Events (locked):** S&P 500 closing peak→trough decline ≥10% within 60 sessions; earliest start; advance past trough.
* **Signals & thresholds (locked):** v2 ≥ 45; VIX ≥ 25; EW-z ≥ 1.0; S&P drawdown (continuous; AUC only — no threshold was pre-specified, none is invented).
* **Metrics:** warnings in the 8 weeks to event start, missed events, detection lag after start, false alarms (first crossings with no event start within 60 sessions and not inside an event), rank AUC for 63-session ≥10% max drawdown, outcomes by band, performance split by VIX < 25 / ≥ 25. Calibration: outcome frequencies by band are descriptive only; no probability will be published until a calibration study is separately pre-registered.
* **Comparison:** v2 vs VIX, S&P drawdown, EW-z composite on identical dates.
* **Minimum evidence before any promotion request:** ≥ 2 years of forward Fridays **and** ≥ 3 forward events; otherwise report INCONCLUSIVE.
* **Prohibited:** changing weights, thresholds, transforms, pillars or event definitions under this spec id; deleting or editing rows; mixing backtest and forward results.
