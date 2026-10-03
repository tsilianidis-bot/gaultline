import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPageMeta, injectPageMeta } from "./seoMeta";

const root = process.cwd();
const homepage = readFileSync(resolve(root, "client/index.html"), "utf8");
const marketingPage = readFileSync(resolve(root, "client/src/pages/MarketingSite.tsx"), "utf8");
const robots = readFileSync(resolve(root, "client/public/robots.txt"), "utf8");
const sitemap = readFileSync(resolve(root, "client/public/sitemap.xml"), "utf8");

describe("Market Risk Intelligence SEO positioning", () => {
  const homepageTitle = "FAULTLINE | Structural Market Intelligence";

  it("keeps FAULTLINE as the master brand while applying the approved homepage category descriptor", () => {
    expect(getPageMeta("/").title).toBe(homepageTitle);
    expect(homepage).toContain(`<title>${homepageTitle.replace("&", "&amp;")}</title>`);
    expect(marketingPage).toContain("FAULTLINE STRUCTURAL MARKET INTELLIGENCE");
    expect(marketingPage).toContain(">STRUCTURAL MARKET INTELLIGENCE<");
    expect(marketingPage).toContain("See the pressure before the break.");
    expect(marketingPage).not.toMatch(/see the fault before the break/i);
    expect(homepage).not.toMatch(/see the fault before the break/i);
  });

  it("uses matching primary, Open Graph, Twitter, canonical, and indexability metadata on the homepage", () => {
    const html = injectPageMeta(homepage, "/");
    expect((html.match(/<title>/g) ?? [])).toHaveLength(1);
    expect(html).toContain('property="og:title" content="FAULTLINE | Structural Market Intelligence"');
    expect(html).toContain('name="twitter:title" content="FAULTLINE | Structural Market Intelligence"');
    expect(html).toContain('rel="canonical" href="https://getfaultline.live"');
    expect(html).not.toContain('name="robots" content="noindex,follow"');
  });

  it("preserves one FAULTLINE Organization schema with a market risk intelligence description", () => {
    expect(homepage.match(/"@type": "Organization"/g) ?? []).toHaveLength(1);
    expect(homepage).toContain('"name": "FAULTLINE"');
    expect(homepage).toContain('"description": "FAULTLINE is a market risk intelligence platform');
  });

  it("keeps SoftwareApplication structured data free of prices, offers, and ratings", () => {
    const softwareApp = homepage.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(softwareApp?.[1]).toBeTruthy();
    const schema = JSON.parse(softwareApp![1]);
    expect(schema["@type"]).toBe("SoftwareApplication");
    expect(schema.offers).toBeUndefined();
    expect(schema.aggregateRating).toBeUndefined();
    expect(homepage).not.toContain('"@type": "Offer"');
    expect(homepage).not.toContain('"name": "Founding Lifetime"');
    expect(homepage).not.toContain('"price": "59.00"');
    expect(homepage).not.toContain('"price": "99.00"');
    expect(homepage).not.toContain('"price": "49.00"');
    expect(homepage).not.toContain('"price": "299.00"');
    expect(homepage).not.toContain('"price": "9.99"');
  });

  it("gives eligible public risk pages distinct, content-aligned search-intent titles", () => {
    expect(getPageMeta("/market-crash-probability-2026").title).toBe("Market Crash Risk 2026 | FAULTLINE");
    expect(getPageMeta("/recession-probability").title).toBe("Recession Risk Context | FAULTLINE");
    expect(getPageMeta("/bitcoin-risk-dashboard").title).toBe("Bitcoin Risk Indicator | FAULTLINE");
    expect(getPageMeta("/stock-market-risk-dashboard").title).toBe("Stock Market Risk Today | FAULTLINE");
    expect(getPageMeta("/market-regime-tracker").title).toBe("Market Regime Tracker | FAULTLINE");
    expect(getPageMeta("/ai-bubble-risk-tracker").title).toBe("AI Bubble Risk Monitor | FAULTLINE");
  });

  it("preserves public crawl directives and sitemap discovery for the targeted pages", () => {
    expect(robots).toContain("Disallow: /app/");
    expect(robots).toContain("Allow: /market-regime-tracker");
    expect(sitemap).toContain("https://getfaultline.live/market-crash-probability-2026");
    expect(sitemap).toContain("https://getfaultline.live/bitcoin-risk-dashboard");
  });
});
