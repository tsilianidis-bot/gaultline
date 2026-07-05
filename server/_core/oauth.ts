import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { sendEmail, buildWelcomeEmail } from "../email";

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

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Check if this is a brand-new user before upserting
      const existingUser = await db.getUserByOpenId(userInfo.openId);
      const isNewUser = !existingUser;

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

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

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/app");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
