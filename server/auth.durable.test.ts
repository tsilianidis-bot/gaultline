import express from "express";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import {
  closeDbForTests,
  createOAuthAuthorizationState,
} from "./db";
import { appRouter } from "./routers";
import { startDisposableMariaDb, type DisposableMariaDb } from "./testing/disposableMariaDb";
import { ENV } from "./_core/env";
import {
  OAUTH_STATE_COOKIE_NAME,
  registerOAuthRoutes,
} from "./_core/oauth";
import { sdk } from "./_core/sdk";

let maria: DisposableMariaDb;
let connection: Connection;
let databaseUrl = "";
let originalDatabaseUrl: string | undefined;
const originalEnv = {
  appId: ENV.appId,
  cookieSecret: ENV.cookieSecret,
  oAuthServerUrl: ENV.oAuthServerUrl,
  oAuthPortalUrl: ENV.oAuthPortalUrl,
  oAuthCallbackOrigin: ENV.oAuthCallbackOrigin,
};

async function applyAuthMigration(): Promise<void> {
  const migration = await readFile(resolve(process.cwd(), "drizzle/0083_auth_state_and_sessions.sql"), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) await connection.query(statement);
  }
}

async function withOAuthApp(fn: (origin: string) => Promise<void>): Promise<void> {
  const app = express();
  registerOAuthRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolveListen => server.once("listening", resolveListen));
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close(error => error ? rejectClose(error) : resolveClose());
    });
  }
}

function cookieValue(setCookie: string | null): string {
  const first = setCookie?.split(";")[0];
  if (!first) throw new Error("OAuth initiator did not set a state verifier cookie");
  return first;
}

beforeAll(async () => {
  maria = await startDisposableMariaDb();
  connection = await maria.createDatabase("auth_durable_test");
  databaseUrl = `mysql://root@${maria.host}:${maria.port}/auth_durable_test`;
  await connection.query(`CREATE TABLE users (
    id int NOT NULL AUTO_INCREMENT,
    openId varchar(64) NOT NULL,
    name text NULL,
    email varchar(320) NULL,
    loginMethod varchar(64) NULL,
    role enum('user','admin') NOT NULL DEFAULT 'user',
    accessTier enum('free','core','premium','founding') NOT NULL DEFAULT 'free',
    dashboardMode enum('pulse','signals','intelligence') NOT NULL DEFAULT 'pulse',
    preflightPromptMode enum('full_guidance','minimal_reminders','off') NOT NULL DEFAULT 'full_guidance',
    stripeCustomerId varchar(64) NULL,
    stripeSubscriptionId varchar(64) NULL,
    lifetimeAccess boolean NOT NULL DEFAULT false,
    lifetimePurchasedAt timestamp NULL,
    accessExpiresAt timestamp NULL,
    entitlementRevision int NOT NULL DEFAULT 0,
    lastPreflightCompletedAt timestamp NULL,
    adminNotes text NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    lastSignedIn timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_openId_unique (openId)
  ) ENGINE=InnoDB`);
  await connection.query("INSERT INTO users (openId, name) VALUES ('durable-user', 'Durable User')");
  await applyAuthMigration();

  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  Object.assign(ENV, {
    appId: "durable-auth-app",
    cookieSecret: "durable-auth-test-secret-with-enough-entropy",
    oAuthServerUrl: "https://oauth.example.test",
    oAuthPortalUrl: "https://portal.example.test",
    oAuthCallbackOrigin: "https://app.example.test",
  });
  closeDbForTests();
}, 60_000);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  closeDbForTests();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  Object.assign(ENV, originalEnv);
  await connection?.end();
  await maria?.close();
}, 60_000);

describe("durable OAuth state", () => {
  it("issues a cryptographically random state bound to a secure HttpOnly Lax browser cookie", async () => {
    await withOAuthApp(async origin => {
      const first = await fetch(`${origin}/api/oauth/login`, { redirect: "manual" });
      const second = await fetch(`${origin}/api/oauth/login`, { redirect: "manual" });

      expect(first.status).toBe(302);
      expect(second.status).toBe(302);
      const firstLocation = new URL(first.headers.get("location")!);
      const secondLocation = new URL(second.headers.get("location")!);
      const firstState = firstLocation.searchParams.get("state");
      const secondState = secondLocation.searchParams.get("state");
      expect(firstState).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(secondState).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(firstState).not.toBe(secondState);
      expect(firstLocation.searchParams.get("redirectUri")).toBe("https://app.example.test/api/oauth/callback");
      expect(first.headers.get("set-cookie")).toContain(`${OAUTH_STATE_COOKIE_NAME}=`);
      expect(first.headers.get("set-cookie")).toMatch(/HttpOnly/i);
      expect(first.headers.get("set-cookie")).toMatch(/Secure/i);
      expect(first.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
      expect(first.headers.get("set-cookie")).toMatch(/Max-Age=600/i);

      const [rows] = await connection.query<Array<{ stateHash: string; verifierHash: string }>>(
        "SELECT stateHash, verifierHash FROM oauthAuthorizationStates",
      );
      expect(rows).toHaveLength(2);
      expect(rows.every(row => row.stateHash !== firstState && row.stateHash !== secondState)).toBe(true);
      expect(rows.every(row => /^[a-f0-9]{64}$/.test(row.stateHash) && /^[a-f0-9]{64}$/.test(row.verifierHash))).toBe(true);
    });
  });

  it("rejects mismatch, expiry, and replay before a second token exchange", async () => {
    const exchange = vi.spyOn(sdk, "exchangeCodeForToken").mockRejectedValue(new Error("synthetic exchange failure"));
    const verifier = "browser-verifier-for-callback-test";
    const state = "state-for-callback-test";
    const expiredState = "expired-state-for-callback-test";
    const now = Date.now();
    await createOAuthAuthorizationState(state, verifier, new Date(now + 60_000));
    await createOAuthAuthorizationState(expiredState, verifier, new Date(now - 1_000));

    await withOAuthApp(async origin => {
      const mismatch = await fetch(`${origin}/api/oauth/callback?code=code&state=${state}`, {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=wrong-browser-verifier` },
      });
      expect(mismatch.status).toBe(400);
      expect(await mismatch.json()).toEqual({ error: "invalid or expired OAuth state" });
      expect(exchange).not.toHaveBeenCalled();

      const expired = await fetch(`${origin}/api/oauth/callback?code=code&state=${expiredState}`, {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${verifier}` },
      });
      expect(expired.status).toBe(400);
      expect(exchange).not.toHaveBeenCalled();

      const first = await fetch(`${origin}/api/oauth/callback?code=code&state=${state}`, {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${verifier}` },
      });
      expect(first.status).toBe(500);
      expect(first.headers.get("set-cookie")).toContain(`${OAUTH_STATE_COOKIE_NAME}=;`);
      expect(exchange).toHaveBeenCalledTimes(1);

      // Replay the original raw cookie intentionally: clearing a browser cookie
      // alone is insufficient, so the durable consumed row must still reject it.
      const replay = await fetch(`${origin}/api/oauth/callback?code=code&state=${state}`, {
        headers: { cookie: `${OAUTH_STATE_COOKIE_NAME}=${verifier}` },
      });
      expect(replay.status).toBe(400);
      expect(exchange).toHaveBeenCalledTimes(1);
    });
  });
});

describe("durable logout invalidation", () => {
  it("rejects a copied pre-logout session cookie after the logout procedure revokes its shared record", async () => {
    const sessionId = randomUUID();
    const token = await sdk.createSessionToken("durable-user", { sessionId });
    const expiresAt = new Date(Date.now() + 60_000);
    const { createAuthSession } = await import("./db");
    await createAuthSession(sessionId, "durable-user", expiresAt);
    const request = { headers: { cookie: `${COOKIE_NAME}=${token}` } } as any;
    const user = await sdk.authenticateRequest(request);
    const cleared: string[] = [];

    await expect(appRouter.createCaller({
      user,
      req: { protocol: "https", headers: {} },
      res: { clearCookie: (name: string) => cleared.push(name) },
    } as any).auth.logout()).resolves.toEqual({ success: true });
    expect(cleared).toEqual([COOKIE_NAME]);

    const observer = await createConnection({
      host: maria.host,
      port: maria.port,
      user: "root",
      database: "auth_durable_test",
    });
    try {
      const [rows] = await observer.query<Array<{ revokedAt: Date | null }>>(
        "SELECT revokedAt FROM authSessions",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.revokedAt).not.toBeNull();
    } finally {
      await observer.end();
    }

    await expect(sdk.authenticateRequest(request)).rejects.toThrow("Invalid session cookie");
  });
});
