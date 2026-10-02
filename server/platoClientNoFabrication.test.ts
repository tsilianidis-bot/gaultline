import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ashaSignInRequiredState, reduceAshaAskFailure } from "../shared/ashaPanelMachine";

const read = (relative: string) => readFileSync(path.resolve(import.meta.dirname, "..", relative), "utf8");
const panel = read("client/src/components/AshaPanel.tsx");
const liveBriefing = read("client/src/components/AshaLiveBriefing.tsx");
const dailyGreeting = read("client/src/components/AshaDailyGreeting.tsx");

describe("guest ASK PLATO", () => {
  it("reads auth through the existing hook and never calls asha.ask for a signed-out visitor", () => {
    expect(panel).toContain('import { useAuth } from "@/_core/hooks/useAuth"');
    const sendStart = panel.indexOf("const sendMessage = useCallback");
    const guard = panel.indexOf("if (!authLoading && !user)", sendStart);
    const request = panel.indexOf("askMutation.mutateAsync", sendStart);
    expect(guard).toBeGreaterThan(sendStart);
    expect(request).toBeGreaterThan(guard);
    const guardBlock = panel.slice(guard, panel.indexOf("}", guard));
    expect(guardBlock).toContain("ashaSignInRequiredState()");
  });

  it("shows the FAULTLINE sign-in card with a click-only Sign in button and no Retry", () => {
    const state = ashaSignInRequiredState();
    expect(state).toMatchObject({ title: "Sign in to use PLATO", showSignIn: true, showRetry: false });
    expect(reduceAshaAskFailure({ data: { code: "UNAUTHORIZED" } })).toEqual(state);
    expect(panel).toMatch(/onClick=\{\(\) => \{ navigateToLogin\(\); \}\}/);
    // navigateToLogin is only referenced inside the click handler.
    expect(panel.match(/navigateToLogin\(/g)).toHaveLength(1);
  });

  it("keeps the PLATO card above a bottom banner instead of under it", () => {
    expect(panel).toContain("useBottomObstructionPx");
    expect(panel).toMatch(/\$\{24 \+ bottomObstructionPx\}px/);
  });
});

describe("no invented briefing fields or greeting claims", () => {
  it("AshaPanel no longer fills missing model fields with ELEVATED / Moderate / NEUTRAL / WATCH / 50", () => {
    expect(panel).not.toMatch(/\|\| "ELEVATED"|\|\| "Moderate"|\|\| "NEUTRAL"|\|\| "WATCH"/);
    expect(panel).not.toMatch(/Probability \?\? 50|pressureScore \?\? 50/);
  });

  it("AshaLiveBriefing fallback is an honest unavailable line", () => {
    expect(liveBriefing).not.toContain("I have been monitoring");
    expect(liveBriefing).not.toContain("most significant change");
    expect(liveBriefing).not.toContain("continue to resemble");
    expect(liveBriefing).toContain("PLATO is temporarily unavailable, so there is no PLATO greeting right now.");
  });

  it("AshaDailyGreeting fallback makes no live or market claim", () => {
    expect(dailyGreeting).not.toMatch(/still live/i);
    expect(dailyGreeting).not.toContain("pressure is elevated");
    expect(dailyGreeting).toContain("PLATO is temporarily unavailable");
  });
});
