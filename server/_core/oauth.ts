import { randomBytes, randomUUID } from "node:crypto";
import { parse as parseCookies } from "cookie";
import { OPEN_REGISTRATION } from "@shared/tiers";
import { canonicalAuthOrigin, FAULTLINE_ORIGIN } from "@shared/authOrigin";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { isOAuthConfigured, OAuthInactiveError, sdk } from "./sdk";

export const OAUTH_STATE_COOKIE_NAME = "faultline_oauth_state_verifier";
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1_000;

export const OAUTH_CALLBACK_ERROR_CODES = [
  "token_exchange_failed",
  "userinfo_failed",
  "db_failed",
  "session_failed",
  "callback_failed",
] as const;

export type OAuthCallbackErrorCode = (typeof OAUTH_CALLBACK_ERROR_CODES)[number];

const SAFE_OAUTH_CALLBACK_MESSAGES: Record<OAuthCallbackErrorCode, string> = {
  token_exchange_failed: "Authorization code could not be exchanged for a token.",
  userinfo_failed: "User info could not be loaded after token exchange.",
  db_failed: "Signed-in user could not be saved.",
  session_failed: "Session could not be created.",
  callback_failed: "OAuth callback failed.",
};

export class OAuthCallbackStepError extends Error {
  readonly errorCode: OAuthCallbackErrorCode;

  constructor(errorCode: OAuthCallbackErrorCode, cause?: unknown) {
    super(SAFE_OAUTH_CALLBACK_MESSAGES[errorCode]);
    this.name = "OAuthCallbackStepError";
    this.errorCode = errorCode;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function publicOAuthCallbackFailure(errorCode: OAuthCallbackErrorCode): {
  error: "OAuth callback failed";
  errorCode: OAuthCallbackErrorCode;
  message: string;
} {
  return {
    error: "OAuth callback failed",
    errorCode,
    message: SAFE_OAUTH_CALLBACK_MESSAGES[errorCode],
  };
}

export function resolveOAuthCallbackErrorCode(error: unknown): OAuthCallbackErrorCode {
  if (error instanceof OAuthCallbackStepError) {
    return error.errorCode;
  }
  return "callback_failed";
}

async function runOAuthStep<T>(
  errorCode: OAuthCallbackErrorCode,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw new OAuthCallbackStepError(errorCode, cause);
  }
}

/** Browser-facing callback failure: a static page with a way back to sign-in (no raw JSON dead end).
 * Clears the post-auth flag so "Sign in again" at /app shows the sign-in gate rather than guest mode. */
export function renderOAuthCallbackFailurePage(errorCode: OAuthCallbackErrorCode): string {
  const message = SAFE_OAUTH_CALLBACK_MESSAGES[errorCode];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Sign-in did not complete | FAULTLINE</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:rgba(255,255,255,0.8);font-family:system-ui,sans-serif;text-align:center;padding:24px">
<main style="max-width:420px">
<h1 style="font-size:20px;letter-spacing:0.12em;color:#00E5FF">SIGN-IN DID NOT COMPLETE</h1>
<p>${message} Please sign in again.</p>
<p style="font-size:12px;opacity:0.5">Error code: ${errorCode}</p>
<p><a href="/app" style="color:#00E5FF">Sign in again</a> &middot; <a href="/" style="color:rgba(255,255,255,0.6)">Back to FAULTLINE</a></p>
</main>
<script>try{sessionStorage.removeItem("fl_post_auth_asha")}catch(e){}</script>
</body></html>`;
}

function respondOAuthCallbackFailure(req: Request, res: Response, error: unknown): void {
  const errorCode = resolveOAuthCallbackErrorCode(error);
  console.error(`[OAuth] Callback failed (${errorCode})`, error);
  res.status(500).set("Cache-Control", "no-store");
  // Browser navigations (Accept: text/html) get a page with a link back; API clients keep the JSON body.
  if (req.accepts(["json", "html"]) === "html") {
    res.type("html").send(renderOAuthCallbackFailurePage(errorCode));
    return;
  }
  res.json(publicOAuthCallbackFailure(errorCode));
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function randomOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function validAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Never derive a redirect URI from an inbound Host header. Production uses the
 * known canonical origin; staging must opt in through a trusted environment
 * value so a forged Host cannot receive an authorization code.
 */
export function oauthCallbackUri(): string | null {
  const configured = ENV.oAuthCallbackOrigin.trim() || FAULTLINE_ORIGIN;
  if (!validAbsoluteHttpUrl(configured)) return null;
  const parsed = new URL(configured);
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
  return `${canonicalAuthOrigin(parsed.origin)}/api/oauth/callback`;
}

export function isOAuthLoginConfigured(): boolean {
  return isOAuthConfigured()
    && validAbsoluteHttpUrl(ENV.oAuthPortalUrl.trim())
    && oauthCallbackUri() !== null;
}

export function buildOAuthAuthorizationUrl(state: string): string | null {
  if (!isOAuthLoginConfigured()) return null;
  const redirectUri = oauthCallbackUri();
  if (!redirectUri) return null;
  try {
    const url = new URL("/app-auth", ENV.oAuthPortalUrl.trim());
    url.searchParams.set("appId", ENV.appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch {
    return null;
  }
}

function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
  };
}

function stateVerifierFrom(req: Request): string | undefined {
  const verifier = parseCookies(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE_NAME];
  return typeof verifier === "string" && verifier.length > 0 ? verifier : undefined;
}

function respondInvalidOAuthState(res: Response): void {
  res.status(400).set("Cache-Control", "no-store").json({ error: "invalid or expired OAuth state" });
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/login", async (_req: Request, res: Response) => {
    const authorizationUrl = buildOAuthAuthorizationUrl("placeholder");
    if (!authorizationUrl) {
      res.status(503).set("Cache-Control", "no-store").json({ error: "OAuth sign-in is unavailable" });
      return;
    }

    const state = randomOpaqueToken();
    const verifier = randomOpaqueToken();
    try {
      await db.createOAuthAuthorizationState(state, verifier, new Date(Date.now() + OAUTH_STATE_TTL_MS));
    } catch (error) {
      console.error("[OAuth] Refusing to initiate without durable state persistence", error);
      res.status(503).set("Cache-Control", "no-store").json({ error: "OAuth sign-in is unavailable" });
      return;
    }

    const redirectUrl = buildOAuthAuthorizationUrl(state);
    if (!redirectUrl) {
      // Do not leave a durable state usable when a configuration changes mid-request.
      res.status(503).set("Cache-Control", "no-store").json({ error: "OAuth sign-in is unavailable" });
      return;
    }
    res.cookie(OAUTH_STATE_COOKIE_NAME, verifier, {
      ...oauthStateCookieOptions(),
      maxAge: OAUTH_STATE_TTL_MS,
    });
    res.set("Cache-Control", "no-store").redirect(302, redirectUrl);
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const verifier = stateVerifierFrom(req);

    if (!code || !state || !verifier) {
      respondInvalidOAuthState(res);
      return;
    }

    let consumed: boolean;
    try {
      consumed = await db.consumeOAuthAuthorizationState(state, verifier);
    } catch (error) {
      respondOAuthCallbackFailure(req, res, new OAuthCallbackStepError("callback_failed", error));
      return;
    }
    if (!consumed) {
      respondInvalidOAuthState(res);
      return;
    }

    // Consume first and clear the browser binding before any provider call.
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, oauthStateCookieOptions());

    if (!isOAuthConfigured()) {
      respondOAuthCallbackFailure(req, res, new OAuthCallbackStepError("token_exchange_failed", new OAuthInactiveError()));
      return;
    }
    const redirectUri = oauthCallbackUri();
    if (!redirectUri) {
      respondOAuthCallbackFailure(req, res, new OAuthCallbackStepError("callback_failed"));
      return;
    }

    try {
      const tokenResponse = await runOAuthStep("token_exchange_failed", () =>
        sdk.exchangeCodeForToken(code, redirectUri),
      );
      const userInfo = await runOAuthStep("userinfo_failed", () =>
        sdk.getUserInfo(tokenResponse.accessToken),
      );

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const existingUser = await runOAuthStep("db_failed", () => db.getUserByOpenId(userInfo.openId));
      if (!existingUser && !OPEN_REGISTRATION) {
        res.redirect(302, "/pricing");
        return;
      }

      await runOAuthStep("db_failed", () =>
        db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        }),
      );

      // Auto-grant founding tier if this email has an approved founding access request
      if (userInfo.email) {
        try {
          const userByEmail = await db.getUserByEmail(userInfo.email);
          if (userByEmail && userByEmail.accessTier === "free") {
            const hasApproval = await db.hasApprovedFoundingRequest(userInfo.email);
            if (hasApproval) {
              await db.updateUserTier(userByEmail.id, "founding");
              console.log(`[OAuth] Auto-granted founding tier to ${userInfo.email}`);
            }
          }
        } catch (e) {
          console.warn("[OAuth] Could not check founding access request", e);
        }
      }

      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + ONE_YEAR_MS);
      const sessionToken = await runOAuthStep("session_failed", () =>
        sdk.createSessionToken(userInfo.openId, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
          sessionId,
        }),
      );
      await runOAuthStep("session_failed", () =>
        db.createAuthSession(sessionId, userInfo.openId, expiresAt),
      );

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/app");
    } catch (error) {
      respondOAuthCallbackFailure(req, res, error);
    }
  });
}
