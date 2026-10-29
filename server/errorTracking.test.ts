import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./errorTracking";

describe("scrubSentryEvent", () => {
  it("removes credential-bearing headers regardless of casing and strips request payloads", () => {
    const event = {
      request: {
        url: "https://example.test/path?access_token=synthetic-test-value",
        headers: {
          Authorization: "Bearer synthetic-test-value",
          COOKIE: "session=synthetic-test-value",
          "X-Api-Key": "synthetic-test-value",
          "content-type": "application/json",
        },
        data: { password: "synthetic-test-value" },
        cookies: { session: "synthetic-test-value" },
        queryString: "access_token=synthetic-test-value",
      },
      contexts: {
        faultline: {
          apiKey: "synthetic-test-value",
          nested: { refreshToken: "synthetic-test-value", retained: "safe" },
        },
      },
    };

    expect(scrubSentryEvent(event)).toBe(event);
    expect(event.request.url).toBe("https://example.test/path");
    expect(event.request.headers).toEqual({ "content-type": "application/json" });
    expect(event.request).not.toHaveProperty("data");
    expect(event.request).not.toHaveProperty("cookies");
    expect(event.request).not.toHaveProperty("queryString");
    expect(event.contexts.faultline).toEqual({ nested: { retained: "safe" } });
  });
});
