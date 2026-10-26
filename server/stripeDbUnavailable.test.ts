import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STRIPE_CLIENT_MAX_NETWORK_RETRIES, STRIPE_CLIENT_TIMEOUT_MS } from "./stripe/client";
import { webhookStripeBudgetMs } from "./stripe/webhook";
import {
  closeDbForTests,
  completeStripeWebhookEvent,
  decideDuplicateStripeClaim,
  recordStripeWebhookEvent,
  tierForEntitlement,
  releaseStripeWebhookEvent,
  STRIPE_WEBHOOK_UNFINISHED_CLAIM_MS,
} from "./db";

beforeEach(() => { vi.stubEnv("DATABASE_URL", ""); closeDbForTests(); });
afterEach(() => { closeDbForTests(); vi.unstubAllEnvs(); });

describe("Stripe webhook idempotency without a database", () => {
  it.each(["invoice.paid", "customer.subscription.deleted", "customer.subscription.updated"])("refuses to acknowledge a claim for %s", async type => {
    await expect(recordStripeWebhookEvent("evt_unavailable_fixture", type)).rejects.toThrow("Database unavailable: cannot claim Stripe webhook event");
  });

  it("throws when a failed claim cannot be released", async () => {
    await expect(releaseStripeWebhookEvent("evt_release_unavailable", "a1b2c3d4e5f67890", "invoice.paid")).rejects.toThrow("Database unavailable: cannot release Stripe webhook event");
  });

  it("throws when a handled claim cannot be marked complete", async () => {
    await expect(completeStripeWebhookEvent("evt_complete_unavailable", "invoice.paid", "a1b2c3d4e5f67890")).rejects.toThrow("Database unavailable: cannot complete Stripe webhook event");
  });
});

describe("tierForEntitlement", () => {
  it("treats lifetime access as founding even when the stored tier is free", () => {
    expect(tierForEntitlement("free", true)).toBe("founding");
    expect(tierForEntitlement("core", true)).toBe("founding");
    expect(tierForEntitlement("premium", false)).toBe("premium");
    expect(tierForEntitlement("free", false)).toBe("free");
    expect(tierForEntitlement(null, false)).toBe("free");
  });
});

describe("decideDuplicateStripeClaim", () => {
  const now = 1_700_000_000_000;

  it("reclaims a pending or processing claim old enough that the failed release would otherwise drop it", () => {
    const processedAt = new Date(now - STRIPE_WEBHOOK_UNFINISHED_CLAIM_MS);
    expect(decideDuplicateStripeClaim({ eventType: "pending:invoice.paid", processedAt }, now)).toBe("reclaim");
    expect(decideDuplicateStripeClaim({ eventType: "processing:invoice.paid", processedAt }, now)).toBe("reclaim");
  });

  it("does not treat a fresh pending or processing claim as a finished duplicate", () => {
    const processedAt = new Date(now - (STRIPE_WEBHOOK_UNFINISHED_CLAIM_MS - 1));
    expect(decideDuplicateStripeClaim({ eventType: "pending:checkout.session.completed", processedAt }, now)).toBe("retry");
    expect(decideDuplicateStripeClaim({ eventType: "processing:checkout.session.completed", processedAt }, now)).toBe("retry");
    expect(STRIPE_WEBHOOK_UNFINISHED_CLAIM_MS).toBeGreaterThan(STRIPE_CLIENT_TIMEOUT_MS);
    expect(STRIPE_CLIENT_MAX_NETWORK_RETRIES).toBe(0);
    expect(webhookStripeBudgetMs()).toBeLessThan(STRIPE_WEBHOOK_UNFINISHED_CLAIM_MS);
  });

  it("keeps a completed claim as a duplicate and retries when the row cannot be read", () => {
    expect(decideDuplicateStripeClaim({ eventType: "invoice.paid", processedAt: new Date(now - 60_000) }, now)).toBe("duplicate");
    expect(decideDuplicateStripeClaim(null, now)).toBe("retry");
    expect(decideDuplicateStripeClaim({ eventType: "pending:invoice.paid", processedAt: new Date(Number.NaN) }, now)).toBe("retry");
  });
});
