import { describe, expect, it } from "vitest";
import { POST_LOGIN_RETURN_TTL_MS, decodeReturnPath, encodeReturnPath, sanitizeReturnPath } from "../../shared/checkoutReturn";

describe("checkout return destination (signed-out success page)", () => {
  it("keeps the checkout success path with its query string", () => {
    const p = "/checkout/success?session_id=cs_test_abc&plan=premium";
    expect(sanitizeReturnPath(p)).toBe(p);
  });

  it.each([
    "https://evil.example/checkout/success",
    "//evil.example/checkout/success",
    "/\\evil.example",
    "/app/account",
    "/checkout/successful",
    "checkout/success",
    "/checkout/success\n?x=1",
    "",
    "/" + "a".repeat(600),
  ])("rejects unsafe or non-allowlisted destination %j", (p) => {
    expect(sanitizeReturnPath(p)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(sanitizeReturnPath(undefined)).toBeNull();
    expect(sanitizeReturnPath({ path: "/checkout/success" })).toBeNull();
  });

  it("round-trips within the TTL and expires afterwards", () => {
    const now = 1_700_000_000_000;
    const entry = encodeReturnPath("/checkout/success?session_id=cs_1", now)!;
    expect(decodeReturnPath(entry, now + 1000)).toBe("/checkout/success?session_id=cs_1");
    expect(decodeReturnPath(entry, now + POST_LOGIN_RETURN_TTL_MS + 1)).toBeNull();
  });

  it("refuses to store or restore an unsafe path (tampered storage)", () => {
    expect(encodeReturnPath("https://evil.example")).toBeNull();
    expect(decodeReturnPath(JSON.stringify({ path: "https://evil.example", at: Date.now() }))).toBeNull();
    expect(decodeReturnPath("not json")).toBeNull();
    expect(decodeReturnPath(null)).toBeNull();
  });
});
