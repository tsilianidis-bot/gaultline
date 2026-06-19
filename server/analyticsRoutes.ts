/**
 * Analytics collection REST endpoints.
 * These are called from the frontend to record page views and custom events.
 * They are lightweight fire-and-forget — always return 200.
 */

import { Router, Request, Response } from "express";
import {
  parseUserAgent,
  getGeoFromIp,
  getClientIp,
  recordPageView,
  recordSiteEvent,
  upsertSession,
  upsertVisitorProfile,
} from "./analyticsCollector";

const router = Router();

// ── POST /api/analytics/pageview ──────────────────────────────────────────────
router.post("/pageview", async (req: Request, res: Response) => {
  res.json({ ok: true }); // respond immediately — don't block the client
  try {
    const {
      sessionId,
      visitorId,
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
      visitorId?: string;
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
    const geo = await getGeoFromIp(ip);

    const [isNewSession] = await Promise.all([
      upsertSession({
        sessionId,
        userId: userId ?? null,
        path,
        country: geo.country,
        deviceType,
        browser,
        os,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
      }),
      recordPageView({
        sessionId,
        visitorId: visitorId ?? null,
        userId: userId ?? null,
        path,
        title,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
        country: geo.country,
        countryName: geo.countryName,
        city: geo.city,
        region: geo.region,
        deviceType,
        browser,
        os,
        screenWidth,
      }),
    ]);

    // Upsert visitor profile if we have a stable visitorId
    if (visitorId) {
      await upsertVisitorProfile({
        visitorId,
        country: geo.country,
        countryName: geo.countryName,
        city: geo.city,
        region: geo.region,
        deviceType,
        browser,
        os,
        referrer: referrer ?? null,
        utmSource: utmSource ?? null,
        utmMedium: utmMedium ?? null,
        utmCampaign: utmCampaign ?? null,
        isNewSession: !!isNewSession,
      });
    }
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
    const geo = await getGeoFromIp(ip);

    await recordSiteEvent({
      sessionId,
      userId: userId ?? null,
      eventName,
      props,
      path,
      country: geo.country,
      deviceType,
    });
  } catch (err) {
    console.error("[Analytics] /event error:", err);
  }
});

export default router;
