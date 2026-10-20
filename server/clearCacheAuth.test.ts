import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { appRouter } from "./routers";

const CLEAR_CACHE = [
  "signals.clearCache",
  "diagnostic.clearCache",
  "guidance.clearCache",
  "crypto.clearCache",
  "aftershock.clearCache",
  "recovery.clearCache",
  "altRotation.clearCache",
  "social.clearCache",
  "dayTrade.clearCache",
  "marketIntelligence.clearCache",
] as const;

const ownerOpenId = "owner-open-id";

function caller(user: Record<string, unknown> | null) {
  return appRouter.createCaller({ req: {} as never, res: {} as never, user } as never);
}

async function clear(user: Record<string, unknown> | null, path: (typeof CLEAR_CACHE)[number]) {
  const [routerName, procedure] = path.split(".") as [string, string];
  const api = caller(user) as unknown as Record<string, Record<string, () => Promise<unknown>>>;
  return api[routerName][procedure]();
}

describe("tRPC clearCache is owner or admin only", () => {
  afterEach(() => {
    ENV.ownerOpenId = "";
  });

  it("refuses anonymous, member, QA, and cron callers on every clearCache mutation", async () => {
    const refused = [
      null,
      { id: 11, role: "user", openId: "user-a", isQaSession: false, isCron: false },
      { id: 12, role: "user", openId: "user-b", isQaSession: false, isCron: false },
      { id: 13, role: "admin", openId: "qa", isQaSession: true, isCron: false },
      { id: 14, role: "admin", openId: "cron", isQaSession: false, isCron: true },
    ];
    for (const user of refused) {
      for (const path of CLEAR_CACHE) {
        await expect(clear(user, path), `${user?.role ?? "anonymous"} ${path}`).rejects.toMatchObject({
          code: user ? "FORBIDDEN" : "UNAUTHORIZED",
        });
      }
    }
  });

  it("allows an admin and the configured owner", async () => {
    ENV.ownerOpenId = ownerOpenId;
    const allowed = [
      { id: 1, role: "admin", openId: "admin-open", isQaSession: false, isCron: false },
      { id: 2, role: "user", openId: ownerOpenId, isQaSession: false, isCron: false },
    ];
    for (const user of allowed) {
      for (const path of CLEAR_CACHE) {
        await expect(clear(user, path), `${user.openId} ${path}`).resolves.toEqual(expect.anything());
      }
    }
  });

  it("does not leave a member-callable clearCache procedure in the routers", () => {
    for (const file of ["server/routers.ts", "server/routers/marketIntelligence.ts", "server/routers/signals.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/clearCache:\s*protectedProcedure/);
      expect(source, file).toContain("ownerOrAdminProcedure");
    }
    const page = readFileSync("client/src/pages/MarketIntelligence.tsx", "utf8");
    expect(page).toContain("user?.isOwnerOrAdmin === true");
  });
});
