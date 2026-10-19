# Premium Intelligence Core — validation results

The interactive visual implementation is complete as an isolated, embeddable React/TypeScript presentation module and a separately runnable Vite preview. It is based on the verified live release `1cb5dee13832c0556ec5a380ecc4ffb02513e875` (`release/2026-10-05-ux-r3`), not the outdated `main` or the unmerged visual PR #92. No production page was mounted, feature flag activated, Grok work merged or service deployed.

## Functional and integrity coverage

The Core shows the canonical observation, measured Pressure Index, regime and evidence integrity when admitted. It has six fixed domains with keyboard/touch selection, source observations, significance, market context, developing-since and historical-comparison slots. Unsupported history remains unavailable. The SVG distinguishes organizational connections from admitted associations/causal relationships and only highlights genuine verified changes once.

A/B/C scenario tabs expose conditions, invalidations, linked evidence and related domains. Scenario C cannot be favored. The Track Record component keeps forward-recorded and reconstructed cohorts separate, exposes dates/outcomes/evidence lineage and only displays admitted upstream metrics that meet supplied minimum samples. There is no invented probability, confidence score, historical performance statistic or synthetic production observation.

Every fixture is labeled fictional and confined to `design-preview/`. The default preview is the production-safe unavailable state. Delayed, stale, static, degraded and unavailable classifications have distinct text and visual markers. Expired admitted current evidence is retained as stale evidence history, not a current claim. Global degraded/unavailable conditions withhold the current central readout. A single next-deadline timer rechecks production freshness; an open drawer reads the updated sanitized model.

Original-source links are rendered only when the admitted payload supplies a safe HTTP(S) URL. A validated API observation may have a source identity and timestamp without a public URL; the UI does not fabricate one. The canonical evidence validator, not the presence of a clickable website, remains responsible for source admission.

## Typecheck and builds

`npm run check` passed for the finished application. `tsc -p design-preview/tsconfig.json` passed for the standalone preview and visual components. The unmodified live release also passed a separate `tsc --noEmit --incremental false` in a detached worktree, so the final branch is not concealing a pre-existing typecheck failure. Prettier and `git diff --check` passed for the new source.

The existing full `npm run build` passed, including frontend Vite and server esbuild compilation. Searching its production output found none of the new isolated fixture markers. Existing analytics-placeholder and large-chunk warnings remain outside this visual task; no startup or dependency change was made to suppress them. The isolated preview build passed independently.

The release's npm lockfile is out of sync with its `xlsx` declaration and has a pre-existing Vite peer-compatibility conflict. Dependencies were restored with the existing frozen pnpm 10.4.1 lockfile. Reviewed local build permissions rebuilt `esbuild` and `@tailwindcss/oxide`; all checked-in package declarations and lockfiles remain byte-for-byte unchanged. No backend startup, database connection or migration was required.

## Regression and browser verification

Seventy targeted regression tests passed across nine files: the 12 new presentation-adapter regressions plus existing route-switch, route-registry, route-consumer, canonical-display, pressure-label, pressure-band, canonical-pressure-projection and canonical-intelligence-state tests. They cover expiry at the actual browser clock, malformed/future/missing evidence, delayed/degraded masking, Scenario C, complete lineage, metric sample admission, global integrity, overview lineage, mixed stale pressure references and chronological verified-change animation. The entire provider/database test suite was not run; these were intentionally local, targeted regressions without production mutations.

All 44 browser checks passed. Tested widths were 360, 390, 768, 1024, 1440 and 1920 CSS pixels, with no horizontal overflow and domain touch targets at least 44 pixels in both dimensions. The check recorded keyboard domain opening, trapped drawer focus, Escape close and exact opener-focus restoration, scenario End-key navigation, related-domain highlighting, scenario evidence, separated record cohorts, expanded lineage, withheld fabricated metrics and a viewport-fitting mobile drawer.

Axe-core 4.10.3 reported zero automated WCAG 2 A/AA and 2.1 AA violations across the unavailable, mixed-evidence, evidence-drawer, degraded, ledger and mobile checks. This is automated coverage, not a claim of a complete manual accessibility certification or screen-reader audit. Reduced-motion disabled transitions, and the idle page had zero active animations. No browser runtime errors or production/provider API requests were observed.

The machine-readable browser report is `browser-validation.json`; commands are reproducible through `design-preview/verify-browser.py`. The separately delivered silent browser interaction recording demonstrates the real interface rather than generated screenshots or simulated live market motion.

## Performance observations

The complete standalone preview bundle, including React and Radix, was 280.28 kB JavaScript with 87.74 kB Vite-reported gzip and 29.59 kB CSS with 6.30 kB gzip. This is the whole separate preview, not an incremental production-bundle estimate. The production entry does not import this draft visual module or its fixtures, so production was not activated or enlarged by mounting it.

A fresh unthrottled headless Chromium page on the compiled sandbox preview observed 560 ms largest-contentful paint and a layout-shift sum of zero. It rendered 342 DOM elements, 27 SVG elements, zero Canvas elements and zero idle animations. Over a 1.5-second idle window, measured script time was zero and task time was 0.00148 seconds. The fresh page's used JavaScript heap was 3,574,392 bytes. Drawer opening and focus restoration also passed on the compiled preview, and all resource requests stayed local.

These are limited sandbox lab observations, not real-user production measurements or a low-end phone guarantee. The fresh compiled metrics are saved in `compiled-performance.json` and can be reproduced with `design-preview/measure-performance.py`. No WebGL, continuous frame loop, external imagery, provider polling or new production dependency was introduced.

## Visual evidence

The screenshots are direct captures of the functioning interface. Fictional values are labeled in the page and drawer, and the unavailable/degraded screenshots are intentional integrity states.

[Desktop Core](screenshots/desktop-core.png), [desktop evidence drawer](screenshots/desktop-evidence.png), [desktop unavailable](screenshots/desktop-unavailable.png), [desktop degraded](screenshots/desktop-degraded.png), [Scenario C](screenshots/scenario-c.png), [Track Record example](screenshots/track-record.png), [mobile Core](screenshots/mobile-core.png), [mobile evidence drawer](screenshots/mobile-evidence.png), and [full mobile page](screenshots/mobile-full.png).

## Remaining host integration

The approved canonical Core and accountability mapping, production mount location, feature activation, final release review, merge and deployment remain owner-controlled future integration work. This is not a backend completion claim. `HANDOFF.md` gives the exact typed mapping and isolation rules for PR #90 / #91 / #95 integration without modifying their unfinished branches.
