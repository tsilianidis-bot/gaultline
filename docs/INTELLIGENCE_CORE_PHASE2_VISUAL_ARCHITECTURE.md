# Intelligence Core — Phase 2 Visual Integration Architecture

## Product boundary

Phase 2 adds a premium, evidence-first visual experience **inside the existing NOW page**. It does not add a primary navigation item, replace the five-question methodology, call market providers from the browser, calculate a new market state, generate event claims, or produce AI market conclusions.

The visual layer consumes only the authenticated `intelligenceEvidence.current` response introduced in Phase 1. Existing public-preview behavior remains unchanged: an unauthenticated visitor does not receive evidence data through this interface, and the Core must not create a backdoor to member intelligence.

## Visual system

The centerpiece is a dark FAULTLINE constellation: six named analytical domains—equities, bonds/rates, credit, liquidity, volatility, and crypto—arranged around a restrained central canonical-state anchor. Gold signals modelled/canonical analysis. Cyan signals direct verified observations. Amber indicates delayed or historical context. A muted, clearly labeled unavailable state replaces a value when the evidence gate does not permit a current claim.

Connections are a **domain dependency map**, not a claim of current market causality or measured correlation. An edge may exist because a domain contributes to the analytical framework, but edge brightness, activity, or propagation cannot imply a data relationship unless Phase 1 has a verified supporting record. Decorative pulses must be tied to a newly captured, timestamped evidence snapshot; unavailable nodes stay quiet and visibly unavailable.

The component must support `prefers-reduced-motion`, keyboard selection, screen-reader summaries, and a non-WebGL fallback. It should be lazy-loaded only in the NOW experience to avoid expanding the initial application bundle for users who never open the Core.

## Component boundaries

```text
NOW page
  └── IntelligenceCoreFeatureGate
        ├── EvidenceStatusHeader
        ├── IntelligenceConstellation
        │     ├── CanonicalAnchor
        │     ├── EvidenceNode × 6
        │     └── ConceptualRelationshipEdge × N
        ├── SourceHealthStrip
        ├── EvidenceDrawer
        │     ├── ProvenancePanel
        │     ├── FreshnessPanel
        │     └── LastVerifiedPanel
        └── FutureActivityStreamBoundary (not enabled in Phase 2 initial release)
```

### `IntelligenceCoreFeatureGate`

Uses a separate server-controlled visual flag in addition to `FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED`. The visual flag must default to false. It renders nothing when evidence collection is disabled, the caller is not entitled, or the evidence interface has no eligible data.

### `EvidenceStatusHeader`

Shows only facts from the response: overall `CURRENT`, `DEGRADED`, `UNAVAILABLE`, or `DISABLED`; snapshot capture time; and a compact source-health summary. It never converts partial availability into a confidence percentage or a neutral market condition.

### `IntelligenceConstellation`

Receives a normalized visual projection of validated evidence. Each node must expose its label, provider, origin (`observed` or `modeled`), validation status, original observation time, and availability. The renderer must not fetch, transform, average, or infer a value. A Canvas/WebGL implementation can be introduced through a lazy React Three Fiber component only after the behavior is complete with a semantic DOM fallback.

Node selection opens the drawer. Pointer hover is supplementary; equivalent keyboard controls and a selectable compact list are required.

### `EvidenceDrawer`

The drawer is the proof surface. It shows source name, origin, source observation time, ingestion time, freshness policy, validation status, reason, model version where relevant, and any explicitly historical `lastVerified` value. A null current value remains null; the drawer must not show a cached number as though it were current.

On mobile, this becomes a bottom sheet or in-flow detail panel rather than a hover-dependent overlay. It must keep the NOW page readable at 320px without a separate mobile navigation path.

### `SourceHealthStrip`

Shows one compact, source-labeled status per provider. It reports the exact unavailable/degraded reason already returned by Phase 1. It must not publish an invented uptime score, reliability percentage, or “AI confidence” score.

### Future activity and commentary boundaries

The Phase 2 initial release contains no automated event stream and no AI commentary. A future activity stream may display only a persisted Phase 1 snapshot write or a separately governed, verified event with a stable record ID, observed time, provider/evidence links, and no inferred outcome. Future AI commentary must receive the evidence packet and visibly separate confirmed observations from modeled interpretation; it cannot bridge missing data.

## Data-to-domain projection

- **Equities:** verified Yahoo/Polygon quote observations where source timestamps remain within policy.
- **Bonds/rates and credit:** timestamped FRED releases; they retain their release cadence and are not rendered as intraday data.
- **Liquidity and macroeconomic conditions:** canonical modeled outputs, always labeled with their model version and modeled origin.
- **Volatility:** timestamped VIX observation or a clearly unavailable node.
- **Crypto:** CoinGecko only after its provider `updated_at` timestamp is propagated through the adapter and Integrity Gate.

A domain can show several evidence records, but Phase 2 must not average them into a fabricated score. It can display a source roster and the strongest permitted status, with every individual observation accessible in the drawer.

## Failure behavior

When a provider is stale, rate-limited, lacks credentials, or has no valid observation time, its domain becomes unavailable or historical. The constellation stays structurally stable, but the node uses an explicit unavailable label and does not animate as a live signal. If all evidence is unavailable, the entire feature collapses to a compact source-status message; it does not render a dramatic empty network that could imply a market state.

During post-market hours, an end-of-session quote needs a deliberate policy: it may be presented as a timestamped completed-session observation or historical context, but not as a fresh intraday signal. This policy belongs in the evidence layer before Phase 2 UI treats such data as usable.

## Implementation sequence

1. **Close readiness blockers.** Enable the existing read-only Railway connector, verify production `marketMemory` persistence/readback and provider credentials, and keep both Phase 1 and visual flags disabled.
2. **Phase 1.1 evidence correction.** Add CoinGecko `data.updated_at` to the existing adapter and gate it with tests. Define a session-aware Yahoo freshness policy that preserves the current fail-closed rule outside its approved window.
3. **Visual projection contract.** Add a server/client-safe mapping from validated evidence to six display domains. It carries no derived score, relationship strength, event severity, or recommendation.
4. **Accessible NOW prototype.** Build the semantic status header, node list, evidence drawer, and degraded/unavailable states first behind a disabled visual flag.
5. **Constellation enhancement.** Add lazy-loaded Canvas/WebGL lighting and motion only after the DOM fallback is complete. Motion follows real snapshot updates and respects reduced-motion preference.
6. **Review and test.** Test all evidence states, keyboard drawer access, mobile layout, public/member access boundaries, and the absence of browser-side provider calls. Capture review screenshots. Do not merge, deploy, or enable either flag without separate authorization.

## Acceptance conditions for a later Phase 2 release

- The NOW page retains current layout, navigation, and five-question methodology.
- Every visible value has a provider/source label and original observation time.
- Stale, delayed, modeled, historical, and unavailable states are visually distinct and textually explicit.
- No animation suggests that missing or stale data is live.
- The drawer explains provenance and exposes last verified information without relabeling it current.
- No event claim, trading conclusion, performance result, or AI market conclusion is created.
- Pressure Index, canonical MarketState, trading tools, Daily Briefs, blogs, pricing, Stripe, authentication, navigation, and schema are unaffected.
