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

  it("scrubs prefixed credential fields through nested cyclic arrays while retaining safe metadata", () => {
    const nestedValues: unknown[] = [];
    const nestedObject: Record<string, unknown> = {
      STRIPE_SECRET_KEY: "fixture-not-a-real-credential",
      FRED_API_KEY: "fixture-not-a-real-credential",
      sendgridApiKey: "fixture-not-a-real-credential",
      SENTRY_DSN: "fixture-not-a-real-credential",
      JWT_SECRET: "fixture-not-a-real-credential",
      sessionToken: "fixture-not-a-real-credential",
      tokenCount: 2,
      secretCount: 1,
      priceId: "price_fixture_123",
      shape: "retained-shape",
      SDKtype: "synthetic-sdk",
      eventMetadata: { eventType: "synthetic" },
    };
    const event: Record<string, unknown> = {
      SDKtype: "synthetic-sdk",
      tokenCount: 3,
      secretCount: 2,
      priceId: "price_fixture_456",
      shape: { kind: "synthetic" },
      extra: { nestedValues },
    };
    nestedObject.parentEvent = event;
    nestedValues.push(nestedObject, nestedValues);

    expect(scrubSentryEvent(event)).toBe(event);
    expect(nestedObject).not.toHaveProperty("STRIPE_SECRET_KEY");
    expect(nestedObject).not.toHaveProperty("FRED_API_KEY");
    expect(nestedObject).not.toHaveProperty("sendgridApiKey");
    expect(nestedObject).not.toHaveProperty("SENTRY_DSN");
    expect(nestedObject).not.toHaveProperty("JWT_SECRET");
    expect(nestedObject).not.toHaveProperty("sessionToken");
    expect(nestedObject).toMatchObject({
      tokenCount: 2,
      secretCount: 1,
      priceId: "price_fixture_123",
      shape: "retained-shape",
      SDKtype: "synthetic-sdk",
      eventMetadata: { eventType: "synthetic" },
    });
    expect(event).toMatchObject({
      SDKtype: "synthetic-sdk",
      tokenCount: 3,
      secretCount: 2,
      priceId: "price_fixture_456",
      shape: { kind: "synthetic" },
    });
    expect(nestedValues[1]).toBe(nestedValues);
    expect(nestedObject.parentEvent).toBe(event);
  });
});
