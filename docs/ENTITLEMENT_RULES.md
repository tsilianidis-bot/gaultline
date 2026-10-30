# Entitlement rules

This is the lifecycle `server/stripe/entitlementSync.ts`, `server/stripe/webhook.ts`, and `commitEntitlementResync` implement. Webhooks do not patch access from a single event body. Each relevant event identifies the user, records a cancellation if the event is one, then recomputes access from current Stripe state plus the markers below.

`drizzle/0074_stripe_entitlement_resync.sql` adds `users.accessExpiresAt`, `users.entitlementRevision`, and `stripeSubscriptionCancellations` (including `supersededEventCreated`). That migration is **not applied** by this change.

## States

| State | Meaning |
| --- | --- |
| free | No entitled subscription and no lifetime flag. |
| core, premium, founding | Stored tier while `accessExpiresAt` is null or in the future, and `lifetimeAccess` is false. |
| lifetime | `lifetimeAccess` is true. The effective tier is founding. Expiry and stored tier do not reduce it. |

`effectiveTier` is the only tier used for gates (watchlist cap, Ask Intelligence, share links, mobile limits, admin display, `getUserTier`).

## Inputs

1. Subscription list for the customer (`status=all`, paginated, `latest_invoice` expanded), plus one corroborating retrieve of the winning subscription.
2. Period bounds. API `2026-04-22.dahlia` puts `current_period_start` / `current_period_end` on subscription items. All items that have a period must agree. If no item has a period, fall back to the subscription fields, then `trial_end`. Disagreement is `inconsistent_period` and is not sealed.
3. Cancellation markers, one row per subscription. `canceledEventCreated` only moves forward. `supersededEventCreated` records a corroborated resume newer than the marker. A newer cancellation clears the supersession.
4. Verified lifetime checkout: `plan_id=lifetime`, mode `payment`, `payment_status=paid`, `amount_total>0`, expanded PaymentIntent `succeeded` with `amount_received > 0`. `amount` is not a substitute.
5. Stored `lifetimeAccess` and `entitlementRevision` on the user row.
6. Admin `setUserTier`.

## Precedence

1. **Lifetime.** Stored or newly verified lifetime forces effective founding. A subscription event cannot clear it. If no subscription entitles, `stripeSubscriptionId` is cleared and founding remains. An unverified or zero-amount lifetime checkout does not grant lifetime.
2. **Cancellation marker.** An entitling subscription (active paid/coupon/credit, or trialing, not paused) conflicts as `stale_active_after_cancellation` when its renewal evidence is missing or not newer than `canceledEventCreated`. Renewal evidence is the current period start, or the invoice's own `period_start` when that invoice has `paid_at` and the period start is at least the subscription period start. `invoice.created`, `start_date`, and `paid_at` itself do not outrank a marker. A corroborated resume can still supersede. A marker that has been superseded no longer blocks. `canceledEventCreated` is a BIGINT unix second so it stays valid past 2038.
3. **Corroborated resume.** `customer.subscription.updated` with status `active` or `trialing`, `pause_collection` clear, and `event.created` newer than the marker may restore the same period. The list and the retrieve must both show the subscription entitled and unpaused. The apply sets `supersededEventCreated` in the same transaction. `invoice.paid` is not resume evidence.
4. **Entitled subscription.** Known price, consistent period end in the future, payment accepted, list and retrieve agree on status, pause, period end, invoice id, and price ids. The tier is the highest entitled price on the subscription, not the first item. An unknown price on any item is unresolved: the claim is left unfinished (not acknowledged) so Stripe retries, and a cancellation marker already written on that event is kept. A price mismatch between the list and the retrieve is `read_disagreement` and is not sealed.
5. **Otherwise free.**

### Invoice payment

For an active subscription the latest invoice must be expanded and `paid`:

- `amount_paid > 0` renews.
- A discount, including a 100% coupon (`amount_paid` 0 and `total` 0), renews and sets the period end.
- `amount_paid === 0` and `total > 0` with no discount is customer credit and renews.
- `amount_paid === 0` and `total === 0` with no discount does not renew and is not a lifetime purchase.
- Trialing renews without a charge and still needs a period end.
- `paused`, `pause_collection`, and terminal statuses do not entitle.

## Identity

Resolve the user by Stripe customer id, then metadata `user_id` on the checkout session, subscription, or invoice (`parent.subscription_details.metadata` included), then checkout `client_reference_id`. A successful resync stores `users.stripeCustomerId` only when that column is empty or already equal to the event customer. A different non-empty stored customer is `customer_conflict`: the user row is not changed, the claim is not sealed, and an audit row records the event. The handler returns 500. Checkout reuses `customer: storedStripeCustomerId` when one is stored (and does not also send `customer_email`). Subscription checkout copies `user_id` onto `subscription_data.metadata`. If no user can be resolved, the handler returns 500 and releases the claim. It does not acknowledge the event.

## Commit invariants

- The handler samples `entitlementRevision` before the Stripe reads and again after. If it moved, that snapshot is discarded.
- `commitEntitlementResync` locks the claim, the user, and the marker rows. If the revision or the markers differ from the snapshot, it returns `stale_state` and does not write or seal. The handler recomputes once when the read budget allows, otherwise it returns 500 without sealing.
- A zero-row user update throws and does not seal.
- The claim fence is the attempt id inside `eventType`. A lost fence returns 500 and does not release the current attempt's row.
- Webhook Stripe reads are capped at 6, each with a 4s timeout and one network retry. Worst-case budget is 54s, under the 90s reclaim window. The shared Stripe client does not set `maxNetworkRetries` to 0.
- Duplicate finished events return 200 without reading Stripe. An unfinished claim inside the reclaim window returns 500. After 90s exactly one delivery can reclaim it.

## Admin

`setUserTier(userId, tier, lifetimeAccess?)`:

- `lifetimeAccess: true` sets the flag. Effective tier is founding.
- `lifetimeAccess: false`, or tier `free` with the flag omitted, clears the flag.
- A paid tier with the flag omitted leaves an existing lifetime purchase in place.
- The admin list returns `effectiveTier` as well as the stored `accessTier`. The users screen highlights and badges the effective tier. Choosing free, core, or premium passes `lifetimeAccess: false` so the effective tier matches the control. Choosing founding does not strip a lifetime purchase.

## Refunds and disputes

`charge.refunded`, `charge.dispute.created`, and `charge.dispute.closed` use the same claim fence, revision compare, and audit log. Each processed event writes one `entitlementAuditLog` row with the Stripe event id, `event.created` (`sourceEventCreated`, unix seconds), and a reason.

A charge is the Lifetime purchase only when its PaymentIntent is the Lifetime checkout (`plan_id=lifetime`, mode `payment`, amount $1,500), the charge itself carries that plan and amount, or `users.lifetimePaymentIntentId` is that PaymentIntent. A charge is a subscription purchase when an InvoicePayment for its PaymentIntent names an invoice and the amount is positive. API version `2026-04-22.dahlia` does not include `Charge.invoice`. The public Standard price is $99/month. An unrelated charge, including a different amount with no invoice payment and no Lifetime PaymentIntent, does not revoke Lifetime or a 100% coupon renewal.

Lifetime checkout with no stored customer sends `customer_email` only, so the charge often has no customer. The handler resolves that user from `checkout.sessions.list({ payment_intent })` and, if the session has no user id, from `users.lifetimePaymentIntentId`.

- A full refund (`refunded` or `amount_refunded >= amount`, amount > 0) revokes that purchase only. A partial refund writes the audit row and does not revoke. A zero-amount charge does not revoke.
- `charge.dispute.created` revokes that purchase. `charge.dispute.closed` with `won` clears that dispute when its source timestamp is newer, and also when the win shares the opening event's second. `lost` and `charge_refunded` keep it revoked. `warning_closed` and `prevented` do not revoke. Any other close status is acknowledged and logged without an entitlement change.
- Won restores access only when no other revocation reason is still active. A full refund on the same purchase stays in force. A cancellation marker is unchanged. A newer paid invoice is a different purchase and stays entitled. A stale event cannot clear a revocation. A same-second win does clear the opening, and the opening cannot re-revoke that win. An older event cannot revoke a newer one.
- An unrelated or unresolvable event (no user, no customer, unknown dispute status, missing charge) is acknowledged with 200 and logged. Stripe and database failures still return 500 so they can be retried.
- Rows live in `stripePurchaseRevocations`, one per purchase and reason, so a dispute and a refund do not overwrite each other. The commit locks them with the user row. A mismatch is `stale_state` and is not sealed.
- Stored lifetime is cleared only when its `lifetimePaymentIntentId` is revoked, or when a legacy row has no PaymentIntent and every Lifetime checkout session we can see is revoked. An admin grant has no Lifetime session and stays, even if another PaymentIntent is revoked. A newer stored PaymentIntent that is not revoked keeps access.

`drizzle/0077_stripe_purchase_revocations.sql` adds `users.lifetimePaymentIntentId`, `entitlementAuditLog.sourceEventCreated`, and `stripePurchaseRevocations`. Each statement uses `IF NOT EXISTS`. It is additive. It is not applied by this change. The boot gate refuses to start until it has been applied on a backup.

## What this does not do

Checkout prices, checkout enablement, and PLATO are unchanged. No migration is applied. No live Stripe object is modified. Billing, registration, and checkout stay off.
