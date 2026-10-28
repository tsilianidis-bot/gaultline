import { NOT_ADMIN_ERR_MSG, CORE_REQUIRED_ERR_MSG, PREMIUM_REQUIRED_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { guardNamedClientFields } from '@shared/clientVocabulary';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getUserTier } from "../db";
import { isOwnerOrAdmin } from "../security/access";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

/**
 * Customer procedures. Admin and owner procedures are intentionally not wrapped.
 * ownerSim stays raw because every procedure there is admin-gated. Public
 * simPortfolio reads are guarded. Raw simulation tokens on an admin screen
 * remain an open owner decision.
 */
const RAW_SIMULATION_PATH = /^ownerSim(?:\.|$)/;

const clientVocabulary = t.middleware(async (opts) => {
  const result = await opts.next();
  if (!result.ok || RAW_SIMULATION_PATH.test(opts.path)) return result;
  const data = guardNamedClientFields(result.data);
  if (data === result.data) return result;
  return { ...result, data };
});

export const publicProcedure = t.procedure.use(clientVocabulary);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (ctx.user.isQaSession && opts.type !== "query") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner QA access is read-only" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(clientVocabulary).use(requireUser);

// Requires login + core, premium, or founding tier
const requireCore = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (ctx.user.isQaSession) {
    if (opts.type !== "query") throw new TRPCError({ code: "FORBIDDEN", message: "Owner QA access is read-only" });
    return next({ ctx: { ...ctx, user: ctx.user } });
  }

  // getUserTier uses effectiveTier: lifetimeAccess is founding, and a past accessExpiresAt is free.
  const tier = await getUserTier(ctx.user.id);
  if (tier !== 'core' && tier !== 'premium' && tier !== 'founding') {
    throw new TRPCError({ code: "FORBIDDEN", message: CORE_REQUIRED_ERR_MSG });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const coreProcedure = t.procedure.use(clientVocabulary).use(requireCore);

// Requires login + premium or founding tier
const requirePremium = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (ctx.user.isQaSession) {
    if (opts.type !== "query") throw new TRPCError({ code: "FORBIDDEN", message: "Owner QA access is read-only" });
    return next({ ctx: { ...ctx, user: ctx.user } });
  }

  // getUserTier uses effectiveTier: lifetimeAccess is founding, and a past accessExpiresAt is free.
  const tier = await getUserTier(ctx.user.id);
  if (tier !== 'premium' && tier !== 'founding') {
    throw new TRPCError({ code: "FORBIDDEN", message: PREMIUM_REQUIRED_ERR_MSG });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const premiumProcedure = t.procedure.use(clientVocabulary).use(requirePremium);

export const ownerOrAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.isQaSession || !isOwnerOrAdmin(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Owner or admin only" });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.role !== 'admin') {
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
