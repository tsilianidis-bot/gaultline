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
  const homepageTitle = "FAULTLINE | Market Risk Intelligence, Systemic Risk & Early Warning Signals";

  it("keeps FAULTLINE as the master brand while applying the approved homepage category descriptor", () => {
    expect(getPageMeta("/").title).toBe(homepageTitle);
    expect(homepage).toContain(`<title>${homepageTitle.replace("&", "&amp;")}</title>`);
    expect(marketingPage).toContain("FAULTLINE MARKET RISK INTELLIGENCE");
    expect(marketingPage).toContain("MARKET RISK INTELLIGENCE");
  });

  it("uses matching primary, Open Graph, Twitter, canonical, and indexability metadata on the homepage", () => {
    const html = injectPageMeta(homepage, "/");
    expect((html.match(/<title>/g) ?? [])).toHaveLength(1);
    expect(html).toContain('property="og:title" content="FAULTLINE | Market Risk Intelligence, Systemic Risk &amp; Early Warning Signals"');
    expect(html).toContain('name="twitter:title" content="FAULTLINE | Market Risk Intelligence, Systemic Risk &amp; Early Warning Signals"');
    expect(html).toContain('rel="canonical" href="https://getfaultline.live"');
    expect(html).not.toContain('name="robots" content="noindex,follow"');
  });

  it("preserves one FAULTLINE Organization schema with a market risk intelligence description", () => {
    expect(homepage.match(/"@type": "Organization"/g) ?? []).toHaveLength(1);
    expect(homepage).toContain('"name": "FAULTLINE"');
    expect(homepage).toContain('"description": "FAULTLINE is a market risk intelligence platform');
  });

  it("gives eligible public risk pages distinct, content-aligned search-intent titles", () => {
    expect(getPageMeta("/market-crash-probability-2026").title).toBe("Market Crash Probability | FAULTLINE");
    expect(getPageMeta("/recession-probability").title).toBe("Recession Probability | FAULTLINE");
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
