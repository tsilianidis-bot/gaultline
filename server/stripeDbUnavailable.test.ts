import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDbForTests, recordStripeWebhookEvent } from "./db";

beforeEach(() => { vi.stubEnv("DATABASE_URL", ""); closeDbForTests(); });
afterEach(() => { closeDbForTests(); vi.unstubAllEnvs(); });

describe("Stripe webhook idempotency without a database", () => {
  it.each(["invoice.paid", "customer.subscription.deleted", "customer.subscription.updated"])("refuses to acknowledge a claim for %s", async type => {
    await expect(recordStripeWebhookEvent("evt_unavailable_fixture", type)).rejects.toThrow("Database unavailable: cannot claim Stripe webhook event");
  });
});
