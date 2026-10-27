import { describe, expect, it } from "vitest";
import {
  cancellationMarkerFromEvent,
  decideEntitlement,
  invoiceHasDiscount,
  subscriptionEvidenceSec,
  subscriptionInvoiceDecision,
  verifiedLifetimePayment,
  type SubscriptionView,
} from "./entitlementSync";

const NOW = 1_800_000_000_000;
const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_900_000_000;

function subscription(overrides: Partial<SubscriptionView> = {}): SubscriptionView {
  return {
    id: "sub_live",
    status: "active",
    current_period_start: PERIOD_START,
    current_period_end: PERIOD_END,
    latest_invoice: {
      id: "in_paid",
      status: "paid",
      amount_paid: 5900,
      total: 5900,
      created: PERIOD_START,
    },
    items: { data: [{ price: { id: "price_premium" } }] },
    ...overrides,
  };
}

function decide(overrides: Partial<Parameters<typeof decideEntitlement>[0]> = {}) {
  return decideEntitlement({
    subscriptions: [subscription()],
    listIncomplete: false,
    markers: [],
    corroborated: subscription(),
    storedLifetime: false,
    lifetimeVerified: false,
    lifetimePurchasedAt: null,
    resolveTier: priceId => priceId === "price_premium" ? "premium" : priceId === "price_core" ? "core" : null,
    nowMs: NOW,
    ...overrides,
  });
}

describe("high 2 — stale active read after cancellation", () => {
  it("does not apply a keep when the active snapshot is older than the cancellation marker", () => {
    const decision = decide({
      markers: [{ stripeSubscriptionId: "sub_live", canceledEventCreated: PERIOD_START + 10, status: "canceled" }],
    });
    expect(decision).toEqual({ action: "conflict", reason: "stale_active_after_cancellation" });
  });

  it("does not treat a missing evidence timestamp as proof the active snapshot is newer", () => {
    const decision = decide({
      subscriptions: [subscription({ current_period_start: null, start_date: null, latest_invoice: { id: "in_paid", status: "paid", amount_paid: 5900, total: 5900 } })],
      corroborated: subscription({ current_period_start: null, start_date: null, latest_invoice: { id: "in_paid", status: "paid", amount_paid: 5900, total: 5900 } }),
      markers: [{ stripeSubscriptionId: "sub_live", canceledEventCreated: PERIOD_START, status: "canceled" }],
    });
    expect(decision.action).toBe("conflict");
  });

  it("restores access only when the subscription evidence is newer than the cancellation", () => {
    const renewed = subscription({
      current_period_start: PERIOD_START + 50,
      latest_invoice: { id: "in_new", status: "paid", amount_paid: 5900, total: 5900, created: PERIOD_START + 50 },
    });
    const decision = decide({
      subscriptions: [renewed],
      corroborated: renewed,
      markers: [{ stripeSubscriptionId: "sub_live", canceledEventCreated: PERIOD_START + 10, status: "canceled" }],
    });
    expect(decision).toMatchObject({ action: "apply", accessTier: "premium", stripeSubscriptionId: "sub_live" });
  });

  it("refuses to seal a keep from the list alone", () => {
    expect(decide({ corroborated: null })).toEqual({ action: "needs_corroboration", subscriptionId: "sub_live" });
  });

  it("does not apply when the second read disagrees with the list", () => {
    const decision = decide({ corroborated: subscription({ status: "canceled", current_period_end: PERIOD_END }) });
    expect(decision).toEqual({ action: "conflict", reason: "read_disagreement" });
  });
});

describe("100% coupon renewal and paused status", () => {
  it("renews a paid zero-dollar invoice when a discount is present and sets expiry from the period end", () => {
    const coupon = subscription({
      latest_invoice: {
        id: "in_coupon",
        status: "paid",
        amount_paid: 0,
        total: 0,
        created: PERIOD_START,
        discount: { coupon: { id: "coup_100" } },
        total_discount_amounts: [{ amount: 5900 }],
      },
    });
    const decision = decide({ subscriptions: [coupon], corroborated: coupon });
    expect(decision).toMatchObject({
      action: "apply",
      accessTier: "premium",
      accessExpiresAt: new Date(PERIOD_END * 1000),
    });
    expect(invoiceHasDiscount(coupon.latest_invoice as Exclude<typeof coupon.latest_invoice, string | null | undefined>)).toBe(true);
  });

  it("does not treat a zero-dollar invoice without a discount as a renewal", () => {
    const zero = subscription({
      latest_invoice: { id: "in_zero", status: "paid", amount_paid: 0, total: 0, created: PERIOD_START },
    });
    expect(subscriptionInvoiceDecision(zero)).toEqual({ entitled: false });
    expect(decide({ subscriptions: [zero], corroborated: null })).toMatchObject({
      action: "apply",
      accessTier: "free",
      stripeSubscriptionId: null,
    });
  });

  it("does not entitle a paused subscription, including pause_collection on an active status", () => {
    expect(subscriptionInvoiceDecision(subscription({ status: "paused" }))).toEqual({ entitled: false });
    expect(subscriptionInvoiceDecision(subscription({ pause_collection: { behavior: "void" } }))).toEqual({ entitled: false });
    const paused = subscription({ status: "paused" });
    expect(decide({ subscriptions: [paused], corroborated: null })).toMatchObject({ action: "apply", accessTier: "free" });
  });

  it("keeps a paused marker from being erased by an older active snapshot", () => {
    const decision = decide({
      markers: [{ stripeSubscriptionId: "sub_live", canceledEventCreated: PERIOD_START + 5, status: "paused" }],
    });
    expect(decision).toEqual({ action: "conflict", reason: "stale_active_after_cancellation" });
  });
});

describe("lifetime and subscription coexistence", () => {
  const paidIntent = { status: "succeeded", amount_received: 150000, amount: 150000 };

  it("grants lifetime only for a paid lifetime checkout with a succeeded PaymentIntent", () => {
    expect(verifiedLifetimePayment({
      mode: "payment",
      payment_status: "paid",
      amount_total: 150000,
      metadata: { plan_id: "lifetime" },
      payment_intent: paidIntent,
    })).toBe(true);
    expect(verifiedLifetimePayment({
      mode: "payment",
      payment_status: "paid",
      amount_total: 150000,
      metadata: { plan_id: "lifetime" },
      payment_intent: "pi_unexpanded",
    })).toBe(false);
    expect(verifiedLifetimePayment({
      mode: "payment",
      payment_status: "no_payment_required",
      amount_total: 0,
      metadata: { plan_id: "lifetime" },
      payment_intent: null,
    })).toBe(false);
  });

  it("keeps lifetime founding and clears the subscription id when no subscription entitles", () => {
    const decision = decide({
      subscriptions: [subscription({ status: "canceled" })],
      corroborated: null,
      storedLifetime: true,
      lifetimePurchasedAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(decision).toMatchObject({
      action: "apply",
      accessTier: "founding",
      grantLifetime: true,
      stripeSubscriptionId: null,
      usesSubscription: false,
    });
  });

  it("keeps the active subscription id beside lifetime access", () => {
    const decision = decide({ storedLifetime: true });
    expect(decision).toMatchObject({
      action: "apply",
      accessTier: "founding",
      grantLifetime: true,
      stripeSubscriptionId: "sub_live",
      usesSubscription: true,
    });
  });
});

describe("cancellation marker and incomplete lists", () => {
  it("records deleted, canceled, unpaid, past_due, and paused events with event.created", () => {
    expect(cancellationMarkerFromEvent({
      id: "evt_del",
      type: "customer.subscription.deleted",
      created: 50,
      data: { object: { id: "sub_a" } },
    })).toMatchObject({ stripeSubscriptionId: "sub_a", canceledEventCreated: 50, status: "canceled" });
    expect(cancellationMarkerFromEvent({
      id: "evt_up",
      type: "customer.subscription.updated",
      created: 60,
      data: { object: { id: "sub_a", status: "past_due" } },
    })?.status).toBe("past_due");
    expect(cancellationMarkerFromEvent({
      id: "evt_pause",
      type: "customer.subscription.updated",
      created: 70,
      data: { object: { id: "sub_a", status: "active", pause_collection: { behavior: "mark_uncollectible" } } },
    })?.status).toBe("paused");
    expect(cancellationMarkerFromEvent({
      id: "evt_active",
      type: "customer.subscription.updated",
      created: 80,
      data: { object: { id: "sub_a", status: "active" } },
    })).toBeNull();
  });

  it("does not apply from an incomplete subscription list", () => {
    expect(decide({ listIncomplete: true, corroborated: null })).toEqual({
      action: "conflict",
      reason: "subscription_list_incomplete",
    });
  });

  it("uses the newest invoice or period timestamp as evidence", () => {
    expect(subscriptionEvidenceSec(subscription({
      current_period_start: 10,
      latest_invoice: { created: 40, status_transitions: { paid_at: 30 } },
    }))).toBe(40);
  });
});
