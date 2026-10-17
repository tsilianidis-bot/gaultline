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
import {
  CHECKOUT_ALLOWLIST_COPY,
  CHECKOUT_TEMPORARILY_UNAVAILABLE_COPY,
  isCheckoutBuyerAllowed,
  isCheckoutRuntimeEnabled,
  type CheckoutBlockReason,
  type CheckoutBuyer,
  type CheckoutEnv,
} from "../../shared/checkoutAccess";

/** Legacy founding-lifetime counter (retained for existing entitlements; not a public offer). */
const LIFETIME_FOUNDING_LIMIT = 100;

/**
 * Why a plan cannot be purchased right now. Null means the product lock, price id,
 * request-time runtime flag, and allowlist all pass. Stripe price verification is separate.
 */
export function explainCheckoutBlock(
  planId: StripePlanId,
  priceId: string | null | undefined,
  buyer: CheckoutBuyer | null = null,
  env: CheckoutEnv = process.env,
): CheckoutBlockReason | null {
  if (!(PAID_PLANS_ON_SALE && PRICING_PLANS[planId].available && !!priceId)) {
    return PRICING_PLANS[planId].available && PAID_PLANS_ON_SALE ? "unconfigured" : "not_for_sale";
  }
  if (!isCheckoutRuntimeEnabled(env, CHECKOUT_ENABLED)) return "runtime_off";
  if (!isCheckoutBuyerAllowed(env, buyer)) return "allowlist";
  return null;
}

/** Public/checkout availability: product lock, configured price, runtime flag, and allowlist. */
export function isPlanAvailableForPurchase(
  planId: StripePlanId,
  priceId: string | null | undefined,
  buyer: CheckoutBuyer | null = null,
  env: CheckoutEnv = process.env,
): boolean {
  return explainCheckoutBlock(planId, priceId, buyer, env) === null;
}

function buyerFromUser(user: { id: number | string; email?: string | null } | null): CheckoutBuyer | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

function rejectCheckoutBlock(block: CheckoutBlockReason): never {
  if (block === "allowlist") {
    throw new TRPCError({ code: "FORBIDDEN", message: CHECKOUT_ALLOWLIST_COPY });
  }
  if (block === "runtime_off") {
    throw new TRPCError({ code: "BAD_REQUEST", message: CHECKOUT_TEMPORARILY_UNAVAILABLE_COPY });
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: "This plan is not yet available for purchase. Please contact us." });
}

export const billingRouter = router({
  getPlans: publicProcedure.query(({ ctx }) => {
    const buyer = buyerFromUser(ctx.user);
    return Object.values(PLANS).filter(p => PRICING_PLANS[p.id].available).map(p => {
      const blockedReason = explainCheckoutBlock(p.id, p.priceId, buyer);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        amount: p.amount,
        interval: p.interval,
        available: blockedReason === null,
        blockedReason,
      };
    });
  }),

  createCheckout: protectedProcedure
    .input(z.object({
      planId: z.enum(["core", "core_annual", "premium", "premium_annual", "founding", "lifetime"]),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = PLANS[input.planId];
      const block = explainCheckoutBlock(input.planId, plan.priceId, buyerFromUser(ctx.user));
      if (block) rejectCheckoutBlock(block);
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
      const customerEmail = ctx.user.email ?? undefined;
      const session = await stripe.checkout.sessions.create({
        mode: plan.interval === "one_time" ? "payment" : "subscription",
        payment_method_types: ["card"],
        ...(customerEmail ? { customer_email: customerEmail } : {}),
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: customerEmail ?? "",
          customer_name: ctx.user.name ?? "",
          plan_id: input.planId,
        },
        success_url: `${input.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&plan=${input.planId}`,
        cancel_url: `${input.origin}/app/account?payment=cancelled`,
      });
      return { url: session.url };
    }),

  /**
   * Confirms a checkout session for the signed-in user who started it.
   * Requires auth and ownership (session.client_reference_id / metadata.user_id must
   * match ctx.user.id); any other session returns null. Never returns customer email.
   */
  verifyCheckoutSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!stripe) {
        return null;
      }
      try {
        const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
          expand: ['line_items'],
        });
        const ownerId = session.client_reference_id ?? session.metadata?.user_id ?? null;
        if (!ownerId || String(ownerId) !== String(ctx.user.id)) {
          return null;
        }
        return {
          status: session.status,
          paymentStatus: session.payment_status,
          amountTotal: session.amount_total,
          currency: session.currency,
          planId: session.metadata?.plan_id ?? null,
        };
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
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${input.origin}/app/account`,
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
