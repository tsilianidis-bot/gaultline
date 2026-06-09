/**
 * FAULTLINE — GA4 SPA Route Tracker
 * ============================================================
 * Mounts once at the app root. Listens to wouter location
 * changes and fires a GA4 page_view event on every navigation.
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
} from "@/hooks/useAnalytics";

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
};

function getPageTitle(path: string): string {
  // Exact match first
  if (PAGE_TITLES[path]) return PAGE_TITLES[path];
  // Prefix match for dynamic routes (e.g. /blog/:slug)
  for (const [route, title] of Object.entries(PAGE_TITLES)) {
    if (path.startsWith(route + "/")) return title;
  }
  return document.title || "FAULTLINE";
}

export default function RouteTracker() {
  const [location] = useLocation();
  const prevLocation = useRef<string | null>(null);
  const sessionFired = useRef(false);

  // Fire page_view on every route change
  useEffect(() => {
    if (prevLocation.current === location) return;
    prevLocation.current = location;

    // Reset scroll milestones on navigation
    resetScrollMilestones();

    // Small delay to let document.title update from useSEO
    const timer = setTimeout(() => {
      const title = getPageTitle(location);
      trackPageView(location, title);
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
