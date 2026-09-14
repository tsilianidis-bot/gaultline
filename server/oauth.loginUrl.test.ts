import { describe, expect, it } from "vitest";
import { buildLoginUrl, getLoginUrl, isValidAbsoluteUrl } from "../client/src/const";

const PORTAL = "https://manus.im";
const APP_ID = "Xbzsed6coyZiRmSu4UeiVi";
const ORIGIN = "https://staging.example.com";

describe("client login URL bootstrap", () => {
  it("does not throw Invalid URL when the OAuth portal or app id is missing", () => {
    expect(() => buildLoginUrl(undefined, undefined, ORIGIN)).not.toThrow();
    expect(() => buildLoginUrl("undefined", APP_ID, ORIGIN)).not.toThrow();
    expect(buildLoginUrl(undefined, APP_ID, ORIGIN)).toBe("");
    expect(buildLoginUrl(`${undefined}/app-auth`, APP_ID, ORIGIN)).toBe("");
    expect(buildLoginUrl("", APP_ID, ORIGIN)).toBe("");
    expect(buildLoginUrl("   ", APP_ID, ORIGIN)).toBe("");
    expect(buildLoginUrl("not-a-url", APP_ID, ORIGIN)).toBe("");
    expect(buildLoginUrl("/oauth", APP_ID, ORIGIN)).toBe("");
    expect(buildLoginUrl(PORTAL, undefined, ORIGIN)).toBe("");
    expect(buildLoginUrl(PORTAL, "", ORIGIN)).toBe("");
    expect(buildLoginUrl(PORTAL, "  ", ORIGIN)).toBe("");
  });

  it("constructs the production app-auth URL only for a valid absolute portal and app id", () => {
    const loginUrl = buildLoginUrl(PORTAL, APP_ID, ORIGIN);
    const parsed = new URL(loginUrl);
    const redirectUri = `${ORIGIN}/api/oauth/callback`;

    expect(parsed.origin + parsed.pathname).toBe("https://manus.im/app-auth");
    expect(parsed.searchParams.get("appId")).toBe(APP_ID);
    expect(parsed.searchParams.get("redirectUri")).toBe(redirectUri);
    expect(parsed.searchParams.get("state")).toBe(btoa(redirectUri));
    expect(parsed.searchParams.get("type")).toBe("signIn");
  });

  it("treats only http(s) absolute URLs as a usable OAuth portal", () => {
    expect(isValidAbsoluteUrl("https://manus.im")).toBe(true);
    expect(isValidAbsoluteUrl("http://localhost:3000")).toBe(true);
    expect(isValidAbsoluteUrl(undefined)).toBe(false);
    expect(isValidAbsoluteUrl("undefined/app-auth")).toBe(false);
  });

  it("getLoginUrl does not throw when Vite OAuth env is unset", () => {
    expect(() => getLoginUrl()).not.toThrow();
    expect(typeof getLoginUrl()).toBe("string");
  });
});
