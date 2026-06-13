/**
 * FAULTLINE — GA4 Analytics Hook
 * ============================================================
 * Provides typed wrappers around window.gtag for:
 *  - SPA page_view tracking (wouter route changes)
 *  - session_start / user_engagement
 *  - Conversion events: signup, login, upgrade, trial_start
 *  - Feature events: watchlist, signal_search, preflight_launch
 *  - Scroll depth tracking
 *  - Outbound click tracking
 * ============================================================
 */

const GA_ID = "G-YLJ9EQZK7P";

// ── Type-safe gtag wrapper ────────────────────────────────────
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag(...args);
  } else {
    // Fallback: push to dataLayer directly
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(args);
  }
}

// ── Page view (SPA route change) ─────────────────────────────
export function trackPageView(path: string, title?: string) {
  gtag("event", "page_view", {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
    send_to: GA_ID,
  });
}

// ── Session / engagement ──────────────────────────────────────
export function trackSessionStart() {
  gtag("event", "session_start", { send_to: GA_ID });
}

export function trackUserEngagement(engagementTimeSec: number) {
  gtag("event", "user_engagement", {
    engagement_time_msec: engagementTimeSec * 1000,
    send_to: GA_ID,
  });
}

// ── Auth events ───────────────────────────────────────────────
export function trackLogin(method: string = "manus_oauth") {
  gtag("event", "login", {
    method,
    send_to: GA_ID,
  });
}

export function trackSignup(method: string = "manus_oauth") {
  gtag("event", "sign_up", {
    method,
    send_to: GA_ID,
  });
}

// ── Conversion / monetisation events ─────────────────────────
export function trackUpgradeClick(plan: string, location: string) {
  gtag("event", "begin_checkout", {
    currency: "USD",
    value: plan === "founding" ? PRICING_PLANS.founding.amountCents / 100 : plan === "premium" ? PRICING_PLANS.premium.amountCents / 100 : PRICING_PLANS.core.amountCents / 100,
    items: [{ item_id: plan, item_name: `FAULTLINE ${plan}` }],
    event_category: "conversion",
    event_label: location,
    send_to: GA_ID,
  });
}

export function trackTrialStart(plan: string) {
  gtag("event", "trial_start", {
    plan,
    event_category: "conversion",
    send_to: GA_ID,
  });
}

export function trackPurchase(plan: string, value: number, transactionId: string) {
  gtag("event", "purchase", {
    transaction_id: transactionId,
    currency: "USD",
    value,
    items: [{ item_id: plan, item_name: `FAULTLINE ${plan}` }],
    send_to: GA_ID,
  });
}

// ── Feature usage events ──────────────────────────────────────
export function trackWatchlistAction(action: "add" | "remove", ticker: string) {
  gtag("event", "watchlist_action", {
    action,
    ticker,
    event_category: "feature",
    send_to: GA_ID,
  });
}

export function trackSignalSearch(ticker: string) {
  gtag("event", "signal_search", {
    search_term: ticker,
    event_category: "feature",
    send_to: GA_ID,
  });
}

export function trackPreflightLaunch() {
  gtag("event", "preflight_launch", {
    event_category: "feature",
    send_to: GA_ID,
  });
}

export function trackSituationRoomUse(moveType: string, timeframe: string) {
  gtag("event", "situation_room_simulate", {
    move_type: moveType,
    timeframe,
    event_category: "feature",
    send_to: GA_ID,
  });
}

export function trackInsiderSearch(ticker: string) {
  gtag("event", "insider_search", {
    search_term: ticker,
    event_category: "feature",
    send_to: GA_ID,
  });
}

export function trackCryptoSearch(symbol: string) {
  gtag("event", "crypto_search", {
    search_term: symbol,
    event_category: "feature",
    send_to: GA_ID,
  });
}

export function trackPortfolioAction(action: "add" | "edit" | "delete") {
  gtag("event", "portfolio_action", {
    action,
    event_category: "feature",
    send_to: GA_ID,
  });
}

export function trackAlertView() {
  gtag("event", "alerts_viewed", {
    event_category: "feature",
    send_to: GA_ID,
  });
}

export function trackDailyReportView() {
  gtag("event", "daily_report_viewed", {
    event_category: "feature",
    send_to: GA_ID,
  });
}

// ── Scroll depth tracking ─────────────────────────────────────
const scrollMilestones = new Set<number>();

export function trackScrollDepth(percentage: number) {
  const milestone = Math.floor(percentage / 25) * 25; // 25, 50, 75, 100
  if (milestone > 0 && !scrollMilestones.has(milestone)) {
    scrollMilestones.add(milestone);
    gtag("event", "scroll", {
      percent_scrolled: milestone,
      event_category: "engagement",
      send_to: GA_ID,
    });
  }
}

export function resetScrollMilestones() {
  scrollMilestones.clear();
}

// ── Outbound click tracking ───────────────────────────────────
export function trackOutboundClick(url: string, label?: string) {
  gtag("event", "click", {
    event_category: "outbound",
    event_label: label || url,
    transport_type: "beacon",
    send_to: GA_ID,
  });
}

// ── Generic custom event ──────────────────────────────────────
export function trackEvent(
  eventName: string,
  params: Record<string, unknown> = {}
) {
  gtag("event", eventName, { ...params, send_to: GA_ID });
}import { PRICING_PLANS } from "../../../shared/tiers";

