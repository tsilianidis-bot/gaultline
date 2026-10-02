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
    expect(meta.description).toContain("not a calibrated crash probability");
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
