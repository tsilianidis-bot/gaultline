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
  listPurchaseRevocations,
  applyPurchaseRevocation,
  writeEntitlementAudit,
  StaleStripeWebhookClaimError,
  ZeroRowEntitlementWriteError,
  type EntitlementMarkerSnapshot,
  type StripeWebhookAttempt,
} from '../db';
import { sendEmail, buildSubscriptionConfirmationEmail } from '../email';
import {
  cancellationMarkerFromEvent,
  chargeViewFromRecord,
  decideEntitlement,
  disputeCloseDisposition,
  lifetimeRevocationDecision,
  linkedUserIds,
  planChargeRevocation,
  resumeEvidenceFromEvent,
  revokedInvoiceIds,
  revokedLifetimePaymentIntentIds,
  verifiedLifetimePayment,
  type ChargeView,
  type EntitlementApply,
  type LifetimeSessionView,
  type PaidTier,
  type PurchaseRevocationSnapshot,
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
const CHARGE_ENTITLEMENT_TYPES = new Set(['charge.refunded', 'charge.dispute.created', 'charge.dispute.closed']);

function isRelevantStripeEvent(type: string): boolean {
  return RELEVANT_PREFIXES.some(prefix => type.startsWith(prefix)) || CHARGE_ENTITLEMENT_TYPES.has(type);
}

type ReadBudget = { n: number };
type EntitlementUser = { id: number; name: string | null; email: string | null; accessTier: string | null; lifetimeAccess: boolean; stripeCustomerId?: string | null; lifetimePaymentIntentId?: string | null };

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
  revocations: PurchaseRevocationSnapshot[];
  revision: number;
  decision: EntitlementApply;
  revokeLifetime: boolean;
  lifetimePaymentIntentId: string | null;
  auditReason: string;
};

function isEntitlementPicture(value: EntitlementPicture | { stale: true }): value is EntitlementPicture {
  return !('stale' in value);
}

type DisputeEffect = { id: string; status: string | null; phase: 'created' | 'closed' };

async function retrieveCharge(chargeId: string, budget: ReadBudget): Promise<ChargeView> {
  const retrieved = await stripeCall(budget, () => stripe!.charges.retrieve(chargeId, {}, stripeRead));
  const view = chargeViewFromRecord(retrieved as unknown as Record<string, unknown>);
  if (!view) throw new EntitlementConflictError('missing_charge');
  return view;
}

async function loadChargeEffect(
  event: Stripe.Event,
  budget: ReadBudget,
): Promise<{ charge: ChargeView; dispute: DisputeEffect | null }> {
  const object = event.data.object as unknown as Record<string, unknown>;
  if (event.type === 'charge.refunded') {
    const parsed = chargeViewFromRecord(object);
    if (parsed && parsed.amount != null) return { charge: parsed, dispute: null };
    const chargeId = parsed?.id ?? (typeof object.id === 'string' ? object.id : null);
    if (!chargeId) throw new EntitlementConflictError('missing_charge');
    return { charge: await retrieveCharge(chargeId, budget), dispute: null };
  }
  const disputeId = typeof object.id === 'string' ? object.id : '';
  if (!disputeId) throw new EntitlementConflictError('missing_dispute');
  const status = typeof object.status === 'string' ? object.status : null;
  const phase: DisputeEffect['phase'] = event.type === 'charge.dispute.created' ? 'created' : 'closed';
  let charge = object.charge && typeof object.charge === 'object'
    ? chargeViewFromRecord(object.charge as Record<string, unknown>)
    : null;
  if (!charge || charge.amount == null) {
    const chargeId = typeof object.charge === 'string' ? object.charge : charge?.id ?? null;
    if (!chargeId) throw new EntitlementConflictError('missing_charge');
    charge = await retrieveCharge(chargeId, budget);
  }
  return { charge, dispute: { id: disputeId, status, phase } };
}

/**
 * One full recompute. The revision is sampled before the Stripe reads and
 * again after them. A change means this snapshot is already stale and must
 * not be committed. Lifetime is re-read so an admin revoke is visible.
 * A charge refund or dispute is recorded before the decision, and the
 * revocation rows are part of the snapshot the commit compares.
 */
async function computeEntitlementPicture(input: {
  eventId: string;
  eventCreated: number | null;
  userId: number;
  customerId: string | null;
  eventType: string;
  sessionId: string | null;
  budget: ReadBudget;
  resume: ResumeEvidence | null;
  lifetimeVerified: boolean;
  lifetimePurchasedAt: Date | null;
  charge: ChargeView | null;
  dispute: DisputeEffect | null;
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
  let sessions: LifetimeSessionView[] = [];
  let listIncomplete = false;

  if (input.customerId) {
    const listed = await loadSubscriptions(input.customerId, input.budget);
    subscriptions = listed.subscriptions;
    listIncomplete = listed.listIncomplete;
    if (input.budget.n >= STRIPE_WEBHOOK_MAX_READS && !lifetimeVerified) {
      throw new EntitlementConflictError('read_budget');
    }
    sessions = await loadLifetimeSessions(input.customerId, input.budget);
    const alreadyVerified = sessions.some(session => verifiedLifetimePayment(session));
    const checkoutAttempt = input.eventType === 'checkout.session.completed' || input.eventType === 'checkout.session.async_payment_succeeded';
    if (!alreadyVerified && input.eventType.startsWith('checkout.session.') && input.sessionId && checkoutAttempt && input.budget.n < STRIPE_WEBHOOK_MAX_READS) {
      const session = await stripeCall(input.budget, () => stripe!.checkout.sessions.retrieve(input.sessionId!, { expand: ['payment_intent'] }, stripeRead)) as LifetimeSessionView;
      if (session && typeof session === 'object') {
        sessions = [session, ...sessions.filter(existing => existing.id !== session.id)];
      }
    }
  }

  let auditReason = input.eventType;
  if (input.charge) {
    if (input.eventCreated == null || input.eventCreated <= 0) throw new EntitlementConflictError('missing_source_timestamp');
    const plan = planChargeRevocation({
      eventId: input.eventId,
      eventType: input.eventType,
      created: input.eventCreated,
      charge: input.charge,
      sessions,
      subscriptions,
      dispute: input.dispute ?? undefined,
    });
    auditReason = plan.reason;
    if (plan.reason === 'charge.dispute.closed:unknown') throw new EntitlementConflictError('unknown_dispute_status');
    if (plan.mutation) {
      const recorded = await applyPurchaseRevocation({ ...plan.mutation, userId: input.userId });
      if (recorded.stale) auditReason = `${plan.reason}:stale`;
    }
  }

  const revocations = await listPurchaseRevocations(input.userId);
  const lifetime = lifetimeRevocationDecision({
    storedLifetime: Boolean(user.lifetimeAccess),
    storedPaymentIntentId: user.lifetimePaymentIntentId ?? null,
    sessions,
    revokedPaymentIntentIds: revokedLifetimePaymentIntentIds(revocations),
  });
  if (sessions.length > 0 || revokedLifetimePaymentIntentIds(revocations).length > 0) {
    lifetimeVerified = lifetime.lifetimeVerified;
    if (lifetime.lifetimePurchasedAt) lifetimePurchasedAt = lifetime.lifetimePurchasedAt;
  }

  const markers = await listStripeCancellationMarkers(subscriptions.map(subscription => subscription.id));
  const revisionAfter = await getEntitlementRevision(input.userId);
  if (revisionAfter == null) throw new ZeroRowEntitlementWriteError(input.eventId);
  if (revisionAfter !== revisionBefore) return { stale: true };

  const decisionInput = {
    subscriptions,
    listIncomplete,
    markers,
    storedLifetime: Boolean(user.lifetimeAccess),
    lifetimeVerified,
    lifetimePurchasedAt,
    resolveTier: priceTier,
    resume: input.resume,
    revokedInvoiceIds: revokedInvoiceIds(revocations),
    suppressStoredLifetime: lifetime.suppressStoredLifetime,
  };
  let decision = decideEntitlement({ ...decisionInput, corroborated: null });
  if (decision.action === 'needs_corroboration') {
    if (input.budget.n >= STRIPE_WEBHOOK_MAX_READS) throw new EntitlementConflictError('single_read');
    const subscriptionId = decision.subscriptionId;
    const retrieved = await stripeCall(input.budget, () => stripe!.subscriptions.retrieve(
      subscriptionId,
      { expand: ['latest_invoice'] },
      stripeRead,
    )) as SubscriptionView;
    decision = decideEntitlement({ ...decisionInput, corroborated: retrieved });
  }
  if (decision.action === 'conflict') throw new EntitlementConflictError(decision.reason);
  if (decision.action === 'needs_corroboration') throw new EntitlementConflictError('single_read');
  if (decision.action === 'unresolved') {
    throw new UnresolvedPlanError(`Subscription ${decision.subscriptionId} price ${decision.priceId ?? 'missing'} does not match any configured paid plan — no entitlement granted`);
  }
  const revokeLifetime = lifetime.suppressStoredLifetime && !decision.grantLifetime;
  const lifetimePaymentIntentId = decision.grantLifetime ? lifetime.lifetimePaymentIntentId : null;
  return {
    subscriptions,
    markers,
    revocations,
    revision: revisionAfter,
    decision,
    revokeLifetime,
    lifetimePaymentIntentId,
    auditReason,
  };
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

  if (!isRelevantStripeEvent(event.type)) {
    console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    if (!(await retainClaim())) return res.status(500).json({ error: 'Webhook processing failed' });
    return res.json({ received: true });
  }

  let entitlementWritten = false;
  try {
    if (event.type === 'charge.dispute.closed') {
      const status = (event.data.object as { status?: string | null }).status;
      if (disputeCloseDisposition(status) === 'unknown') throw new EntitlementConflictError('unknown_dispute_status');
    }
    const budget: ReadBudget = { n: 0 };
    const chargeEffect = CHARGE_ENTITLEMENT_TYPES.has(event.type) ? await loadChargeEffect(event, budget) : null;
    const user = await resolveUser({
      type: event.type,
      data: {
        object: {
          ...(event.data.object as unknown as Record<string, unknown>),
          ...(chargeEffect?.charge.customer ? { customer: chargeEffect.charge.customer } : {}),
          ...(chargeEffect?.charge.metadata ? { metadata: { ...(event.data.object as { metadata?: Record<string, unknown> }).metadata, ...chargeEffect.charge.metadata } } : {}),
        },
      },
    });
    if (!user) {
      console.warn(`[Stripe Webhook] ${event.type} ${event.id} has no resolvable user — not acknowledging`);
      await releaseClaim();
      return res.status(500).json({ error: 'Webhook processing failed', conflict: 'missing_user' });
    }

    const customerId = stripeId((event.data.object as { customer?: unknown }).customer) ?? chargeEffect?.charge.customer ?? null;
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
          sourceEventCreated: typeof event.created === 'number' ? event.created : null,
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
      eventCreated: typeof event.created === 'number' ? event.created : null,
      userId: user.id,
      customerId,
      eventType: event.type,
      sessionId,
      budget,
      resume,
      lifetimeVerified,
      lifetimePurchasedAt,
      charge: chargeEffect?.charge ?? null,
      dispute: chargeEffect?.dispute ?? null,
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
      observedRevocations: picture.revocations,
      desired: {
        accessTier: picture.decision.accessTier,
        stripeSubscriptionId: picture.decision.stripeSubscriptionId,
        grantLifetime: picture.decision.grantLifetime,
        revokeLifetime: picture.revokeLifetime,
        lifetimePaymentIntentId: picture.lifetimePaymentIntentId,
        lifetimePurchasedAt: picture.decision.lifetimePurchasedAt,
        accessExpiresAt: picture.decision.accessExpiresAt,
        stripeCustomerId: customerId,
      },
      audit: {
        fromTier: user.accessTier,
        toTier: picture.decision.accessTier,
        reason: picture.auditReason,
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: picture.decision.stripeSubscriptionId ?? undefined,
        sourceEventCreated: typeof event.created === 'number' ? event.created : null,
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
