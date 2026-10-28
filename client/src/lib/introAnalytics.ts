import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  getConsentChoice,
  type ConsentChoice,
} from "@/lib/analyticsConsent";
import { GA4_READY_EVENT, trackGa4Event } from "@/lib/ga4";

const MAX_PENDING_EVENTS = 32;

export type IntroAnalyticsEvent =
  | "intro_impression"
  | "intro_completed"
  | "intro_skipped"
  | "intro_replay"
  | "intro_failed";

export type IntroMode = "first_visit" | "replay";

type IntroAnalyticsDetails = {
  mode: IntroMode;
  reason?: string;
  elapsed_seconds?: number;
  muted?: boolean;
  source?: "desktop" | "mobile" | "none";
};

type PendingIntroEvent = {
  eventName: IntroAnalyticsEvent;
  details: IntroAnalyticsDetails;
};

let pendingEvents: PendingIntroEvent[] = [];
let listenersInstalled = false;
let flushing = false;

function getCurrentConsent(): ConsentChoice {
  try {
    return getConsentChoice();
  } catch {
    return null;
  }
}

function dispatchIntroEvent(eventName: IntroAnalyticsEvent, details: IntroAnalyticsDetails): boolean {
  try {
    return trackGa4Event(eventName, details);
  } catch {
    return false;
  }
}

function clearPendingEvents(): void {
  pendingEvents = [];
}

function flushPendingEvents(): void {
  if (flushing || pendingEvents.length === 0) return;

  const consent = getCurrentConsent();
  if (consent !== "accepted") {
    if (consent === "declined") clearPendingEvents();
    return;
  }

  flushing = true;
  const eventsToFlush = pendingEvents;
  pendingEvents = [];

  try {
    for (const pendingEvent of eventsToFlush) {
      const currentConsent = getCurrentConsent();
      if (currentConsent !== "accepted") {
        if (currentConsent === "declined") clearPendingEvents();
        break;
      }

      // GA4 has its own readiness and consent guard. A false result means the
      // runtime is unavailable or blocked, so do not create a retry queue.
      if (!dispatchIntroEvent(pendingEvent.eventName, pendingEvent.details)) continue;
    }
  } finally {
    flushing = false;
  }
}

function handleConsentChange(): void {
  const consent = getCurrentConsent();
  if (consent === "declined") {
    clearPendingEvents();
    return;
  }

  if (consent === "accepted") flushPendingEvents();
}

function handleGa4Ready(): void {
  const consent = getCurrentConsent();
  if (consent === "declined") {
    clearPendingEvents();
    return;
  }

  if (consent === "accepted") flushPendingEvents();
}

function installListeners(): void {
  if (listenersInstalled || typeof window === "undefined") return;

  listenersInstalled = true;
  try {
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, handleConsentChange);
    window.addEventListener(GA4_READY_EVENT, handleGa4Ready);
  } catch {
    // Analytics must never interrupt the intro if event listeners are unavailable.
  }
}

function snapshotDetails(details: IntroAnalyticsDetails): IntroAnalyticsDetails {
  return {
    mode: details.mode,
    ...(details.reason === undefined ? {} : { reason: details.reason }),
    ...(details.elapsed_seconds === undefined
      ? {}
      : { elapsed_seconds: details.elapsed_seconds }),
    ...(details.muted === undefined ? {} : { muted: details.muted }),
    ...(details.source === undefined ? {} : { source: details.source }),
  };
}

function queuePendingEvent(eventName: IntroAnalyticsEvent, details: IntroAnalyticsDetails): void {
  if (pendingEvents.length === MAX_PENDING_EVENTS) pendingEvents.shift();
  pendingEvents.push({ eventName, details: snapshotDetails(details) });
}

export function trackIntroEvent(
  eventName: IntroAnalyticsEvent,
  details: {
    mode: IntroMode;
    reason?: string;
    elapsed_seconds?: number;
    muted?: boolean;
    source?: "desktop" | "mobile" | "none";
  },
): void {
  try {
    installListeners();

    const consent = getCurrentConsent();
    if (consent === "declined") {
      clearPendingEvents();
      return;
    }

    if (consent === "accepted") {
      flushPendingEvents();
      if (!dispatchIntroEvent(eventName, details)) return;
      return;
    }

    queuePendingEvent(eventName, details);
  } catch {
    // Intro controls must remain responsive if analytics is unavailable.
  }
}
