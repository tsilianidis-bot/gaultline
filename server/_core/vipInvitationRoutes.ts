import type { Express, Request, Response } from "express";
import {
  clearVipInviteClaimCookie,
  getVipInvitationByRawToken,
  setVipInviteClaimCookie,
} from "../vipInvitations";

/**
 * Converts a one-time Messenger link into an HttpOnly, signed, token-free claim
 * cookie before the SPA or OAuth flow sees it. Do not add analytics or logging
 * to this route: its path contains a bearer invitation token.
 */
export function registerVipInvitationRoutes(app: Express): void {
  app.get("/invite/:token", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");

    try {
      const invitation = await getVipInvitationByRawToken(req.params.token);
      if (!invitation) {
        clearVipInviteClaimCookie(res, req);
        res.redirect(302, "/invite?status=unavailable");
        return;
      }
      setVipInviteClaimCookie(res, req, invitation);
      res.redirect(302, "/invite");
    } catch {
      // Fail closed without revealing whether a link was malformed, expired, revoked, or redeemed.
      clearVipInviteClaimCookie(res, req);
      res.redirect(302, "/invite?status=unavailable");
    }
  });
}
