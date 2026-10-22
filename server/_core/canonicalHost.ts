import type { RequestHandler } from "express";
import { FAULTLINE_ORIGIN } from "@shared/authOrigin";

/** Redirect browser navigation before OAuth can set a host-only session cookie.
 * API writes, cron, QA access, and unrelated deployment hosts keep their existing handlers.
 */
export const canonicalBrowserHost: RequestHandler = (req, res, next) => {
  const isNavigation = !req.path.startsWith("/api/") || req.path === "/api/oauth/callback";
  if ((req.method === "GET" || req.method === "HEAD") &&
      req.hostname === "www.getfaultline.live" && isNavigation) {
    // Concatenation keeps even a //path on the fixed first-party origin.
    res.redirect(302, `${FAULTLINE_ORIGIN}${req.originalUrl}`);
    return;
  }
  next();
};
