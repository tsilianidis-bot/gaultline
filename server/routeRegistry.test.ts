import { describe, expect, it } from "vitest";
import { ANALYTICAL_LEGACY_ALIASES, CANONICAL_DESTINATIONS, EXPERT_WORKSPACES, PERSISTENT_UTILITIES, getLegacyAliasTarget, preserveRouteContext, resolveCanonicalDestination } from "../shared/routeRegistry";
describe("canonical route registry", () => {
  it("defines five market questions in required order", () => expect(CANONICAL_DESTINATIONS.map(item => item.id)).toEqual(["now", "why", "outlook", "watch", "act"]));
  it("provides complete metadata", () => CANONICAL_DESTINATIONS.forEach(item => { expect(item.question.length).toBeGreaterThan(10); expect(item.analyticsId).toMatch(/^destination_/); expect(item.views).toContain(item.defaultView); expect(item.requiresAuth).toBe(true); }));
  it("keeps utilities and experts outside primary navigation", () => { expect(PERSISTENT_UTILITIES.map(item => item.id)).toEqual(["asha", "search", "alerts", "help", "account"]); expect(EXPERT_WORKSPACES.map(item => item.path)).toContain("/app/pressure"); });
  it("owns legacy analytical aliases", () => { expect(Object.keys(ANALYTICAL_LEGACY_ALIASES).length).toBeGreaterThanOrEqual(40); expect(getLegacyAliasTarget("/app/seismograph")).toBe("/app/now?view=pressure"); expect(resolveCanonicalDestination("/app/alt-rotation")?.id).toBe("why"); });
  it("preserves route context", () => expect(preserveRouteContext("/app/act?view=analyze", "?symbol=NVDA&conversationId=conv-7&view=old", "#evidence")).toBe("/app/act?symbol=NVDA&conversationId=conv-7&view=analyze#evidence"));
});
