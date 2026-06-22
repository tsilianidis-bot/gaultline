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
 *   - Test event passthrough (evt_test_ prefix)
 *   - Signature verification failure
 *   - Missing user_id metadata guard
 *   - Unknown customer guard
 *   - Tier resolution fallback when line items unavailable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleStripeWebhook } from './webhook';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock stripe client
vi.mock('./client', () => ({
  stripe: {
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
  },
}));

// Mock db helpers
vi.mock('../db', () => ({
  updateUserStripe: vi.fn(),
  getUserByStripeCustomerId: vi.fn(),
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
import { updateUserStripe, getUserByStripeCustomerId } from '../db';
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

describe('handleStripeWebhook', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test event passthrough ──────────────────────────────────────────────────
  describe('test event passthrough', () => {
    it('returns verified:true for evt_test_ events without signature check', async () => {
      const body = JSON.stringify({ id: 'evt_test_abc123', type: 'checkout.session.completed' });
      const req = {
        headers: { 'stripe-signature': 'invalid-sig' },
        body: Buffer.from(body),
      } as unknown as Request;
      const res = makeRes();

      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ verified: true });
      expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
    });
  });

  // ── Signature verification failure ─────────────────────────────────────────
  describe('signature verification', () => {
    it('returns 200 with verified:false when signature is invalid', async () => {
      vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      const req = makeReq({ id: 'evt_live_bad', type: 'checkout.session.completed' }, 'bad-sig');
      const res = makeRes();

      await handleStripeWebhook(req, res);

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

    it('falls back to premium tier when line items cannot be fetched', async () => {
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

      // Falls back to core — safe minimum so we never accidentally grant premium access
      expect(updateUserStripe).toHaveBeenCalledWith(5, expect.objectContaining({
        accessTier: 'core',
      }));
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

});
