import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import { sdk } from "./sdk";

describe("verifySession unauthenticated path", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null without warning when the session cookie is absent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(sdk.verifySession(undefined)).resolves.toBeNull();
    await expect(sdk.verifySession(null)).resolves.toBeNull();
    await expect(sdk.verifySession("")).resolves.toBeNull();

    expect(warn.mock.calls.map(call => String(call[0]))).not.toContain(
      "[Auth] Missing session cookie",
    );
  });

  it("still warns when a cookie is present but verification fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(sdk.verifySession("not-a-jwt")).resolves.toBeNull();

    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain("[Auth] Session verification failed");
  });
});


describe("session profile name", () => {
  it("accepts a signed session with an empty optional display name", async () => {
    const prior = { appId: ENV.appId, cookieSecret: ENV.cookieSecret };
    Object.assign(ENV, { appId: "session-test-app", cookieSecret: "test-session-secret-only" });
    try {
      const token = await sdk.createSessionToken("authenticated-open-id");
      await expect(sdk.verifySession(token)).resolves.toEqual({
        openId: "authenticated-open-id", appId: "session-test-app", name: "",
      });
      for (const payload of [
        { openId: "", appId: ENV.appId, name: "" },
        { openId: "authenticated-open-id", appId: "", name: "" },
        { openId: "authenticated-open-id", appId: ENV.appId, name: 123 },
      ]) {
        const malformed = await sdk.signSession(payload as any);
        await expect(sdk.verifySession(malformed)).resolves.toBeNull();
      }
      const tampered = token.slice(0, -5) + "aaaaa";
      await expect(sdk.verifySession(tampered)).resolves.toBeNull();
      const expired = await sdk.createSessionToken("authenticated-open-id", { expiresInMs: -5000 });
      await expect(sdk.verifySession(expired)).resolves.toBeNull();
    } finally {
      Object.assign(ENV, prior);
    }
  });
});
