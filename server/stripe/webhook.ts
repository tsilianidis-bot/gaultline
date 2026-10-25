import type { Request, Response } from 'express';
import { stripe } from './client';
import { ENV } from '../_core/env';
import { getPlanByPriceId } from './products';
import { updateUserStripe, getUserByStripeCustomerId, getUserTier, recordStripeWebhookEvent, releaseStripeWebhookEvent, completeStripeWebhookEvent, writeEntitlementAudit } from '../db';
import type { AccessTier } from '../../shared/tiers';
import { sendEmail, buildSubscriptionConfirmationEmail } from '../email';

/**
 * Thrown when a paid checkout or subscription cannot be mapped to a configured
 * paid plan. The claim is kept and the delivery is acknowledged so Stripe does
 * not retry a permanent mapping failure.
 */
export class UnresolvedPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnresolvedPlanError';
  }
}

type SubscriptionSnapshot = {
  status?: string | null;
  ended_at?: number | null;
  items?: { data?: Array<{ price?: { id?: string | null } | null } | null> | null } | null;
};

/**
 * Live subscription state that may receive or keep a paid grant.
 * Cancelled, ended, and incomplete subscriptions are not entitled. Any other
 * non-active status (including past_due, unpaid, and paused) is also refused
 * so an older event cannot resurrect access after a newer status change.
 */
export function subscriptionGrantDecision(
  subscription: SubscriptionSnapshot,
): { entitled: true } | { entitled: false; status: string } {
  const raw = (subscription.status ?? 'unknown').toLowerCase();
  if (subscription.ended_at || raw === 'ended') return { entitled: false, status: 'ended' };
  if (raw === 'canceled' || raw === 'cancelled') return { entitled: false, status: 'cancelled' };
  if (raw === 'incomplete' || raw === 'incomplete_expired') return { entitled: false, status: 'incomplete' };
  if (raw === 'active' || raw === 'trialing') return { entitled: true };
  return { entitled: false, status: raw };
}

/**
 * Resolve the access tier for a completed checkout session.
 * Always fetches line items from the Stripe API — they are NOT included
 * in the webhook payload by default, so we must call listLineItems().
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
    throw new UnresolvedPlanError(`Session ${sessionId} price ${priceId} does not match any configured paid plan — no entitlement granted`);
  }
  return plan.tier;
}

async function readLiveSubscription(subscriptionId: string): Promise<SubscriptionSnapshot> {
  if (!stripe) {
    throw new Error('Stripe is not configured — cannot confirm subscription status');
  }
  return stripe.subscriptions.retrieve(subscriptionId);
}

function tierFromLiveSubscription(subscriptionId: string, subscription: SubscriptionSnapshot): Exclude<AccessTier, 'free'> {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (!priceId) {
    throw new UnresolvedPlanError(`Subscription ${subscriptionId} has no price — no entitlement granted`);
  }
  const plan = getPlanByPriceId(priceId);
  if (!plan || plan.tier === 'free') {
    throw new UnresolvedPlanError(`Subscription ${subscriptionId} price ${priceId} does not match any configured paid plan — no entitlement granted`);
  }
  return plan.tier;
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

async function retainClaim(eventId: string, eventType: string): Promise<boolean> {
  try {
    await completeStripeWebhookEvent(eventId, eventType);
    return true;
  } catch (completeErr) {
    console.error(`[Stripe Webhook][BILLING-ALERT] Failed to retain claim for ${eventId}; answering 500 so the event is not dropped:`, completeErr);
    return false;
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
  // Claim the event ID before processing. A finished duplicate is skipped.
  // A claim is released below only when handling fails before any entitlement
  // write, so Stripe can retry. Unknown prices and non-entitling subscriptions
  // keep the claim and acknowledge, so they do not retry forever.
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

  let ignored: 'subscription_not_entitled' | undefined;
  let entitlementWritten = false;

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

        // Detect lifetime (one-time payment) purchases via session metadata
        const planId = session.metadata?.plan_id as string | undefined;
        const isLifetimePurchase = planId === 'lifetime';

        if (subscriptionId) {
          const decision = subscriptionGrantDecision(await readLiveSubscription(subscriptionId));
          if (!decision.entitled) {
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} is ${decision.status} — not granting`);
            ignored = 'subscription_not_entitled';
            break;
          }
        }

        const prevTier = await getUserTier(userId).catch(() => 'unknown');

        await updateUserStripe(userId, {
          accessTier: tier,
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
          ...(isLifetimePurchase ? { lifetimeAccess: true, lifetimePurchasedAt: new Date() } : {}),
        });
        entitlementWritten = true;

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
        const subscriptionId = invoice.subscription as string | null;

        if (!subscriptionId) break;

        const user = await getUserByStripeCustomerId(customerId);
        if (!user) {
          console.warn(`[Stripe Webhook] invoice.paid — no user found for customer ${customerId}`);
          break;
        }

        const subscription = await readLiveSubscription(subscriptionId);
        const decision = subscriptionGrantDecision(subscription);
        if (!decision.entitled) {
          console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} is ${decision.status} — not re-granting`);
          ignored = 'subscription_not_entitled';
          break;
        }

        const tier = tierFromLiveSubscription(subscriptionId, subscription);
        const prevTier = user.accessTier;
        await updateUserStripe(user.id, { accessTier: tier, stripeSubscriptionId: subscriptionId });
        entitlementWritten = true;

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
          entitlementWritten = true;

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
          const live = await readLiveSubscription(subscriptionId);
          const decision = subscriptionGrantDecision(live);
          if (!decision.entitled) {
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} is ${decision.status} — not granting`);
            ignored = 'subscription_not_entitled';
            break;
          }
          const tier = tierFromLiveSubscription(subscriptionId, live);
          const prevTier = user.accessTier;
          await updateUserStripe(user.id, { accessTier: tier, stripeSubscriptionId: subscriptionId });
          entitlementWritten = true;

          await writeEntitlementAudit({
            userId: user.id,
            fromTier: prevTier,
            toTier: tier,
            reason: 'customer.subscription.updated',
            stripeEventId: event.id,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          });

          console.log(`[Stripe Webhook] User ${user.id} tier updated to ${tier} via subscription update (${subscriptionId})`);
        } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
          // Lifetime members are immune to subscription status changes — their access is permanent.
          if (user.lifetimeAccess) {
            console.log(`[Stripe Webhook] customer.subscription.updated:${status} — User ${user.id} has lifetime access, skipping downgrade`);
            break;
          }
          const prevTier = user.accessTier;
          await updateUserStripe(user.id, { accessTier: 'free', stripeSubscriptionId: null });
          entitlementWritten = true;

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
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.type} ${event.id}: ${err.message}. No access granted. Claim retained.`);
      if (!(await retainClaim(event.id, event.type))) {
        return res.status(500).json({ error: 'Webhook processing failed' });
      }
      return res.status(200).json({ received: true, ignored: 'unresolved_plan' });
    }
    console.error('[Stripe Webhook] Error processing event:', err);
    if (!entitlementWritten) {
      try {
        await releaseStripeWebhookEvent(event.id);
      } catch (releaseErr) {
        console.error(`[Stripe Webhook][BILLING-ALERT] Failed to release idempotency claim for ${event.id}; event remains claimable for retry:`, releaseErr);
      }
    } else {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} failed after an entitlement write. Claim retained.`);
      await retainClaim(event.id, event.type);
    }
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  if (!(await retainClaim(event.id, event.type))) {
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
  return res.json(ignored ? { received: true, ignored } : { received: true });
}
