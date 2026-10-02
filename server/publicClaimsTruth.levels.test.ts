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

// r11: Public* pages, landing components and MarketingSite for the key-levels
// scan. PublicSituationRoom.tsx is also changed by #60 and the held
// methodology branch, so it is left to those PRs (it carries no levels copy).
const SKIP_OVERLAP = new Set<string>(["client/src/pages/PublicSituationRoom.tsx"]);
const walkRel = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(root, rel)).isDirectory() ? walkRel(rel) : /\.tsx?$/.test(name) ? [rel] : [];
  });
const publicSurfaces = [
  ...readdirSync(join(root, "client/src/pages")).filter((n) => /^Public\w*\.tsx$/.test(n)).map((n) => `client/src/pages/${n}`),
  ...walkRel("client/src/components/landing"),
  "client/src/pages/MarketingSite.tsx",
].filter((path) => !SKIP_OVERLAP.has(path));

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
  // templates), the server-rendered meta and SSR, and client meta; r11 adds
  // every Public*.tsx page, the landing components and MarketingSite.
  const metaFiles = ["server/seoMeta.ts", "server/publicContentSsr.ts", "server/seoRoutes.ts", "client/src/hooks/useSEO.ts", "client/index.html"];
  const scanned = [...seoPages, ...[...metaFiles, ...publicSurfaces].map((path) => ({ path, text: read(path) }))];

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

describe("public claims truth: QA nits on 58bc321 (PR #56 r11)", () => {
  const read2 = (path: string) => ({ path, text: read(path) });
  const surfaces = [...seoPages, ...publicSurfaces.map(read2)];
  const priceLevelsHeading = /<h[1-6][^>]*>[^<]*\bPrice Levels\s*<\/h[1-6]>/;

  it("flags the original 58bc321 lines", () => {
    expect('<h2 className="text-2xl font-bold text-white mb-4">{upper} Price Levels</h2>').toMatch(priceLevelsHeading);
    expect('<h2 className="text-2xl font-bold text-white mb-4">How Technical Levels Are Read: {upper}</h2>').not.toMatch(priceLevelsHeading);
  });

  it("the key-levels scan covers Public* pages, landing components and MarketingSite", () => {
    expect(publicSurfaces).toContain("client/src/pages/MarketingSite.tsx");
    expect(publicSurfaces).toContain("client/src/pages/PublicLandingPage.tsx");
    expect(publicSurfaces.filter((p) => p.startsWith("client/src/components/landing/")).length).toBeGreaterThan(3);
    expect(publicSurfaces.filter((p) => /pages\/Public\w*\.tsx$/.test(p)).length).toBeGreaterThan(5);
  });

  it("no SEO or public page heading advertises '{SYM} Price Levels'", () => {
    expect(offenders(surfaces, priceLevelsHeading)).toEqual([]);
    for (const path of ["client/src/pages/seo/DynamicStockPage.tsx", "client/src/pages/seo/DynamicCryptoPage.tsx"]) {
      expect(read(path), path).toContain(">How Technical Levels Are Read: {upper}</h2>");
    }
  });

  it("AIStocksDashboard describes the 32.4% AI concentration as a static baseline", () => {
    const text = read("client/src/pages/seo/AIStocksDashboard.tsx");
    expect(text).not.toMatch(/AI Bubble Monitor tracks this concentration risk as new data is published/);
    expect(text).toContain("static 32.4% AI-concentration baseline (a fixed reference value with no live source and no published as-of date; not a live market-cap feed)");
  });

  it("ValidationLab's evidence-family counts match the FMOS Evidence engine", () => {
    const engine = read("server/fmos/engines/evidence.ts");
    const built = new Set([...engine.matchAll(/^\s+build(\w+)Family\(/gm)].map((m) => m[1]));
    const lab = read("client/src/pages/ValidationLab.tsx");
    const counts = [...lab.matchAll(/\b(\d+|eight|fourteen)\s+(?:independent\s+)?(?:evidence\s+)?families\b/gi)].map((m) => m[1]);
    expect(built.size).toBeGreaterThan(0);
    expect(counts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(counts)).toEqual(new Set([String(built.size)]));
    expect(lab).toMatch(new RegExp(`id: 'evidence_families',label: 'Evidence Families',\\s+category: 'Architecture', value: '${built.size}'`));
  });
});

describe("public claims truth: no time-sensitive record-high or 'trades at' claims (PR #56 r12)", () => {
  // Every SEO page (incl. learn/**, .ts and .tsx), the Public* pages, landing
  // components, MarketingSite and the server-rendered meta/SSR.
  const seoAll = walkRel("client/src/pages/seo");
  const files = [...new Set([...seoAll, ...publicSurfaces, "server/seoMeta.ts", "server/publicContentSsr.ts", "server/seoRoutes.ts", "client/src/hooks/useSEO.ts", "client/index.html"])];
  // "all-time high" / "record high" are time-sensitive; only the past-tense
  // "then-record high(s)" is allowed.
  const recordHigh = /(?<!then-)\b(?:all[- ]time|record)[- ]highs?\b|\bhighest[- ]ever\b|\bever[- ]highs?\b/i;
  // Present-tense trading/valuation facts.
  const tradesAt = /\b(?:currently|now)\s+trad(?:es|ing)\b|\btrades at\b/i;

  it("flags the original 56a387e lines and allows 'then-record'", () => {
    expect("Historical Context: AMD reached its all-time high in late 2021 at approximately $164, then fell").toMatch(recordHigh);
    expect("TAO reached its all-time high in early 2024").toMatch(recordHigh);
    expect("falling approximately 77% from its all-time high to its October 2022 low").toMatch(recordHigh);
    expect("Bitcoin led the cycle, reaching new all-time highs in late 2024.").toMatch(recordHigh);
    expect("Previous all-time highs that became support after being broken.").toMatch(recordHigh);
    expect("BTC hit a record high of $69,000.").toMatch(recordHigh);
    expect("the highest ever close").toMatch(recordHigh);
    expect("AMD set a then-record high in late 2021, then fell approximately 65% to its 2022 low").not.toMatch(recordHigh);
    expect("Bitcoin led the cycle, setting then-record highs in late 2024.").not.toMatch(recordHigh);
    expect("PLTR trades at a significant premium to traditional software companies — often 50-100x forward earnings.").toMatch(tradesAt);
    expect("NVDA currently trades near $180.").toMatch(tradesAt);
    expect("PLTR has historically traded at a significant premium to traditional software companies.").not.toMatch(tradesAt);
  });

  it("scans the SEO, Public*, landing and MarketingSite surfaces", () => {
    expect(files).toContain("client/src/pages/seo/AMDSignal.tsx");
    expect(files).toContain("client/src/pages/MarketingSite.tsx");
    expect(files.some((f) => f.startsWith("client/src/pages/seo/learn/"))).toBe(true);
    expect(files.length).toBeGreaterThan(80);
  });

  it("no surface states an all-time/record high except as past-tense 'then-record'", () => {
    const hits = files.flatMap((path) =>
      read(path).split("\n").flatMap((line, i) => (recordHigh.test(line) ? [`${path}:${i + 1}`] : [])),
    );
    expect(hits).toEqual([]);
  });

  it("no surface states a present-tense trading level or multiple", () => {
    const hits = files.flatMap((path) =>
      read(path).split("\n").flatMap((line, i) => (tradesAt.test(line) ? [`${path}:${i + 1}`] : [])),
    );
    expect(hits).toEqual([]);
  });

  it("the AMD historical context carries no price figure", () => {
    const line = read("client/src/pages/seo/AMDSignal.tsx").split("\n").find((l) => l.startsWith("Historical Context: AMD"));
    expect(line).toBeDefined();
    expect(line).toContain("AMD set a then-record high in late 2021");
    expect(line).not.toMatch(/\$\d/);
  });
});

describe("public claims truth: no unsourced present-tense company/market/valuation figures (PR #56 r13)", () => {
  // MarketCrashProbability2026.tsx is also changed by #60 and the held
  // methodology branch, so it is left to those PRs here (as PublicSituationRoom).
  const R13_SKIP = new Set<string>(["client/src/pages/seo/MarketCrashProbability2026.tsx"]);
  const seoAll = walkRel("client/src/pages/seo").filter((p) => !R13_SKIP.has(p));
  const files = [...new Set([...seoAll, ...publicSurfaces, "server/seoMeta.ts", "server/publicContentSsr.ts", "server/seoRoutes.ts", "client/src/hooks/useSEO.ts", "client/index.html"])];
  const lineHits = (paths: string[], re: RegExp, allow?: RegExp) =>
    paths.flatMap((path) =>
      read(path).split("\n").flatMap((line, i) => (re.test(line) && !(allow && allow.test(line)) ? [`${path}:${i + 1}`] : [])),
    );

  // Valuation multiples ("30-50x forward earnings", "100x+ revenue").
  const multiple = /\b\d+(?:[-–]\d+)?x\+?\s+(?:forward\s+|trailing\s+)?(?:earnings|revenue|sales)\b/i;
  const ath = /\bATH\b/;
  const isTrading = /\bis trading (?:at|near)\b/i;
  const belowPeak = /\bbelow its peak\b/i;
  const tradingToday = /\bis trading near \$\d[\d,.]*\s*[KMBT]?\s+today\b/i;
  // Present-tense company metrics with a figure; allowed only with a filing/as-of citation.
  const fig = String.raw`\d+(?:\.\d+)?\s*(?:%|billion|million|B\b)\+?`;
  const metric = String.raw`(?:market share|of (?:its |total )?revenue|of total(?=\)| revenue| sales)|margins?|daily active users|annually|advertising-based)`;
  const companyMetric = new RegExp(String.raw`${fig}[^.\n]{0,60}\b${metric}|\b${metric}\b[^.\n]{0,60}${fig}`, "i");
  const citation = /results releases? (?:of|\()|\b10-[KQ]\b|annual report|filing|\bas of (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\b/i;

  it("each pattern flags the original 4f66b93 lines and planted variants", () => {
    expect("NVDA's high valuation multiple (typically 30-50x forward earnings) creates significant downside risk").toMatch(multiple);
    expect("META's high valuation multiple (typically 20-30x forward earnings) makes it sensitive").toMatch(multiple);
    expect('bearCase: "Extreme valuation multiples (100x+ revenue), heavy government dependency').toMatch(multiple);
    expect("NVDA is trading at 45x forward earnings.").toMatch(multiple);
    expect("trades near 12x trailing sales").toMatch(multiple);
    expect("BTC is near its ATH").toMatch(ath);
    expect("NVDA is trading at a discount").toMatch(isTrading);
    expect("NVDA is trading near $180 today").toMatch(tradingToday);
    expect("BTC is 20% below its peak").toMatch(belowPeak);
    for (const line of [
      "AMD's AI GPU market share remains well below NVIDIA's (approximately 10-15% vs. NVIDIA's 80%+)",
      "NVIDIA dominates the AI accelerator market with approximately 80%+ market share",
      "Its government revenue (approximately 55% of total) is relatively recession-resistant",
      "a profitable automotive manufacturer (gross margins approximately 18-20% on vehicles)",
      "Azure AI services growing at 30%+ annually.",
      "Services revenue growing at 15%+ annually.",
      "with approximately 3.3 billion daily active users across its family of apps.",
      "Meta generates approximately 98% of its revenue from digital advertising",
      "The company's revenue is approximately 98% advertising-based",
      "providing higher gross margins (approximately 80%) and more predictable revenue streams.",
    ]) {
      expect(line, line).toMatch(companyMetric);
    }
    // A filing-cited line (NVDA:21 style) is allowed.
    expect("Fiscal 2025 GAAP gross margin was 75.0% (NVIDIA fiscal-year results releases of February 22, 2023 and February 26, 2025)").toMatch(citation);
  });

  it("scans seo/** (minus the overlap file), Public*, landing, MarketingSite and SSR meta", () => {
    expect(files).toContain("client/src/pages/seo/DynamicStockPage.tsx");
    expect(files).toContain("client/src/pages/MarketingSite.tsx");
    expect(files).not.toContain("client/src/pages/seo/MarketCrashProbability2026.tsx");
    expect(files.length).toBeGreaterThan(80);
  });

  it("no valuation multiples, ATH, 'is trading at/near', 'below its peak' or 'trading near $X today'", () => {
    expect(lineHits(files, multiple)).toEqual([]);
    expect(lineHits(files, ath)).toEqual([]);
    expect(lineHits(files, isTrading)).toEqual([]);
    expect(lineHits(files, belowPeak)).toEqual([]);
    expect(lineHits(files, tradingToday)).toEqual([]);
  });

  it("seo/** carries no present-tense company metric figure without a filing/as-of citation", () => {
    expect(lineHits(seoAll, companyMetric, citation)).toEqual([]);
    // The cited NVDA:21 / META:21 figures stay.
    expect(read("client/src/pages/seo/NVDASignal.tsx")).toContain("Fiscal 2025 GAAP gross margin was 75.0%");
    expect(read("client/src/pages/seo/METASignal.tsx")).toContain("In its fourth-quarter 2024 results release (January 29, 2025)");
  });

  it("META's 2022 low is not dated to October", () => {
    expect(read("client/src/pages/seo/METASignal.tsx")).not.toMatch(/October 2022 low/);
    expect(read("client/src/pages/seo/METASignal.tsx")).toContain("from its then-record high to its 2022 low");
  });
});

describe("public claims truth: templated S/R strings in the Dynamic stock/crypto data (PR #56 r13)", () => {
  // The Dynamic templates render data.keyLevels for every symbol; base d1834a5
  // carried "Key support: $… Key resistance: $… (all-time high zone)" strings
  // there, which ship in the built SEO chunks.
  const dynamic = ["client/src/pages/seo/DynamicStockPage.tsx", "client/src/pages/seo/DynamicCryptoPage.tsx"];
  const keyLevelsField = /^\s*keyLevels:\s*(["'`])(.*)\1,?\s*$/;
  const srDollar = /\bKey (?:support|resistance)\s*:|\b(?:support|resistance)\s*:\s*\$\d|\(\s*all[- ]time high zone\s*\)|\$\d[\d,.]*\s*[–-]\s*\$?\d/i;

  it("flags the original base d1834a5 strings", () => {
    expect("Key support: $120 (major structural support). Key resistance: $140–$145 (all-time high zone).").toMatch(srDollar);
    expect('resistance: "$950 (all-time high zone)"').toMatch(srDollar);
    expect("Key resistance: $125–$130 (recent highs).").toMatch(srDollar);
    expect(NO_LEVELS).not.toMatch(srDollar);
  });

  it("every symbol's keyLevels string is the no-levels line", () => {
    for (const path of dynamic) {
      const lines = read(path).split("\n").filter((l) => /^\s*keyLevels:\s*["'`]/.test(l));
      expect(lines.length, path).toBeGreaterThanOrEqual(5);
      for (const line of lines) expect(line.match(keyLevelsField)?.[2], `${path}: ${line.trim()}`).toBe(NO_LEVELS);
    }
  });

  it("no data or template string in the Dynamic pages carries a $ level or S/R zone", () => {
    for (const path of dynamic) {
      const text = read(path);
      expect(text, path).not.toMatch(srDollar);
      // Any literal dollar figure (template interpolation `${…}` excluded).
      expect(text.match(/\$\d[\d,.]*/g), path).toBeNull();
    }
  });
});

describe("public claims truth: historical accuracy and remaining present-tense claims (PR #56 r14)", () => {
  const R14_SKIP = new Set<string>(["client/src/pages/seo/MarketCrashProbability2026.tsx"]);
  const seoAll = walkRel("client/src/pages/seo").filter((p) => !R14_SKIP.has(p));
  const files = [...new Set([...seoAll, ...publicSurfaces, "client/src/pages/SEOLandingPage.tsx", "server/seoMeta.ts", "server/publicContentSsr.ts", "server/seoRoutes.ts", "client/src/hooks/useSEO.ts", "client/index.html", "client/src/pages/TrackRecord.tsx"])];
  const lineHits = (paths: string[], re: RegExp) =>
    paths.flatMap((path) => read(path).split("\n").flatMap((line, i) => (re.test(line) ? [`${path}:${i + 1}`] : [])));

  const guards: Record<string, RegExp> = {
    recordSetting: /\brecord[- ]setting\b/i,
    percentShare: /\b\d+(?:\.\d+)?\s*(?:%|percent)\s+(?:of the\s+)?(?:\w+\s+){0,3}market share\b/i,
    peOf: /\bP\/?E(?: ratio)? of \d/i,
    timesEarnings: /\b\d+(?:\.\d+)?\s+times\s+(?:forward\s+|trailing\s+)?(?:earnings|sales|revenue)\b/i,
    trillionCap: /\$\d+(?:\.\d+)?\s*(?:T|trillion)\b[^.\n]{0,20}\bmarket cap/i,
    tradingAbove: /\bis trading (?:above|below|over|under) \$\d/i,
    newHighs: /\b(?:is|are|making|makes|hits?|hitting|at|reach(?:es|ing)|sets?|setting)\s+(?:fresh\s+|new\s+)+highs?\b/i,
  };
  const planted: Record<string, string> = {
    recordSetting: "NVDA posted a record-setting quarter.",
    percentShare: "NVIDIA holds 40 percent market share.",
    peOf: "TSLA has a P/E of 45.",
    timesEarnings: "META trades at 45 times earnings.",
    trillionCap: "NVDA has a $4 trillion market cap.",
    tradingAbove: "AMD is trading above $200.",
    newHighs: "The S&P 500 is making new highs.",
  };
  // Historical figures corrected in r14 must not come back.
  const historicalRegressions = /50-70% bear market drawdowns|50-80% declines|from 0% to 5\.25% in 18 months|Baa credit spreads hit|HY proxy ~11\.45%|2yr\/10yr spread has inverted before every|exceeded 80% during bear market|longest bull market in U\.S\. history ran from March 2009|average decline of around 36%|fastest liquidity withdrawal in history|\(QT\) since the 1980s|lead time of 6-18 months|defined as two consecutive quarters of negative GDP|the month Lehman Brothers collapsed|Elevated unemployment \(9–10%\)|\(Lehman\) and March 2020/i;

  it("each guard catches its planted phrase", () => {
    for (const [name, re] of Object.entries(guards)) expect(planted[name], name).toMatch(re);
    expect("Bitcoin led the cycle, setting then-record highs in late 2024.").not.toMatch(guards.newHighs);
    expect("compared to Bitcoin's typical 50-70% bear market drawdowns").toMatch(historicalRegressions);
    expect("the Fed raised rates from 0% to 5.25% in 18 months").toMatch(historicalRegressions);
    expect("Baa credit spreads hit 5.53% (HY proxy ~11.45%)").toMatch(historicalRegressions);
  });

  it("no scanned surface carries those phrases", () => {
    expect(files.length).toBeGreaterThan(80);
    for (const [name, re] of Object.entries(guards)) expect(lineHits(files, re), name).toEqual([]);
  });

  it("the historical figures corrected in r14 stay corrected", () => {
    expect(lineHits(files, historicalRegressions)).toEqual([]);
    const meta = read("server/seoMeta.ts");
    expect(meta).toContain("in about 16 months (March 2022 to July 2023)");
    expect(meta).toContain("5.53% on October 31, 2008 (FRED BAA10Y)");
    expect(read("client/src/pages/seo/TAOSignal.tsx")).toContain("roughly 75–85% cycle bear-market drawdowns");
  });

  // -r2: held public-copy replay names this page "Market Risk Context 2026" (supersedes #56's "Market Crash Risk 2026").
  it("the /market-crash-probability-2026 title, description and link labels read 'Market Risk Context 2026'", () => {
    for (const path of ["server/seoMeta.ts", "client/src/pages/SEOLandingPage.tsx"]) {
      const text = read(path);
      expect(text, path).toContain('title: "Market Risk Context 2026 | FAULTLINE"');
      expect(text, path).not.toContain('title: "Market Crash Probability | FAULTLINE"');
      expect(text, path).not.toMatch(/description: "Market crash probability context/);
    }
    expect(lineHits(seoAll, /label: "MARKET CRASH PROBABILITY"|>Crash Probability 2026</)).toEqual([]);
    // Slug unchanged.
    expect(read("server/seoMeta.ts")).toContain('"/market-crash-probability-2026": {');
  });
});

describe("public claims truth: no copy offers a crash probability (PR #56 r15)", () => {
  const R15_SKIP = new Set<string>(["client/src/pages/seo/MarketCrashProbability2026.tsx", "client/src/pages/PublicSituationRoom.tsx"]);
  const files = [...new Set([...walkRel("client/src/pages/seo"), ...publicSurfaces, "client/src/pages/SEOLandingPage.tsx", "server/seoMeta.ts", "client/src/hooks/useSEO.ts", "client/src/pages/AdminPortal.tsx"])].filter((p) => !R15_SKIP.has(p));
  // A mention is allowed only as a disclaimer ("not a calibrated crash probability", "does not offer a crash probability") or inside the unchanged slug.
  const offersProbability = (line: string) =>
    line
      .replace(/market-crash-probability-2026/g, "")
      .split(/(?<=[.!?])\s+/)
      .some((s) => /crash[- ]probabilit/i.test(s) && !/\b(?:not|no|neither|nor|never|does not offer|rather than)\b[^.]{0,120}crash[- ]probabilit/i.test(s));
  const hits = (paths: string[]) =>
    paths.flatMap((path) => read(path).split("\n").flatMap((line, i) => (offersProbability(line) ? [`${path}:${i + 1}`] : [])));

  it("the detector flags offers and allows disclaimers", () => {
    expect(offersProbability("FAULTLINE delivers curated insights into crash probability.")).toBe(true);
    expect(offersProbability('{ label: "Market Crash Probability 2026", href: "/x" }')).toBe(true);
    expect(offersProbability("The Pressure Index is a proprietary stress measure, not a calibrated crash probability.")).toBe(false);
    expect(offersProbability('{ href: "/market-crash-probability-2026" }')).toBe(false);
    expect(offersProbability("Neither label is a calibrated crash probability.")).toBe(false);
  });

  it("no public surface, SEO meta or admin sitemap label offers a crash probability", () => {
    expect(files.length).toBeGreaterThan(80);
    expect(hits(files)).toEqual([]);
  });

  it("the Time Machine 2022 entry uses the corrected hiking-cycle duration", () => {
    const tm = read("server/routers/timeMachine.ts");
    expect(tm).toContain("525bps in about 16 months");
    expect(tm).not.toContain("525bps in 18 months");
  });
});
