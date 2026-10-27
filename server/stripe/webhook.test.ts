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
  };
  return { stripe, requireStripe: () => stripe };
});

vi.mock('../db', () => {
  class StaleStripeWebhookClaimError extends Error {}
  class ZeroRowEntitlementWriteError extends Error {}
  return {
    getUserByStripeCustomerId: vi.fn(),
    getEntitlementUserById: vi.fn(),
    recordStripeWebhookEvent: vi.fn(),
    releaseStripeWebhookEvent: vi.fn(),
    completeStripeWebhookEvent: vi.fn(),
    commitEntitlementResync: vi.fn().mockResolvedValue('applied'),
    upsertStripeCancellationMarker: vi.fn().mockResolvedValue(undefined),
    listStripeCancellationMarkers: vi.fn().mockResolvedValue([]),
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
  getEntitlementUserById,
  recordStripeWebhookEvent,
  releaseStripeWebhookEvent,
  completeStripeWebhookEvent,
  commitEntitlementResync,
  upsertStripeCancellationMarker,
  listStripeCancellationMarkers,
  StaleStripeWebhookClaimError,
  ZeroRowEntitlementWriteError,
} from '../db';
import { getPlanByPriceId } from './products';

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
    vi.mocked(getPlanByPriceId).mockImplementation((priceId: string) => (
      priceId === 'price_premium' ? { id: 'premium', tier: 'premium', name: 'Pro', amount: 5900, interval: 'month', description: '', priceId } as never : undefined
    ));
    vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
      id: 7, name: 'Ada', email: 'ada@example.com', accessTier: 'free', lifetimeAccess: false,
    });
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

  it('retains an unknown price without writing a tier', async () => {
    usePicture(premiumSub({ items: { data: [{ price: { id: 'price_unknown' } }] } }));
    const res = await post({
      id: 'evt_price', type: 'invoice.paid', created: PERIOD_START,
      data: { object: { id: 'in_paid', customer: 'cus_a' } },
    });
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ received: true, ignored: 'unresolved_plan' });
    expect(commitEntitlementResync).not.toHaveBeenCalled();
    expect(completeStripeWebhookEvent).toHaveBeenCalled();
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
});
