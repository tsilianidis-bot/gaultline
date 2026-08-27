import { describe, expect, it } from "vitest";
import { renderPublicMaintenancePage, shouldServePublicMaintenance } from "./publicMaintenance";

describe("public maintenance boundary", () => {
  it("intercepts public page delivery but never API, asset, auth, or crawler-control routes", () => {
    expect(shouldServePublicMaintenance("GET", "/")).toBe(true);
    expect(shouldServePublicMaintenance("GET", "/app/now")).toBe(true);
    expect(shouldServePublicMaintenance("HEAD", "/pricing")).toBe(true);
    expect(shouldServePublicMaintenance("GET", "/api/trpc/marketState.canonicalCurrent")).toBe(false);
    expect(shouldServePublicMaintenance("GET", "/api/oauth/callback")).toBe(false);
    expect(shouldServePublicMaintenance("GET", "/assets/index.js")).toBe(false);
    expect(shouldServePublicMaintenance("GET", "/robots.txt")).toBe(false);
    expect(shouldServePublicMaintenance("POST", "/")).toBe(false);
  });

  it("renders only approved public copy and omits application and infrastructure detail", () => {
    const page = renderPublicMaintenancePage();
    expect(page).toContain("FAULTLINE is temporarily undergoing system maintenance and infrastructure upgrades.");
    expect(page).toContain("We’re working to restore full market intelligence functionality as quickly as possible.");
    expect(page).toContain("No user action is required. Please check back shortly.");
    expect(page).toContain('name="robots" content="noindex, nofollow"');
    expect(page.toLowerCase()).not.toContain("manus");
    expect(page.toLowerCase()).not.toContain("cloud run");
    expect(page).not.toContain("SIGN IN");
  });
});
