# FAULTLINE Champion Redesign Program

## Purpose

This program defines a path to improve FAULTLINE only through **reproducible, point-in-time, out-of-sample evidence**. It does not authorize a live Pressure Index redesign today. The current Champion remains the production baseline until a candidate passes every promotion gate.

## Research Architecture

```text
Point-in-time raw data
        ↓
Normalization and source-quality checks
        ↓
Indicator level, direction, velocity, acceleration, persistence, and percentile features
        ↓
Independent economic risk clusters
        ↓
Regime and breadth confirmation research
        ↓
Pre-registered interaction and smoothing candidates
        ↓
Pressure research score / separate calibrated event models / confidence research
        ↓
Explanation and promotion-gate review
```

## Non-Negotiable Research Controls

| Control | Requirement |
|---|---|
| Champion baseline | Current production Champion stays immutable until candidate promotion. |
| Source availability | Historical macro data must use release-available vintages where available; limitations are explicit where unavailable. |
| Independent clusters | A shared indicator is not counted in multiple selected clusters without residualization or a documented orthogonalization test. |
| Probability separation | A Pressure score is never displayed or evaluated as an event probability. |
| Outcome definition | Drawdown, recession, credit, volatility, and regime outcomes are separately pre-registered. |
| Model complexity | Every threshold, interaction, feature, and weight must improve locked out-of-sample results or be removed. |
| Explainability | Every candidate output must retain signed drivers, data quality, confidence limits, and transition rationale. |

## Current Status

The system now records forward-only daily Champion formula/input provenance and append-only outcome records, but release/vintage availability is still not captured from an ALFRED ingestion pipeline. Current history cannot yet support the redesigned cluster, regime, probability, or calibration claims. The research contract therefore leaves all cluster weights, interactions, probability models, and confidence coefficients unassigned.

## Current Evaluation Decision

The current redesign readiness result is **BLOCKED**. Champion reproducibility, point-in-time vintage availability, independent outcome history, locked walk-forward samples, calibration samples, ablation samples, and stability samples are not yet complete. Three interactions have been pre-registered for later offline testing—credit/liquidity, treasury/growth, and market-internals/volatility—but none is currently estimated, weighted, or deployed.

## Promotion Gate

No candidate becomes a production score unless it passes Champion reproducibility, point-in-time data integrity, pre-registered outcomes, locked walk-forward testing, calibration, ablation, stability, and explainability gates. A candidate that performs similarly to Champion must be rejected in favor of the simpler existing system.
