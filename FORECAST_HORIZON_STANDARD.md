# FAULTLINE Forecast Horizon Standard

## Purpose

The Forecast Horizon Standard separates **current evidence** from any statement about a future outcome. It applies to targets, expected magnitude, directional scenarios, probabilities, analogs, catalysts, confirmation, invalidation, expiration, and timing across FAULTLINE.

> A product surface must never display an implied or invented time horizon. When the relevant forecast contract does not support timing, it must state **“Not yet established”** or **“Insufficient evidence for reliable estimate.”**

## Required Metadata

| Field | Rule |
|---|---|
| `evidenceClass` | One of Observed, Derived, Historical, Interpreted, or Forecast |
| `expectedHorizonStatus` | Supported, Not Established, or Insufficient Evidence |
| `expectedHorizon` | Required only for Supported horizons |
| `horizonMinDays` / `horizonMaxDays` | Required only for Supported horizons |
| `horizonMethodology` | Required only for Supported horizons |
| `targetValue` / `expectedMagnitude` | Optional and must be source-backed; no placeholder estimate |
| `targetConfidence` / `timingConfidence` | Optional and must not be shown as calibrated without validation evidence |
| `confirmationConditions` / `invalidationConditions` | Display only when supplied by the underlying record |
| `forecastGeneratedAt` / `forecastExpiresAt` | Required generation timestamp; expiry required if the forecast has a bounded lifecycle |

The authoritative TypeScript contract is `shared/forecastMetadata.ts`.

## Horizon Taxonomy

| Bucket | Meaning | Availability rule |
|---|---|---|
| Immediate | Same-session to several trading days | Only with an evidence-backed rule and trading-day basis |
| Short Term | Days to weeks | Only with a documented outcome horizon |
| Swing | Weeks to several months | Only with a documented outcome horizon |
| Intermediate | Multiple months | Only with a documented outcome horizon |
| Long Term | Many months to years | Only with a documented outcome horizon |
| Structural | Multi-year regime or structural change | Must be labeled structural, not a trade forecast |
| Not Established | No defensible timing contract | Default for current FAULTLINE derived and interpreted outputs |

## Persistence and Resolution

`forecastObservations` is append-only and stores the original metadata, source/model version, source key, generation time, and immutable payload. `forecastResolutions` is append-only and stores later Pending, Target Reached, Invalidated, Expired, or Unavailable resolution records. A resolution has a restrictive foreign key and cannot overwrite the original observation.

Primary Outlook, Quick Outlook, and Daily Story now create non-blocking original observations with **Insufficient Evidence** status. This begins a genuine record of what the system displayed without misrepresenting an interpretation as a validated forecast. Resolution is intentionally not manufactured for records with no supported horizon.

## Current Coverage

| Surface | Standard behavior |
|---|---|
| Outlook and Quick Outlook | Returns `forecastMetadata`; logs append-only original observation; analysis timeframe remains a user-selected analysis window, not a forecast horizon |
| Daily Story | Removes requested target timing and expected reward; returns and records insufficient-evidence metadata |
| Opportunity Discovery | Replaces unvalidated display timeframes with a visible Not Yet Established disclosure |
| ASHA | System prompt blocks invented timing, target dates, and unsupported confidence |
| Oracle Briefing | Removes the fabricated 2–4 week default and displays shared forecast metadata |
| Market Context Strip | Reframes highest numerical scenario as Derived Scenario and discloses no established horizon |
| Probability / analog surfaces | Retain Phase 1B governed-claim qualification; not promoted to forecast contracts |

## Calibration Rule

A forecast is not eligible to show a Supported horizon, target confidence, timing confidence, or predictive probability until it has a versioned method, event definition, dataset tier, sample selection, source provenance, pre-registered horizon, out-of-sample evidence, and calibration evidence. This rule preserves the current Phase 1 and Phase 1B conclusion: Champion historical evidence is **INCONCLUSIVE**, and Phase 2 remains blocked.

## Prohibited Behavior

The system must not infer timing from a user-selected dashboard timeframe, an LLM response, an analog similarity, a derived scenario percentage, a static target string, or a retrospective historical record. It must not use a default such as “2–4 weeks,” “soon,” or “most likely” to imply a forecast contract.
