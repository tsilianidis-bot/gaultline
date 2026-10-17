# PR #100 — visual refinement integration handoff

**Status:** complete isolated visual refinement, for review only. PR #100 remains a draft. No merge, deployment, production write or feature activation. The approved foundation is preserved; comparison baseline is `51d94e899f65b9026925e927c6f43f941dbdce74`.

## Existing host API is unchanged

Continue using `IntelligenceCoreExperience` with the same typed `model` and optional `onNavigate` props and `adaptIntelligenceCore` at the existing presentation boundary. No fields were added to `types.ts`, no canonical or accountability-ledger contracts were changed, and no new dependency is required. The component remains unmounted in the production application. Do not import `design-preview/fixtures.ts` or preview controls into production.

Deliver a sanitized current snapshot with stable canonical identity, original observation/evaluation timestamps, admitted evidence IDs, explicit source classification, validity deadlines, and supported relationship kind. The visual layer preserves association versus upstream-supported causation. Its new pure `detectCoreVisualTransition(previous, current)` comparator consumes already-sanitized snapshots; it does not calculate markets, confidence, probabilities, predictions, outcomes or source observations. It suppresses first-load, replayed, out-of-order, incomplete, future or degraded current claims. Genuine admissions and source changes can receive finite emphasis; reduced motion retains the factual change text without animation. No continuous frame loop or polling was added.

## Only change to the existing presentation adapter

In `adapter.ts`, `sourceStatusForDomain` previously changed a declared-current domain to unavailable and discarded its evidence references after its admitted source expired. The narrowly scoped fallback now preserves **stale historical domain context only when every complete admitted reference is stale and has a valid, actually elapsed source deadline**. Current assessment and direction remain withheld; the existing current pressure/regime/overview gates are unchanged. Missing, unadmitted, mixed, malformed or future-deadline references still fail closed. Existing non-current classifications are never promoted.

The transition comparator separately requires the same evidence ID, source, observation and validity deadline across the expiry pair. Changing a payload's deadline into the past is not an expiry event. Tests cover retained stale lineage, mixed and unproven references, and changed-source/changed-deadline rejection. This is a presentation correction, not a provider-adapter or canonical admission change.

## Visual and navigation changes

`CoreTopology.tsx` and scoped `core-refinement.css` render the enlarged layered SVG aperture, measured Pressure Index ring, source-availability segments and differentiated organizational/relationship paths. No confidence or relationship strength is encoded. Unavailable readouts are dimmed; numeric data remains the supplied value. Status labels supplement color. Current supporting domains and factual snapshot deltas are exposed alongside the assessment.

`EvidenceDrawer.tsx` retains Radix focus trapping, Escape, exact opener restoration and newest-model domain resolution; source timestamps now use semantic `time`. Drawer/panel CSS refines readability and finite interaction feedback. Scenario A/B/C semantics, invalidations, lineage, cohort separation and metric thresholds remain intact. Completed panel effects are released rather than held at idle.

The methodology labels are REALITY → CAUSATION → CONSEQUENCE → VERIFICATION → ACTION, pointing to the same `/app/now`, `/app/why`, `/app/outlook`, `/app/watch` and `/app/act` routes. Existing primary navigation is unchanged. The mobile Core uses its own framing above the retained two-column touch matrix, not a compressed desktop map.

## Review and reproduction

The isolated preview's existing Vite configuration is unchanged. Build with `vite build --config design-preview/vite.config.ts`; run its compiled preview on the existing sandbox port. `?state=demo` shows the comparable mixed-source fixture; `?state=transitions` exposes manual fictional admission, regime, association and actual-deadline expiry controls. Every fixture remains explicitly labeled fictional, never a production fallback. `?state=unavailable`, `degraded` and `records` remain available.

`verify-browser.py` preserves inherited behavior. `verify-refinement.py` checks the new transitions, accessibility-tree semantics, reduced motion and responsive limits. `measure-performance.py` supports identical desktop or throttled mobile profiles and waits for the finite modal-close transition before checking focus. `record-refinement.py` records real preview interactions. Final validation comprises 84 targeted regressions, both TypeScript checks, 44 inherited browser checks and 41 refinement checks, including affected-path rechecks. Automated WCAG scans found no violations in tested states; actual NVDA/VoiceOver and physical-device testing were not available.

Grok's verified Core, Track Record and checkout integration remain separate. Do not merge this visual draft until its evidence and host integration are reviewed together with the canonical work. No production activation is included in this handoff.
