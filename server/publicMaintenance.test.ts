import { afterEach, describe, expect, it } from "vitest";
import {
  isMaintenanceModeEnabled,
  renderPublicMaintenancePage,
  shouldServePublicMaintenance,
} from "./publicMaintenance";

const ORIGINAL_MODE = process.env.FAULTLINE_MAINTENANCE_MODE;

afterEach(() => {
  if (ORIGINAL_MODE === undefined) {
    delete process.env.FAULTLINE_MAINTENANCE_MODE;
  } else {
    process.env.FAULTLINE_MAINTENANCE_MODE = ORIGINAL_MODE;
  }
});

describe("public maintenance env opt-in", () => {
  it("is active only when the value is exactly true", () => {
    expect(isMaintenanceModeEnabled(undefined)).toBe(false);
    expect(isMaintenanceModeEnabled("")).toBe(false);
    expect(isMaintenanceModeEnabled("false")).toBe(false);
    expect(isMaintenanceModeEnabled("TRUE")).toBe(false);
    expect(isMaintenanceModeEnabled("True")).toBe(false);
    expect(isMaintenanceModeEnabled("1")).toBe(false);
    expect(isMaintenanceModeEnabled("yes")).toBe(false);
    expect(isMaintenanceModeEnabled("true")).toBe(true);
  });

  it("does not intercept public pages when the flag is unset", () => {
    delete process.env.FAULTLINE_MAINTENANCE_MODE;
    expect(shouldServePublicMaintenance("GET", "/")).toBe(false);
  });
});

describe("public maintenance boundary", () => {
  it("intercepts public page delivery but never API, asset, auth, or crawler-control routes", () => {
    process.env.FAULTLINE_MAINTENANCE_MODE = "true";
    expect(shouldServePublicMaintenance("GET", "/")).toBe(true);
    expect(shouldServePublicMaintenance("GET", "/app/now")).toBe(true);
    expect(shouldServePublicMaintenance("HEAD", "/pricing")).toBe(true);
    expect(shouldServePublicMaintenance("GET", "/api/trpc/marketState.canonicalCurrent")).toBe(false);
    expect(shouldServePublicMaintenance("GET", "/api/oauth/callback")).toBe(false);
    expect(shouldServePublicMaintenance("GET", "/assets/index.js")).toBe(false);
    expect(shouldServePublicMaintenance("GET", "/manus-storage/legacy-asset.jpg")).toBe(false);
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
