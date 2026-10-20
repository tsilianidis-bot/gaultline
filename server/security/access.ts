import type { Request, Response } from "express";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";

/**
 * Server-side owner/admin check. A member role is not sufficient.
 * Cron sessions are never treated as an owner or an admin.
 */
export function isOwnerOrAdmin(
  user: { role?: string | null; openId?: string | null; isCron?: boolean | null } | null | undefined,
  ownerOpenId: string = ENV.ownerOpenId,
): boolean {
  if (!user || user.isCron) return false;
  if (user.role === "admin") return true;
  return ownerOpenId.length > 0 && user.openId === ownerOpenId;
}

export async function allowOwnerOrAdmin(req: Request, res: Response): Promise<boolean> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!isOwnerOrAdmin(user)) {
      res.status(403).json({ error: "Owner or admin only" });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
}

type PrivateAuthField = "adminNotes" | "stripeCustomerId" | "stripeSubscriptionId";

/** Drops internal notes and Stripe identifiers before auth.me leaves the server. */
export function toPublicAuthUser<T extends object | null | undefined>(
  user: T,
): T extends object ? Omit<T, PrivateAuthField> : T {
  if (!user) return user as T extends object ? Omit<T, PrivateAuthField> : T;
  const copy = { ...(user as Record<string, unknown>) };
  delete copy.adminNotes;
  delete copy.stripeCustomerId;
  delete copy.stripeSubscriptionId;
  return copy as T extends object ? Omit<T, PrivateAuthField> : T;
}

export interface CheckoutSessionClaim {
  clientReferenceId: string | null;
  metadataUserId: string | null;
  status: string | null;
  paymentStatus: string | null;
  amountTotal: number | null;
  currency: string | null;
  planId: string | null;
  customerEmail: string | null;
}

export interface CheckoutReceipt {
  status: string | null;
  paymentStatus: string | null;
  amountTotal: number | null;
  currency: string | null;
  planId: string | null;
  customerEmail: string | null;
}

/**
 * A checkout receipt is visible only to the authenticated user id stored on
 * the session. Admin and owner roles do not widen this. A mismatch and an
 * anonymous caller both produce null so the response does not confirm that
 * another person's session exists.
 */
export function checkoutReceiptForCaller(
  caller: { id: number; email?: string | null } | null | undefined,
  session: CheckoutSessionClaim,
): CheckoutReceipt | null {
  if (!caller) return null;
  const ownerId = session.metadataUserId || session.clientReferenceId;
  if (!ownerId || ownerId !== String(caller.id)) return null;
  const email = session.customerEmail && caller.email && session.customerEmail === caller.email
    ? session.customerEmail
    : null;
  return {
    status: session.status,
    paymentStatus: session.paymentStatus,
    amountTotal: session.amountTotal,
    currency: session.currency,
    planId: session.planId,
    customerEmail: email,
  };
}
