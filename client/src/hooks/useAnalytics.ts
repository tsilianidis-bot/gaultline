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
 *  - FAULTLINE key events (start_free_clicked, demo_started,
 *    signup_started, signup_completed, pricing_viewed,
 *    stripe_checkout_started, purchase,
 *    stock_signal_viewed, crypto_signal_viewed, situation_room_used)
 * ============================================================
 */
import { PRICING_PLANS } from "../../../shared/tiers";

const GA_ID = "G-YLJ9EQZK7P";

// ── Type-safe gtag wrapper ────────────────────────────────────

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
    value: plan === "lifetime" ? (PRICING_PLANS.lifetime?.amountCents ?? 29900) / 100
         : plan === "founding" ? PRICING_PLANS.founding.amountCents / 100
         : plan === "premium" ? PRICING_PLANS.premium.amountCents / 100
         : PRICING_PLANS.core.amountCents / 100,
    items: [{ item_id: plan, item_name: plan === "premium" ? "FAULTLINE Trader" : plan === "lifetime" ? "FAULTLINE Founding Lifetime" : `FAULTLINE ${plan}` }],
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
}

// ═══════════════════════════════════════════════════════════════
// FAULTLINE KEY EVENTS (mark these as key events in GA4 Admin)
// ═══════════════════════════════════════════════════════════════

/** 1. Homepage hero CTA clicked */
export function trackStartFreeClicked(location: "homepage_hero" | "homepage_nav" | "homepage_section" | "public_landing" | "public_landing_hero" | "public_landing_bottom" = "homepage_hero") {
  gtag("event", "start_free_clicked", { location, send_to: GA_ID });
}

/** 2. Demo CTA clicked */
export function trackDemoStarted(location: "homepage_or_nav" | "homepage_hero" | "nav" | "section" = "homepage_or_nav") {
  gtag("event", "demo_started", { location, send_to: GA_ID });
}

/** 3. Signup started — user clicks login/signup CTA before OAuth redirect */
export function trackSignupStarted(source: "landing_page" | "premium_gate" | "nav" | "app" = "landing_page") {
  gtag("event", "signup_started", { source, send_to: GA_ID });
}

/** 4. Signup completed — user authenticated for the first time (createdAt within 60s) */
export function trackSignupCompleted(method: "oauth" | "email" = "oauth") {
  gtag("event", "signup_completed", { method, send_to: GA_ID });
}

/** 5. Pricing section viewed */
export function trackPricingViewed(page: "pricing" | "marketing_site" = "pricing") {
  gtag("event", "pricing_viewed", { page, send_to: GA_ID });
}

/** 6. Stripe checkout button clicked (before redirect) */
export function trackStripeCheckoutStarted(opts: { plan: string; price: number; currency?: string }) {
  gtag("event", "stripe_checkout_started", {
    plan: opts.plan,
    price: opts.price,
    currency: opts.currency ?? "USD",
    send_to: GA_ID,
  });
}

/** 7. Purchase confirmed — fired on /checkout/success after Stripe confirms */
export function trackPurchaseConfirmed(opts: { transactionId: string; value: number; currency?: string; plan: string }) {
  gtag("event", "purchase", {
    transaction_id: opts.transactionId,
    value: opts.value,
    currency: opts.currency ?? "USD",
    plan: opts.plan,
    send_to: GA_ID,
  });
}

/** 8. Stock signal card expanded/viewed */
export function trackStockSignalViewed(ticker: string, timeframe: string = "daily") {
  gtag("event", "stock_signal_viewed", {
    ticker: ticker.toUpperCase(),
    timeframe,
    send_to: GA_ID,
  });
}

/** 9. Crypto signal card expanded/viewed */
export function trackCryptoSignalViewed(symbol: string, timeframe: string = "daily") {
  gtag("event", "crypto_signal_viewed", {
    symbol: symbol.toUpperCase(),
    timeframe,
    send_to: GA_ID,
  });
}

/** 10. Situation Room analysis run */
export function trackSituationRoomUsed(opts: { assetType: "stock" | "crypto" | "etf" | "other"; tickerOrSymbol: string; timeframe: string }) {
  gtag("event", "situation_room_used", {
    asset_type: opts.assetType,
    ticker_or_symbol: opts.tickerOrSymbol.toUpperCase(),
    timeframe: opts.timeframe,
    send_to: GA_ID,
  });
}

