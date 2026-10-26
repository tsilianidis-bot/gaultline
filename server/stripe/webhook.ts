import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { stripe } from './client';
import { ENV } from '../_core/env';
import { getPlanByPriceId } from './products';
import { updateUserStripe, getUserByStripeCustomerId, getUserTier, recordStripeWebhookEvent, releaseStripeWebhookEvent, completeStripeWebhookEvent, writeEntitlementAudit, entitlementAuditExists } from '../db';
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

/**
 * Each webhook read fails fast so a sequence of Stripe calls returns before the
 * 90s claim-reclaim window. The shared client timeout is 15s; this is tighter.
 */
const STRIPE_WEBHOOK_READ_TIMEOUT_MS = 8_000;
const stripeRead: Stripe.RequestOptions = { timeout: STRIPE_WEBHOOK_READ_TIMEOUT_MS };

type IgnoredReason =
  | 'subscription_not_entitled'
  | 'payment_not_verified'
  | 'payment_not_completed'
  | 'missing_subscription'
  | 'already_applied';

type SubscriptionSnapshot = {
  id?: string | null;
  status?: string | null;
  ended_at?: number | null;
  items?: { data?: Array<{ price?: { id?: string | null } | null } | null> | null } | null;
};

type PaidTier = Exclude<AccessTier, 'free'>;

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
 * Checkout grants only when Stripe itself reports the session paid.
 *
 * `no_payment_required` is denied for every plan, including lifetime and a
 * 100% promotion code. Checkout does not configure a trial or a zero-price
 * plan, so a session that collected no payment is not an entitlement.
 * `unpaid` covers pending and async methods; those wait for
 * `checkout.session.async_payment_succeeded`. When a PaymentIntent is present
 * it must be `succeeded`, which is the independent check for lifetime.
 */
export function checkoutPaymentDecision(input: {
  paymentStatus?: string | null;
  paymentIntentStatus?: string | null;
}): { grant: true } | { grant: false; reason: 'unpaid' | 'no_payment_required' | 'payment_intent_not_succeeded' | 'unknown' } {
  const status = (input.paymentStatus ?? '').toLowerCase();
  if (status === 'no_payment_required') return { grant: false, reason: 'no_payment_required' };
  if (status === 'unpaid') return { grant: false, reason: 'unpaid' };
  if (status !== 'paid') return { grant: false, reason: 'unknown' };
  if (input.paymentIntentStatus && input.paymentIntentStatus !== 'succeeded') {
    return { grant: false, reason: 'payment_intent_not_succeeded' };
  }
  return { grant: true };
}

function stripeId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

/**
 * Subscription id for API 2026-04-22.dahlia, where Invoice no longer has a
 * top-level `subscription`. Prefer parent.subscription_details, then invoice
 * lines, and only then a legacy field if an older payload still sends one.
 */
export function subscriptionIdFromInvoice(invoice: {
  subscription?: unknown;
  parent?: { subscription_details?: { subscription?: unknown } | null } | null;
  lines?: { data?: Array<{ subscription?: unknown; parent?: { subscription_item_details?: { subscription?: unknown } | null; invoice_item_details?: { subscription?: unknown } | null } | null } | null> | null } | null;
}): string | null {
  const fromParent = stripeId(invoice.parent?.subscription_details?.subscription);
  if (fromParent) return fromParent;
  for (const line of invoice.lines?.data ?? []) {
    if (!line) continue;
    const fromLine = stripeId(line.parent?.subscription_item_details?.subscription)
      ?? stripeId(line.parent?.invoice_item_details?.subscription)
      ?? stripeId(line.subscription);
    if (fromLine) return fromLine;
  }
  return stripeId(invoice.subscription);
}

async function resolveTierFromSession(sessionId: string): Promise<PaidTier> {
  if (!stripe) throw new Error('Stripe is not configured — cannot resolve checkout tier');
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 }, stripeRead);
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
  if (!stripe) throw new Error('Stripe is not configured — cannot confirm subscription status');
  return stripe.subscriptions.retrieve(subscriptionId, {}, stripeRead);
}

function tierFromLiveSubscription(subscriptionId: string, subscription: SubscriptionSnapshot): PaidTier {
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

function isStripeMissing(err: unknown): boolean {
  const error = err as { code?: string; statusCode?: number } | null;
  return error?.code === 'resource_missing' || error?.statusCode === 404;
}

async function customerHasEntitlingSubscription(customerId: string): Promise<boolean> {
  if (!stripe) throw new Error('Stripe is not configured — cannot list subscriptions');
  for (const status of ['active', 'trialing'] as const) {
    const page = await stripe.subscriptions.list({ customer: customerId, status, limit: 20 }, stripeRead);
    if (page.data.some(subscription => subscriptionGrantDecision(subscription).entitled)) return true;
  }
  return false;
}

/** Revoke only when this subscription and every other subscription for the customer are not entitled. */
async function revocationDecision(customerId: string, subscriptionId: string): Promise<'revoke' | 'keep'> {
  let live: SubscriptionSnapshot;
  try {
    live = await readLiveSubscription(subscriptionId);
  } catch (err) {
    if (!isStripeMissing(err)) throw err;
    live = { id: subscriptionId, status: 'canceled', ended_at: 1 };
  }
  if (subscriptionGrantDecision(live).entitled) return 'keep';
  if (await customerHasEntitlingSubscription(customerId)) return 'keep';
  try {
    const again = await readLiveSubscription(subscriptionId);
    if (subscriptionGrantDecision(again).entitled) return 'keep';
  } catch (err) {
    if (!isStripeMissing(err)) throw err;
  }
  if (await customerHasEntitlingSubscription(customerId)) return 'keep';
  return 'revoke';
}

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

async function verifiedCheckoutSession(sessionId: string) {
  if (!stripe) throw new Error('Stripe is not configured — cannot verify checkout payment');
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] }, stripeRead);
  const paymentIntent = session.payment_intent;
  const paymentIntentStatus = paymentIntent && typeof paymentIntent === 'object'
    ? paymentIntent.status
    : null;
  let retrievedIntentStatus: string | null = paymentIntentStatus;
  if (typeof paymentIntent === 'string') {
    const intent = await stripe.paymentIntents.retrieve(paymentIntent, {}, stripeRead);
    retrievedIntentStatus = intent.status;
  }
  return { session, paymentIntentStatus: retrievedIntentStatus };
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;

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

  let ignored: IgnoredReason | undefined;
  let entitlementWritten = false;

  const finishApplied = async (reason: string) => {
    if (await entitlementAuditExists(event.id)) {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} already has an entitlement audit (${reason}) — not writing again`);
      ignored = 'already_applied';
      return true;
    }
    return false;
  };

  try {
    switch (event.type) {
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        console.error(`[Stripe Webhook][BILLING-ALERT] ${event.type} ${event.id} — no entitlement granted`);
        ignored = 'payment_not_completed';
        break;
      }

      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const payload = event.data.object as { id?: string };
        const sessionId = payload.id;
        if (!sessionId) {
          console.error(`[Stripe Webhook][BILLING-ALERT] ${event.type} ${event.id} missing session id — not granting`);
          ignored = 'payment_not_verified';
          break;
        }
        const { session, paymentIntentStatus } = await verifiedCheckoutSession(sessionId);
        const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id, 10) : null;
        if (!userId) {
          console.warn(`[Stripe Webhook] ${event.type} missing user_id in metadata`);
          break;
        }
        const planId = session.metadata?.plan_id;
        const isLifetimePurchase = planId === 'lifetime';
        const payment = checkoutPaymentDecision({
          paymentStatus: session.payment_status,
          paymentIntentStatus,
        });
        if (!payment.grant) {
          console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} checkout ${sessionId} payment_status ${session.payment_status} intent ${paymentIntentStatus ?? 'none'} — not granting${isLifetimePurchase ? ' lifetime' : ''}`);
          ignored = 'payment_not_verified';
          break;
        }
        if (await finishApplied(event.type)) break;

        const tier = await resolveTierFromSession(session.id);
        const customerId = stripeId(session.customer);
        const subscriptionId = stripeId(session.subscription);
        if (subscriptionId) {
          const decision = subscriptionGrantDecision(await readLiveSubscription(subscriptionId));
          if (!decision.entitled) {
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} is ${decision.status} — not granting`);
            ignored = 'subscription_not_entitled';
            break;
          }
          const again = subscriptionGrantDecision(await readLiveSubscription(subscriptionId));
          if (!again.entitled) {
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} is ${again.status} immediately before write — not granting`);
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
        await writeEntitlementAudit({
          userId,
          fromTier: prevTier,
          toTier: tier,
          reason: event.type,
          stripeEventId: event.id,
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
          strict: true,
        });
        if (!(await retainClaim(event.id, event.type))) {
          throw new Error(`claim retain failed after entitlement write for ${event.id}`);
        }
        if (isLifetimePurchase) {
          console.log(`[Stripe Webhook] User ${userId} granted LIFETIME access after verified payment`);
        }
        console.log(`[Stripe Webhook] User ${userId} upgraded to ${tier} (${event.type} ${session.id})`);
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
        const invoice = event.data.object as Parameters<typeof subscriptionIdFromInvoice>[0] & { id?: string; customer?: unknown };
        const customerId = stripeId(invoice.customer);
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (!customerId || !subscriptionId) {
          console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} invoice.paid missing ${!customerId ? 'customer' : 'subscription id'} (parent.subscription_details, lines, and legacy subscription) — not granting`);
          ignored = 'missing_subscription';
          break;
        }
        const user = await getUserByStripeCustomerId(customerId);
        if (!user) {
          console.warn(`[Stripe Webhook] invoice.paid — no user found for customer ${customerId}`);
          break;
        }
        if (await finishApplied('invoice.paid')) break;
        const subscription = await readLiveSubscription(subscriptionId);
        const decision = subscriptionGrantDecision(subscription);
        if (!decision.entitled) {
          console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} is ${decision.status} — not re-granting`);
          ignored = 'subscription_not_entitled';
          break;
        }
        const confirmed = await readLiveSubscription(subscriptionId);
        const confirmedDecision = subscriptionGrantDecision(confirmed);
        if (!confirmedDecision.entitled) {
          console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} is ${confirmedDecision.status} immediately before write — not re-granting`);
          ignored = 'subscription_not_entitled';
          break;
        }
        const tier = tierFromLiveSubscription(subscriptionId, confirmed);
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
          strict: true,
        });
        if (!(await retainClaim(event.id, event.type))) {
          throw new Error(`claim retain failed after entitlement write for ${event.id}`);
        }
        console.log(`[Stripe Webhook] User ${user.id} re-activated to ${tier} (invoice ${invoice.id})`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as { id?: string; customer?: unknown };
        const customerId = stripeId(subscription.customer);
        const subscriptionId = stripeId(subscription.id);
        if (!customerId || !subscriptionId) break;
        const user = await getUserByStripeCustomerId(customerId);
        if (!user) break;
        if (user.lifetimeAccess) {
          console.log(`[Stripe Webhook] customer.subscription.deleted — User ${user.id} has lifetime access, skipping downgrade`);
          break;
        }
        if (await finishApplied('customer.subscription.deleted')) break;
        const decision = await revocationDecision(customerId, subscriptionId);
        if (decision === 'keep') {
          console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} still entitled or customer has another active subscription — not downgrading`);
          ignored = 'subscription_not_entitled';
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
          stripeSubscriptionId: subscriptionId,
          strict: true,
        });
        if (!(await retainClaim(event.id, event.type))) {
          throw new Error(`claim retain failed after entitlement write for ${event.id}`);
        }
        console.log(`[Stripe Webhook] User ${user.id} downgraded to free (subscription cancelled)`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as { id?: string; customer?: unknown; status?: string };
        const customerId = stripeId(subscription.customer);
        const subscriptionId = stripeId(subscription.id);
        const status = subscription.status ?? '';
        if (!customerId || !subscriptionId) break;
        const user = await getUserByStripeCustomerId(customerId);
        if (!user) {
          console.warn(`[Stripe Webhook] customer.subscription.updated — no user found for customer ${customerId}`);
          break;
        }
        if (await finishApplied('customer.subscription.updated')) break;
        if (status === 'active' || status === 'trialing') {
          const live = await readLiveSubscription(subscriptionId);
          const decision = subscriptionGrantDecision(live);
          if (!decision.entitled) {
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} is ${decision.status} — not granting`);
            ignored = 'subscription_not_entitled';
            break;
          }
          const confirmed = await readLiveSubscription(subscriptionId);
          const confirmedDecision = subscriptionGrantDecision(confirmed);
          if (!confirmedDecision.entitled) {
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} is ${confirmedDecision.status} immediately before write — not granting`);
            ignored = 'subscription_not_entitled';
            break;
          }
          const tier = tierFromLiveSubscription(subscriptionId, confirmed);
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
            strict: true,
          });
          if (!(await retainClaim(event.id, event.type))) {
            throw new Error(`claim retain failed after entitlement write for ${event.id}`);
          }
          console.log(`[Stripe Webhook] User ${user.id} tier updated to ${tier} via subscription update (${subscriptionId})`);
        } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
          if (user.lifetimeAccess) {
            console.log(`[Stripe Webhook] customer.subscription.updated:${status} — User ${user.id} has lifetime access, skipping downgrade`);
            break;
          }
          const decision = await revocationDecision(customerId, subscriptionId);
          if (decision === 'keep') {
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} status ${status} is stale — live subscription still entitled, not downgrading`);
            ignored = 'subscription_not_entitled';
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
            strict: true,
          });
          if (!(await retainClaim(event.id, event.type))) {
            throw new Error(`claim retain failed after entitlement write for ${event.id}`);
          }
          console.log(`[Stripe Webhook] User ${user.id} downgraded to free (subscription ${subscriptionId} status: ${status})`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as { id?: string; customer?: unknown };
        const customerId = stripeId(invoice.customer);
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
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} failed after an entitlement write. Claim retained so the grant is not replayed.`);
      await retainClaim(event.id, event.type);
    }
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  if (!(await retainClaim(event.id, event.type))) {
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
  return res.json(ignored ? { received: true, ignored } : { received: true });
}
