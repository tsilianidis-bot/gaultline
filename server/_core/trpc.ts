import { NOT_ADMIN_ERR_MSG, CORE_REQUIRED_ERR_MSG, PREMIUM_REQUIRED_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getUserTier } from "../db";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Requires login + core, premium, or founding tier
const requireCore = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  const tier = await getUserTier(ctx.user.id);
  if (tier !== 'core' && tier !== 'premium' && tier !== 'founding') {
    throw new TRPCError({ code: "FORBIDDEN", message: CORE_REQUIRED_ERR_MSG });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const coreProcedure = t.procedure.use(requireCore);

// Requires login + premium or founding tier
const requirePremium = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  const tier = await getUserTier(ctx.user.id);
  if (tier !== 'premium' && tier !== 'founding') {
    throw new TRPCError({ code: "FORBIDDEN", message: PREMIUM_REQUIRED_ERR_MSG });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const premiumProcedure = t.procedure.use(requirePremium);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
