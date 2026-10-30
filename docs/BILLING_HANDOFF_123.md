# Billing handoff for PR #123

Draft for Manus. This file does not approve a merge, a deploy, or a production migration. Checkout stays off (`CHECKOUT_ENABLED` is false). Stripe live mode stays fail-closed unless `FAULTLINE_STRIPE_LAUNCH_AUTHORIZED=true`.

## SHA

Branch `cursor/stripe-refund-dispute-entitlement-2996`. Parent of the promo-code fix is `f2a193de966462a3932a3becd69324a14fb33a32`. The handoff SHA is the commit that contains this file (`git rev-parse HEAD` on that branch).

PR #123 is a draft into `cursor/faultline-rc-2026-10-28-4018`. That branch is the head of draft PR #121, which targets `release/verified-2026-10-22`. Merge #123 into the RC branch first so #121 carries this webhook. Do not merge #123 to `main` ahead of #121.

## Prices (code only, unchanged)

`shared/tiers.ts` is the source. `server/stripe/products.ts` copies `amountCents`.

| Plan | Code | Amount | Interval | On sale |
| --- | --- | --- | --- | --- |
| Standard (`premium`) | `PRICING_PLANS.premium` | 9900 cents, `$99/month` | `month` | available |
| Lifetime (`lifetime`) | `PRICING_PLANS.lifetime` | 150000 cents, `$1,500 one-time` | `one_time` | available |

No mismatch between those two files. A promotion code can lower the Checkout `amount_total` while the Stripe Price `unit_amount` stays 150000. `verifyStripePlanConfiguration` still requires the Price object to match the list amount. This repo has no Stripe price IDs in the environment, so the Dashboard prices were not read.

## Env and config

Test mode only. A live key is ignored unless `FAULTLINE_STRIPE_LAUNCH_AUTHORIZED=true`.

| Variable | Role |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_...` only until launch is authorized |
| `STRIPE_WEBHOOK_SECRET` | signing secret for `/api/stripe/webhook` |
| `STRIPE_PREMIUM_PRICE_ID` | Standard $99/month Price |
| `STRIPE_LIFETIME_PRICE_ID` | Lifetime $1,500 one-time Price |
| `STRIPE_CORE_PRICE_ID` | optional, not on the public Standard offer |
| `STRIPE_CORE_ANNUAL_PRICE_ID` | unused for sale |
| `STRIPE_PREMIUM_ANNUAL_PRICE_ID` | unused for sale |
| `STRIPE_FOUNDING_PRICE_ID` | unused for sale |
| `DATABASE_URL` | MariaDB. Boot refuses to listen if 0074–0077 objects are missing |
| `FAULTLINE_STRIPE_LAUNCH_AUTHORIZED` | must stay unset or not `true` |

API version pinned in `server/stripe/client.ts`: `2026-04-22.dahlia`. `Charge.invoice` is not used. Subscription invoices come from InvoicePayment.

## Migration 0077

File: `drizzle/0077_stripe_purchase_revocations.sql`. Not in the Drizzle journal. Not applied by this PR. Do not run it on production from this handoff.

Apply order on a backup, after the earlier entitlement files the boot gate names:

1. `drizzle/0074_stripe_entitlement_resync.sql` (`users.accessExpiresAt`, `users.entitlementRevision`, `stripeSubscriptionCancellations`)
2. `drizzle/0075_pentagonal_thesis_records.sql`
3. `drizzle/0076_algorithm_outcome_fk_name.sql`
4. `drizzle/0077_stripe_purchase_revocations.sql`

0077 adds `users.lifetimePaymentIntentId`, `entitlementAuditLog.sourceEventCreated`, and `stripePurchaseRevocations`. Every statement uses `IF NOT EXISTS`. It does not drop or rewrite columns. The boot gate in `server/schemaGate.ts` refuses to start until those objects exist.

## Webhook

Endpoint: `POST /api/stripe/webhook` (`server/_core/index.ts`). Body must be the raw JSON Stripe signs. Enable these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

Other `checkout.session.*`, `customer.subscription.*`, `invoice.*`, and `payment_intent.*` events are accepted and recomputed. Unlisted event types are acknowledged and do not change access.

## Smoke checklist

All of this is mocked in CI. A real test-mode pass needs the env vars above and a disposable database.

- Bad signature returns 400 and does not write access.
- Duplicate `event.id` returns 200 and does not write again.
- `checkout.session.completed` for Standard grants premium only when the subscription read shows a paid period.
- Lifetime grant requires a verified PaymentIntent (`succeeded` and `amount_received` > 0). `no_payment_required` does not grant.
- A Lifetime session with `amount_total` below $1,500 still links on `plan_id=lifetime` and mode `payment`.
- Full refund of the current Standard invoice removes Standard. A partial refund does not.
- Full refund of Lifetime removes Lifetime and leaves an active Standard subscription in place.
- `charge.dispute.created` removes the linked purchase. `won` restores it when no other revocation is active. `lost` keeps it removed.
- An older event does not clear a newer cancellation marker.
- An unknown price id does not grant access and does not seal the claim.
- Stripe or database errors return 500. Grant events with no user return 500. Charge events with no user return 200 and a `BILLING-ALERT` log.

## Rollback

Redeploy the previous application SHA. Do not drop 0077 columns or `stripePurchaseRevocations` as part of rollback. The migration is additive. A build that selects `lifetimePaymentIntentId` will not boot if 0077 was never applied. A build from before that column was selected can boot with the column left in place.

## Owner decisions (current default)

These are implemented defaults, not a separate product sign-off.

- Partial refund: audit only. Access stays.
- Full Standard refund during a paid period: access drops immediately. It does not run to period end.
- Dispute `lost` or `charge_refunded` after a `won` restore: the newer close removes access again. An older close does not.
- Unknown dispute close status: 200, no entitlement change, no Stripe retry.
- Customer charge with amount > 0 and an empty InvoicePayment lookup: 500 until the invoice can be linked or the charge matches Lifetime another way.
- Promotion-priced Lifetime: the checkout session match revokes and restores. A charge-metadata match still requires the $1,500 list amount.
