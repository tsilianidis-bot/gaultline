import type { Request, Response } from 'express';
import { stripe } from './client';
import { ENV } from '../_core/env';
import { getPlanByPriceId } from './products';
import { updateUserStripe, getUserByStripeCustomerId } from '../db';
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

  // ── Signature verification bypass (dev/test only) ───────────────────────────
  // NEVER bypass based on payload body content — that is spoofable by any caller.
  // Only bypass when STRIPE_SKIP_VERIFICATION=true is explicitly set in the environment,
  // which must never be set in production.
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
    // Return 200 with error JSON so Stripe doesn't retry indefinitely on config errors
    return res.status(200).json({ error: 'Signature verification failed', verified: false });
  }

  console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

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

        // Always fetch line items from the API — they are NOT in the webhook payload
        const tier = await resolveTierFromSession(session.id);

        await updateUserStripe(userId, {
          accessTier: tier,
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
        });

        console.log(`[Stripe Webhook] User ${userId} upgraded to ${tier} (session ${session.id})`);

        // Send subscription confirmation email (best-effort, non-blocking)
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
        // Fires on every successful payment — initial charge AND renewals.
        // Re-activates tier for users whose subscription lapsed and then renewed.
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string | null;

        // Only process subscription invoices (not one-time charges)
        if (!subscriptionId) break;

        const user = await getUserByStripeCustomerId(customerId);
        if (!user) {
          console.warn(`[Stripe Webhook] invoice.paid — no user found for customer ${customerId}`);
          break;
        }

        // Resolve the tier from the subscription's current price
        const tier = await resolveTierFromSubscription(subscriptionId);
        if (!tier) {
          console.warn(`[Stripe Webhook] invoice.paid — could not resolve tier for subscription ${subscriptionId}`);
          break;
        }

        await updateUserStripe(user.id, {
          accessTier: tier,
          stripeSubscriptionId: subscriptionId,
        });

        console.log(`[Stripe Webhook] User ${user.id} re-activated to ${tier} (invoice ${invoice.id})`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        // Downgrade user back to free when subscription is cancelled
        const user = await getUserByStripeCustomerId(customerId);
        if (user) {
          await updateUserStripe(user.id, { accessTier: 'free', stripeSubscriptionId: null });
          console.log(`[Stripe Webhook] User ${user.id} downgraded to free (subscription cancelled)`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Fires on every plan change, upgrade, downgrade, trial conversion, or billing cycle update.
        // This is the ONLY event that fires when a user changes plans via the Billing Portal.
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
          // Resolve the new tier from the updated subscription's price
          const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
          if (priceId) {
            const plan = getPlanByPriceId(priceId);
            if (plan && plan.tier !== 'free') {
              await updateUserStripe(user.id, {
                accessTier: plan.tier,
                stripeSubscriptionId: subscriptionId,
              });
              console.log(`[Stripe Webhook] User ${user.id} tier updated to ${plan.tier} via subscription update (${subscriptionId})`);
            } else {
              console.warn(`[Stripe Webhook] customer.subscription.updated — unknown price ${priceId} for subscription ${subscriptionId}`);
            }
          }
        } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
          // Subscription entered a degraded state — downgrade to free
          await updateUserStripe(user.id, { accessTier: 'free', stripeSubscriptionId: null });
          console.log(`[Stripe Webhook] User ${user.id} downgraded to free (subscription ${subscriptionId} status: ${status})`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        console.warn(`[Stripe Webhook] Payment failed for customer ${customerId} — invoice ${invoice.id}`);
        // Could send a notification here — left for future implementation
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
