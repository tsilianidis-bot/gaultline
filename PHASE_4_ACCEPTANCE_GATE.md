# Phase 4 — ASHA / Oracle Intelligence Repair Acceptance Gate

**Status:** **55 / 55 PASS**. This gate is bound to the permanent Phase 4 contract, tests, and artifacts. Phase 5 and Early Warning work are not implemented by this gate.

| # | Acceptance question | Result | Evidence and implementation reference |
|---:|---|---|---|
| 1 | Do ASHA and Oracle consume canonical state for current intelligence? | **PASS** | `server/ashaEngine.ts`, `server/routers/smartDiscovery.ts` build one packet from `getAuthoritativeCanonicalIntelligenceState()`. |
| 2 | Do current responses retain originating stateId? | **PASS** | `InterpretationTransaction.originatingStateId`; ASHA/Oracle `integrity` metadata; conversation audit fields. |
| 3 | Do ASHA and Oracle consume structured evidence packets where applicable? | **PASS** | `server/evidencePacket.ts`, `shared/interpretationIntegrity.ts`; `server/phase4AshaOracleIntegration.test.ts`. |
| 4 | Can ASHA no longer invent observations? | **PASS** | Pre-generation allowed-claim list and post-generation validator; `server/interpretationIntegrity.test.ts`. |
| 5 | Can Oracle no longer invent observations? | **PASS** | Active Oracle prompt uses only `buildInterpretationPromptContract()` and validator. |
| 6 | Can ASHA no longer invent model probabilities? | **PASS** | Unauthorized numeric forecast fields are nulled; `server/phase4Adversarial.test.ts`. |
| 7 | Can Oracle no longer invent model probabilities? | **PASS** | Same shared `NO_FORECAST_FIELDS` validator. |
| 8 | Does every probability retain defined semantics? | **PASS** | `shared/evidenceContract.ts` defines `ProbabilityType`; prompt/output audits. |
| 9 | Does a model probability require an event? | **PASS** | `ForecastAuthorization.eventDefinition` required by `validateEvidenceClaim()`. |
| 10 | Does a model probability require a horizon? | **PASS** | `ForecastAuthorization.forecastHorizon` required by `validateEvidenceClaim()`. |
| 11 | Is historical frequency prevented from becoming probability? | **PASS** | Phase 3 semantic validator plus adversarial case 3. |
| 12 | Is analog similarity prevented from becoming probability? | **PASS** | `validateEvidenceClaim()` and adversarial case 2. |
| 13 | Is LLM confidence prevented from becoming market probability? | **PASS** | Phase 4 validator nulls `confidence` and `finalVerdictConfidence` absent authorization. |
| 14 | Is engine-value → future-target transfer prevented? | **PASS** | Target/level fields are nulled without an authorized forecast. |
| 15 | Is historical-window → current-forecast-window transfer prevented? | **PASS** | Horizon fields are nulled absent authorization; adversarial case 1. |
| 16 | Can unsupported targets be withheld? | **PASS** | `NO_FORECAST_FIELDS`; `server/phase4Adversarial.test.ts`. |
| 17 | Can unsupported timing be withheld? | **PASS** | `expectedTimeframe` and horizon fields nulled; adversarial case 7. |
| 18 | Can unsupported confirmation criteria be withheld? | **PASS** | Structured no-governed-condition replacement; adversarial case 5. |
| 19 | Can unsupported invalidation criteria be withheld? | **PASS** | Structured no-governed-condition replacement; adversarial case 6. |
| 20 | Is confirmation/invalidation provenance retained when such logic exists? | **PASS** | `EvidenceClaim.confirmationProvenance` preserved by Phase 3 contract; Phase 4 does not create a replacement rule. |
| 21 | Can a single engine no longer become system-wide deterioration? | **PASS** | Scope-escalation detector with active withholding; adversarial case 4. |
| 22 | Can multiple raw metrics no longer become false multi-engine confirmation? | **PASS** | Prompt forbids raw-metric confirmation; cross-engine rows require structured evidence. |
| 23 | Is unsupported causal escalation prevented? | **PASS** | Causal detector with active withholding; adversarial case 9. |
| 24 | Does degraded data quality appropriately bound narrative language? | **PASS** | Transaction supplies quality; prompt requires qualification; adversarial case 10. |
| 25 | Does Evidence Strength appropriately influence language without becoming probability? | **PASS** | Transaction supplies strength and prompt preserves semantic separation. |
| 26 | Can conflicting evidence remain explicitly conflicting? | **PASS** | Canonical quality/conflict warnings and insufficient-evidence safe path; adversarial case 12. |
| 27 | Can insufficient evidence produce a concise non-answer? | **PASS** | Canonical-unavailable branch returns concise withholding response. |
| 28 | Are current-state and forecast statements separated? | **PASS** | Evidence classes and forecast authorization are explicit in `shared/evidenceContract.ts`. |
| 29 | Are historical analog semantics preserved? | **PASS** | Analog similarity retained as historical context, not a forecast. |
| 30 | Are historical frequency semantics preserved? | **PASS** | Historical claims cannot carry model probability. |
| 31 | Is repetitive Oracle/ASHA content materially reduced? | **PASS** | Token-overlap semantic repetition test actively withholds duplicated outputs. |
| 32 | Does each output section have a distinct purpose? | **PASS** | Active prompts assign distinct concise roles; duplicate-section validator. |
| 33 | Is generic filler materially reduced? | **PASS** | Generic-filler detector causes generated narrative withholding. |
| 34 | Do direct questions receive direct answers? | **PASS** | ASHA and Oracle prompts require direct answer first. |
| 35 | Can simple questions receive short answers? | **PASS** | `resolveAnswerFormat()` sets `SIMPLE` mode with one answer, evidence, limitation. |
| 36 | Can complex questions receive structured institutional answers? | **PASS** | `STRUCTURED` mode permits concise distinct supported sections. |
| 37 | Are regenerated answers locked to one canonical-state transaction? | **PASS** | `assertSameInterpretationState()`; ASHA structural retry does not refresh transaction. |
| 38 | Can State A narrative not silently pair with State B metrics? | **PASS** | Active ASHA/Oracle prompts consume one transaction packet; state-drift test. |
| 39 | Do generated responses retain evidence claim references? | **PASS** | `InterpretationTransaction.evidenceClaimIds` and persisted conversation fields. |
| 40 | Is output validation performed against the evidence contract? | **PASS** | `validateInterpretationOutput()` executes before ASHA/Oracle delivery. |
| 41 | Are invalid responses regenerated/withheld under bounded retry rules? | **PASS** | ASHA retains one existing structural retry; unsafe semantic output is withheld without looping. |
| 42 | Are owner/debug provenance records available? | **PASS** | Additive `conversationMessages` provenance fields and `conversationLogger.ts`. |
| 43 | Do cross-surface outputs preserve evidence semantics? | **PASS** | `PHASE_4_CROSS_SURFACE_PROOF.json`; Phase 2/3 regression dependencies. |
| 44 | Are ASHA/Oracle prompts compliant with Phase 3 evidence rules? | **PASS** | Active prompts call `evidenceNarrativePromptContract()` and the Phase 4 contract. |
| 45 | Has Phase 5 Cross-Engine Synthesis NOT been implemented early? | **PASS** | No new synthesis engine; only prevents false synthesis. |
| 46 | Has Early Warning Intelligence NOT been implemented early? | **PASS** | No candidate detection, scoring, lifecycle, or warning workflow added. |
| 47 | Has Champion V1 remained unchanged? | **PASS** | No changes to `server/pressure/engine.ts` scoring logic. |
| 48 | Has V3-H remained shadow-only? | **PASS** | No V3-H promotion or integration change. |
| 49 | Have Phase 2 canonical protections remained intact? | **PASS** | `server/engineContextCanonical.test.ts`, `server/canonicalIntelligenceState.test.ts`. |
| 50 | Have Phase 3 evidence protections remained intact? | **PASS** | `server/evidenceContract.test.ts`, `server/evidencePacket.test.ts`. |
| 51 | Are focused Phase 4 tests passing? | **PASS** | 4 Phase 4 test files, 25 focused tests passing at evidence run. |
| 52 | Is full regression clean? | **PASS** | Final `pnpm test`: **141 files passed; 1 skipped; 1,756 tests passed; 22 skipped; 0 failed**. |
| 53 | Are there zero unresolved CRITICAL ASHA/Oracle integrity defects? | **PASS** | No unresolved critical defect in prompt/output audit. |
| 54 | Are there zero unresolved HIGH defects capable of producing materially misleading intelligence? | **PASS** | Unsupported claims are corrected or withheld before delivery. |
| 55 | Is Phase 4 sufficiently complete for Phase 5 to begin? | **PASS** | All 55 gate items pass, focused suites pass, and final regression is clean. **Phase 5 is technically eligible but has not begun.** |

## Permanent Evidence

| Artifact or test | Location |
|---|---|
| Shared interpretation transaction and output validator | `shared/interpretationIntegrity.ts` |
| Pipeline and response-quality contract | `PHASE_4_ASHA_ORACLE_CONTRACT.md` |
| Prompt audit | `PHASE_4_PROMPT_AUDIT.json` |
| Output claim audit | `PHASE_4_OUTPUT_CLAIM_AUDIT.json` |
| Adversarial evidence | `PHASE_4_ADVERSARIAL_TESTS.json`, `server/phase4Adversarial.test.ts` |
| Cross-surface proof | `PHASE_4_CROSS_SURFACE_PROOF.json` |
| Integration guard | `server/phase4AshaOracleIntegration.test.ts` |
| Artifact guard | `server/phase4Closure.test.ts` |
