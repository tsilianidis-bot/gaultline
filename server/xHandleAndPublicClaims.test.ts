import { describe, it, expect } from "vitest";
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
