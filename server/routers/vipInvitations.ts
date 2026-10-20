import { z } from "zod";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../_core/trpc";
import { getDb } from "../db";
import {
  entitlementAuditLog,
  vipGuestEntitlements,
  vipGuestInvitations,
} from "../../drizzle/schema";
import {
  VIP_GUEST_ACCESS_DAYS,
  VIP_INVITATION_DAYS,
  addUtcDays,
  clearVipInviteClaimCookie,
  createVipInvitationToken,
  getActiveVipInvitationClaim,
  getVipGuestEntitlement,
  hashVipInvitationToken,
} from "../vipInvitations";

function affectedRows(result: unknown): number {
  return Number(
    (result as { 0?: { affectedRows?: number } })?.[0]?.affectedRows ?? 0
  );
}

function requestOrigin(req: {
  protocol?: string;
  get?: (name: string) => string | undefined;
  headers?: Record<string, unknown>;
}): string {
  const forwarded = req.headers?.["x-forwarded-proto"];
  const protocol = (
    Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === "string"
        ? forwarded.split(",")[0]
        : req.protocol || "https"
  ).trim();
  const host =
    req.get?.("host") ??
    (typeof req.headers?.host === "string" ? req.headers.host : undefined);
  if (!host || !/^[A-Za-z0-9.-]+(?::\d+)?$/.test(host)) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to create invitation link for this host.",
    });
  }
  return `${protocol === "http" ? "http" : "https"}://${host}`;
}

const invitationUnavailable = () =>
  new TRPCError({
    code: "BAD_REQUEST",
    message: "This private invitation is unavailable.",
  });

export const vipInvitationRouter = router({
  /** Public only in the sense that it reveals no token or invitation details; cookie validation is server-side. */
  claimStatus: publicProcedure.query(async ({ ctx }) => {
    const claim = await getActiveVipInvitationClaim(ctx.req);
    return claim
      ? { available: true, expiresAt: claim.expiresAt }
      : { available: false, expiresAt: null };
  }),

  /** Allows the candidate OAuth callback and signed-in browser to show an accurate invitation-specific result. */
  myGuestAccess: protectedProcedure.query(async ({ ctx }) => {
    const entitlement = await getVipGuestEntitlement(ctx.user.id);
    if (!entitlement)
      return { active: false, expiresAt: null, grantedAt: null };
    return {
      active: true,
      expiresAt: entitlement.expiresAt,
      grantedAt: entitlement.grantedAt,
    };
  }),

  /**
   * Redeems the signed claim cookie after the recipient's existing OAuth flow
   * has identified an account with a verified email. No client token/recipient
   * ID is accepted, and no billing or permanent users.accessTier field is touched.
   */
  redeem: protectedProcedure.mutation(async ({ ctx }) => {
    const claim = await getActiveVipInvitationClaim(ctx.req);
    if (!claim || !ctx.user.email) {
      clearVipInviteClaimCookie(ctx.res, ctx.req);
      throw invitationUnavailable();
    }

    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable.",
      });

    const redeemedAt = new Date();
    const entitlementExpiresAt = addUtcDays(redeemedAt, VIP_GUEST_ACCESS_DAYS);
    try {
      const redeemed = await db.transaction(async tx => {
        // This conditional update is the single-use concurrency boundary. Exactly one caller can win.
        const claimResult = await tx.execute(sql`
          UPDATE vipGuestInvitations
          SET redeemedAt = ${redeemedAt}, redeemedByUserId = ${ctx.user.id}, redeemedByEmail = ${ctx.user.email}
          WHERE id = ${claim.invitationId}
            AND redeemedAt IS NULL
            AND revokedAt IS NULL
            AND expiresAt > ${redeemedAt}
        `);
        if (affectedRows(claimResult) !== 1) return false;

        await tx.insert(vipGuestEntitlements).values({
          invitationId: claim.invitationId,
          userId: ctx.user.id,
          grantedAt: redeemedAt,
          expiresAt: entitlementExpiresAt,
        });
        await tx.insert(entitlementAuditLog).values({
          userId: ctx.user.id,
          fromTier: ctx.user.accessTier,
          toTier: "premium",
          reason: "vip_guest_invitation_30_day",
        });
        return true;
      });
      if (!redeemed) {
        clearVipInviteClaimCookie(ctx.res, ctx.req);
        throw invitationUnavailable();
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      // A DB unique violation must not expose who redeemed the invitation.
      clearVipInviteClaimCookie(ctx.res, ctx.req);
      throw invitationUnavailable();
    }

    clearVipInviteClaimCookie(ctx.res, ctx.req);
    return {
      activated: true,
      accessTier: "premium" as const,
      expiresAt: entitlementExpiresAt,
      accessDays: VIP_GUEST_ACCESS_DAYS,
    };
  }),

  // ── Owner controls. All raw links are returned once at creation and never persisted. ──
  adminCreate: adminProcedure
    .input(z.object({ label: z.string().trim().min(1).max(120).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable.",
        });
      const token = createVipInvitationToken();
      const createdAt = new Date();
      const expiresAt = addUtcDays(createdAt, VIP_INVITATION_DAYS);
      const result = await db.insert(vipGuestInvitations).values({
        tokenHash: hashVipInvitationToken(token),
        createdByUserId: ctx.user.id,
        label: input.label || null,
        expiresAt,
        createdAt,
      });
      const invitationId = Number(
        (result as unknown as { 0?: { insertId?: number } })[0]?.insertId
      );
      if (!Number.isSafeInteger(invitationId) || invitationId <= 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invitation creation failed.",
        });
      }
      return {
        invitation: {
          id: invitationId,
          label: input.label || null,
          createdAt,
          expiresAt,
          status: "active" as const,
        },
        // Copy into Messenger immediately. This bearer value is intentionally never returned again.
        link: `${requestOrigin(ctx.req)}/invite/${token}`,
      };
    }),

  adminList: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable.",
      });
    const now = new Date();
    const rows = await db
      .select({
        id: vipGuestInvitations.id,
        label: vipGuestInvitations.label,
        createdAt: vipGuestInvitations.createdAt,
        expiresAt: vipGuestInvitations.expiresAt,
        revokedAt: vipGuestInvitations.revokedAt,
        redeemedAt: vipGuestInvitations.redeemedAt,
        redeemedByEmail: vipGuestInvitations.redeemedByEmail,
        entitlementExpiresAt: vipGuestEntitlements.expiresAt,
      })
      .from(vipGuestInvitations)
      .leftJoin(
        vipGuestEntitlements,
        eq(vipGuestEntitlements.invitationId, vipGuestInvitations.id)
      )
      .orderBy(desc(vipGuestInvitations.createdAt))
      .limit(100);
    return rows.map(row => ({
      ...row,
      status: row.revokedAt
        ? ("revoked" as const)
        : row.redeemedAt
          ? ("redeemed" as const)
          : row.expiresAt <= now
            ? ("expired" as const)
            : ("active" as const),
    }));
  }),

  /** Revocation is owner-controlled and immediately disables any linked guest entitlement. */
  adminRevoke: adminProcedure
    .input(z.object({ invitationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable.",
        });
      await db
        .update(vipGuestInvitations)
        .set({ revokedAt: new Date(), revokedByUserId: ctx.user.id })
        .where(
          and(
            eq(vipGuestInvitations.id, input.invitationId),
            isNull(vipGuestInvitations.revokedAt)
          )
        );
      return { success: true };
    }),

  /** Manually expires an unused link without revoking any already-issued access. */
  adminExpireUnused: adminProcedure
    .input(z.object({ invitationId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable.",
        });
      const now = new Date();
      await db
        .update(vipGuestInvitations)
        .set({ expiresAt: now })
        .where(
          and(
            eq(vipGuestInvitations.id, input.invitationId),
            isNull(vipGuestInvitations.redeemedAt),
            isNull(vipGuestInvitations.revokedAt),
            gt(vipGuestInvitations.expiresAt, now)
          )
        );
      return { success: true };
    }),
});
