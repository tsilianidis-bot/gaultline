import { afterEach, describe, expect, it, vi } from "vitest";
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
