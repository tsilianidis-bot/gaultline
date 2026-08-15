# Daily Brief and Rising Stars Repair Audit

## Browser validation record

On 2026-08-15, the development preview was opened at `/app/signals?view=rising-stars`. The unauthenticated browser session was intercepted by the product's guided ASHA introduction before the protected Signals content mounted. This confirms the route resolves through the active application shell, but it does **not** replace authenticated acceptance testing of the final Rising Stars view.

The repair therefore validates the Signals route through source inspection, targeted syntax checks, API-contract checks, and unit tests. The implemented view now has explicit loading, valid-result, genuine-empty, and error/retry states; it no longer silently omits Rising Stars because the page had no render branch.

## Confirmed root causes

| Surface | Root cause | Safe correction |
|---|---|---|
| Daily Brief | The publishing pipeline stored a fresh direct Pressure Engine value in article metadata while generating the body from a separate cached Seismograph snapshot. No shared snapshot identifier or validation linked the two. | Build, persist, validate, and link one immutable `dailyBriefSnapshots` record per generated Daily Brief. |
| Signals → Rising Stars | The backend contract was available through Opportunity Discovery, but the actual `Signals.tsx` view had no Rising Stars tab, query, or render branch. | Mount the source-backed contract in Signals with explicit loading, valid-result, genuine-empty, and controlled error states. |

## Known validation boundary

The unauthenticated preview cannot verify subscription-entitlement rendering. This repair does not bypass entitlements or replace the existing authorization model. On 2026-08-15, the production route `https://getfaultline.live/app/signals?view=rising-stars` was also opened through the connected browser flow. That browser session still presented the public sign-in and guided-introduction states rather than an authenticated application session, so protected desktop/mobile rendering cannot be claimed from that session.

The source-backed backend contract returned HTTP 200 with ranked Rising Stars and explicit component availability fields in the development environment. Full regression and targeted contract tests passed. An authenticated FAULTLINE account should complete the final production visual acceptance pass after the new checkpoint is live.

The connected-browser production attempt subsequently redirected to the Manus OAuth sign-in endpoint and received a CloudFront `403` response before authentication could complete. This is an external authentication-delivery failure, not a Rising Stars rendering response, and no subscription or access behavior was changed to work around it.

After checkpoint `0d96c5c3` published, the live `/app/signals?view=rising-stars` route resolved through the active FAULTLINE shell and began the guided introduction. The public guided-introduction state transitions rapidly enough that the automated browser could not reliably target the transient Skip control, so the protected panel still cannot be visually accepted without an authenticated user session. Route resolution itself was confirmed; endpoint, unit, and full-suite validation remain the reliable evidence for the data/render contract.
