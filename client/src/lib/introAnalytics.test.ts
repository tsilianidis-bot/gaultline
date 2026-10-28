import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const analyticsState = vi.hoisted(() => ({
  consent: null as "accepted" | "declined" | null,
  trackGa4Event: vi.fn<(eventName: string, details: Record<string, unknown>) => boolean>(),
}));

vi.mock("@/lib/analyticsConsent", () => ({
  ANALYTICS_CONSENT_CHANGED_EVENT: "faultline:analytics-consent-changed",
  getConsentChoice: () => analyticsState.consent,
}));

vi.mock("@/lib/ga4", () => ({
  GA4_READY_EVENT: "faultline:ga4-ready",
  trackGa4Event: analyticsState.trackGa4Event,
}));

type TrackIntroEvent = typeof import("./introAnalytics").trackIntroEvent;

let trackIntroEvent: TrackIntroEvent;
let testWindow: EventTarget;
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

function dispatchWindowEvent(eventName: string): void {
  testWindow.dispatchEvent(new Event(eventName));
}

beforeEach(async () => {
  vi.resetModules();
  analyticsState.consent = null;
  analyticsState.trackGa4Event.mockReset();
  analyticsState.trackGa4Event.mockReturnValue(true);

  testWindow = new EventTarget();
  storage = { getItem: vi.fn(), setItem: vi.fn() };
  Object.defineProperty(testWindow, "localStorage", { value: storage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: testWindow,
  });

  ({ trackIntroEvent } = await import("./introAnalytics"));
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("trackIntroEvent", () => {
  it("holds unknown-consent events only in memory without dispatching or using storage", () => {
    trackIntroEvent("intro_impression", {
      mode: "first_visit",
      muted: true,
      source: "desktop",
    });

    expect(analyticsState.trackGa4Event).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("flushes an unknown-consent event exactly once after analytics is accepted", () => {
    const details = { mode: "first_visit" as const, muted: true, source: "desktop" as const };
    trackIntroEvent("intro_impression", details);

    analyticsState.consent = "accepted";
    dispatchWindowEvent("faultline:analytics-consent-changed");
    dispatchWindowEvent("faultline:ga4-ready");
    dispatchWindowEvent("faultline:analytics-consent-changed");

    expect(analyticsState.trackGa4Event).toHaveBeenCalledTimes(1);
    expect(analyticsState.trackGa4Event).toHaveBeenCalledWith("intro_impression", details);
  });

  it("discards queued events on declined consent and never later flushes them", () => {
    trackIntroEvent("intro_skipped", {
      mode: "first_visit",
      reason: "visitor_skip",
      elapsed_seconds: 3,
    });

    analyticsState.consent = "declined";
    dispatchWindowEvent("faultline:analytics-consent-changed");
    analyticsState.consent = "accepted";
    dispatchWindowEvent("faultline:analytics-consent-changed");
    dispatchWindowEvent("faultline:ga4-ready");

    expect(analyticsState.trackGa4Event).not.toHaveBeenCalled();
  });

  it("dispatches directly when analytics consent is already accepted", () => {
    analyticsState.consent = "accepted";

    trackIntroEvent("intro_replay", {
      mode: "replay",
      source: "mobile",
    });

    expect(analyticsState.trackGa4Event).toHaveBeenCalledTimes(1);
    expect(analyticsState.trackGa4Event).toHaveBeenCalledWith("intro_replay", {
      mode: "replay",
      source: "mobile",
    });
  });

  it("bounds the unknown-consent queue at 32 events", () => {
    for (let index = 0; index < 34; index += 1) {
      trackIntroEvent("intro_failed", {
        mode: "first_visit",
        reason: `failure_${index}`,
      });
    }

    analyticsState.consent = "accepted";
    dispatchWindowEvent("faultline:analytics-consent-changed");

    expect(analyticsState.trackGa4Event).toHaveBeenCalledTimes(32);
    expect(analyticsState.trackGa4Event.mock.calls[0]).toEqual([
      "intro_failed",
      { mode: "first_visit", reason: "failure_2" },
    ]);
    expect(analyticsState.trackGa4Event.mock.calls[31]).toEqual([
      "intro_failed",
      { mode: "first_visit", reason: "failure_33" },
    ]);
  });

  it("does not throw or retry failed accepted-consent dispatches", () => {
    analyticsState.consent = "accepted";
    analyticsState.trackGa4Event.mockReturnValue(false);

    expect(() => {
      trackIntroEvent("intro_completed", {
        mode: "first_visit",
        elapsed_seconds: 18,
      });
    }).not.toThrow();

    dispatchWindowEvent("faultline:ga4-ready");
    expect(analyticsState.trackGa4Event).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate queued events when GA4 ready fires during a flush", () => {
    trackIntroEvent("intro_impression", { mode: "first_visit", muted: true });
    trackIntroEvent("intro_completed", { mode: "first_visit", elapsed_seconds: 18 });
    analyticsState.trackGa4Event.mockImplementation(() => {
      dispatchWindowEvent("faultline:ga4-ready");
      return true;
    });

    analyticsState.consent = "accepted";
    dispatchWindowEvent("faultline:analytics-consent-changed");

    expect(analyticsState.trackGa4Event).toHaveBeenCalledTimes(2);
    expect(analyticsState.trackGa4Event.mock.calls).toEqual([
      ["intro_impression", { mode: "first_visit", muted: true }],
      ["intro_completed", { mode: "first_visit", elapsed_seconds: 18 }],
    ]);
  });
});
