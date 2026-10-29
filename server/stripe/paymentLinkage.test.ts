import { describe, expect, it } from "vitest";
import {
  PaymentLinkageUnresolvedError,
  paymentOriginFromCheckoutEvent,
  paymentReversalFromEvent,
  reconcilePaymentReversalEvent,
  type PaymentLinkageStore,
  type PaymentOriginRecord,
  type ReconciledPaymentReversal,
  type StripeEventLike,
} from "./paymentLinkage";

const ORIGIN: PaymentOriginRecord = {
  id: 41,
  userId: 7,
  stripeCheckoutSessionId: "cs_test_origin",
  stripePaymentIntentId: "pi_test_origin",
  stripeChargeId: "ch_test_origin",
  stripeCustomerId: "cus_user_a",
  amount: 150000,
  currency: "usd",
  livemode: false,
  sourceEventId: "evt_origin",
  sourceEventCreated: 1_700_000_000,
};

function refundEvent(overrides: Record<string, unknown> = {}): StripeEventLike {
  const object = {
    id: "re_test_partial",
    charge: ORIGIN.stripeChargeId,
    payment_intent: ORIGIN.stripePaymentIntentId,
    amount: 25_000,
    currency: "usd",
    status: "succeeded",
    ...overrides,
  };
  return {
    id: "evt_refund_partial",
    type: "refund.created",
    created: 1_700_000_100,
    livemode: false,
    data: { object },
  };
}

function disputeEvent(overrides: Record<string, unknown> = {}): StripeEventLike {
  return {
    id: "evt_dispute_partial",
    type: "charge.dispute.created",
    created: 1_700_000_200,
    livemode: false,
    data: {
      object: {
        id: "dp_test_partial",
        charge: ORIGIN.stripeChargeId,
        payment_intent: ORIGIN.stripePaymentIntentId,
        amount: 50_000,
        currency: "usd",
        status: "needs_response",
        ...overrides,
      },
    },
  };
}

class MemoryPaymentLinkageStore implements PaymentLinkageStore {
  readonly reversals = new Map<string, ReconciledPaymentReversal>();

  constructor(private readonly origins: PaymentOriginRecord[]) {}

  async findOrigins(identifiers: { stripePaymentIntentId: string | null; stripeChargeId: string | null }): Promise<PaymentOriginRecord[]> {
    return this.origins.filter(origin => (
      (identifiers.stripePaymentIntentId != null && origin.stripePaymentIntentId === identifiers.stripePaymentIntentId)
      || (identifiers.stripeChargeId != null && origin.stripeChargeId === identifiers.stripeChargeId)
    ));
  }

  async captureReversal(reversal: ReconciledPaymentReversal): Promise<"recorded" | "duplicate"> {
    const existing = this.reversals.get(reversal.stripeEventId);
    if (!existing) {
      // Set before yielding so concurrent identical deliveries resolve exactly once.
      this.reversals.set(reversal.stripeEventId, reversal);
      await Promise.resolve();
      return "recorded";
    }
    if (JSON.stringify(existing) === JSON.stringify(reversal)) return "duplicate";
    throw new PaymentLinkageUnresolvedError("reversal_event_conflict");
  }
}

describe("Stripe payment origin linkage", () => {
  it("links a retrieved paid Checkout session to its exact payment intent, charge, customer, amount, currency, and test mode", () => {
    const event: StripeEventLike = {
      id: "evt_checkout",
      type: "checkout.session.completed",
      created: 1_700_000_000,
      livemode: false,
      data: { object: { id: "cs_test_origin", customer: "cus_user_a" } },
    };
    const origin = paymentOriginFromCheckoutEvent(event, {
      id: "cs_test_origin",
      mode: "payment",
      payment_status: "paid",
      amount_total: 150000,
      currency: "usd",
      customer: "cus_user_a",
      livemode: false,
      payment_intent: {
        id: "pi_test_origin",
        status: "succeeded",
        amount_received: 150000,
        currency: "usd",
        customer: "cus_user_a",
        latest_charge: "ch_test_origin",
      },
    }, 7);
    expect(origin).toEqual(expect.objectContaining({
      userId: ORIGIN.userId,
      stripeCheckoutSessionId: ORIGIN.stripeCheckoutSessionId,
      stripePaymentIntentId: ORIGIN.stripePaymentIntentId,
      stripeChargeId: ORIGIN.stripeChargeId,
      stripeCustomerId: ORIGIN.stripeCustomerId,
      amount: ORIGIN.amount,
      currency: ORIGIN.currency,
      livemode: ORIGIN.livemode,
      sourceEventId: "evt_checkout",
      sourceEventCreated: ORIGIN.sourceEventCreated,
    }));
  });

  it.each([
    ["checkout-session mismatch", { id: "cs_other" }, "checkout_session_mismatch"],
    ["amount mismatch", { amount_total: 149999 }, "amount_mismatch"],
    ["currency mismatch", { currency: "eur" }, "currency_mismatch"],
    ["test/live mismatch", { livemode: true }, "livemode_mismatch"],
  ])("fails closed for %s", (_name, override, code) => {
    const event: StripeEventLike = {
      id: "evt_checkout_bad",
      type: "checkout.session.completed",
      created: 1_700_000_000,
      livemode: false,
      data: { object: { id: "cs_test_origin", customer: "cus_user_a" } },
    };
    const session = {
      id: "cs_test_origin",
      mode: "payment",
      payment_status: "paid",
      amount_total: 150000,
      currency: "usd",
      customer: "cus_user_a",
      livemode: false,
      payment_intent: {
        id: "pi_test_origin",
        status: "succeeded",
        amount_received: 150000,
        currency: "usd",
        customer: "cus_user_a",
        latest_charge: "ch_test_origin",
      },
      ...override,
    };
    expect(() => paymentOriginFromCheckoutEvent(event, session, 7)).toThrow(expect.objectContaining({ code }));
  });

  it("does not guess a payment origin for a subscription-mode Checkout session", () => {
    const event: StripeEventLike = {
      id: "evt_subscription_checkout",
      type: "checkout.session.completed",
      created: 1_700_000_000,
      livemode: false,
      data: { object: { id: "cs_subscription" } },
    };
    expect(paymentOriginFromCheckoutEvent(event, {
      id: "cs_subscription",
      mode: "subscription",
    }, 7)).toBeNull();
  });
});

describe("Stripe refund/dispute reconciliation", () => {
  it("records a partial refund as policy-pending evidence without deciding entitlement", async () => {
    const store = new MemoryPaymentLinkageStore([ORIGIN]);
    await expect(reconcilePaymentReversalEvent(refundEvent(), store)).resolves.toBe("recorded");
    expect(store.reversals.get("evt_refund_partial")).toMatchObject({
      userId: 7,
      stripePaymentOriginId: 41,
      reversalAmount: 25_000,
      reconciliationState: "policy_pending",
      canonicalCustomerId: "cus_user_a",
    });
  });

  it("captures a partial dispute as policy-pending evidence without treating it as a refund", async () => {
    const store = new MemoryPaymentLinkageStore([ORIGIN]);
    await expect(reconcilePaymentReversalEvent(disputeEvent(), store)).resolves.toBe("recorded");
    expect(store.reversals.get("evt_dispute_partial")).toMatchObject({
      reversalKind: "dispute",
      providerObjectId: "dp_test_partial",
      reconciliationState: "policy_pending",
    });
  });

  it.each([
    ["a different event customer", refundEvent({ customer: "cus_user_b" }), [ORIGIN], "customer_mismatch"],
    ["a live-mode event for a test origin", { ...refundEvent(), livemode: true }, [ORIGIN], "livemode_mismatch"],
    ["a reversal larger than its original payment", refundEvent({ amount: 150001 }), [ORIGIN], "reversal_amount_exceeds_original"],
    ["an out-of-order refund before original persistence", refundEvent(), [], "missing_original_linkage"],
  ] as const)("does not link %s", async (_name, event, origins, code) => {
    const store = new MemoryPaymentLinkageStore(origins);
    await expect(reconcilePaymentReversalEvent(event, store)).rejects.toMatchObject({ code });
    expect(store.reversals).toHaveLength(0);
  });

  it("refuses identifiers that point to separate user/payment origins", async () => {
    const store = new MemoryPaymentLinkageStore([
      ORIGIN,
      { ...ORIGIN, id: 42, userId: 8, stripePaymentIntentId: "pi_other", stripeChargeId: "ch_other", stripeCustomerId: "cus_user_b" },
    ]);
    await expect(reconcilePaymentReversalEvent(refundEvent({ payment_intent: "pi_other" }), store))
      .rejects.toMatchObject({ code: "ambiguous_original_linkage" });
    expect(store.reversals).toHaveLength(0);
  });

  it("is idempotent across replay and concurrent identical delivery", async () => {
    const store = new MemoryPaymentLinkageStore([ORIGIN]);
    const first = await reconcilePaymentReversalEvent(refundEvent(), store);
    const replay = await reconcilePaymentReversalEvent(refundEvent(), store);
    const concurrentEvent = { ...refundEvent(), id: "evt_refund_concurrent" };
    const concurrent = await Promise.all([
      reconcilePaymentReversalEvent(concurrentEvent, store),
      reconcilePaymentReversalEvent(concurrentEvent, store),
    ]);
    expect(first).toBe("recorded");
    expect(replay).toBe("duplicate");
    expect(concurrent.sort()).toEqual(["duplicate", "recorded"]);
    expect(store.reversals).toHaveLength(2);
  });

  it("retains documented charge.refunded partial amount as a refund fact", () => {
    expect(paymentReversalFromEvent({
      id: "evt_charge_refunded",
      type: "charge.refunded",
      created: 1_700_000_400,
      livemode: false,
      data: { object: {
        id: ORIGIN.stripeChargeId,
        payment_intent: ORIGIN.stripePaymentIntentId,
        amount_refunded: 25_000,
        currency: "usd",
      } },
    })).toMatchObject({
      reversalKind: "refund",
      stripeChargeId: ORIGIN.stripeChargeId,
      reversalAmount: 25_000,
      providerStatus: "refunded",
    });
  });
});
