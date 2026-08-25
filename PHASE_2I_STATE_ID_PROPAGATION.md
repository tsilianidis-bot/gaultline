# Phase 2I — State-ID Propagation Proof

## Governing transport

> `phase2-canonical-state-v1 → canonical projection → EngineContext → CanonicalConsumerEnvelope → compatibility output → consumer boundary`

The canonical state remains the authority. `EngineContext` begins the compatibility projection only after canonical state is available, derives core pressure and regime from that state, and retains the generated `CanonicalConsumerEnvelope` on the compatibility output. The envelope preserves `stateId`, times, quality/coherence/conflicts, claim and analog references, version identity, input snapshot ID, and hash.

| Link | Required identity behavior | Evidence | Result |
|---|---|---|---|
| Canonical manifest → public state | Immutable `stateId`, version identities, input snapshot, and hash survive projection | `server/canonicalIntelligenceState.test.ts` | PASS |
| Public state → EngineContext | Current transport waits for canonical state; pressure/regime originate in canonical state | `server/engineContextCanonical.test.ts` | PASS |
| EngineContext → envelope | Envelope retains the same state identity and provenance around compatibility data | `shared/canonicalConsumerEnvelope.ts`; Test A | PASS |
| Envelope → compatibility output | `output.canonicalEnvelope` retains provenance for EngineContext consumers | `client/src/contexts/EngineContext.tsx`; `server/engineContextCanonical.test.ts` | PASS |
| Compatibility output → consumer | Every `CURRENT_CANONICAL` inventory row is verified with a non-bypass disposition | `PHASE_2I_CONSUMER_INVENTORY.json`; `server/phase2iCanonicalClosure.test.ts` | PASS |
| Generated/archive boundary | Daily Brief retains explicit archive semantics and links only a verified publication-time canonical origin | `server/dailyBriefSnapshot.canonicalOrigin.test.ts` | PASS |

## Result

| Measure | Result |
|---|---:|
| Exact consumer inventory | 44 |
| Current canonical consumers | 36 |
| Current canonical consumers with verified provenance | 36 |
| Unclassified consumers | 0 |
| Unresolved current-state bypasses | 0 |

The controlled-state proof in `PHASE_2I_CROSS_SURFACE_PROOF.json` verifies the retained `stateId`, effective time, pressure, regime, engine value, quality, model version, and configuration version across the required surface representatives.
