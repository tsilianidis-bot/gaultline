/**
 * Analytics collection REST endpoints.
 * These are called from the frontend to record page views and custom events.
 * They are lightweight fire-and-forget — always return 200.
 */

import { Router, Request, Response } from "express";
import {
  parseUserAgent,
  getCountryFromIp,
  getClientIp,
  recordPageView,
  recordSiteEvent,
  upsertSession,
} from "./analyticsCollector";

const router = Router();

// ── POST /api/analytics/pageview ──────────────────────────────────────────────
router.post("/pageview", async (req: Request, res: Response) => {
  res.json({ ok: true }); // respond immediately — don't block the client
  try {
    const {
      sessionId,
      userId,
      path,
      title,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      screenWidth,
    } = req.body as {
      sessionId: string;
      userId?: number;
      path: string;
      title?: string;
      referrer?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      screenWidth?: number;
    };

    if (!sessionId || !path) return;

    const ua = req.headers["user-agent"] ?? "";
    const { browser, os, deviceType } = parseUserAgent(ua);
    const ip = getClientIp(req);
    const country = await getCountryFromIp(ip);

    await Promise.all([
      recordPageView({
        sessionId,
        userId: userId ?? null,
        path,
        title,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
        country,
        deviceType,
        browser,
        os,
        screenWidth,
      }),
      upsertSession({
        sessionId,
        userId: userId ?? null,
        path,
        country,
        deviceType,
        browser,
        os,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
      }),
    ]);
  } catch (err) {
    console.error("[Analytics] /pageview error:", err);
  }
});

// ── POST /api/analytics/event ─────────────────────────────────────────────────
router.post("/event", async (req: Request, res: Response) => {
  res.json({ ok: true });
  try {
    const { sessionId, userId, eventName, props, path } = req.body as {
      sessionId: string;
      userId?: number;
      eventName: string;
      props?: Record<string, unknown>;
      path?: string;
    };

    if (!sessionId || !eventName) return;

    const ua = req.headers["user-agent"] ?? "";
    const { deviceType } = parseUserAgent(ua);
    const ip = getClientIp(req);
    const country = await getCountryFromIp(ip);

    await recordSiteEvent({
      sessionId,
      userId: userId ?? null,
      eventName,
      props,
      path,
      country,
      deviceType,
    });
  } catch (err) {
    console.error("[Analytics] /event error:", err);
  }
});

export default router;
