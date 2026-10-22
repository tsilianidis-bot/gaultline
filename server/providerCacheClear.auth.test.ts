import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const authenticateRequest = vi.hoisted(() => vi.fn());
vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest },
}));

import { ENV } from "./_core/env";
import { registerCoinGeckoProxy } from "./coingeckoProxy";
import { registerFredProxy } from "./fredProxy";
import { registerSignalsProxy } from "./signalsProxy";

const paths = ["/api/signals/clear-cache", "/api/crypto/clear-cache", "/api/fred/clear-cache"];

async function post(server: Server, path: string) {
  const port = (server.address() as AddressInfo).port;
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST" });
  const body = await response.json() as { error?: string; success?: boolean };
  return { status: response.status, body };
}

describe("provider cache clear authorization", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    authenticateRequest.mockReset();
    await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  });

  function listen() {
    const app = express();
    registerSignalsProxy(app);
    registerCoinGeckoProxy(app);
    registerFredProxy(app);
    const server = app.listen(0);
    servers.push(server);
    return server;
  }

  it("refuses anonymous, member A, and member B on every clear-cache route", async () => {
    ENV.ownerOpenId = "owner-open-id";
    const server = listen();
    authenticateRequest.mockRejectedValue(new Error("Invalid session cookie"));
    for (const path of paths) {
      const anonymous = await post(server, path);
      expect(anonymous.status).toBe(401);
      expect(anonymous.body.success).not.toBe(true);
    }
    for (const openId of ["user-a", "user-b"]) {
      authenticateRequest.mockResolvedValue({ role: "user", openId, isCron: false });
      for (const path of paths) {
        const member = await post(server, path);
        expect(member.status).toBe(403);
        expect(member.body.error).toBe("Owner or admin only");
      }
    }
  });

  it("allows an admin and the owner, and still refuses a cron session", async () => {
    ENV.ownerOpenId = "owner-open-id";
    const server = listen();
    authenticateRequest.mockResolvedValue({ role: "admin", openId: "admin-open", isCron: false });
    for (const path of paths) {
      const admin = await post(server, path);
      expect(admin.status).toBe(200);
      expect(admin.body.success).toBe(true);
    }
    authenticateRequest.mockResolvedValue({ role: "user", openId: "owner-open-id", isCron: false });
    for (const path of paths) {
      const owner = await post(server, path);
      expect(owner.status).toBe(200);
      expect(owner.body.success).toBe(true);
    }
    authenticateRequest.mockResolvedValue({ role: "admin", openId: "cron_task", isCron: true });
    for (const path of paths) {
      const cron = await post(server, path);
      expect(cron.status).toBe(403);
    }
  });
});
