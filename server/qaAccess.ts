import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

export const QA_ACCESS_COOKIE = "faultline_qa_access";
const QA_PRINCIPAL_ID = -9_001;
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1_000;

function configuredSecret() {
  const secret = process.env.QA_ACCESS_SECRET ?? "";
  return secret.trim();
}

function secureFor(req: Request) {
  return req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
}

function isManagedPreview(req: Request) {
  const host = String(req.headers.host ?? "").split(":")[0].toLowerCase();
  return process.env.NODE_ENV === "development" && (host.endsWith(".manus.computer") || host === "localhost" || host === "127.0.0.1");
}

function signature(secret: string) {
  return createHmac("sha256", secret).update("faultline-owner-qa-v1").digest("base64url");
}

function sameSecret(candidate: string, expected: string) {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isQaSession(req: Request) {
  // Local and Manus preview hosts are controlled QA environments. Production
  // hosts always require the owner-secret-created HttpOnly cookie below.
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

/** Permanent owner-only entry. It issues an HttpOnly signed QA cookie and never
 * touches user rows, subscriptions, entitlement state, or application data. */
export function handleQaAccess(req: Request, res: Response) {
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
  res.clearCookie(QA_ACCESS_COOKIE, { httpOnly: true, secure: secureFor(req), sameSite: "lax", path: "/" });
  return res.json({ ok: true });
}
