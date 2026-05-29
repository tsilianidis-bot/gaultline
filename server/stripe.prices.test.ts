import { describe, it, expect } from "vitest";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_CORE_PRICE_ID = process.env.STRIPE_CORE_PRICE_ID ?? "";
const STRIPE_PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID ?? "";
const STRIPE_FOUNDING_PRICE_ID = process.env.STRIPE_FOUNDING_PRICE_ID ?? "";

describe("Stripe Price ID validation", () => {
  it("STRIPE_CORE_PRICE_ID is set and non-empty", () => {
    expect(STRIPE_CORE_PRICE_ID).toBeTruthy();
    expect(STRIPE_CORE_PRICE_ID).toMatch(/^price_/);
  });

  it("STRIPE_PREMIUM_PRICE_ID is set and non-empty", () => {
    expect(STRIPE_PREMIUM_PRICE_ID).toBeTruthy();
    expect(STRIPE_PREMIUM_PRICE_ID).toMatch(/^price_/);
  });

  it("STRIPE_FOUNDING_PRICE_ID is set and non-empty", () => {
    expect(STRIPE_FOUNDING_PRICE_ID).toBeTruthy();
    expect(STRIPE_FOUNDING_PRICE_ID).toMatch(/^price_/);
  });

  it("all 3 price IDs are distinct", () => {
    const ids = [STRIPE_CORE_PRICE_ID, STRIPE_PREMIUM_PRICE_ID, STRIPE_FOUNDING_PRICE_ID];
    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });

  it("can retrieve FAULTLINE Mobile price from Stripe API", async () => {
    if (!STRIPE_SECRET_KEY) return;
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const price = await stripe.prices.retrieve(STRIPE_CORE_PRICE_ID);
    expect(price.id).toBe(STRIPE_CORE_PRICE_ID);
    expect(price.unit_amount).toBe(999);
    expect(price.currency).toBe("usd");
    expect(price.recurring?.interval).toBe("month");
  }, 10000);

  it("can retrieve FAULTLINE Premium price from Stripe API", async () => {
    if (!STRIPE_SECRET_KEY) return;
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const price = await stripe.prices.retrieve(STRIPE_PREMIUM_PRICE_ID);
    expect(price.id).toBe(STRIPE_PREMIUM_PRICE_ID);
    expect(price.unit_amount).toBe(5900);
    expect(price.currency).toBe("usd");
    expect(price.recurring?.interval).toBe("month");
  }, 10000);

  it("can retrieve FAULTLINE Founders Lifetime price from Stripe API", async () => {
    if (!STRIPE_SECRET_KEY) return;
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const price = await stripe.prices.retrieve(STRIPE_FOUNDING_PRICE_ID);
    expect(price.id).toBe(STRIPE_FOUNDING_PRICE_ID);
    expect(price.unit_amount).toBe(120000);
    expect(price.currency).toBe("usd");
    expect(price.type).toBe("one_time");
  }, 10000);
});
