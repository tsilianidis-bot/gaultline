# Phase 2I — Exact 32-Question Acceptance Gate

All entries below are evaluated against the Phase 2 canonical-state contract, the permanent Phase 2I tests, and the clean full regression run of **1,711 passed, 22 skipped, 0 failed**.

| # | Acceptance question | Result | Evidence and reference |
|---:|---|---|---|
| 1 | Does one authoritative canonical current-state interface exist? | PASS | `phase2-canonical-state-v1`; `shared/canonicalIntelligenceState.ts`; `server/canonicalIntelligenceState.test.ts`. |
| 2 | Is Pressure Index sourced canonically? | PASS | `canonicalState.pressureIndex` overrides compatibility pressure in `EngineContext`; `server/engineContextCanonical.test.ts`. |
| 3 | Is regime sourced canonically? | PASS | `canonicalState.regime` overrides compatibility regime in `EngineContext`; `server/engineContextCanonical.test.ts`. |
| 4 | Are major engine values sourced canonically? | PASS | Canonical engine values and their IDs are preserved in public state/envelope; Tests A and I. |
| 5 | Are level, direction, and classification structurally separated? | PASS | Canonical contract has distinct pressure level/direction and engine classification fields; `server/canonicalIntelligenceState.test.ts`. |
| 6 | Are input timestamps and freshness available? | PASS | Canonical engines retain observed/calculated time, freshness, and source input IDs. |
| 7 | Can mixed-timestamp state be detected? | PASS | Test B produces `TEMPORAL_MISMATCH` and degraded coherence. |
| 8 | Can stale state be detected? | PASS | Test C retains `STALE_INPUT` and non-healthy quality. |
| 9 | Are unavailable inputs distinct from neutral and zero? | PASS | Test D retains `UNAVAILABLE_INPUT`; no zero conversion occurs. |
| 10 | Are fallbacks explicitly visible? | PASS | Test E retains original source, fallback source, reason, and fallback conflict. |
| 11 | Does quality propagate into canonical state? | PASS | Canonical quality derives from unavailable, fallback, stale, and coherence states; Tests B–E. |
| 12 | Are governed probabilities attached without semantic conversion? | PASS | Probability claim IDs remain claim IDs; Test F. |
| 13 | Are analogs attached without semantic conversion? | PASS | Analog claim IDs remain similarity claim IDs; Test G. |
| 14 | Can multiple analog models remain distinguishable? | PASS | Analog IDs are preserved as an array in canonical state and consumer envelope. |
| 15 | Are state conflicts represented structurally? | PASS | `CanonicalStateConflict` records type, components, severity, status, and fallback audit metadata. |
| 16 | Is controlled regime/intelligence vocabulary enforced or centrally defined? | PASS | Canonical contract centrally defines coherence, quality, direction, engine fields, and conflict vocabulary. |
| 17 | Can canonical state be versioned? | PASS | Champion/model/scoring/configuration/input/state hash are contract fields. |
| 18 | Can historical live states remain associated with their original versions? | PASS | Test H verifies independent historical identity retention. |
| 19 | Is reconstructed research still distinct from live canonical history? | PASS | `historicalContext` explicitly differentiates operational manifests and reconstructed research. |
| 20 | Can ASHA and Oracle identify which canonical state they consumed? | PASS | Their EngineContext output retains `canonicalEnvelope.stateId`; 44-consumer inventory. |
| 21 | Do NOW and WHY represent the same canonical current state? | PASS | Controlled cross-surface proof; `PHASE_2I_CROSS_SURFACE_PROOF.json`. |
| 22 | Does WATCH use the canonical state? | PASS | Canonical composition guard; `server/watchComposition.test.ts`. |
| 23 | Is canonical failure/degraded behavior explicit? | PASS | Test J withholds compatibility state; Tests B–E represent degraded/unavailable quality. |
| 24 | Is the state auditable through snapshot/version/hash or equivalent immutable identity? | PASS | State ID, input snapshot ID, version identities, and hash persist in state/envelope. |
| 25 | Are regression tests clean? | PASS | `pnpm test`: 132 files passed, 1 skipped; 1,711 passed, 22 skipped, 0 failed. |
| 26 | Are there any unresolved CRITICAL integrity issues? | PASS | None identified by no-bypass guard or full regression; `PHASE_2I_NO_BYPASS.json`. |
| 27 | Do WHY current-state narrative/evidence payloads require canonical state? | PASS | `server/whyComposition.test.ts` and canonical consumer inventory. |
| 28 | Do WATCH current-state narrative/evidence payloads require canonical state? | PASS | `server/watchComposition.test.ts` and canonical consumer inventory. |
| 29 | Has Market Context Strip mixed-state behavior been eliminated or explicitly contextualized? | PASS | Current state travels through the canonical envelope; `PHASE_2I_CONSUMER_INVENTORY.json`. |
| 30 | Have all discovered current-intelligence consumers been either migrated or explicitly classified as non-current/historical/research? | PASS | Exact 44-consumer inventory with zero unclassified entries. |
| 31 | Can no core current-intelligence path silently fall back to legacy projected state? | PASS | `server/phase2iCanonicalClosure.test.ts`; zero unresolved bypasses. |
| 32 | Do cross-surface tests prove consistent canonical stateId propagation? | PASS | Controlled proof covers API, EngineContext, NOW, WHY, WATCH, ACT, Market Context, Outlook, ASHA, Oracle, Day Trade Intelligence, Dashboard, Mobile Brief, and Pressure. |

## Gate Verdict

**PASS.** The gate is supported by the permanent artifacts and tests named in this document. The Daily Brief remains an archived/generated snapshot: legacy rows keep unavailable origin fields, while newly generated rows store a canonical origin only when the immutable snapshot matches the publication-time canonical state.
