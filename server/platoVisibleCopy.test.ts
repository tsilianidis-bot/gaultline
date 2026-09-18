import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PERSISTENT_UTILITY_BY_ID } from "../shared/routeRegistry";
import { getAskPlaceholder } from "../client/src/lib/askIntentClassifier";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

const ASHA_CTA = /\b(?:Ask|ASK|Open|OPEN) ASHA\b/;
const PLATO_CTA = /\b(?:Ask|ASK|Open|OPEN) PLATO\b/;

const ASK_CTA_SURFACES = [
  "client/src/components/AshaPanel.tsx",
  "client/src/components/AshaSummon.tsx",
  "client/src/components/AshaHeroSection.tsx",
  "client/src/components/MarketContextStrip.tsx",
  "client/src/components/MarketSynthesisPanel.tsx",
  "client/src/components/SeismographNarrativeBanner.tsx",
  "client/src/components/RightActionDrawer.tsx",
  "client/src/lib/askIntentClassifier.ts",
  "client/src/pages/Dashboard.tsx",
  "client/src/pages/Now.tsx",
  "client/src/pages/Why.tsx",
  "client/src/pages/Watch.tsx",
  "client/src/pages/Act.tsx",
  "client/src/pages/Outlook.tsx",
  "client/src/pages/RisingStars.tsx",
  "client/src/pages/RisingStarDetail.tsx",
  "client/src/pages/DecisionLedger.tsx",
  "client/src/pages/SmartDiscovery.tsx",
  "client/src/pages/IntelligenceLibrary.tsx",
  "client/src/pages/IntelligenceLibraryPost.tsx",
  "client/src/pages/DailyBriefPost.tsx",
  "client/src/pages/SignalDetail.tsx",
  "client/src/pages/DayTradeDetail.tsx",
  "client/src/pages/SeismographIntelligence.tsx",
  "client/src/pages/AshaIntelligenceCenter.tsx",
] as const;

const CHROME_SURFACES = [
  "client/src/components/AshaIntroModal.tsx",
  "client/src/components/AppLayout.tsx",
  "client/src/components/LeftNavDrawer.tsx",
  "client/src/pages/ToolsHome.tsx",
  "shared/routeRegistry.ts",
] as const;

describe("customer-visible PLATO copy on intro + ASK surfaces", () => {
  const intro = read("client/src/components/AshaIntroModal.tsx");
  const summon = read("client/src/components/AshaSummon.tsx");
  const center = read("client/src/pages/AshaIntelligenceCenter.tsx");
  const engine = read("server/ashaEngine.ts");

  it("introduces PLATO as the Spirit of FAULTLINE and never says I am ASHA", () => {
    expect(intro).toContain("I am PLATO, the Spirit of FAULTLINE.");
    expect(intro).toContain("}}>PLATO</div>");
    expect(intro).toContain("The Spirit of FAULTLINE");
    expect(intro).not.toContain("I am ASHA");
    expect(intro).not.toMatch(ASHA_CTA);
    expect(engine).toContain("I am PLATO, the Spirit of FAULTLINE.");
    expect(engine).not.toContain("I am ASHA");
  });

  it("keeps the persistent utility id as asha while showing PLATO", () => {
    expect(PERSISTENT_UTILITY_BY_ID.asha.id).toBe("asha");
    expect(PERSISTENT_UTILITY_BY_ID.asha.path).toBe("/app/asha");
    expect(PERSISTENT_UTILITY_BY_ID.asha.analyticsId).toBe("utility_asha");
    expect(PERSISTENT_UTILITY_BY_ID.asha.label).toBe("PLATO");
    expect(PERSISTENT_UTILITY_BY_ID.asha.label).not.toBe("ASHA");
  });

  it("replaces ASK ASHA / Open ASHA CTAs with PLATO on product surfaces", () => {
    for (const relativePath of ASK_CTA_SURFACES) {
      const source = read(relativePath);
      expect(source, relativePath).not.toMatch(ASHA_CTA);
      expect(source, relativePath).toMatch(PLATO_CTA);
    }
  });

  it("removes customer-visible ASHA CTAs from related product chrome", () => {
    for (const relativePath of CHROME_SURFACES) {
      const source = read(relativePath);
      expect(source, relativePath).not.toMatch(ASHA_CTA);
      expect(source, relativePath).toContain("PLATO");
    }
  });

  it("shows PLATO on the summon chrome and intelligence-center heading", () => {
    expect(summon).toContain("PLATO");
    expect(summon).toContain("Ask PLATO anything...");
    expect(summon).not.toMatch(/\n\s+ASHA\n/);
    expect(center).toContain("PLATO Intelligence");
    expect(center).not.toContain("ASHA Intelligence");
    expect(center).not.toContain("Ask ASHA");
    expect(center).not.toContain("ASK ASHA");
  });

  it("uses Ask PLATO placeholders with no ASHA residual", () => {
    expect(getAskPlaceholder("global", null)).toBe("Ask PLATO about markets, risk, and opportunities…");
    expect(getAskPlaceholder("stock", "NVDA")).toBe("Ask PLATO about NVDA…");
    expect(getAskPlaceholder("macro", null)).not.toContain("ASHA");
  });
});
