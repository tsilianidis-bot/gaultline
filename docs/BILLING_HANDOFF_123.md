# Billing integration handoff (for the release owner / Manus)

Integration proceeds only with James's explicit approval. This file does not approve a merge, a deploy, or a production migration. Checkout stays off (`CHECKOUT_ENABLED` is false). Stripe live mode stays fail-closed unless `FAULTLINE_STRIPE_LAUNCH_AUTHORIZED=true`.

## SHA

Code review is a GO at `ae366a1376216b38ba9049398447a620c442c7b8` on `cursor/stripe-refund-dispute-entitlement-2996`. Billing behavior is `efa08cb8cf78731bf0ea3b0f0c6622c900b4fb5c`. This docs pass is the commit that updates this file. Confirm `git rev-parse HEAD` before using it.

PR #123 is a draft into `cursor/faultline-rc-2026-10-28-4018`, the head of draft PR #121 (`release/verified-2026-10-22`). Merging #123 into RC #121 requires James's explicit approval. Do not merge #123 to `main` ahead of #121.

## Prices (code only, unchanged)

`shared/tiers.ts` is the source. `server/stripe/products.ts` copies `amountCents`.

| Plan | Code | Amount | Interval | On sale |
| --- | --- | --- | --- | --- |
| Standard (`premium`) | `PRICING_PLANS.premium` | 9900 cents, `$99/month` | `month` | available |
| Lifetime (`lifetime`) | `PRICING_PLANS.lifetime` | 150000 cents, `$1,500 one-time` | `one_time` | available |

No mismatch between those two files. `verifyStripePlanConfiguration` still requires the Stripe Price `unit_amount` to match the list amount. This repo has no Stripe price IDs in the environment, so the Dashboard prices were not read.

Checkout sends `allow_promotion_codes: true` (`server/routers/billing.ts`), so a customer can enter a code and `amount_total` can be below the list price. The repo and env do not define any promotion code or coupon id. Whether any promotion codes exist in the Stripe account is unknown. A Dashboard check is required.

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

## Migration 0074–0077

Not applied by this PR. Not applied by boot. The release owner applies them on a fresh backup, in this order, only with James's approval:

1. `drizzle/0074_stripe_entitlement_resync.sql` (`users.accessExpiresAt`, `users.entitlementRevision`, `stripeSubscriptionCancellations`)
2. `drizzle/0075_pentagonal_thesis_records.sql`
3. `drizzle/0076_algorithm_outcome_fk_name.sql`
4. `drizzle/0077_stripe_purchase_revocations.sql`

0077 is not in the Drizzle journal. It adds `users.lifetimePaymentIntentId`, `entitlementAuditLog.sourceEventCreated`, and `stripePurchaseRevocations`. Every 0077 statement uses `IF NOT EXISTS`. It does not drop or rewrite columns. The boot gate in `server/schemaGate.ts` refuses to start until those objects exist.

**0076 write pause.** `0076` can delete `algorithmOutcomeObservations` rows whose `provenanceId` is missing, then drop an old foreign key and add `algo_outcome_prov_fk`. Pause writes to `algorithmOutcomeObservations` and `algorithmScoreProvenance` before running it. A write during that window can insert a new orphan after the delete and make the new foreign key fail. Run it only on the fresh backup, with James's approval.

## Webhook

Endpoint: `POST /api/stripe/webhook` (`server/_core/index.ts`). Body must be the raw JSON Stripe signs.

Pinned API version in `server/stripe/client.ts`: **2026-04-22.dahlia**. `Charge.invoice` is absent in that version. Subscription invoices come from InvoicePayment.

Enable these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded` — needs James's approval
- `charge.dispute.created` — needs James's approval
- `charge.dispute.closed` — needs James's approval

Other `checkout.session.*`, `customer.subscription.*`, `invoice.*`, and `payment_intent.*` events are accepted and recomputed. Unlisted event types are acknowledged and do not change access.

## Alerting

`[BILLING-ALERT]` logs and unknown `charge.dispute.closed` statuses: Grok, the billing owner, investigates. The release owner wires alerting. An unknown close returns 200, does not change access, and does not ask Stripe to retry.

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

## OPEN DECISIONS FOR JAMES

These are the current code defaults. They are not approved.

- A dispute opening revokes the linked purchase immediately.
- A Standard full refund cuts access at once, including mid-period. Access does not run to period end.
- A Lifetime refund removes Lifetime entirely. An active Standard subscription is left in place.
- A partial refund keeps access. The event is audited and does not revoke.
- A lost dispute after a won restore removes access again when the lost close is newer. An older close does not.

Also still default, not signed off: an unknown dispute close returns 200 with no entitlement change. A customer charge with a positive amount and an empty InvoicePayment lookup returns 500 until it can be linked. A charge-metadata Lifetime match still requires the $1,500 list amount. The session match does not.
