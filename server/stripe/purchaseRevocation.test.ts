/**
 * Refund and dispute decisions. These do not touch Stripe or a database.
 * The MariaDB harness covers the claim fence, the revocation row lock, and
 * concurrent delivery.
 */
import { describe, expect, it } from "vitest";
import { PRICING_PLANS } from "../../shared/tiers";
import {
  decideEntitlement,
  chargeViewFromRecord,
  invoiceIdFromInvoicePayments,
  lifetimePaymentIntentId,
  lifetimeRevocationDecision,
  linkChargeToPurchase,
  planChargeRevocation,
  reducePurchaseRevocation,
  refundExtent,
  type ChargeView,
  type LifetimeSessionView,
  type SubscriptionView,
} from "./entitlementSync";

const NOW = 1_800_000_000_000;
const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_900_000_000;
const STANDARD = PRICING_PLANS.premium.amountCents;
const LIFETIME = PRICING_PLANS.lifetime.amountCents;

function subscription(overrides: Partial<SubscriptionView> = {}): SubscriptionView {
  return {
    id: "sub_live",
    status: "active",
    current_period_start: PERIOD_START,
    current_period_end: PERIOD_END,
    latest_invoice: {
      id: "in_paid",
      status: "paid",
      amount_paid: STANDARD,
      total: STANDARD,
      created: PERIOD_START,
    },
    items: { data: [{ price: { id: "price_premium" }, current_period_start: PERIOD_START, current_period_end: PERIOD_END }] },
    ...overrides,
  };
}

function decide(overrides: Partial<Parameters<typeof decideEntitlement>[0]> = {}) {
  const sub = overrides.subscriptions?.[0] ?? subscription();
  return decideEntitlement({
    subscriptions: [sub],
    listIncomplete: false,
    markers: [],
    corroborated: overrides.corroborated === undefined ? sub : overrides.corroborated,
    storedLifetime: false,
    lifetimeVerified: false,
    lifetimePurchasedAt: null,
    resolveTier: priceId => priceId === "price_premium" ? "premium" : null,
    nowMs: NOW,
    ...overrides,
  });
}

function charge(overrides: Partial<ChargeView> = {}): ChargeView {
  return {
    id: "ch_std",
    amount: STANDARD,
    amount_refunded: STANDARD,
    refunded: true,
    customer: "cus_a",
    invoiceId: "in_paid",
    paymentIntentId: "pi_std",
    metadata: null,
    ...overrides,
  };
}

function lifetimeCheckout(paymentIntentId: string): LifetimeSessionView {
  return {
    id: "cs_life",
    mode: "payment",
    payment_status: "paid",
    amount_total: LIFETIME,
    created: PERIOD_START,
    metadata: { plan_id: "lifetime" },
    payment_intent: { id: paymentIntentId, status: "succeeded", amount_received: LIFETIME, amount: LIFETIME },
  };
}

describe("public prices covered by refund handling", () => {
  it("keeps Standard at $99/month and Lifetime at $1,500", () => {
    expect(STANDARD).toBe(9900);
    expect(PRICING_PLANS.premium.priceLabel).toBe("$99/month");
    expect(PRICING_PLANS.premium.interval).toBe("month");
    expect(LIFETIME).toBe(150000);
    expect(PRICING_PLANS.lifetime.priceLabel).toBe("$1,500 one-time");
    expect(PRICING_PLANS.lifetime.interval).toBe("one_time");
  });
});

describe("refund extent and purchase link", () => {
  it("treats a full Standard or Lifetime refund as full and a partial as partial", () => {
    expect(refundExtent(charge())).toBe("full");
    expect(refundExtent(charge({ amount: LIFETIME, amount_refunded: LIFETIME, refunded: true }))).toBe("full");
    expect(refundExtent(charge({ amount_refunded: 100, refunded: false }))).toBe("partial");
    expect(refundExtent(charge({ amount: 0, amount_refunded: 0, refunded: true, invoiceId: "in_coupon" }))).toBe("none");
  });

  it("links a Lifetime PaymentIntent and a subscription invoice, and ignores amount alone", () => {
    expect(lifetimePaymentIntentId(lifetimeCheckout("pi_life"))).toBe("pi_life");
    expect(linkChargeToPurchase({
      charge: charge({ amount: LIFETIME, amount_refunded: LIFETIME, invoiceId: null, paymentIntentId: "pi_life" }),
      sessions: [lifetimeCheckout("pi_life")],
    })).toMatchObject({ kind: "lifetime", paymentIntentId: "pi_life" });
    expect(linkChargeToPurchase({
      charge: charge(),
      sessions: [],
      subscriptions: [subscription()],
    })).toMatchObject({ kind: "subscription", invoiceId: "in_paid", subscriptionId: "sub_live" });
    expect(linkChargeToPurchase({
      charge: charge({ amount: LIFETIME, invoiceId: null, paymentIntentId: "pi_other" }),
      sessions: [lifetimeCheckout("pi_life")],
    }).kind).toBe("unresolved");
    expect(linkChargeToPurchase({
      charge: charge({ amount: STANDARD, invoiceId: null, paymentIntentId: "pi_other" }),
      sessions: [lifetimeCheckout("pi_life")],
    }).kind).toBe("unresolved");
    expect(linkChargeToPurchase({
      charge: charge({ customer: null, amount: 500, invoiceId: null, paymentIntentId: "pi_other" }),
      sessions: [lifetimeCheckout("pi_life")],
    }).kind).toBe("unrelated");
    expect(linkChargeToPurchase({
      charge: charge({ amount: LIFETIME, amount_refunded: LIFETIME, invoiceId: null, paymentIntentId: "pi_life", customer: null }),
      sessions: [],
      storedLifetimePaymentIntentId: "pi_life",
    })).toMatchObject({ kind: "lifetime", paymentIntentId: "pi_life" });
  });

  it("links a dahlia charge through InvoicePayment and ignores Charge.invoice", () => {
    const dahlia = {
      id: "ch_std",
      object: "charge",
      amount: STANDARD,
      amount_refunded: STANDARD,
      refunded: true,
      customer: "cus_a",
      payment_intent: "pi_std",
    };
    expect(dahlia).not.toHaveProperty("invoice");
    const viewed = chargeViewFromRecord(dahlia);
    expect(viewed?.invoiceId).toBeNull();
    expect(chargeViewFromRecord({ ...dahlia, invoice: "in_legacy" })?.invoiceId).toBeNull();
    expect(linkChargeToPurchase({
      charge: viewed!,
      sessions: [],
      subscriptions: [subscription()],
    }).kind).toBe("unresolved");
    const payments = [
      {
        id: "inpay_canceled",
        object: "invoice_payment",
        invoice: "in_canceled",
        status: "canceled",
        payment: { type: "payment_intent", payment_intent: "pi_std" },
      },
      {
        id: "inpay_std",
        object: "invoice_payment",
        invoice: "in_paid",
        status: "paid",
        payment: { type: "payment_intent", payment_intent: { id: "pi_std" } },
      },
    ];
    const invoiceId = invoiceIdFromInvoicePayments("pi_std", payments);
    expect(invoiceId).toBe("in_paid");
    expect(linkChargeToPurchase({
      charge: { ...viewed!, invoiceId },
      sessions: [],
      subscriptions: [subscription()],
    })).toMatchObject({ kind: "subscription", invoiceId: "in_paid", subscriptionId: "sub_live" });
  });
});

describe("plan and timestamp order", () => {
  it("plans a full refund and a dispute, and does not plan a partial or unrelated charge", () => {
    expect(planChargeRevocation({
      eventId: "evt_full",
      eventType: "charge.refunded",
      created: 50,
      charge: charge(),
      sessions: [],
      subscriptions: [subscription()],
    })).toMatchObject({ reason: "charge.refunded:full", mutation: { active: true, reasonKind: "full_refund", sourceEventCreated: 50 } });
    expect(planChargeRevocation({
      eventId: "evt_partial",
      eventType: "charge.refunded",
      created: 50,
      charge: charge({ amount_refunded: 100, refunded: false }),
      sessions: [],
    })).toEqual({ reason: "charge.refunded:partial", mutation: null });
    expect(planChargeRevocation({
      eventId: "evt_other",
      eventType: "charge.refunded",
      created: 50,
      charge: charge({ invoiceId: null, paymentIntentId: "pi_other", amount: 500, amount_refunded: 500 }),
      sessions: [lifetimeCheckout("pi_life")],
    })).toEqual({ reason: "invoice_unlinked", mutation: null });
    expect(planChargeRevocation({
      eventId: "evt_other_guest",
      eventType: "charge.refunded",
      created: 50,
      charge: charge({ customer: null, invoiceId: null, paymentIntentId: "pi_other", amount: 500, amount_refunded: 500 }),
      sessions: [lifetimeCheckout("pi_life")],
    })).toEqual({ reason: "charge.refunded:unrelated", mutation: null });
    expect(planChargeRevocation({
      eventId: "evt_open",
      eventType: "charge.dispute.created",
      created: 60,
      charge: charge({ amount_refunded: 0, refunded: false }),
      sessions: [],
      dispute: { id: "dp_1", status: "needs_response", phase: "created" },
    }).mutation).toMatchObject({ active: true, reasonKind: "dispute:dp_1", disputeOutcome: "open" });
    expect(planChargeRevocation({
      eventId: "evt_won",
      eventType: "charge.dispute.closed",
      created: 80,
      charge: charge({ amount_refunded: 0, refunded: false }),
      sessions: [],
      dispute: { id: "dp_1", status: "won", phase: "closed" },
    }).mutation).toMatchObject({ active: false, disputeOutcome: "won", sourceEventCreated: 80 });
    expect(planChargeRevocation({
      eventId: "evt_lost",
      eventType: "charge.dispute.closed",
      created: 90,
      charge: charge({ amount_refunded: 0, refunded: false }),
      sessions: [],
      dispute: { id: "dp_1", status: "lost", phase: "closed" },
    }).mutation).toMatchObject({ active: true, disputeOutcome: "lost" });
  });

  it("ignores a replay, restores a same-second win, and lets a newer timestamp win", () => {
    const open = { active: true, sourceEventCreated: 100, sourceEventId: "evt_open" };
    expect(reducePurchaseRevocation(open, open)).toEqual({ apply: false, stale: false });
    expect(reducePurchaseRevocation(open, { active: false, sourceEventCreated: 90, sourceEventId: "evt_won_old" })).toEqual({ apply: false, stale: true });
    expect(reducePurchaseRevocation(open, { active: false, sourceEventCreated: 100, sourceEventId: "evt_won_tie" })).toEqual({ apply: true, stale: false });
    expect(reducePurchaseRevocation(
      { active: false, sourceEventCreated: 100, sourceEventId: "evt_won_tie" },
      { active: true, sourceEventCreated: 100, sourceEventId: "evt_open_tie" },
    )).toEqual({ apply: false, stale: true });
    expect(reducePurchaseRevocation(open, { active: false, sourceEventCreated: 200, sourceEventId: "evt_won" })).toEqual({ apply: true, stale: false });
    const won = { active: false, sourceEventCreated: 200, sourceEventId: "evt_won" };
    expect(reducePurchaseRevocation(won, { active: true, sourceEventCreated: 100, sourceEventId: "evt_open_late" })).toEqual({ apply: false, stale: true });
    expect(reducePurchaseRevocation(won, { active: true, sourceEventCreated: 250, sourceEventId: "evt_lost" })).toEqual({ apply: true, stale: false });
    const lost = { active: true, sourceEventCreated: 250, sourceEventId: "evt_lost" };
    expect(reducePurchaseRevocation(lost, { active: false, sourceEventCreated: 200, sourceEventId: "evt_won_late" })).toEqual({ apply: false, stale: true });
  });
});

describe("entitlement decision under revocation", () => {
  it("drops the refunded Standard invoice and keeps a newer one", () => {
    expect(decide({ revokedInvoiceIds: ["in_paid"], corroborated: null })).toMatchObject({
      action: "apply",
      accessTier: "free",
      stripeSubscriptionId: null,
      grantLifetime: false,
    });
    const renewed = subscription({
      current_period_start: PERIOD_START + 100,
      latest_invoice: { id: "in_new", status: "paid", amount_paid: STANDARD, total: STANDARD, created: PERIOD_START + 100 },
    });
    expect(decide({
      subscriptions: [renewed],
      corroborated: renewed,
      revokedInvoiceIds: ["in_old"],
    })).toMatchObject({ action: "apply", accessTier: "premium", stripeSubscriptionId: "sub_live" });
  });

  it("keeps a 100% coupon renewal when a different invoice is revoked", () => {
    const coupon = subscription({
      latest_invoice: {
        id: "in_coupon",
        status: "paid",
        amount_paid: 0,
        total: 0,
        created: PERIOD_START,
        discount: { coupon: { id: "coup_100" } },
      },
    });
    expect(decide({
      subscriptions: [coupon],
      corroborated: coupon,
      revokedInvoiceIds: ["in_other"],
    })).toMatchObject({ action: "apply", accessTier: "premium", stripeSubscriptionId: "sub_live" });
  });

  it("clears a revoked Lifetime PaymentIntent and keeps a newer one or an admin grant", () => {
    expect(lifetimeRevocationDecision({
      storedLifetime: true,
      storedPaymentIntentId: "pi_life",
      sessions: [lifetimeCheckout("pi_life")],
      revokedPaymentIntentIds: ["pi_life"],
    })).toMatchObject({ suppressStoredLifetime: true, lifetimeVerified: false });
    expect(lifetimeRevocationDecision({
      storedLifetime: true,
      storedPaymentIntentId: "pi_new",
      sessions: [lifetimeCheckout("pi_life")],
      revokedPaymentIntentIds: ["pi_life"],
    })).toMatchObject({ suppressStoredLifetime: false });
    const newer = lifetimeRevocationDecision({
      storedLifetime: true,
      storedPaymentIntentId: null,
      sessions: [lifetimeCheckout("pi_life"), lifetimeCheckout("pi_new")],
      revokedPaymentIntentIds: ["pi_life"],
    });
    expect(newer.suppressStoredLifetime).toBe(false);
    expect(newer.lifetimeVerified).toBe(true);
    expect(newer.lifetimePaymentIntentId).toBe("pi_new");
    expect(lifetimeRevocationDecision({
      storedLifetime: true,
      storedPaymentIntentId: null,
      sessions: [],
      revokedPaymentIntentIds: [],
    })).toMatchObject({ suppressStoredLifetime: false, lifetimeVerified: false });
    expect(lifetimeRevocationDecision({
      storedLifetime: true,
      storedPaymentIntentId: null,
      sessions: [],
      revokedPaymentIntentIds: ["pi_old"],
    })).toMatchObject({ suppressStoredLifetime: false, lifetimeVerified: false });
    expect(lifetimeRevocationDecision({
      storedLifetime: true,
      storedPaymentIntentId: null,
      sessions: [lifetimeCheckout("pi_old")],
      revokedPaymentIntentIds: ["pi_old"],
    })).toMatchObject({ suppressStoredLifetime: true, lifetimeVerified: false });
    expect(decide({
      storedLifetime: true,
      suppressStoredLifetime: true,
      subscriptions: [subscription({ status: "canceled" })],
      corroborated: null,
    })).toMatchObject({ action: "apply", accessTier: "free", grantLifetime: false });
    expect(decide({
      storedLifetime: true,
      lifetimeVerified: true,
      suppressStoredLifetime: false,
      revokedInvoiceIds: ["in_paid"],
      corroborated: null,
    })).toMatchObject({ action: "apply", accessTier: "founding", grantLifetime: true, stripeSubscriptionId: null });
  });
});
