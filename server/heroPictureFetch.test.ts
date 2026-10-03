/**
 * QA final pass (e9d45f9) hero item: WebKit fetched the 5.4 MB jpg fallback
 * because React sets <img src> on the detached element, before it is inside
 * the <picture>. The src is now set from the ref (element already in the
 * <picture>, same commit), not via loading="lazy", so LCP is not deferred.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "client/src/pages/MarketingSite.tsx"), "utf8");
const picture = page.slice(page.indexOf("<picture"), page.indexOf("</picture>") + "</picture>".length);
const imgStart = picture.indexOf("<img\n");
const img = picture.slice(imgStart, picture.indexOf("/>", imgStart) + 2);

describe("hero <picture> fetches only the selected AVIF/WebP", () => {
  it("keeps the AVIF then WebP sources ahead of the img", () => {
    expect(picture.indexOf('<source type="image/avif" srcSet={HERO_BACKGROUND_SRCSET.avif} sizes="100vw" />')).toBeGreaterThan(0);
    expect(picture.indexOf('<source type="image/webp"')).toBeGreaterThan(picture.indexOf('<source type="image/avif"'));
    expect(imgStart).toBeGreaterThan(picture.indexOf('<source type="image/webp"'));
    expect(picture.match(/<img\n/g)).toHaveLength(1);
    expect(page).toContain('const HERO_BACKGROUND = "/faultline_hero_bg_7d6aaf14.jpg";');
  });

  it("does not give React a src (or srcSet) to set on the detached img; the ref sets the fallback", () => {
    expect(img).toContain("ref={setHeroBackgroundSrc}");
    expect(img).not.toMatch(/\bsrc(?:Set)?=/);
    expect(page).toMatch(/function setHeroBackgroundSrc\(img: HTMLImageElement \| null\) \{\n  if \(img && !img\.getAttribute\("src"\)\) img\.src = HERO_BACKGROUND;\n\}/);
  });

  it("does not lazy-load or deprioritise the LCP image", () => {
    expect(img).not.toMatch(/loading=|fetchPriority=|fetchpriority=/);
    expect(img).toContain('decoding="async"');
    expect(img).toContain('className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-35"');
  });
});
