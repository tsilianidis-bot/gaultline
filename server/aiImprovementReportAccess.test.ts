import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canReadAiImprovementReports } from "./routers/intelligenceValidation";

const read = (rel: string) => readFileSync(resolve(import.meta.dirname, "..", rel), "utf8");

describe("weekly AI improvement reports stay off the member page", () => {
  it("allows an admin or the owner and refuses every other caller", () => {
    expect(canReadAiImprovementReports({ role: "admin", openId: "member" }, "owner-1")).toBe(true);
    expect(canReadAiImprovementReports({ role: "user", openId: "owner-1" }, "owner-1")).toBe(true);
    expect(canReadAiImprovementReports({ role: "user", openId: "member" }, "owner-1")).toBe(false);
    expect(canReadAiImprovementReports({ role: "user", openId: "member" }, "")).toBe(false);
    expect(canReadAiImprovementReports(null, "owner-1")).toBe(false);
  });

  it("returns no rows to a member before the cross-user table is read", () => {
    const source = read("server/routers/intelligenceValidation.ts");
    expect(source).toContain("if (!canReadAiImprovementReports(ctx.user)) return [];");
    expect(source).not.toContain("ctx: _ctx");
    const page = read("client/src/pages/IntelligenceValidation.tsx");
    expect(page).toContain("user?.isOwnerOrAdmin === true");
    expect(page).toMatch(/getAiImprovementReports\.useQuery\(\{ limit: 8 \}, \{ enabled: canReadAiReports \}\)/);
    expect(page).toContain("{canReadAiReports && <section>");
  });
});
