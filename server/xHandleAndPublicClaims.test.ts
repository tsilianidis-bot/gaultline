import { describe, it, expect } from "vitest";
import { STATIC_ASSET_PATH } from "./_core/vite";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("X handle points at @GetFAULTline", () => {
  const html = read("client/index.html");
  it("twitter:site and twitter:creator use @GetFAULTline", () => {
    expect(html).toMatch(/name="twitter:site" content="@GetFAULTline"/);
    expect(html).toMatch(/name="twitter:creator" content="@GetFAULTline"/);
  });
  it("JSON-LD sameAs uses https://x.com/GetFAULTline", () => {
    expect(html).toContain("https://x.com/GetFAULTline");
  });
  it("no reference to the unrelated @faultline account", () => {
    for (const f of ["client/index.html", "server/seoMeta.ts"]) {
      const s = read(f);
      expect(s).not.toMatch(/@faultline\b/);
      expect(s).not.toMatch(/(twitter|x)\.com\/faultline\b/i);
    }
  });
  it("large-image card with absolute og:image", () => {
    expect(html).toMatch(/name="twitter:card" content="summary_large_image"/);
    expect(html).toMatch(/property="og:image" content="https:\/\/getfaultline\.live\/og-image\.jpg"/);
  });
  it("og-image.jpg ships as a real JPEG static asset", () => {
    const buf = readFileSync(path.join(root, "client/public/og-image.jpg"));
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
    expect(buf.length).toBeGreaterThan(10_000);
  });
});

describe("public marketing pages carry no prices or unverifiable social proof", () => {
  const pages = [
    "client/src/pages/PressureIndex.tsx",
    "client/src/pages/Press.tsx",
    "client/src/pages/TrustCenter.tsx",
    "client/src/pages/seo/vs/VsBloomberg.tsx",
  ];
  for (const p of pages) {
    it(`${p} has no $ plan prices`, () => {
      expect(read(p)).not.toMatch(/\$(49|59|99)\b/);
    });
  }
  it("/pressure-index has no social-proof, pricing or checkout CTA", () => {
    const s = read("client/src/pages/PressureIndex.tsx");
    expect(s).not.toMatch(/Join thousands/i);
    expect(s).not.toMatch(/Updated every 60 seconds/i);
    expect(s).not.toContain("PRICING_PLANS");
    expect(s).not.toMatch(/priceLabel|checkout|VIEW ALL PLANS/i);
    expect(s).toContain("SIGN IN / CREATE FREE ACCOUNT");
  });
});

describe("brand image assets ship as real images", () => {
  const isPng = (b: Buffer) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  it("favicons, apple-touch-icon and JSON-LD logo exist as PNG/ICO", () => {
    for (const f of ["favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "logo.png"]) {
      expect(isPng(readFileSync(path.join(root, "client/public", f)))).toBe(true);
    }
    const ico = readFileSync(path.join(root, "client/public/favicon.ico"));
    expect([ico[0], ico[1], ico[2], ico[3]]).toEqual([0, 0, 1, 0]);
  });
  it("index.html references only assets that exist", () => {
    const html = read("client/index.html");
    for (const href of ["/favicon.ico", "/favicon-32x32.png", "/favicon-16x16.png", "/apple-touch-icon.png"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('"logo": "https://getfaultline.live/logo.png"');
    expect(html).not.toContain("og-image-bdEKVbA3WK3ezH3oYRjdJP");
  });
});

describe("static asset paths never fall through to the SPA shell", () => {
  it("matches image/icon/font/script paths", () => {
    for (const p of ["/og-image.jpg", "/favicon.ico", "/apple-touch-icon.png", "/x.svg", "/assets/a-1.js", "/a.css", "/f.woff2"]) {
      expect(STATIC_ASSET_PATH.test(p)).toBe(true);
    }
  });
  it("does not match SPA routes or server text routes", () => {
    for (const p of ["/", "/pressure-index", "/press", "/robots.txt", "/sitemap.xml", "/manifest.json", "/app/signals"]) {
      expect(STATIC_ASSET_PATH.test(p)).toBe(false);
    }
  });
});

describe("public landing CTAs do not imply a purchasable upgrade", () => {
  for (const f of ["client/src/pages/PublicLandingPage.tsx", "client/src/pages/SEOLandingPage.tsx"]) {
    it(`${f} has no 'Upgrade when you need more'`, () => {
      const s = read(f);
      expect(s).not.toMatch(/Upgrade when you need more/i);
      expect(s).toContain("Paid plans are not on sale.");
    });
  }
});

describe("paid plans are not on sale: no prices in app, email or chat copy", () => {
  const appFiles = [
    "client/src/pages/Watchlist.tsx",
    "client/src/pages/UserAccount.tsx",
    "client/src/pages/mobile/MobileUpgrade.tsx",
    "client/src/pages/mobile/MobileAccount.tsx",
    "client/src/components/MobileLayout.tsx",
    "client/src/components/PremiumGate.tsx",
    "client/src/components/ProductExperience.tsx",
    "server/email.ts",
  ];
  for (const f of appFiles) {
    it(`${f} shows no $9.99/$49/$59/$99/$299 plan prices`, () => {
      const s = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(s).not.toMatch(/\$(9\.99|49|59|99|299)(?![\d])/);
    });
  }
  it("shared tiers display labels are neutral while amounts stay configured", async () => {
    const t = await import("../shared/tiers");
    expect(t.PAID_PLANS_ON_SALE).toBe(false);
    for (const id of ["core", "premium", "founding", "lifetime"] as const) {
      expect(t.PRICING_PLANS[id].priceLabel).toBe(t.PLAN_NOT_ON_SALE_LABEL);
    }
    expect(t.PRICING_PLANS.core.amountCents).toBe(5900);
    expect(t.PRICING_PLANS.premium.amountCents).toBe(9900);
    expect(t.PRICING_PLANS.founding.amountCents).toBe(4900);
  });
  it("drip emails carry no prices, scarcity counts or buy CTAs", async () => {
    const e = await import("./email");
    for (const m of [e.buildDay2UpgradeEmail({ name: "A B", email: "a@b.c" }), e.buildDay3FoundingEmail({ name: "A B", email: "a@b.c" })]) {
      expect(m.html + m.subject).not.toMatch(/\$\d/);
      expect(m.html + m.subject).not.toMatch(/spots|rate goes up|Lock In|Upgrade to Core/i);
      expect(m.html).toContain("Paid plans");
    }
  });
});

describe("accurate public titles and copy", () => {
  it("/pressure-index title is not 'Live …'", () => {
    for (const f of ["server/seoMeta.ts", "client/src/pages/PressureIndex.tsx"]) {
      expect(read(f)).toContain("FAULTLINE Pressure Index: Systemic Market Risk Score");
      expect(read(f)).not.toContain("Live Systemic Market Risk Score");
    }
    expect(read("client/src/pages/PressureIndex.tsx")).not.toContain("Institutional-grade systemic risk, quantified.");
  });
  it("SSR meta descriptions do not claim real-time data", () => {
    const lines = read("server/seoMeta.ts").split("\n").filter((l) => /^\s*(title|description):/.test(l));
    for (const l of lines) expect(l).not.toMatch(/real-?time/i);
  });
  it("/trust tab row wraps on narrow screens and the vector grid collapses", () => {
    const s = read("client/src/pages/TrustCenter.tsx");
    expect(s).toContain('className="flex flex-wrap sm:flex-nowrap sm:overflow-x-auto"');
    expect(s).not.toContain('gridTemplateColumns: "180px 60px 1fr"');
  });
});
