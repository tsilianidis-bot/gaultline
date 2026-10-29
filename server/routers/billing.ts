/**
 * Billing domain router
 * Handles Stripe checkout session creation, billing portal, and plan listing.
 * Extracted from server/routers.ts for maintainability.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { stripe } from "../stripe/client";
import { PLANS, verifyStripePlanConfiguration } from "../stripe/products";
import { getLifetimeMemberCount } from "../db";
import { PRICING_PLANS, PAID_PLANS_ON_SALE, CHECKOUT_ENABLED, type StripePlanId } from "../../shared/tiers";
import { checkoutReceiptForCaller } from "../security/access";

/** Legacy founding-lifetime counter (retained for existing entitlements; not a public offer). */
const LIFETIME_FOUNDING_LIMIT = 100;

/**
 * This list is intentionally server-side and exact. Do not derive checkout
 * return origins from Host or Origin headers: either can be supplied by a
 * caller. The www entry returns the canonical apex URL after it is approved.
 */
const PRODUCTION_BILLING_RETURN_ORIGINS = new Map<string, string>([
  ["https://getfaultline.live", "https://getfaultline.live"],
  ["https://www.getfaultline.live", "https://getfaultline.live"],
]);
const DEFAULT_NON_PRODUCTION_BILLING_RETURN_ORIGINS = ["http://localhost:5173"];

export type BillingOriginEnvironment = Readonly<{
  NODE_ENV?: string;
  BILLING_RETURN_ORIGIN_ALLOWLIST?: string;
}>;

function originAuthority(value: string): string | null {
  const schemeEnd = value.indexOf("://");
  if (schemeEnd < 0) return null;
  const afterScheme = value.slice(schemeEnd + 3);
  const pathStart = afterScheme.search(/[/?#]/);
  return pathStart < 0 ? afterScheme : afterScheme.slice(0, pathStart);
}

function hasOnlyOptionalRootPath(value: string): boolean {
  const schemeEnd = value.indexOf("://");
  if (schemeEnd < 0) return false;
  const afterScheme = value.slice(schemeEnd + 3);
  const pathStart = afterScheme.search(/[/?#]/);
  return pathStart < 0 || afterScheme.slice(pathStart) === "/";
}

function hasExplicitPort(value: string): boolean {
  const authority = originAuthority(value);
  if (!authority) return false;
  const host = authority.slice(authority.lastIndexOf("@") + 1);
  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    return closingBracket >= 0 && host.slice(closingBracket + 1).startsWith(":");
  }
  return host.includes(":");
}

/** Parse an origin without letting URL normalization hide a path, query, hash, or production port. */
function parseStrictBillingOrigin(value: string): string | null {
  if (value.trim() !== value || !hasOnlyOptionalRootPath(value) || /[?#]/.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") ||
        url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    const isProductionHost = url.hostname === "getfaultline.live" || url.hostname === "www.getfaultline.live";
    if (isProductionHost && (url.protocol !== "https:" || hasExplicitPort(value))) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function configuredBillingReturnOrigins(environment: BillingOriginEnvironment): Map<string, string> {
  const approved = new Map(PRODUCTION_BILLING_RETURN_ORIGINS);
  if (environment.NODE_ENV === "production") return approved;

  for (const value of [
    ...DEFAULT_NON_PRODUCTION_BILLING_RETURN_ORIGINS,
    ...(environment.BILLING_RETURN_ORIGIN_ALLOWLIST ?? "").split(","),
  ]) {
    const origin = parseStrictBillingOrigin(value.trim());
    if (origin) approved.set(origin, origin);
  }
  return approved;
}

/**
 * Checkout params. A user who already has a Stripe customer reuses it so a
 * second session cannot create an unbound customer. Subscription checkouts
 * copy user_id onto the subscription. customer and customer_email are not
 * sent together.
 */
export function buildCheckoutSessionParams(input: {
  userId: number;
  email?: string | null;
  name?: string | null;
  planId: string;
  priceId: string;
  interval: string;
  origin: string;
  storedStripeCustomerId?: string | null;
}) {
  const mode = input.interval === "one_time" ? "payment" as const : "subscription" as const;
  const storedCustomerId = input.storedStripeCustomerId || null;
  const email = input.email || undefined;
  const origin = billingReturnOrigin(input.origin, input.origin);
  if (!origin) {
    throw new Error("Checkout URLs require an approved billing return origin.");
  }
  return {
    mode,
    payment_method_types: ["card" as const],
    ...(storedCustomerId ? { customer: storedCustomerId } : email ? { customer_email: email } : {}),
    allow_promotion_codes: true,
    line_items: [{ price: input.priceId, quantity: 1 }],
    client_reference_id: input.userId.toString(),
    metadata: {
      user_id: input.userId.toString(),
      customer_email: email ?? "",
      customer_name: input.name ?? "",
      plan_id: input.planId,
    },
    ...(mode === "subscription" ? {
      subscription_data: {
        metadata: {
          user_id: input.userId.toString(),
          plan_id: input.planId,
        },
      },
    } : {}),
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&plan=${input.planId}`,
    cancel_url: `${origin}/app/account?payment=cancelled`,
  };
}

/** Public/checkout availability: product lock AND a configured Stripe price. */
export function isPlanAvailableForPurchase(planId: StripePlanId, priceId: string | null | undefined): boolean {
  return CHECKOUT_ENABLED && PAID_PLANS_ON_SALE && PRICING_PLANS[planId].available && !!priceId;
}

/**
 * Origin is only a consistency check: both values must be identical entries
 * in the server-configured allowlist; neither request header is a trust source.
 */
export function billingReturnOrigin(
  inputOrigin: string,
  requestOrigin: string | string[] | undefined,
  environment: BillingOriginEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    BILLING_RETURN_ORIGIN_ALLOWLIST: process.env.BILLING_RETURN_ORIGIN_ALLOWLIST,
  },
): string | null {
  if (typeof requestOrigin !== "string") return null;
  const requested = parseStrictBillingOrigin(inputOrigin);
  const request = parseStrictBillingOrigin(requestOrigin);
  if (!requested || !request || requested !== request) return null;
  return configuredBillingReturnOrigins(environment).get(requested) ?? null;
}

export const billingRouter = router({
  getPlans: publicProcedure.query(() => {
    return Object.values(PLANS).filter(p => PRICING_PLANS[p.id].available).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      amount: p.amount,
      interval: p.interval,
      available: isPlanAvailableForPurchase(p.id, p.priceId),
    }));
  }),

  createCheckout: protectedProcedure
    .input(z.object({
      planId: z.enum(["core", "core_annual", "premium", "premium_annual", "founding", "lifetime"]),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = PLANS[input.planId];
      if (!isPlanAvailableForPurchase(input.planId, plan.priceId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This plan is not yet available for purchase. Please contact us." });
      }
      const verification = await verifyStripePlanConfiguration(plan);
      if (!verification.verified) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Checkout is unavailable until Stripe configuration is verified. ${verification.reason}`,
        });
      }
      if (!stripe) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Checkout is unavailable because Stripe is not configured." });
      }
      const priceId = plan.priceId;
      if (!priceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This plan is not yet available for purchase. Please contact us." });
      }
      const origin = billingReturnOrigin(input.origin, ctx.req.headers.origin);
      if (!origin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Billing return URL must be an approved first-party origin and match the requesting origin." });
      }
      const session = await stripe.checkout.sessions.create(buildCheckoutSessionParams({
        userId: ctx.user.id,
        email: ctx.user.email,
        name: ctx.user.name,
        planId: input.planId,
        priceId,
        interval: plan.interval,
        origin,
        storedStripeCustomerId: ctx.user.stripeCustomerId,
      }));
      return { url: session.url };
    }),

  verifyCheckoutSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user || !stripe) return null;
      try {
        const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
          expand: ['line_items'],
        });
        return checkoutReceiptForCaller(ctx.user, {
          clientReferenceId: session.client_reference_id ?? null,
          metadataUserId: session.metadata?.user_id ?? null,
          status: session.status ?? null,
          paymentStatus: session.payment_status ?? null,
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? null,
          planId: session.metadata?.plan_id ?? null,
          customerEmail: session.customer_email ?? session.metadata?.customer_email ?? null,
        });
      } catch {
        return null;
      }
    }),

  createPortalSession: protectedProcedure
    .input(z.object({ origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user as any;
      if (!user.stripeCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No billing account found. Please make a purchase first." });
      }
      if (!stripe) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Billing portal is unavailable because Stripe is not configured." });
      }
      const origin = billingReturnOrigin(input.origin, ctx.req.headers.origin);
      if (!origin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Billing return URL must be an approved first-party origin and match the requesting origin." });
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${origin}/app/account`,
      });
      return { url: session.url };
    }),

  /**
   * Returns the current lifetime promotion window status:
   * how many spots have been claimed and how many remain.
   * Used by the UserAccount page to show a real-time scarcity indicator.
   */
  getLifetimeStatus: publicProcedure.query(async () => {
    const claimed = await getLifetimeMemberCount();
    const remaining = Math.max(0, LIFETIME_FOUNDING_LIMIT - claimed);
    return {
      limit: LIFETIME_FOUNDING_LIMIT,
      claimed,
      remaining,
      isSoldOut: remaining === 0,
    };
  }),
});
