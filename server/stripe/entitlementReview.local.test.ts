/**
 * Equivalents of the untracked N1–N7 probes from the review of 1366c75.
 * Handler and MariaDB cases live in webhook.test.ts and stripeWebhookClaim.db.test.ts.
 */
import { describe, expect, it } from "vitest";
import { effectiveTier } from "../db";
import {
  decideEntitlement,
  linkedUserIds,
  resumeEvidenceFromEvent,
  subscriptionInvoiceDecision,
  verifiedLifetimePayment,
  type SubscriptionView,
} from "./entitlementSync";

const NOW = 1_800_000_000_000;
const PERIOD_START = 1_700_000_000;
const PERIOD_END = 1_900_000_000;

function itemSub(overrides: Partial<SubscriptionView> = {}): SubscriptionView {
  return {
    id: "sub_live",
    status: "active",
    latest_invoice: {
      id: "in_paid",
      status: "paid",
      amount_paid: 5900,
      total: 5900,
      created: PERIOD_START,
    },
    items: {
      data: [{
        price: { id: "price_premium" },
        current_period_start: PERIOD_START,
        current_period_end: PERIOD_END,
      }],
    },
    ...overrides,
  };
}

function decide(overrides: Partial<Parameters<typeof decideEntitlement>[0]> = {}) {
  const subscription = overrides.subscriptions?.[0] ?? itemSub();
  return decideEntitlement({
    subscriptions: [subscription],
    listIncomplete: false,
    markers: [],
    corroborated: subscription,
    storedLifetime: false,
    lifetimeVerified: false,
    lifetimePurchasedAt: null,
    resolveTier: priceId => priceId === "price_premium" ? "premium" : priceId === "price_core" ? "core" : null,
    nowMs: NOW,
    ...overrides,
  });
}

describe("entitlement review probes", () => {
  it("N1 reads current_period_end from subscription items and does not return missing_expiry", () => {
    const decision = decide();
    expect(decision).toMatchObject({
      action: "apply",
      accessTier: "premium",
      accessExpiresAt: new Date(PERIOD_END * 1000),
    });
    expect(decision).not.toMatchObject({ action: "conflict", reason: "missing_expiry" });
  });

  it("N1 conflicts when items disagree instead of inventing an expiry", () => {
    const mixed = itemSub({
      items: {
        data: [
          { price: { id: "price_premium" }, current_period_end: PERIOD_END },
          { price: { id: "price_premium" }, current_period_end: PERIOD_END + 10 },
        ],
      },
    });
    expect(decide({ subscriptions: [mixed], corroborated: mixed })).toEqual({
      action: "conflict",
      reason: "inconsistent_period",
    });
  });

  it("N2 collects metadata and client_reference_id after the customer id misses", () => {
    expect(linkedUserIds({
      metadata: { user_id: "15" },
      client_reference_id: "15",
    })).toEqual([15]);
    expect(linkedUserIds({
      parent: { subscription_details: { metadata: { user_id: "22" } } },
    })).toEqual([22]);
    expect(linkedUserIds({
      subscription: { metadata: { user_id: "9" } },
      client_reference_id: "4",
    })).toEqual([9, 4]);
    expect(linkedUserIds({ customer: "cus_only" })).toEqual([]);
  });

  it("N3 a cancellation recorded before the grant blocks the active snapshot", () => {
    const live = itemSub();
    expect(decide({
      subscriptions: [live],
      corroborated: live,
      markers: [{ stripeSubscriptionId: "sub_live", canceledEventCreated: PERIOD_START + 5, status: "canceled" }],
    })).toEqual({ action: "conflict", reason: "stale_active_after_cancellation" });
  });

  it("N3 a superseded marker does not let the old cancellation erase a later renewal", () => {
    const renewed = itemSub({
      items: { data: [{ price: { id: "price_premium" }, current_period_start: PERIOD_START + 80, current_period_end: PERIOD_END }] },
      latest_invoice: { id: "in_new", status: "paid", amount_paid: 5900, total: 5900, created: PERIOD_START + 80 },
    });
    expect(decide({
      subscriptions: [renewed],
      corroborated: renewed,
      markers: [{
        stripeSubscriptionId: "sub_live",
        canceledEventCreated: PERIOD_START + 5,
        status: "canceled",
        supersededEventCreated: PERIOD_START + 40,
      }],
    })).toMatchObject({ action: "apply", accessTier: "premium" });
  });

  it("N4 same-period unpause restores only with resume evidence plus a clear pause_collection", () => {
    const resumed = itemSub();
    const marker = { stripeSubscriptionId: "sub_live", canceledEventCreated: PERIOD_START + 20, status: "paused" };
    expect(resumeEvidenceFromEvent({
      type: "invoice.paid",
      created: PERIOD_START + 50,
      data: { object: { id: "sub_live", status: "active" } },
    })).toBeNull();
    expect(decide({
      subscriptions: [resumed],
      corroborated: resumed,
      markers: [marker],
      resume: { subscriptionId: "sub_live", eventCreated: PERIOD_START + 50 },
    })).toMatchObject({
      action: "apply",
      supersedeCancellation: { stripeSubscriptionId: "sub_live", eventCreated: PERIOD_START + 50 },
    });
    const stillPaused = itemSub({ pause_collection: { behavior: "void" } });
    expect(decide({
      subscriptions: [stillPaused],
      corroborated: null,
      markers: [marker],
      resume: { subscriptionId: "sub_live", eventCreated: PERIOD_START + 50 },
    })).toMatchObject({ action: "apply", accessTier: "free", stripeSubscriptionId: null });
  });

  it("N5 customer credit and a 100% coupon renew, while a zero total does not become lifetime", () => {
    const credit = itemSub({
      latest_invoice: { id: "in_credit", status: "paid", amount_paid: 0, total: 5900, created: PERIOD_START },
    });
    expect(subscriptionInvoiceDecision(credit)).toEqual({ entitled: true, kind: "credit" });
    expect(decide({ subscriptions: [credit], corroborated: credit }).action).toBe("apply");
    const coupon = itemSub({
      latest_invoice: {
        id: "in_coupon", status: "paid", amount_paid: 0, total: 0, created: PERIOD_START,
        discount: { coupon: { id: "coup_100" } },
      },
    });
    expect(subscriptionInvoiceDecision(coupon)).toEqual({ entitled: true, kind: "coupon" });
    expect(decide({ subscriptions: [coupon], corroborated: coupon })).toMatchObject({
      accessTier: "premium",
      accessExpiresAt: new Date(PERIOD_END * 1000),
    });
    const zero = itemSub({
      latest_invoice: { id: "in_zero", status: "paid", amount_paid: 0, total: 0, created: PERIOD_START },
    });
    expect(decide({ subscriptions: [zero], corroborated: null })).toMatchObject({
      action: "apply",
      accessTier: "free",
    });
    expect(verifiedLifetimePayment({
      mode: "payment",
      payment_status: "paid",
      amount_total: 0,
      metadata: { plan_id: "lifetime" },
      payment_intent: { status: "succeeded", amount_received: 0, amount: 0 },
    })).toBe(false);
  });

  it("N6 an unknown price on an entitled subscription is unresolved, and a canceled unknown price still downgrades", () => {
    const unknown = itemSub({ items: { data: [{ price: { id: "price_unknown" }, current_period_end: PERIOD_END }] } });
    expect(decide({ subscriptions: [unknown], corroborated: unknown })).toEqual({
      action: "unresolved",
      priceId: "price_unknown",
      subscriptionId: "sub_live",
    });
    const canceled = itemSub({
      status: "canceled",
      items: { data: [{ price: { id: "price_unknown" }, current_period_end: PERIOD_END }] },
    });
    expect(decide({ subscriptions: [canceled], corroborated: null })).toMatchObject({
      action: "apply",
      accessTier: "free",
      stripeSubscriptionId: null,
    });
  });

  it("N7 lifetime is founding everywhere and is not cleared by a subscription cancellation", () => {
    expect(effectiveTier({ accessTier: "free", lifetimeAccess: true, accessExpiresAt: new Date(0) })).toBe("founding");
    expect(effectiveTier({ accessTier: "premium", lifetimeAccess: false, accessExpiresAt: null })).toBe("premium");
    const canceled = itemSub({ status: "canceled" });
    expect(decide({
      subscriptions: [canceled],
      corroborated: null,
      storedLifetime: true,
      lifetimePurchasedAt: new Date("2026-01-01T00:00:00Z"),
    })).toMatchObject({
      action: "apply",
      accessTier: "founding",
      grantLifetime: true,
      stripeSubscriptionId: null,
    });
  });
});
