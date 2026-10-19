import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRICING_PLANS, MARKETING_TIER_CARDS } from "../shared/tiers";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

const TOUCHED = {
  app: read("client/src/App.tsx"),
  marketing: read("client/src/pages/MarketingSite.tsx"),
  productExperience: read("client/src/components/ProductExperience.tsx"),
  cinematic: read("client/src/components/CinematicIntro.tsx"),
  audio: read("client/src/lib/CinematicAudioEngine.ts"),
  authGate: read("client/src/components/CinematicAuthGate.tsx"),
  briefing: read("client/src/components/AshaLiveBriefing.tsx"),
  guide: read("client/src/pages/Guide.tsx"),
  about: read("client/src/pages/About.tsx"),
  press: read("client/src/pages/Press.tsx"),
  trustCenter: read("client/src/pages/TrustCenter.tsx"),
  consts: read("client/src/const.ts"),
} as const;

describe("cinematic + marketing preservation plan", () => {
  it("offers Lifetime only at $1,500 one-time and never the retired $299 founding lifetime", () => {
    expect(PRICING_PLANS.lifetime.available).toBe(true);
    expect(PRICING_PLANS.lifetime.amountCents).toBe(150000);

    for (const [name, source] of Object.entries({
      marketing: TOUCHED.marketing,
      productExperience: TOUCHED.productExperience,
      cinematic: TOUCHED.cinematic,
      authGate: TOUCHED.authGate,
      briefing: TOUCHED.briefing,
      about: TOUCHED.about,
      press: TOUCHED.press,
      trustCenter: TOUCHED.trustCenter,
    })) {
      expect(source, name).not.toContain("GET LIFETIME ACCESS — $299");
      expect(source, name).not.toContain("GET FOUNDING LIFETIME ACCESS — $299");
      expect(source, name).not.toContain("LIMITED TIME LIFETIME ACCESS");
      expect(source, name).not.toContain("FOUNDING LIFETIME ACCESS");
    }

    expect(TOUCHED.app).not.toContain("planId: 'lifetime'");
    expect(TOUCHED.app).toContain("if (intent === 'lifetime')");
    expect(TOUCHED.app).toContain("localStorage.removeItem(CHECKOUT_INTENT_KEY)");
    expect(TOUCHED.app).not.toContain("createCheckout");
  });

  it("shared plan cards show only Standard $99/month and Lifetime $1,500 one-time", () => {
    expect(MARKETING_TIER_CARDS.map((card) => [card.planId, card.price])).toEqual([
      ["premium", "$99/month"],
      ["lifetime", "$1,500 one-time"],
    ]);
    expect(MARKETING_TIER_CARDS.find((card) => card.tier === "core")).toBeUndefined();

    expect(TOUCHED.marketing).not.toContain("MARKETING_TIER_CARDS");
    expect(TOUCHED.marketing).not.toContain("TIER_META.free");
    expect(TOUCHED.marketing).not.toContain("trader.marketingName");
    expect(TOUCHED.marketing).not.toContain("power.marketingName");
    expect(TOUCHED.marketing).not.toContain("founding.marketingName");
    expect(TOUCHED.marketing).not.toContain("Observer");
    expect(TOUCHED.marketing).not.toContain("Everything in Pro");
    expect(TOUCHED.productExperience).not.toMatch(/price: '\$(49|59|299)'/);
  });

  it("does not mount ProductExperience on first-run and preserves the source module", () => {
    expect(TOUCHED.app).not.toMatch(/<ProductExperience\b/);
    expect(TOUCHED.app).toContain("ProductExperience is preserved in source");
    expect(TOUCHED.productExperience).toContain("export default function ProductExperience");
  });

  it("plays ~12.1s cinematic then MarketingSite, with skip, mute, and fl_cinematic_completed_v1", () => {
    expect(TOUCHED.cinematic).toContain("12100");
    expect(TOUCHED.cinematic).toContain("SKIP INTRO");
    expect(TOUCHED.cinematic).toContain("TAP FOR SOUND");
    expect(TOUCHED.cinematic).toContain("toggleMute");
    expect(TOUCHED.audio).toContain("isAutoplayBlocked");
    expect(TOUCHED.audio).toContain("toggleMute");
    expect(TOUCHED.app).toContain("fl_cinematic_completed_v1");
    expect(TOUCHED.app).toContain("<MarketingSite />");
    expect(TOUCHED.app).toContain("isProductPath");
    expect(TOUCHED.app).toContain("showAuthGate");
    expect(TOUCHED.app).toContain("showPlatoBriefing");
  });

  it("uses PLATO as the only customer-visible AI name on touched surfaces", () => {
    expect(TOUCHED.marketing).toContain("PLATO market explanation");
    expect(TOUCHED.marketing).not.toMatch(/\bASHA\b/);
    expect(TOUCHED.cinematic).toContain("PLATO");
    expect(TOUCHED.cinematic).not.toContain(">\n                ASHA\n");
    expect(TOUCHED.authGate).toContain("PLATO will greet you once your identity is confirmed.");
    expect(TOUCHED.authGate).toContain("PLATO · FAULTLINE INTELLIGENCE LAYER");
    // #58 r9: the middle dot is a JS string expression, so it renders as "·" and not as a literal "\\u00b7".
    expect(TOUCHED.briefing).toContain('PLATO {"\\u00b7"} FAULTLINE INTELLIGENCE LAYER');
    expect(TOUCHED.guide).toContain("Ask PLATO");
    expect(TOUCHED.guide).not.toContain("Ask ASHA");
    expect(TOUCHED.productExperience).toContain("PLATO synthesizes");
    expect(TOUCHED.productExperience).not.toContain("ASHA synthesizes");
    expect(TOUCHED.press).toContain("PLATO");
    expect(TOUCHED.press).not.toMatch(/\bASHA\b/);
    expect(TOUCHED.trustCenter).toContain("What is PLATO?");
    expect(TOUCHED.trustCenter).not.toMatch(/\bASHA\b/);
  });

  it("uses founder JT and removes RICHARD ROPER from public surfaces", () => {
    expect(TOUCHED.about).toContain("JT");
    expect(TOUCHED.about).not.toContain("RICHARD ROPER");
    expect(TOUCHED.marketing).not.toContain("RICHARD ROPER");
    expect(TOUCHED.press).not.toContain("RICHARD ROPER");
    expect(TOUCHED.trustCenter).not.toContain("RICHARD ROPER");
    expect(TOUCHED.productExperience).toContain(">JT</div>");
    expect(TOUCHED.productExperience).not.toContain("RICHARD ROPER");
  });

  it("keeps SIGN IN as a safe CTA with no empty href", () => {
    expect(TOUCHED.marketing).toContain("handleLoginCtaClick");
    expect(TOUCHED.marketing).toContain("function SignInCta");
    expect(TOUCHED.marketing).not.toMatch(/href=\{getLoginUrl\(\)\}/);
    expect(TOUCHED.consts).toContain("export function handleLoginCtaClick");
  });
});
