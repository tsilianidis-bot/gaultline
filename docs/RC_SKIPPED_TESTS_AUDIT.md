# RC skipped-tests audit

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Baseline tip at audit start:** `10e579dbc1646b2336b41393268ac3faf3210433`  
**Default suite report (prior tip):** 1900 passed, **44 skipped**, 0 failed.

This note classifies each previously skipped suite. It does **not** invent credentials, enable live Stripe, or call vendor APIs from CI.

## Classification legend

| Class | Meaning |
| --- | --- |
| `ENV_GATED` | Vitest `skipIf` / `describe.skip` until an env flag or secret is present. Default `pnpm test` stays green. |
| `VERIFIED_CONNECTION` | A real outbound (or localhost server) call is required to *pass* the live assertion. Owner must supply a working secret and network. Not activated here. |
| `MOCKED` | Assertions use in-process fakes / synthetic inputs. No vendor object. |

A suite can be both `ENV_GATED` and `VERIFIED_CONNECTION`. None of the 44 skips are `MOCKED`. The always-on `qaAccess` rejection case is mocked and **not** in the skip count.

## Count (matches prior PR report)

| Suite | Skip count | Gate | Live call to pass? |
| --- | ---: | --- | --- |
| `server/signals.proxy.test.ts` | 20 | `RUN_INTEGRATION_TESTS` | `VERIFIED_CONNECTION` (dev server + Polygon) |
| `server/stripe.prices.test.ts` | 10 | four `STRIPE_*_PRICE_ID` + live-key retrieve | retrieve cases need `sk_live_` — **do not enable** |
| `server/stripe.live-prices.test.ts` | 6 | four `price_` IDs present | env lock only; no Stripe HTTP |
| `server/polygon.key.test.ts` | 2 | `POLYGON_API_KEY` | second case is live `/v2/aggs` |
| `server/sendgrid.key.test.ts` | 2 | `SENDGRID_API_KEY` | live `/v3/user/account` is **hard `it.skip`** (known 401) |
| `server/coingecko.key.test.ts` | 2 | `COINGECKO_API_KEY` | `/ping` also needs `RUN_INTEGRATION_TESTS=1` |
| `server/gsc.credentials.test.ts` | 1 | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | local OAuth client construct only |
| `server/qaAccess.test.ts` | 1 | `QA_ACCESS_SECRET` | local cookie issuance; no vendor |
| **Total** | **44** | | |

## Per-suite findings

### 1. `signals.proxy` — `ENV_GATED` + `VERIFIED_CONNECTION`

- Gate: file uses `describe.skip` unless `RUN_INTEGRATION_TESTS` is truthy.
- What it proves: `/api/signals/quotes`, `/health`, `/ticker/:symbol` contracts against a **running** `http://localhost:3000`.
- Extra deps (not mocked): live or cached Polygon quotes; `POLYGON_API_KEY` for the key-leak assertion.
- Not needed for canonical CURRENT pressure. This is ticker proxy QA.
- **Do not set `RUN_INTEGRATION_TESTS=1` in default CI.** Owner preview: start the app, inject Polygon, then run the focused file.
- Footgun: a file-level `beforeAll` used to hit localhost even when suites were skipped. The hook now returns immediately unless the integration flag is set.

### 2. `stripe.prices` — `ENV_GATED` (+ live retrieve = `VERIFIED_CONNECTION`)

- Outer `describe.skipIf` unless **all four** of `STRIPE_CORE_PRICE_ID`, `STRIPE_PREMIUM_PRICE_ID`, `STRIPE_FOUNDING_PRICE_ID`, `STRIPE_LIFETIME_PRICE_ID` start with `price_`.
- Five cases are shape/uniqueness only (no HTTP).
- Four retrieve cases: `it.skipIf` unless `STRIPE_SECRET_KEY` starts with `sk_live_`. They assert **live catalog amounts** (`$9.99` / `$59` / `$49` / `$299`) that **do not match** approved public `shared/tiers.ts` (`$59` / `$99` / `$49` / `$299`). See `docs/RC_STRIPE_SANDBOX_RECONCILE.md`.
- One test-mode-only archive check (`it.skipIf` when the key *is* live) hits hardcoded `price_1TcVgB7f3zM5dNdGb4acS3Mr`.
- **Sandbox recommendation:** leave this suite skipped. Do not inject `sk_live_`. Do not treat retrieve amounts as the commercial offer.

### 3. `stripe.live-prices` — `ENV_GATED` (not a live HTTP suite)

- Skips unless all four price IDs are set.
- Last case **locks exact live-mode IDs** (`price_1TcdXS…` / `price_1TcdgG…` / `price_1TcdgI…` / `price_1TcdgK…`) and labels Core as `$9.99`.
- Class: env lock, not `MOCKED`, not a Stripe API ping.
- Injecting those IDs into a **test-mode** sandbox would fail checkout verification (`unit_amount === plan.amount` from `tiers.ts`). Keep unset on this RC.

### 4. `polygon` — `ENV_GATED` + `VERIFIED_CONNECTION`

- Skips unless `POLYGON_API_KEY` is set.
- Case 1: key non-empty (local).
- Case 2: GET `api.polygon.io/v2/aggs/ticker/AAPL/prev` — 200 or 429 = valid key; 401/403 = fail.
- Owner-only. Not required for default RC green.

### 5. `sendgrid` — `ENV_GATED` + hard-skip live (`VERIFIED_CONNECTION` blocked)

- Skips unless `SENDGRID_API_KEY` is set.
- Case 1: key starts with `SG.` (shape).
- Case 2: `it.skip` — `/v3/user/account` previously returned **401**. Owner waived credential repair. Re-enable only after a replacement key is verified offline.
- No invented key. No live send.

### 6. `coingecko` — `ENV_GATED` + optional `VERIFIED_CONNECTION`

- Skips unless `COINGECKO_API_KEY` is set.
- Case 1: key starts with `CG-`.
- Case 2: `it.skipIf(!RUN_INTEGRATION_TESTS)` — Demo `/ping` with `x-cg-demo-api-key`.
- Owner: `RUN_INTEGRATION_TESTS=1 pnpm test server/coingecko.key.test.ts` after injecting a real Demo key.

### 7. `gsc` — `ENV_GATED` (no Google HTTP)

- Skips unless both Google OAuth client values are set.
- Constructs `google.auth.OAuth2` and checks `*.apps.googleusercontent.com`. Redirect is hardcoded to `https://getfaultline.live/app/seo-optimizer` (production domain string in test only — this RC does not deploy).
- Not `VERIFIED_CONNECTION`. Not `MOCKED`. Local client object only.

### 8. `qaAccess` — `ENV_GATED` (local secret)

- One case: `it.skipIf(!QA_ACCESS_SECRET)` issues the HttpOnly cookie against the **real** secret.
- Sibling case (always runs): rejects `"incorrect"` — `MOCKED` input, not in the 44.
- `qaAccessBoundary.test.ts` is fully mocked (QA principal) and is not skipped.

## What is *not* required for this RC

| Need | Suites | Action on this branch |
| --- | --- | --- |
| Verified Polygon + running server | signals.proxy, polygon | Leave gated |
| Verified Stripe **live** | stripe.prices retrieve, stripe.live-prices lock | **Do not activate** |
| Verified SendGrid | sendgrid live case | Remain `it.skip` until owner replaces key |
| Verified CoinGecko Demo | coingecko `/ping` | Leave gated |
| Google OAuth pair | gsc | Leave gated |
| Owner QA secret | qaAccess live cookie | Leave gated |

## Related

- Gate rule: `docs/TEST_ENV_GATING.md`
- Stripe amount vs ID map: `docs/RC_STRIPE_SANDBOX_RECONCILE.md`
