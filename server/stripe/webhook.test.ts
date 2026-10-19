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
 *   - Tier resolution fallback when line items unavailable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { handleStripeWebhook } from './webhook';

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
import { updateUserStripe, getUserByStripeCustomerId, recordStripeWebhookEvent, releaseStripeWebhookEvent, writeEntitlementAudit, getUserTier } from '../db';
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

    it('FAILS CLOSED (no grant, 500, claim released) when the price is unknown — no legacy core fallback (D3)', async () => {
      const session = {
        id: 'cs_test_unknown_price',
        metadata: { user_id: '5', plan_id: 'premium' },
        customer: 'cus_unknown',
        subscription: 'sub_unknown',
      };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_unknown_price') as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_not_configured' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(undefined);
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(writeEntitlementAudit).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).not.toHaveBeenCalledWith({ received: true });
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_unknown_price');
      expect(errSpy.mock.calls.flat().join(' ')).toContain('BILLING-ALERT');
      errSpy.mockRestore();
    });

    it('FAILS CLOSED when the line item has no price (D3)', async () => {
      const session = { id: 'cs_no_price', metadata: { user_id: '5' }, customer: 'cus_x', subscription: null };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(makeEvent('checkout.session.completed', session) as any);
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({ data: [] } as any);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('does not grant a tier and answers 500 for retry when line items cannot be fetched (D3)', async () => {
      const session = {
        id: 'cs_test_fallback',
        metadata: { user_id: '5' },
        customer: 'cus_fallback',
        subscription: null,
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_lineitems_down') as any
      );
      vi.mocked(stripe.checkout.sessions.listLineItems).mockRejectedValue(
        new Error('Stripe API unavailable')
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_lineitems_down');
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

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await handleStripeWebhook(req, res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true });
      expect(errSpy.mock.calls.flat().join(' ')).toContain('BILLING-ALERT');
      errSpy.mockRestore();
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


  // ── D1: invoice.paid across Stripe API versions ───────────────────────────
  describe('invoice.paid subscription field shapes (D1)', () => {
    const premiumPlan = {
      id: 'premium', tier: 'premium', name: 'FAULTLINE Intelligence', amount: 9900,
      interval: 'month', description: '', priceId: 'price_premium_monthly',
    } as any;

    async function run(invoice: object) {
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(makeEvent('invoice.paid', invoice) as any);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({ id: 31, accessTier: 'free' } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({ items: { data: [{ price: { id: 'price_premium_monthly' } }] } } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);
      const res = makeRes();
      await handleStripeWebhook(makeReq(invoice), res);
      return res;
    }

    it('handles the CURRENT shape (invoice.parent.subscription_details.subscription, no invoice.subscription)', async () => {
      const res = await run({
        id: 'in_new', customer: 'cus_new',
        parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_new' } },
      });
      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_new');
      expect(updateUserStripe).toHaveBeenCalledWith(31, { accessTier: 'premium', stripeSubscriptionId: 'sub_new' });
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('handles the current line-item shape', async () => {
      await run({
        id: 'in_line', customer: 'cus_line',
        lines: { data: [{ parent: { type: 'subscription_item_details', subscription_item_details: { subscription: 'sub_line' } } }] },
      });
      expect(updateUserStripe).toHaveBeenCalledWith(31, { accessTier: 'premium', stripeSubscriptionId: 'sub_line' });
    });

    it('still handles the LEGACY shape (invoice.subscription)', async () => {
      await run({ id: 'in_old', customer: 'cus_old', subscription: 'sub_old' });
      expect(updateUserStripe).toHaveBeenCalledWith(31, { accessTier: 'premium', stripeSubscriptionId: 'sub_old' });
    });

    it('ignores invoices that are not tied to a subscription', async () => {
      await run({ id: 'in_oneoff', customer: 'cus_oneoff', parent: null });
      expect(updateUserStripe).not.toHaveBeenCalled();
    });

    it('leaves the tier unchanged, logs an alert and answers 500 (retryable, claim released) when the renewal price is unknown (D3)', async () => {
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', { id: 'in_u', customer: 'cus_u', parent: { subscription_details: { subscription: 'sub_u' } } }) as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({ id: 32, accessTier: 'premium' } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({ items: { data: [{ price: { id: 'price_mystery' } }] } } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(undefined);
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const res = makeRes();
      await handleStripeWebhook(makeReq({}), res);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalled();
      expect(errSpy.mock.calls.flat().join(' ')).toContain('BILLING-ALERT');
      errSpy.mockRestore();
    });

    it('answers 500 and releases the claim when the subscription lookup fails transiently', async () => {
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', { id: 'in_t', customer: 'cus_t', subscription: 'sub_t' }, 'evt_transient') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({ id: 33, accessTier: 'free' } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockRejectedValue(new Error('network'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const res = makeRes();
      await handleStripeWebhook(makeReq({}), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_transient');
    });
  });

  // ── D2: idempotency record must not swallow failed grants ──────────────────
  describe('idempotency vs retries (D2)', () => {
    const session = { id: 'cs_idem', metadata: { user_id: '60', plan_id: 'premium' }, customer: 'cus_idem', subscription: 'sub_idem' };
    const premiumPlan = {
      id: 'premium', tier: 'premium', name: 'FAULTLINE Intelligence', amount: 9900,
      interval: 'month', description: '', priceId: 'price_premium_monthly',
    } as any;

    function arrange() {
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(makeEvent('checkout.session.completed', session, 'evt_idem') as any);
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({ data: [{ price: { id: 'price_premium_monthly' } }] } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
    }

    it('releases the claim and returns 500 when the grant throws, so the Stripe retry is processed', async () => {
      arrange();
      vi.mocked(updateUserStripe).mockRejectedValueOnce(new Error('DB blip'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const res1 = makeRes();
      await handleStripeWebhook(makeReq(session), res1);
      expect(res1.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_idem');

      // Stripe retry: claim is new again (released) and the grant now succeeds.
      vi.mocked(recordStripeWebhookEvent).mockResolvedValueOnce(true);
      vi.mocked(updateUserStripe).mockResolvedValueOnce(undefined as any);
      const res2 = makeRes();
      await handleStripeWebhook(makeReq(session), res2);
      expect(res2.json).toHaveBeenCalledWith({ received: true });
      expect(updateUserStripe).toHaveBeenCalledTimes(2);
      expect(updateUserStripe).toHaveBeenLastCalledWith(60, expect.objectContaining({ accessTier: 'premium' }));
    });

    it('does NOT release the claim after a successful grant', async () => {
      arrange();
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);
      await handleStripeWebhook(makeReq(session), makeRes());
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    });

    it('still skips true duplicates (idempotency preserved) without processing or releasing', async () => {
      arrange();
      vi.mocked(recordStripeWebhookEvent).mockResolvedValueOnce(false);
      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);
      expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true });
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    });

    it('answers 500 (not "duplicate") when recording the event fails with a non-duplicate DB error', async () => {
      arrange();
      vi.mocked(recordStripeWebhookEvent).mockRejectedValueOnce(new Error('ECONNRESET'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(updateUserStripe).not.toHaveBeenCalled();
    });

    it('still answers 500 if releasing the claim itself fails', async () => {
      arrange();
      vi.mocked(updateUserStripe).mockRejectedValueOnce(new Error('DB blip'));
      vi.mocked(releaseStripeWebhookEvent).mockRejectedValueOnce(new Error('release failed'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

});
