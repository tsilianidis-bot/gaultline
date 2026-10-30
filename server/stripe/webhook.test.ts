/**
 * Webhook handler tests for the convergent entitlement re-sync.
 * Stripe reads are mocked. The MariaDB harness covers the row lock and fence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleStripeWebhook, webhookStripeBudgetMs, STRIPE_WEBHOOK_MAX_READS, STRIPE_WEBHOOK_READ_TIMEOUT_MS, STRIPE_WEBHOOK_MAX_NETWORK_RETRIES, STRIPE_WEBHOOK_RETRY_BACKOFF_MS } from './webhook';

vi.mock('./client', () => {
  const stripe = {
    webhooks: { constructEvent: vi.fn() },
    checkout: { sessions: { retrieve: vi.fn(), list: vi.fn() } },
    subscriptions: { retrieve: vi.fn(), list: vi.fn() },
    charges: { retrieve: vi.fn() },
    invoicePayments: { list: vi.fn() },
  };
  return { stripe, requireStripe: () => stripe };
});

vi.mock('../db', () => {
  class StaleStripeWebhookClaimError extends Error {}
  class ZeroRowEntitlementWriteError extends Error {}
  return {
    getUserByStripeCustomerId: vi.fn(),
    getUserByLifetimePaymentIntentId: vi.fn(),
    getEntitlementUserById: vi.fn(),
    getEntitlementRevision: vi.fn().mockResolvedValue(0),
    recordStripeWebhookEvent: vi.fn(),
    releaseStripeWebhookEvent: vi.fn(),
    completeStripeWebhookEvent: vi.fn(),
    commitEntitlementResync: vi.fn().mockResolvedValue('applied'),
    upsertStripeCancellationMarker: vi.fn().mockResolvedValue(undefined),
    listStripeCancellationMarkers: vi.fn().mockResolvedValue([]),
    listPurchaseRevocations: vi.fn().mockResolvedValue([]),
    applyPurchaseRevocation: vi.fn().mockResolvedValue({ applied: true, stale: false }),
    writeEntitlementAudit: vi.fn().mockResolvedValue(undefined),
    StaleStripeWebhookClaimError,
    ZeroRowEntitlementWriteError,
  };
});

vi.mock('../_core/env', () => ({ ENV: { stripeWebhookSecret: 'whsec_test_secret' } }));
vi.mock('./products', () => ({ getPlanByPriceId: vi.fn() }));
vi.mock('../email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  buildSubscriptionConfirmationEmail: vi.fn(() => ({ to: 'a@b.c', subject: 's', html: 'h' })),
}));

import { stripe } from './client';
import {
  getUserByStripeCustomerId,
  getUserByLifetimePaymentIntentId,
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
} from '../db';
import { getPlanByPriceId } from './products';
import { PRICING_PLANS } from '../../shared/tiers';

const ATTEMPT = { attemptId: 'a1b2c3d4e5f67890' };
const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_900_000_000;

function makeReq(body: unknown, sig = 'valid-sig'): Request {
  return { headers: { 'stripe-signature': sig }, body: Buffer.from(JSON.stringify(body)) } as unknown as Request;
}

function makeRes() {
  const res = {
    _status: 200,
    _body: null as unknown,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  res.status.mockImplementation((code: number) => { res._status = code; return res; });
  res.json.mockImplementation((body: unknown) => { res._body = body; return res; });
  return res as unknown as Response & { _status: number; _body: unknown };
}

function premiumSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_live',
    status: 'active',
    current_period_start: PERIOD_START,
    current_period_end: PERIOD_END,
    latest_invoice: { id: 'in_paid', status: 'paid', amount_paid: 5900, total: 5900, created: PERIOD_START },
    items: { data: [{ price: { id: 'price_premium' } }] },
    ...overrides,
  };
}

function usePicture(subscription = premiumSub(), sessions: object[] = []) {
  vi.mocked(stripe.subscriptions.list).mockResolvedValue({ data: [subscription], has_more: false } as never);
  vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(subscription as never);
  vi.mocked(stripe.checkout.sessions.list).mockResolvedValue({ data: sessions, has_more: false } as never);
}

async function post(event: object) {
  vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(event as never);
  const res = makeRes();
  await handleStripeWebhook(makeReq(event), res);
  return res;
}

describe('handleStripeWebhook re-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recordStripeWebhookEvent).mockResolvedValue(ATTEMPT);
    vi.mocked(releaseStripeWebhookEvent).mockResolvedValue(undefined);
    vi.mocked(completeStripeWebhookEvent).mockResolvedValue(undefined);
    vi.mocked(commitEntitlementResync).mockResolvedValue('applied');
    vi.mocked(listStripeCancellationMarkers).mockResolvedValue([]);
    vi.mocked(listPurchaseRevocations).mockResolvedValue([]);
    vi.mocked(applyPurchaseRevocation).mockResolvedValue({ applied: true, stale: false });
    vi.mocked(writeEntitlementAudit).mockResolvedValue(undefined);
    vi.mocked(getPlanByPriceId).mockImplementation((priceId: string) => (
      priceId === 'price_premium' ? { id: 'premium', tier: 'premium', name: 'Pro', amount: 5900, interval: 'month', description: '', priceId } as never : undefined
    ));
    vi.mocked(getEntitlementRevision).mockResolvedValue(0);
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'free', lifetimeAccess: false,
    });
    vi.mocked(getUserByLifetimePaymentIntentId).mockResolvedValue(null);
    vi.mocked(stripe.invoicePayments.list).mockResolvedValue({ data: [], has_more: false } as never);
    vi.mocked(getEntitlementUserById).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'free', lifetimeAccess: false,
    });
    usePicture();
    expect(webhookStripeBudgetMs()).toBe(
      STRIPE_WEBHOOK_MAX_READS * (STRIPE_WEBHOOK_READ_TIMEOUT_MS * (STRIPE_WEBHOOK_MAX_NETWORK_RETRIES + 1) + STRIPE_WEBHOOK_MAX_NETWORK_RETRIES * STRIPE_WEBHOOK_RETRY_BACKOFF_MS),
    );
    expect(webhookStripeBudgetMs()).toBeLessThan(90_000);
  });

  it('does not bypass signature verification for evt_test_ events', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => { throw new Error('bad signature'); });
    const res = makeRes();
    await handleStripeWebhook(makeReq({ id: 'evt_test_abc', type: 'checkout.session.completed' }, 'invalid'), res);
    expect(res._status).toBe(400);
    expect(recordStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it('acknowledges a duplicate without reading Stripe', async () => {
    vi.mocked(recordStripeWebhookEvent).mockResolvedValue(null);
    const res = await post({ id: 'evt_dup', type: 'invoice.paid', created: 10, data: { object: { customer: 'cus_a' } } });
    expect(res._body).toEqual({ received: true, duplicate: true });
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(commitEntitlementResync).not.toHaveBeenCalled();
  });

  it('high 1: a zero-row entitlement write is not sealed', async () => {
    vi.mocked(commitEntitlementResync).mockRejectedValue(new ZeroRowEntitlementWriteError('evt_zero'));
    const res = await post({
      id: 'evt_zero', type: 'invoice.paid', created: PERIOD_START, data: { object: { id: 'in_1', customer: 'cus_a' } },
    });
    expect(res._status).toBe(500);
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
    expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_zero', ATTEMPT.attemptId, 'invoice.paid');
  });

  it('high 2: a stale active list after a cancellation is not sealed as a keep', async () => {
    vi.mocked(listStripeCancellationMarkers).mockResolvedValue([
      { stripeSubscriptionId: 'sub_live', canceledEventCreated: PERIOD_START + 20, status: 'canceled' },
    ]);
    const res = await post({
      id: 'evt_cancel',
      type: 'customer.subscription.deleted',
      created: PERIOD_START + 20,
      data: { object: { id: 'sub_live', customer: 'cus_a', status: 'canceled' } },
    });
    expect(res._status).toBe(500);
    expect(upsertStripeCancellationMarker).toHaveBeenCalledWith(expect.objectContaining({
      stripeSubscriptionId: 'sub_live',
      canceledEventCreated: PERIOD_START + 20,
      status: 'canceled',
    }));
    expect(commitEntitlementResync).not.toHaveBeenCalled();
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
    expect(releaseStripeWebhookEvent).toHaveBeenCalled();
  });

  it('downgrades when the live list and the cancellation agree', async () => {
    usePicture(premiumSub({ status: 'canceled', ended_at: PERIOD_START + 20 }));
    const res = await post({
      id: 'evt_gone',
      type: 'customer.subscription.deleted',
      created: PERIOD_START + 20,
      data: { object: { id: 'sub_live', customer: 'cus_a', status: 'canceled' } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'free', stripeSubscriptionId: null, grantLifetime: false }),
    }));
  });

  it('renews a 100% coupon invoice and stores the period end', async () => {
    const coupon = premiumSub({
      latest_invoice: {
        id: 'in_coupon', status: 'paid', amount_paid: 0, total: 0, created: PERIOD_START,
        discount: { coupon: { id: 'coup_100' } },
      },
    });
    usePicture(coupon);
    const res = await post({
      id: 'evt_coupon', type: 'invoice.paid', created: PERIOD_START + 1,
      data: { object: { id: 'in_coupon', customer: 'cus_a', amount_paid: 0, total: 0 } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({
        accessTier: 'premium',
        accessExpiresAt: new Date(PERIOD_END * 1000),
        stripeSubscriptionId: 'sub_live',
      }),
    }));
  });

  it('does not grant lifetime from no_payment_required and does not clear an existing lifetime on a canceled subscription', async () => {
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'founding', lifetimeAccess: true,
    });
    vi.mocked(getEntitlementUserById).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'founding', lifetimeAccess: true,
    });
    usePicture(premiumSub({ status: 'canceled' }), [{
      id: 'cs_free', mode: 'payment', payment_status: 'no_payment_required', amount_total: 0,
      metadata: { plan_id: 'lifetime' }, payment_intent: null,
    }]);
    const res = await post({
      id: 'evt_life_cancel', type: 'customer.subscription.deleted', created: PERIOD_START + 5,
      data: { object: { id: 'sub_live', customer: 'cus_a', status: 'canceled' } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'founding', grantLifetime: true, stripeSubscriptionId: null }),
    }));
  });

  it('grants lifetime from a verified checkout session and clears a subscription when none entitles', async () => {
    usePicture(premiumSub({ status: 'canceled' }), [{
      id: 'cs_life', mode: 'payment', payment_status: 'paid', amount_total: 150000, created: PERIOD_START,
      metadata: { plan_id: 'lifetime' },
      payment_intent: { status: 'succeeded', amount_received: 150000, amount: 150000 },
    }]);
    const res = await post({
      id: 'evt_life', type: 'checkout.session.completed', created: PERIOD_START,
      data: { object: {
        id: 'cs_life', customer: 'cus_a', mode: 'payment', metadata: { user_id: '7', plan_id: 'lifetime' },
      } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'founding', grantLifetime: true, stripeSubscriptionId: null }),
    }));
  });

  it('keeps lifetime beside an active subscription', async () => {
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'founding', lifetimeAccess: true,
    });
    vi.mocked(getEntitlementUserById).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'founding', lifetimeAccess: true,
    });
    const res = await post({
      id: 'evt_both', type: 'invoice.paid', created: PERIOD_START,
      data: { object: { id: 'in_paid', customer: 'cus_a' } },
    });
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'founding', grantLifetime: true, stripeSubscriptionId: 'sub_live' }),
    }));
    expect(res._status).toBe(200);
  });

  it('resyncs a paused subscription to free', async () => {
    usePicture(premiumSub({ status: 'paused', pause_collection: { behavior: 'void' } }));
    const res = await post({
      id: 'evt_pause', type: 'customer.subscription.updated', created: PERIOD_START + 8,
      data: { object: { id: 'sub_live', customer: 'cus_a', status: 'paused', pause_collection: { behavior: 'void' } } },
    });
    expect(res._status).toBe(200);
    expect(upsertStripeCancellationMarker).toHaveBeenCalledWith(expect.objectContaining({ status: 'paused' }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'free' }),
    }));
  });

  it('does not downgrade on invoice.payment_failed while the corroborated subscription is still active', async () => {
    const res = await post({
      id: 'evt_fail', type: 'invoice.payment_failed', created: PERIOD_START + 3,
      data: { object: { id: 'in_fail', customer: 'cus_a' } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'premium', stripeSubscriptionId: 'sub_live' }),
    }));
    expect(stripe.subscriptions.retrieve).toHaveBeenCalled();
  });

  it('does not grant on checkout.session.async_payment_failed or expired', async () => {
    usePicture(premiumSub({ status: 'incomplete' }));
    for (const type of ['checkout.session.async_payment_failed', 'checkout.session.expired']) {
      vi.mocked(commitEntitlementResync).mockClear();
      const res = await post({
        id: `evt_${type}`, type, created: PERIOD_START,
        data: { object: { id: 'cs_wait', customer: 'cus_a', metadata: { user_id: '7' } } },
      });
      expect(res._status).toBe(200);
      expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
        desired: expect.objectContaining({ grantLifetime: false, accessTier: 'free' }),
      }));
    }
  });

  it('leaves an unknown price unfinished so it can be replayed, and keeps a cancellation on that event', async () => {
    usePicture(premiumSub({
      id: 'sub_known',
      items: { data: [{ price: { id: 'price_unknown' } }] },
    }));
    const res = await post({
      id: 'evt_price',
      type: 'customer.subscription.updated',
      created: PERIOD_START + 15,
      data: { object: { id: 'sub_cancel', customer: 'cus_a', status: 'canceled' } },
    });
    expect(res._status).toBe(500);
    expect(res._body).toEqual({ error: 'Webhook processing failed', conflict: 'unresolved_plan' });
    expect(upsertStripeCancellationMarker).toHaveBeenCalledWith(expect.objectContaining({
      stripeSubscriptionId: 'sub_cancel',
      status: 'canceled',
    }));
    expect(commitEntitlementResync).not.toHaveBeenCalled();
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
    expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it('does not release a lost fence', async () => {
    vi.mocked(commitEntitlementResync).mockResolvedValue('claim_lost');
    const res = await post({
      id: 'evt_lost', type: 'invoice.paid', created: PERIOD_START,
      data: { object: { id: 'in_paid', customer: 'cus_a' } },
    });
    expect(res._status).toBe(500);
    expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
    expect(StaleStripeWebhookClaimError).toBeDefined();
  });

  it('returns 500 and releases when the entitlement read throws', async () => {
    vi.mocked(stripe.subscriptions.list).mockRejectedValue(new Error('ECONNRESET'));
    const res = await post({
      id: 'evt_reset', type: 'invoice.paid', created: PERIOD_START,
      data: { object: { id: 'in_paid', customer: 'cus_a' } },
    });
    expect(res._status).toBe(500);
    expect(releaseStripeWebhookEvent).toHaveBeenCalled();
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it('does not seal when a second subscription page still has more', async () => {
    vi.mocked(stripe.subscriptions.list)
      .mockResolvedValueOnce({ data: [premiumSub()], has_more: true } as never)
      .mockResolvedValueOnce({ data: [premiumSub({ id: 'sub_page2' })], has_more: true } as never);
    const res = await post({
      id: 'evt_pages', type: 'customer.subscription.updated', created: PERIOD_START,
      data: { object: { id: 'sub_live', customer: 'cus_a', status: 'active' } },
    });
    expect(res._status).toBe(500);
    expect(commitEntitlementResync).not.toHaveBeenCalled();
    expect(stripe.subscriptions.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100, status: 'all' }),
      expect.objectContaining({ timeout: 4_000, maxNetworkRetries: 1 }),
    );
  });

  it('reads the entitlement period from subscription items when the subscription object has none', async () => {
    const itemPeriod = premiumSub({
      current_period_start: null,
      current_period_end: null,
      items: { data: [{ price: { id: 'price_premium' }, current_period_start: PERIOD_START, current_period_end: PERIOD_END }] },
    });
    usePicture(itemPeriod);
    const res = await post({
      id: 'evt_items', type: 'invoice.paid', created: PERIOD_START,
      data: { object: { id: 'in_paid', customer: 'cus_a' } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      observedRevision: 0,
      desired: expect.objectContaining({
        accessTier: 'premium',
        accessExpiresAt: new Date(PERIOD_END * 1000),
        stripeCustomerId: 'cus_a',
      }),
    }));
  });

  it('resolves a subscription event by metadata when the customer id is not stored yet', async () => {
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);
    const res = await post({
      id: 'evt_meta', type: 'customer.subscription.updated', created: PERIOD_START,
      data: { object: { id: 'sub_live', customer: 'cus_new', status: 'active', metadata: { user_id: '7' } } },
    });
    expect(res._status).toBe(200);
    expect(getEntitlementUserById).toHaveBeenCalledWith(7);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      desired: expect.objectContaining({ stripeCustomerId: 'cus_new', accessTier: 'premium' }),
    }));
  });

  it('does not acknowledge a grant event whose user cannot be resolved', async () => {
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);
    vi.mocked(getEntitlementUserById).mockResolvedValue(null);
    const res = await post({
      id: 'evt_nouser', type: 'invoice.paid', created: PERIOD_START,
      data: { object: { id: 'in_paid', customer: 'cus_missing' } },
    });
    expect(res._status).toBe(500);
    expect(res._body).toEqual({ error: 'Webhook processing failed', conflict: 'missing_user' });
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
    expect(commitEntitlementResync).not.toHaveBeenCalled();
    expect(releaseStripeWebhookEvent).toHaveBeenCalled();
  });

  it('renews a paid invoice settled by customer credit', async () => {
    const credit = premiumSub({
      latest_invoice: { id: 'in_credit', status: 'paid', amount_paid: 0, total: 5900, created: PERIOD_START },
    });
    usePicture(credit);
    const res = await post({
      id: 'evt_credit', type: 'invoice.paid', created: PERIOD_START + 2,
      data: { object: { id: 'in_credit', customer: 'cus_a', amount_paid: 0, total: 5900 } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({
        accessTier: 'premium',
        accessExpiresAt: new Date(PERIOD_END * 1000),
      }),
    }));
  });

  it('restores a same-period unpause when the resume event is newer than the marker and the live read agrees', async () => {
    vi.mocked(listStripeCancellationMarkers).mockResolvedValue([
      { stripeSubscriptionId: 'sub_live', canceledEventCreated: PERIOD_START + 10, status: 'paused', supersededEventCreated: null },
    ]);
    const resumed = premiumSub({ pause_collection: null });
    usePicture(resumed);
    const res = await post({
      id: 'evt_resume', type: 'customer.subscription.updated', created: PERIOD_START + 30,
      data: { object: { id: 'sub_live', customer: 'cus_a', status: 'active', pause_collection: null } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      supersedeCancellation: { stripeSubscriptionId: 'sub_live', eventCreated: PERIOD_START + 30 },
      desired: expect.objectContaining({ accessTier: 'premium', stripeSubscriptionId: 'sub_live' }),
    }));
  });

  it('does not let a second checkout customer replace a stored customer or seal free', async () => {
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);
    vi.mocked(getEntitlementUserById).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'premium', lifetimeAccess: false, stripeCustomerId: 'cus_paid',
    });
    usePicture(premiumSub({ id: 'sub_new', status: 'incomplete' }));
    const res = await post({
      id: 'evt_second_customer',
      type: 'checkout.session.completed',
      created: PERIOD_START + 90,
      data: { object: {
        id: 'cs_second',
        customer: 'cus_new',
        mode: 'subscription',
        metadata: { user_id: '7', plan_id: 'premium' },
        client_reference_id: '7',
      } },
    });
    expect(res._status).toBe(500);
    expect(res._body).toEqual({ error: 'Webhook processing failed', conflict: 'customer_conflict' });
    expect(commitEntitlementResync).not.toHaveBeenCalled();
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
    expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(writeEntitlementAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      reason: 'customer_conflict',
      stripeCustomerId: 'cus_new',
      stripeEventId: 'evt_second_customer',
    }));
  });

  it('recomputes instead of sealing the snapshot that lost the revision race', async () => {
    vi.mocked(commitEntitlementResync)
      .mockResolvedValueOnce('stale_state')
      .mockResolvedValueOnce('applied');
    const res = await post({
      id: 'evt_recompute', type: 'invoice.paid', created: PERIOD_START,
      data: { object: { id: 'in_paid', customer: 'cus_a' } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledTimes(2);
    expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
  });
});

const STANDARD_CENTS = PRICING_PLANS.premium.amountCents;
const LIFETIME_CENTS = PRICING_PLANS.lifetime.amountCents;

function chargeEvent(type: string, object: Record<string, unknown>, created = PERIOD_START + 40) {
  return { id: `evt_${type.replace(/\./g, '_')}_${object.id ?? 'x'}`, type, created, data: { object } };
}

function lifetimeSession(paymentIntentId: string) {
  return {
    id: 'cs_life',
    mode: 'payment',
    payment_status: 'paid',
    amount_total: LIFETIME_CENTS,
    created: PERIOD_START,
    metadata: { plan_id: 'lifetime' },
    payment_intent: { id: paymentIntentId, status: 'succeeded', amount_received: LIFETIME_CENTS, amount: LIFETIME_CENTS },
  };
}

describe('refund and dispute entitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recordStripeWebhookEvent).mockResolvedValue(ATTEMPT);
    vi.mocked(releaseStripeWebhookEvent).mockResolvedValue(undefined);
    vi.mocked(completeStripeWebhookEvent).mockResolvedValue(undefined);
    vi.mocked(commitEntitlementResync).mockResolvedValue('applied');
    vi.mocked(listStripeCancellationMarkers).mockResolvedValue([]);
    vi.mocked(listPurchaseRevocations).mockResolvedValue([]);
    vi.mocked(applyPurchaseRevocation).mockResolvedValue({ applied: true, stale: false });
    vi.mocked(writeEntitlementAudit).mockResolvedValue(undefined);
    vi.mocked(getPlanByPriceId).mockImplementation((priceId: string) => (
      priceId === 'price_premium' ? { id: 'premium', tier: 'premium', name: 'FAULTLINE Intelligence', amount: STANDARD_CENTS, interval: 'month', description: '', priceId } as never : undefined
    ));
    vi.mocked(getEntitlementRevision).mockResolvedValue(0);
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'premium', lifetimeAccess: false, stripeCustomerId: 'cus_a',
    });
    vi.mocked(getUserByLifetimePaymentIntentId).mockResolvedValue(null);
    vi.mocked(getEntitlementUserById).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'premium', lifetimeAccess: false, stripeCustomerId: 'cus_a',
    });
    vi.mocked(stripe.invoicePayments.list).mockImplementation(async (params: { payment?: { payment_intent?: string } }) => {
      const paymentIntentId = params?.payment?.payment_intent;
      const invoiceId = paymentIntentId === 'pi_std' ? 'in_paid'
        : paymentIntentId === 'pi_old' ? 'in_old'
        : paymentIntentId === 'pi_coupon' ? 'in_coupon'
        : null;
      return {
        data: invoiceId ? [{
          id: `inpay_${invoiceId}`,
          object: 'invoice_payment',
          invoice: invoiceId,
          status: 'paid',
          payment: { type: 'payment_intent', payment_intent: paymentIntentId },
        }] : [],
        has_more: false,
      } as never;
    });
    usePicture();
    expect(STANDARD_CENTS).toBe(9900);
    expect(PRICING_PLANS.premium.priceLabel).toBe('$99/month');
    expect(LIFETIME_CENTS).toBe(150000);
    expect(PRICING_PLANS.lifetime.priceLabel).toBe('$1,500 one-time');
  });

  it('revokes Standard access on a full refund of the current $99 invoice and audits the source timestamp', async () => {
    vi.mocked(listPurchaseRevocations).mockResolvedValue([{
      purchaseKey: 'invoice:in_paid',
      reasonKind: 'full_refund',
      purchaseKind: 'subscription',
      chargeId: 'ch_std',
      invoiceId: 'in_paid',
      paymentIntentId: null,
      subscriptionId: 'sub_live',
      disputeId: null,
      disputeOutcome: null,
      active: true,
      sourceEventId: 'evt_charge_refunded_ch_std',
      sourceEventCreated: PERIOD_START + 40,
      userId: 7,
    }]);
    const res = await post(chargeEvent('charge.refunded', {
      id: 'ch_std',
      object: 'charge',
      amount: STANDARD_CENTS,
      amount_refunded: STANDARD_CENTS,
      refunded: true,
      customer: 'cus_a',
      payment_intent: 'pi_std',
    }));
    expect(res._status).toBe(200);
    expect(stripe.invoicePayments.list).toHaveBeenCalledWith(
      { payment: { type: 'payment_intent', payment_intent: 'pi_std' }, limit: 10 },
      expect.objectContaining({ timeout: 4_000, maxNetworkRetries: 1 }),
    );
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({
      purchaseKind: 'subscription',
      invoiceId: 'in_paid',
      active: true,
      reasonKind: 'full_refund',
      sourceEventCreated: PERIOD_START + 40,
      userId: 7,
    }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      observedRevocations: expect.arrayContaining([expect.objectContaining({ invoiceId: 'in_paid', active: true })]),
      desired: expect.objectContaining({ accessTier: 'free', grantLifetime: false, revokeLifetime: false, stripeSubscriptionId: null }),
      eventId: 'evt_charge_refunded_ch_std',
      audit: expect.objectContaining({
        reason: 'charge.refunded:full',
        sourceEventCreated: PERIOD_START + 40,
      }),
    }));
  });

  it('does not revoke on a partial refund of the Standard charge', async () => {
    const res = await post(chargeEvent('charge.refunded', {
      id: 'ch_partial',
      amount: STANDARD_CENTS,
      amount_refunded: 1000,
      refunded: false,
      customer: 'cus_a',
      payment_intent: 'pi_std',
    }));
    expect(res._status).toBe(200);
    expect(applyPurchaseRevocation).not.toHaveBeenCalled();
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'premium', stripeSubscriptionId: 'sub_live' }),
      audit: expect.objectContaining({ reason: 'charge.refunded:partial', sourceEventCreated: PERIOD_START + 40 }),
    }));
  });

  it('revokes Lifetime on a full refund and leaves an unrelated Standard subscription in place', async () => {
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'founding', lifetimeAccess: true, stripeCustomerId: 'cus_a', lifetimePaymentIntentId: 'pi_life',
    });
    vi.mocked(getEntitlementUserById).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'founding', lifetimeAccess: true, stripeCustomerId: 'cus_a', lifetimePaymentIntentId: 'pi_life',
    });
    usePicture(premiumSub(), [lifetimeSession('pi_life')]);
    vi.mocked(listPurchaseRevocations).mockResolvedValue([{
      purchaseKey: 'pi:pi_life',
      reasonKind: 'full_refund',
      purchaseKind: 'lifetime',
      chargeId: 'ch_life',
      invoiceId: null,
      paymentIntentId: 'pi_life',
      subscriptionId: null,
      disputeId: null,
      disputeOutcome: null,
      active: true,
      sourceEventId: 'evt_charge_refunded_ch_life',
      sourceEventCreated: PERIOD_START + 40,
      userId: 7,
    }]);
    const res = await post(chargeEvent('charge.refunded', {
      id: 'ch_life',
      amount: LIFETIME_CENTS,
      amount_refunded: LIFETIME_CENTS,
      refunded: true,
      customer: 'cus_a',
      payment_intent: 'pi_life',
    }));
    expect(res._status).toBe(200);
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({
      purchaseKind: 'lifetime',
      paymentIntentId: 'pi_life',
      active: true,
    }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({
        accessTier: 'premium',
        grantLifetime: false,
        revokeLifetime: true,
        stripeSubscriptionId: 'sub_live',
      }),
      audit: expect.objectContaining({ reason: 'charge.refunded:full', sourceEventCreated: PERIOD_START + 40 }),
    }));
  });

  it('retries a customer charge when InvoicePayment is empty and does not seal it as unrelated', async () => {
    const res = await post(chargeEvent('charge.refunded', {
      id: 'ch_other',
      amount: 500,
      amount_refunded: 500,
      refunded: true,
      customer: 'cus_a',
      payment_intent: 'pi_other',
    }));
    expect(res._status).toBe(500);
    expect(res._body).toEqual({ error: 'Webhook processing failed', conflict: 'invoice_unlinked' });
    expect(applyPurchaseRevocation).not.toHaveBeenCalled();
    expect(commitEntitlementResync).not.toHaveBeenCalled();
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
    expect(releaseStripeWebhookEvent).toHaveBeenCalled();
  });

  it('does not let a customer-less non-lifetime charge revoke a coupon renewal or Lifetime', async () => {
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);
    vi.mocked(getEntitlementUserById).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'founding', lifetimeAccess: true, stripeCustomerId: 'cus_a', lifetimePaymentIntentId: 'pi_life',
    });
    const coupon = premiumSub({
      latest_invoice: {
        id: 'in_coupon', status: 'paid', amount_paid: 0, total: 0, created: PERIOD_START,
        discount: { coupon: { id: 'coup_100' } },
      },
    });
    usePicture(coupon, [lifetimeSession('pi_life')]);
    const res = await post(chargeEvent('charge.refunded', {
      id: 'ch_other',
      amount: 500,
      amount_refunded: 500,
      refunded: true,
      customer: null,
      payment_intent: 'pi_other',
      metadata: { user_id: '7' },
    }));
    expect(res._status).toBe(200);
    expect(applyPurchaseRevocation).not.toHaveBeenCalled();
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({
        accessTier: 'founding',
        grantLifetime: true,
        revokeLifetime: false,
        stripeSubscriptionId: 'sub_live',
        lifetimePaymentIntentId: 'pi_life',
        stripeCustomerId: 'cus_a',
      }),
      audit: expect.objectContaining({ reason: 'charge.refunded:unrelated', sourceEventCreated: PERIOD_START + 40 }),
    }));
  });

  it('does not revoke a 100% coupon invoice when its zero-amount charge is refunded', async () => {
    const coupon = premiumSub({
      latest_invoice: {
        id: 'in_coupon', status: 'paid', amount_paid: 0, total: 0, created: PERIOD_START,
        discount: { coupon: { id: 'coup_100' } },
      },
    });
    usePicture(coupon);
    const res = await post(chargeEvent('charge.refunded', {
      id: 'ch_zero',
      amount: 0,
      amount_refunded: 0,
      refunded: true,
      customer: 'cus_a',
      payment_intent: 'pi_coupon',
    }));
    expect(res._status).toBe(200);
    expect(applyPurchaseRevocation).not.toHaveBeenCalled();
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'premium', stripeSubscriptionId: 'sub_live' }),
      audit: expect.objectContaining({ reason: 'charge.refunded:none' }),
    }));
  });

  it('does not revoke a newer paid invoice when an older charge is refunded', async () => {
    usePicture(premiumSub({
      latest_invoice: { id: 'in_new', status: 'paid', amount_paid: STANDARD_CENTS, total: STANDARD_CENTS, created: PERIOD_START + 80 },
    }));
    vi.mocked(listPurchaseRevocations).mockResolvedValue([{
      purchaseKey: 'invoice:in_old',
      reasonKind: 'full_refund',
      purchaseKind: 'subscription',
      chargeId: 'ch_old',
      invoiceId: 'in_old',
      paymentIntentId: null,
      subscriptionId: null,
      disputeId: null,
      disputeOutcome: null,
      active: true,
      sourceEventId: 'evt_charge_refunded_ch_old',
      sourceEventCreated: PERIOD_START + 10,
      userId: 7,
    }]);
    const res = await post(chargeEvent('charge.refunded', {
      id: 'ch_old',
      amount: STANDARD_CENTS,
      amount_refunded: STANDARD_CENTS,
      refunded: true,
      customer: 'cus_a',
      payment_intent: 'pi_old',
    }, PERIOD_START + 10));
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'premium', stripeSubscriptionId: 'sub_live' }),
    }));
  });

  it('revokes on dispute.created and does not re-grant when that event is stale after a newer won', async () => {
    vi.mocked(applyPurchaseRevocation).mockResolvedValue({ applied: false, stale: true });
    vi.mocked(listPurchaseRevocations).mockResolvedValue([]);
    const res = await post({
      id: 'evt_dispute_created_late',
      type: 'charge.dispute.created',
      created: PERIOD_START + 10,
      data: { object: {
        id: 'dp_1',
        charge: {
          id: 'ch_std',
          amount: STANDARD_CENTS,
          amount_refunded: 0,
          refunded: false,
          customer: 'cus_a',
          payment_intent: 'pi_std',
        },
        status: 'needs_response',
        amount: STANDARD_CENTS,
      } },
    });
    expect(res._status).toBe(200);
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({
      active: true,
      disputeId: 'dp_1',
      reasonKind: 'dispute:dp_1',
      sourceEventCreated: PERIOD_START + 10,
    }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'premium', stripeSubscriptionId: 'sub_live' }),
      audit: expect.objectContaining({ reason: 'charge.dispute.created:stale', sourceEventCreated: PERIOD_START + 10 }),
    }));
  });

  function mockStandardCharge() {
    vi.mocked(stripe.charges.retrieve).mockResolvedValue({
      id: 'ch_std',
      amount: STANDARD_CENTS,
      amount_refunded: 0,
      refunded: false,
      customer: 'cus_a',
      payment_intent: 'pi_std',
    } as never);
  }

  it('restores Standard access when a dispute is won and no other revocation remains', async () => {
    mockStandardCharge();
    vi.mocked(listPurchaseRevocations).mockResolvedValue([{
      purchaseKey: 'invoice:in_paid',
      reasonKind: 'dispute:dp_1',
      purchaseKind: 'subscription',
      chargeId: 'ch_std',
      invoiceId: 'in_paid',
      paymentIntentId: null,
      subscriptionId: 'sub_live',
      disputeId: 'dp_1',
      disputeOutcome: 'won',
      active: false,
      sourceEventId: 'evt_won',
      sourceEventCreated: PERIOD_START + 80,
      userId: 7,
    }]);
    const res = await post({
      id: 'evt_won',
      type: 'charge.dispute.closed',
      created: PERIOD_START + 80,
      data: { object: { id: 'dp_1', status: 'won', charge: 'ch_std' } },
    });
    expect(res._status).toBe(200);
    expect(stripe.charges.retrieve).toHaveBeenCalledWith('ch_std', {}, expect.objectContaining({ timeout: 4_000, maxNetworkRetries: 1 }));
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({
      active: false,
      disputeOutcome: 'won',
      disputeId: 'dp_1',
      sourceEventCreated: PERIOD_START + 80,
    }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'premium', stripeSubscriptionId: 'sub_live', revokeLifetime: false }),
      eventId: 'evt_won',
      audit: expect.objectContaining({ reason: 'charge.dispute.closed:won', sourceEventCreated: PERIOD_START + 80 }),
    }));
  });

  it('keeps Standard revoked when the dispute is lost', async () => {
    mockStandardCharge();
    vi.mocked(listPurchaseRevocations).mockResolvedValue([{
      purchaseKey: 'invoice:in_paid',
      reasonKind: 'dispute:dp_1',
      purchaseKind: 'subscription',
      chargeId: 'ch_std',
      invoiceId: 'in_paid',
      paymentIntentId: null,
      subscriptionId: 'sub_live',
      disputeId: 'dp_1',
      disputeOutcome: 'lost',
      active: true,
      sourceEventId: 'evt_lost_dispute',
      sourceEventCreated: PERIOD_START + 90,
      userId: 7,
    }]);
    const res = await post({
      id: 'evt_lost_dispute',
      type: 'charge.dispute.closed',
      created: PERIOD_START + 90,
      data: { object: { id: 'dp_1', status: 'lost', charge: 'ch_std' } },
    });
    expect(res._status).toBe(200);
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({ active: true, disputeOutcome: 'lost' }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'free', stripeSubscriptionId: null }),
      audit: expect.objectContaining({ reason: 'charge.dispute.closed:lost', sourceEventCreated: PERIOD_START + 90 }),
    }));
  });

  it('does not restore access when a dispute is won but the full refund is still active', async () => {
    mockStandardCharge();
    vi.mocked(listPurchaseRevocations).mockResolvedValue([
      {
        purchaseKey: 'invoice:in_paid',
        reasonKind: 'full_refund',
        purchaseKind: 'subscription',
        chargeId: 'ch_std',
        invoiceId: 'in_paid',
        paymentIntentId: null,
        subscriptionId: 'sub_live',
        disputeId: null,
        disputeOutcome: null,
        active: true,
        sourceEventId: 'evt_refund',
        sourceEventCreated: PERIOD_START + 20,
        userId: 7,
      },
      {
        purchaseKey: 'invoice:in_paid',
        reasonKind: 'dispute:dp_1',
        purchaseKind: 'subscription',
        chargeId: 'ch_std',
        invoiceId: 'in_paid',
        paymentIntentId: null,
        subscriptionId: 'sub_live',
        disputeId: 'dp_1',
        disputeOutcome: 'won',
        active: false,
        sourceEventId: 'evt_won_refunded',
        sourceEventCreated: PERIOD_START + 80,
        userId: 7,
      },
    ]);
    const res = await post({
      id: 'evt_won_refunded',
      type: 'charge.dispute.closed',
      created: PERIOD_START + 80,
      data: { object: { id: 'dp_1', status: 'won', charge: 'ch_std' } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'free', grantLifetime: false, stripeSubscriptionId: null }),
      audit: expect.objectContaining({ reason: 'charge.dispute.closed:won' }),
    }));
  });

  it('acknowledges a replayed refund without reading Stripe or writing again', async () => {
    vi.mocked(recordStripeWebhookEvent).mockResolvedValue(null);
    const res = await post(chargeEvent('charge.refunded', {
      id: 'ch_std',
      amount: STANDARD_CENTS,
      amount_refunded: STANDARD_CENTS,
      refunded: true,
      customer: 'cus_a',
      payment_intent: 'pi_std',
    }));
    expect(res._body).toEqual({ received: true, duplicate: true });
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(applyPurchaseRevocation).not.toHaveBeenCalled();
    expect(commitEntitlementResync).not.toHaveBeenCalled();
  });

  it('acknowledges an unrecognized dispute close without an entitlement change', async () => {
    const res = await post({
      id: 'evt_unknown_close',
      type: 'charge.dispute.closed',
      created: PERIOD_START + 5,
      data: { object: { id: 'dp_x', status: 'under_review', charge: 'ch_std' } },
    });
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ received: true, ignored: 'unknown_dispute_status' });
    expect(applyPurchaseRevocation).not.toHaveBeenCalled();
    expect(commitEntitlementResync).not.toHaveBeenCalled();
    expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    expect(completeStripeWebhookEvent).toHaveBeenCalled();
  });

  it('revokes a customer-less Lifetime charge refund and dispute', async () => {
    const lifetimeUser = {
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'founding' as const, lifetimeAccess: true, stripeCustomerId: null, lifetimePaymentIntentId: 'pi_life',
    };
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);
    vi.mocked(getEntitlementUserById).mockResolvedValue(lifetimeUser);
    vi.mocked(getUserByLifetimePaymentIntentId).mockResolvedValue(null);
    vi.mocked(stripe.checkout.sessions.list).mockImplementation(async (params: { payment_intent?: string }) => {
      if (params?.payment_intent !== 'pi_life') return { data: [], has_more: false } as never;
      return {
        data: [{
          id: 'cs_life',
          mode: 'payment',
          payment_status: 'paid',
          amount_total: LIFETIME_CENTS,
          created: PERIOD_START,
          customer: null,
          client_reference_id: '7',
          metadata: { plan_id: 'lifetime', user_id: '7' },
          payment_intent: { id: 'pi_life', status: 'succeeded', amount_received: 0, amount: LIFETIME_CENTS },
        }],
        has_more: false,
      } as never;
    });
    vi.mocked(listPurchaseRevocations).mockResolvedValue([{
      purchaseKey: 'pi:pi_life',
      reasonKind: 'full_refund',
      purchaseKind: 'lifetime',
      chargeId: 'ch_life',
      invoiceId: null,
      paymentIntentId: 'pi_life',
      subscriptionId: null,
      disputeId: null,
      disputeOutcome: null,
      active: true,
      sourceEventId: 'evt_charge_refunded_ch_life',
      sourceEventCreated: PERIOD_START + 40,
      userId: 7,
    }]);
    const refund = await post(chargeEvent('charge.refunded', {
      id: 'ch_life',
      object: 'charge',
      amount: LIFETIME_CENTS,
      amount_refunded: LIFETIME_CENTS,
      refunded: true,
      customer: null,
      payment_intent: 'pi_life',
    }));
    expect(refund._status).toBe(200);
    expect(stripe.checkout.sessions.list).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_life', limit: 1 }),
      expect.objectContaining({ timeout: 4_000, maxNetworkRetries: 1 }),
    );
    expect(getEntitlementUserById).toHaveBeenCalledWith(7);
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({
      purchaseKind: 'lifetime',
      paymentIntentId: 'pi_life',
      active: true,
      userId: 7,
    }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'free', grantLifetime: false, revokeLifetime: true }),
    }));

    vi.mocked(applyPurchaseRevocation).mockClear();
    vi.mocked(commitEntitlementResync).mockClear();
    vi.mocked(stripe.subscriptions.list).mockClear();
    vi.mocked(getUserByLifetimePaymentIntentId).mockResolvedValue(lifetimeUser);
    vi.mocked(stripe.checkout.sessions.list).mockResolvedValue({ data: [], has_more: false } as never);
    vi.mocked(listPurchaseRevocations).mockResolvedValue([{
      purchaseKey: 'pi:pi_life',
      reasonKind: 'dispute:dp_life',
      purchaseKind: 'lifetime',
      chargeId: 'ch_life',
      invoiceId: null,
      paymentIntentId: 'pi_life',
      subscriptionId: null,
      disputeId: 'dp_life',
      disputeOutcome: 'open',
      active: true,
      sourceEventId: 'evt_dispute_life',
      sourceEventCreated: PERIOD_START + 50,
      userId: 7,
    }]);
    const dispute = await post({
      id: 'evt_dispute_life',
      type: 'charge.dispute.created',
      created: PERIOD_START + 50,
      data: { object: {
        id: 'dp_life',
        status: 'needs_response',
        charge: {
          id: 'ch_life',
          object: 'charge',
          amount: LIFETIME_CENTS,
          amount_refunded: 0,
          refunded: false,
          customer: null,
          payment_intent: 'pi_life',
        },
      } },
    });
    expect(dispute._status).toBe(200);
    expect(getUserByLifetimePaymentIntentId).toHaveBeenCalledWith('pi_life');
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({
      purchaseKind: 'lifetime',
      paymentIntentId: 'pi_life',
      active: true,
      disputeId: 'dp_life',
      disputeOutcome: 'open',
      userId: 7,
    }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'free', grantLifetime: false, revokeLifetime: true }),
    }));
  });

  it('keeps Standard when a customer-less Lifetime refund resolves a stored subscriber', async () => {
    const subscriber = {
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'founding' as const, lifetimeAccess: true, stripeCustomerId: 'cus_std', lifetimePaymentIntentId: 'pi_life',
    };
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);
    vi.mocked(getEntitlementUserById).mockResolvedValue(subscriber);
    vi.mocked(getUserByLifetimePaymentIntentId).mockResolvedValue(null);
    vi.mocked(stripe.subscriptions.list).mockResolvedValue({ data: [premiumSub()], has_more: false } as never);
    const lifetimeForUser = {
      ...lifetimeSession('pi_life'),
      customer: null,
      client_reference_id: '7',
      metadata: { plan_id: 'lifetime', user_id: '7' },
    };
    vi.mocked(stripe.checkout.sessions.list).mockImplementation(async (params: { payment_intent?: string; customer?: string }) => {
      if (params?.payment_intent === 'pi_life' || params?.customer === 'cus_std') {
        return { data: [lifetimeForUser], has_more: false } as never;
      }
      return { data: [], has_more: false } as never;
    });
    vi.mocked(listPurchaseRevocations).mockResolvedValue([{
      purchaseKey: 'pi:pi_life',
      reasonKind: 'full_refund',
      purchaseKind: 'lifetime',
      chargeId: 'ch_life',
      invoiceId: null,
      paymentIntentId: 'pi_life',
      subscriptionId: null,
      disputeId: null,
      disputeOutcome: null,
      active: true,
      sourceEventId: 'evt_charge_refunded_ch_both',
      sourceEventCreated: PERIOD_START + 40,
      userId: 7,
    }]);
    const res = await post(chargeEvent('charge.refunded', {
      id: 'ch_both',
      object: 'charge',
      amount: LIFETIME_CENTS,
      amount_refunded: LIFETIME_CENTS,
      refunded: true,
      customer: null,
      payment_intent: 'pi_life',
    }));
    expect(res._status).toBe(200);
    expect(stripe.subscriptions.list).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_std', status: 'all' }),
      expect.objectContaining({ timeout: 4_000, maxNetworkRetries: 1 }),
    );
    expect(stripe.checkout.sessions.list).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_std' }),
      expect.anything(),
    );
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({
      purchaseKind: 'lifetime',
      paymentIntentId: 'pi_life',
      active: true,
    }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({
        accessTier: 'premium',
        grantLifetime: false,
        revokeLifetime: true,
        stripeSubscriptionId: 'sub_live',
        stripeCustomerId: 'cus_std',
      }),
    }));
  });

  it('revokes and restores a discounted Lifetime refund and dispute', async () => {
    const DISCOUNT = 100_000;
    const user = {
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'founding' as const, lifetimeAccess: true, stripeCustomerId: 'cus_a', lifetimePaymentIntentId: 'pi_promo',
    };
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue(user);
    vi.mocked(getEntitlementUserById).mockResolvedValue(user);
    const session = {
      ...lifetimeSession('pi_promo'),
      amount_total: DISCOUNT,
      payment_intent: { id: 'pi_promo', status: 'succeeded', amount_received: 0, amount: DISCOUNT },
    };
    usePicture(premiumSub({ status: 'canceled' }), [session]);
    vi.mocked(listPurchaseRevocations).mockResolvedValue([{
      purchaseKey: 'pi:pi_promo',
      reasonKind: 'full_refund',
      purchaseKind: 'lifetime',
      chargeId: 'ch_promo',
      invoiceId: null,
      paymentIntentId: 'pi_promo',
      subscriptionId: null,
      disputeId: null,
      disputeOutcome: null,
      active: true,
      sourceEventId: 'evt_charge_refunded_ch_promo',
      sourceEventCreated: PERIOD_START + 40,
      userId: 7,
    }]);
    const refund = await post(chargeEvent('charge.refunded', {
      id: 'ch_promo',
      object: 'charge',
      amount: DISCOUNT,
      amount_refunded: DISCOUNT,
      refunded: true,
      customer: 'cus_a',
      payment_intent: 'pi_promo',
    }));
    expect(refund._status).toBe(200);
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({
      purchaseKind: 'lifetime',
      paymentIntentId: 'pi_promo',
      active: true,
      reasonKind: 'full_refund',
    }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'free', grantLifetime: false, revokeLifetime: true, stripeSubscriptionId: null }),
    }));

    vi.mocked(applyPurchaseRevocation).mockClear();
    vi.mocked(commitEntitlementResync).mockClear();
    vi.mocked(listPurchaseRevocations).mockResolvedValue([{
      purchaseKey: 'pi:pi_promo',
      reasonKind: 'dispute:dp_promo',
      purchaseKind: 'lifetime',
      chargeId: 'ch_promo',
      invoiceId: null,
      paymentIntentId: 'pi_promo',
      subscriptionId: null,
      disputeId: 'dp_promo',
      disputeOutcome: 'open',
      active: true,
      sourceEventId: 'evt_dispute_promo',
      sourceEventCreated: PERIOD_START + 50,
      userId: 7,
    }]);
    const opened = await post({
      id: 'evt_dispute_promo',
      type: 'charge.dispute.created',
      created: PERIOD_START + 50,
      data: { object: {
        id: 'dp_promo',
        status: 'needs_response',
        charge: {
          id: 'ch_promo',
          object: 'charge',
          amount: DISCOUNT,
          amount_refunded: 0,
          refunded: false,
          customer: 'cus_a',
          payment_intent: 'pi_promo',
        },
      } },
    });
    expect(opened._status).toBe(200);
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({
      purchaseKind: 'lifetime',
      paymentIntentId: 'pi_promo',
      active: true,
      disputeOutcome: 'open',
    }));

    vi.mocked(applyPurchaseRevocation).mockClear();
    vi.mocked(commitEntitlementResync).mockClear();
    vi.mocked(listPurchaseRevocations).mockResolvedValue([]);
    vi.mocked(stripe.charges.retrieve).mockResolvedValue({
      id: 'ch_promo',
      amount: DISCOUNT,
      amount_refunded: 0,
      refunded: false,
      customer: 'cus_a',
      payment_intent: 'pi_promo',
    } as never);
    const sessionPaid = {
      ...session,
      payment_intent: { id: 'pi_promo', status: 'succeeded', amount_received: DISCOUNT, amount: DISCOUNT },
    };
    usePicture(premiumSub({ status: 'canceled' }), [sessionPaid]);
    const won = await post({
      id: 'evt_dispute_promo_won',
      type: 'charge.dispute.closed',
      created: PERIOD_START + 80,
      data: { object: {
        id: 'dp_promo',
        status: 'won',
        charge: 'ch_promo',
      } },
    });
    expect(won._status).toBe(200);
    expect(stripe.charges.retrieve).toHaveBeenCalled();
    expect(applyPurchaseRevocation).toHaveBeenCalledWith(expect.objectContaining({
      purchaseKind: 'lifetime',
      paymentIntentId: 'pi_promo',
      active: false,
      disputeOutcome: 'won',
    }));
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'founding', grantLifetime: true, revokeLifetime: false }),
    }));
  });

  it('grants Standard from checkout.session.completed when the subscription is paid', async () => {
    usePicture();
    const res = await post({
      id: 'evt_std_checkout',
      type: 'checkout.session.completed',
      created: PERIOD_START,
      data: { object: { id: 'cs_std', customer: 'cus_a', mode: 'subscription', metadata: { user_id: '7', plan_id: 'premium' } } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'premium', stripeSubscriptionId: 'sub_live', grantLifetime: false }),
    }));
  });

  it('grants Lifetime from async_payment_succeeded only when the payment is verified', async () => {
    usePicture(premiumSub({ status: 'canceled' }), [{
      id: 'cs_promo',
      mode: 'payment',
      payment_status: 'paid',
      amount_total: 100_000,
      created: PERIOD_START,
      metadata: { plan_id: 'lifetime' },
      payment_intent: { id: 'pi_promo', status: 'succeeded', amount_received: 100_000, amount: 100_000 },
    }]);
    const res = await post({
      id: 'evt_async_life',
      type: 'checkout.session.async_payment_succeeded',
      created: PERIOD_START,
      data: { object: { id: 'cs_promo', customer: 'cus_a', mode: 'payment', metadata: { plan_id: 'lifetime', user_id: '7' } } },
    });
    expect(res._status).toBe(200);
    expect(commitEntitlementResync).toHaveBeenCalledWith(expect.objectContaining({
      desired: expect.objectContaining({ accessTier: 'founding', grantLifetime: true, stripeSubscriptionId: null }),
    }));
  });

  it('acknowledges a charge whose user cannot be resolved and alerts', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);
    vi.mocked(getEntitlementUserById).mockResolvedValue(null);
    vi.mocked(getUserByLifetimePaymentIntentId).mockResolvedValue(null);
    vi.mocked(stripe.checkout.sessions.list).mockResolvedValue({ data: [], has_more: false } as never);
    const res = await post(chargeEvent('charge.refunded', {
      id: 'ch_ghost',
      amount: 500,
      amount_refunded: 500,
      refunded: true,
      customer: null,
      payment_intent: 'pi_ghost',
    }));
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ received: true, ignored: 'missing_user' });
    expect(completeStripeWebhookEvent).toHaveBeenCalled();
    expect(commitEntitlementResync).not.toHaveBeenCalled();
    expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    expect(error.mock.calls.some(call => String(call[0]).includes('[BILLING-ALERT]') && String(call[0]).includes('missing_user'))).toBe(true);
    error.mockRestore();
  });
});
