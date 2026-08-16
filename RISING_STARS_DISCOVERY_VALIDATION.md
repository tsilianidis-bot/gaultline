# Rising Stars Discovery Validation Notes

## Development preview — 2026-08-15

The standalone `/app/rising-stars` route rendered through the application shell without a client-side crash. The page correctly displayed its public-market eligibility disclaimer and loading state while the source-backed discovery aggregation was pending. The initial viewport showed no fabricated values or empty cards. Further validation must wait for the provider-backed aggregation response and include filter interaction plus authenticated production acceptance testing.

## Development preview — source-backed render

The bounded endpoint subsequently returned verified public-company records using approved major-exchange metadata. The preview rendered a complete company card with exchange, market-cap category, listing date, public-market stage, sector, industry, delayed-market-data timestamp, source description, canonical score, primary catalyst, and key risk. The combined filtering controls rendered with explicit active options and no synthetic zero values. The visual test confirms the layout fits a desktop viewport; production/mobile acceptance remains outstanding.

## Production route — 2026-08-15

URL tested: `https://getfaultline.live/app/rising-stars`.

The live URL rendered and returned source-backed original Rising Stars cards for IONQ, PLTR, CRWD, SOFI, and RKLB, but it did **not** display the newly deployed public-market discovery header, top-level filters, advanced filters, or enriched company cards from checkpoint `b18d4c85`. The rendered page identified itself as a `dev` build, indicating that production was still serving an earlier frontend bundle or a cached/older deployment route at the time of the check. This is a deployment/cache verification discrepancy, not a source-code failure; the local preview showed the upgraded discovery interface.

Response inspection confirmed that the production HTML was served with `Cache-Control: no-cache, no-store, must-revalidate`, while referencing `/assets/index-tQbWM4ff.js`. A cache-busting query did not change the served interface. This rules out an ordinary browser-cache issue and points to an earlier deployment artifact still attached to the domain or an incomplete production publish.
