# Premium marketing candidate — independent review record

## Status and identity

**Draft PR:** https://github.com/tsilianidis-bot/gaultline/pull/109

**Head branch:** `marketing/premium-homepage-20261019`  
**Authorized base:** `release/2026-10-05-ux-r3` at `f908e04ff265d004488f92a909cba4b2e0cebe3b`  
**Implementation commit:** `66df256d4cb995c35a70415936afa4a218e6f677`

The final review-record commit and exact production-build SHA are identified in the PR body and delivered verification summary. The final update changes documentation and removes the preview-only route manifest from the tracked diff; application behavior is unchanged.

**Disposition: reviewable design candidate, not release-ready.** No merge, deployment, activation, production service access or production mutation is authorized or performed. Operational screenshot qualification and mobile startup performance remain open acceptance dependencies.

## Verification results

| Area | Result | Scope and limitation |
|---|---|---|
| TypeScript | `npm run check` passed | Current isolated candidate; no typecheck suppression or dependency declaration changes. |
| Production build | Implementation build passed | Vite frontend and existing esbuild backend bundle; final review-record commit is rebuilt before handoff. Existing large-chunk warnings remain. |
| Focused regressions | **87/87 passed, nine files** | Marketing content, reused topology, showcase qualification, source honesty, reduced motion, SEO, pricing, product cinematic preservation and billing. |
| Full existing suite | **3,642 passed assertions; zero failed assertions; 54 skipped** | Overall command exits **1**, because three database-dependent suite hooks fail before their tests. Do not call the full suite green. |
| Baseline failure comparison | Same three suites fail on untouched base | `governedResearchAppendOnly.e2e`, `trackRecordPipeline.e2e`, `trackRecordWorkflow.e2e`: `spawn mariadb-install-db ENOENT`, then 60-second hook timeout. No production DB used; tests attempt temporary local databases. No related code was modified or tests disabled. |
| Browser interactions | **32/32 passed** | 1440px desktop, 768px tablet, 390px mobile; no horizontal overflow; six buttons; gallery choices; mobile menu; public CTAs; educational dialog and focus restoration; pause/offscreen/reduced motion; disabled checkout; no runtime exceptions or production API/state-changing requests. |
| Motion fallback follow-up | **2/2 passed** | No `IntersectionObserver` means static presentation; reduced-motion pause control is disabled and announces the actual paused state. |
| Accessibility | **Zero axe WCAG 2.1 A/AA violations** | Automated scan, not a comprehensive assistive-technology certification. Decorative numeric labels are hidden only by the marketing skin so visible domain labels match accessible names. |
| Public HTML/metadata | Passed local checks | Meaningful 2,381-character no-JS public fallback, matching 158-character description/OG/Twitter descriptions, canonical public URL, four valid JSON-LD objects, existing robots/sitemap/private-route exclusions and genuine existing brand social image. No fabricated ratings, offers or operational screenshot schema. |
| Route declarations | 219 local preview paths checked | Existing literal page routes covered, `/404` excluded; HTTP 200 JSON verified. The file is local-only and removed from the tracked marketing diff to avoid an add/add collision with PR #108. No routes or navigation categories were added. |
| Source boundaries | Unchanged | Shared contracts, core topology/adapter, providers, canonical calculations, auth implementation, entitlements, MembershipOffer, pricing/billing handlers, database migrations, Railway and schedule configuration. |

The public-root `App.tsx` presentation skips only the marketing cinematic and renders public marketing during the existing session lookup. The authenticated redirect to `CANONICAL_HOME`, direct product onboarding and protected-product authentication gates remain unchanged. No cookies, session policy, registration or checkout behavior was changed.

## Performance: open acceptance issue

Mobile Lighthouse on the **isolated static production frontend**, using the existing Sandbox Chrome and simulated mobile throttling:

| Metric | Measured result |
|---|---:|
| Performance | **48/100** |
| Accessibility | **100/100** |
| Best Practices | **79/100** |
| SEO | **100/100** |
| First Contentful Paint | 4.5 s |
| Largest Contentful Paint | **6.3 s** |
| Total Blocking Time | **761 ms** |
| Cumulative Layout Shift | **0** |

This does **not** meet the requested strong mobile performance standard. These are sandbox lab measurements, not production field Core Web Vitals. Startup includes the inherited large shared SPA bundles; render-blocking CSS/font loading also contributes. The new hero avoids photographic background downloads, timed counters, fabricated animation state, canvas/WebGL loops and new runtime dependencies. Best Practices is additionally affected by expected API JSON errors in the deliberately backend-disconnected static preview. Missing backend data is never replaced by demonstration market evidence.

Do not solve this by changing canonical calculations, auth or production providers in the marketing workstream. A bounded shared-SPA startup/performance remediation and a fresh production-build audit are required before release acceptance. No production performance claim is made.

## Screenshot and claim status

All five gallery entries remain **TEMPORARY DESIGN PLACEHOLDER / VERIFIED CAPTURE PENDING**. No operational application screenshot is admitted. The existing remote design capture pack is documented as fictional fixture evidence and was not reused. Social, insider, track-record, performance, early-warning accuracy, adoption and user-count claims were not added. See `SCREENSHOT_EVIDENCE.md` for source findings and promotion requirements.

The six-domain visualization consumes `createUnavailableCore`: null Pressure Index, unavailable domain observations and no supported relationships. Organization-line dash motion and lighting are illustrative only. No live source state, simulated propagation or inferred causal relationship is presented. Educational explanations explicitly acknowledge missing observations, developing-since dates and historical comparisons. Genuine public Pressure Index source/timestamp/freshness handling remains separate and unchanged.

## Preserved membership and guest controls

Standard remains **$99/month**; Lifetime remains **$1,500 one-time**. The two existing checkout controls remain disabled; the existing no-charge and Lifetime terms/final-sale notices remain present. No registration, checkout, payment processing, guest entitlement or billing flag is enabled. Main exploration uses the existing limited public `/pressure-index` route, not private product data or a broadened demo entry. Existing consent-aware analytics are retained; new hero exploration uses the existing event function.

## Integration and isolation

Non-mutating `git merge-tree --write-tree` checks are run against the exact heads in `source-identities.json`; no integration PR is merged or cherry-picked. An initial add/add collision on `client/public/manus-routes.json` with PR #108 was corrected by removing that preview artifact from the tracked marketing diff. The local preview file remains available, but the final branch does not own it. `pnpm-workspace.yaml` matches PR #107 byte-for-byte and causes no conflict. Final per-PR outputs are attached to the review record.

These checks establish textual mergeability at the checked PR heads, not semantic integration readiness or permission to merge. Concurrent PR changes require the release owner to refresh the checks later.

## Remaining launch-readiness dependencies

1. Independently qualify operational candidate behavior and source integrity, then produce sanitized, dated captures with source branch/SHA and actual observation classification. Keep placeholders until that evidence is admitted.
2. Complete the separate PR #107 canonical-visual activation review, PR #106 live-signal/session readiness and PR #108 navigation integration. Refresh the marketing interpretation and capture record only after those approvals; no marketing visual constitutes activation proof.
3. Remediate mobile SPA startup/performance and rerun a production-build lab check. Field Core Web Vitals remain unmeasured for this undeployed branch.
4. Run the three baseline integration suites in an authorized nonproduction environment with the required local MariaDB binaries. Do not point them at production or weaken tests.
5. Independent release-owner review and explicit authorization before any merge/deploy or existing checkout/registration-control change.

## Reproduction

Install the existing locked dependency set with pinned `pnpm@10.4.1` (`--frozen-lockfile`), retaining the reviewed lifecycle policy. The old npm lockfile is out of sync with the existing `xlsx` dependency; it was not regenerated. Required esbuild/Tailwind consuming tools build successfully; no new application dependencies or lockfile versions are introduced.

Run `npm run check`, `npm run build`, and the nine focused Vitest files listed above. `scripts/verify-marketing-preview.py` connects to the existing sandbox browser on CDP port 9222 and a frontend-only local Vite preview on port 3000. It never launches another browser, uses production API/DB credentials, logs in, performs checkout or supplies market fixtures. Optional axe tools and Lighthouse are installed outside the repository. The local preview intentionally has no backend.

The preview images in `previews/` are sanitized layout captures of this isolated marketing candidate. They are not operational product screenshots, launch proof or a published website.
