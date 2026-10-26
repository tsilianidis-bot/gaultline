import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { stripe } from './client';
import { ENV } from '../_core/env';
import { getPlanByPriceId } from './products';
import {
  getUserByStripeCustomerId,
  getUserTier,
  recordStripeWebhookEvent,
  releaseStripeWebhookEvent,
  completeStripeWebhookEvent,
  entitlementAuditExists,
  commitStripeEntitlement,
  StaleStripeWebhookClaimError,
  type StripeWebhookAttempt,
} from '../db';
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
 * Worst case is this many reads, each bounded by the timeout below, with no
 * network retry. 8 * 8s = 64s, which is under the 90s reclaim window.
 * Revoke uses at most 6 (two subscription reads and two pages for each of
 * active and trialing). Checkout uses at most 4.
 */
export const STRIPE_WEBHOOK_MAX_READS = 8;
export const STRIPE_WEBHOOK_READ_TIMEOUT_MS = 8_000;
export const STRIPE_WEBHOOK_MAX_NETWORK_RETRIES = 0;
export const STRIPE_SUBSCRIPTION_PAGE_SIZE = 100;
export const STRIPE_SUBSCRIPTION_MAX_PAGES = 2;

export function webhookStripeBudgetMs(
  reads = STRIPE_WEBHOOK_MAX_READS,
  timeoutMs = STRIPE_WEBHOOK_READ_TIMEOUT_MS,
  maxNetworkRetries = STRIPE_WEBHOOK_MAX_NETWORK_RETRIES,
): number {
  return reads * timeoutMs * (maxNetworkRetries + 1);
}

const stripeRead: Stripe.RequestOptions = {
  timeout: STRIPE_WEBHOOK_READ_TIMEOUT_MS,
  maxNetworkRetries: STRIPE_WEBHOOK_MAX_NETWORK_RETRIES,
};

type IgnoredReason =
  | 'subscription_not_entitled'
  | 'payment_not_verified'
  | 'payment_not_completed'
  | 'missing_subscription'
  | 'already_applied'
  | 'revoke_not_applied'
  | 'zero_amount';

type InvoiceSnapshot = {
  id?: string | null;
  status?: string | null;
  amount_paid?: number | null;
  total?: number | null;
};

type SubscriptionSnapshot = {
  id?: string | null;
  status?: string | null;
  ended_at?: number | null;
  items?: { data?: Array<{ price?: { id?: string | null } | null } | null> | null } | null;
  latest_invoice?: string | InvoiceSnapshot | null;
};

type PaidTier = Exclude<AccessTier, 'free'>;
type ReadBudget = { n: number };

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

export type PaymentDenial =
  | 'unpaid'
  | 'no_payment_required'
  | 'payment_intent_not_succeeded'
  | 'payment_intent_missing'
  | 'zero_amount'
  | 'unknown';

/**
 * One-time checkout, including lifetime. `paid` with no PaymentIntent is not
 * enough: the expanded PaymentIntent must be `succeeded` and both the session
 * total and the intent amount must be greater than zero. `no_payment_required`
 * (a 100% promotion, or a session that collected nothing) is denied. Checkout
 * has no trial and no zero-price plan.
 */
export function paymentModeDecision(input: {
  paymentStatus?: string | null;
  paymentIntentStatus?: string | null;
  amountTotal?: number | null;
  paymentIntentAmount?: number | null;
}): { grant: true } | { grant: false; reason: PaymentDenial } {
  const status = (input.paymentStatus ?? '').toLowerCase();
  if (status === 'no_payment_required') return { grant: false, reason: 'no_payment_required' };
  if (status === 'unpaid') return { grant: false, reason: 'unpaid' };
  if (status !== 'paid') return { grant: false, reason: 'unknown' };
  if (!input.paymentIntentStatus) return { grant: false, reason: 'payment_intent_missing' };
  if (input.paymentIntentStatus !== 'succeeded') return { grant: false, reason: 'payment_intent_not_succeeded' };
  if (!(typeof input.amountTotal === 'number' && input.amountTotal > 0)) return { grant: false, reason: 'zero_amount' };
  if (!(typeof input.paymentIntentAmount === 'number' && input.paymentIntentAmount > 0)) {
    return { grant: false, reason: 'zero_amount' };
  }
  return { grant: true };
}

/**
 * Subscription grants.
 *
 * Trialing is entitled without a positive charge. A trial invoice is often $0
 * and checkout can report `no_payment_required`.
 *
 * Active is entitled only when the latest invoice is `paid` and `amount_paid`
 * is greater than zero. A zero-dollar `invoice.paid` or `subscription.updated`
 * does not grant or extend a paid tier, including a 100% promotion on an
 * active subscription. If the event states an amount and the retrieved invoice
 * disagrees, the grant is refused.
 */
export function subscriptionPaymentDecision(input: {
  subscription: SubscriptionSnapshot;
  eventAmountPaid?: number | null;
  eventTotal?: number | null;
}): { grant: true } | { grant: false; reason: 'subscription_not_entitled' | 'zero_amount' | 'invoice_not_paid' | 'amount_mismatch' } {
  const decision = subscriptionGrantDecision(input.subscription);
  if (!decision.entitled) return { grant: false, reason: 'subscription_not_entitled' };
  if ((input.subscription.status ?? '').toLowerCase() === 'trialing') return { grant: true };
  const eventAmount = input.eventAmountPaid;
  const eventTotal = input.eventTotal;
  if (eventAmount === 0 || eventTotal === 0) return { grant: false, reason: 'zero_amount' };
  const invoice = input.subscription.latest_invoice;
  if (!invoice || typeof invoice === 'string') return { grant: false, reason: 'invoice_not_paid' };
  if ((invoice.status ?? '').toLowerCase() !== 'paid') return { grant: false, reason: 'invoice_not_paid' };
  if (!(typeof invoice.amount_paid === 'number' && invoice.amount_paid > 0)) {
    return { grant: false, reason: 'zero_amount' };
  }
  if (typeof eventAmount === 'number' && eventAmount !== invoice.amount_paid) {
    return { grant: false, reason: 'amount_mismatch' };
  }
  return { grant: true };
}

function deniedPaymentReason(
  decision: { grant: true } | { grant: false; reason: string },
): string | null {
  return decision.grant ? null : decision.reason;
}

/** @deprecated Use paymentModeDecision. Kept so older call sites keep a name. */
export function checkoutPaymentDecision(input: {
  paymentStatus?: string | null;
  paymentIntentStatus?: string | null;
  amountTotal?: number | null;
  paymentIntentAmount?: number | null;
}): { grant: true } | { grant: false; reason: PaymentDenial } {
  return paymentModeDecision(input);
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

async function stripeCall<T>(budget: ReadBudget, run: () => Promise<T>): Promise<T> {
  budget.n += 1;
  if (budget.n > STRIPE_WEBHOOK_MAX_READS) {
    throw new Error(`Stripe webhook read budget exceeded (${STRIPE_WEBHOOK_MAX_READS})`);
  }
  return run();
}

async function resolveTierFromSession(sessionId: string, budget: ReadBudget): Promise<PaidTier> {
  if (!stripe) throw new Error('Stripe is not configured — cannot resolve checkout tier');
  const lineItems = await stripeCall(budget, () => stripe!.checkout.sessions.listLineItems(sessionId, { limit: 1 }, stripeRead));
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

async function readLiveSubscription(subscriptionId: string, budget: ReadBudget): Promise<SubscriptionSnapshot> {
  if (!stripe) throw new Error('Stripe is not configured — cannot confirm subscription status');
  return stripeCall(budget, () => stripe!.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] }, stripeRead));
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

/**
 * True when another subscription entitles the customer. `unknown` means the
 * list was longer than the page cap or could not be advanced. Callers must
 * not revoke on `unknown`.
 */
async function customerHasEntitlingSubscription(customerId: string, budget: ReadBudget): Promise<boolean | 'unknown'> {
  if (!stripe) throw new Error('Stripe is not configured — cannot list subscriptions');
  for (const status of ['active', 'trialing'] as const) {
    let startingAfter: string | undefined;
    for (let page = 0; page < STRIPE_SUBSCRIPTION_MAX_PAGES; page += 1) {
      const result = await stripeCall(budget, () => stripe!.subscriptions.list({
        customer: customerId,
        status,
        limit: STRIPE_SUBSCRIPTION_PAGE_SIZE,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      }, stripeRead));
      if (result.data.some(subscription => subscriptionGrantDecision(subscription).entitled)) return true;
      if (!result.has_more) break;
      const lastId = result.data[result.data.length - 1]?.id;
      if (!lastId || page === STRIPE_SUBSCRIPTION_MAX_PAGES - 1) return 'unknown';
      startingAfter = lastId;
    }
  }
  return false;
}

/** Revoke only when this subscription and every listed subscription are not entitled. */
async function revocationDecision(customerId: string, subscriptionId: string, budget: ReadBudget): Promise<'revoke' | 'keep'> {
  let live: SubscriptionSnapshot;
  try {
    live = await readLiveSubscription(subscriptionId, budget);
  } catch (err) {
    if (!isStripeMissing(err)) throw err;
    live = { id: subscriptionId, status: 'canceled', ended_at: 1 };
  }
  if (subscriptionGrantDecision(live).entitled) return 'keep';
  const others = await customerHasEntitlingSubscription(customerId, budget);
  if (others === true || others === 'unknown') return 'keep';
  try {
    const again = await readLiveSubscription(subscriptionId, budget);
    if (subscriptionGrantDecision(again).entitled) return 'keep';
  } catch (err) {
    if (!isStripeMissing(err)) throw err;
  }
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

async function verifiedCheckoutSession(sessionId: string, budget: ReadBudget) {
  if (!stripe) throw new Error('Stripe is not configured — cannot verify checkout payment');
  const session = await stripeCall(budget, () => stripe!.checkout.sessions.retrieve(
    sessionId,
    { expand: ['payment_intent'] },
    stripeRead,
  ));
  const paymentIntent = session.payment_intent;
  let paymentIntentStatus: string | null = null;
  let paymentIntentAmount: number | null = null;
  if (paymentIntent && typeof paymentIntent === 'object') {
    paymentIntentStatus = paymentIntent.status;
    paymentIntentAmount = typeof paymentIntent.amount_received === 'number'
      ? paymentIntent.amount_received
      : (typeof paymentIntent.amount === 'number' ? paymentIntent.amount : null);
  } else if (typeof paymentIntent === 'string') {
    const intent = await stripeCall(budget, () => stripe!.paymentIntents.retrieve(paymentIntent, {}, stripeRead));
    paymentIntentStatus = intent.status;
    paymentIntentAmount = typeof intent.amount_received === 'number'
      ? intent.amount_received
      : (typeof intent.amount === 'number' ? intent.amount : null);
  }
  return { session, paymentIntentStatus, paymentIntentAmount };
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

  let ignored: IgnoredReason | undefined;
  let entitlementWritten = false;
  const budget: ReadBudget = { n: 0 };

  const retainClaim = async () => {
    try {
      await completeStripeWebhookEvent(event.id, event.type, attempt.attemptId);
      return true;
    } catch (completeErr) {
      console.error(`[Stripe Webhook][BILLING-ALERT] Failed to retain claim for ${event.id}; answering 500 so the event is not dropped:`, completeErr);
      return false;
    }
  };

  const finishApplied = async (reason: string) => {
    if (await entitlementAuditExists(event.id)) {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} already has an entitlement audit (${reason}) — not writing again`);
      ignored = 'already_applied';
      return true;
    }
    return false;
  };

  const commitGrant = async (input: {
    userId: number;
    patch?: NonNullable<Parameters<typeof commitStripeEntitlement>[0]['patch']>;
    revokeSubscriptionId?: string;
    audit: Parameters<typeof commitStripeEntitlement>[0]['audit'];
  }) => {
    const outcome = await commitStripeEntitlement({
      eventId: event.id,
      eventType: event.type,
      attemptId: attempt.attemptId,
      userId: input.userId,
      patch: input.patch,
      revokeSubscriptionId: input.revokeSubscriptionId,
      audit: input.audit,
    });
    if (outcome === 'claim_lost') throw new StaleStripeWebhookClaimError(event.id);
    if (outcome === 'revoke_skipped') {
      ignored = 'revoke_not_applied';
      return;
    }
    entitlementWritten = true;
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
        const { session, paymentIntentStatus, paymentIntentAmount } = await verifiedCheckoutSession(sessionId, budget);
        const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id, 10) : null;
        if (!userId) {
          console.warn(`[Stripe Webhook] ${event.type} missing user_id in metadata`);
          break;
        }
        const planId = session.metadata?.plan_id;
        const isLifetimePurchase = planId === 'lifetime' || session.mode === 'payment';
        const subscriptionId = stripeId(session.subscription);
        const paymentMode = isLifetimePurchase || !subscriptionId;
        if (paymentMode) {
          const payment = paymentModeDecision({
            paymentStatus: session.payment_status,
            paymentIntentStatus,
            amountTotal: session.amount_total,
            paymentIntentAmount,
          });
          if (!payment.grant) {
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} checkout ${sessionId} payment_status ${session.payment_status} intent ${paymentIntentStatus ?? 'none'} amount ${session.amount_total ?? 'none'} — not granting${isLifetimePurchase ? ' lifetime' : ''}`);
            ignored = payment.reason === 'zero_amount' ? 'zero_amount' : 'payment_not_verified';
            break;
          }
        }
        if (await finishApplied(event.type)) break;

        const tier = await resolveTierFromSession(session.id, budget);
        const customerId = stripeId(session.customer);
        if (!paymentMode && subscriptionId) {
          const first = subscriptionPaymentDecision({ subscription: await readLiveSubscription(subscriptionId, budget) });
          const payment = subscriptionPaymentDecision({ subscription: await readLiveSubscription(subscriptionId, budget) });
          if (!first.grant || !payment.grant) {
            const reason = deniedPaymentReason(payment) ?? deniedPaymentReason(first) ?? 'subscription_not_entitled';
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} ${reason} — not granting`);
            ignored = reason === 'zero_amount' ? 'zero_amount' : 'subscription_not_entitled';
            break;
          }
        }

        const prevTier = await getUserTier(userId).catch(() => 'unknown');
        await commitGrant({
          userId,
          patch: {
            accessTier: tier,
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscriptionId ?? undefined,
            ...(isLifetimePurchase ? { lifetimeAccess: true, lifetimePurchasedAt: new Date() } : {}),
          },
          audit: {
            fromTier: prevTier,
            toTier: tier,
            reason: event.type,
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscriptionId ?? undefined,
          },
        });
        if (ignored === 'revoke_not_applied') break;
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
        const invoice = event.data.object as Parameters<typeof subscriptionIdFromInvoice>[0] & {
          id?: string;
          customer?: unknown;
          amount_paid?: number | null;
          total?: number | null;
        };
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
        const first = subscriptionPaymentDecision({
          subscription: await readLiveSubscription(subscriptionId, budget),
          eventAmountPaid: invoice.amount_paid,
          eventTotal: invoice.total,
        });
        const confirmed = await readLiveSubscription(subscriptionId, budget);
        const payment = subscriptionPaymentDecision({
          subscription: confirmed,
          eventAmountPaid: invoice.amount_paid,
          eventTotal: invoice.total,
        });
        if (!first.grant || !payment.grant) {
          const reason = deniedPaymentReason(payment) ?? deniedPaymentReason(first) ?? 'subscription_not_entitled';
          console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} ${reason} — not re-granting`);
          ignored = reason === 'zero_amount' || reason === 'amount_mismatch' ? 'zero_amount' : 'subscription_not_entitled';
          break;
        }
        const tier = tierFromLiveSubscription(subscriptionId, confirmed);
        await commitGrant({
          userId: user.id,
          patch: { accessTier: tier, stripeSubscriptionId: subscriptionId },
          audit: {
            fromTier: user.accessTier,
            toTier: tier,
            reason: 'invoice.paid',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          },
        });
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
        if (await finishApplied('customer.subscription.deleted')) break;
        const decision = await revocationDecision(customerId, subscriptionId, budget);
        if (decision === 'keep') {
          console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} still entitled or customer has another active subscription — not downgrading`);
          ignored = 'subscription_not_entitled';
          break;
        }
        await commitGrant({
          userId: user.id,
          revokeSubscriptionId: subscriptionId,
          audit: {
            fromTier: user.accessTier,
            toTier: 'free',
            reason: 'customer.subscription.deleted',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          },
        });
        if (ignored !== 'revoke_not_applied') {
          console.log(`[Stripe Webhook] User ${user.id} downgraded to free (subscription cancelled)`);
        }
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
          const first = subscriptionPaymentDecision({ subscription: await readLiveSubscription(subscriptionId, budget) });
          const confirmed = await readLiveSubscription(subscriptionId, budget);
          const payment = subscriptionPaymentDecision({ subscription: confirmed });
          if (!first.grant || !payment.grant) {
            const reason = deniedPaymentReason(payment) ?? deniedPaymentReason(first) ?? 'subscription_not_entitled';
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} ${reason} — not granting`);
            ignored = reason === 'zero_amount' ? 'zero_amount' : 'subscription_not_entitled';
            break;
          }
          const tier = tierFromLiveSubscription(subscriptionId, confirmed);
          await commitGrant({
            userId: user.id,
            patch: { accessTier: tier, stripeSubscriptionId: subscriptionId },
            audit: {
              fromTier: user.accessTier,
              toTier: tier,
              reason: 'customer.subscription.updated',
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
            },
          });
          console.log(`[Stripe Webhook] User ${user.id} tier updated to ${tier} via subscription update (${subscriptionId})`);
        } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
          const decision = await revocationDecision(customerId, subscriptionId, budget);
          if (decision === 'keep') {
            console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} subscription ${subscriptionId} status ${status} is stale — live subscription still entitled, not downgrading`);
            ignored = 'subscription_not_entitled';
            break;
          }
          await commitGrant({
            userId: user.id,
            revokeSubscriptionId: subscriptionId,
            audit: {
              fromTier: user.accessTier,
              toTier: 'free',
              reason: `customer.subscription.updated:${status}`,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
            },
          });
          if (ignored !== 'revoke_not_applied') {
            console.log(`[Stripe Webhook] User ${user.id} downgraded to free (subscription ${subscriptionId} status: ${status})`);
          }
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
    if (err instanceof StaleStripeWebhookClaimError) {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} lost the claim fence; not sealing or releasing the current attempt`);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
    if (err instanceof UnresolvedPlanError) {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.type} ${event.id}: ${err.message}. No access granted. Claim retained.`);
      if (!(await retainClaim())) {
        return res.status(500).json({ error: 'Webhook processing failed' });
      }
      return res.status(200).json({ received: true, ignored: 'unresolved_plan' });
    }
    console.error('[Stripe Webhook] Error processing event:', err);
    if (!entitlementWritten) {
      try {
        await releaseStripeWebhookEvent(event.id, attempt.attemptId, event.type);
      } catch (releaseErr) {
        console.error(`[Stripe Webhook][BILLING-ALERT] Failed to release idempotency claim for ${event.id}; event remains claimable for retry:`, releaseErr);
      }
    } else {
      console.error(`[Stripe Webhook][BILLING-ALERT] ${event.id} failed after an entitlement write. Claim retained so the grant is not replayed.`);
      await retainClaim();
    }
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  if (!(await retainClaim())) {
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
  return res.json(ignored ? { received: true, ignored } : { received: true });
}
