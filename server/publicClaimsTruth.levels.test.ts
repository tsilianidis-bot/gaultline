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

const NO_LEVELS = "FAULTLINE does not publish price targets or support/resistance levels on this page.";

// r8: the five signal pages that were overlap-pending in r7 (NVDA, TSLA, AMD,
// PLTR, META) are fixed and covered; keep this empty unless a file is
// deliberately deferred.
const OVERLAP_PENDING = new Set<string>([]);

const seoPages = walk(join(root, "client/src/pages/seo"))
  .map((p) => p.slice(root.length).replace(/^\//, ""))
  .filter((path) => !OVERLAP_PENDING.has(path))
  .map((path) => ({ path, text: read(path) }));

const liveLevelClaim =
  /FAULTLINE tracks (the following key [^\n]{0,30}price levels|major support zones)|price levels refreshed|support and resistance levels updated|levels are updated as new daily|incorporates the proximity to support|derived from technical analysis and FAULTLINE's signal engine|identifies (optimal entry zones|stop-loss levels)|price-based key levels|tracks NVDA's position relative to|Access the latest levels|tracks AI narrative momentum as one of the inputs/i;
const srMetaPhrase = /key support and resistance levels/i;
const unsourcedFigure = /\$130B\+|over \$130 billion|as of mid-2026|\$60-65 billion (annually|annual)|spending \$60-65 billion|\$60B\+ annual/i;
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
    // r8 (3dba6d8 lines on NVDA/META/TSLA)
    expect("NVIDIA's financial metrics as of mid-2026 reflect its extraordinary market position").toMatch(unsourcedFigure);
    expect("AI Infrastructure ROI: Meta is spending $60-65 billion annually on AI infrastructure.").toMatch(unsourcedFigure);
    expect("AI capex ROI concerns (market questioning the return on $60B+ annual AI investment)").toMatch(unsourcedFigure);
    expect("Technical Structure: FAULTLINE tracks NVDA's position relative to key moving averages").toMatch(liveLevelClaim);
    expect("These levels are updated as new daily price data arrives from Polygon.io. Access the latest levels on the FAULTLINE Signals tab.").toMatch(liveLevelClaim);
    expect("FAULTLINE tracks AI narrative momentum as one of the inputs to the TSLA signal.").toMatch(liveLevelClaim);
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

  it("covers the r7 overlap-pending signal pages", () => {
    expect(OVERLAP_PENDING.size).toBe(0);
    for (const path of [
      "client/src/pages/seo/NVDASignal.tsx",
      "client/src/pages/seo/TSLASignal.tsx",
      "client/src/pages/seo/AMDSignal.tsx",
      "client/src/pages/seo/PLTRSignal.tsx",
      "client/src/pages/seo/METASignal.tsx",
    ]) {
      expect(seoPages.some((p) => p.path === path), path).toBe(true);
      expect(read(path), path).toContain(NO_LEVELS + " How technical levels are commonly read:");
    }
  });

  it("the no-levels line is narrowed to 'on this page' wherever it appears", () => {
    const hits: string[] = [];
    for (const page of seoPages) {
      for (const m of page.text.matchAll(/does not publish price targets or support\/resistance levels([^"`\n]{0,14})/g)) {
        if (!m[1].startsWith(" on this page.")) hits.push(`${page.path}: ${m[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("company figures that remain are cited and dated once", () => {
    const nvda = read("client/src/pages/seo/NVDASignal.tsx");
    expect(nvda).toContain("$27.0 billion in fiscal 2023 to $130.5 billion in fiscal 2025 (NVIDIA fiscal-year results releases of February 22, 2023 and February 26, 2025)");
    const meta = read("client/src/pages/seo/METASignal.tsx");
    expect(meta).toContain("In its fourth-quarter 2024 results release (January 29, 2025), Meta guided full-year 2025 capital expenditures of $60–65 billion");
    expect(meta.match(/\$60[–-]65 billion|\$60B/g)?.length).toBe(1);
  });
});

describe("public claims truth: no '$214B' AI capex figure on public pages or SEO (PR #56 r9)", () => {
  // Public and SEO surfaces: every SEO landing page, every Public* page, the
  // marketing/landing/methodology components, client meta (useSEO, index.html),
  // and the server-rendered meta/SSR. App-only files owned by other PRs
  // (AIWatch.tsx and lib/data.ts: #59; Guide.tsx and lib/chartData.ts: #60)
  // are deliberately out of scope here.
  const walkExt = (dir: string, exts: string[]): string[] =>
    readdirSync(join(root, dir)).flatMap((name) => {
      const rel = `${dir}/${name}`;
      return statSync(join(root, rel)).isDirectory() ? walkExt(rel, exts) : exts.some((e) => name.endsWith(e)) ? [rel] : [];
    });
  const surfaces = [
    ...walkExt("client/src/pages/seo", [".tsx", ".ts"]),
    ...readdirSync(join(root, "client/src/pages")).filter((n) => /^Public\w*\.tsx$/.test(n)).map((n) => `client/src/pages/${n}`),
    ...walkExt("client/src/components/landing", [".tsx", ".ts"]),
    ...walkExt("client/src/components/methodology", [".tsx", ".ts"]),
    "client/src/pages/SEOLandingPage.tsx",
    "client/src/pages/MarketingSite.tsx",
    "client/src/pages/Methodology.tsx",
    "client/src/pages/Press.tsx",
    "client/src/pages/About.tsx",
    "client/src/pages/TrustCenter.tsx",
    "client/src/pages/PressureIndex.tsx",
    "client/src/pages/TrackRecord.tsx",
    "client/src/hooks/useSEO.ts",
    "client/index.html",
    "client/public/sitemap.xml",
    "server/seoMeta.ts",
    "server/publicContentSsr.ts",
    "server/seoRoutes.ts",
  ];
  const figure214 = /\$214\s*(B|bn|billion)/i;

  it("flags the original r4 copies", () => {
    expect("Monitor $214B+ in AI capex commitments and the equities most exposed to AI infrastructure spending cycles.").toMatch(figure214);
    expect("Track $214B+ in AI capex commitments and mega-cap concentration.").toMatch(figure214);
    expect("Currently tracking $214 billion in announced AI capex.").toMatch(figure214);
    expect("AI capex reached $214bn in 2024.").toMatch(figure214);
    expect("AI capex reached $214 bn in 2024.").toMatch(figure214);
  });

  it("no public or SEO surface carries the figure", () => {
    expect(surfaces.length).toBeGreaterThan(80);
    expect(surfaces.filter((path) => figure214.test(read(path)))).toEqual([]);
  });

  it("the AIWatch meta and the AI bubble page describe the static baseline instead", () => {
    expect(read("client/src/hooks/useSEO.ts")).toContain("FAULTLINE uses a static AI-concentration baseline and does not ingest AI capex data.");
    expect(read("client/src/pages/PublicAIBubble.tsx")).toContain("FAULTLINE does not ingest capex data.");
  });
});

describe("public claims truth: no 'key levels' claims in SSR meta, JSON-LD, titles or headings (PR #56 r10)", () => {
  // Scanned set: every SEO page (incl. the JSON-LD in the Dynamic stock/crypto
  // templates), the server-rendered meta and SSR, and client meta.
  const metaFiles = ["server/seoMeta.ts", "server/publicContentSsr.ts", "server/seoRoutes.ts", "client/src/hooks/useSEO.ts", "client/index.html"];
  const scanned = [...seoPages, ...metaFiles.map((path) => ({ path, text: read(path) }))];

  // 'FAULTLINE tracks … key (price) levels' style claims.
  const keyLevelsTracking = /FAULTLINE (?:tracks|monitors|covers|provides|publishes|identifies)\b[^.]{0,160}\bkey (?:price )?levels/i;
  // Titles, headings, descriptions and link/feature copy that advertise key levels.
  const keyLevelsLabel = /\b(?:title|seoTitle|heading|headline|subheadline|description|desc|label)\s*[:=]\s*\{?\s*["`'][^"`'\n]*\bkey (?:price )?levels|<h[1-6][^>]*>[^<]*\bkey (?:price )?levels|·\s*Key levels\b|\{\/\*\s*Key Levels\s*\*\/\}/i;
  // Ticker-specific $ lists under support zones / psychological levels.
  const tickerDollarList = /(?:round numbers|psychological levels)\s*\(\s*\$\d/i;

  // JSON-LD "description" strings in the Dynamic templates.
  const jsonLd = ["client/src/pages/seo/DynamicStockPage.tsx", "client/src/pages/seo/DynamicCryptoPage.tsx"].flatMap((path) =>
    [...read(path).matchAll(/"description":\s*`([^`]*)`/g)].map((m) => ({ path: `${path} (JSON-LD)`, text: m[1] })),
  );

  it("each pattern flags the original 2f4edff lines", () => {
    expect('description: "NVIDIA (NVDA) signal analysis. FAULTLINE tracks NVDA macro regime fit, AI bubble exposure, momentum score, and key price levels.",').toMatch(keyLevelsTracking);
    expect('"description": `Regularly refreshed ${upper} signal analysis. FAULTLINE tracks ${upper} macro regime fit, momentum score, volatility risk, and key price levels.`,').toMatch(keyLevelsTracking);
    expect("FAULTLINE tracks TAO key price levels.").toMatch(keyLevelsTracking);
    expect('seoTitle="NVDA Signal — NVIDIA Stock Analysis, AI Risk Score & Key Levels | FAULTLINE"').toMatch(keyLevelsLabel);
    expect('title: "Bitcoin Risk Dashboard — BTC Risk Score, Key Levels & Macro Analysis | FAULTLINE",').toMatch(keyLevelsLabel);
    expect("heading: `${ticker} Key Price Levels and Technical Structure`,").toMatch(keyLevelsLabel);
    expect('heading: "TAO Key Price Levels and Historical Volatility",').toMatch(keyLevelsLabel);
    expect("Macro regime fit · Momentum score · Risk classification · Key levels").toMatch(keyLevelsLabel);
    expect("Major round numbers ($100, $150, $200) attract significant options positioning.").toMatch(tickerDollarList);
    expect("Major psychological levels ($150, $200, $250, $300, $400, $500).").toMatch(tickerDollarList);
    expect("Key Psychological Levels: Round numbers ($100K, $150K, $200K) that attract").toMatch(tickerDollarList);
  });

  it("JSON-LD blocks are found and scanned", () => {
    expect(jsonLd.length).toBeGreaterThanOrEqual(2);
    expect(jsonLd.filter((b) => keyLevelsTracking.test(b.text) || /key (?:price )?levels/i.test(b.text)).map((b) => b.path)).toEqual([]);
  });

  it("server meta, SSR and SEO pages make no 'FAULTLINE tracks … key levels' claims", () => {
    expect(offenders(scanned, keyLevelsTracking)).toEqual([]);
    const meta = read("server/seoMeta.ts");
    expect(meta).not.toMatch(/key price levels/i);
  });

  it("titles, headings and labels do not advertise key levels", () => {
    expect(offenders(scanned, keyLevelsLabel)).toEqual([]);
  });

  it("support-zone methodology carries no ticker-specific $ lists", () => {
    expect(offenders(scanned, tickerDollarList)).toEqual([]);
  });

  it("level headings use methodology wording", () => {
    expect(read("client/src/pages/seo/StockSignalPage.tsx")).toContain("heading: `How Technical Levels Are Read: ${ticker}`");
    expect(read("client/src/pages/seo/TAOSignal.tsx")).toContain('heading: "How Technical Levels Are Read: TAO, and Its Historical Volatility"');
    expect(read("client/src/pages/seo/BitcoinRiskDashboard.tsx")).toContain('heading: "How Technical Levels Are Read: Bitcoin"');
  });
});
