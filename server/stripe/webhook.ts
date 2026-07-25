import type { Request, Response } from 'express';
import { stripe } from './client';
import { ENV } from '../_core/env';
import { getPlanByPriceId } from './products';
import { updateUserStripe, getUserByStripeCustomerId, getUserTier, recordStripeWebhookEvent, writeEntitlementAudit } from '../db';
import type { AccessTier } from '../../shared/tiers';
import { sendEmail, buildSubscriptionConfirmationEmail } from '../email';

/**
 * Resolve the access tier for a completed checkout session.
 * Always fetches line items from the Stripe API — they are NOT included
 * in the webhook payload by default, so we must call listLineItems().
 */
async function resolveTierFromSession(sessionId: string): Promise<Exclude<AccessTier, 'free'>> {
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
    const priceId = lineItems.data[0]?.price?.id;
    if (priceId) {
      const plan = getPlanByPriceId(priceId);
      if (plan && plan.tier !== 'free') return plan.tier;
    }
  } catch (err: any) {
    console.warn('[Stripe Webhook] Could not fetch line items for session', sessionId, '—', err.message);
  }
  // Safe fallback — default to 'core' (lowest paid tier) so we never accidentally
  // grant premium access to a user who paid for core.
  console.warn('[Stripe Webhook] Could not determine tier from line items — defaulting to core (safe minimum)');
  return 'core';
}

/**
 * Resolve the access tier for a subscription (used on invoice.paid renewals).
 * Looks up the price on the first subscription item.
 */
async function resolveTierFromSubscription(subscriptionId: string): Promise<Exclude<AccessTier, 'free'> | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId) {
      const plan = getPlanByPriceId(priceId);
      if (plan && plan.tier !== 'free') return plan.tier;
    }
  } catch (err: any) {
    console.warn('[Stripe Webhook] Could not fetch subscription', subscriptionId, '—', err.message);
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

  // Stripe/Manus webhook verification events use the evt_test_ prefix and must
  // short-circuit before signature construction.
  try {
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body);
    const testEvent = JSON.parse(rawBody) as { id?: unknown };
    if (typeof testEvent.id === 'string' && testEvent.id.startsWith('evt_test_')) {
      console.log('[Webhook] Test event detected, returning verification response');
      return res.json({ verified: true });
    }
  } catch {
    // Let the normal signature-verification path handle malformed live payloads.
  }

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

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(200).json({ error: 'Signature verification failed', verified: false });
  }

  console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

  // ── Idempotency guard ──────────────────────────────────────────────────────
  // Record the event ID before processing. Duplicate key = already processed.
  const isNew = await recordStripeWebhookEvent(event.id, event.type);
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

        await updateUserStripe(userId, {
          accessTier: tier,
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
        });

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

        const tier = await resolveTierFromSubscription(subscriptionId);
        if (!tier) {
          console.warn(`[Stripe Webhook] invoice.paid — could not resolve tier for subscription ${subscriptionId}`);
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
              console.warn(`[Stripe Webhook] customer.subscription.updated — unknown price ${priceId} for subscription ${subscriptionId}`);
            }
          }
        } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
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
    console.error('[Stripe Webhook] Error processing event:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.json({ received: true });
}
