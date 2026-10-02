import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Truth/Claims guard, PR #56 r7 (Product-QA gate at 5dbc10a, items 4-7).
 *
 * Kept in its own file because server/publicClaimsTruth.test.ts is also
 * changed by the held branch probability/public-copy-on-56.
 *
 * Public pages must not claim FAULTLINE publishes, tracks, or refreshes
 * support/resistance price levels, must not carry undated/unsourced company
 * figures, and the app's validation views must not hard-code engine counts.
 */
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const NO_LEVELS = "FAULTLINE does not publish price targets or support/resistance levels.";

// Files with the same defects that overlap the held branch
// probability/public-copy-on-56 (@159b29a) and were not edited in r7.
// Remove an entry once its file is fixed; the checks below then cover it.
const OVERLAP_PENDING = new Set([
  "client/src/pages/seo/NVDASignal.tsx",
  "client/src/pages/seo/TSLASignal.tsx",
  "client/src/pages/seo/AMDSignal.tsx",
  "client/src/pages/seo/PLTRSignal.tsx",
  "client/src/pages/seo/METASignal.tsx",
]);

const seoPages = walk(join(root, "client/src/pages/seo"))
  .map((p) => p.slice(root.length).replace(/^\//, ""))
  .filter((path) => !OVERLAP_PENDING.has(path))
  .map((path) => ({ path, text: read(path) }));

const liveLevelClaim =
  /FAULTLINE tracks (the following key [^\n]{0,30}price levels|major support zones)|price levels refreshed|support and resistance levels updated|levels are updated as new daily|incorporates the proximity to support|derived from technical analysis and FAULTLINE's signal engine|identifies (optimal entry zones|stop-loss levels)|price-based key levels/i;
const srMetaPhrase = /key support and resistance levels/i;
const unsourcedFigure = /\$130B\+|over \$130 billion|\$60-65 billion|\$60B\+ annual/i;
const engineCount = /\b(?:1[0-9]|ten|eleven|twelve|thirteen|fourteen)\s+(?:FMOS\s+)?engines\b|label: 'Active Engines', value: '\d+'|engineCount \?\? \d+/i;

const offenders = (pages: { path: string; text: string }[], re: RegExp) => pages.filter((p) => re.test(p.text)).map((p) => p.path);

describe("public claims truth: price levels, figures, engine counts (PR #56 r7)", () => {
  it("each pattern flags the original 5dbc10a lines", () => {
    expect("FAULTLINE tracks the following key TAO price levels:").toMatch(liveLevelClaim);
    expect("Critical BTC price levels refreshed as new data is published: major support zones").toMatch(liveLevelClaim);
    expect("FAULTLINE's risk score incorporates the proximity to support vs. resistance as one of its inputs.").toMatch(liveLevelClaim);
    expect("These levels are updated as new daily data arrives from Polygon.io.").toMatch(liveLevelClaim);
    expect("Critical TAO support and resistance levels updated from CoinGecko market data.").toMatch(liveLevelClaim);
    expect("Support, resistance, entry zone, and stop-loss levels for ${ticker} derived from technical analysis and FAULTLINE's signal engine.").toMatch(liveLevelClaim);
    expect("Bitcoin risk dashboard: BTC macro alignment score, key support and resistance levels, liquidity sensitivity").toMatch(srMetaPhrase);
    expect("NVDA is an equity in a profitable semiconductor company with $130B+ in annual revenue.").toMatch(unsourcedFigure);
    expect("{ label: 'Active Engines', value: '14', icon: Cpu, color: 'text-cyan-400' },").toMatch(engineCount);
    expect("All 14 engines compiled and operational - 0 TypeScript errors").toMatch(engineCount);
    expect('FMOS {version?.version ?? "—"} · {version?.engineCount ?? 14} engines').toMatch(engineCount);
    expect("Orchestrates all 13 engines in sequence").toMatch(engineCount);
  });

  it("SEO pages make no live support/resistance claims", () => {
    expect(offenders(seoPages, liveLevelClaim)).toEqual([]);
  });

  it("SEO descriptions drop 'key support and resistance levels'", () => {
    expect(offenders(seoPages, srMetaPhrase)).toEqual([]);
  });

  it("level sections on the fixed pages use the non-publishing line", () => {
    for (const path of [
      "client/src/pages/seo/StockSignalPage.tsx",
      "client/src/pages/seo/TAOSignal.tsx",
      "client/src/pages/seo/BitcoinRiskDashboard.tsx",
      "client/src/pages/seo/EthereumRiskDashboard.tsx",
    ]) {
      expect(read(path), path).toContain(NO_LEVELS);
    }
  });

  it("SEO pages carry no undated, unsourced company revenue or capex figures", () => {
    expect(offenders(seoPages, unsourcedFigure)).toEqual([]);
  });

  it("ValidationLab and FMOS Health do not hard-code engine counts", () => {
    for (const path of ["client/src/pages/ValidationLab.tsx", "client/src/pages/FmosHealthDashboard.tsx"]) {
      expect(read(path), path).not.toMatch(engineCount);
      expect(read(path), path).not.toMatch(/compiled (and operational )?(with )?- ?0 TypeScript errors|compiled with 0 TypeScript errors/);
    }
    expect(read("client/src/pages/ValidationLab.tsx")).toContain("version.engines.length");
    expect(read("client/src/pages/FmosHealthDashboard.tsx")).toContain("{ENGINES.length} FMOS engines");
  });

  it("overlap-pending files still exist (remove from OVERLAP_PENDING once fixed)", () => {
    for (const path of OVERLAP_PENDING) expect(() => read(path)).not.toThrow();
  });
});
