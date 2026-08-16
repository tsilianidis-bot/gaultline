import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CANONICAL_HOME, CANONICAL_DESTINATION_BY_ID } from "../shared/routeRegistry";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/AppLayout.tsx"), "utf8");
const briefingSource = readFileSync(resolve(process.cwd(), "client/src/components/AshaLiveBriefing.tsx"), "utf8");

describe("ASHA post-welcome canonical Home routing", () => {
  it("defines Home as the canonical Deep Dashboard route", () => {
    expect(CANONICAL_HOME).toBe("/app/now");
    expect(CANONICAL_DESTINATION_BY_ID.now.path).toBe(CANONICAL_HOME);
  });

  it("routes authenticated root traffic and ASHA welcome completion to Home", () => {
    expect(appSource).toContain("<Redirect to={CANONICAL_HOME} />");
    const welcomeHandler = appSource.slice(
      appSource.indexOf("const handleAshaBriefingComplete"),
      appSource.indexOf("// Auth gate", appSource.indexOf("const handleAshaBriefingComplete")),
    );
    expect(welcomeHandler).toContain("navigate(CANONICAL_HOME);");
    expect(welcomeHandler).not.toContain("startupPathMap");
    expect(appSource).not.toContain("trpc.dailyBrief.getStartupPage.useQuery");
  });

  it("keeps the ASHA CTA delegated to the canonical parent continuation handler", () => {
    expect(briefingSource).toContain("onClick={handleContinueToDashboard}");
    expect(briefingSource).toContain("onContinue();");
  });

  it("routes the logo and mobile Home control to the same canonical destination", () => {
    expect(layoutSource).toContain("CANONICAL_DESTINATION_BY_ID.now.path");
    expect(layoutSource).toContain("Home — Oracle Now");
    expect(layoutSource).toContain("HOME_TAB");
  });
});
