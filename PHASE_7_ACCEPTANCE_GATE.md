# Phase 7 Importance Scoring & Qualification — 74-Item Acceptance Gate

| # | Requirement | Result | Evidence |
|---:|---|:---:|---|
| 1 | One authoritative scoring contract | PASS | `shared/importanceQualification.ts` |
| 2 | Structured Phase 6 candidates only | PASS | `CandidateDetection` input |
| 3 | No LLM scoring | PASS | deterministic server evaluator |
| 4 | Deterministic model | PASS | pure factor transforms |
| 5 | Model versioned | PASS | `1.0.0` |
| 6 | Config versioned | PASS | `phase7-governance-v1` |
| 7 | Canonical state retained | PASS | `originatingStateId` |
| 8 | Candidate identity retained | PASS | `candidateId` |
| 9 | Evidence references retained | PASS | `evidenceClaimIds` |
| 10 | Magnitude distinct | PASS | factor trace |
| 11 | Acceleration distinct | PASS | factor trace |
| 12 | Persistence distinct | PASS | factor trace |
| 13 | Historical lead distinct | PASS | explicit unavailable factor |
| 14 | Cross-engine support distinct | PASS | factor trace |
| 15 | Systemic importance distinct | PASS | taxonomy |
| 16 | Novelty distinct | PASS | observation-count transform |
| 17 | Data confidence distinct | PASS | factor trace |
| 18 | Missing factors explicit | PASS | availability states |
| 19 | Unavailable history not zero history | PASS | null contribution |
| 20 | Degraded data constrains qualification | PASS | 69 ceiling |
| 21 | Evidence independence respected | PASS | Phase 6 candidate gate |
| 22 | Systemic taxonomy centralized | PASS | scorer function |
| 23 | Novelty deterministic | PASS | scorer function |
| 24 | Repetition reduces novelty | PASS | test |
| 25 | Importance differs from probability | PASS | score semantics |
| 26 | Score 82 never becomes 82% | PASS | test |
| 27 | Qualification separate from scoring | PASS | separate functions |
| 28 | Thresholds centralized | PASS | config |
| 29 | Thresholds versioned | PASS | config version |
| 30 | Integrity gate blocks high score | PASS | conflict test |
| 31 | Rank-first cannot override threshold | PASS | threshold gate |
| 32 | Zero qualified allowed | PASS | evaluation |
| 33 | No-material state supported | PASS | `noMaterialEarlyWarning` |
| 34 | No quota filling | PASS | cap-not-quota selection |
| 35 | One primary maximum | PASS | selection slice |
| 36 | Two secondary maximum | PASS | config cap |
| 37 | Ties deterministic | PASS | tie test |
| 38 | Duplicates governed | PASS | family dedup |
| 39 | Candidate separate from evaluation | PASS | append-only ledger |
| 40 | Original candidate immutable | PASS | no update path |
| 41 | Reevaluations append-only | PASS | unique evaluation ID |
| 42 | State mixing prevented | PASS | provenance proof |
| 43 | Unsupported probabilities absent | PASS | contract |
| 44 | Unsupported targets absent | PASS | contract |
| 45 | Unsupported timing absent | PASS | contract |
| 46 | No forecast authority | PASS | contract |
| 47 | Historical frequency remains historical | PASS | Phase 3 preserved |
| 48 | Analog similarity remains similarity | PASS | Phase 3 preserved |
| 49 | Historical lead non-predictive | PASS | unavailable/no forecast |
| 50 | No lifecycle | PASS | leak audit |
| 51 | No confirmation/invalidation | PASS | leak audit |
| 52 | No public warning UI | PASS | boundary test |
| 53 | No public warning API | PASS | boundary test |
| 54 | No ASHA/Oracle warning presentation | PASS | boundary test |
| 55 | No social warning generation | PASS | leak audit |
| 56 | No track-record resolution | PASS | leak audit |
| 57 | Phase 2 preserved | PASS | canonical ID retained |
| 58 | Phase 3 preserved | PASS | evidence IDs retained |
| 59 | Phase 4 preserved | PASS | no assistant integration |
| 60 | Phase 5 preserved | PASS | synthesis provenance retained |
| 61 | Phase 6 preserved | PASS | candidate input only |
| 62 | Champion V1 unchanged | PASS | no engine edit |
| 63 | V3-H shadow-only | PASS | no promotion |
| 64 | Owner/debug provenance available | PASS | admin procedure |
| 65 | Compute-once compatible | PASS | scheduler integration |
| 66 | Adversarial tests pass | PASS | 15 scoring cases |
| 67 | Sanity tests pass | PASS | monotonicity test |
| 68 | Extreme-value tests pass | PASS | NaN/Infinity test |
| 69 | Full regression clean | PASS | 151 files passed, 1 skipped; 1,820 tests passed, 22 skipped, 0 failed |
| 70 | Critical defects zero | PASS | no known critical |
| 71 | Material false-qualification high defects zero | PASS | gated tests |
| 72 | Blocking Phase 8 leaks zero | PASS | leak audit |
| 73 | Output machine-readable for Phase 8 | PASS | shared evaluation contract |
| 74 | Phase 8 eligibility evaluation recorded | PASS | final closure report |

**Gate result: PASS.** Final full regression: **151 files passed, 1 skipped; 1,820 tests passed, 22 skipped, 0 failed.**
