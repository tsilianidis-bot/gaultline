import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { isOAuthConfigured, OAuthInactiveError, sdk } from "./sdk";
import { sendEmail, buildWelcomeEmail } from "../email";

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

function respondOAuthCallbackFailure(res: Response, error: unknown): void {
  const errorCode = resolveOAuthCallbackErrorCode(error);
  console.error(`[OAuth] Callback failed (${errorCode})`, error);
  res.status(500).json(publicOAuthCallbackFailure(errorCode));
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    if (!isOAuthConfigured()) {
      respondOAuthCallbackFailure(res, new OAuthCallbackStepError("token_exchange_failed", new OAuthInactiveError()));
      return;
    }

    try {
      const tokenResponse = await runOAuthStep("token_exchange_failed", () =>
        sdk.exchangeCodeForToken(code, state),
      );
      const userInfo = await runOAuthStep("userinfo_failed", () =>
        sdk.getUserInfo(tokenResponse.accessToken),
      );

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Check if this is a brand-new user before upserting
      const existingUser = await runOAuthStep("db_failed", () =>
        db.getUserByOpenId(userInfo.openId),
      );
      const isNewUser = !existingUser;

      await runOAuthStep("db_failed", () =>
        db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        }),
      );

      // Send welcome email on first login (best-effort, non-blocking)
      if (isNewUser && userInfo.email) {
        const newUserRow = await db.getUserByOpenId(userInfo.openId);
        sendEmail(buildWelcomeEmail({
          name: userInfo.name || "",
          email: userInfo.email,
        })).then(() => {
          if (newUserRow) {
            db.recordOnboardingEmailSent(newUserRow.id, 0).catch(() => {});
          }
        }).catch((err) => {
          console.warn('[OAuth] Welcome email failed (non-fatal):', err);
        });
      }

      // Auto-grant founding tier if this email has an approved founding access request
      if (userInfo.email) {
        try {
          const userByEmail = await db.getUserByEmail(userInfo.email);
          if (userByEmail && userByEmail.accessTier === 'free') {
            const hasApproval = await db.hasApprovedFoundingRequest(userInfo.email);
            if (hasApproval) {
              await db.updateUserTier(userByEmail.id, 'founding');
              console.log(`[OAuth] Auto-granted founding tier to ${userInfo.email}`);
            }
          }
        } catch (e) {
          console.warn('[OAuth] Could not check founding access request', e);
        }
      }

      const sessionToken = await runOAuthStep("session_failed", () =>
        sdk.createSessionToken(userInfo.openId, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
        }),
      );

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/app");
    } catch (error) {
      respondOAuthCallbackFailure(res, error);
    }
  });
}
