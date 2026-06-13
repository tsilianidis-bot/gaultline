/**
 * Billing domain router
 * Handles Stripe checkout session creation, billing portal, and plan listing.
 * Extracted from server/routers.ts for maintainability.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { stripe } from "../stripe/client";
import { PLANS } from "../stripe/products";

export const billingRouter = router({
  getPlans: publicProcedure.query(() => {
    return Object.values(PLANS).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      amount: p.amount,
      interval: p.interval,
      available: !!p.priceId,
    }));
  }),

  createCheckout: protectedProcedure
    .input(z.object({
      planId: z.enum(["core", "core_annual", "premium", "premium_annual", "founding", "lifetime"]),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = PLANS[input.planId];
      if (!plan.priceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This plan is not yet available for purchase. Please contact us." });
      }
      const session = await stripe.checkout.sessions.create({
        mode: plan.interval === "one_time" ? "payment" : "subscription",
        payment_method_types: ["card"],
        customer_email: ctx.user.email ?? undefined,
        allow_promotion_codes: true,
        line_items: [{ price: plan.priceId, quantity: 1 }],
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
          plan_id: input.planId,
        },
        success_url: `${input.origin}/app/account?payment=success`,
        cancel_url: `${input.origin}/app/account?payment=cancelled`,
      });
      return { url: session.url };
    }),

  createPortalSession: protectedProcedure
    .input(z.object({ origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user as any;
      if (!user.stripeCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No billing account found. Please make a purchase first." });
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${input.origin}/app/dashboard`,
      });
      return { url: session.url };
    }),
});
