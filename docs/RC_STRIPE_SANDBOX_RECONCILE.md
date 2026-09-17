# RC Stripe sandbox reconcile

**Branch:** `grok/faultline-baseline-stabilization-2026-09-11`  
**Policy:** document-first. Do **not** enable live mode. Do **not** change customer-facing amounts unless fixing a proven bug against an already-approved sandbox catalog. This RC makes **no commercial offer change**.

Approved public offer lives in `shared/tiers.ts` (`PRICING_PLANS` + `MARKETING_TIER_CARDS`). Checkout verification (`server/stripe/products.ts` `verifyStripePlanConfiguration`) requires Stripe `unit_amount`, currency, interval, and **product name** to match that file.

## Three sources that disagree

| Plan id | Access tier | Displayed offer (`shared/tiers.ts`) | Env price slot | Live-retrieve / live-lock test expectation | Entitlement if env ID matches `PLANS` |
| --- | --- | --- | --- | --- | --- |
| `core` | `core` (Trader) | **$59/mo** (`5900`), name `FAULTLINE Trader`, available | `STRIPE_CORE_PRICE_ID` | **$9.99/mo** (`999`), label “Core (Mobile)” / “Core $9.99/mo”, locked live id `price_1TcdXSDlVkahIFK8mqjKOpfB` | `core` |
| `premium` | `premium` (Power) | **$99/mo** (`9900`), name `FAULTLINE Power`, available | `STRIPE_PREMIUM_PRICE_ID` | **$59/mo** (`5900`), label “Trader (Premium)” / “Trader $59/mo”, locked live id `price_1TcdgGDlVkahIFK8QM0txjAB` | `premium` |
| `founding` | `founding` | **$49/mo** (`4900`), name `FAULTLINE Founding Member`, available | `STRIPE_FOUNDING_PRICE_ID` | **$49/mo** (`4900`) — amount matches; locked live id `price_1TcdgIDlVkahIFK8KwBlWrvW` | `founding` |
| `lifetime` | `founding` | **$299** one-time, **`available: false`** | `STRIPE_LIFETIME_PRICE_ID` | **$299** one-time; locked live id `price_1TcdgKDlVkahIFK855FfdepH` | `founding` if webhook sees the ID |
| `core_annual` | `core` | `amountCents: 0`, unavailable | `STRIPE_CORE_ANNUAL_PRICE_ID` | not in the four-ID suites | `core` if configured |
| `premium_annual` | `premium` | `amountCents: 0`, unavailable | `STRIPE_PREMIUM_ANNUAL_PRICE_ID` | not in the four-ID suites | `premium` if configured |

## Inconsistencies (do not “fix” by silently editing the offer)

1. **Core vs Trader amount.** Tests and `RESTORE.md` still describe Core/Mobile at **$9.99**. Canonical UI/entitlement amount is **Trader $59**. Injecting the locked live Core ID into sandbox checkout will fail `unit_amount === 5900`.
2. **Premium vs Power amount.** Tests treat `STRIPE_PREMIUM_PRICE_ID` as **Trader $59**. Canonical offer is **Power $99**. Same checkout-verification failure if the live $59 price is attached to `premium`.
3. **Name lock.** Verification also requires Stripe product `name === plan.name` (`FAULTLINE Trader` / `FAULTLINE Power` / `FAULTLINE Founding Member`). Legacy “FAULTLINE Core” / “FAULTLINE Pro” products fail closed.
4. **Lifetime.** Amount matches ($299) but public `available: false`. Checkout should stay closed even if a sandbox ID exists.
5. **Annuals.** Displayed as unavailable / $0. No sandbox IDs should be sold.
6. **Entitlement test map** (`server/stripeEntitlement.test.ts`) uses synthetic IDs (`price_core_monthly`, …). Production webhook uses `getPlanByPriceId` → env IDs. Dummy map is **MOCKED** and not a catalog source.
7. **Naming drift.** Env `STRIPE_CORE_*` means access tier `core` / marketing **Trader**, not the obsolete $9.99 “Core Mobile” SKU.

## Recommended **sandbox** ID mapping (owner creates IDs)

Do not invent `price_` values in git. Owner creates **test-mode** (`sk_test_`) prices that match `shared/tiers.ts`, then sets env on the preview only:

| Env | Test-mode Stripe price to create | Must match |
| --- | --- | --- |
| `STRIPE_CORE_PRICE_ID` | Recurring USD **5900** / month | Product name `FAULTLINE Trader` |
| `STRIPE_PREMIUM_PRICE_ID` | Recurring USD **9900** / month | Product name `FAULTLINE Power` |
| `STRIPE_FOUNDING_PRICE_ID` | Recurring USD **4900** / month | Product name `FAULTLINE Founding Member` |
| `STRIPE_LIFETIME_PRICE_ID` | One-time USD **29900** (optional; keep unsold) | Product name `FAULTLINE Founding Lifetime (Legacy)` |
| `STRIPE_CORE_ANNUAL_PRICE_ID` | unset | — |
| `STRIPE_PREMIUM_ANNUAL_PRICE_ID` | unset | — |
| `STRIPE_SECRET_KEY` | `sk_test_…` only | never `sk_live_` on this RC |
| `STRIPE_SKIP_VERIFICATION` | `false` | fail closed if mismatch |

After IDs exist, `pnpm test server/stripe.prices.test.ts` will unskip the **shape** cases. Retrieve cases stay skipped on `sk_test_`. `stripe.live-prices.test.ts` must **remain skipped** (or be rewritten later) because it asserts the **live** $9.99/$59 ID quartet — that lock is not the approved sandbox catalog.

## Code vs document

| Change | This RC |
| --- | --- |
| `shared/tiers.ts` amounts / availability | **unchanged** (approved offer) |
| Live mode / live price IDs in env | **not set** |
| Checkout verification | **unchanged** (already fail-closed on mismatch) |
| Customer-facing copy | **unchanged** |

No silent commercial fix. Owner maps sandbox prices to the table above when checkout is to be re-verified in test mode.

## Related

- `server/stripe/products.ts` — env → plan + `verifyStripePlanConfiguration`
- `server/publicPricingRepair.test.ts` — locks $59 / $99 / $49 and no `$9.99` on marketing
- `docs/RC_SKIPPED_TESTS_AUDIT.md` — why Stripe suites stay skipped
