import { describe, expect, it } from "vitest";
import { ANALYTICAL_LEGACY_ALIASES, CANONICAL_DESTINATIONS, EXPERT_WORKSPACES, PERSISTENT_UTILITIES, getLegacyAliasTarget, preserveRouteContext, resolveCanonicalDestination } from "../shared/routeRegistry";
describe("canonical route registry", () => {
  it("defines five market questions in required order", () => expect(CANONICAL_DESTINATIONS.map(item => item.id)).toEqual(["now", "why", "outlook", "watch", "act"]));
  it("provides complete primary metadata", () => CANONICAL_DESTINATIONS.forEach(item => { expect(item.question.length).toBeGreaterThan(10); expect(item.analyticsId).toMatch(/^destination_/); expect(item.searchKeywords.length).toBeGreaterThan(2); expect(item.views).toContain(item.defaultView); expect(item.access).toBe("authenticated"); expect(item.surface).toBe("primary"); expect(item.requiresAuth).toBe(true); }));
  it("keeps fully described utilities and experts outside primary navigation", () => {
    expect(PERSISTENT_UTILITIES.map(item => item.id)).toEqual(["asha", "search", "alerts", "help", "account"]);
    PERSISTENT_UTILITIES.forEach(item => { expect(item.analyticsId).toMatch(/^utility_/); expect(item.searchKeywords.length).toBeGreaterThan(1); expect(item.access).toBe("authenticated"); expect(item.surface).toBe("utility"); });
    expect(EXPERT_WORKSPACES.map(item => item.path)).toContain("/app/pressure");
    EXPERT_WORKSPACES.forEach(item => { expect(item.analyticsId).toMatch(/^expert_/); expect(item.searchKeywords.length).toBeGreaterThan(2); expect(item.access).toBe("authenticated"); expect(item.surface).toBe("expert"); });
  });
  it("owns legacy analytical aliases", () => { expect(Object.keys(ANALYTICAL_LEGACY_ALIASES).length).toBeGreaterThanOrEqual(40); expect(getLegacyAliasTarget("/app/seismograph")).toBe("/app/now?view=pressure"); expect(resolveCanonicalDestination("/app/alt-rotation")?.id).toBe("why"); });
  it("preserves route context", () => expect(preserveRouteContext("/app/act?view=analyze", "?symbol=NVDA&conversationId=conv-7&view=old", "#evidence")).toBe("/app/act?symbol=NVDA&conversationId=conv-7&view=analyze#evidence"));
});
