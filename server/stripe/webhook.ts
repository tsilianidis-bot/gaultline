import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { stripe } from './client';
import { ENV } from '../_core/env';
import { getPlanByPriceId } from './products';
import {
  getUserByStripeCustomerId,
  getEntitlementUserById,
  recordStripeWebhookEvent,
  releaseStripeWebhookEvent,
  completeStripeWebhookEvent,
  commitEntitlementResync,
  upsertStripeCancellationMarker,
  listStripeCancellationMarkers,
  StaleStripeWebhookClaimError,
  ZeroRowEntitlementWriteError,
  type StripeWebhookAttempt,
} from '../db';
import { sendEmail, buildSubscriptionConfirmationEmail } from '../email';
import {
  cancellationMarkerFromEvent,
  decideEntitlement,
  verifiedLifetimePayment,
  type LifetimeSessionView,
  type PaidTier,
  type SubscriptionView,
} from './entitlementSync';

export class UnresolvedPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnresolvedPlanError';
  }
}

export class EntitlementConflictError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'EntitlementConflictError';
  }
}

/**
 * Four webhook reads, each allowed one network retry (ECONNRESET) plus 1s of
 * backoff, at a 4s timeout: 4 * (4s * 2 + 1s) = 36s. That stays under the 90s
 * reclaim window. The shared Stripe client does not set maxNetworkRetries.
 */
export const STRIPE_WEBHOOK_MAX_READS = 4;
export const STRIPE_WEBHOOK_READ_TIMEOUT_MS = 4_000;
export const STRIPE_WEBHOOK_MAX_NETWORK_RETRIES = 1;
export const STRIPE_WEBHOOK_RETRY_BACKOFF_MS = 1_000;
export const STRIPE_SUBSCRIPTION_PAGE_SIZE = 100;
export const STRIPE_SUBSCRIPTION_MAX_PAGES = 2;

export function webhookStripeBudgetMs(
  reads = STRIPE_WEBHOOK_MAX_READS,
  timeoutMs = STRIPE_WEBHOOK_READ_TIMEOUT_MS,
  maxNetworkRetries = STRIPE_WEBHOOK_MAX_NETWORK_RETRIES,
  backoffMs = STRIPE_WEBHOOK_RETRY_BACKOFF_MS,
): number {
  const perRead = timeoutMs * (maxNetworkRetries + 1) + maxNetworkRetries * backoffMs;
  return reads * perRead;
}

const stripeRead: Stripe.RequestOptions = {
  timeout: STRIPE_WEBHOOK_READ_TIMEOUT_MS,
  maxNetworkRetries: STRIPE_WEBHOOK_MAX_NETWORK_RETRIES,
};

const RELEVANT_PREFIXES = ['checkout.session.', 'customer.subscription.', 'invoice.', 'payment_intent.'];

type ReadBudget = { n: number };
type EntitlementUser = { id: number; name: string | null; email: string | null; accessTier: string | null; lifetimeAccess: boolean };

function stripeId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

async function stripeCall<T>(budget: ReadBudget, run: () => Promise<T>): Promise<T> {
  budget.n += 1;
  if (budget.n > STRIPE_WEBHOOK_MAX_READS) {
    throw new EntitlementConflictError('read_budget');
  }
  return run();
}

function priceTier(priceId: string): PaidTier | null {
  const plan = getPlanByPriceId(priceId);
  if (!plan || plan.tier === 'free') return null;
  return plan.tier;
}

async function resolveUser(event: { type: string; data: { object?: Record<string, unknown> | null } }): Promise<EntitlementUser | null> {
  const object = event.data.object ?? {};
  if (event.type.startsWith('checkout.session.')) {
    const metadata = object.metadata as { user_id?: string } | undefined;
    const userId = metadata?.user_id ? parseInt(metadata.user_id, 10) : NaN;
    if (Number.isInteger(userId) && userId > 0) {
      const byId = await getEntitlementUserById(userId);
      if (byId) return byId;
    }
  }
  const customerId = stripeId(object.customer);
  if (!customerId) return null;
  return getUserByStripeCustomerId(customerId);
}

async function loadSubscriptions(customerId: string, budget: ReadBudget): Promise<{ subscriptions: SubscriptionView[]; listIncomplete: boolean }> {
  if (!stripe) throw new Error('Stripe is not configured — cannot list subscriptions');
  const subscriptions: SubscriptionView[] = [];
  let startingAfter: string | undefined;
  let listIncomplete = false;
  for (let page = 0; page < STRIPE_SUBSCRIPTION_MAX_PAGES; page += 1) {
    const result = await stripeCall(budget, () => stripe!.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: STRIPE_SUBSCRIPTION_PAGE_SIZE,
      expand: ['data.latest_invoice'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    }, stripeRead));
    subscriptions.push(...result.data as SubscriptionView[]);
    if (!result.has_more) return { subscriptions, listIncomplete: false };
    const lastId = result.data[result.data.length - 1]?.id;
    if (!lastId || page === STRIPE_SUBSCRIPTION_MAX_PAGES - 1) {
      listIncomplete = true;
      break;
    }
    startingAfter = lastId;
  }
  return { subscriptions, listIncomplete };
}

async function loadLifetimeSessions(customerId: string, budget: ReadBudget): Promise<LifetimeSessionView[]> {
  if (!stripe) throw new Error('Stripe is not configured — cannot list checkout sessions');
  if (budget.n >= STRIPE_WEBHOOK_MAX_READS) return [];
  const listed = await stripeCall(budget, () => stripe!.checkout.sessions.list({
    customer: customerId,
    limit: 20,
    expand: ['data.payment_intent'],
  }, stripeRead));
  return listed.data as LifetimeSessionView[];
}

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
  const skipVerification = process.env.STRIPE_SKIP_VERIFICATION === 'true' && process.env.NODE_ENV !== 'production';
  if (skipVerification) {
    console.warn('[Stripe Webhook] STRIPE_SKIP_VERIFICATION is active — skipping signature check (dev/test only)');
    let parsedEvent: { id?: string };
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

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'invalid signature';
    console.error('[Stripe Webhook] Signature verification failed:', message);
    return res.status(400).json({ error: 'Signature verification failed', verified: false });
  }

  console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

  let attempt: StripeWebhookAttempt;
  try {
    const recorded = await recordStripeWebhookEvent(event.id, event.type);
    if (!recorded) {
      console.log(`[Stripe Webhook] Duplicate event ${event.id} (${event.type}) — skipping`);
      return res.json({ received: true, duplicate: true });
    }
    attempt = recorded;
  } catch (err) {
    console.error(`[Stripe Webhook] Could not record event ${event.id} — answering 500 so Stripe retries:`, err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  const retainClaim = async () => {
    try {
      await completeStripeWebhookEvent(event.id, event.type, attempt.attemptId);
      return true;
    } catch (completeErr) {
      console.error(`[Stripe Webhook][BILLING-ALERT] Failed to retain claim for ${event.id}; answering 500 so the event is not dropped:`, completeErr);
      return false;
    }
  };

  const releaseClaim = async () => {
    try {
      await releaseStripeWebhookEvent(event.id, attempt.attemptId, event.type);
    } catch (releaseErr) {
      console.error(`[Stripe Webhook][BILLING-ALERT] Failed to release idempotency claim for ${event.id}; event remains claimable for retry:`, releaseErr);
    }
  };

  if (!RELEVANT_PREFIXES.some(prefix => event.type.startsWith(prefix))) {
    console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    if (!(await retainClaim())) return res.status(500).json({ error: 'Webhook processing failed' });
    return res.json({ received: true });
  }

  let entitlementWritten = false;
  try {
    const user = await resolveUser(event as unknown as Parameters<typeof resolveUser>[0]);
    if (!user) {
      console.warn(`[Stripe Webhook] ${event.type} ${event.id} has no resolvable user — not granting`);
      if (!(await retainClaim())) return res.status(500).json({ error: 'Webhook processing failed' });
      return res.json({ received: true, ignored: 'missing_user' });
    }

    const marker = cancellationMarkerFromEvent(event as unknown as Parameters<typeof cancellationMarkerFromEvent>[0]);
    if (marker) {
      await upsertStripeCancellationMarker({ ...marker, userId: user.id });
    }

    const customerId = stripeId((event.data.object as { customer?: unknown }).customer);
    const budget: ReadBudget = { n: 0 };
    let lifetimeVerified = false;
    let lifetimePurchasedAt: Date | null = null;

    if (event.type.startsWith('checkout.session.') && customerId == null) {
      const sessionId = stripeId((event.data.object as { id?: unknown }).id);
      if (sessionId && (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded')) {
        const session = await stripeCall(budget, () => stripe!.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] }, stripeRead)) as LifetimeSessionView;
        lifetimeVerified = verifiedLifetimePayment(session);
        if (lifetimeVerified && typeof session.created === 'number') lifetimePurchasedAt = new Date(session.created * 1000);
      }
    }

    if (!customerId && !lifetimeVerified) {
      if (!(await retainClaim())) return res.status(500).json({ error: 'Webhook processing failed' });
      return res.json({ received: true, ignored: 'missing_customer' });
    }

    let subscriptions: SubscriptionView[] = [];
    let listIncomplete = false;
    if (customerId) {
      const listed = await loadSubscriptions(customerId, budget);
      subscriptions = listed.subscriptions;
      listIncomplete = listed.listIncomplete;
      const sessions = await loadLifetimeSessions(customerId, budget);
      const verified = sessions.find(session => verifiedLifetimePayment(session));
      if (verified) {
        lifetimeVerified = true;
        if (!lifetimePurchasedAt && typeof verified.created === 'number') lifetimePurchasedAt = new Date(verified.created * 1000);
      }
      if (event.type.startsWith('checkout.session.') && !lifetimeVerified) {
        const sessionId = stripeId((event.data.object as { id?: unknown }).id);
        if (sessionId && budget.n < STRIPE_WEBHOOK_MAX_READS && (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded')) {
          const session = await stripeCall(budget, () => stripe!.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] }, stripeRead)) as LifetimeSessionView;
          if (verifiedLifetimePayment(session)) {
            lifetimeVerified = true;
            if (typeof session.created === 'number') lifetimePurchasedAt = new Date(session.created * 1000);
          }
        }
      }
    }

    const markers = await listStripeCancellationMarkers(subscriptions.map(subscription => subscription.id));
    let decision = decideEntitlement({
      subscriptions,
      listIncomplete,
      markers,
      corroborated: null,
      storedLifetime: Boolean(user.lifetimeAccess),
      lifetimeVerified,
      lifetimePurchasedAt,
      resolveTier: priceTier,
    });
    if (decision.action === 'needs_corroboration') {
      if (budget.n >= STRIPE_WEBHOOK_MAX_READS) {
        throw new EntitlementConflictError('single_read');
      }
      const retrieved = await stripeCall(budget, () => stripe!.subscriptions.retrieve(
        decision.action === 'needs_corroboration' ? decision.subscriptionId : '',
        { expand: ['latest_invoice'] },
        stripeRead,
      )) as SubscriptionView;
      decision = decideEntitlement({
        subscriptions,
        listIncomplete,
        markers,
        corroborated: retrieved,
        storedLifetime: Boolean(user.lifetimeAccess),
        lifetimeVerified,
        lifetimePurchasedAt,
        resolveTier: priceTier,
      });
    }
    if (decision.action === 'conflict') throw new EntitlementConflictError(decision.reason);
    if (decision.action === 'needs_corroboration') throw new EntitlementConflictError('single_read');
    if (decision.action === 'unresolved') {
      throw new UnresolvedPlanError(`Subscription ${decision.subscriptionId} price ${decision.priceId ?? 'missing'} does not match any configured paid plan — no entitlement granted`);
    }

    const outcome = await commitEntitlementResync({
      eventId: event.id,
      eventType: event.type,
      attemptId: attempt.attemptId,
      userId: user.id,
      desired: decision,
      audit: {
        fromTier: user.accessTier,
        toTier: decision.accessTier,
        reason: event.type,
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: decision.stripeSubscriptionId ?? undefined,
      },
    });
    if (outcome === 'claim_lost') throw new StaleStripeWebhookClaimError(event.id);
    entitlementWritten = true;
    console.log(`[Stripe Webhook] User ${user.id} entitlement resynced to ${decision.accessTier} (${event.type} ${event.id})`);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as { customer_email?: string | null; metadata?: { customer_email?: string; customer_name?: string } | null };
      const customerEmail = session.metadata?.customer_email ?? session.customer_email ?? user.email;
      if (customerEmail && decision.accessTier !== 'free') {
        sendEmail(buildSubscriptionConfirmationEmail({
          name: session.metadata?.customer_name || user.name || '',
          email: customerEmail,
          planName: tierToPlanName(decision.accessTier),
        })).catch(err => {
          console.warn('[Stripe Webhook] Subscription confirmation email failed (non-fatal):', err);
        });
      }
    }
    return res.json({ received: true });
  } catch (err) {
    if (err instanceof StaleStripeWebhookClaimError) {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} lost the claim fence; not sealing or releasing the current attempt`);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
    if (err instanceof EntitlementConflictError) {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} not sealed (${err.message}); Stripe can retry after reconciliation`);
      if (!entitlementWritten) await releaseClaim();
      return res.status(500).json({ error: 'Webhook processing failed', conflict: err.message });
    }
    if (err instanceof ZeroRowEntitlementWriteError) {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} zero-row entitlement write was not sealed`);
      if (!entitlementWritten) await releaseClaim();
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
    if (err instanceof UnresolvedPlanError) {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.type} ${event.id}: ${err.message}. No access granted. Claim retained.`);
      if (!(await retainClaim())) return res.status(500).json({ error: 'Webhook processing failed' });
      return res.status(200).json({ received: true, ignored: 'unresolved_plan' });
    }
    console.error('[Stripe Webhook] Error processing event:', err);
    if (!entitlementWritten) await releaseClaim();
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
