import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { stripe } from './client';
import { ENV } from '../_core/env';
import { getPlanByPriceId } from './products';
import {
  getUserByStripeCustomerId,
  getEntitlementUserById,
  getEntitlementRevision,
  recordStripeWebhookEvent,
  releaseStripeWebhookEvent,
  completeStripeWebhookEvent,
  commitEntitlementResync,
  upsertStripeCancellationMarker,
  listStripeCancellationMarkers,
  writeEntitlementAudit,
  StaleStripeWebhookClaimError,
  ZeroRowEntitlementWriteError,
  type EntitlementMarkerSnapshot,
  type StripeWebhookAttempt,
} from '../db';
import { sendEmail, buildSubscriptionConfirmationEmail } from '../email';
import {
  cancellationMarkerFromEvent,
  decideEntitlement,
  linkedUserIds,
  resumeEvidenceFromEvent,
  verifiedLifetimePayment,
  type EntitlementApply,
  type LifetimeSessionView,
  type PaidTier,
  type ResumeEvidence,
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
 * Six webhook reads so a single-page pass (list, lifetime sessions, retrieve)
 * can recompute once inside the same delivery. Each read allows one network
 * retry plus 1s of backoff, at a 4s timeout: 6 * (4s * 2 + 1s) = 54s. That
 * stays under the 90s reclaim window. The shared Stripe client does not set
 * maxNetworkRetries. A second page plus a recompute can exhaust the budget;
 * the handler then returns 500 without sealing.
 */
export const STRIPE_WEBHOOK_MAX_READS = 6;
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
type EntitlementUser = { id: number; name: string | null; email: string | null; accessTier: string | null; lifetimeAccess: boolean; stripeCustomerId?: string | null };

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

/**
 * Customer id first, then checkout/subscription/invoice metadata, then
 * client_reference_id. A miss is not an acknowledgement — the caller retries.
 */
async function resolveUser(event: { type: string; data: { object?: Record<string, unknown> | null } }): Promise<EntitlementUser | null> {
  const object = event.data.object ?? {};
  const customerId = stripeId(object.customer);
  if (customerId) {
    const byCustomer = await getUserByStripeCustomerId(customerId);
    if (byCustomer) return byCustomer;
  }
  for (const userId of linkedUserIds(object)) {
    const byId = await getEntitlementUserById(userId);
    if (byId) return byId;
  }
  return null;
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

type EntitlementPicture = {
  subscriptions: SubscriptionView[];
  markers: EntitlementMarkerSnapshot[];
  revision: number;
  decision: EntitlementApply;
};

function isEntitlementPicture(value: EntitlementPicture | { stale: true }): value is EntitlementPicture {
  return !('stale' in value);
}

/**
 * One full recompute. The revision is sampled before the Stripe reads and
 * again after them. A change means this snapshot is already stale and must
 * not be committed. Lifetime is re-read so an admin revoke is visible.
 */
async function computeEntitlementPicture(input: {
  eventId: string;
  userId: number;
  customerId: string | null;
  eventType: string;
  sessionId: string | null;
  budget: ReadBudget;
  resume: ResumeEvidence | null;
  lifetimeVerified: boolean;
  lifetimePurchasedAt: Date | null;
}): Promise<EntitlementPicture | { stale: true }> {
  const revisionBefore = await getEntitlementRevision(input.userId);
  if (revisionBefore == null) throw new ZeroRowEntitlementWriteError(input.eventId);
  const user = await getEntitlementUserById(input.userId);
  if (!user) throw new ZeroRowEntitlementWriteError(input.eventId);
  if (input.customerId && input.budget.n >= STRIPE_WEBHOOK_MAX_READS) {
    throw new EntitlementConflictError('stale_state');
  }

  let lifetimeVerified = input.lifetimeVerified;
  let lifetimePurchasedAt = input.lifetimePurchasedAt;
  let subscriptions: SubscriptionView[] = [];
  let listIncomplete = false;

  if (input.customerId) {
    const listed = await loadSubscriptions(input.customerId, input.budget);
    subscriptions = listed.subscriptions;
    listIncomplete = listed.listIncomplete;
    if (input.budget.n >= STRIPE_WEBHOOK_MAX_READS && !lifetimeVerified) {
      throw new EntitlementConflictError('read_budget');
    }
    const sessions = await loadLifetimeSessions(input.customerId, input.budget);
    const verified = sessions.find(session => verifiedLifetimePayment(session));
    if (verified) {
      lifetimeVerified = true;
      if (!lifetimePurchasedAt && typeof verified.created === 'number') lifetimePurchasedAt = new Date(verified.created * 1000);
    }
    const checkoutAttempt = input.eventType === 'checkout.session.completed' || input.eventType === 'checkout.session.async_payment_succeeded';
    if (input.eventType.startsWith('checkout.session.') && !lifetimeVerified && input.sessionId && checkoutAttempt && input.budget.n < STRIPE_WEBHOOK_MAX_READS) {
      const session = await stripeCall(input.budget, () => stripe!.checkout.sessions.retrieve(input.sessionId!, { expand: ['payment_intent'] }, stripeRead)) as LifetimeSessionView;
      if (verifiedLifetimePayment(session)) {
        lifetimeVerified = true;
        if (typeof session.created === 'number') lifetimePurchasedAt = new Date(session.created * 1000);
      }
    }
  }

  const markers = await listStripeCancellationMarkers(subscriptions.map(subscription => subscription.id));
  const revisionAfter = await getEntitlementRevision(input.userId);
  if (revisionAfter == null) throw new ZeroRowEntitlementWriteError(input.eventId);
  if (revisionAfter !== revisionBefore) return { stale: true };

  let decision = decideEntitlement({
    subscriptions,
    listIncomplete,
    markers,
    corroborated: null,
    storedLifetime: Boolean(user.lifetimeAccess),
    lifetimeVerified,
    lifetimePurchasedAt,
    resolveTier: priceTier,
    resume: input.resume,
  });
  if (decision.action === 'needs_corroboration') {
    if (input.budget.n >= STRIPE_WEBHOOK_MAX_READS) throw new EntitlementConflictError('single_read');
    const subscriptionId = decision.subscriptionId;
    const retrieved = await stripeCall(input.budget, () => stripe!.subscriptions.retrieve(
      subscriptionId,
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
      resume: input.resume,
    });
  }
  if (decision.action === 'conflict') throw new EntitlementConflictError(decision.reason);
  if (decision.action === 'needs_corroboration') throw new EntitlementConflictError('single_read');
  if (decision.action === 'unresolved') {
    throw new UnresolvedPlanError(`Subscription ${decision.subscriptionId} price ${decision.priceId ?? 'missing'} does not match any configured paid plan — no entitlement granted`);
  }
  return { subscriptions, markers, revision: revisionAfter, decision };
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
      console.warn(`[Stripe Webhook] ${event.type} ${event.id} has no resolvable user — not acknowledging`);
      await releaseClaim();
      return res.status(500).json({ error: 'Webhook processing failed', conflict: 'missing_user' });
    }

    const customerId = stripeId((event.data.object as { customer?: unknown }).customer);
    const storedCustomerId = user.stripeCustomerId || null;
    if (customerId && storedCustomerId && customerId !== storedCustomerId) {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} customer ${customerId} does not match stored ${storedCustomerId}; not sealing or downgrading`);
      try {
        await writeEntitlementAudit({
          userId: user.id,
          fromTier: user.accessTier,
          toTier: user.accessTier ?? 'free',
          reason: 'customer_conflict',
          stripeEventId: event.id,
          stripeCustomerId: customerId,
          strict: true,
        });
      } catch (auditErr) {
        console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} customer conflict audit failed; claim stays unfinished:`, auditErr);
      }
      return res.status(500).json({ error: 'Webhook processing failed', conflict: 'customer_conflict' });
    }

    const marker = cancellationMarkerFromEvent(event as unknown as Parameters<typeof cancellationMarkerFromEvent>[0]);
    if (marker) {
      await upsertStripeCancellationMarker({ ...marker, userId: user.id });
    }

    const budget: ReadBudget = { n: 0 };
    let lifetimeVerified = false;
    let lifetimePurchasedAt: Date | null = null;
    const sessionId = stripeId((event.data.object as { id?: unknown }).id);

    if (event.type.startsWith('checkout.session.') && customerId == null) {
      if (sessionId && (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded')) {
        const session = await stripeCall(budget, () => stripe!.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] }, stripeRead)) as LifetimeSessionView;
        lifetimeVerified = verifiedLifetimePayment(session);
        if (lifetimeVerified && typeof session.created === 'number') lifetimePurchasedAt = new Date(session.created * 1000);
      }
    }

    if (!customerId && !lifetimeVerified) {
      await releaseClaim();
      return res.status(500).json({ error: 'Webhook processing failed', conflict: 'missing_customer' });
    }

    const resume = resumeEvidenceFromEvent(event as unknown as Parameters<typeof resumeEvidenceFromEvent>[0]);
    const pictureInput = {
      eventId: event.id,
      userId: user.id,
      customerId,
      eventType: event.type,
      sessionId,
      budget,
      resume,
      lifetimeVerified,
      lifetimePurchasedAt,
    };
    let pictured = await computeEntitlementPicture(pictureInput);
    if (!isEntitlementPicture(pictured)) {
      pictured = await computeEntitlementPicture(pictureInput);
      if (!isEntitlementPicture(pictured)) throw new EntitlementConflictError('stale_state');
    }
    const commitOf = (picture: EntitlementPicture) => commitEntitlementResync({
      eventId: event.id,
      eventType: event.type,
      attemptId: attempt.attemptId,
      userId: user.id,
      observedRevision: picture.revision,
      observedMarkers: picture.markers,
      markerSubscriptionIds: picture.subscriptions.map(subscription => subscription.id),
      supersedeCancellation: picture.decision.supersedeCancellation,
      desired: {
        accessTier: picture.decision.accessTier,
        stripeSubscriptionId: picture.decision.stripeSubscriptionId,
        grantLifetime: picture.decision.grantLifetime,
        lifetimePurchasedAt: picture.decision.lifetimePurchasedAt,
        accessExpiresAt: picture.decision.accessExpiresAt,
        stripeCustomerId: customerId,
      },
      audit: {
        fromTier: user.accessTier,
        toTier: picture.decision.accessTier,
        reason: event.type,
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: picture.decision.stripeSubscriptionId ?? undefined,
      },
    });
    let outcome = await commitOf(pictured);
    if (outcome === 'stale_state') {
      const recomputed = await computeEntitlementPicture(pictureInput);
      if (!isEntitlementPicture(recomputed)) throw new EntitlementConflictError('stale_state');
      pictured = recomputed;
      outcome = await commitOf(pictured);
    }
    if (outcome === 'claim_lost') throw new StaleStripeWebhookClaimError(event.id);
    if (outcome === 'customer_conflict') {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} refused to replace stored customer ${storedCustomerId ?? 'none'} with ${customerId ?? 'none'}`);
      return res.status(500).json({ error: 'Webhook processing failed', conflict: 'customer_conflict' });
    }
    if (outcome === 'stale_state') throw new EntitlementConflictError('stale_state');
    if (!isEntitlementPicture(pictured)) throw new EntitlementConflictError('stale_state');
    const decision = pictured.decision;
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
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.type} ${event.id}: ${err.message}. Claim left unfinished so it can be replayed. A cancellation marker on this event is kept.`);
      return res.status(500).json({ error: 'Webhook processing failed', conflict: 'unresolved_plan' });
    }
    console.error('[Stripe Webhook] Error processing event:', err);
    if (!entitlementWritten) await releaseClaim();
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
