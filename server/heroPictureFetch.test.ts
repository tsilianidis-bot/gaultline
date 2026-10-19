import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");
const page = read("client/src/pages/MarketingSite.tsx");
const hero = read(
  "client/src/components/marketing/MarketingIntelligenceHero.tsx"
);

describe("premium hero avoids unnecessary raster downloads", () => {
  it("uses the approved topology instead of fetching the retired photographic background", () => {
    expect(page).toContain("return <MarketingIntelligenceHero />");
    expect(hero).toMatch(/<CoreTopology\s+model=\{model\}/);
    expect(page).not.toMatch(/HERO_BACKGROUND|<picture|setHeroBackgroundSrc/);
    expect(hero).not.toMatch(/<img|<picture|\.jpg|\.avif|\.webp/);
  });
  it("renders the headline directly without counter animation or a simulated score", () => {
    expect(hero).toContain('<h1 id="premium-hero-title">');
    expect(hero).not.toMatch(
      /AnimatedNumber|requestAnimationFrame|setInterval|Math\.random/
    );
    expect(hero).toContain("createUnavailableCore(");
  });
  it("uses browser CSS motion with explicit offscreen and accessibility suspension", () => {
    expect(hero).toContain("IntersectionObserver");
    expect(hero).toContain("prefers-reduced-motion: reduce");
    expect(hero).toMatch(
      /data-motion=\{\s*paused \|\| !inView \|\| !visible \|\| reducedMotion/
    );
  });
});
