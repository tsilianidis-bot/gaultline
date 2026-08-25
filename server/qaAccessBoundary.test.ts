import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appRouter } from "./routers";
import { qaPrincipal } from "./qaAccess";

const qaPage = readFileSync(resolve(process.cwd(), "client/src/pages/QaAccess.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

function qaCaller() {
  return appRouter.createCaller({
    user: qaPrincipal(),
    req: { headers: {} },
    res: {},
  } as any);
}

describe("permanent owner QA access boundaries", () => {
  it("exposes an identifiable read-only principal and a view-only founding tier without database entitlement mutation", async () => {
    const caller = qaCaller();
    const me = await caller.auth.me();
    const tier = await caller.user.getAccessTier();
    expect(me).toMatchObject({ isQaSession: true, qaAccess: "read_only", openId: "faultline_owner_qa" });
    expect(tier).toEqual({ tier: "founding", isQaSession: true });
  });

  it("rejects protected mutations for the QA principal", async () => {
    await expect(qaCaller().auth.setDashboardMode({ mode: "pulse" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps the permanent entry route explicit and never stores the secret in browser state", () => {
    expect(appSource).toContain('path="/qa-access"');
    expect(qaPage).toContain('fetch("/api/qa/access"');
    expect(qaPage).not.toContain("localStorage");
    expect(qaPage).not.toContain("sessionStorage");
    expect(qaPage).not.toContain("URLSearchParams");
  });
});
