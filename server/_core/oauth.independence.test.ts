import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { resolve } from "node:path";
import express from "express";
import { COOKIE_NAME } from "@shared/const";
import { HttpError } from "@shared/_core/errors";
import { appRouter } from "../routers";
import {
  handleQaAccess,
  isQaSession,
  QA_ACCESS_COOKIE,
  qaPrincipal,
} from "../qaAccess";
import { handleHealth } from "../health";
import * as db from "../db";
import { createContext } from "./context";
import { ENV } from "./env";
import { registerOAuthRoutes } from "./oauth";
import {
  isOAuthConfigured,
  OAuthInactiveError,
  sdk,
  SDKServer,
} from "./sdk";

const ORIGINAL = {
  appId: ENV.appId,
  oAuthServerUrl: ENV.oAuthServerUrl,
  cookieSecret: ENV.cookieSecret,
  NODE_ENV: process.env.NODE_ENV,
  FAULTLINE_MANAGED_PREVIEW: process.env.FAULTLINE_MANAGED_PREVIEW,
  QA_ACCESS_SECRET: process.env.QA_ACCESS_SECRET,
};

function restoreEnv() {
  ENV.appId = ORIGINAL.appId;
  ENV.oAuthServerUrl = ORIGINAL.oAuthServerUrl;
  ENV.cookieSecret = ORIGINAL.cookieSecret;
  if (ORIGINAL.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL.NODE_ENV;
  if (ORIGINAL.FAULTLINE_MANAGED_PREVIEW === undefined) {
    delete process.env.FAULTLINE_MANAGED_PREVIEW;
  } else {
    process.env.FAULTLINE_MANAGED_PREVIEW = ORIGINAL.FAULTLINE_MANAGED_PREVIEW;
  }
  if (ORIGINAL.QA_ACCESS_SECRET === undefined) delete process.env.QA_ACCESS_SECRET;
  else process.env.QA_ACCESS_SECRET = ORIGINAL.QA_ACCESS_SECRET;
}

function describeRequest(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input && typeof input === "object") {
    const rec = input as Record<string, unknown>;
    if (typeof rec.href === "string") return rec.href;
    if (typeof rec.url === "string") return rec.url;
    const host = rec.hostname ?? rec.host ?? "";
    const path = rec.path ?? rec.pathname ?? "";
    const proto = rec.protocol
      ? String(rec.protocol).replace(/:$/, "")
      : "https";
    if (host) return `${proto}://${host}${path}`;
  }
  return String(input);
}

function isManusHost(raw: string): boolean {
  try {
    const candidate = raw.includes("://") ? raw : `https://${raw}`;
    const url = new URL(candidate);
    return (
      url.hostname === "api.manus.im" ||
      url.hostname === "manus.im" ||
      url.hostname.endsWith(".manus.im")
    );
  } catch {
    return /api\.manus\.im|(^|\/\/|\.)manus\.im/i.test(raw);
  }
}

function installManusHttpTraps() {
  const seen: string[] = [];
  const originalFetch = globalThis.fetch.bind(globalThis);
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = describeRequest(input);
    seen.push(raw);
    if (isManusHost(raw)) {
      throw new Error(`Outbound Manus HTTP blocked: ${raw}`);
    }
    return originalFetch(input, init);
  });
  vi.stubGlobal("fetch", fetchMock);

  const originalHttpsRequest = https.request;
  const originalHttpRequest = http.request;
  const httpsReq = vi.spyOn(https, "request").mockImplementation((...args: unknown[]) => {
    const raw = describeRequest(args[0]);
    seen.push(raw);
    if (isManusHost(raw)) {
      throw new Error(`Outbound Manus HTTP blocked: ${raw}`);
    }
    return originalHttpsRequest.apply(https, args as Parameters<typeof https.request>);
  });
  const httpReq = vi.spyOn(http, "request").mockImplementation((...args: unknown[]) => {
    const raw = describeRequest(args[0]);
    seen.push(raw);
    if (isManusHost(raw)) {
      throw new Error(`Outbound Manus HTTP blocked: ${raw}`);
    }
    return originalHttpRequest.apply(http, args as Parameters<typeof http.request>);
  });

  return {
    seen,
    assertNoManusHttp() {
      expect(seen.filter(isManusHost), `Manus HTTP: ${seen.join(" | ")}`).toEqual([]);
    },
    mocks: { fetchMock, httpsReq, httpReq },
  };
}

function mockAxiosClient() {
  const post = vi.fn();
  const client = {
    defaults: { baseURL: "" as string | undefined },
    post,
  };
  return { client, post };
}

function incompleteOAuth() {
  ENV.appId = "";
  ENV.oAuthServerUrl = "";
}

function completeOAuth(url = "https://oauth.example.test") {
  ENV.appId = "complete-app-id";
  ENV.oAuthServerUrl = url;
}

const tokenPayload = {
  accessToken: "tok",
  tokenType: "Bearer",
  expiresIn: 3600,
  scope: "",
  idToken: "id-token",
};

async function withCallbackApp(fn: (origin: string) => Promise<void>) {
  const app = express();
  registerOAuthRoutes(app);
  const server = await new Promise<http.Server>(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  try {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()));
    });
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  restoreEnv();
});

describe("OAuth independence Option 1+2", () => {
  it("does not hardcode a default fallback to https://api.manus.im", () => {
    const sdkSrc = readFileSync(resolve(process.cwd(), "server/_core/sdk.ts"), "utf8");
    const envSrc = readFileSync(resolve(process.cwd(), "server/_core/env.ts"), "utf8");
    expect(envSrc).not.toContain("api.manus.im");
    expect(sdkSrc).not.toMatch(
      /(?:OAUTH_SERVER_URL|oAuthServerUrl|baseURL)\s*\|\|\s*["']https:\/\/api\.manus\.im["']/,
    );
    expect(sdkSrc).not.toMatch(/\?\?\s*["']https:\/\/api\.manus\.im["']/);
    expect(sdkSrc).not.toContain('baseURL: "https://api.manus.im"');
    expect(sdkSrc).not.toContain("[OAuth] ERROR:");
    expect(sdkSrc).not.toMatch(/console\.error\(\s*\n?\s*["']\[OAuth\] ERROR:/);
  });

  it("treats missing app id and/or OAuth server URL as incomplete", () => {
    incompleteOAuth();
    expect(isOAuthConfigured()).toBe(false);
    ENV.appId = "only-app-id";
    ENV.oAuthServerUrl = "";
    expect(isOAuthConfigured()).toBe(false);
    ENV.appId = "";
    ENV.oAuthServerUrl = "https://api.manus.im";
    expect(isOAuthConfigured()).toBe(false);
    ENV.appId = "complete-app-id";
    ENV.oAuthServerUrl = "not-a-url";
    expect(isOAuthConfigured()).toBe(false);
    completeOAuth("https://api.manus.im");
    expect(isOAuthConfigured()).toBe(true);
  });

  it("boots with a warn/inactive message and zero Manus HTTP when OAuth is incomplete", () => {
    incompleteOAuth();
    const traps = installManusHttpTraps();
    const { client, post } = mockAxiosClient();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    new SDKServer(client as any);

    expect(post).not.toHaveBeenCalled();
    traps.assertNoManusHttp();
    const warnText = warn.mock.calls.map(call => call.map(String).join(" ")).join("\n");
    expect(warnText).toMatch(/inactive/i);
    expect(warnText).toMatch(/VITE_APP_ID/);
    const oauthErrors = error.mock.calls
      .map(call => String(call[0]))
      .filter(message => message.includes("VITE_APP_ID") || message.includes("OAUTH_SERVER_URL"));
    expect(oauthErrors).toEqual([]);
  });

  it("health remains 200 with zero Manus HTTP when OAuth is incomplete", () => {
    incompleteOAuth();
    const traps = installManusHttpTraps();
    const state: { status?: number; body?: { ok?: boolean } } = {};
    handleHealth(
      {} as any,
      {
        status(code: number) {
          state.status = code;
          return this;
        },
        json(body: { ok?: boolean }) {
          state.body = body;
          return this;
        },
      } as any,
    );
    expect(state.status).toBe(200);
    expect(state.body?.ok).toBe(true);
    traps.assertNoManusHttp();
  });

  it("callback fails locally before outbound HTTP when OAuth is incomplete", async () => {
    incompleteOAuth();
    const traps = installManusHttpTraps();
    const exchange = vi.spyOn(sdk, "exchangeCodeForToken");
    const jwtSync = vi.spyOn(sdk, "getUserInfoWithJwt");

    await withCallbackApp(async origin => {
      const state = btoa(`${origin}/api/oauth/callback`);
      const response = await fetch(
        `${origin}/api/oauth/callback?code=auth-code&state=${encodeURIComponent(state)}`,
      );
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toMatchObject({
        error: "OAuth callback failed",
        errorCode: "token_exchange_failed",
      });
    });

    expect(exchange).not.toHaveBeenCalled();
    expect(jwtSync).not.toHaveBeenCalled();
    traps.assertNoManusHttp();
  });

  it("token exchange and JWT user-sync fail locally with zero Manus HTTP when incomplete", async () => {
    incompleteOAuth();
    ENV.cookieSecret = "independence-test-jwt-secret-value";
    const traps = installManusHttpTraps();
    const { client, post } = mockAxiosClient();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const server = new SDKServer(client as any);
    const redirectState = btoa("https://staging.example.com/api/oauth/callback");

    await expect(server.exchangeCodeForToken("code", redirectState)).rejects.toBeInstanceOf(
      OAuthInactiveError,
    );
    await expect(server.getUserInfo("tok")).rejects.toBeInstanceOf(OAuthInactiveError);
    await expect(server.getUserInfoWithJwt("jwt")).rejects.toBeInstanceOf(OAuthInactiveError);

    vi.spyOn(db, "getUserByOpenId").mockResolvedValue(undefined);
    const upsert = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined as any);
    const session = await server.signSession({
      openId: "missing-user",
      appId: "session-app",
      name: "Local",
    });
    await expect(
      server.authenticateRequest({
        headers: { cookie: `${COOKIE_NAME}=${session}` },
      } as any),
    ).rejects.toBeInstanceOf(HttpError);

    expect(post).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    traps.assertNoManusHttp();
  });

  it("full OAuth token/userinfo/JWT-sync still work when complete config is supplied", async () => {
    completeOAuth("https://api.manus.im");
    ENV.cookieSecret = "independence-test-jwt-secret-value";
    const { client, post } = mockAxiosClient();
    post.mockImplementation(async (path: string) => {
      if (String(path).includes("GetUserInfoWithJwt") || String(path).includes("GetUserInfo")) {
        return {
          data: {
            openId: "oid-complete",
            projectId: "complete-app-id",
            name: "Ada",
            email: "ada@example.com",
          },
        };
      }
      return { data: tokenPayload };
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const server = new SDKServer(client as any);
    const redirectState = btoa("https://app.example/api/oauth/callback");

    const token = await server.exchangeCodeForToken("auth-code", redirectState);
    expect(token.accessToken).toBe("tok");
    expect(client.defaults.baseURL).toBe("https://api.manus.im");
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      clientId: "complete-app-id",
      grantType: "authorization_code",
      code: "auth-code",
    });

    const info = await server.getUserInfo("tok");
    expect(info.openId).toBe("oid-complete");

    const jwtInfo = await server.getUserInfoWithJwt("session-jwt");
    expect(jwtInfo.openId).toBe("oid-complete");
    expect(post).toHaveBeenCalled();

    vi.spyOn(db, "getUserByOpenId")
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue({
        id: 7,
        openId: "oid-complete",
        name: "Ada",
        email: "ada@example.com",
        loginMethod: "email",
        role: "user",
        accessTier: "free",
        dashboardMode: "pulse",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any);
    const upsert = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined as any);
    const session = await server.signSession({
      openId: "oid-complete",
      appId: "complete-app-id",
      name: "Ada",
    });
    const user = await server.authenticateRequest({
      headers: { cookie: `${COOKIE_NAME}=${session}` },
    } as any);
    expect(user.openId).toBe("oid-complete");
    expect(upsert).toHaveBeenCalled();
  });

  it("OAuth callback still succeeds when complete config and provider responses are supplied", async () => {
    completeOAuth("https://oauth.example.test");
    const traps = installManusHttpTraps();
    vi.spyOn(sdk, "exchangeCodeForToken").mockResolvedValue(tokenPayload);
    vi.spyOn(sdk, "getUserInfo").mockResolvedValue({
      openId: "oid-complete",
      projectId: "complete-app-id",
      name: "Ada",
      email: null,
    });
    vi.spyOn(sdk, "createSessionToken").mockResolvedValue("session-jwt");
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue(undefined);
    vi.spyOn(db, "upsertUser").mockResolvedValue(undefined as any);

    await withCallbackApp(async origin => {
      const state = btoa(`${origin}/api/oauth/callback`);
      const response = await fetch(
        `${origin}/api/oauth/callback?code=auth-code&state=${encodeURIComponent(state)}`,
        { redirect: "manual" },
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/app");
    });

    traps.assertNoManusHttp();
  });

  it("/qa-access and auth.me make zero OAuth HTTP", async () => {
    incompleteOAuth();
    const traps = installManusHttpTraps();
    const exchange = vi.spyOn(sdk, "exchangeCodeForToken");
    const jwtSync = vi.spyOn(sdk, "getUserInfoWithJwt");
    const authenticate = vi.spyOn(sdk, "authenticateRequest");

    process.env.NODE_ENV = "production";
    delete process.env.FAULTLINE_MANAGED_PREVIEW;
    process.env.QA_ACCESS_SECRET = "independent-staging-qa-secret";
    const resState: {
      status?: number;
      body?: unknown;
      cookie?: { name: string; value: string };
    } = {};
    const res = {
      status(code: number) {
        resState.status = code;
        return this;
      },
      json(body: unknown) {
        resState.body = body;
        return this;
      },
      cookie(name: string, value: string) {
        resState.cookie = { name, value };
        return this;
      },
    };
    handleQaAccess(
      {
        body: { secret: "independent-staging-qa-secret" },
        protocol: "https",
        headers: { host: "staging.up.railway.app" },
      } as any,
      res as any,
    );
    expect(resState.body).toEqual({ ok: true, mode: "owner_qa_read_only" });
    expect(resState.cookie?.name).toBe(QA_ACCESS_COOKIE);
    expect(
      isQaSession({
        headers: {
          host: "staging.up.railway.app",
          cookie: `${QA_ACCESS_COOKIE}=${resState.cookie?.value}`,
        },
      } as any),
    ).toBe(true);

    process.env.FAULTLINE_MANAGED_PREVIEW = "true";
    const ctx = await createContext({
      req: { headers: { host: "staging.up.railway.app" } },
      res: {},
    } as any);
    expect(ctx.user?.isQaSession).toBe(true);
    expect(authenticate).not.toHaveBeenCalled();

    const me = await appRouter.createCaller({
      user: qaPrincipal(),
      req: { headers: {} },
      res: {},
    } as any).auth.me();
    expect(me).toMatchObject({
      isQaSession: true,
      qaAccess: "read_only",
      openId: "faultline_owner_qa",
    });

    expect(exchange).not.toHaveBeenCalled();
    expect(jwtSync).not.toHaveBeenCalled();
    traps.assertNoManusHttp();
  });
});
