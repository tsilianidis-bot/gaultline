import { describe, expect, it } from "vitest";
import { classifyAppRoute } from "../shared/routeConsolidation";

describe("standalone intelligence routes", () => {
  it("preserves Rising Stars as a direct authenticated app destination", () => {
    expect(classifyAppRoute("/app/rising-stars")).toBe("unique");
  });
});
