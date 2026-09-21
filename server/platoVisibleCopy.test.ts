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

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const REMAINING_VISIBLE_SURFACES = [
  "client/src/components/AshaDailyGreeting.tsx",
  "client/src/pages/Dashboard.tsx",
  "client/src/components/AshaIntelligenceBrief.tsx",
  "client/src/pages/UserAccount.tsx",
  "client/src/components/OnboardingVideoModal.tsx",
  "client/src/pages/PromoRedeem.tsx",
  "client/src/pages/Roadmap.tsx",
  "client/src/pages/ReadingHistory.tsx",
] as const;

const SECTION_BOUNDARY_SURFACES = [
  "client/src/pages/Dashboard.tsx",
  "client/src/pages/UniversalSymbolIntelligence.tsx",
  "client/src/pages/PressureIndex.tsx",
  "client/src/pages/SituationRoom.tsx",
  "client/src/pages/SeismographIntelligence.tsx",
  "client/src/pages/CryptoIntelligence.tsx",
] as const;

describe("remaining customer-visible PLATO copy", () => {
  const greeting = read("client/src/components/AshaDailyGreeting.tsx");
  const dashboard = read("client/src/pages/Dashboard.tsx");
  const brief = read("client/src/components/AshaIntelligenceBrief.tsx");
  const account = read("client/src/pages/UserAccount.tsx");
  const onboarding = read("client/src/components/OnboardingVideoModal.tsx");
  const promo = read("client/src/pages/PromoRedeem.tsx");
  const roadmap = read("client/src/pages/Roadmap.tsx");
  const history = read("client/src/pages/ReadingHistory.tsx");
  const engine = read("server/ashaEngine.ts");
  const memory = read("server/routers/ashaMemory.ts");
  const discovery = read("server/routers/smartDiscovery.ts");

  it("has no customer-visible ASHA token on remaining product surfaces (internal identifiers allowed)", () => {
    for (const relativePath of REMAINING_VISIBLE_SURFACES) {
      const visible = stripComments(read(relativePath));
      expect(visible, relativePath).not.toMatch(/\bASHA\b/);
    }
  });

  it("shows PLATO on daily greeting, dashboard identity, and intelligence brief chrome", () => {
    expect(greeting).toContain("PLATO · DAILY BRIEFING");
    expect(greeting).not.toContain("ASHA · DAILY BRIEFING");

    expect(dashboard).toContain("PLATO · FAULTLINE INTELLIGENCE LAYER");
    expect(dashboard).not.toContain("ASHA · FAULTLINE INTELLIGENCE LAYER");
    expect(dashboard).toContain(">PLATO:</span>");
    expect(dashboard).not.toContain(">ASHA:</span>");

    expect(brief).toContain("PLATO MARKET BRIEF");
    expect(brief).toContain("PLATO SEISMIC REPORT");
    expect(brief).toContain("PLATO PRESSURE BRIEF");
    expect(brief).toContain("PLATO INTERPRETATION");
    expect(brief).toContain("PLATO CRYPTO RISK BRIEF");
    expect(brief).toContain("PLATO COMMAND BRIEF");
    expect(brief).toContain("PLATO MONITORING");
    expect(brief).toContain("WHY IS PLATO SAYING THIS?");
    expect(brief).toContain("PLATO interprets live data from FAULTLINE's engine network.");
    expect(brief).toContain("PLATO · FAULTLINE INTELLIGENCE SYSTEM · NOT FINANCIAL ADVICE");
    expect(brief).toContain("Provide a PLATO Intelligence Brief");
    expect(brief).not.toContain("ASHA MARKET BRIEF");
    expect(brief).not.toContain("ASHA MONITORING");
    expect(brief).not.toContain("WHY IS ASHA SAYING THIS?");
    expect(brief).not.toContain("ASHA interprets live data");
    expect(brief).not.toContain("ASHA · FAULTLINE INTELLIGENCE SYSTEM");
    expect(brief).not.toContain("Provide an ASHA Intelligence Brief");
    expect(brief).toContain("ashaMonitoring");
  });

  it("shows PLATO on account, onboarding, promo, roadmap, and reading-history copy", () => {
    expect(account).toContain("after each PLATO greeting");
    expect(account).not.toContain("ASHA greeting");
    expect(onboarding).toContain("regime probabilities, and PLATO.");
    expect(onboarding).not.toContain("and ASHA");
    expect(promo).toContain("PLATO Intelligence Engine");
    expect(promo).toContain("PLATO Intelligence");
    expect(promo).not.toContain("ASHA Intelligence");
    expect(roadmap).toContain("written by PLATO");
    expect(roadmap).toContain("Tailored PLATO responses and briefings");
    expect(roadmap).toContain("Seismograph, PLATO, Signals");
    expect(roadmap).not.toMatch(/\bASHA\b/);
    expect(history).toContain("Pressure Index, PLATO, and all real-time intelligence features");
    expect(history).not.toMatch(/\bASHA\b/);
  });

  it("renders PLATO on SectionErrorBoundary labels that customers can see", () => {
    for (const relativePath of SECTION_BOUNDARY_SURFACES) {
      const source = read(relativePath);
      expect(source, relativePath).not.toContain('label="ASHA Intelligence"');
      expect(source, relativePath).not.toContain('label="ASHA Greeting"');
    }
    expect(dashboard).toContain('label="PLATO Greeting"');
    expect(dashboard).toContain('label="PLATO Intelligence"');
  });

  it("identifies the assistant as PLATO in user-facing model prompts without renaming internals", () => {
    expect(engine).toContain("You are PLATO, the Spirit of FAULTLINE.");
    expect(engine).toContain("Your name is PLATO.");
    expect(engine).not.toContain("You are ASHA");
    expect(engine).not.toContain("Your name is ASHA");
    expect(engine).toContain("const ASHA_IDENTITY");
    expect(engine).toContain('createInterpretationTransaction("ASHA"');

    expect(memory).toContain("You are PLATO");
    expect(memory).not.toContain("You are ASHA");

    expect(discovery).toContain("You are PLATO, FAULTLINE's evidence-bound market interpretation layer.");
    expect(discovery).toContain("You are PLATO — the intelligence layer of FAULTLINE.");
    expect(discovery).not.toContain("You are ASHA");
  });
});
