import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const consent = vi.hoisted(() => ({ choice: "accepted" as "accepted" | "declined" | null }));
vi.mock("../client/src/lib/analyticsConsent", () => ({
  ANALYTICS_CONSENT_CHANGED_EVENT: "faultline:analytics-consent-changed",
  getConsentChoice: () => consent.choice,
}));

type FakeScript = { id: string; async: boolean; src: string; onerror?: () => void; remove: () => void };
let scripts: Map<string, FakeScript>;
let appended: FakeScript[];

beforeEach(() => {
  vi.resetModules();
  consent.choice = "accepted";
  scripts = new Map();
  appended = [];
  vi.stubGlobal("window", {
    addEventListener: vi.fn(), dispatchEvent: vi.fn(),
    location: { hostname: "getfaultline.live", origin: "https://getfaultline.live", href: "https://getfaultline.live/" },
    gtag: vi.fn(), dataLayer: [],
  });
  vi.stubGlobal("document", {
    getElementById: (id: string) => scripts.get(id) ?? null,
    createElement: () => {
      const script: FakeScript = { id: "", async: false, src: "", remove: () => { scripts.delete(script.id); } };
      return script;
    },
    head: { appendChild: (script: FakeScript) => { scripts.set(script.id, script); appended.push(script); } },
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("consented GA4 loader recovery", () => {
  it("removes a failed download and allows a fresh consented initialization", async () => {
    const { initializeAnalytics } = await import("../client/src/lib/ga4");
    expect(initializeAnalytics()).toBe(true);
    const first = scripts.get("faultline-ga4-script")!;
    expect(first.onerror).toBeTypeOf("function");
    first.onerror!();
    expect(scripts.has("faultline-ga4-script")).toBe(false);
    expect(initializeAnalytics()).toBe(true);
    expect(scripts.get("faultline-ga4-script")).not.toBe(first);
    expect(appended.filter(script => script.id === "faultline-ga4-script")).toHaveLength(2);
  });

  it("does not retry or load analytics after consent is declined", async () => {
    const { initializeAnalytics } = await import("../client/src/lib/ga4");
    initializeAnalytics();
    scripts.get("faultline-ga4-script")!.onerror!();
    consent.choice = "declined";
    expect(initializeAnalytics()).toBe(false);
    expect(scripts.has("faultline-ga4-script")).toBe(false);
    expect(appended.filter(script => script.id === "faultline-ga4-script")).toHaveLength(1);
  });
});
