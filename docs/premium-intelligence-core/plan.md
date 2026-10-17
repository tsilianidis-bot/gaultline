# Premium Intelligence Core — implementation plan

Authorized visual implementation on `design/premium-intelligence-core-20261017`, based on the verified public production release `1cb5dee13832c0556ec5a380ecc4ffb02513e875` (`release/2026-10-05-ux-r3`). Public health, build-info and version agreed on this SHA on 2026-10-17 at 16:23 UTC. Railway token scope lookup failed; no Railway mutations are permitted or required.

## Implementation

Build an embeddable React/TypeScript presentation module and a separate Vite design-preview entry. The production entry does not import fixtures, make provider requests, infer market conditions or mount itself in the application. A fail-closed presentation adapter accepts a typed, upstream-validated canonical payload and removes unsupported current claims. It does not calculate Pressure Index, change canonical validation or create provider adapters. Preview fixtures live only in `design-preview/`, outside the production Vite root and entry graph. No router, startup, billing, pricing, registration, existing shared market-state, migrations or deployment configuration changes.

Use a lightweight SVG analytical topology: the central measured pressure ring, six touch/keyboard-operable domain nodes, and explicitly labeled conceptual connections. Evidence-supported relationships are independently labeled and inspectable; default core-domain connectors express organization, never causality. A Radix evidence drawer supports focus trap, Escape and return focus. Scenario and track-record modules expose evidence lineage and empty states. Existing five-question methodology links into canonical destinations via a host navigation callback, without adding primary navigation. The actual release has a WHY destination; preserve it rather than altering global navigation.

## Design

Scientific monitoring meets institutional editorial design. Use near-black navy, mineral cyan, muted amber and white; urgency colors only accompany current admitted observations. The asymmetric layout places a large topology beside an editorial interpretation rail, then a compact scenario strip and evidence-accountability ledger. Monospaced micro-labels, precise rules, restrained cyan ticks, a dimensional center disc and generous whitespace make it recognizable without decorative imagery. Reuse the existing Space Grotesk / IBM Plex Mono font stack, FAULTLINE tokens and Radix dialog dependency. No external image is needed for a data-oriented interface; official Railway API documentation was collected before implementation.

Interactions reveal evidence before implying certainty. Animate a single measured-change ring only when both successive canonical snapshots have admitted current evidence and verified pressure changes. No drifting particles, random trajectories, live-looking ticker, rotating radar or looping simulated market motion. Reduced-motion disables all transitions. Mobile moves nodes into a readable two-column touch matrix around a simplified core and uses a full-width evidence drawer.

## Structure

`client/src/components/intelligence-core-visual/`: typed contract, presentation adapter, main experience, topology, evidence drawer, scenarios/ledger, scoped CSS and exports. `design-preview/`: standalone HTML/React entry, isolated labeled fixtures and Vite/test configuration. `server/premiumIntelligenceCorePresentation.test.ts`: pure adapter regression tests runnable with the existing node Vitest setup. `docs/premium-intelligence-core/`: integration handoff and implementation outcomes. No production page is activated in this draft.
