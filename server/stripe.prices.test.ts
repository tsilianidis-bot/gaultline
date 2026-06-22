import { describe, it, expect } from "vitest";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_CORE_PRICE_ID = process.env.STRIPE_CORE_PRICE_ID ?? "";
const STRIPE_PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID ?? "";
const STRIPE_FOUNDING_PRICE_ID = process.env.STRIPE_FOUNDING_PRICE_ID ?? "";
const STRIPE_LIFETIME_PRICE_ID = process.env.STRIPE_LIFETIME_PRICE_ID ?? "";

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

  it("STRIPE_LIFETIME_PRICE_ID is set and non-empty", () => {
    expect(STRIPE_LIFETIME_PRICE_ID).toBeTruthy();
    expect(STRIPE_LIFETIME_PRICE_ID).toMatch(/^price_/);
  });

  it("all 4 price IDs are distinct", () => {
    const ids = [STRIPE_CORE_PRICE_ID, STRIPE_PREMIUM_PRICE_ID, STRIPE_FOUNDING_PRICE_ID, STRIPE_LIFETIME_PRICE_ID];
    const unique = new Set(ids);
    expect(unique.size).toBe(4);
  });

  it("can retrieve FAULTLINE Core (Mobile) price from Stripe API — $9.99/mo", async () => {
    if (!STRIPE_SECRET_KEY) return;
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const price = await stripe.prices.retrieve(STRIPE_CORE_PRICE_ID);
    expect(price.id).toBe(STRIPE_CORE_PRICE_ID);
    expect(price.unit_amount).toBe(999);
    expect(price.currency).toBe("usd");
    expect(price.recurring?.interval).toBe("month");
    expect(price.active).toBe(true);
  }, 10000);

  it("can retrieve FAULTLINE Trader (Premium) price from Stripe API — $59/mo", async () => {
    if (!STRIPE_SECRET_KEY) return;
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const price = await stripe.prices.retrieve(STRIPE_PREMIUM_PRICE_ID);
    expect(price.id).toBe(STRIPE_PREMIUM_PRICE_ID);
    expect(price.unit_amount).toBe(5900);
    expect(price.currency).toBe("usd");
    expect(price.recurring?.interval).toBe("month");
    expect(price.active).toBe(true);
  }, 10000);

  it("can retrieve FAULTLINE Founding Member price from Stripe API — $49/mo recurring", async () => {
    if (!STRIPE_SECRET_KEY) return;
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const price = await stripe.prices.retrieve(STRIPE_FOUNDING_PRICE_ID);
    expect(price.id).toBe(STRIPE_FOUNDING_PRICE_ID);
    expect(price.unit_amount).toBe(4900);
    expect(price.currency).toBe("usd");
    expect(price.type).toBe("recurring");
    expect(price.recurring?.interval).toBe("month");
    expect(price.active).toBe(true);
  }, 10000);

  it("can retrieve FAULTLINE Founding Lifetime price from Stripe API — $299 one-time", async () => {
    if (!STRIPE_SECRET_KEY) return;
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const price = await stripe.prices.retrieve(STRIPE_LIFETIME_PRICE_ID);
    expect(price.id).toBe(STRIPE_LIFETIME_PRICE_ID);
    expect(price.unit_amount).toBe(29900);
    expect(price.currency).toBe("usd");
    expect(price.type).toBe("one_time");
    expect(price.active).toBe(true);
  }, 10000);

  it("old $1,200 price is archived (inactive)", async () => {
    if (!STRIPE_SECRET_KEY) return;
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const oldPrice = await stripe.prices.retrieve("price_1TcVgB7f3zM5dNdGb4acS3Mr");
    expect(oldPrice.active).toBe(false);
  }, 10000);
});
