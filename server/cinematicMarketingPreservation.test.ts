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
  consts: read("client/src/const.ts"),
} as const;

describe("cinematic + marketing preservation plan", () => {
  it("keeps Lifetime internally available:false and does not advertise it publicly", () => {
    expect(PRICING_PLANS.lifetime.available).toBe(false);
    expect(PRICING_PLANS.lifetime.amountCents).toBe(29900);

    for (const [name, source] of Object.entries({
      marketing: TOUCHED.marketing,
      productExperience: TOUCHED.productExperience,
      cinematic: TOUCHED.cinematic,
      authGate: TOUCHED.authGate,
      briefing: TOUCHED.briefing,
      about: TOUCHED.about,
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

  it("presents Free / Trader $59 / Power $99 / Founding $49/mo from shared cards", () => {
    const trader = MARKETING_TIER_CARDS.find((card) => card.tier === "core");
    const power = MARKETING_TIER_CARDS.find((card) => card.tier === "premium");
    const founding = MARKETING_TIER_CARDS.find((card) => card.tier === "founding");
    expect(trader?.price).toBe("$59/mo");
    expect(power?.price).toBe("$99/mo");
    expect(founding?.price).toContain("$49/mo");

    expect(TOUCHED.marketing).toContain("MARKETING_TIER_CARDS");
    expect(TOUCHED.marketing).toContain("TIER_META.free");
    expect(TOUCHED.marketing).toContain("trader.marketingName");
    expect(TOUCHED.marketing).toContain("power.marketingName");
    expect(TOUCHED.marketing).toContain("founding.marketingName");
    expect(TOUCHED.marketing).not.toContain("Observer");
    expect(TOUCHED.marketing).not.toContain("Everything in Pro");
    expect(TOUCHED.productExperience).toContain("id: 'free'");
    expect(TOUCHED.productExperience).toContain("id: 'trader'");
    expect(TOUCHED.productExperience).toContain("id: 'power'");
    expect(TOUCHED.productExperience).toContain("id: 'founding'");
    expect(TOUCHED.productExperience).toContain("price: '$59'");
    expect(TOUCHED.productExperience).toContain("price: '$99'");
    expect(TOUCHED.productExperience).toContain("price: '$49'");
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
    expect(TOUCHED.briefing).toContain("PLATO \\u00b7 FAULTLINE INTELLIGENCE LAYER");
    expect(TOUCHED.guide).toContain("Ask PLATO");
    expect(TOUCHED.guide).not.toContain("Ask ASHA");
    expect(TOUCHED.productExperience).toContain("PLATO synthesizes");
    expect(TOUCHED.productExperience).not.toContain("ASHA synthesizes");
  });

  it("uses founder JT and removes RICHARD ROPER from public surfaces", () => {
    expect(TOUCHED.about).toContain("JT");
    expect(TOUCHED.about).not.toContain("RICHARD ROPER");
    expect(TOUCHED.marketing).not.toContain("RICHARD ROPER");
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
