/**
 * GA4 Event Tracking Helper
 *
 * Wraps window.gtag() with a safety check so calls are silently
 * ignored when the GA4 script hasn't loaded (e.g. ad-blockers, SSR).
 *
 * Usage:
 *   import { trackEvent } from "@/lib/analytics";
 *   trackEvent("start_free_clicked", { location: "homepage_hero" });
 */

/** All recognised FAULTLINE GA4 event names */
export type FaultlineEvent =
  | "start_free_clicked"
  | "demo_started"
  | "signup_started"
  | "signup_completed"
  | "pricing_viewed"
  | "stripe_checkout_started"
  | "purchase"
  | "stock_signal_viewed"
  | "crypto_signal_viewed"
  | "situation_room_used"
  | "chatbot_opened"
  | "chatbot_message_sent"
  | "chatbot_signup_clicked"
  | "chatbot_pricing_clicked"
  | "chatbot_upgrade_clicked"
  | "chatbot_lead_captured";

/** Generic param map — GA4 accepts any string/number/boolean values */
export type EventParams = Record<string, string | number | boolean | undefined>;

/**
 * Fire a GA4 custom event.
 * Silently no-ops if gtag is unavailable (blocked, not loaded, etc.).
 */
export function trackEvent(eventName: FaultlineEvent, params?: EventParams): void {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", eventName, params ?? {});
    }
  } catch {
    // Never let analytics errors bubble up and break the UI
  }
}

/**
 * Convenience: fire the GA4 `purchase` event in the standard e-commerce schema.
 * GA4 requires `transaction_id`, `value`, and `currency` at the top level.
 */
export function trackPurchase(opts: {
  transactionId: string;
  value: number;
  currency?: string;
  plan: string;
}): void {
  trackEvent("purchase", {
    transaction_id: opts.transactionId,
    value: opts.value,
    currency: opts.currency ?? "USD",
    plan: opts.plan,
  });
}
