export const ANALYTICS_CONSENT_STORAGE_KEY = "faultline_cookie_consent_v2";
export const ANALYTICS_CONSENT_CHANGED_EVENT = "faultline:analytics-consent-changed";

const LEGACY_STORAGE_KEY = "faultline_cookie_consent";

export type ConsentChoice = "accepted" | "declined" | null;

export function getConsentChoice(): ConsentChoice {
  if (typeof window === "undefined") return null;

  try {
    const current = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    if (current === "accepted" || current === "declined") return current;

    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === "accepted" || legacy === "declined") {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, legacy);
      return legacy;
    }
  } catch {
    // Storage can be unavailable in hardened browsers. Treat that as no consent.
  }

  return null;
}

export function setConsentChoice(choice: Exclude<ConsentChoice, null>): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice);
  } catch {
    // The in-page event still lets the current session honor the visitor's choice.
  }

  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
}
