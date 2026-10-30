import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildLoginUrl,
  getLoginUrl,
  handleLoginCtaClick,
  isValidAbsoluteUrl,
  navigateToLogin,
} from "../client/src/const";

const PORTAL = "https://manus.im";
const APP_ID = "Xbzsed6coyZiRmSu4UeiVi";
const ORIGIN = "https://staging.example.com";

describe("client login URL bootstrap", () => {
  it("does not throw when the OAuth portal or app id is missing", () => {
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

  it("navigates only to the local server initiator when OAuth is configured", () => {
    const loginUrl = buildLoginUrl(PORTAL, APP_ID, ORIGIN);

    expect(loginUrl).toBe("/api/oauth/login");
    expect(loginUrl).not.toContain("state=");
    expect(loginUrl).not.toContain("redirectUri=");
    expect(loginUrl).not.toContain("manus.im");
  });

  it("never derives OAuth state from a browser origin", () => {
    const production = buildLoginUrl(PORTAL, APP_ID, "https://getfaultline.live");
    const www = buildLoginUrl(PORTAL, APP_ID, "https://www.getfaultline.live");
    const staging = buildLoginUrl(PORTAL, APP_ID, ORIGIN);

    expect(production).toBe("/api/oauth/login");
    expect(www).toBe("/api/oauth/login");
    expect(staging).toBe("/api/oauth/login");
  });

  it("treats only http(s) absolute URLs as a usable OAuth portal", () => {
    expect(isValidAbsoluteUrl("https://manus.im")).toBe(true);
    expect(isValidAbsoluteUrl("http://localhost:3000")).toBe(true);
    expect(isValidAbsoluteUrl(undefined)).toBe(false);
    expect(isValidAbsoluteUrl("undefined/app-auth")).toBe(false);
  });

  it("getLoginUrl is empty when Vite OAuth env is unset", () => {
    expect(() => getLoginUrl()).not.toThrow();
    expect(getLoginUrl()).toBe("");
    expect(getLoginUrl()).not.toContain("manus.im");
    expect(getLoginUrl()).not.toContain("api.manus.im");
  });

  it("navigateToLogin and login CTAs do not navigate when Vite OAuth is absent", () => {
    const location = {
      href: "https://staging.example.com/app",
      origin: "https://staging.example.com",
    };
    vi.stubGlobal("window", { location });

    expect(getLoginUrl()).toBe("");
    navigateToLogin();
    expect(location.href).toBe("https://staging.example.com/app");
    expect(location.href).not.toContain("manus.im");

    const prevented: boolean[] = [];
    handleLoginCtaClick({ preventDefault: () => prevented.push(true) });
    expect(prevented).toEqual([true]);
    expect(location.href).toBe("https://staging.example.com/app");

    vi.unstubAllGlobals();
  });

  it("login CTAs bind getLoginUrl/navigateToLogin and do not hardcode a portal host", () => {
    const root = resolve(process.cwd(), "client/src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(full)) files.push(full);
      }
    };
    walk(root);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/https:\/\/api\.manus\.im/);
      expect(source, file).not.toMatch(/https:\/\/manus\.im\/app-auth/);
      expect(source, file).not.toContain("window.location.href = getLoginUrl()");
    }
  });
});
