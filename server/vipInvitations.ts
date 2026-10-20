import crypto from "node:crypto";
import type { Request, Response } from "express";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { parse as parseCookie } from "cookie";
import { vipGuestEntitlements, vipGuestInvitations } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";

export const VIP_INVITATION_DAYS = 7;
export const VIP_GUEST_ACCESS_DAYS = 30;
export const VIP_INVITE_COOKIE_NAME = "faultline_vip_invite";
const CLAIM_VERSION = "v1";

export type AccessTier = "free" | "core" | "premium" | "founding";

export type VipInviteClaim = {
  invitationId: number;
  expiresAt: Date;
};

export function addUtcDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** 256 bits of URL-safe entropy. The raw value is shown exactly once to the owner. */
export function createVipInvitationToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Store only this SHA-256 hash; raw invitation tokens are never persisted. */
export function hashVipInvitationToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function signingSecret(): Buffer {
  if (!ENV.cookieSecret) {
    throw new Error("VIP invitation claims require JWT_SECRET");
  }
  return Buffer.from(ENV.cookieSecret, "utf8");
}

function signClaimPayload(invitationId: number, expiresAtMs: number): string {
  return crypto
    .createHmac("sha256", signingSecret())
    .update(
      `faultline-vip-invite:${CLAIM_VERSION}:${invitationId}:${expiresAtMs}`,
      "utf8"
    )
    .digest("base64url");
}

/**
 * The browser cookie contains only a signed invitation ID and expiry, never the
 * bearer token from the Messenger link. The DB remains the authority for active,
 * expired, redeemed, or revoked state.
 */
export function createVipInviteClaimCookie(claim: VipInviteClaim): string {
  const expiresAtMs = claim.expiresAt.getTime();
  return `${CLAIM_VERSION}.${claim.invitationId}.${expiresAtMs}.${signClaimPayload(claim.invitationId, expiresAtMs)}`;
}

export function parseVipInviteClaimCookie(
  value: string | undefined
): VipInviteClaim | null {
  if (!value) return null;
  const [version, rawId, rawExpiry, signature, ...unexpected] =
    value.split(".");
  if (
    version !== CLAIM_VERSION ||
    unexpected.length > 0 ||
    !rawId ||
    !rawExpiry ||
    !signature
  )
    return null;

  const invitationId = Number(rawId);
  const expiresAtMs = Number(rawExpiry);
  if (
    !Number.isSafeInteger(invitationId) ||
    invitationId <= 0 ||
    !Number.isSafeInteger(expiresAtMs)
  )
    return null;
  if (expiresAtMs <= Date.now()) return null;

  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(signClaimPayload(invitationId, expiresAtMs), "utf8");
    actual = Buffer.from(signature, "utf8");
  } catch {
    return null;
  }
  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(expected, actual)
  )
    return null;

  return { invitationId, expiresAt: new Date(expiresAtMs) };
}

function requestInviteClaim(req: Request): VipInviteClaim | null {
  return parseVipInviteClaimCookie(
    parseCookie(req.headers.cookie ?? "")[VIP_INVITE_COOKIE_NAME]
  );
}

export function setVipInviteClaimCookie(
  res: Response,
  req: Request,
  claim: VipInviteClaim
): void {
  const maxAge = Math.max(0, claim.expiresAt.getTime() - Date.now());
  res.cookie(VIP_INVITE_COOKIE_NAME, createVipInviteClaimCookie(claim), {
    ...getSessionCookieOptions(req),
    maxAge,
  });
}

export function clearVipInviteClaimCookie(res: Response, req: Request): void {
  res.clearCookie(VIP_INVITE_COOKIE_NAME, getSessionCookieOptions(req));
}

/**
 * Resolves an invitation claim using both the signed cookie and the database.
 * This is deliberately conservative: any unavailable database state fails closed.
 */
export async function getActiveVipInvitationClaim(
  req: Request
): Promise<VipInviteClaim | null> {
  const claim = requestInviteClaim(req);
  if (!claim) return null;

  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const rows = await db
    .select({
      id: vipGuestInvitations.id,
      expiresAt: vipGuestInvitations.expiresAt,
    })
    .from(vipGuestInvitations)
    .where(
      and(
        eq(vipGuestInvitations.id, claim.invitationId),
        isNull(vipGuestInvitations.redeemedAt),
        isNull(vipGuestInvitations.revokedAt),
        gt(vipGuestInvitations.expiresAt, now)
      )
    )
    .limit(1);
  const invitation = rows[0];
  if (!invitation) return null;
  return { invitationId: invitation.id, expiresAt: invitation.expiresAt };
}

/** Validates an incoming raw link token and returns a claimable invitation only. */
export async function getVipInvitationByRawToken(
  token: string
): Promise<VipInviteClaim | null> {
  // Base64url-encoded 32-byte token: reject malformed inputs before a DB lookup.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const rows = await db
    .select({
      id: vipGuestInvitations.id,
      expiresAt: vipGuestInvitations.expiresAt,
    })
    .from(vipGuestInvitations)
    .where(
      and(
        eq(vipGuestInvitations.tokenHash, hashVipInvitationToken(token)),
        isNull(vipGuestInvitations.redeemedAt),
        isNull(vipGuestInvitations.revokedAt),
        gt(vipGuestInvitations.expiresAt, now)
      )
    )
    .limit(1);
  const invitation = rows[0];
  return invitation
    ? { invitationId: invitation.id, expiresAt: invitation.expiresAt }
    : null;
}

export async function getVipGuestEntitlement(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const rows = await db
    .select({
      entitlementId: vipGuestEntitlements.id,
      invitationId: vipGuestEntitlements.invitationId,
      grantedAt: vipGuestEntitlements.grantedAt,
      expiresAt: vipGuestEntitlements.expiresAt,
    })
    .from(vipGuestEntitlements)
    .innerJoin(
      vipGuestInvitations,
      eq(vipGuestEntitlements.invitationId, vipGuestInvitations.id)
    )
    .where(
      and(
        eq(vipGuestEntitlements.userId, userId),
        gt(vipGuestEntitlements.expiresAt, now),
        isNull(vipGuestInvitations.revokedAt)
      )
    )
    .orderBy(desc(vipGuestEntitlements.expiresAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Paid/founding tiers can never be downgraded; an active VIP grant raises free/core to premium. */
export function resolveVipEffectiveTier(
  baseTier: AccessTier,
  hasActiveVipGuestEntitlement: boolean
): AccessTier {
  if (!hasActiveVipGuestEntitlement) return baseTier;
  const rank: Record<AccessTier, number> = {
    free: 0,
    core: 1,
    premium: 2,
    founding: 3,
  };
  return rank[baseTier] >= rank.premium ? baseTier : "premium";
}
