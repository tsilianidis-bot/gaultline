import type { Request, Response } from 'express';
import { stripe } from './client';
import { ENV } from '../_core/env';
import { getPlanByPriceId } from './products';
import { updateUserStripe, getUserByStripeCustomerId } from '../db';

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Test event passthrough — required for Stripe webhook verification flow
  if (event.id.startsWith('evt_test_')) {
    console.log('[Stripe Webhook] Test event detected, returning verification response');
    return res.json({ verified: true });
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

        // Determine tier from line items / price
        let tier: 'premium' | 'founding' = 'premium';
        if (session.line_items) {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          const priceId = lineItems.data[0]?.price?.id;
          if (priceId) {
            const plan = getPlanByPriceId(priceId);
            if (plan) tier = plan.tier;
          }
        }

        await updateUserStripe(userId, {
          accessTier: tier,
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
        });

        console.log(`[Stripe Webhook] User ${userId} upgraded to ${tier}`);
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

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        console.warn(`[Stripe Webhook] Payment failed for customer ${customerId}`);
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
