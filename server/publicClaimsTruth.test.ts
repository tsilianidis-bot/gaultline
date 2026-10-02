import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getPageMeta } from "./seoMeta";
import { PUBLIC_DISCLAIMER } from "../shared/publicDisclaimer";

/**
 * Truth/Claims regression guard for public marketing, SEO, and press copy.
 *
 * Ground truth (server/pressure/engine.ts): the Pressure Index is six weighted
 * vectors built from eight FRED series (BAMLH0A0HYM2, DGS10, DGS2, SOFR,
 * CPIAUCSL, PPIACO, FEDFUNDS, UNRATE) plus a static AI/Speculation baseline,
 * banded LOW RISK <25, MODERATE 25-44, ELEVATED 45-64, HIGH STRESS 65-79,
 * SYSTEMIC CRISIS >=80. It does not read VIX, breadth, on-chain data, the Fed
 * balance sheet, repo, SLOOS, or a recession probability.
 *
 * Probability/scenario pages (RecessionProbability, AltSeasonIndicator) are
 * owned by the Probability stream and are intentionally excluded here.
 */
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const PROBABILITY_OWNED = new Set(["RecessionProbability.tsx", "AltSeasonIndicator.tsx"]);
const seoPages = walk(join(root, "client/src/pages/seo"))
  .filter((p) => !PROBABILITY_OWNED.has(p.split("/").pop()!))
  .map((p) => ({ path: p.slice(root.length), text: readFileSync(p, "utf8") }));

const publicPages = [
  "client/src/pages/Press.tsx",
  "client/src/pages/About.tsx",
  "client/src/pages/TrustCenter.tsx",
  "client/src/pages/PressureIndex.tsx",
  "client/src/pages/PhoenixSystems.tsx",
  "client/src/pages/Blog.tsx",
  "client/src/pages/SEOLandingPage.tsx",
  "client/src/pages/PublicLandingPage.tsx",
  "client/src/pages/PublicAnalogs.tsx",
  "client/src/pages/PublicSignals.tsx",
  "client/src/pages/IntelligenceLibrary.tsx",
  "client/src/pages/DailyBriefArchive.tsx",
  "client/src/hooks/useSEO.ts",
].map((path) => ({ path, text: read(path) }));

function offenders(pages: { path: string; text: string }[], pattern: RegExp) {
  return pages.filter((p) => pattern.test(p.text)).map((p) => p.path);
}

describe("public claims truth: Pressure Index methodology", () => {
  it("never describes the Pressure Index as seven vectors", () => {
    expect(offenders([...seoPages, ...publicPages], /\bseven (core |independent |systemic )?(risk )?vectors\b|\b7 (risk )?vectors\b|(?<!not a )seven-vector/i)).toEqual([]);
  });

  it("does not list VIX, breadth, or recession probability as Pressure Index vectors", () => {
    expect(offenders(seoPages, /VIX regime, yield curve|recession probability, and market breadth|incorporates recession probability as one of/i)).toEqual([]);
  });

  it("uses the engine's regime bands, not invented ones", () => {
    expect(offenders(seoPages, /Risk-On \(FAULTLINE Pressure Index 0-39\)|Pressure Index 40-59|CRITICAL STRESS|LOW STRESS|Pressure Index 60\+/)).toEqual([]);
    const regime = read("client/src/pages/seo/MarketRegimeTracker.tsx");
    for (const band of ["Low Risk (below 25)", "Moderate Risk (25-44)", "Elevated Risk (45-64)", "High Stress (65-79)", "Systemic Crisis (80+)"]) {
      expect(regime).toContain(band);
    }
  });
});

describe("public claims truth: data sources", () => {
  it("does not claim on-chain data FAULTLINE does not ingest", () => {
    const pattern = /(FAULTLINE|We|Our)\b[^.]{0,80}\b(uses|integrates|incorporat\w*|analy[sz]\w*|tracks?|based on)\b[^.]{0,60}on-chain (data|metrics|signals|analytics|dynamics)/i;
    expect(offenders(seoPages, pattern)).toEqual([]);
    expect(offenders(seoPages, /whale (movements|activity) to detect|on-chain cost basis levels/i)).toEqual([]);
  });

  it("does not claim Fed balance sheet, repo, SLOOS, CDS, or VIX term-structure feeds", () => {
    expect(offenders(seoPages, /FAULTLINE tracks (QE\/QT|balance sheet trends|the Senior Loan Officer Survey)|monitors overnight and term repo rates|credit default swap \(CDS\) data, interbank|FAULTLINE tracks DeFi TVL|tracks L2 activity as an ETH demand indicator/i)).toEqual([]);
  });

  it("does not present a hard-coded 'current' stress rating as live", () => {
    expect(offenders(seoPages, /Currently, the FAULTLINE (Credit Market Stress Index|Treasury Yield Stress rating) indicates/)).toEqual([]);
  });

  it("does not claim PLATO evaluates ten live engines before every response in press copy", () => {
    const press = read("client/src/pages/Press.tsx");
    expect(press).not.toContain("evaluates all ten live engines before every response");
    expect(press).not.toMatch(/on-chain data|institutional flow data/i);
  });
});

describe("public claims truth: validation and superlatives", () => {
  it("drops 'predictive intelligence' and institutional-audience superlatives from comparison pages", () => {
    expect(offenders(seoPages, /Predictive Intelligence|forecast potential future states|hedge fund managers, institutional allocators|institutional investors, hedge fund managers/)).toEqual([]);
  });

  it("drops 'updated continuously' / 'before the crowd' / 'precursor to every major crash'", () => {
    expect(offenders([...seoPages, ...publicPages], /updated continuously|continuously updated|before the crowd|precursor to every major crash/i)).toEqual([]);
  });

  it("does not describe analogs as forward outcome distributions", () => {
    expect(offenders([...seoPages, ...publicPages], /as a probability distribution based on historical precedent|show what typically happened next|how top funds were positioned|See what happened next in each analog/)).toEqual([]);
  });

  it("does not advertise paid plans that are not on sale", () => {
    expect(offenders(seoPages, /requires a Trader or Power subscription/)).toEqual([]);
    const pricing = getPageMeta("/pricing");
    expect(pricing.description).not.toMatch(/\$\d/);
    expect(pricing.description).toContain("Paid plans are not on sale");
  });
});

describe("public claims truth: daily brief archive", () => {
  it("does not promise a daily market-open cadence, live data, or paid email delivery", () => {
    const archive = read("client/src/pages/DailyBriefArchive.tsx");
    expect(archive).not.toContain("Published daily at market open");
    expect(archive).not.toMatch(/institutional-grade|collects live macro|validated for accuracy|Pro and Founding members receive/);
    expect(archive).toContain("No briefs published yet");
    expect(archive).not.toMatch(/every market day at open|View Plans/);
    expect(getPageMeta("/daily-brief").description).not.toContain("Published daily");
  });
});

describe("public claims truth: server-rendered meta", () => {
  it("market-crash-indicator meta is not a crash probability score", () => {
    const meta = getPageMeta("/market-crash-indicator");
    expect(meta.description).not.toMatch(/12 systemic risk signals|crash probability score/);
    expect(meta.description).toContain("FAULTLINE does not offer a crash probability");
  });

  it("liquidity, Fed, volatility, and ETH meta describe only ingested inputs", () => {
    expect(getPageMeta("/liquidity-monitor").description).not.toMatch(/balance sheet|repo markets|global liquidity flows/i);
    expect(getPageMeta("/federal-reserve-tracker").description).not.toMatch(/balance sheet|forward guidance/i);
    expect(getPageMeta("/volatility-dashboard").description).not.toMatch(/term structure|risk premium/i);
    expect(getPageMeta("/ethereum-risk-dashboard").description).not.toMatch(/network activity/i);
  });

  it("keeps the brand line and an educational disclaimer on SEO landing templates", () => {
    for (const path of ["client/src/pages/SEOLandingPage.tsx", "client/src/pages/PublicLandingPage.tsx"]) {
      const text = read(path);
      expect(text).toContain("See the pressure before the break.");
      expect(text).toContain("{PUBLIC_DISCLAIMER}");
      expect(text).not.toContain("Move before the market does.");
    }
  });
});

describe("public claims truth: Product-QA gate follow-ups (PR #56)", () => {
  it("server-rendered /track-record methodology uses the engine bands", () => {
    const seo = read("server/seoMeta.ts");
    expect(seo).not.toMatch(/MINIMAL RISK|61–75 HIGH RISK|76–100 CRITICAL/);
    expect(seo).toContain("below 25 LOW RISK, 25–44 MODERATE RISK, 45–64 ELEVATED RISK, 65–79 HIGH STRESS, 80+ SYSTEMIC CRISIS");
  });

  it("names the right providers and does not claim feeds the index does not read", () => {
    expect(read("client/src/pages/seo/TAOSignal.tsx")).not.toContain("Polygon.io");
    for (const path of ["client/src/pages/seo/BestStockMarketRiskDashboard.tsx", "client/src/pages/seo/IsNowGoodTimeToBuyStocks.tsx"]) {
      expect(read(path)).not.toMatch(/published by FRED, Polygon\.io|VIX levels, and market breadth indicators|near regularly refreshed/);
    }
    expect(read("client/src/pages/Blog.tsx")).not.toMatch(/exchange flows|leading indicator of broader stress/);
    expect(read("client/src/pages/IntelligenceLibrary.tsx")).not.toMatch(/on-chain/i);
  });

  it("does not claim the index rises before bear markets", () => {
    expect(offenders([...seoPages, ...publicPages], /rises before bear markets|falls before recoveries/i)).toEqual([]);
  });

  it("describes the ten-profile analog library consistently", () => {
    const library = read("server/fmos/engines/historicalAnalog.ts");
    const db = library.slice(library.indexOf("const ANALOG_DATABASE"), library.indexOf("export function computeHistoricalAnalogs"));
    expect(db.match(/^\s+year: \d{4},/gm)?.length).toBe(10);
    for (const path of ["client/src/pages/PublicAnalogs.tsx", "client/src/hooks/useSEO.ts", "client/src/pages/seo/IsNowGoodTimeToBuyStocks.tsx"]) {
      expect(read(path)).toContain("2011, 2015, 2019, and 2023");
    }
    expect(offenders([...seoPages, ...publicPages], /reference profiles of six past stress episodes/)).toEqual([]);
  });

  it("uses one shared disclaimer constant on public surfaces and /legal meta", () => {
    for (const path of [
      "client/src/pages/PressureIndex.tsx",
      "client/src/pages/MarketingSite.tsx",
      "client/src/pages/Legal.tsx",
      "client/src/pages/TrustCenter.tsx",
      "client/src/pages/Press.tsx",
      "client/src/pages/DailyBriefArchive.tsx",
      "client/src/pages/About.tsx",
      "client/src/pages/PhoenixSystems.tsx",
    ]) {
      expect(read(path)).toContain("PUBLIC_DISCLAIMER");
    }
    expect(getPageMeta("/legal").description).toContain(PUBLIC_DISCLAIMER);
  });

  it("drops 'Live' labels on public signal pages", () => {
    expect(offenders(seoPages, /Live Signal Classification|Get the Live \{upper\} Signal|Live crypto systemic risk dashboard/)).toEqual([]);
    expect(read("client/src/pages/TrustCenter.tsx")).not.toContain("LIVE PRESSURE INDEX");
  });

  it("daily brief does not claim a weekday schedule", () => {
    expect(read("client/src/pages/DailyBriefArchive.tsx")).not.toMatch(/weekday/i);
    const meta = getPageMeta("/daily-brief").description;
    expect(meta).not.toMatch(/weekday/i);
    expect(meta).toContain("No briefs have been published yet");
  });

  it("recession and alt-season pages carry no false non-probability claims", () => {
    const recession = read("client/src/pages/seo/RecessionProbability.tsx");
    const altSeason = read("client/src/pages/seo/AltSeasonIndicator.tsx");
    expect(recession).not.toMatch(/seven (risk )?vectors|ELEVATED STRESS|CRITICAL STRESS|PMI Deterioration|Unemployment Claims Monitoring|Consumer Confidence Tracking|incorporating recession probability/);
    expect(recession).not.toMatch(/live recession probability/i);
    for (const text of [recession, altSeason]) {
      expect(text).not.toContain("Trader or Power subscription");
      expect(text).not.toMatch(/Live Probability/i);
    }
  });
});

describe("public claims truth: Pressure Index inputs (PR #56 r2)", () => {
  // Any sentence that attributes VIX or market breadth to the Pressure Index as an
  // input fails, unless the same sentence says it is not an input / is context / a proxy.
  const extraPublic = [
    "client/src/pages/Methodology.tsx",
    "client/src/pages/MarketingSite.tsx",
    "client/src/pages/TrackRecord.tsx",
    "server/seoMeta.ts",
  ].map((path) => ({ path, text: read(path) }));
  // Subject: the Pressure Index, or "FAULTLINE's score/index/composite".
  const subject = String.raw`(?:Pressure Index|FAULTLINE'?s (?:score|index|composite))`;
  const verbs = String.raw`synthesi[sz]\w*|combin\w*|integrat\w*|incorporat\w*|aggregat\w*|blend\w*|built from|inputs?|reads?|uses?|includes?|weights?|draws? on`;
  const attributesInput = [
    new RegExp(String.raw`${subject}[^.]{0,80}\b(?:${verbs})\b[^.]{0,160}\b(?:VIX|breadth)\b`, "i"),
    new RegExp(String.raw`\b(?:VIX|breadth)\b[^.]{0,120}\b(?:into|feeds?|fed|drives?|enters?|powers?)\b[^.]{0,40}${subject}`, "i"),
  ];
  // r5: each VIX / breadth mention in an attributing sentence must itself be
  // explicitly denied input status (or be a labelled "breadth proxy" vector).
  // A bare "not", "context, not …", "proxy" elsewhere, or "is not a measure"
  // no longer exempts the sentence.
  const termQualifiers = (t: string) => [
    new RegExp(String.raw`\b${t}[- ]proxy\b`, "i"),
    new RegExp(String.raw`\bdoes not (?:read|use|ingest|include|incorporate)\b[^.]{0,60}\b${t}\b`, "i"),
    new RegExp(String.raw`\bnot (?:a |an )?(?:live |direct )?(?:advance\/decline )?${t}\b(?: \w+)? (?:inputs?|feeds?)\b`, "i"),
    new RegExp(String.raw`\b${t}\b[^.]{0,60}\bnot (?:a |an )?(?:Pressure Index )?inputs?\b`, "i"),
  ];
  const unqualifiedTerm = (text: string) =>
    ["VIX", "breadth"].some((t) => new RegExp(String.raw`\b${t}\b`, "i").test(text) && !termQualifiers(t).some((re) => re.test(text)));
  // "…VIX, credit spreads, …. The Pressure Index synthesizes these…" across two sentences.
  const attributesByReference = /\b(VIX|breadth)\b[\s\S]{0,240}Pressure Index[^.]{0,40}\b(synthesi[sz]\w*|integrat\w*|combin\w*|aggregat\w*|blend\w*) (these|them|this)\b/i;

  function inputHits(pages: { path: string; text: string }[]) {
    const hits: string[] = [];
    for (const page of pages) {
      const sentences = page.text.split(/(?<=[.!?])\s+|\n/);
      sentences.forEach((sentence, i) => {
        const pair = `${sentences[i - 1] ?? ""} ${sentence}`;
        const direct = attributesInput.some((re) => re.test(sentence)) && unqualifiedTerm(sentence);
        const byReference = attributesByReference.test(pair) && unqualifiedTerm(pair);
        if (direct || byReference) {
          hits.push(`${page.path}: ${sentence.trim().slice(0, 120)}`);
        }
      });
    }
    return hits;
  }

  it("never lists VIX or market breadth as Pressure Index inputs", () => {
    expect(inputHits([...seoPages, ...publicPages, ...extraPublic])).toEqual([]);
  });

  it("the VIX/breadth exemption requires an explicit negation of input status", () => {
    const fixture = (text: string) => inputHits([{ path: "fixture", text }]);
    // A bare "not" elsewhere in the sentence must not exempt an input claim.
    expect(fixture("The Pressure Index combines credit spreads, VIX, and market breadth, though it is not a forecast.")).toHaveLength(1);
    expect(fixture("FAULTLINE folds VIX and breadth into the Pressure Index and does not name a date.")).toHaveLength(1);
    // Product-QA r4 exemption probe: every genuine attribution must fail.
    for (const sentence of [
      "The Pressure Index combines VIX, credit spreads, and market breadth — context, not a forecast.",
      "The Pressure Index integrates VIX and a breadth proxy.",
      "The Pressure Index aggregates VIX and breadth; it is not a measure of sentiment.",
      "Our Pressure Index is built from VIX, breadth, and credit spreads.",
      "FAULTLINE's score blends VIX and market breadth into one number.",
      "VIX and breadth feed the Pressure Index.",
    ]) {
      expect(fixture(sentence), sentence).toHaveLength(1);
    }
    // Explicit negations still pass.
    expect(fixture("The Pressure Index combines six vectors; VIX is context, not an input.")).toEqual([]);
    expect(fixture("The Pressure Index combines six FRED-based vectors and does not read VIX or breadth.")).toEqual([]);
    expect(fixture("The Pressure Index combines a labor-and-rates vector, a market-breadth proxy, and others.")).toEqual([]);
    expect(fixture("The Pressure Index combines six vectors; VIX is shown separately and is not a Pressure Index input.")).toEqual([]);
    expect(fixture("The Pressure Index does not read VIX or breadth.")).toEqual([]);
    expect(fixture("The Pressure Index combines a yield-curve vector; it is not a live VIX input.")).toEqual([]);
  });

  it("best-market-risk-indicators and stock-market-risk meta match the engine", () => {
    const page = read("client/src/pages/seo/BestMarketRiskIndicators.tsx");
    expect(page).not.toMatch(/VIX, credit spreads, yield curve, market breadth, and liquidity/);
    expect(page).toContain("eight FRED series");
    expect(read("client/src/hooks/useSEO.ts")).not.toMatch(/volatility, and equity breadth|breadth deterioration/);
  });

  it("track record footer carries the shared disclaimer and no hard-coded year", () => {
    const tr = read("client/src/pages/TrackRecord.tsx");
    expect(tr).toContain("{PUBLIC_DISCLAIMER}");
    expect(tr).not.toContain("© 2025");
    expect(tr).not.toContain("Live Verified Early Warning Intelligence");
  });

  it("no public subscription or billing copy while paid plans are not on sale", () => {
    const trust = read("client/src/pages/TrustCenter.tsx");
    expect(trust).not.toMatch(/Can I cancel my subscription|billed monthly|Lifetime Access/);
    expect(read("client/src/pages/seo/vs/VsBloomberg.tsx")).not.toContain("subscription model is tailored");
  });
});

describe("public claims truth: Product-QA r3 follow-ups and full sweep (PR #56 r4)", () => {
  const sweepExtra = [
    "client/src/pages/Methodology.tsx",
    "client/src/pages/MarketingSite.tsx",
    "client/src/pages/TrackRecord.tsx",
    "client/src/pages/Analysis.tsx",
    "client/src/pages/BlogPost.tsx",
    "client/src/pages/ContactUs.tsx",
    "client/src/pages/DailyBriefPost.tsx",
    "client/src/pages/IntelligenceArchive.tsx",
    "client/src/pages/IntelligenceLibraryPost.tsx",
    "client/src/pages/PressureHistory.tsx",
    "client/src/pages/PublicAIBubble.tsx",
    "client/src/pages/PublicCryptoMarketRisk.tsx",
    "client/src/pages/PublicCryptoSignals.tsx",
    "client/src/pages/PublicSharedReport.tsx",
    "client/src/pages/PublicStockMarketRisk.tsx",
    "client/src/pages/PublicSituationRoom.tsx",
    "client/src/pages/PublicDiagnosticAI.tsx",
    "client/index.html",
    "server/seoMeta.ts",
    "server/publicContentSsr.ts",
  ].map((path) => ({ path, text: read(path) }));
  const allPublic = [...seoPages, ...publicPages, ...sweepExtra];

  // Each check runs sentence by sentence so a hit names the offending sentence.
  function sentenceHits(pages: { path: string; text: string }[], pattern: RegExp, allow?: RegExp) {
    const hits: string[] = [];
    for (const page of pages) {
      for (const sentence of page.text.split(/(?<=[.!?])\s+|\n/)) {
        if (pattern.test(sentence) && !(allow && allow.test(sentence))) hits.push(`${page.path}: ${sentence.trim().slice(0, 140)}`);
      }
    }
    return hits;
  }

  const inAdvance = /\bdetects? in advance\b|\bin advance\b/i;
  // Press asset requests and the Track Record limitation sentence are not product claims.
  const inAdvanceAllow = /in advance of publication|cannot show that FAULTLINE would have warned in advance/i;
  const currentlyStands = /\bcurrently stands\b|\bCurrently, (the )?FAULTLINE\b|\bmoderate to elevated risk profile\b/i;
  const percentile = /\bpercentile\b/i;
  const beforeTheMove = /before the move|before (it|they) unwinds?|Know before the reversal|Know Before the Break|before the market notices|before price confirms/i;
  const liveLabel = /Live Platform|VIEW LIVE PRESSURE INDEX|View Live Pressure Index|Live and operational|Live crypto market risk|live Pressure Index updates/i;

  const original = {
    dynamicStock: "In elevated-pressure environments — characterized by credit spread widening, VIX regime elevation, and liquidity tightening — {upper} faces headwinds that FAULTLINE's Pressure Index™ detects in advance.",
    riskToday: "This proprietary metric, which aggregates various systemic risk vectors, currently stands at a level suggesting increased caution is warranted.",
    riskTodayProfile: "Today, the stock market exhibits a **moderate to elevated risk profile**, as indicated by FAULTLINE's Pressure Index.",
    dashboard: "Knowing that today's Pressure Index reading is in the 85th historical percentile — and what typically happened next in similar environments — is far more useful than knowing the VIX is at 22.",
  };

  it("each new pattern flags the original Product-QA r3 lines", () => {
    const fixture = (text: string) => [{ path: "fixture", text }];
    expect(sentenceHits(fixture(original.dynamicStock), inAdvance, inAdvanceAllow)).toHaveLength(1);
    expect(sentenceHits(fixture(original.riskToday), currentlyStands)).toHaveLength(1);
    expect(sentenceHits(fixture(original.riskTodayProfile), currentlyStands)).toHaveLength(1);
    expect(sentenceHits(fixture(original.dashboard), percentile)).toHaveLength(1);
    expect(original.dashboard).toMatch(/what typically happened next/);
    expect(sentenceHits(fixture("Know before the reversal."), beforeTheMove)).toHaveLength(1);
    expect(sentenceHits(fixture("VIEW LIVE PRESSURE INDEX"), liveLabel)).toHaveLength(1);
  });

  it("makes no 'detects in advance' / 'in advance' claims on public pages or server meta", () => {
    expect(sentenceHits(allPublic, inAdvance, inAdvanceAllow)).toEqual([]);
  });

  it("does not hard-code a current reading on public pages", () => {
    expect(sentenceHits(allPublic, currentlyStands)).toEqual([]);
    const today = read("client/src/pages/seo/StockMarketRiskToday.tsx");
    expect(today).toContain('href: "/pressure-index"');
    expect(today).not.toMatch(/elevated reading|Neutral-to-Cautious/);
    expect(read("client/src/pages/seo/BullBearConditions.tsx")).not.toMatch(/Neutral-to-Cautious/);
  });

  it("uses no invented percentiles on public pages or server meta", () => {
    expect(sentenceHits(allPublic, percentile)).toEqual([]);
    const dashboard = read("client/src/pages/seo/BestStockMarketRiskDashboard.tsx");
    expect(dashboard).toContain("as resemblance, not a forecast");
    expect(dashboard).not.toMatch(/what typically happened next/);
  });

  it("drops 'before the move' style timing claims and 'Live' labels", () => {
    expect(sentenceHits(allPublic, beforeTheMove)).toEqual([]);
    expect(sentenceHits(allPublic, liveLabel)).toEqual([]);
  });

  it("stock and crypto templates and the public article pages carry PUBLIC_DISCLAIMER", () => {
    for (const path of [
      "client/src/pages/seo/DynamicStockPage.tsx",
      "client/src/pages/seo/DynamicCryptoPage.tsx",
      "client/src/pages/Analysis.tsx",
      "client/src/pages/Blog.tsx",
      "client/src/pages/BlogPost.tsx",
      "client/src/pages/ContactUs.tsx",
      "client/src/pages/DailyBriefPost.tsx",
      "client/src/pages/IntelligenceArchive.tsx",
      "client/src/pages/IntelligenceLibrary.tsx",
      "client/src/pages/IntelligenceLibraryPost.tsx",
      "client/src/pages/PressureHistory.tsx",
      "client/src/pages/PublicSharedReport.tsx",
    ]) {
      expect(read(path), path).toContain("{PUBLIC_DISCLAIMER}");
    }
    const stock = read("client/src/pages/seo/DynamicStockPage.tsx");
    expect(stock).toContain("FAULTLINE's Pressure Index™ shows where systemic pressure is building");
    // Every SEO page renders through a template that carries the disclaimer, or carries it itself.
    const missing = seoPages.filter((p) => !/SEOLandingPage|StockSignalPage|PUBLIC_DISCLAIMER/.test(p.text)).map((p) => p.path);
    expect(missing).toEqual([]);
    expect(read("client/src/pages/seo/StockSignalPage.tsx")).toContain("SEOLandingPage");
  });

  it("signal pages do not claim earnings, analyst, news, or options inputs", () => {
    expect(
      offenders(seoPages, /analy[sz]\w* (of )?(earnings|analyst|news)|analyst price target clusters|options gamma walls|integrat\w* (of )?(earnings|news|analyst)/i),
    ).toEqual([]);
  });

  it("routes /stock/spy and /stock/amzn before the /stock/:symbol catch-all", () => {
    const app = read("client/src/App.tsx");
    const catchAll = app.indexOf('path="/stock/:symbol"');
    expect(catchAll).toBeGreaterThan(0);
    for (const route of ['path="/stock/spy"', 'path="/stock/amzn"']) {
      const at = app.indexOf(route);
      expect(at, route).toBeGreaterThan(0);
      expect(at, route).toBeLessThan(catchAll);
    }
  });
});

describe("public claims truth: Product-QA r4 follow-ups (PR #56 r5)", () => {
  const templates = ["client/src/pages/seo/DynamicStockPage.tsx", "client/src/pages/seo/DynamicCryptoPage.tsx"];
  // Hard-coded support/resistance price levels presented as current.
  const priceLevel = /\b(support|resistance)\b[^"`\n]{0,80}\$\d|\$\d[\d,.]*\s*[–-]\s*\$\d[^"`\n]{0,60}\b(support|resistance|all-time high|ATH)\b/i;
  const capexFigure = /\$\d[\d,.]*\s*[BT]\+?\s+(in\s+)?(announced\s+)?AI capex|\$214B/i;

  it("each new pattern flags the original Product-QA r4 lines", () => {
    // a1e912b DynamicCryptoPage:44 and DynamicStockPage:126, PublicAIBubble:16 and useSEO:101.
    expect("Key support: $85,000–$90,000 (major support zone), $70,000 (structural floor). Key resistance: $110,000–$115,000 (all-time high zone).").toMatch(priceLevel);
    expect("Key support: $380–$400 (200-day MA zone), $350 (structural support). Key resistance: $450–$470 (all-time high zone).").toMatch(priceLevel);
    expect("Monitor $214B+ in AI capex commitments and the equities most exposed to AI infrastructure spending cycles.").toMatch(capexFigure);
    expect("Track $214B+ in AI capex commitments and mega-cap concentration.").toMatch(capexFigure);
  });

  it("stock and crypto templates publish no hard-coded support/resistance price levels", () => {
    for (const path of templates) {
      const text = read(path);
      const levels = text.match(/^\s+keyLevels: ["`].*$/gm) ?? [];
      expect(levels.length, path).toBeGreaterThan(0);
      for (const line of levels) {
        expect(line, path).not.toMatch(/\$\d/);
        expect(line, path).toContain("FAULTLINE does not publish price targets or support/resistance levels on this page.");
      }
      expect(text, path).not.toMatch(priceLevel);
      expect(text, path).not.toMatch(/updated dynamically based on price action|regime-aligned entry zones/);
    }
  });

  it("public copy carries no AI capex dollar figure", () => {
    const pages = [
      ...seoPages,
      ...publicPages,
      ...["client/src/pages/PublicAIBubble.tsx", "server/seoMeta.ts", "client/index.html"].map((path) => ({ path, text: read(path) })),
    ];
    expect(offenders(pages, capexFigure)).toEqual([]);
    expect(read("client/src/pages/PublicAIBubble.tsx")).toContain("static AI-concentration baseline");
    expect(read("client/src/hooks/useSEO.ts")).toContain("does not ingest AI capex data");
  });
});

describe("public claims truth: engine count (James, Oct 2 11:42 AM ET)", () => {
  const engineCount = /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|\d+)[- ](?:live |market |market-risk |intelligence |analytical |independent |proprietary |FMOS )*engines?\b/i;

  it("flags the original 'ten live engines' founder lines", () => {
    expect("read ten live market engines simultaneously").toMatch(engineCount);
    expect("she has already read the full market context across ten live engines.").toMatch(engineCount);
    expect("All 14 engines in the pipeline").toMatch(engineCount);
  });

  it("public copy states no exact engine count", () => {
    const pages = [
      ...seoPages,
      ...publicPages,
      ...[
        "client/src/pages/Methodology.tsx",
        "client/src/pages/MarketingSite.tsx",
        "client/src/pages/TrackRecord.tsx",
        "client/src/pages/PublicAIBubble.tsx",
        "client/index.html",
        "server/seoMeta.ts",
        "server/publicContentSsr.ts",
      ].map((path) => ({ path, text: read(path) })),
    ];
    expect(offenders(pages, engineCount)).toEqual([]);
    const press = read("client/src/pages/Press.tsx");
    expect(press).toContain("FAULTLINE synthesizes multiple market-risk engines into one decision framework.");
    expect(press).not.toMatch(/ten live (market )?engines/i);
  });
});
