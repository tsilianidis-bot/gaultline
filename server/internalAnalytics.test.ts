import { describe, expect, it, vi } from "vitest";
import {
  queueInternalPageView,
  type InternalPageView,
} from "../client/src/lib/internalAnalytics";

const pageView: InternalPageView = {
  sessionId: "session-1",
  visitorId: "visitor-1",
  path: "/app/outlook",
  title: "FAULTLINE — OUTLOOK",
  screenWidth: 1280,
};

describe("queueInternalPageView", () => {
  it("uses sendBeacon first so route changes do not abort analytics requests", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn();

    const transport = queueInternalPageView(pageView, {
      sendBeacon,
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(transport).toBe("beacon");
    expect(sendBeacon).toHaveBeenCalledOnce();
    expect(sendBeacon.mock.calls[0][0]).toBe("/api/analytics/pageview");
    expect(sendBeacon.mock.calls[0][1]).toBeInstanceOf(Blob);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to a keepalive fetch when a beacon cannot be queued", () => {
    const sendBeacon = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn().mockRejectedValue(new Error("navigation interrupted"));

    const transport = queueInternalPageView(pageView, {
      sendBeacon,
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(transport).toBe("fetch");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/pageview",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });
});
