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
import { checkoutPaymentDecision, handleStripeWebhook, subscriptionGrantDecision, subscriptionIdFromInvoice, subscriptionPaymentDecision, webhookStripeBudgetMs, STRIPE_WEBHOOK_MAX_READS } from './webhook';

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
        retrieve: vi.fn(),
      },
    },
    paymentIntents: {
      retrieve: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
      list: vi.fn(),
    },
  };
  return {
    stripe,
    requireStripe: () => stripe,
  };
});

// Mock db helpers
vi.mock('../db', () => {
  const updateUserStripe = vi.fn();
  const writeEntitlementAudit = vi.fn().mockResolvedValue(undefined);
  const completeStripeWebhookEvent = vi.fn().mockResolvedValue(undefined);
  const commitStripeEntitlement = vi.fn(async (params: {
    eventId: string;
    eventType: string;
    attemptId: string;
    userId: number;
    patch?: Record<string, unknown>;
    revokeSubscriptionId?: string;
    audit: {
      fromTier?: string | null;
      toTier: string;
      reason: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
    };
  }) => {
    if (params.revokeSubscriptionId) {
      await updateUserStripe(params.userId, { accessTier: 'free', stripeSubscriptionId: null });
    } else {
      await updateUserStripe(params.userId, params.patch);
    }
    await writeEntitlementAudit({
      userId: params.userId,
      fromTier: params.audit.fromTier,
      toTier: params.audit.toTier,
      reason: params.audit.reason,
      stripeEventId: params.eventId,
      stripeCustomerId: params.audit.stripeCustomerId,
      stripeSubscriptionId: params.audit.stripeSubscriptionId,
      strict: true,
    });
    await completeStripeWebhookEvent(params.eventId, params.eventType, params.attemptId);
    return 'applied';
  });
  return {
    updateUserStripe,
    getUserByStripeCustomerId: vi.fn(),
    getUserTier: vi.fn().mockResolvedValue('free'),
    recordStripeWebhookEvent: vi.fn().mockResolvedValue({ attemptId: 'a1b2c3d4e5f67890' }),
    releaseStripeWebhookEvent: vi.fn().mockResolvedValue(undefined),
    completeStripeWebhookEvent,
    writeEntitlementAudit,
    entitlementAuditExists: vi.fn().mockResolvedValue(false),
    commitStripeEntitlement,
    StaleStripeWebhookClaimError: class StaleStripeWebhookClaimError extends Error {},
  };
});

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
import { updateUserStripe, getUserByStripeCustomerId, recordStripeWebhookEvent, releaseStripeWebhookEvent, completeStripeWebhookEvent, writeEntitlementAudit, entitlementAuditExists, getUserTier, commitStripeEntitlement } from '../db';

const ATTEMPT_ID = 'a1b2c3d4e5f67890';
const ATTEMPT = { attemptId: ATTEMPT_ID };
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

const premiumPlan = {
  id: 'premium', tier: 'premium' as const, name: 'Pro', amount: 5900,
  interval: 'month' as const, description: '', priceId: 'price_premium_monthly',
};

const paidInvoice = { id: 'in_paid', status: 'paid', amount_paid: 5900, total: 5900 };

const activeSubscription = {
  status: 'active',
  ended_at: null,
  latest_invoice: paidInvoice,
  items: { data: [{ price: { id: 'price_premium_monthly' } }] },
};

function useRetrievedSession(session: object) {
  vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValue({
    payment_status: 'paid',
    payment_intent: null,
    ...session,
  } as any);
}

function useLiveSubscription(status: string, endedAt: number | null = null, invoice: object | null = paidInvoice) {
  vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
    status,
    ended_at: endedAt,
    latest_invoice: status === 'trialing' ? { id: 'in_trial', status: 'paid', amount_paid: 0, total: 0 } : invoice,
    items: { data: [{ price: { id: 'price_premium_monthly' } }] },
  } as any);
}

/** Dahlia invoice: subscription id lives on parent.subscription_details, not invoice.subscription. */
function dahliaInvoice(subscriptionId: string, customer = 'cus_renew', id = 'in_dahlia') {
  return {
    id,
    customer,
    parent: {
      subscription_details: { subscription: subscriptionId },
    },
    lines: {
      data: [{
        parent: {
          subscription_item_details: { subscription: subscriptionId },
        },
      }],
    },
  };
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
    vi.mocked(recordStripeWebhookEvent).mockResolvedValue(ATTEMPT);
    vi.mocked(releaseStripeWebhookEvent).mockResolvedValue(undefined);
    vi.mocked(completeStripeWebhookEvent).mockResolvedValue(undefined);
    vi.mocked(getUserTier).mockResolvedValue('free');
    vi.mocked(entitlementAuditExists).mockResolvedValue(false);
    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(activeSubscription as any);
    vi.mocked(stripe.subscriptions.list).mockResolvedValue({ data: [] } as any);
    vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({ id: 'pi_default', status: 'succeeded' } as any);
    vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValue({
      id: 'cs_default',
      payment_status: 'unpaid',
      payment_intent: null,
      metadata: {},
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
      useRetrievedSession(session);

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
      expect(writeEntitlementAudit).toHaveBeenCalledWith(expect.objectContaining({
        userId: 42,
        toTier: 'core',
        stripeEventId: 'evt_live_123',
        strict: true,
      }));
      expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith(
        'cs_test_123',
        { expand: ['payment_intent'] },
        { timeout: 8000, maxNetworkRetries: 0 },
      );
      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith(
        'sub_xyz',
        { expand: ['latest_invoice'] },
        { timeout: 8000, maxNetworkRetries: 0 },
      );
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('upgrades user to premium tier when premium plan price is found', async () => {
      const session = {
        id: 'cs_test_456',
        metadata: { user_id: '7' },
        customer: 'cus_def',
        subscription: 'sub_prem',
      };
      useRetrievedSession(session);

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
      useRetrievedSession(session);

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
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 999,
        payment_intent: { id: 'pi_fallback', status: 'succeeded', amount: 999, amount_received: 999 },
        metadata: { user_id: '5' },
        customer: 'cus_fallback',
        subscription: null,
      };
      useRetrievedSession(session);

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
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_live_123', ATTEMPT_ID, 'checkout.session.completed');
    });

    it('fails closed without retrying when the line item has no readable price', async () => {
      const session = {
        id: 'cs_test_no_price',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 999,
        payment_intent: { id: 'pi_no_price', status: 'succeeded', amount: 999, amount_received: 999 },
        metadata: { user_id: '5' },
        customer: 'cus_no_price',
        subscription: null,
      };
      useRetrievedSession(session);
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
      expect(completeStripeWebhookEvent).toHaveBeenCalledWith('evt_no_price', 'checkout.session.completed', ATTEMPT_ID);
      expect(errorSpy.mock.calls.flat().join(' ')).toContain('[Stripe Webhook][BILLING-ALERT]');
      errorSpy.mockRestore();
    });

    it('fails closed without retrying for an unknown configured-price mapping', async () => {
      const session = {
        id: 'cs_test_unknown_price',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 999,
        payment_intent: { id: 'pi_unknown', status: 'succeeded', amount: 999, amount_received: 999 },
        metadata: { user_id: '5' },
        customer: 'cus_unknown',
        subscription: null,
      };
      useRetrievedSession(session);
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
      expect(completeStripeWebhookEvent).toHaveBeenCalledWith('evt_unknown_price', 'checkout.session.completed', ATTEMPT_ID);
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
      useRetrievedSession(session);

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
      const invoice = dahliaInvoice('sub_renew', 'cus_renew', 'in_renewal_123');

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice) as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 11, accessTier: 'free',
      } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        status: 'active',
        ended_at: null,
        latest_invoice: paidInvoice,
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

    it('alerts and does not grant when invoice.paid has no subscription id', async () => {
      const invoice = {
        id: 'in_onetime_123',
        customer: 'cus_onetime',
        lines: { data: [{ parent: { invoice_item_details: { subscription: null } } }] },
      };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_onetime') as any
      );
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = makeRes();
      await handleStripeWebhook(makeReq(invoice), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(writeEntitlementAudit).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'missing_subscription' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
      expect(completeStripeWebhookEvent).toHaveBeenCalledWith('evt_onetime', 'invoice.paid', ATTEMPT_ID);
      expect(errorSpy.mock.calls.flat().join(' ')).toContain('[Stripe Webhook][BILLING-ALERT]');
      errorSpy.mockRestore();
    });

    it('skips processing when no user found for customer ID', async () => {
      const invoice = dahliaInvoice('sub_unknown', 'cus_unknown', 'in_unknown_123');

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
      useLiveSubscription('canceled', 1_700_000_000);
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
      useRetrievedSession(session);
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
      vi.mocked(recordStripeWebhookEvent).mockResolvedValue(ATTEMPT);
      vi.mocked(entitlementAuditExists).mockResolvedValue(false);
      vi.mocked(stripe.subscriptions.list).mockResolvedValue({ data: [] } as any);

      // Step 2: Subscription cancelled → user downgraded to free
      const cancellation = { id: 'sub_flow', customer: 'cus_flow' };
      useLiveSubscription('canceled', 1_700_000_000);
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
      useRetrievedSession(session);
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
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_idempotency', ATTEMPT_ID, 'checkout.session.completed');

      const retry = makeRes();
      await handleStripeWebhook(makeReq(session), retry);

      expect(retry.json).toHaveBeenCalledWith({ received: true });
      expect(recordStripeWebhookEvent).toHaveBeenCalledTimes(2);
      expect(updateUserStripe).toHaveBeenLastCalledWith(60, expect.objectContaining({ accessTier: 'premium' }));
    });

    it('skips only a genuine duplicate claim without processing or releasing it', async () => {
      arrangeSuccessfulCheckout();
      vi.mocked(recordStripeWebhookEvent).mockResolvedValueOnce(null);

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
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_idempotency', ATTEMPT_ID, 'checkout.session.completed');
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

      vi.mocked(recordStripeWebhookEvent).mockResolvedValueOnce(ATTEMPT);
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

    it('releases the claim when the entitlement transaction rolls back', async () => {
      arrangeSuccessfulCheckout();
      vi.mocked(commitStripeEntitlement).mockRejectedValueOnce(new Error('transaction rolled back'));

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_idempotency', ATTEMPT_ID, 'checkout.session.completed');
      expect(res.json).not.toHaveBeenCalledWith({ received: true });
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
      useRetrievedSession(session);
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
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_release_cancel', ATTEMPT_ID, 'checkout.session.completed');

      vi.mocked(updateUserStripe).mockReset();
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);
      vi.mocked(releaseStripeWebhookEvent).mockClear();
      useLiveSubscription('canceled', 1_700_000_000);
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
      vi.mocked(recordStripeWebhookEvent).mockResolvedValue(ATTEMPT);

      const retry = makeRes();
      await handleStripeWebhook(makeReq(session), retry);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(writeEntitlementAudit).not.toHaveBeenCalled();
      expect(retry.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    });

    it('does not re-grant a renewal after release, cancellation, and retry', async () => {
      const invoice = dahliaInvoice('sub_release_cancel', 'cus_release_cancel', 'in_release_cancel');
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
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_invoice_release_cancel', ATTEMPT_ID, 'invoice.paid');

      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);
      vi.mocked(releaseStripeWebhookEvent).mockClear();
      useLiveSubscription('canceled', 1_700_000_000);
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
      useLiveSubscription('canceled', 1_700_000_000);
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
      const invoice = dahliaInvoice('sub_order', 'cus_order', 'in_older');
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
      useRetrievedSession(session);
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
      const invoice = dahliaInvoice('sub_trial', 'cus_trial', 'in_trial');
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
      const invoice = dahliaInvoice('sub_unknown_price', 'cus_unknown_price', 'in_unknown_price');
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_invoice_unknown_price') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 90, accessTier: 'core', lifetimeAccess: false,
      } as any);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        status: 'active',
        ended_at: null,
        latest_invoice: paidInvoice,
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
      expect(completeStripeWebhookEvent).toHaveBeenCalledWith('evt_invoice_unknown_price', 'invoice.paid', ATTEMPT_ID);
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
        latest_invoice: paidInvoice,
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
      const invoice = dahliaInvoice('sub_retrieve_fail', 'cus_retrieve_fail', 'in_retrieve_fail');
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
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_retrieve_fail', ATTEMPT_ID, 'invoice.paid');
      expect(res.json).not.toHaveBeenCalledWith({ received: true });
    });
  });

  describe('verified checkout payment', () => {
    const lifetimeSession = {
      id: 'cs_lifetime',
      metadata: { user_id: '42', plan_id: 'lifetime' },
      customer: 'cus_life',
      subscription: null,
    };
    const subscriptionSession = {
      id: 'cs_sub_pay',
      metadata: { user_id: '42' },
      customer: 'cus_sub_pay',
      subscription: 'sub_pay',
    };

    function arrangeLifetimePrice() {
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_lifetime' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue({
        id: 'lifetime', tier: 'founding', name: 'Lifetime', amount: 49900,
        interval: 'year', description: '', priceId: 'price_lifetime',
      });
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);
    }

    it('grants lifetime only after the retrieved session is paid and the PaymentIntent succeeded', async () => {
      arrangeLifetimePrice();
      useRetrievedSession({
        ...lifetimeSession,
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 29900,
        payment_intent: 'pi_lifetime',
      });
      vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({
        id: 'pi_lifetime', status: 'succeeded', amount: 29900, amount_received: 29900,
      } as any);
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', { id: 'cs_lifetime', payment_status: 'unpaid' }, 'evt_lifetime_paid') as any
      );

      const res = makeRes();
      await handleStripeWebhook(makeReq({ id: 'cs_lifetime' }), res);

      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_lifetime', {}, { timeout: 8000, maxNetworkRetries: 0 });
      expect(updateUserStripe).toHaveBeenCalledWith(42, expect.objectContaining({
        accessTier: 'founding',
        stripeCustomerId: 'cus_life',
        lifetimeAccess: true,
      }));
      const written = vi.mocked(updateUserStripe).mock.calls[0][1] as { lifetimePurchasedAt?: Date };
      expect(written.lifetimePurchasedAt).toBeInstanceOf(Date);
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('does not grant lifetime when the event says paid but the retrieved session is unpaid', async () => {
      arrangeLifetimePrice();
      useRetrievedSession({ ...lifetimeSession, payment_status: 'unpaid' });
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', { ...lifetimeSession, payment_status: 'paid' }, 'evt_lifetime_unpaid') as any
      );
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = makeRes();
      await handleStripeWebhook(makeReq(lifetimeSession), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'payment_not_verified' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
      expect(errorSpy.mock.calls.flat().join(' ')).toContain('lifetime');
      errorSpy.mockRestore();
    });

    it('denies no_payment_required and a zero amount for lifetime, including a 100% promotion', async () => {
      arrangeLifetimePrice();
      useRetrievedSession({ ...lifetimeSession, mode: 'payment', payment_status: 'no_payment_required', amount_total: 0 });
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', lifetimeSession, 'evt_life_nopay') as any
      );
      const res = makeRes();
      await handleStripeWebhook(makeReq(lifetimeSession), res);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'payment_not_verified' });
      expect(res.status).not.toHaveBeenCalledWith(500);
    });

    it('does not grant lifetime when the session is paid but the PaymentIntent or total is missing or zero', async () => {
      arrangeLifetimePrice();
      useRetrievedSession({
        ...lifetimeSession,
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 29900,
        payment_intent: null,
      });
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', { ...lifetimeSession, payment_status: 'paid' }, 'evt_life_no_pi') as any
      );
      const missing = makeRes();
      await handleStripeWebhook(makeReq(lifetimeSession), missing);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(missing.json).toHaveBeenCalledWith({ received: true, ignored: 'payment_not_verified' });

      vi.mocked(updateUserStripe).mockClear();
      useRetrievedSession({
        ...lifetimeSession,
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 0,
        payment_intent: { id: 'pi_zero', status: 'succeeded', amount: 0, amount_received: 0 },
      });
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', lifetimeSession, 'evt_life_zero') as any
      );
      const zero = makeRes();
      await handleStripeWebhook(makeReq(lifetimeSession), zero);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(zero.json).toHaveBeenCalledWith({ received: true, ignored: 'zero_amount' });
    });

    it('does not grant when the PaymentIntent exists but has not succeeded', async () => {
      arrangeLifetimePrice();
      useRetrievedSession({
        ...lifetimeSession,
        payment_status: 'paid',
        payment_intent: { id: 'pi_pending', status: 'processing' },
      });
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', lifetimeSession, 'evt_pi_processing') as any
      );

      const res = makeRes();
      await handleStripeWebhook(makeReq(lifetimeSession), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'payment_not_verified' });
    });

    it('does not grant on checkout.session.completed while payment is still unpaid', async () => {
      arrangeLifetimePrice();
      useRetrievedSession({ ...lifetimeSession, payment_status: 'unpaid', payment_intent: { id: 'pi_async', status: 'processing' } });
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', lifetimeSession, 'evt_async_pending') as any
      );

      const res = makeRes();
      await handleStripeWebhook(makeReq(lifetimeSession), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'payment_not_verified' });
      expect(completeStripeWebhookEvent).toHaveBeenCalledWith('evt_async_pending', 'checkout.session.completed', ATTEMPT_ID);
    });

    it('grants on async_payment_succeeded only after a fresh retrieve shows paid', async () => {
      arrangeLifetimePrice();
      useRetrievedSession({
        ...lifetimeSession,
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 29900,
        payment_intent: { id: 'pi_async_ok', status: 'succeeded', amount: 29900, amount_received: 29900 },
      });
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.async_payment_succeeded', { id: 'cs_lifetime' }, 'evt_async_ok') as any
      );

      const res = makeRes();
      await handleStripeWebhook(makeReq({ id: 'cs_lifetime' }), res);

      expect(updateUserStripe).toHaveBeenCalledWith(42, expect.objectContaining({ lifetimeAccess: true }));
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('does not grant async_payment_succeeded when the retrieved session is still unpaid', async () => {
      arrangeLifetimePrice();
      useRetrievedSession({ ...lifetimeSession, payment_status: 'unpaid' });
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.async_payment_succeeded', lifetimeSession, 'evt_async_still_unpaid') as any
      );

      const res = makeRes();
      await handleStripeWebhook(makeReq(lifetimeSession), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'payment_not_verified' });
    });

    it.each(['checkout.session.async_payment_failed', 'checkout.session.expired'])('does not grant on %s', async (eventType) => {
      arrangeLifetimePrice();
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent(eventType, { ...lifetimeSession, payment_status: 'paid' }, `evt_${eventType}`) as any
      );
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = makeRes();
      await handleStripeWebhook(makeReq(lifetimeSession), res);

      expect(stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'payment_not_completed' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
      expect(errorSpy.mock.calls.flat().join(' ')).toContain('[Stripe Webhook][BILLING-ALERT]');
      errorSpy.mockRestore();
    });

    it('does not grant a subscription checkout when the live status flips to canceled before the write', async () => {
      useRetrievedSession(subscriptionSession);
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_premium_monthly' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(stripe.subscriptions.retrieve)
        .mockResolvedValueOnce({ ...activeSubscription } as any)
        .mockResolvedValueOnce({ status: 'canceled', ended_at: 1_700_000_000, items: { data: [{ price: { id: 'price_premium_monthly' } }] } } as any);
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', subscriptionSession, 'evt_flip_checkout') as any
      );

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscriptionSession), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    });
  });

  describe('dahlia invoice renewals', () => {
    it('renews from a line-item subscription id when parent.subscription_details is absent', async () => {
      const invoice = {
        id: 'in_line_only',
        customer: 'cus_line',
        lines: {
          data: [{
            parent: { subscription_item_details: { subscription: 'sub_from_line' } },
          }],
        },
      };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_line_only') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({ id: 12, accessTier: 'core' } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const res = makeRes();
      await handleStripeWebhook(makeReq(invoice), res);

      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith(
        'sub_from_line',
        { expand: ['latest_invoice'] },
        { timeout: 8000, maxNetworkRetries: 0 },
      );
      expect(updateUserStripe).toHaveBeenCalledWith(12, {
        accessTier: 'premium',
        stripeSubscriptionId: 'sub_from_line',
      });
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('falls back to the legacy invoice.subscription field when the Dahlia parent is absent', async () => {
      const invoice = { id: 'in_legacy', customer: 'cus_legacy', subscription: 'sub_legacy' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_legacy_invoice') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({ id: 13, accessTier: 'free' } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      await handleStripeWebhook(makeReq(invoice), makeRes());

      expect(updateUserStripe).toHaveBeenCalledWith(13, {
        accessTier: 'premium',
        stripeSubscriptionId: 'sub_legacy',
      });
    });

    it('does not grant a zero-dollar invoice.paid or an active update with a zero latest invoice', async () => {
      const invoice = { ...dahliaInvoice('sub_zero', 'cus_zero', 'in_zero'), amount_paid: 0, total: 0 };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_zero_invoice') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({ id: 15, accessTier: 'free' } as any);
      useLiveSubscription('active', null, { id: 'in_zero', status: 'paid', amount_paid: 5900, total: 5900 });
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);

      const invoiceRes = makeRes();
      await handleStripeWebhook(makeReq(invoice), invoiceRes);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(invoiceRes.json).toHaveBeenCalledWith({ received: true, ignored: 'zero_amount' });

      vi.mocked(updateUserStripe).mockClear();
      const updated = { id: 'sub_zero', customer: 'cus_zero', status: 'active' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.updated', updated, 'evt_zero_update') as any
      );
      useLiveSubscription('active', null, { id: 'in_zero', status: 'paid', amount_paid: 0, total: 0 });
      const updateRes = makeRes();
      await handleStripeWebhook(makeReq(updated), updateRes);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(updateRes.json).toHaveBeenCalledWith({ received: true, ignored: 'zero_amount' });
    });

    it('still grants a trialing subscription update when the latest invoice is zero', async () => {
      const updated = { id: 'sub_trial_zero', customer: 'cus_trial_zero', status: 'trialing' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.updated', updated, 'evt_trial_zero') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({ id: 16, accessTier: 'free' } as any);
      useLiveSubscription('trialing');
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const res = makeRes();
      await handleStripeWebhook(makeReq(updated), res);
      expect(updateUserStripe).toHaveBeenCalledWith(16, {
        accessTier: 'premium',
        stripeSubscriptionId: 'sub_trial_zero',
      });
    });

    it('does not renew when the subscription is canceled on the read immediately before the write', async () => {
      const invoice = dahliaInvoice('sub_flip', 'cus_flip', 'in_flip');
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_invoice_flip') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({ id: 14, accessTier: 'free' } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(stripe.subscriptions.retrieve)
        .mockResolvedValueOnce({ ...activeSubscription } as any)
        .mockResolvedValueOnce({ status: 'canceled', ended_at: 1, items: activeSubscription.items } as any);

      const res = makeRes();
      await handleStripeWebhook(makeReq(invoice), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
    });

    it('alerts instead of retrying when the customer id is missing', async () => {
      const invoice = {
        id: 'in_no_customer',
        parent: { subscription_details: { subscription: 'sub_no_customer' } },
      };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_no_customer') as any
      );
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = makeRes();
      await handleStripeWebhook(makeReq(invoice), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'missing_subscription' });
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(errorSpy.mock.calls.flat().join(' ')).toContain('[Stripe Webhook][BILLING-ALERT]');
      errorSpy.mockRestore();
    });
  });

  describe('live downgrade reconciliation', () => {
    const user = { id: 30, accessTier: 'premium', lifetimeAccess: false };

    function deletedEvent(id = 'evt_deleted_live') {
      const subscription = { id: 'sub_live', customer: 'cus_live' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', subscription, id) as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(user as any);
      return subscription;
    }

    it('does not downgrade a deleted event when the live subscription is still active', async () => {
      const subscription = deletedEvent('evt_stale_deleted');
      useLiveSubscription('active');

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscription), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
    });

    it.each(['canceled', 'unpaid', 'past_due'])('does not downgrade subscription.updated %s when the live subscription is still entitled', async (status) => {
      const subscription = { id: 'sub_live', customer: 'cus_live', status };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.updated', subscription, `evt_stale_${status}`) as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(user as any);
      useLiveSubscription(status === 'past_due' ? 'trialing' : 'active');

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscription), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
    });

    it('does not downgrade when another active subscription remains', async () => {
      const subscription = deletedEvent('evt_other_active');
      useLiveSubscription('canceled', 1_700_000_000);
      vi.mocked(stripe.subscriptions.list).mockImplementation(async (params: { status?: string }) => ({
        data: params?.status === 'active' ? [{ id: 'sub_other', status: 'active' }] : [],
      }) as any);

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscription), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(stripe.subscriptions.list).toHaveBeenCalledWith(
        { customer: 'cus_live', status: 'active', limit: 100 },
        { timeout: 8000, maxNetworkRetries: 0 },
      );
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
    });

    it('downgrades when the live subscription is canceled and no other subscription entitles the customer', async () => {
      const subscription = deletedEvent('evt_real_deleted');
      useLiveSubscription('canceled', 1_700_000_000);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscription), res);

      expect(updateUserStripe).toHaveBeenCalledWith(30, {
        accessTier: 'free',
        stripeSubscriptionId: null,
      });
      expect(writeEntitlementAudit).toHaveBeenCalledWith(expect.objectContaining({
        toTier: 'free',
        reason: 'customer.subscription.deleted',
        strict: true,
      }));
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it.each(['canceled', 'unpaid', 'past_due'])('downgrades subscription.updated %s only after the live subscription matches', async (status) => {
      const subscription = { id: 'sub_live', customer: 'cus_live', status };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.updated', subscription, `evt_down_${status}`) as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(user as any);
      useLiveSubscription(status === 'canceled' ? 'canceled' : status, status === 'canceled' ? 1_700_000_000 : null);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscription), res);

      expect(updateUserStripe).toHaveBeenCalledWith(30, {
        accessTier: 'free',
        stripeSubscriptionId: null,
      });
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('downgrades when Stripe says the subscription no longer exists and nothing else is active', async () => {
      const subscription = deletedEvent('evt_missing_sub');
      vi.mocked(stripe.subscriptions.retrieve).mockRejectedValue({ code: 'resource_missing', statusCode: 404 });
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscription), res);

      expect(updateUserStripe).toHaveBeenCalledWith(30, {
        accessTier: 'free',
        stripeSubscriptionId: null,
      });
    });

    it('does not downgrade when listing the customer subscriptions fails', async () => {
      const subscription = deletedEvent('evt_list_fail');
      useLiveSubscription('canceled', 1_700_000_000);
      vi.mocked(stripe.subscriptions.list).mockRejectedValue(new Error('Stripe list failed'));

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscription), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_list_fail', ATTEMPT_ID, 'customer.subscription.deleted');
    });

    it('asks for a conditional revoke and does not treat a skipped row as a downgrade', async () => {
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 31, accessTier: 'founding', lifetimeAccess: true,
      } as any);
      useLiveSubscription('canceled', 1_700_000_000);
      const cases = [
        ['customer.subscription.deleted', { id: 'sub_life', customer: 'cus_life_keep' }, 'evt_life_deleted'],
        ['customer.subscription.updated', { id: 'sub_life', customer: 'cus_life_keep', status: 'canceled' }, 'evt_life_canceled'],
        ['customer.subscription.updated', { id: 'sub_life', customer: 'cus_life_keep', status: 'unpaid' }, 'evt_life_unpaid'],
        ['customer.subscription.updated', { id: 'sub_life', customer: 'cus_life_keep', status: 'past_due' }, 'evt_life_past_due'],
      ] as const;
      for (const [type, payload, id] of cases) {
        vi.mocked(commitStripeEntitlement).mockResolvedValueOnce('revoke_skipped' as 'applied');
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(makeEvent(type, payload, id) as any);
        vi.mocked(updateUserStripe).mockClear();
        const res = makeRes();
        await handleStripeWebhook(makeReq(payload), res);
        expect(commitStripeEntitlement).toHaveBeenCalledWith(expect.objectContaining({
          userId: 31,
          revokeSubscriptionId: 'sub_life',
          attemptId: ATTEMPT_ID,
        }));
        expect(updateUserStripe).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'revoke_not_applied' });
      }
    });

    it('does not downgrade when the conditional update skips a lifetime buyer loaded as non-lifetime', async () => {
      const subscription = { id: 'sub_race', customer: 'cus_race' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', subscription, 'evt_life_race') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 34, accessTier: 'premium', lifetimeAccess: false,
      } as any);
      useLiveSubscription('canceled', 1_700_000_000);
      vi.mocked(commitStripeEntitlement).mockResolvedValueOnce('revoke_skipped' as 'applied');

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscription), res);

      expect(commitStripeEntitlement).toHaveBeenCalledWith(expect.objectContaining({
        userId: 34,
        revokeSubscriptionId: 'sub_race',
      }));
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true, ignored: 'revoke_not_applied' });
    });

    it('finds an entitling subscription on a later page and refuses to revoke when the list is longer than the cap', async () => {
      const subscription = deletedEvent('evt_page');
      useLiveSubscription('canceled', 1_700_000_000);
      vi.mocked(stripe.subscriptions.list).mockImplementation(async (params: { status?: string; starting_after?: string }) => {
        if (params.status === 'active' && !params.starting_after) {
          return { data: [{ id: 'sub_page_1', status: 'canceled' }], has_more: true };
        }
        if (params.status === 'active' && params.starting_after === 'sub_page_1') {
          return { data: [{ id: 'sub_page_2', status: 'active' }], has_more: false };
        }
        return { data: [], has_more: false };
      });

      const found = makeRes();
      await handleStripeWebhook(makeReq(subscription), found);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(found.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });

      vi.mocked(updateUserStripe).mockClear();
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', subscription, 'evt_page_cap') as any
      );
      vi.mocked(stripe.subscriptions.list).mockImplementation(async () => ({
        data: [{ id: 'sub_only', status: 'canceled' }],
        has_more: true,
      }));
      const capped = makeRes();
      await handleStripeWebhook(makeReq({ id: 'sub_live', customer: 'cus_live' }), capped);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(capped.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });
    });

    it('reactivates from subscription.updated only when the live subscription is entitled', async () => {
      const subscription = {
        id: 'sub_back',
        customer: 'cus_back',
        status: 'active',
        items: { data: [{ price: { id: 'price_premium_monthly' } }] },
      };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.updated', subscription, 'evt_reactivate') as any
      );
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 32, accessTier: 'free', lifetimeAccess: false,
      } as any);
      useLiveSubscription('active');
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);

      const res = makeRes();
      await handleStripeWebhook(makeReq(subscription), res);

      expect(updateUserStripe).toHaveBeenCalledWith(32, {
        accessTier: 'premium',
        stripeSubscriptionId: 'sub_back',
      });
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it('renews, ignores a stale cancellation, revokes only after the live cancel, then reactivates', async () => {
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(updateUserStripe).mockResolvedValue(undefined as any);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 33, accessTier: 'premium', lifetimeAccess: false,
      } as any);

      const invoice = dahliaInvoice('sub_seq', 'cus_seq', 'in_seq');
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_seq_invoice') as any
      );
      useLiveSubscription('active');
      await handleStripeWebhook(makeReq(invoice), makeRes());
      expect(updateUserStripe).toHaveBeenCalledWith(33, {
        accessTier: 'premium',
        stripeSubscriptionId: 'sub_seq',
      });

      vi.mocked(updateUserStripe).mockClear();
      const deleted = { id: 'sub_seq', customer: 'cus_seq' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', deleted, 'evt_seq_stale_deleted') as any
      );
      const stale = makeRes();
      await handleStripeWebhook(makeReq(deleted), stale);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(stale.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });

      useLiveSubscription('canceled', 1_700_000_000);
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.deleted', deleted, 'evt_seq_real_deleted') as any
      );
      await handleStripeWebhook(makeReq(deleted), makeRes());
      expect(updateUserStripe).toHaveBeenCalledWith(33, {
        accessTier: 'free',
        stripeSubscriptionId: null,
      });

      vi.mocked(updateUserStripe).mockClear();
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 33, accessTier: 'free', lifetimeAccess: false,
      } as any);
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('invoice.paid', invoice, 'evt_seq_late_invoice') as any
      );
      const late = makeRes();
      await handleStripeWebhook(makeReq(invoice), late);
      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(late.json).toHaveBeenCalledWith({ received: true, ignored: 'subscription_not_entitled' });

      useLiveSubscription('active');
      const reactivated = { id: 'sub_seq', customer: 'cus_seq', status: 'active' };
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('customer.subscription.updated', reactivated, 'evt_seq_reactivated') as any
      );
      await handleStripeWebhook(makeReq(reactivated), makeRes());
      expect(updateUserStripe).toHaveBeenCalledWith(33, {
        accessTier: 'premium',
        stripeSubscriptionId: 'sub_seq',
      });
    });
  });

  describe('entitlement replay after a partial write', () => {
    const session = {
      id: 'cs_replay',
      metadata: { user_id: '60' },
      customer: 'cus_replay',
      subscription: 'sub_replay',
    };

    it('releases the claim when the entitlement transaction fails, and does not release a lost fence', async () => {
      useRetrievedSession(session);
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_premium_monthly' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(commitStripeEntitlement).mockRejectedValueOnce(new Error('transaction rolled back'));
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_audit_fail') as any
      );

      const failed = makeRes();
      await handleStripeWebhook(makeReq(session), failed);
      expect(failed.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_audit_fail', ATTEMPT_ID, 'checkout.session.completed');

      vi.mocked(releaseStripeWebhookEvent).mockClear();
      vi.mocked(commitStripeEntitlement).mockResolvedValueOnce('claim_lost' as 'applied');
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_claim_lost') as any
      );
      const lost = makeRes();
      await handleStripeWebhook(makeReq(session), lost);
      expect(lost.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    });

    it('does not write the entitlement again when this event already has an audit row', async () => {
      useRetrievedSession(session);
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_premium_monthly' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(entitlementAuditExists).mockResolvedValue(true);
      vi.mocked(recordStripeWebhookEvent).mockResolvedValue(ATTEMPT);
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_audit_exists') as any
      );

      const replay = makeRes();
      await handleStripeWebhook(makeReq(session), replay);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(writeEntitlementAudit).not.toHaveBeenCalled();
      expect(replay.json).toHaveBeenCalledWith({ received: true, ignored: 'already_applied' });
      expect(releaseStripeWebhookEvent).not.toHaveBeenCalled();
    });

    it('returns 500 and releases when sealing the claim fails inside the entitlement transaction', async () => {
      useRetrievedSession(session);
      vi.mocked(stripe.checkout.sessions.listLineItems).mockResolvedValue({
        data: [{ price: { id: 'price_premium_monthly' } }],
      } as any);
      vi.mocked(getPlanByPriceId).mockReturnValue(premiumPlan);
      vi.mocked(commitStripeEntitlement).mockRejectedValueOnce(new Error('complete failed'));
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
        makeEvent('checkout.session.completed', session, 'evt_complete_fail') as any
      );

      const res = makeRes();
      await handleStripeWebhook(makeReq(session), res);

      expect(updateUserStripe).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(releaseStripeWebhookEvent).toHaveBeenCalledWith('evt_complete_fail', ATTEMPT_ID, 'checkout.session.completed');
      expect(res.json).not.toHaveBeenCalledWith({ received: true });
    });
  });

});

describe('checkout and invoice id helpers', () => {
  it('grants a payment-mode session only with a succeeded PaymentIntent and a positive amount', () => {
    expect(checkoutPaymentDecision({
      paymentStatus: 'paid',
      paymentIntentStatus: 'succeeded',
      amountTotal: 29900,
      paymentIntentAmount: 29900,
    })).toEqual({ grant: true });
    expect(checkoutPaymentDecision({ paymentStatus: 'paid' })).toEqual({ grant: false, reason: 'payment_intent_missing' });
    expect(checkoutPaymentDecision({
      paymentStatus: 'paid',
      paymentIntentStatus: 'succeeded',
      amountTotal: 29900,
    })).toEqual({ grant: false, reason: 'zero_amount' });
    expect(checkoutPaymentDecision({
      paymentStatus: 'paid',
      paymentIntentStatus: 'succeeded',
      amountTotal: 0,
      paymentIntentAmount: 0,
    })).toEqual({ grant: false, reason: 'zero_amount' });
    expect(checkoutPaymentDecision({ paymentStatus: 'paid', paymentIntentStatus: 'processing' })).toEqual({
      grant: false,
      reason: 'payment_intent_not_succeeded',
    });
    expect(checkoutPaymentDecision({ paymentStatus: 'unpaid' })).toEqual({ grant: false, reason: 'unpaid' });
    expect(checkoutPaymentDecision({ paymentStatus: 'no_payment_required' })).toEqual({
      grant: false,
      reason: 'no_payment_required',
    });
    expect(checkoutPaymentDecision({ paymentStatus: '' })).toEqual({ grant: false, reason: 'unknown' });
  });

  it('grants trialing without a charge and refuses a zero-dollar active invoice', () => {
    expect(subscriptionPaymentDecision({
      subscription: { status: 'trialing', latest_invoice: { status: 'paid', amount_paid: 0, total: 0 } },
      eventAmountPaid: 0,
      eventTotal: 0,
    })).toEqual({ grant: true });
    expect(subscriptionPaymentDecision({
      subscription: { status: 'active', latest_invoice: { status: 'paid', amount_paid: 5900, total: 5900 } },
      eventAmountPaid: 5900,
    })).toEqual({ grant: true });
    expect(subscriptionPaymentDecision({
      subscription: { status: 'active', latest_invoice: { status: 'paid', amount_paid: 0, total: 0 } },
    })).toEqual({ grant: false, reason: 'zero_amount' });
    expect(subscriptionPaymentDecision({
      subscription: { status: 'active', latest_invoice: { status: 'paid', amount_paid: 5900, total: 5900 } },
      eventAmountPaid: 0,
    })).toEqual({ grant: false, reason: 'zero_amount' });
    expect(subscriptionPaymentDecision({
      subscription: { status: 'active', latest_invoice: { status: 'open', amount_paid: 5900, total: 5900 } },
    })).toEqual({ grant: false, reason: 'invoice_not_paid' });
    expect(subscriptionPaymentDecision({
      subscription: { status: 'active', latest_invoice: 'in_unexpanded' },
    })).toEqual({ grant: false, reason: 'invoice_not_paid' });
    expect(subscriptionPaymentDecision({
      subscription: { status: 'canceled', ended_at: 1 },
    })).toEqual({ grant: false, reason: 'subscription_not_entitled' });
    expect(webhookStripeBudgetMs()).toBe(STRIPE_WEBHOOK_MAX_READS * 8_000);
    expect(webhookStripeBudgetMs()).toBeLessThan(90_000);
  });

  it('reads the Dahlia subscription id, then a line, then the legacy field', () => {
    expect(subscriptionIdFromInvoice({
      subscription: 'sub_legacy',
      parent: { subscription_details: { subscription: 'sub_parent' } },
      lines: { data: [{ parent: { subscription_item_details: { subscription: 'sub_line' } } }] },
    })).toBe('sub_parent');
    expect(subscriptionIdFromInvoice({
      lines: { data: [{ parent: { invoice_item_details: { subscription: 'sub_item' } } }] },
    })).toBe('sub_item');
    expect(subscriptionIdFromInvoice({
      lines: { data: [{ subscription: 'sub_line_legacy' }] },
    })).toBe('sub_line_legacy');
    expect(subscriptionIdFromInvoice({
      parent: { subscription_details: { subscription: { id: 'sub_expanded' } } },
    })).toBe('sub_expanded');
    expect(subscriptionIdFromInvoice({ subscription: 'sub_legacy_only' })).toBe('sub_legacy_only');
    expect(subscriptionIdFromInvoice({ customer: 'cus_only' } as { subscription?: unknown })).toBeNull();
  });
});
