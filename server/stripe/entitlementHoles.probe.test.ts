/**
 * Passing equivalents of the review probes for the holes found at ecd9105.
 * Handler and MariaDB coverage for the unbound-customer seal lives in
 * webhook.test.ts and stripeWebhookClaim.db.test.ts.
 */
import { describe, expect, it } from "vitest";
import { FAULTLINE_ORIGIN } from "../../shared/authOrigin";
import { buildCheckoutSessionParams } from "../routers/billing";
import {
  decideEntitlement,
  subscriptionEvidenceSec,
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
      period_start: PERIOD_START,
    },
    items: { data: [{ price: { id: "price_premium" } }] },
    ...overrides,
  };
}

function decide(overrides: Partial<Parameters<typeof decideEntitlement>[0]> = {}) {
  const listed = overrides.subscriptions?.[0] ?? subscription();
  return decideEntitlement({
    subscriptions: [listed],
    listIncomplete: false,
    markers: [],
    corroborated: listed,
    storedLifetime: false,
    lifetimeVerified: false,
    lifetimePurchasedAt: null,
    resolveTier: priceId => priceId === "price_premium" ? "premium" : priceId === "price_core" ? "core" : priceId === "price_founding" ? "founding" : null,
    nowMs: NOW,
    ...overrides,
  });
}

describe("entitlement holes", () => {
  it("H2 does not let invoice.created on the same period supersede a cancellation", () => {
    const samePeriod = subscription({
      latest_invoice: {
        id: "in_same",
        status: "paid",
        amount_paid: 5900,
        total: 5900,
        created: PERIOD_START + 500,
        period_start: PERIOD_START,
        status_transitions: { paid_at: PERIOD_START + 400 },
      },
    });
    expect(subscriptionEvidenceSec(samePeriod)).toBe(PERIOD_START);
    expect(decide({
      subscriptions: [samePeriod],
      corroborated: samePeriod,
      markers: [{ stripeSubscriptionId: "sub_live", canceledEventCreated: PERIOD_START + 50, status: "canceled" }],
    })).toEqual({ action: "conflict", reason: "stale_active_after_cancellation" });
  });

  it("H2 accepts a newer period start, including paid_at only as proof of that newer period", () => {
    const renewed = subscription({
      current_period_start: PERIOD_START + 80,
      latest_invoice: {
        id: "in_new",
        status: "paid",
        amount_paid: 5900,
        total: 5900,
        created: PERIOD_START + 10,
        period_start: PERIOD_START + 80,
        status_transitions: { paid_at: PERIOD_START + 90 },
      },
    });
    expect(subscriptionEvidenceSec(renewed)).toBe(PERIOD_START + 80);
    expect(decide({
      subscriptions: [renewed],
      corroborated: renewed,
      markers: [{ stripeSubscriptionId: "sub_live", canceledEventCreated: PERIOD_START + 50, status: "canceled" }],
    })).toMatchObject({ action: "apply", accessTier: "premium" });
    const createdOnly = subscription({
      current_period_start: PERIOD_START,
      start_date: PERIOD_START + 999,
      latest_invoice: { id: "in_created", status: "paid", amount_paid: 5900, total: 5900, created: PERIOD_START + 999 },
    });
    expect(subscriptionEvidenceSec(createdOnly)).toBe(PERIOD_START);
  });

  it("H3 does not seal when the corroborating read has a different price", () => {
    const listed = subscription({ items: { data: [{ price: { id: "price_premium" } }] } });
    const retrieved = subscription({ items: { data: [{ price: { id: "price_core" } }] } });
    expect(decide({ subscriptions: [listed], corroborated: retrieved })).toEqual({
      action: "conflict",
      reason: "read_disagreement",
    });
  });

  it("H4 uses the highest entitled price on the subscription", () => {
    const ranked = subscription({
      items: { data: [{ price: { id: "price_core" } }, { price: { id: "price_premium" } }] },
    });
    expect(decide({ subscriptions: [ranked], corroborated: ranked })).toMatchObject({
      action: "apply",
      accessTier: "premium",
    });
    const founding = subscription({
      items: { data: [{ price: { id: "price_premium" } }, { price: { id: "price_founding" } }] },
    });
    expect(decide({ subscriptions: [founding], corroborated: founding })).toMatchObject({
      action: "apply",
      accessTier: "founding",
    });
  });

  it("H5 requires PaymentIntent.amount_received and does not fall back to amount", () => {
    const base = {
      mode: "payment" as const,
      payment_status: "paid" as const,
      amount_total: 150000,
      metadata: { plan_id: "lifetime" as const },
    };
    expect(verifiedLifetimePayment({
      ...base,
      payment_intent: { status: "succeeded", amount: 150000 },
    })).toBe(false);
    expect(verifiedLifetimePayment({
      ...base,
      payment_intent: { status: "succeeded", amount_received: 0, amount: 150000 },
    })).toBe(false);
    expect(verifiedLifetimePayment({
      ...base,
      payment_intent: { status: "succeeded", amount_received: 150000, amount: 150000 },
    })).toBe(true);
  });

  it("reuses a stored Stripe customer and copies user_id onto the subscription", () => {
    const rebound = buildCheckoutSessionParams({
      userId: 7,
      email: "ada@example.com",
      name: "Ada",
      planId: "premium",
      priceId: "price_premium",
      interval: "month",
      origin: FAULTLINE_ORIGIN,
      storedStripeCustomerId: "cus_paid",
    });
    expect(rebound.customer).toBe("cus_paid");
    expect(rebound).not.toHaveProperty("customer_email");
    expect(rebound.subscription_data?.metadata).toEqual({ user_id: "7", plan_id: "premium" });
    expect(rebound.metadata.user_id).toBe("7");
    expect(rebound.success_url).toBe(`${FAULTLINE_ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}&plan=premium`);
    expect(rebound.cancel_url).toBe(`${FAULTLINE_ORIGIN}/app/account?payment=cancelled`);

    const first = buildCheckoutSessionParams({
      userId: 7,
      email: "ada@example.com",
      name: "Ada",
      planId: "lifetime",
      priceId: "price_lifetime",
      interval: "one_time",
      origin: FAULTLINE_ORIGIN,
      storedStripeCustomerId: null,
    });
    expect(first.customer_email).toBe("ada@example.com");
    expect(first).not.toHaveProperty("customer");
    expect(first).not.toHaveProperty("subscription_data");
    expect(first.success_url).toBe(`${FAULTLINE_ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}&plan=lifetime`);
    expect(first.cancel_url).toBe(`${FAULTLINE_ORIGIN}/app/account?payment=cancelled`);
  });
});
