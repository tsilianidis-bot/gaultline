/**
 * FAULTLINE Analytics Collector
 * Server-side event collection: pageviews, sessions, custom events.
 * Parses User-Agent, extracts UTM params, geo-locates by IP.
 */

import { Request } from "express";
import { getDb } from "./db";
import { analyticsSessions, pageViews, siteEvents } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ── User-Agent Parsing ────────────────────────────────────────────────────────

export function parseUserAgent(ua: string): {
  browser: string;
  os: string;
  deviceType: string;
} {
  const u = ua.toLowerCase();

  // Browser detection
  let browser = "Other";
  if (u.includes("edg/") || u.includes("edge/")) browser = "Edge";
  else if (u.includes("opr/") || u.includes("opera")) browser = "Opera";
  else if (u.includes("chrome") && !u.includes("chromium")) browser = "Chrome";
  else if (u.includes("firefox")) browser = "Firefox";
  else if (u.includes("safari") && !u.includes("chrome")) browser = "Safari";
  else if (u.includes("msie") || u.includes("trident")) browser = "IE";

  // OS detection
  let os = "Other";
  if (u.includes("windows")) os = "Windows";
  else if (u.includes("iphone") || u.includes("ipad")) os = "iOS";
  else if (u.includes("mac os")) os = "macOS";
  else if (u.includes("android")) os = "Android";
  else if (u.includes("linux")) os = "Linux";

  // Device type
  let deviceType = "desktop";
  if (u.includes("mobile") || u.includes("iphone") || u.includes("android")) {
    deviceType = "mobile";
  } else if (u.includes("ipad") || u.includes("tablet")) {
    deviceType = "tablet";
  }

  return { browser, os, deviceType };
}

// ── IP Geolocation ─────────────────────────────────────────────────────────────

const geoCache = new Map<string, string>();

export async function getCountryFromIp(ip: string): Promise<string> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168") || ip.startsWith("10.")) {
    return "US"; // local dev fallback
  }
  if (geoCache.has(ip)) return geoCache.get(ip)!;
  try {
    const res = await fetch(`https://ip-api.com/json/${ip}?fields=countryCode`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json() as { countryCode?: string };
      const code = data.countryCode ?? "XX";
      geoCache.set(ip, code);
      if (geoCache.size > 5000) {
        const firstKey = geoCache.keys().next().value;
        if (firstKey) geoCache.delete(firstKey);
      }
      return code;
    }
  } catch {
    // silently fail — analytics should never break the app
  }
  return "XX";
}

// ── Extract client IP ─────────────────────────────────────────────────────────

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "127.0.0.1";
}

// ── Session Management ────────────────────────────────────────────────────────

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function upsertSession(params: {
  sessionId: string;
  userId?: number | null;
  path: string;
  country: string;
  deviceType: string;
  browser: string;
  os: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const existing = await db
      .select()
      .from(analyticsSessions)
      .where(eq(analyticsSessions.sessionId, params.sessionId))
      .limit(1);

    const now = new Date();

    if (existing.length === 0) {
      // New session
      await db.insert(analyticsSessions).values({
        sessionId: params.sessionId,
        userId: params.userId ?? null,
        entryPage: params.path,
        exitPage: params.path,
        pageCount: 1,
        durationSecs: 0,
        isBounce: 1,
        country: params.country,
        deviceType: params.deviceType,
        browser: params.browser,
        os: params.os,
        referrer: params.referrer ?? null,
        utmSource: params.utmSource ?? null,
        utmMedium: params.utmMedium ?? null,
        utmCampaign: params.utmCampaign ?? null,
        startedAt: now,
        lastSeenAt: now,
      });
    } else {
      const sess = existing[0];
      const lastSeen = new Date(sess.lastSeenAt).getTime();
      const elapsed = Math.floor((now.getTime() - lastSeen) / 1000);
      const newDuration = sess.durationSecs + Math.min(elapsed, 1800); // cap at 30min
      const newPageCount = sess.pageCount + 1;

      await db
        .update(analyticsSessions)
        .set({
          exitPage: params.path,
          pageCount: newPageCount,
          durationSecs: newDuration,
          isBounce: newPageCount > 1 ? 0 : 1,
          lastSeenAt: now,
          userId: params.userId ?? sess.userId,
        })
        .where(eq(analyticsSessions.sessionId, params.sessionId));
    }
  } catch (err) {
    console.error("[Analytics] Session upsert error:", err);
  }
}

// ── Record Page View ──────────────────────────────────────────────────────────

export async function recordPageView(params: {
  sessionId: string;
  userId?: number | null;
  path: string;
  title?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  country: string;
  deviceType: string;
  browser: string;
  os: string;
  screenWidth?: number;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(pageViews).values({
      sessionId: params.sessionId,
      userId: params.userId ?? null,
      path: params.path,
      title: params.title ?? null,
      referrer: params.referrer ?? null,
      utmSource: params.utmSource ?? null,
      utmMedium: params.utmMedium ?? null,
      utmCampaign: params.utmCampaign ?? null,
      country: params.country,
      deviceType: params.deviceType,
      browser: params.browser,
      os: params.os,
      screenWidth: params.screenWidth ?? null,
    });
  } catch (err) {
    console.error("[Analytics] Pageview insert error:", err);
  }
}

// ── Record Custom Event ───────────────────────────────────────────────────────

export async function recordSiteEvent(params: {
  sessionId: string;
  userId?: number | null;
  eventName: string;
  props?: Record<string, unknown>;
  path?: string;
  country?: string;
  deviceType?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(siteEvents).values({
      sessionId: params.sessionId,
      userId: params.userId ?? null,
      eventName: params.eventName,
      props: params.props ? JSON.stringify(params.props) : null,
      path: params.path ?? null,
      country: params.country ?? null,
      deviceType: params.deviceType ?? null,
    });
  } catch (err) {
    console.error("[Analytics] Event insert error:", err);
  }
}
