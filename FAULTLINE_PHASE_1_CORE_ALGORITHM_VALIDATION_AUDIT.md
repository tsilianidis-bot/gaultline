# FAULTLINE Phase 1 — Core Algorithm Validation & Intelligence Audit

**Audit baseline:** `f430a9ab` (protected), plus the current audit-only artifacts.  
**Scope:** Phase 1 validation and governance only.  
**Production changes:** One narrow public-claim containment on the Market Crash Probability page. No Champion formula, threshold, live runtime score, legacy record, historical research score, V3-H status, or Phase 2 feature was changed.

## Executive Determination

> **Phase 1 determination: NOT READY FOR PHASE 2 — Early Warning Intelligence.**

The frozen Champion V1 core is reproducible as a current six-vector stress composite and the separate research program has strong provenance controls. However, the current intelligence stack does not yet support calibrated probability claims, historical early-warning claims, or component-level early-warning detection. The historical evidence remains **INCONCLUSIVE**. The rebuilt 2000–2026 retrospective series offers useful risk discrimination in its 45–64 bucket, but it warned before only 10 of 26 registered drawdown events, did not reach High Stress or Systemic Crisis, and uses revised/proxy data that cannot establish real-time historical knowledge.

The immediate Phase 1 objective was auditing, not optimizing. The audited evidence therefore identifies repair requirements but does not recommend a new weight, threshold, formula, regime map, probability, or V3-H promotion.

## Phase 1 Intelligence Fitness Scorecard

This is a governance readiness scorecard, not a market forecast, calibration result, or performance statistic. Each domain is scored from zero to five based only on the evidence recorded in this audit.

| Domain | Score / 5 | Evidence-bound assessment |
|---|---:|---|
| Frozen Champion arithmetic and regimes | 4 | Six-vector formula, weights, transforms, rounding, and thresholds are recoverable and frozen |
| Source provenance / point-in-time readiness | 2 | Strong separate registries, but key historical credit history has no accepted vintage and Tier A remains limited |
| Missing-data / staleness semantics | 2 | Research ledgers properly exclude inputs; live partial-source behavior can still be presented too broadly as live |
| Input independence / exposure design | 1 | HY credit spread and 10Y yield recur across most aggregate weight |
| Legacy historical reconciliation | 1 | Legacy 317-row formula remains unrecovered and cannot validate current V1 |
| Retrospective risk discrimination | 3 | 45–64 bucket has worse subsequent S&P 500 outcomes; sample and overlap limitations remain |
| Historical early-warning performance | 1 | 10 of 26 registered drawdown events met the locked composite condition; no real-time claim is supportable |
| Trend, pattern, and persistence evidence | 1 | Rules exist; long forward-only daily record and registered outcome evidence do not yet exist |
| Probability / analog calibration | 0 | Multiple percentages and fixed analog outcomes lack shared event definitions, horizons, calibration, and out-of-sample evidence |
| Current-state synchronization / versioning | 2 | Latest score/regime aligned in sampled records, but the stack executes multiple Pressure calls and lacks a unified derived-output manifest |
| Public-claim integrity | 2 | Critical crash-probability page conflict was contained; broader probability and “historically precedes” inventory remains |
| **Total readiness** | **19 / 55 (35 / 100)** | **Blocked from Phase 2** |

## Architecture and Core Findings

The current system comprises a frozen Champion V1 core, a separate FMOS derived pipeline, operational Seismograph state, packet-based synthesis, Unified Seismograph historical synthesis, and Canonical MarketState consumer transformation. “Five domains / ten engines” is not an executable single model contract: the repository has incompatible layer vocabularies and output semantics. Any future design must identify the exact layer that owns a score, regime, trend, probability, analog, and consumer-facing statement.

Champion V1 is a weighted six-vector stress composite: Liquidity 20%, Credit 20%, Volatility 15%, Macro 20%, Breadth 10%, and AI/Speculation 15%. It is **not** a seven-vector VIX model, calibrated crash probability, or ten-engine composite. The production V1 pressure engine is deterministic under a fixed input packet, but current live state can invoke it more than once inside the scheduled pipeline, creating a same-run divergence boundary between direct and FMOS-preferred readings.

## Input, Data Quality, and Mathematics

The live run sampled during Phase 1 was `27 / MODERATE RISK` with all eight FRED series available. Macro and Breadth were labeled delayed because their inputs have a monthly publication lag, while the AI/Speculation vector was correctly labeled static. The critical issue is partial data: if any FRED series is available, global source state may be `live` while individual missing inputs are replaced by runtime fallback constants. This is unacceptable for a research or intelligence-provenance claim until a per-input availability contract governs the aggregate label.

Input overlap is material. HY credit spread contributes to Liquidity, Credit, and AI/Speculation (55% aggregate weight); the 10Y yield contributes to Credit, Volatility, Breadth, and AI/Speculation (60%). Retrospective vector correlations are consistent with this: Liquidity–Credit is 0.866, Volatility–Macro 0.712, Credit–Breadth 0.683, and Liquidity–AI 0.669. No Phase 1 evidence authorizes a weight change. The correct conclusion is that any early-warning work must explicitly test incremental contribution after controlling for shared exposure.

## History Reconciliation and Leakage Control

Four data tiers remain separate: immutable legacy `pressureHistory`, 36-score verified research history, 318-score reconstructed research history with an explicit 2018-03 gap, and forward-only operational observations. The legacy batch is `HISTORICAL_BATCH_UNVERSIONED_UNRECONCILED`; current V1 exactly matches 14 of 317 legacy rows and no original generator or documented crisis amplifier was recovered. It cannot be used as current-formula validation or calibration target.

The reconstructed series uses the exact frozen V1 formula but revised historical inputs, an archived exact high-yield-spread capture, and a disclosed pre-SOFR official proxy. It has careful no-fallback, no-interpolation, release-lag, append-only outcome, and outcome-separation controls. It is nevertheless retrospective research only. No result can be restated as historical live FAULTLINE detection or warning.

## Event, Outcome, and Lead Findings

The locked reconstructed research registered 26 equity drawdowns of at least 10% within 60 trading days. The frozen composite reached `≥45` in the two-calendar-month pre-event window for 10 events and missed 16; its observed diagnostic rate is 38.46%. It had three `≥45` months with no registered event in the next exact 60 trading days. The 45–64 bucket contains 23 scores and experienced mean 20-day return of −2.74%, mean 60-day return of −7.63%, and mean 60-day maximum drawdown of −15.72%, materially worse than the two lower buckets.

Component deterioration occurs before some composite misses, especially Liquidity (six missed events with a component peak at or above 45) and Credit (five). This is post-baseline exploratory evidence only. It does not establish predictive usefulness, lead-time reliability, causal contribution, a threshold, a confirmation condition, or a deployable warning candidate. The claim that Macro Sensitivity leads risk by four to eight weeks is **NOT SUBSTANTIATED**: monthly retrospective data with revised/proxy inputs cannot validate exact real-time weekly lead time.

## Probability, Analog, and Pattern Findings

FMOS, Unified Seismograph, Seismograph packet synthesis, and daily state transitions each construct percentages differently. None has a single registered event definition, horizon, sample-selection rule, calibration curve, out-of-sample assessment, or versioned forecast contract. They must be referred to as **derived scenario scores** or **evidence composition**, never measured probabilities or calibrated likelihoods.

The analog layers also use incompatible similarity calculations. Some daily pattern / analog payloads carry fixed historical outcomes rather than results queried from immutable outcome records. That is a critical integrity issue. Similarity may remain visible as a retrospective feature comparison, but its outcome and forecast implications must be contained until a sourced research ledger exists.

## Claim and Current-State Audit

The Market Crash Probability public page materially overstated the system as a continuous seven-vector, VIX-driven calibrated crash probability and as historical FAULTLINE warning evidence. This critical conflict was contained with a narrow copy correction and a regression test. The page now describes the actual six-vector systemic-pressure context, static/delayed limitations, and historical-data boundaries.

The broader claim inventory remains open. Probability language, static pattern outcomes, analog nomenclature, and several “historically precedes” statements in crypto, rotation, cross-market, and SEO surfaces require a source-by-source audit or containment before Phase 2. The direct sample of latest V1 and daily Seismograph rows was consistent at 27 / Moderate, but neither a full canonical-payload replay nor a unified model-version manifest exists.

## Severity-Ranked Repair Queue

| Priority | Issue | Classification | Required action before Phase 2 |
|---|---|---|---|
| 1 | Percentages displayed as probabilities without forecast contract | CRITICAL | Establish event, horizon, data tier, calibration, out-of-sample, version, and disclosure contract—or contain as scenario score |
| 2 | Fixed Seismograph pattern / analog outcomes | CRITICAL | Replace with immutable sourced outcomes or remove outcome-rate language |
| 3 | Partial live-source reading can use fallback input under live label | HIGH | Per-input availability manifest, aggregate quality state, and consumer-safe disclosure |
| 4 | Multiple overlapping core inputs | HIGH | Require incremental-value and redundancy tests before any early-warning component use |
| 5 | Legacy history unreconciled to V1 | HIGH | Preserve labeling; prohibit calibration or performance claim until original artifact is recovered |
| 6 | Multiple non-equivalent analog systems | HIGH | Namespace model/version/provenance and standardize retrospective disclaimer |
| 7 | Trend / persistence / acceleration rules unvalidated | HIGH | Build forward verified observation and outcome record before early-warning use |
| 8 | Broader public predictive language | HIGH | Finish claim inventory and contain unsupported assertions |
| 9 | Incomplete derived-stack version manifest | HIGH | Link core formula, derived logic, analog, probability, pattern, canonical-state, and input versions |

## Phase 2 Readiness Gate

**Phase 2 must not begin** until every condition below is met and the owner explicitly approves the next protocol:

1. Every displayed probability / transition value is either contained as a derived scenario score or governed by a written event-horizon-calibration contract.
2. Every pattern and analog outcome is traceable to immutable, source-backed observations; fixed historical outcome statements are removed or clearly contained.
3. Live partial-data behavior has a per-input quality manifest and does not label fallback-contaminated output as wholly live.
4. A unified current-state manifest records model versions, input availability, source timestamps, selected core score, and downstream derived-output versions for one atomic run.
5. The public claim inventory has been completed for probability, warning, historical, and “historically precedes” language.
6. Phase 2 has a separately pre-registered design, development/validation/holdout partitions, candidate-generation rule, confirmation rule, false-alarm and missed-event definitions, and no-tuning governance.
7. V3-H remains shadow-only and excluded from promotion or challenger comparison until the Champion evidence gate is satisfied.

## Phase 1 Deliverables

| Deliverable | Location |
|---|---|
| Protected baseline | `PHASE_1_AUDIT_BASELINE.md` |
| Architecture map | `PHASE_1_ALGORITHM_ARCHITECTURE_MAP.md` |
| Input and math audit | `PHASE_1_INPUT_AND_MATH_AUDIT.md` |
| Historical reconciliation | `PHASE_1_HISTORICAL_RECONCILIATION.md` |
| Derived logic audit | `PHASE_1_DERIVED_LOGIC_AUDIT.md` |
| Historical evidence analysis | `PHASE_1_HISTORICAL_EVIDENCE_ANALYSIS.md` |
| Current-state and claim audit | `PHASE_1_CURRENT_STATE_AND_CLAIM_AUDIT.md` |
| Read-only early-warning diagnostic | `PHASE_1_EARLY_WARNING_DIAGNOSTICS.json` |
| Evidence log | `PHASE_1_AUDIT_EVIDENCE_LOG.md` |

## References

[1] [FRED: ICE BofA US High Yield Index Option-Adjusted Spread](https://fred.stlouisfed.org/series/BAMLH0A0HYM2)  
[2] [Internet Archive: Exact FRED CSV capture index for BAMLH0A0HYM2](https://web.archive.org/cdx/search/cdx?url=fred.stlouisfed.org%2Fgraph%2Ffredgraph.csv%3Fid%3DBAMLH0A0HYM2&output=json&filter=statuscode:200&collapse=digest&fl=timestamp,original,statuscode,mimetype,digest,length)  
[3] [Federal Reserve: Historical Proxies for SOFR](https://www.federalreserve.gov/econres/notes/feds-notes/historical-proxies-for-the-secured-overnight-financing-rate-20190715.html)  
[4] [Federal Reserve Bank of New York: Historical Repo Survey Rate](https://www.newyorkfed.org/markets/opolicy/operating_policy_180309)
