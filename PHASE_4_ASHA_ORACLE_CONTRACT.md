# Phase 4 — ASHA / Oracle Interpretation Contract

## Governing Rule

> ASHA and Oracle may interpret verified evidence. They may not create facts that do not exist in the evidence packet.

Phase 4 is additive to the locked Phase 2 canonical-state and Phase 3 evidence contracts. It neither changes scoring nor creates Phase 5 Cross-Engine Synthesis or Early Warning functionality.

## Current Pipeline Map

| Path | Entry point | Context / state source | Prompt boundary | Response handling | Persistence / reuse |
|---|---|---|---|---|---|
| ASHA panel / briefing | `server/ashaEngine.ts:askAsha()` | `createAshaGatewayContext()` → canonical market-state adapter | `ASHA_IDENTITY` + `buildAshaCanonicalContextBlock()` | JSON briefing parse, one bounded correction attempt, client response | Client ASHA panel / Oracle briefing; model trace returned |
| ASHA daily greeting | `server/ashaEngine.ts:generateAshaDailyGreeting()` | Same canonical gateway context | ASHA identity + canonical context | Plain-text reply | Daily Greeting / Hero consumers |
| Oracle / Ask Intelligence | `server/routers/smartDiscovery.ts:ask` → `orchestrateWithRouting()` → `orchestrateAnswer()` | FMOS, Seismograph, live price, historical helper; legacy direct assembly before Phase 4 migration | Oracle system prompt + JSON schema | Direct parse and UI response | `conversationLogger.ts`; Ask / Oracle briefing UI |
| Oracle opportunity ranking | `orchestrateOpportunityRanking()` | Opportunity scan plus FMOS | Separate ranking prompt | Direct parse | Ask response; not a current-state interpretation transaction |
| Outlook narrative | `server/routers/outlook.ts:getTodaysStory` | Existing canonical / forecast metadata integration | Outlook evidence prompt | Persisted story | Outlook surface |
| Daily Brief | `server/autonomousPublishing.ts` | Immutable generated snapshot / forward canonical origin | Shared Phase 3 prompt contract | Archived snapshot | Daily Brief archive |
| Owner / memory paths | `server/routers/ashaMemory.ts`, `conversationLogger.ts` | Conversation log metadata | No primary generation | Timeline / analytics views | Existing conversation rows |

## Phase 4 Minimum Shared Layers

1. **Interpretation transaction.** A single immutable generation scope binds a response to canonical state identity, evidence packet, prompt identity, model identity, validation result, and bounded attempts.
2. **Pre-generation prompt contract.** The model receives allowed evidence, prohibited claim types, limits, and response-quality rules before generation.
3. **Post-generation validator.** Generated output is checked for unauthorized probabilities, horizons, targets, confirmation/invalidation, causal escalation, false cross-engine escalation, unsupported confidence, state mixing, generic filler, and duplicated section content.
4. **Safe normalization.** When a structured claim is absent or unsupported, it is withheld rather than filled with defaults.
5. **Owner/debug trace.** The response returns non-public audit metadata sufficient to diagnose canonical state, claim references, withheld reasons, prompt/model version, attempts, and validation.

## Output Quality Contract

Every material response must answer the question first, use supplied evidence, preserve semantic distinctions, state meaningful limits, avoid unsupported precision and generic filler, avoid material repetition, retain canonical identity, and stop when the answer is complete.

## Explicitly Deferred

Phase 5 structured cross-engine synthesis, Phase 6 Early Warning candidate detection, Phase 7 importance scoring, Phase 8 lifecycle, Phase 9 confirmation/invalidation engine, Phase 10 UI, and Phase 11+ work are outside this contract.
