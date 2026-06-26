/**
 * FAULTLINE — SPA Route Tracker
 * ============================================================
 * Mounts once at the app root. Listens to wouter location
 * changes and:
 *  1. Fires a GA4 page_view event on every navigation.
 *  2. POSTs to /api/analytics/pageview to populate the
 *     internal FAULTLINE Analytics Dashboard.
 * Also fires session_start on first mount and sets up scroll
 * depth tracking.
 * ============================================================
 */
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  trackPageView,
  trackScrollDepth,
  resetScrollMilestones,
  trackSignupCompleted,
} from "@/hooks/useAnalytics";
import { getConsentChoice } from "@/components/CookieConsent";
import { useAuth } from "@/_core/hooks/useAuth";

// Map route paths to human-readable page titles for GA4
const PAGE_TITLES: Record<string, string> = {
  "/": "FAULTLINE — Home",
  "/blog": "FAULTLINE — Blog",
  "/legal": "FAULTLINE — Legal",
  "/pressure-index": "FAULTLINE — Pressure Index",
  "/track-record": "FAULTLINE — Track Record",
  "/app": "FAULTLINE — Dashboard",
  "/app/pressure": "FAULTLINE — Market Stress",
  "/app/scores": "FAULTLINE — Risk Score Breakdown",
  "/app/charts": "FAULTLINE — Charts",
  "/app/ai-watch": "FAULTLINE — AI Sector Watch",
  "/app/scenarios": "FAULTLINE — Scenarios",
  "/app/alerts": "FAULTLINE — Alerts",
  "/app/analogs": "FAULTLINE — Historical Comparisons",
  "/app/simulate": "FAULTLINE — Pressure Simulator",
  "/app/report": "FAULTLINE — Daily Market Briefing",
  "/app/watchlist": "FAULTLINE — Watchlist",
  "/app/signals": "FAULTLINE — Stock & Market Signals",
  "/app/crypto-search": "FAULTLINE — Crypto Intelligence",
  "/app/crypto-signals": "FAULTLINE — Crypto Signals",
  "/app/crypto-watchlist": "FAULTLINE — Crypto Watchlist",
  "/app/portfolio": "FAULTLINE — Portfolio",
  "/app/diagnostic": "FAULTLINE — AI Market Explanation",
  "/app/account": "FAULTLINE — Account",
  "/app/track-record": "FAULTLINE — Track Record",
  "/app/blog": "FAULTLINE — Blog",
  "/app/guide": "FAULTLINE — How to Use FAULTLINE",
  "/app/aftershock": "FAULTLINE — Aftershock Engine",
  "/app/alt-rotation": "FAULTLINE — Sector Rotation",
  "/app/reading-history": "FAULTLINE — Reading History",
  "/app/pre-flight": "FAULTLINE — Pre-Flight Market Awareness",
  "/app/situation-room": "FAULTLINE — Situation Room",
  "/app/insider-intelligence": "FAULTLINE — Insider Intelligence",
  "/app/seo-optimizer": "FAULTLINE — SEO Optimizer",
  "/app/stock-heatmap": "FAULTLINE — Stock Heatmap",
  "/app/analytics": "FAULTLINE — Site Analytics",
  "/app/symbol-intelligence": "FAULTLINE — Symbol Intelligence",
  "/app/trade-journal": "FAULTLINE — Trade Journal",
  "/app/glossary": "FAULTLINE Method™ Glossary",
  "/app/day-trade-intelligence": "FAULTLINE — Day Trade Intelligence",
  "/app/opportunities": "FAULTLINE — Opportunities",
};

function getPageTitle(path: string): string {
  if (PAGE_TITLES[path]) return PAGE_TITLES[path];
  for (const [route, title] of Object.entries(PAGE_TITLES)) {
    if (path.startsWith(route + "/")) return title;
  }
  return document.title || "FAULTLINE";
}

// ── Internal analytics session ID ─────────────────────────────────────────────
// Persisted in sessionStorage so it resets on new browser sessions.
function getOrCreateSessionId(): string {
  try {
    const key = "fl_sid";
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return crypto.randomUUID();
  }
}

// ── Stable visitor ID ─────────────────────────────────────────────────────────
// Persisted in localStorage so it survives browser restarts (cross-session).
function getOrCreateVisitorId(): string {
  try {
    const key = "fl_vid";
    let vid = localStorage.getItem(key);
    if (!vid) {
      vid = crypto.randomUUID();
      localStorage.setItem(key, vid);
    }
    return vid;
  } catch {
    return crypto.randomUUID();
  }
}

// ── Parse UTM params from URL ──────────────────────────────────────────────────
function getUtmParams() {
  try {
    const sp = new URLSearchParams(window.location.search);
    return {
      utmSource: sp.get("utm_source") ?? undefined,
      utmMedium: sp.get("utm_medium") ?? undefined,
      utmCampaign: sp.get("utm_campaign") ?? undefined,
    };
  } catch {
    return {};
  }
}

// ── POST to internal analytics endpoint (fire-and-forget) ─────────────────────
function sendInternalPageView(path: string, title: string, userId?: number) {
  // Only track if user has accepted cookies, or hasn't decided yet (default allow)
  const consent = getConsentChoice();
  if (consent === "declined") return;

  const sessionId = getOrCreateSessionId();
  const visitorId = getOrCreateVisitorId();
  const { utmSource, utmMedium, utmCampaign } = getUtmParams();

  fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      visitorId,
      userId,
      path,
      title,
      referrer: document.referrer || undefined,
      utmSource,
      utmMedium,
      utmCampaign,
      screenWidth: window.screen?.width,
    }),
    // keepalive ensures the request completes even if the page navigates away
    keepalive: true,
  }).catch(() => {
    // Silently ignore — analytics must never break the app
  });
}

export default function RouteTracker() {
  const [location] = useLocation();
  const prevLocation = useRef<string | null>(null);
  const sessionFired = useRef(false);
  const signupFired = useRef(false);

  const { user } = useAuth();
  const userId = (user as any)?.id as number | undefined;

  // Detect first-time OAuth signup: createdAt within 60 seconds of now
  useEffect(() => {
    if (signupFired.current) return;
    if (!user) return;
    const createdAt = (user as any)?.createdAt;
    if (!createdAt) return;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    if (ageMs < 60_000) {
      signupFired.current = true;
      trackSignupCompleted("oauth");
    }
  }, [user]);

  // Fire page_view on every route change
  useEffect(() => {
    if (prevLocation.current === location) return;
    prevLocation.current = location;

    // Reset scroll milestones on navigation
    resetScrollMilestones();

    // Small delay to let document.title update from useSEO
    const timer = setTimeout(() => {
      const title = getPageTitle(location);
      // 1. GA4
      trackPageView(location, title);
      // 2. Internal FAULTLINE analytics
      sendInternalPageView(location, title, userId);
    }, 150);

    return () => clearTimeout(timer);
  }, [location]);

  // Fire session_start once per session
  useEffect(() => {
    if (sessionFired.current) return;
    sessionFired.current = true;
    // GA4 auto-tracks session_start natively, but we fire it
    // explicitly to ensure it works in SPA context
  }, []);

  // Scroll depth tracking
  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      if (docHeight <= 0) return;
      const percentage = (scrollTop / docHeight) * 100;
      trackScrollDepth(percentage);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location]); // Re-attach on route change

  return null; // Renders nothing
}
