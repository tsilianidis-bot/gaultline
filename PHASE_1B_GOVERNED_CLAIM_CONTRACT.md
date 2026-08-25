# Phase 1B Governed Claim Contract

## Purpose

This contract prevents FAULTLINE from treating distinct numerical concepts as interchangeable. It governs claims without recalibrating, optimizing, or suppressing the underlying Champion V1 calculation.

## Required Record

Every governed numerical claim is recorded with `claim_id`, `claim_type`, `event_definition`, `time_horizon`, `value`, `unit`, `source_model`, `model_version`, `methodology`, `sample_size`, `dataset_span`, `confidence`, `generated_at`, `evidence_status`, and `display_status`.

## Claim-Type Semantics

| Claim type | Meaning | Predictive presentation rule |
|---|---|---|
| `MODEL_PROBABILITY` | A probability of a defined event in a defined horizon, produced by a documented calibrated model | Permitted only if event, horizon, methodology, data tier, calibration, and version are all present |
| `HISTORICAL_FREQUENCY` | Observed proportion under a stated historical sample and horizon | Must name the sample and period; may not be called forecast probability |
| `ANALOG_SIMILARITY` | Feature-set distance / similarity to a stated historical period and model | May not imply recurrence, outcome probability, forecast confidence, or prediction accuracy |
| `EVIDENCE_CONFIDENCE` | Confidence in evidence completeness or agreement | May not be treated as market likelihood |
| `DERIVED_SCENARIO_SCORE` | Current internal bull / neutral / bear composition | No predictive presentation until a calibrated contract exists |
| `DERIVED_SCENARIO_COMPONENT` | Current transition component | No predictive presentation; may not be represented as a complete probability distribution |
| `UNSUPPORTED` | Value has no adequate immutable outcome / methodology contract | Internal or suppressed only |

## Current Family Disposition

| Family | Current status | Display status |
|---|---|---|
| Seismograph bull / neutral / bear values | `UNVERIFIED` derived scenario score | `SUPPRESS_PREDICTIVE_PRESENTATION` |
| Seismograph transition components | `UNVERIFIED` derived scenario component | `SUPPRESS_PREDICTIVE_PRESENTATION` |
| Seismograph analog similarity | `UNVERIFIED` feature-set similarity | `DISPLAY_WITH_QUALIFICATION` |
| Seismograph pattern confidence / historical outcome | `UNSUPPORTED` pending immutable, source-backed resolution | `SUPPRESS_PREDICTIVE_PRESENTATION` |
| Reconstructed Champion 45–64 outcome result | `RESEARCH_ONLY` risk discrimination | Must say “associated with worse subsequent outcomes in reconstructed research”; never “predicted” or “warned” |

## Guardrail

> A missing event definition, horizon, calibration method, sample, or version does not get filled with a plausible assumption. The claim is instead suppressed, qualified, or marked unsupported.

## Model and Dataset Identifiers

| Identifier | Status |
|---|---|
| `champion-v1-frozen` | Current live core calculation; unchanged |
| `v3-h-shadow-only` | Shadow-only; not evaluated or promoted in Phase 1B |
| `legacy-317-unreconciled` | Immutable legacy historical set; not a V1 validation target |
| `reconstructed-champion-v1-2000-2026-research-only` | Separate retrospective research history; revised/proxy inputs and explicit 2018-03 gap |
| `phase1b-governance-v1` | Governance-contract and atomic-state configuration |
