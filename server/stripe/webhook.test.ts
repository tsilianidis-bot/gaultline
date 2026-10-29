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
    getEntitlementRevision: vi.fn().mockResolvedValue(0),
    recordStripeWebhookEvent: vi.fn(),
    releaseStripeWebhookEvent: vi.fn(),
    completeStripeWebhookEvent: vi.fn(),
    commitEntitlementResync: vi.fn().mockResolvedValue('applied'),
    upsertStripeCancellationMarker: vi.fn().mockResolvedValue(undefined),
    listStripeCancellationMarkers: vi.fn().mockResolvedValue([]),
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
vi.mock('./paymentLinkage', () => {
  class PaymentLinkageUnresolvedError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }
  return {
    capturePaymentOrigin: vi.fn(),
    isPaymentOriginEvent: vi.fn(() => false),
    isPaymentReversalEvent: vi.fn((type: string) => [
      'charge.refunded',
      'refund.created',
      'refund.updated',
      'refund.failed',
      'charge.dispute.created',
      'charge.dispute.updated',
      'charge.dispute.closed',
      'charge.dispute.funds_withdrawn',
      'charge.dispute.funds_reinstated',
    ].includes(type)),
    PaymentLinkageUnresolvedError,
    paymentOriginFromChargeEvent: vi.fn(),
    paymentOriginFromCheckoutEvent: vi.fn(),
    paymentOriginFromPaymentIntentEvent: vi.fn(),
    reconcilePaymentReversalEvent: vi.fn(),
  };
});

import { stripe } from './client';
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
} from '../db';
import { getPlanByPriceId } from './products';
import {
  capturePaymentOrigin,
  isPaymentOriginEvent,
  PaymentLinkageUnresolvedError,
  paymentOriginFromCheckoutEvent,
  reconcilePaymentReversalEvent,
} from './paymentLinkage';

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
    vi.mocked(writeEntitlementAudit).mockResolvedValue(undefined);
    vi.mocked(capturePaymentOrigin).mockResolvedValue('recorded');
    vi.mocked(isPaymentOriginEvent).mockImplementation(() => false);
    vi.mocked(reconcilePaymentReversalEvent).mockResolvedValue('recorded');
    vi.mocked(getPlanByPriceId).mockImplementation((priceId: string) => (
      priceId === 'price_premium' ? { id: 'premium', tier: 'premium', name: 'Pro', amount: 5900, interval: 'month', description: '', priceId } as never : undefined
    ));
    vi.mocked(getEntitlementRevision).mockResolvedValue(0);
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

  it('does not reconcile a refund when signature verification fails', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => { throw new Error('bad signature'); });
    const res = makeRes();
    await handleStripeWebhook(makeReq({ id: 'evt_refund_unsigned', type: 'refund.created' }, 'invalid'), res);
    expect(res._status).toBe(400);
    expect(reconcilePaymentReversalEvent).not.toHaveBeenCalled();
    expect(recordStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it('captures a signed refund as policy-pending evidence without resyncing entitlement', async () => {
    const res = await post({
      id: 'evt_refund_recorded',
      type: 'refund.created',
      created: PERIOD_START,
      livemode: false,
      data: { object: { id: 're_partial', charge: 'ch_lifetime', amount: 25_000, currency: 'usd', status: 'succeeded' } },
    });
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ received: true, reconciliation: 'policy_pending', duplicate: false });
    expect(reconcilePaymentReversalEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt_refund_recorded', type: 'refund.created' }));
    expect(commitEntitlementResync).not.toHaveBeenCalled();
    expect(completeStripeWebhookEvent).toHaveBeenCalledWith('evt_refund_recorded', 'refund.created', ATTEMPT.attemptId);
  });

  it('persists a verified Checkout payment origin before the existing entitlement resync', async () => {
    vi.mocked(isPaymentOriginEvent).mockImplementation(type => type === 'checkout.session.completed');
    vi.mocked(paymentOriginFromCheckoutEvent).mockReturnValue({
      userId: 7,
      stripeCheckoutSessionId: 'cs_origin',
      stripePaymentIntentId: 'pi_origin',
      stripeChargeId: 'ch_origin',
      stripeCustomerId: 'cus_a',
      amount: 150000,
      currency: 'usd',
      livemode: false,
      sourceEventId: 'evt_origin_capture',
      sourceEventCreated: PERIOD_START,
    });
    vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValue({ id: 'cs_origin' } as never);
    const res = await post({
      id: 'evt_origin_capture',
      type: 'checkout.session.completed',
      created: PERIOD_START,
      livemode: false,
      data: { object: { id: 'cs_origin', customer: 'cus_a', mode: 'payment', metadata: { user_id: '7' } } },
    });
    expect(res._status).toBe(200);
    expect(capturePaymentOrigin).toHaveBeenCalledWith(expect.objectContaining({
      stripePaymentIntentId: 'pi_origin',
      stripeChargeId: 'ch_origin',
      stripeCustomerId: 'cus_a',
      userId: 7,
    }));
    expect(commitEntitlementResync).toHaveBeenCalled();
    expect(capturePaymentOrigin.mock.invocationCallOrder[0]).toBeLessThan(commitEntitlementResync.mock.invocationCallOrder[0]);
  });

  it('releases an unresolved reversal claim so a missing origin or persistence failure can replay', async () => {
    vi.mocked(reconcilePaymentReversalEvent).mockRejectedValue(new PaymentLinkageUnresolvedError('missing_original_linkage'));
    const res = await post({
      id: 'evt_refund_early',
      type: 'refund.created',
      created: PERIOD_START,
      livemode: false,
      data: { object: { id: 're_early', charge: 'ch_missing', amount: 25_000, currency: 'usd', status: 'succeeded' } },
    });
    expect(res._status).toBe(500);
    expect(res._body).toEqual({ error: 'Webhook processing failed', conflict: 'payment_linkage_unresolved' });
    expect(completeStripeWebhookEvent).not.toHaveBeenCalled();
    expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_refund_early', ATTEMPT.attemptId, 'refund.created');
    expect(commitEntitlementResync).not.toHaveBeenCalled();
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

  it('does not acknowledge an event whose user cannot be resolved', async () => {
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
