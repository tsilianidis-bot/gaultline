import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { navigateToLogin } from "../client/src/const";
import {
  OAUTH_CALLBACK_ERROR_CODES,
  registerOAuthRoutes,
  renderOAuthCallbackFailurePage,
} from "./_core/oauth";
import { COOKIE_NAME } from "@shared/const";

const gateSource = readFileSync(
  resolve(import.meta.dirname, "../client/src/components/CinematicAuthGate.tsx"),
  "utf8",
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("navigateToLogin reports whether a redirect started", () => {
  it("returns false and does not navigate when the portal URL is absent", () => {
    const location = { origin: "https://getfaultline.live", href: "https://getfaultline.live/app" };
    vi.stubGlobal("window", { location });
    expect(navigateToLogin()).toBe(false);
    expect(location.href).toBe("https://getfaultline.live/app");
  });

  it("returns true and navigates to the canonical app-auth URL when configured", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://manus.im");
    vi.stubEnv("VITE_APP_ID", "test-app-id");
    const location = { origin: "https://www.getfaultline.live", href: "https://www.getfaultline.live/app" };
    vi.stubGlobal("window", { location });
    expect(navigateToLogin()).toBe(true);
    const url = new URL(location.href);
    expect(url.origin + url.pathname).toBe("https://manus.im/app-auth");
    expect(url.searchParams.get("redirectUri")).toBe("https://getfaultline.live/api/oauth/callback");
  });
});

describe("CinematicAuthGate never stays in REDIRECTING", () => {
  it("only enters signingIn after navigateToLogin() confirms a redirect", () => {
    const handler = gateSource.slice(gateSource.indexOf("const handleSignIn"), gateSource.indexOf("return (\n"));
    expect(handler).toMatch(/if \(!navigateToLogin\(\)\) \{[\s\S]*setSignInError\(SIGN_IN_UNAVAILABLE_MSG\);[\s\S]*return;[\s\S]*\}\s*setSigningIn\(true\);/);
    expect(handler).toContain('sessionStorage.removeItem("fl_post_auth_asha")');
  });

  it("times out a started redirect back to SIGN IN with an error", () => {
    expect(gateSource).toMatch(/export const SIGN_IN_REDIRECT_TIMEOUT_MS = 15_000;/);
    expect(gateSource).toMatch(/setTimeout\(\(\) => \{\s*setSigningIn\(false\);\s*setSignInError\(SIGN_IN_TIMEOUT_MSG\);\s*\}, SIGN_IN_REDIRECT_TIMEOUT_MS\)/);
    expect(gateSource).toMatch(/event\.persisted\) setSigningIn\(false\)[\s\S]*addEventListener\("pageshow", onPageShow\)/);
    expect(gateSource).toContain('role="alert"');
  });
});

describe("OAuth callback failure is a recoverable page for browsers", () => {
  const startApp = async () => {
    const app = express();
    registerOAuthRoutes(app);
    const server = app.listen(0);
    await new Promise(r => server.once("listening", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return { base, close: () => new Promise(r => server.close(r)) };
  };

  it("renders a static page with a sign-in link and no sensitive values for every code", () => {
    for (const code of OAUTH_CALLBACK_ERROR_CODES) {
      const html = renderOAuthCallbackFailurePage(code);
      expect(html).toContain(`Error code: ${code}`);
      expect(html).toContain('href="/app"');
      expect(html).toContain('sessionStorage.removeItem("fl_post_auth_asha")');
      expect(html).not.toMatch(/access_token|Bearer|clientId|redirectUri/);
    }
  });

  it("browser navigation gets HTML, API clients keep the JSON body, no session cookie either way", async () => {
    const { base, close } = await startApp();
    try {
      const url = `${base}/api/oauth/callback?code=bogus&state=${encodeURIComponent(btoa("https://getfaultline.live/api/oauth/callback"))}`;
      const page = await fetch(url, { headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
      expect(page.status).toBe(500);
      expect(page.headers.get("content-type")).toMatch(/text\/html/);
      expect(page.headers.get("cache-control")).toBe("no-store");
      expect(page.headers.get("set-cookie") ?? "").not.toContain(COOKIE_NAME);
      const html = await page.text();
      expect(html).toContain("SIGN-IN DID NOT COMPLETE");
      expect(html).toContain("Error code: token_exchange_failed");

      const api = await fetch(url, { headers: { accept: "*/*" } });
      expect(api.status).toBe(500);
      expect(await api.json()).toEqual({
        error: "OAuth callback failed",
        errorCode: "token_exchange_failed",
        message: "Authorization code could not be exchanged for a token.",
      });

      const missing = await fetch(`${base}/api/oauth/callback`, { headers: { accept: "text/html" } });
      expect(missing.status).toBe(400);
    } finally {
      await close();
    }
  });
});
