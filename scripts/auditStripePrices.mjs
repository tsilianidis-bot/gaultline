import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error(JSON.stringify({ error: "STRIPE_SECRET_KEY is unavailable" }));
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
const plans = [
  ["founding", process.env.STRIPE_FOUNDING_PRICE_ID],
  ["premium", process.env.STRIPE_PREMIUM_PRICE_ID],
  ["core", process.env.STRIPE_CORE_PRICE_ID],
  ["lifetime", process.env.STRIPE_LIFETIME_PRICE_ID],
];

const result = [];
for (const [plan, priceId] of plans) {
  if (!priceId) {
    result.push({ plan, configured: false, verified: false, reason: "missing price ID" });
    continue;
  }

  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    const product = typeof price.product === "object" ? price.product : null;
    result.push({
      plan,
      configured: true,
      verified: true,
      active: price.active,
      currency: price.currency,
      amountCents: price.unit_amount,
      interval: price.recurring?.interval ?? "one_time",
      productName: product?.name ?? null,
    });
  } catch (error) {
    result.push({
      plan,
      configured: true,
      verified: false,
      reason: error instanceof Error ? error.message : "unknown Stripe error",
    });
  }
}

console.log(JSON.stringify(result, null, 2));
