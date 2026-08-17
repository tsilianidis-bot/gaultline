import { describe, expect, it } from "vitest";
import { classifyAppRoute, PRESERVED_UNIQUE_APP_PATHS } from "../shared/routeConsolidation";

describe("standalone intelligence routes", () => {
  it("preserves Rising Stars as a direct authenticated app destination", () => {
    expect(classifyAppRoute("/app/rising-stars")).toBe("unique");
  });

  it("preserves the dedicated Signal Visual Analysis route pattern", () => {
    expect(PRESERVED_UNIQUE_APP_PATHS).toContain("/app/signals/:symbol");
  });
});
