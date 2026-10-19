# Independent acceptance review — Premium marketing candidate

**Review mode:** source and existing-evidence only; no browser, test rerun, external request, login, provider/DB/API/credential access, installation, source edit, commit, merge, or deployment was performed by this reviewer.

**Snapshot reviewed:** working tree on `marketing/premium-homepage-20261019`, whose committed `HEAD` remains `49d6ab7dbf97dcca272e96339217acf9e8ca022d`. The continuation implementation is **uncommitted** at review time, so `49d6ab7` is the source-review base/pin rather than an immutable SHA for the current worktree.

## Disposition

| Decision | Result | Why |
|---|---|---|
| **Release** | **NO-GO** | Five of five operational captures remain correctly blocked; no approved nonproduction observations/session/resources were provided. The recorded optimized mobile lab audit is **86 Performance / 3.7 s LCP**, below the stated ≥90 / ≤2.5 s targets. It is also not tied to an immutable final continuation SHA. |
| **Candidate continuation / review** | **Conditional GO** | The source contains appropriate fail-closed evidence gates, honest placeholders, public/category-specific links, accessibility/motion fallbacks, and isolated public-root startup. Continue only through the pending nonproduction evidence qualification and final build/metric/pin checks—**not** merge or deployment. |

## Release-blocking dependencies (P1)

1. **No qualified product capture exists (0/5).** `showcaseEvidence.ts:64-85` makes every candidate pending with false/null evidence fields, and `hasVerifiedCapture` requires every operational, source, local-raster, hash, dimensions, provenance, timing, allowed-classification, and privacy condition (`client/src/components/marketing/showcaseEvidence.ts:244-275`). The UI renders a conspicuous placeholder and no capture controls while pending (`ProductShowcase.tsx:244-277,310-314`). This is correct behavior, but blocks a screenshot-gallery release outcome.
   - The five current categories are **Pressure Index & Overview, Six-Domain Intelligence, Signals & Smart Discovery, Outlook & Scenarios, and Daily Intelligence Brief** (`showcaseEvidence.ts:97-210`). No `client/public/marketing` image exists in the reviewed checkout.
   - `runtime-evidence-absence.json:5-13` records a database-free, no-external-request router read with `canonicalCurrent === null`, no published snapshot-bound brief, and `operationalCapturesAdmissible: false`. It is absence evidence, not an operational test.
   - Each of the five `docs/marketing/qualification/*.md` reports is **BLOCKED**. They identify the actual missing resource instead of inferring a production failure: governed nonproduction canonical data (Pressure), wired six-domain source observations/activation (Six-Domain), authorized nonproduction provider/Discovery resources (Signals), governed canonical Outlook surface (Outlook), and a published immutable linked brief snapshot (Daily Brief). Each report’s final “Parent scope clarification” says this source-only review did **not** prohibit an explicitly authorized nonproduction test session; none was supplied.

2. **Mobile performance acceptance remains unmet and final measurement is pending.** The recorded static-local optimized Lighthouse artifact (`lighthouse-optimized.json:7,66-92`) reports **Performance 86, FCP 2.6 s, LCP 3.7 s, TBT 50 ms, CLS 0**; Accessibility/SEO are 100 and Best Practices 96. This improves on the recorded first split (**LCP 4.9 s, TBT 70 ms**) and baseline (**48 / LCP 6.3 s / TBT 761 ms**), but does **not** meet the specified score/LCP targets. The engineer was still completing a bounded loading/font change during this review; do not reuse this measurement as acceptance for the final uncommitted source. Produce a fresh production-build audit after the final source is pinned.

3. **No immutable final source identity exists yet.** `git status` shows the marketing/bootstrap/CSS/evidence work as modified or untracked over `49d6ab7`; `current-pr-heads.json:3-8` consequently also identifies PR #109 at that older SHA. Before release evidence or a performance claim, commit/pin the final continuation and regenerate source-integrity/build evidence against that exact SHA. This is a release-traceability dependency, not a request to change protected product behavior.

## Concrete evidence consistency finding (P2)

- **Regenerate the canonical JSON source-integrity artifact once the final source is pinned.** `/home/ubuntu/marketing-completion/capture-source-integrity.json:34-143` is stale: it lists `detection`, `sector-rotation`, and `smart-discovery`, whereas the current manifest lists `signals-discovery`, `outlook-scenarios`, and `daily-brief` (`showcaseEvidence.ts:144-209`). Its aggregate result remains safely `0 admitted / 5 pending / no violations` (`capture-source-integrity.json:146-148`), so it has not admitted a capture incorrectly. The current `capture-source-integrity.log:6-163` and `docs/marketing/SCREENSHOT_REGISTER.json:5-94` do match the five current blocked categories. Nevertheless, the named JSON artifact should be regenerated from the current `scripts/verify-marketing-captures.ts:13-71` output for a coherent handoff.

## Source confirmations

### Bootstrap, product continuity, and auth boundaries — confirmed

- The auth-aware transport is retained: `safeFetch` still injects included credentials and preserves/wraps error envelopes (`main.tsx:22-76`); query defaults and retry policy are retained (`main.tsx:79-95`); the auth-resolution redirect safety net and tRPC split/batch setup remain at `main.tsx:97-176`. Comparison to `49d6ab7` found this transport/default/client section byte-equivalent.
- Original product providers are retained behind the product lazy boundary: `TickerStoreProvider`, `AshaProvider`, and `ExperienceProvider` continue to wrap `App` (`main.tsx:195-223`). The product-wide `index.css` is dynamically imported with that entry (`main.tsx:197-208`), while the public root imports only bounded marketing CSS (`marketing-entry.tsx:10`; `marketing-root.css:1-17`).
- Root-to-product client navigation selects `MarketingEntry` only at `/` and selects `ProductEntry` for every other Wouter location (`main.tsx:245-255`). On an authenticated root lookup, `MarketingEntry` redirects to the existing `CANONICAL_HOME` (`marketing-entry.tsx:17-22`), which moves into the product entry rather than retaining a marketing shell.
- The first-arrival path is captured before lazy product loading (`initial-entry-path.ts:1-7`) and consumed by the existing cinematic decision (`App.tsx:855-883`). The baseline already treated `/` as an immediate marketing arrival; this change preserves that root behavior if the auth redirect later loads `App`. Product auth gating remains explicitly confined to `/app` paths (`App.tsx:891-893,945-974`); no source condition makes an auth gate depend on a marketing route.
- Source comparison found no worktree delta in the specified protected hero/core/auth/MembershipOffer/router/canonical/Stripe paths. The production Vite change only excludes the editor runtime plugin from `command === "build"` while preserving it for dev/preview (`vite.config.ts:181-186`). Product fonts are deferred to product entry (`main.tsx:180-208`); root fonts use asynchronous stylesheet loading plus a no-script fallback (`client/index.html:150-156`).

### Evidence honesty, links, and presentation — confirmed

- The manifest rejects remote, traversal, query-string, and non-`/marketing/` assets (`showcaseEvidence.ts:213-224`) and specifically excludes `demonstration` classification from admission (`showcaseEvidence.ts:267-274`). No capture provenance or observation metadata has been invented: all five current records retain null fields and false verification flags.
- Each category’s public link is limited to an honest existing public reading or documentation surface—not `/app`, `/demo`, checkout, registration, or API—e.g. Pressure `/pressure-index`, source/limitation routes for the private/unqualified categories, and Daily Brief `/daily-brief` (`showcaseEvidence.ts:109-115,132-138,155-161,178-184,200-206`; regression guard source `server/marketingStartup.test.ts:66-84`). The nearby copy calls pending benefits **intent** and states the promotion blockers (`ProductShowcase.tsx:235-275,310-314`), avoiding an implied operational claim.
- If and only if a future capture clears every gate, viewport selection, provenance, image dimensions, accessible dialog, keyboard zoom controls, and image-error fallback are provided (`ProductShowcase.tsx:29-155,159-171`). Buttons meet 44px sizing and reduced-motion disables selection/zoom animation (`product-showcase.css:527-595`); unsupported scroll-timeline animation simply has no animation (`product-showcase.css:400-417`). Thus static/pending fallback and zoom accessibility are source-confirmed.
- The five qualification reports and screenshot register explicitly distinguish source review from runtime proof and clarify that an authorized nonproduction test session could later qualify private screens without changing auth/customer access (`SCREENSHOT_REGISTER.json:5-6,19-91`).

## Existing evidence noted, not rerun

- Focused marketing suite: **93 tests passed** (nine files) in `focused-after-gallery.log:2-15`; startup guards: **28 tests passed** (`startup-guards.log:2-10`).
- The provided full-suite result is reported by the parent as **307 files, 299 passed, 8 skipped; 3,660 passed assertions, 48 skipped, 0 failed**, at `/home/ubuntu/marketing-completion/full-regression-results.json`. The local 3-test-file DB suite is separately recorded as **6 passed** and is sandbox-binary-only (`local-integration-tests.log`). These are inherited/parent-run evidence and were not re-executed here.
- PR heads are all draft/open in `current-pr-heads.json:3-32`. Pairwise text checks show #109 conflict-free with #106, #107, and #108 (`current-pairwise-integration.json:25-32,45-62`); the #107/#108 `client/public/manus-routes.json` add/add conflict is between those two PRs (`:35-42`), not introduced by #109. Textual mergeability remains distinct from operational readiness.

## Reviewer limitations

This assessment does not certify browser interaction, assistive-technology behavior, network/runtime behavior, screenshot authenticity, a final production build, final Lighthouse run, or final multi-PR semantic integration. It intentionally relies on the recorded artifacts for tests and measurements and makes **no** claim that targets were achieved. The release owner should address the P1 dependencies, refresh the stale P2 JSON artifact, then conduct the parent’s final browser/accessibility/capture and final-build measurement on the pinned continuation SHA.
