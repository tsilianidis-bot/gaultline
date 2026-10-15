import type { Request, Response } from 'express';
import { stripe } from './client';
import { ENV } from '../_core/env';
import { getPlanByPriceId } from './products';
import { updateUserStripe, getUserByStripeCustomerId, getUserTier, recordStripeWebhookEvent, releaseStripeWebhookEvent, writeEntitlementAudit } from '../db';
import { getInvoiceSubscriptionId } from './invoiceSubscription';
import type { AccessTier } from '../../shared/tiers';
import { sendEmail, buildSubscriptionConfirmationEmail } from '../email';

/**
 * Thrown when a paid checkout cannot be mapped to a known plan/price.
 * FAIL CLOSED: we never guess a tier. The webhook answers 500 so Stripe retries
 * (and surfaces the failing endpoint) while the failure is investigated; the
 * idempotency claim is released so a retry after a config fix can still grant.
 */
export class UnresolvedPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnresolvedPlanError';
  }
}

/**
 * Resolve the access tier for a completed checkout session.
 * Always fetches line items from the Stripe API — they are NOT included
 * in the webhook payload by default, so we must call listLineItems().
 *
 * Fails closed: throws if the tier cannot be determined (no `core` fallback).
 * API/network errors propagate as-is (transient → 500 → Stripe retries).
 */
async function resolveTierFromSession(sessionId: string): Promise<Exclude<AccessTier, 'free'>> {
  if (!stripe) {
    throw new Error('Stripe is not configured — cannot resolve checkout tier');
  }
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
  const priceId = lineItems.data[0]?.price?.id;
  if (!priceId) {
    throw new UnresolvedPlanError(`Session ${sessionId} has no line-item price — no entitlement granted`);
  }
  const plan = getPlanByPriceId(priceId);
  if (!plan || plan.tier === 'free') {
    throw new UnresolvedPlanError(`Session ${sessionId} price ${priceId} does not match any configured plan — no entitlement granted`);
  }
  return plan.tier;
}

/**
 * Resolve the access tier for a subscription (used on invoice.paid renewals).
 * Looks up the price on the first subscription item.
 * Returns null (no grant) when the price is unknown. API errors propagate so
 * the webhook answers 500 and Stripe retries.
 */
async function resolveTierFromSubscription(subscriptionId: string): Promise<Exclude<AccessTier, 'free'> | null> {
  if (!stripe) {
    throw new Error('Stripe is not configured — cannot resolve subscription tier');
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;
  if (priceId) {
    const plan = getPlanByPriceId(priceId);
    if (plan && plan.tier !== 'free') return plan.tier;
  }
  return null;
}

/** Map an access tier to a human-readable plan name for emails. */
function tierToPlanName(tier: string): string {
  switch (tier) {
    case 'core': return 'Mobile Plan';
    case 'premium': return 'Trader Plan';
    case 'founding': return 'Founding Member';
    default: return 'FAULTLINE Plan';
  }
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;

  // ── Signature verification bypass (dev/test only) ───────────────────────────
  const skipVerification = process.env.STRIPE_SKIP_VERIFICATION === 'true' && process.env.NODE_ENV !== 'production';
  if (skipVerification) {
    console.warn('[Stripe Webhook] STRIPE_SKIP_VERIFICATION is active — skipping signature check (dev/test only)');
    let parsedEvent: any;
    try {
      const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body);
      parsedEvent = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    return res.status(200).json({ verified: true, eventId: parsedEvent?.id });
  }

  if (!stripe) {
    console.warn('[Stripe Webhook] Stripe is not configured — ignoring live event');
    return res.status(200).json({ error: 'Stripe is not configured', verified: false });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Signature verification failed', verified: false });
  }

  console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

  // ── Idempotency guard ──────────────────────────────────────────────────────
  // Claim the event ID before processing so concurrent duplicate deliveries do not
  // double-process. Duplicate key = already claimed/processed. If processing fails
  // below, the claim is RELEASED so Stripe's retry is processed rather than skipped.
  let isNew: boolean;
  try {
    isNew = await recordStripeWebhookEvent(event.id, event.type);
  } catch (err) {
    console.error(`[Stripe Webhook] Could not record event ${event.id} — answering 500 so Stripe retries:`, err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
  if (!isNew) {
    console.log(`[Stripe Webhook] Duplicate event ${event.id} (${event.type}) — skipping`);
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : null;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;

        if (!userId) {
          console.warn('[Stripe Webhook] checkout.session.completed missing user_id in metadata');
          break;
        }

        const tier = await resolveTierFromSession(session.id);
        const prevTier = await getUserTier(userId).catch(() => 'unknown');

        // Detect lifetime (one-time payment) purchases via session metadata
        const planId = session.metadata?.plan_id as string | undefined;
        const isLifetimePurchase = planId === 'lifetime';

        await updateUserStripe(userId, {
          accessTier: tier,
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
          ...(isLifetimePurchase ? { lifetimeAccess: true, lifetimePurchasedAt: new Date() } : {}),
        });

        if (isLifetimePurchase) {
          console.log(`[Stripe Webhook] User ${userId} granted LIFETIME access (one-time payment — permanent)`);
        }

        await writeEntitlementAudit({
          userId,
          fromTier: prevTier,
          toTier: tier,
          reason: 'checkout.session.completed',
          stripeEventId: event.id,
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
        });

        console.log(`[Stripe Webhook] User ${userId} upgraded to ${tier} (session ${session.id})`);

        const customerEmail = session.metadata?.customer_email ?? session.customer_email ?? null;
        const customerName = session.metadata?.customer_name ?? null;
        if (customerEmail) {
          sendEmail(buildSubscriptionConfirmationEmail({
            name: customerName || '',
            email: customerEmail,
            planName: tierToPlanName(tier),
          })).catch((err) => {
            console.warn('[Stripe Webhook] Subscription confirmation email failed (non-fatal):', err);
          });
        }

        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        // Supports both the legacy `invoice.subscription` and the current
        // `invoice.parent.subscription_details.subscription` shapes.
        const subscriptionId = getInvoiceSubscriptionId(invoice);

        if (!subscriptionId) break;

        const user = await getUserByStripeCustomerId(customerId);
        if (!user) {
          console.warn(`[Stripe Webhook] invoice.paid — no user found for customer ${customerId}`);
          break;
        }

        const tier = await resolveTierFromSubscription(subscriptionId);
        if (!tier) {
          console.error(`[Stripe Webhook][BILLING-ALERT] invoice.paid — unknown price for subscription ${subscriptionId} (event ${event.id}); tier left unchanged, investigate`);
          break;
        }

        const prevTier = user.accessTier;
        await updateUserStripe(user.id, { accessTier: tier, stripeSubscriptionId: subscriptionId });

        await writeEntitlementAudit({
          userId: user.id,
          fromTier: prevTier,
          toTier: tier,
          reason: 'invoice.paid',
          stripeEventId: event.id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });

        console.log(`[Stripe Webhook] User ${user.id} re-activated to ${tier} (invoice ${invoice.id})`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        const user = await getUserByStripeCustomerId(customerId);
        if (user) {
          // Lifetime members are immune to subscription cancellation — their access is permanent.
          if (user.lifetimeAccess) {
            console.log(`[Stripe Webhook] customer.subscription.deleted — User ${user.id} has lifetime access, skipping downgrade`);
            break;
          }
          const prevTier = user.accessTier;
          await updateUserStripe(user.id, { accessTier: 'free', stripeSubscriptionId: null });

          await writeEntitlementAudit({
            userId: user.id,
            fromTier: prevTier,
            toTier: 'free',
            reason: 'customer.subscription.deleted',
            stripeEventId: event.id,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
          });

          console.log(`[Stripe Webhook] User ${user.id} downgraded to free (subscription cancelled)`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const subscriptionId = subscription.id as string;
        const status = subscription.status as string;

        const user = await getUserByStripeCustomerId(customerId);
        if (!user) {
          console.warn(`[Stripe Webhook] customer.subscription.updated — no user found for customer ${customerId}`);
          break;
        }

        if (status === 'active' || status === 'trialing') {
          const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
          if (priceId) {
            const plan = getPlanByPriceId(priceId);
            if (plan && plan.tier !== 'free') {
              const prevTier = user.accessTier;
              await updateUserStripe(user.id, { accessTier: plan.tier, stripeSubscriptionId: subscriptionId });

              await writeEntitlementAudit({
                userId: user.id,
                fromTier: prevTier,
                toTier: plan.tier,
                reason: 'customer.subscription.updated',
                stripeEventId: event.id,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
              });

              console.log(`[Stripe Webhook] User ${user.id} tier updated to ${plan.tier} via subscription update (${subscriptionId})`);
            } else {
              console.error(`[Stripe Webhook][BILLING-ALERT] customer.subscription.updated — unknown price ${priceId} for subscription ${subscriptionId} (event ${event.id}); tier left unchanged, investigate`);
            }
          }
        } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
          // Lifetime members are immune to subscription status changes — their access is permanent.
          if (user.lifetimeAccess) {
            console.log(`[Stripe Webhook] customer.subscription.updated:${status} — User ${user.id} has lifetime access, skipping downgrade`);
            break;
          }
          const prevTier = user.accessTier;
          await updateUserStripe(user.id, { accessTier: 'free', stripeSubscriptionId: null });

          await writeEntitlementAudit({
            userId: user.id,
            fromTier: prevTier,
            toTier: 'free',
            reason: `customer.subscription.updated:${status}`,
            stripeEventId: event.id,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          });

          console.log(`[Stripe Webhook] User ${user.id} downgraded to free (subscription ${subscriptionId} status: ${status})`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        console.warn(`[Stripe Webhook] Payment failed for customer ${customerId} — invoice ${invoice.id}`);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    if (err instanceof UnresolvedPlanError) {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.type} ${event.id}: ${err.message}. No access granted; answering 500 so Stripe retries and alerts.`);
    } else {
      console.error('[Stripe Webhook] Error processing event:', err);
    }
    // Roll back the idempotency claim so Stripe's retry is not skipped as a duplicate.
    try {
      await releaseStripeWebhookEvent(event.id);
    } catch (releaseErr) {
      console.error(`[Stripe Webhook][BILLING-ALERT] Failed to release idempotency claim for ${event.id} — retries will be skipped as duplicates; replay manually:`, releaseErr);
    }
    return res.status(500).json({
      error: err instanceof UnresolvedPlanError ? 'Unrecognized plan — entitlement not granted' : 'Webhook processing failed',
    });
  }

  res.json({ received: true });
}
