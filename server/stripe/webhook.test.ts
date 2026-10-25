/**
 * FAULTLINE — Stripe Webhook Handler Tests
 * ─────────────────────────────────────────
 * Tests the four webhook event handlers:
 *   1. checkout.session.completed  → tier upgrade
 *   2. invoice.paid                → subscription renewal / re-activation
 *   3. customer.subscription.deleted → downgrade to free
 *   4. invoice.payment_failed      → log warning (no tier change)
 *
 * Also tests:
 *   - No evt_test_ signature bypass
 *   - Signature verification failure
 *   - Missing user_id metadata guard
 *   - Unknown customer guard
 *   - Fail-closed tier resolution and idempotent Stripe retry handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleStripeWebhook, subscriptionGrantDecision } from './webhook';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock stripe client
vi.mock('./client', () => {
  const stripe = {
    webhooks: {
      constructEvent: vi.fn(),
    },
    checkout: {
      sessions: {
        listLineItems: vi.fn(),
      },
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  };
  return {
    stripe,
    requireStripe: () => stripe,
  };
});

// Mock db helpers
vi.mock('../db', () => ({
  updateUserStripe: vi.fn(),
  getUserByStripeCustomerId: vi.fn(),
  getUserTier: vi.fn().mockResolvedValue('free'),
  recordStripeWebhookEvent: vi.fn().mockResolvedValue(true), // default: new event
  releaseStripeWebhookEvent: vi.fn().mockResolvedValue(undefined),
  completeStripeWebhookEvent: vi.fn().mockResolvedValue(undefined),
  writeEntitlementAudit: vi.fn().mockResolvedValue(undefined),
}));

// Mock ENV
vi.mock('../_core/env', () => ({
  ENV: {
    stripeWebhookSecret: 'whsec_test_secret',
  },
}));

// Mock products
vi.mock('./products', () => ({
  getPlanByPriceId: vi.fn(),
}));

import { stripe } from './client';
import { updateUserStripe, getUserByStripeCustomerId, recordStripeWebhookEvent, releaseStripeWebhookEvent, completeStripeWebhookEvent, writeEntitlementAudit, getUserTier } from '../db';
import { getPlanByPriceId } from './products';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(body: unknown, sig = 'valid-sig'): Request {
  return {
    headers: { 'stripe-signature': sig },
    body: Buffer.from(JSON.stringify(body)),
  } as unknown as Request;
}

function makeRes() {
  const res = {
    _status: 200,
    _body: null as unknown,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  res.status.mockImplementation((code: number) => {
    res._status = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res._body = body;
    return res;
  });
  return res as unknown as Response & { _status: number; _body: unknown };
}

function makeEvent(type: string, data: object, id = 'evt_live_123') {
  return { id, type, data: { object: data } };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('subscriptionGrantDecision', () => {
  it('refuses cancelled, ended, and incomplete subscriptions and allows only active or trialing', () => {
    expect(subscriptionGrantDecision({ status: 'canceled' })).toEqual({ entitled: false, status: 'cancelled' });
    expect(subscriptionGrantDecision({ status: 'cancelled' })).toEqual({ entitled: false, status: 'cancelled' });
    expect(subscriptionGrantDecision({ status: 'incomplete' })).toEqual({ entitled: false, status: 'incomplete' });
    expect(subscriptionGrantDecision({ status: 'incomplete_expired' })).toEqual({ entitled: false, status: 'incomplete' });
    expect(subscriptionGrantDecision({ status: 'ended' })).toEqual({ entitled: false, status: 'ended' });
    expect(subscriptionGrantDecision({ status: 'active', ended_at: 1_700_000_000 })).toEqual({ entitled: false, status: 'ended' });
    expect(subscriptionGrantDecision({ status: 'active', ended_at: null })).toEqual({ entitled: true });
    expect(subscriptionGrantDecision({ status: 'trialing' })).toEqual({ entitled: true });
    expect(subscriptionGrantDecision({ status: 'past_due' })).toEqual({ entitled: false, status: 'past_due' });
    expect(subscriptionGrantDecision({ status: 'unpaid' })).toEqual({ entitled: false, status: 'unpaid' });
  });
});

describe('handleStripeWebhook', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recordStripeWebhookEvent).mockResolvedValue(true);
    vi.mocked(releaseStripeWebhookEvent).mockResolvedValue(undefined);
    vi.mocked(completeStripeWebhookEvent).mockResolvedValue(undefined);
    vi.mocked(getUserTier).mockResolvedValue('free');
    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
      status: 'active',
      ended_at: null,
      items: { data: [{ price: { id: 'price_premium_monthly' } }] },
    } as any);
  });

  // ── No evt_test_ bypass ────────────────────────────────────────────────────
  describe('evt_test_ events', () => {
    it('does not bypass signature verification for evt_test_ events', async () => {
      vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });
      const body = JSON.stringify({ id: 'evt_test_abc123', type: 'checkout.session.completed' });
      const req = {
        headers: { 'stripe-signature': 'invalid-sig' },
        body: Buffer.from(body),
      } as unknown as Request;
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(stripe.webhooks.constructEvent).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).not.toHaveBeenCalledWith({ verified: true });
    });
  });

  // ── Signature verification failure ─────────────────────────────────────────
  describe('signature verification', () => {
    it('returns 400 with verified:false when signature is invalid', async () => {
      vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      const req = makeReq({ id: 'evt_live_bad', type: 'checkout.session.completed' }, 'bad-sig');
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ verified: false })
      );
    });
  });

  // ── checkout.session.completed ─────────────────────────────────────────────
  describe('checkout.session.completed', () => {
    it('upgrades user to core tier when core plan price is found', async () => {
      const session = {
        id: 'cs_test_123',
        metadata: { user_id: '42' },
        customer: 'cus_abc',
        subscription: 'sub_xyz',
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session) as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_core_monthly' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue({
        id: 'core', tier: 'core', name: 'Core', amount: 999,
        interval: 'month', description: '', priceId: 'price_core_monthly',
      });
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const req = makeReq(session);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).toHaveBeenCalledWith(42, {
        accessTier: 'core',
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_xyz',
      });
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('upgrades user to premium tier when premium plan price is found', async () => {
      const session = {
        id: 'cs_test_456',
        metadata: { user_id: '7' },
        customer: 'cus_def',
        subscription: 'sub_prem',
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session) as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_premium_monthly' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue({
        id: 'premium', tier: 'premium', name: 'Pro', amount: 5900,
        interval: 'month', description: '', priceId: 'price_premium_monthly',
      });
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const req = makeReq(session);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).toHaveBeenCalledWith(7, expect.objectContaining({
        accessTier: 'premium',
      }));
    });

    it('upgrades user to founding tier for founding plan', async () => {
      const session = {
        id: 'cs_test_789',
        metadata: { user_id: '99' },
        customer: 'cus_ghi',
        subscription: 'sub_found',
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session) as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_founding' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue({
        id: 'founding', tier: 'founding', name: 'Founding', amount: 4900,
        interval: 'month', description: '', priceId: 'price_founding',
      });
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const req = makeReq(session);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).toHaveBeenCalledWith(99, expect.objectContaining({
        accessTier: 'founding',
      }));
    });

    it('does not grant a tier and returns 500 for retry when line items cannot be fetched', async () => {
      const session = {
        id: 'cs_test_fallback',
        metadata: { user_id: '5' },
        customer: 'cus_fallback',
        subscription: null,
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session) as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockRejectedValue(
        new Error('Stripe API unavailable')
      );
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const req = makeReq(session);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_live_123');
    });

    it('fails closed without retrying when the line item has no readable price', async () => {
      const session = { id: 'cs_test_no_price', metadata: { user_id: '5' }, customer: 'cus_no_price', subscription: null };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_no_price') as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({ data: [{}] } as any);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(writeEntitlementAudit).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'unresolved_plan' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
      expect(completeStripeWebhookEvent).toHaveBeenCalledWith('evt_no_price', 'checkout.session.completed');
      expect(errorSpy.mock.calls.flat().join(' ')).toContain('[Stripe Webhook][BILLING-ALERT]');
      errorSpy.mockRestore();
    });

    it('fails closed without retrying for an unknown configured-price mapping', async () => {
      const session = { id: 'cs_test_unknown_price', metadata: { user_id: '5' }, customer: 'cus_unknown', subscription: null };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_unknown_price') as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_not_configured' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(writeEntitlementAudit).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'unresolved_plan' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
      expect(completeStripeWebhookEvent).toHaveBeenCalledWith('evt_unknown_price', 'checkout.session.completed');
      expect(errorSpy.mock.calls.flat().join(' ')).toContain('price_not_configured');
      errorSpy.mockRestore();
    });

    it('does NOT call updateUserStripe when user_id is missing from metadata', async () => {
      const session = {
        id: 'cs_test_noid',
        metadata: {},  // no user_id
        customer: 'cus_noid',
        subscription: null,
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session) as any
      );

      const req = makeReq(session);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });
  });

  // ── invoice.paid ───────────────────────────────────────────────────────────
  describe('invoice.paid', () => {
    it('re-activates user tier on subscription renewal', async () => {
      const invoice = {
        id: 'in_renewal_123',
        customer: 'cus_renew',
        subscription: 'sub_renew',
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice) as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 11, accessTier: 'free',
      } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        status: 'active',
        ended_at: null,
        items: { data: [{ price: { id: 'price_premium_monthly' } }] },
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue({
        id: 'premium', tier: 'premium', name: 'Pro', amount: 5900,
        interval: 'month', description: '', priceId: 'price_premium_monthly',
      });
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const req = makeReq(invoice);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).toHaveBeenCalledWith(11, {
        accessTier: 'premium',
        stripeSubscriptionId: 'sub_renew',
      });
    });

    it('skips processing when invoice has no subscription (one-time charge)', async () => {
      const invoice = {
        id: 'in_onetime_123',
        customer: 'cus_onetime',
        subscription: null,
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice) as any
      );

      const req = makeReq(invoice);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).not.toHaveBeenCalled();
    });

    it('skips processing when no user found for customer ID', async () => {
      const invoice = {
        id: 'in_unknown_123',
        customer: 'cus_unknown',
        subscription: 'sub_unknown',
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice) as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);

      const req = makeReq(invoice);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).not.toHaveBeenCalled();
    });
  });

  // ── customer.subscription.deleted ─────────────────────────────────────────
  describe('customer.subscription.deleted', () => {
    it('downgrades user to free when subscription is cancelled', async () => {
      const subscription = {
        id: 'sub_cancelled',
        customer: 'cus_cancel',
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', subscription) as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 22, accessTier: 'premium',
      } as any);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const req = makeReq(subscription);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).toHaveBeenCalledWith(22, {
        accessTier: 'free',
        stripeSubscriptionId: null,
      });
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('does NOT call updateUserStripe when no user found for cancelled subscription', async () => {
      const subscription = {
        id: 'sub_ghost',
        customer: 'cus_ghost',
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', subscription) as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);

      const req = makeReq(subscription);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).not.toHaveBeenCalled();
    });
  });

  // ── invoice.payment_failed ─────────────────────────────────────────────────
  describe('invoice.payment_failed', () => {
    it('logs warning but does NOT change user tier', async () => {
      const invoice = {
        id: 'in_failed_123',
        customer: 'cus_failed',
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.payment_failed', invoice) as any
      );

      const req = makeReq(invoice);
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });
  });

  // ── Billing flow integration: paid user gets access, cancelled user loses it ─
  describe('billing flow integration', () => {
    it('full flow: checkout → tier granted → subscription cancelled → downgraded to free', async () => {
      // Step 1: Checkout completed → user gets premium
      const session = {
        id: 'cs_flow_test',
        metadata: { user_id: '55' },
        customer: 'cus_flow',
        subscription: 'sub_flow',
      };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session) as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_premium_monthly' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue({
        id: 'premium', tier: 'premium', name: 'Pro', amount: 5900,
        interval: 'month', description: '', priceId: 'price_premium_monthly',
      });
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      await handleStripeWebhook(makeReq(session), makeRes());

      expect(updateUserStripe).toHaveBeenCalledWith(55, expect.objectContaining({
        accessTier: 'premium',
      }));

      vi.clearAllMocks();

      // Step 2: Subscription cancelled → user downgraded to free
      const cancellation = { id: 'sub_flow', customer: 'cus_flow' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', cancellation) as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 55, accessTier: 'premium',
      } as any);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      await handleStripeWebhook(makeReq(cancellation), makeRes());

      expect(updateUserStripe).toHaveBeenCalledWith(55, {
        accessTier: 'free',
        stripeSubscriptionId: null,
      });
    });
  });

  describe('idempotency failures and retries', () => {
    const session = {
      id: 'cs_idempotency',
      metadata: { user_id: '60' },
      customer: 'cus_idempotency',
      subscription: 'sub_idempotency',
    };

    function arrangeSuccessfulCheckout() {
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_idempotency') as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_premium_monthly' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue({
        id: 'premium', tier: 'premium', name: 'Premium', amount: 5900,
        interval: 'month', description: '', priceId: 'price_premium_monthly',
      });
    }

    it('releases a failed claim so a subsequent Stripe retry grants the verified tier', async () => {
      arrangeSuccessfulCheckout();
      vi.mocked(updateUserStripe).mockRejectedValueOnce(new Error('transient DB failure'));

      const failedAttempt = makeRes();
      await handleStripeWebhook(makeReq(session), failedAttempt);

      expect(failedAttempt.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_idempotency');

      const retry = makeRes();
      await handleStripeWebhook(makeReq(session), retry);

      expect(retry.json).toHaveBeenCalledWith({ received: true });
      expect(recordStripeWebhookEvent).toHaveBeenCalledTimes(2);
      expect(updateUserStripe).toHaveBeenLastCalledWith(60, expect.objectContaining({ accessTier: 'premium' }));
    });

    it('skips only a genuine duplicate claim without processing or releasing it', async () => {
      arrangeSuccessfulCheckout();
      vi.mocked(recordStripeWebhookEvent).mockResolvedValueOnce(false);

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true });
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    });

    it('returns 500 rather than treating a non-duplicate claim failure as a duplicate', async () => {
      arrangeSuccessfulCheckout();
      vi.mocked(recordStripeWebhookEvent).mockRejectedValueOnce(new Error('ECONNRESET'));

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).not.toHaveBeenCalledWith({ received: true, duplicate: true });
      expect(updateUserStripe).not.toHaveBeenCalled();
    });

    it.each(['invoice.paid', 'customer.subscription.deleted', 'customer.subscription.updated'])('returns 500 without acknowledging %s when the DB cannot claim the event', async eventType => {
      const payload = { id: 'sub_db_outage', customer: 'cus_db_outage' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(makeEvent(eventType, payload, 'evt_db_outage') as any);
      vi.mocked(recordStripeWebhookEvent).mockRejectedValueOnce(new Error('Database unavailable: cannot claim Stripe webhook event'));
      const res = makeRes();
      await handleStripeWebhook(makeReq(payload), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).not.toHaveBeenCalledWith({ received: true });
      expect(getUserByStripeCustomerId).not.toHaveBeenCalled();
      expect(updateUserStripe).not.toHaveBeenCalled();
    });

    it('still returns 500 and does not acknowledge when a failed processing claim cannot be released', async () => {
      arrangeSuccessfulCheckout();
      vi.mocked(updateUserStripe).mockRejectedValueOnce(new Error('transient DB failure'));
      vi.mocked(releaseStripeWebhookEvent).mockRejectedValueOnce(new Error('release failed'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).not.toHaveBeenCalledWith({ received: true });
      expect(res.json).not.toHaveBeenCalledWith({ received: true, duplicate: true });
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_idempotency');
      expect(errorSpy.mock.calls.flat().join(' ')).toContain('Failed to release idempotency claim for evt_idempotency');
      errorSpy.mockRestore();
    });

    it('applies a reclaimed event after release fails instead of dropping it', async () => {
      arrangeSuccessfulCheckout();
      vi.mocked(updateUserStripe)
        .mockRejectedValueOnce(new Error('transient DB failure'))
        .mockResolvedValueOnce(undefined as any);
      vi.mocked(releaseStripeWebhookEvent).mockRejectedValueOnce(new Error('release failed'));

      const failed = makeRes();
      await handleStripeWebhook(makeReq(session), failed);
      expect(failed.status).toHaveBeenCalledWith(500);
      expect(failed.json).not.toHaveBeenCalledWith(expect.objectContaining({ received: true }));

      vi.mocked(recordStripeWebhookEvent).mockResolvedValueOnce(true);
      const retry = makeRes();
      await handleStripeWebhook(makeReq(session), retry);

      expect(retry.json).toHaveBeenCalledWith({ received: true });
      expect(updateUserStripe).toHaveBeenLastCalledWith(60, expect.objectContaining({ accessTier: 'premium' }));
      expect(retry.json).not.toHaveBeenCalledWith({ received: true, duplicate: true });
    });

    it('returns 500 instead of a duplicate ack while an unfinished claim is still fresh', async () => {
      arrangeSuccessfulCheckout();
      vi.mocked(recordStripeWebhookEvent).mockRejectedValueOnce(
        new Error('Stripe webhook claim evt_idempotency is unfinished; retry shortly'),
      );

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).not.toHaveBeenCalledWith({ received: true, duplicate: true });
      expect(updateUserStripe).not.toHaveBeenCalled();
    });

    it('does not release the claim when a later step fails after the entitlement write', async () => {
      arrangeSuccessfulCheckout();
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);
      vi.mocked(writeEntitlementAudit).mockRejectedValueOnce(new Error('audit failed'));

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(updateUserStripe).toHaveBeenCalledWith(60, expect.objectContaining({ accessTier: 'premium' }));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
      expect(completeStripeWebhookEvent).toHaveBeenCalledWith('evt_idempotency', 'checkout.session.completed');
    });
  });

  describe('released claim cannot resurrect access', () => {
    const premiumPlan = {
      id: 'premium', tier: 'premium' as const, name: 'Pro', amount: 5900,
      interval: 'month' as const, description: '', priceId: 'price_premium_monthly',
    };

    it('does not re-grant checkout access after release, cancellation, and retry', async () => {
      const session = {
        id: 'cs_release_cancel',
        metadata: { user_id: '70' },
        customer: 'cus_release_cancel',
        subscription: 'sub_release_cancel',
      };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_release_cancel') as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_premium_monthly' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(updateUserStripe).mockRejectedValueOnce(new Error('transient DB failure'));

      const failed = makeRes();
      await handleStripeWebhook(makeReq(session), failed);
      expect(failed.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_release_cancel');

      vi.mocked(updateUserStripe).mockReset();
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);
      vi.mocked(releaseStripeWebhookEvent).mockClear();
      const cancellation = { id: 'sub_release_cancel', customer: 'cus_release_cancel' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', cancellation, 'evt_cancel_after_release') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 70, accessTier: 'premium', lifetimeAccess: false,
      } as any);
      await handleStripeWebhook(makeReq(cancellation), makeRes());
      expect(updateUserStripe).toHaveBeenCalledWith(70, {
        accessTier: 'free',
        stripeSubscriptionId: null,
      });

      vi.mocked(updateUserStripe).mockClear();
      vi.mocked(writeEntitlementAudit).mockClear();
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_release_cancel') as any
      );
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        status: 'canceled',
        ended_at: 1_700_000_000,
        items: { data: [{ price: { id: 'price_premium_monthly' } }] },
      } as any);
      vi.mocked(recordStripeWebhookEvent).mockResolvedValue(true);

      const retry = makeRes();
      await handleStripeWebhook(makeReq(session), retry);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(writeEntitlementAudit).not.toHaveBeenCalled();
      expect(retry.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    });

    it('does not re-grant a renewal after release, cancellation, and retry', async () => {
      const invoice = { id: 'in_release_cancel', customer: 'cus_release_cancel', subscription: 'sub_release_cancel' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_invoice_release_cancel') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 71, accessTier: 'free', lifetimeAccess: false,
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(updateUserStripe).mockRejectedValueOnce(new Error('transient DB failure'));

      const failed = makeRes();
      await handleStripeWebhook(makeReq(invoice), failed);
      expect(failed.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_invoice_release_cancel');

      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);
      vi.mocked(releaseStripeWebhookEvent).mockClear();
      const cancellation = { id: 'sub_release_cancel', customer: 'cus_release_cancel' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', cancellation, 'evt_invoice_cancel') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 71, accessTier: 'premium', lifetimeAccess: false,
      } as any);
      await handleStripeWebhook(makeReq(cancellation), makeRes());

      vi.mocked(updateUserStripe).mockClear();
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_invoice_release_cancel') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 71, accessTier: 'free', lifetimeAccess: false,
      } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        status: 'cancelled',
        ended_at: null,
        items: { data: [{ price: { id: 'price_premium_monthly' } }] },
      } as any);

      const retry = makeRes();
      await handleStripeWebhook(makeReq(invoice), retry);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(retry.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
    });
  });

  describe('out-of-order subscription events', () => {
    const premiumPlan = {
      id: 'premium', tier: 'premium' as const, name: 'Pro', amount: 5900,
      interval: 'month' as const, description: '', priceId: 'price_premium_monthly',
    };

    it('does not let an older invoice or active update resurrect access after cancellation', async () => {
      const cancellation = { id: 'sub_order', customer: 'cus_order' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', cancellation, 'evt_order_cancel') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 80, accessTier: 'premium', lifetimeAccess: false,
      } as any);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);
      await handleStripeWebhook(makeReq(cancellation), makeRes());
      expect(updateUserStripe).toHaveBeenCalledWith(80, {
        accessTier: 'free',
        stripeSubscriptionId: null,
      });

      vi.mocked(updateUserStripe).mockClear();
      vi.mocked(writeEntitlementAudit).mockClear();
      const invoice = { id: 'in_older', customer: 'cus_order', subscription: 'sub_order' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_order_invoice') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 80, accessTier: 'free', lifetimeAccess: false,
      } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        status: 'canceled',
        ended_at: 1_700_000_000,
        items: { data: [{ price: { id: 'price_premium_monthly' } }] },
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);

      const invoiceRes = makeRes();
      await handleStripeWebhook(makeReq(invoice), invoiceRes);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(invoiceRes.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });

      const staleActive = {
        id: 'sub_order',
        customer: 'cus_order',
        status: 'active',
        items: { data: [{ price: { id: 'price_premium_monthly' } }] },
      };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.updated', staleActive, 'evt_order_stale_active') as any
      );
      const updateRes = makeRes();
      await handleStripeWebhook(makeReq(staleActive), updateRes);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(writeEntitlementAudit).not.toHaveBeenCalled();
      expect(updateRes.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
    });

    it.each([
      ['incomplete', null, 'incomplete'],
      ['incomplete_expired', null, 'incomplete'],
      ['ended', null, 'ended'],
      ['active', 1_700_000_000, 'ended'],
    ])('does not grant checkout when the live subscription is %s (ended_at=%s)', async (status, endedAt, label) => {
      const session = {
        id: 'cs_blocked',
        metadata: { user_id: '81' },
        customer: 'cus_blocked',
        subscription: 'sub_blocked',
      };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, `evt_blocked_${label}`) as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_premium_monthly' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        status,
        ended_at: endedAt,
        items: { data: [{ price: { id: 'price_premium_monthly' } }] },
      } as any);

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    });

    it('still grants a renewal while the live subscription is trialing', async () => {
      const invoice = { id: 'in_trial', customer: 'cus_trial', subscription: 'sub_trial' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_trial') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 82, accessTier: 'free', lifetimeAccess: false,
      } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        status: 'trialing',
        ended_at: null,
        items: { data: [{ price: { id: 'price_premium_monthly' } }] },
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const res = makeRes();
      await handleStripeWebhook(makeReq(invoice), res);

      expect(updateUserStripe).toHaveBeenCalledWith(82, {
        accessTier: 'premium',
        stripeSubscriptionId: 'sub_trial',
      });
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('unknown renewal prices', () => {
    it('logs and acknowledges an unknown invoice price without granting or releasing the claim', async () => {
      const invoice = { id: 'in_unknown_price', customer: 'cus_unknown_price', subscription: 'sub_unknown_price' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_invoice_unknown_price') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 90, accessTier: 'core', lifetimeAccess: false,
      } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        status: 'active',
        ended_at: null,
        items: { data: [{ price: { id: 'price_not_configured' } }] },
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = makeRes();
      await handleStripeWebhook(makeReq(invoice), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(writeEntitlementAudit).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'unresolved_plan' });
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
      expect(completeStripeWebhookEvent).toHaveBeenCalledWith('evt_invoice_unknown_price', 'invoice.paid');
      expect(errorSpy.mock.calls.flat().join(' ')).toContain('price_not_configured');
      errorSpy.mockRestore();
    });

    it('logs and acknowledges an unknown subscription.updated price without granting', async () => {
      const subscription = {
        id: 'sub_unknown_price',
        customer: 'cus_unknown_price',
        status: 'active',
        items: { data: [{ price: { id: 'price_not_configured' } }] },
      };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.updated', subscription, 'evt_updated_unknown_price') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 91, accessTier: 'core', lifetimeAccess: false,
      } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        status: 'active',
        ended_at: null,
        items: { data: [{ price: { id: 'price_not_configured' } }] },
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscription), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'unresolved_plan' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
      expect(errorSpy.mock.calls.flat().join(' ')).toContain('[Stripe Webhook][BILLING-ALERT]');
      errorSpy.mockRestore();
    });

    it('retries a renewal when the live subscription cannot be read', async () => {
      const invoice = { id: 'in_retrieve_fail', customer: 'cus_retrieve_fail', subscription: 'sub_retrieve_fail' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_retrieve_fail') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 92, accessTier: 'premium', lifetimeAccess: false,
      } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockRejectedValue(new Error('Stripe API unavailable'));

      const res = makeRes();
      await handleStripeWebhook(makeReq(invoice), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_retrieve_fail');
      expect(res.json).not.toHaveBeenCalledWith({ received: true });
    });
  });

});
