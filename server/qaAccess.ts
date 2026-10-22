import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

export const QA_ACCESS_COOKIE = "faultline_qa_access";
const QA_PRINCIPAL_ID = -9_001;
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1_000;

function configuredSecret(): string {
  return (process.env.QA_ACCESS_SECRET ?? "").trim();
}

/** A QA session is valid only on this exact configured host, with no wildcards. */
export function configuredQaAccessHost(): string {
  return (process.env.QA_ACCESS_HOST ?? "").trim().toLowerCase();
}

export function isExactQaAccessHost(req: Request): boolean {
  const expected = configuredQaAccessHost();
  const actual = String(req.headers.host ?? "").trim().toLowerCase();
  return Boolean(expected) && actual === expected;
}

function secureFor(req: Request): boolean {
  return req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
}

/** Explicit staging opt-in. It remains constrained to the exact QA host. */
export function isManagedPreviewFlagEnabled(): boolean {
  return process.env.FAULTLINE_MANAGED_PREVIEW === "true";
}

export function isManagedPreview(req: Request): boolean {
  return isManagedPreviewFlagEnabled() && isExactQaAccessHost(req);
}

function signature(secret: string): string {
  return createHmac("sha256", secret).update("faultline-owner-qa-v1").digest("base64url");
}

function sameSecret(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isQaSession(req: Request): boolean {
  // No QA session may be used from an unconfigured, wildcard, or alternate host.
  if (!isExactQaAccessHost(req)) return false;
  if (isManagedPreview(req)) return true;
  const secret = configuredSecret();
  if (!secret) return false;
  const cookie = req.headers.cookie ?? "";
  const token = cookie.split(";").map(entry => entry.trim()).find(entry => entry.startsWith(`${QA_ACCESS_COOKIE}=`))?.slice(QA_ACCESS_COOKIE.length + 1);
  return Boolean(token && sameSecret(token, signature(secret)));
}

export function qaPrincipal() {
  const now = new Date();
  return {
    id: QA_PRINCIPAL_ID,
    openId: "faultline_owner_qa",
    name: "FAULTLINE Owner QA",
    email: null,
    loginMethod: "qa_access",
    role: "user" as const,
    accessTier: "founding" as const,
    dashboardMode: "intelligence" as const,
    preflightPromptMode: "off" as const,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    lifetimeAccess: false,
    lifetimePurchasedAt: null,
    lastPreflightCompletedAt: null,
    adminNotes: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    isQaSession: true as const,
    qaAccess: "read_only" as const,
  };
}

function rejectUnexpectedQaHost(res: Response): void {
  res.status(403).json({ ok: false, error: "qa_access_host_not_allowed" });
}

/** Permanent owner-only entry. It issues an HttpOnly signed QA cookie and never
 * touches user rows, subscriptions, entitlement state, or application data. */
export function handleQaAccess(req: Request, res: Response) {
  if (!isExactQaAccessHost(req)) {
    rejectUnexpectedQaHost(res);
    return;
  }
  const secret = configuredSecret();
  const provided = typeof req.body?.secret === "string" ? req.body.secret : "";
  if (!secret || !provided || !sameSecret(provided, secret)) {
    return res.status(401).json({ ok: false, error: "invalid_qa_access_secret" });
  }
  res.cookie(QA_ACCESS_COOKIE, signature(secret), {
    httpOnly: true,
    secure: secureFor(req),
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_MS,
  });
  return res.json({ ok: true, mode: "owner_qa_read_only" });
}

export function handleQaAccessLogout(req: Request, res: Response) {
  if (!isExactQaAccessHost(req)) {
    rejectUnexpectedQaHost(res);
    return;
  }
  res.clearCookie(QA_ACCESS_COOKIE, { httpOnly: true, secure: secureFor(req), sameSite: "lax", path: "/" });
  return res.json({ ok: true });
}
