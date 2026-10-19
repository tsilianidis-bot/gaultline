import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createUnavailableCore,
  DOMAIN_LABELS,
} from "../client/src/components/intelligence-core-visual/adapter";
import { CHECKOUT_ENABLED, MARKETING_TIER_CARDS } from "../shared/tiers";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const hero = read(
  "client/src/components/marketing/MarketingIntelligenceHero.tsx"
);
const page = read("client/src/pages/MarketingSite.tsx");
const css = read("client/src/components/marketing/premium-marketing.css");
const app = read("client/src/App.tsx");

describe("isolated premium marketing homepage", () => {
  it("reuses the approved topology and supplies no fictional market state", () => {
    expect(hero).toMatch(/<CoreTopology\s+model=\{model\}/);
    expect(hero).toContain("createUnavailableCore(");
    expect(hero).not.toMatch(
      /createDemo|setInterval|requestAnimationFrame|Math\.random|pressureIndex:|relationships:/
    );
    const model = createUnavailableCore();
    expect(Object.values(DOMAIN_LABELS)).toEqual([
      "Liquidity Stress",
      "Credit Contagion",
      "Volatility Regime",
      "Macro Sensitivity",
      "Market Breadth",
      "AI Bubble Risk",
    ]);
    expect(model.pressure.value).toBeNull();
    expect(model.relationships).toEqual([]);
    expect(
      model.domains.every(
        domain =>
          domain.status === "unavailable" && domain.direction === "unknown"
      )
    ).toBe(true);
  });
  it("labels illustration and separates canonical public evidence", () => {
    expect(hero).toContain("ILLUSTRATIVE VISUALIZATION");
    expect(hero).toMatch(/Not\s+live risk transmission/);
    expect(hero).toMatch(/Lines show organization, not verified\s+causation/);
    expect(page).toContain("<HeroProof />");
    expect(page).toContain("<PublicReadingProof />");
    expect(hero).not.toMatch(/trpc\.|fetch\(|LIVE|verified current/);
  });
  it("supports pausing, offscreen suspension, keyboard/tap inspection and reduced motion", () => {
    expect(hero).toContain("IntersectionObserver");
    expect(hero).toContain("visibilitychange");
    expect(hero).toContain("prefers-reduced-motion: reduce");
    expect(hero).toContain(
      "aria-pressed={paused || reducedMotion || !inView || !visible}"
    );
    expect(hero).toContain("onFocusCapture");
    expect(hero).toMatch(/<Dialog\s+open=/);
    expect(hero).toContain("triggerRef.current?.focus()");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-play-state: paused !important");
    expect(css).toContain("@media (max-width: 700px)");
  });
  it("uses public CTAs without enabling authentication, checkout or demo access", () => {
    expect(hero).toContain('href="/pressure-index"');
    expect(hero).toContain('href="#product-showcase"');
    expect(hero).toContain('href="#access"');
    expect(hero).not.toMatch(
      /\/demo|\/api|createCheckout|handleLogin|register/
    );
    expect(CHECKOUT_ENABLED).toBe(false);
    expect(MARKETING_TIER_CARDS.map(card => card.price)).toEqual([
      "$99/month",
      "$1,500 one-time",
    ]);
    expect(page).toContain("<MembershipOffer />");
    expect(app).toContain("if (user) return <Redirect to={CANONICAL_HOME} />;");
    expect(app).toContain("isProductPath &&");
  });
  it("keeps the full five-question method, history, founder and public crawlable content", () => {
    expect(page).toContain("<PentagonalThesis />");
    expect(page).toContain("<HistoricalContext />");
    expect(page).toContain("<TrustTeaser />");
    expect(page).toContain("— JT");
    const html = read("client/index.html");
    expect(html).toContain(
      "See the pressure building. Understand what it means."
    );
    expect(html).toContain("<noscript>");
    expect(html).toContain('href="https://getfaultline.live/"');
    expect(html).not.toContain('"screenshot":');
  });
});
