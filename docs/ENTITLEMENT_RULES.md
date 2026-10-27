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
4. Verified lifetime checkout: `plan_id=lifetime`, mode `payment`, `payment_status=paid`, `amount_total>0`, expanded PaymentIntent `succeeded` with amount received > 0.
5. Stored `lifetimeAccess` and `entitlementRevision` on the user row.
6. Admin `setUserTier`.

## Precedence

1. **Lifetime.** Stored or newly verified lifetime forces effective founding. A subscription event cannot clear it. If no subscription entitles, `stripeSubscriptionId` is cleared and founding remains. An unverified or zero-amount lifetime checkout does not grant lifetime.
2. **Cancellation marker.** An entitling subscription (active paid/coupon/credit, or trialing, not paused) whose own timestamps are missing or not newer than `canceledEventCreated` conflicts as `stale_active_after_cancellation`. That conflict is not sealed, so a stale `active` list cannot erase the marker. A marker that has been superseded no longer blocks.
3. **Corroborated resume.** `customer.subscription.updated` with status `active` or `trialing`, `pause_collection` clear, and `event.created` newer than the marker may restore the same period. The list and the retrieve must both show the subscription entitled and unpaused. The apply sets `supersededEventCreated` in the same transaction. `invoice.paid` is not resume evidence.
4. **Entitled subscription.** Known price, consistent period end in the future, payment accepted, list and retrieve agree. Tier is the highest entitled price. Expiry is the period end. Unknown price is unresolved: the claim is left unfinished (not acknowledged) so Stripe retries, and a cancellation marker already written on that event is kept.
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

Resolve the user by Stripe customer id, then metadata `user_id` on the checkout session, subscription, or invoice (`parent.subscription_details.metadata` included), then checkout `client_reference_id`. A successful resync stores `users.stripeCustomerId` and does not clear it when a later decision omits it. If no user can be resolved, the handler returns 500 and releases the claim. It does not acknowledge the event.

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

## What this does not do

Checkout prices, checkout enablement, and PLATO are unchanged. No migration is applied. No live Stripe object is modified.
