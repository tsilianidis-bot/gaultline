# RC provider matrix (A–E)

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Policy:** never call a provider **working** solely because tests mock it. Default `pnpm test` is in-process. Live vendor proof is owner/env-gated.

## Legend

| Col | Meaning |
| --- | --- |
| **A** Shape / config present | Credential or public endpoint has a genuine shape (prefix/length/URL), in repo config or documented env. **No values printed.** |
| **B** Code consumer | Production code path that would call the vendor if env is injected. |
| **C** Verified live connection | A real outbound call succeeded recently in this RC (or a gated test ran against the vendor). |
| **D** Test posture | `MOCKED` / `ENV_GATED` / `VERIFIED_CONNECTION` / none. |
| **E** Reaches CURRENT product intelligence | Can the vendor’s data affect Champion CURRENT / EngineContext / Decision-Light / NOW-WHY-ACT? |

`WORKING` = A + B + **C**. A+B+D(mocked) is **not** working.

## Matrix

| Provider | A Shape | B Consumers | C Live verified on this RC? | D Tests | E CURRENT? | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **FRED** | Yes — 32-char opaque key slot `FRED_API_KEY` in platform secrets file (hex-like, not printed). | `fredClient.ts` → pressure engine, `/api/fred/bulk`, reconstructed/verified history, seismograph provenance. | **No** in this agent run. No FRED HTTP from CI. | Default suite uses fixtures / recorded shapes. No live FRED key test file. | **Yes — required.** `marketStateService` sourceHealth `fred` is required. Missing key → engine fail / UNAVAILABLE, not invented scores. | **CODED, NOT LIVE-PROVEN.** Do not stamp WORKING. |
| **Yahoo Finance** | N/A — no API key. Public `query1.finance.yahoo.com` chart + screener. | `yahooProxy.ts` (quotes/bars; Polygon fallback), `asymmetricOpportunities`, signals visual, decision ledger evaluator, sim portfolio. | **No** outbound in default CI. | Unit tests mock fetch or use local bars. | **Ticker / sim / outlook — not Champion Pressure.** Can still show “today” prices on CURRENT shells (Signals, Preflight, USI). | **CODED, NOT LIVE-PROVEN.** Scraped public API; brittle. |
| **Polygon** | Yes — 32-char opaque `POLYGON_API_KEY`. | Signals proxy, `routers.ts` / `routers/signals.ts`, `signalOutlook`, day-trade bars, X news monitor, Yahoo fallback. | **No.** `polygon.key.test.ts` skipped unless key in **process env**. This verify did not export it; 2 skips. | `ENV_GATED` + `VERIFIED_CONNECTION` (`/v2/aggs`). `signals.proxy` needs `RUN_INTEGRATION_TESTS`. | Ticker overlay / news; not Champion Pressure. | **CODED, NOT LIVE-PROVEN.** |
| **CoinGecko** | Yes — `CG-` prefix, length 27. | `registerCoinGeckoProxy`, `cryptoEngine`, sim portfolio, routers crypto. | **No.** `coingecko.key.test.ts` skipped; `/ping` also needs `RUN_INTEGRATION_TESTS=1`. | `ENV_GATED` + optional live ping. | Optional overlay. Canonical `coingecko` sourceHealth is **not required**. Crypto pages are still CURRENT chrome. | **CODED, NOT LIVE-PROVEN.** |
| **Manus Forge / LLM** | Yes — `BUILT_IN_FORGE_API_URL` is `https://` (len 22); API key opaque 22. Same pair as `VITE_FRONTEND_FORGE_*`. | `server/_core/llm.ts` (`/v1/chat/completions`, default host `forge.manus.im` if URL empty), heartbeat `CreateHeartbeatJob` via `BUILT_IN_FORGE_API_*`, OAuth `OAUTH_SERVER_URL`. | **No** LLM/Forge RPC from this verify. Heartbeat create/list not called. | LLM/ASHA tests use mocks or skip network. | LLM does **not** author Champion Pressure. Can write briefs, X copy, Oracle, weekly report, FMOS AI interpretation if jobs run. | **CODED, NOT LIVE-PROVEN.** Auth/OAuth still owner-blocked. |
| **Stripe** | Secret is **`sk_test_`** (not live). Publishable **`pk_test_`**. Four `price_` IDs (len 30) **equal the locked live-mode IDs** in `stripe.live-prices.test.ts`. Webhook `whsec_`. | `stripe/client.ts` (nullable), `products.ts` `verifyStripePlanConfiguration`, webhook, billing router. | **No live mode.** Smoke proved boot **without** `STRIPE_SECRET_KEY`. Retrieve cases require `sk_live_` and stay skipped. | Webhook/entitlement **mocked IDs**. Price retrieve **ENV_GATED**. | Billing/gates only — not market CURRENT. | **SANDBOX SHAPE ONLY.** Test key + live price IDs will fail checkout verify (`unit_amount` / product name vs `shared/tiers.ts`). **Not WORKING.** Do not enable `sk_live_`. |
| **SendGrid** | `SENDGRID_API_KEY` `SG.` len 69. Duplicate slot `Sendgrid` also `SG.` len 69 — **values are not equal** (two different keys). | `server/email.ts` / drip / publishing notify. | **No.** Live `/v3/user/account` is hard `it.skip` (known **401**). | Shape gated; live blocked. | Email only. | **SHAPE PRESENT, LIVE FAILED HISTORICALLY.** Not WORKING. Owner must replace key after offline verify. |
| **GSC (Google)** | `GOOGLE_CLIENT_ID` matches `*.apps.googleusercontent.com`. Secret opaque 35. | `routers/gsc.ts`, SEO optimizer OAuth. Redirect string in test mentions production domain (not deployed here). | **No** Google HTTP. | `ENV_GATED` local OAuth2 construct only. | SEO admin — not CURRENT market. | **CODED, NOT LIVE-PROVEN.** |
| **X (Twitter)** | Four slots: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` — opaque lengths 25/50/50/45. | `xPoster.ts` / `scheduledXPost.ts`. | **No** tweet posted. | `xPoster.test.ts` mocked. | Publishing only. | **CODED, NOT LIVE-PROVEN.** Cron fire is owner/Forge. |
| **Sentry** | **Absent** from platform secrets object. Code reads `SENTRY_DSN`. | `errorTracking.ts` lazy init; no-op logger if unset. | **No.** | No live Sentry test. | Observability only. | **NOT CONFIGURED.** App is designed to run without it. |
| **Analytics** | `VITE_ANALYTICS_ENDPOINT` `https://` len 27; website id UUID. First-party `/api/analytics/*` needs no vendor key. CSP allows Manus analytics, Umami, GA4, Clarity. | `analyticsRoutes.ts`, `analyticsCollector.ts`, admin `analyticsRouter`, client beacons. | First-party routes exist; **no** proof the third-party endpoint accepted events. | `internalAnalytics.test.ts` mocks `sendBeacon`. | Product analytics — not CURRENT market truth. | **FIRST-PARTY CODED.** Third-party **NOT LIVE-PROVEN.** |

## What default CI actually proved

| Claim | Evidence |
| --- | --- |
| App boots without Stripe | `scripts/ci-startup-smoke.sh` passed |
| Default suite green | 1913 passed / 44 skipped / 0 failed — skips are the vendor gates |
| No vendor marked WORKING from mocks | This matrix |

## Owner-only how to promote a row to WORKING

Do this on a **preview** (not getfaultline.live), with real secrets injected into **process env** (not by committing values):

1. FRED: one `fredClient` series 200 with `FRED_API_KEY`.
2. Polygon: `pnpm test server/polygon.key.test.ts` (prev-bar 200/429).
3. CoinGecko: `RUN_INTEGRATION_TESTS=1 pnpm test server/coingecko.key.test.ts`.
4. Stripe: create **test-mode** prices matching `shared/tiers.ts` (see `docs/RC_STRIPE_SANDBOX_RECONCILE.md`); never `sk_live_`.
5. SendGrid: replace key; unskip live account only after offline 200.
6. Forge/LLM: one `invokeLLM` or `listHeartbeatJobs` 200.
7. X / GSC: one authenticated vendor call.

## Related

- `docs/RC_SKIPPED_TESTS_AUDIT.md`
- `docs/RC_STRIPE_SANDBOX_RECONCILE.md`
- `docs/TEST_ENV_GATING.md`
- `docs/RC_PROJECT_CONFIG_SHAPES.md` (shapes only)
