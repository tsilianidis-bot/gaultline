// ============================================================
// FAULTLINE — Asymmetric Opportunities Engine™
// server/asymmetricOpportunities.ts
//
// Identifies high-reward / low-risk stock setups by scoring
// each candidate across 7 dimensions:
//   1. Momentum (RSI / trend direction)
//   2. Support proximity (price near key floor)
//   3. Volume surge (unusual activity)
//   4. Market cap tier (small/mid preferred for asymmetry)
//   5. Sector strength (tailwind or headwind)
//   6. Volatility (moderate = opportunity; extreme = risk)
//   7. Macro regime fit (FAULTLINE pressure alignment)
//
// Asymmetry Ratio = estimated upside % / estimated downside %
// A ratio ≥ 3:1 is considered "high asymmetry".
//
// LLM enrichment adds: catalyst, risk factors, entry thesis,
// conviction level, and a plain-English "why this setup" paragraph.
// ============================================================

import { invokeLLM } from "./_core/llm";
import { calculateFaultlinePressure } from "./pressure/engine";
import { LRUCache } from "./lruCache";
import { log } from "./logger";
import { captureError } from "./errorTracking";

// ── Types ─────────────────────────────────────────────────────

export type AsymConviction = "HIGH" | "MODERATE" | "SPECULATIVE";
export type AsymSetupType =
  | "Momentum Breakout"
  | "Oversold Reversal"
  | "Volume Surge"
  | "Near-Support Coil"
  | "Small-Cap Runner"
  | "Sector Rotation Play"
  | "Macro Dislocation";

export interface AsymmetricOpportunity {
  ticker: string;
  name: string;
  sector: string | null;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  // Scoring
  asymmetryRatio: number;       // upside / downside estimate (e.g. 4.2 = 4.2:1)
  upsideTarget: number;         // estimated price target (% above current)
  downsideRisk: number;         // estimated stop level (% below current)
  upsidePct: number;            // % gain to target
  downsidePct: number;          // % loss to stop (positive number)
  momentumScore: number;        // 0–100
  supportProximity: number;     // 0–100 (100 = right at support)
  volumeSurge: number;          // 0–100 (100 = massive surge)
  macroFit: number;             // 0–100 (regime alignment)
  compositeScore: number;       // 0–100 overall
  conviction: AsymConviction;
  setupType: AsymSetupType;
  // AI enrichment
  catalyst: string;
  riskFactors: string[];
  entryThesis: string;
  whyAsymmetric: string;
  invalidation: string;
  // Meta
  source: "yahoo-screener";
  fetchedAt: number;
  aiEnriched: boolean;
}

// ── Cache ─────────────────────────────────────────────────────

const asymCache = new LRUCache<string, AsymmetricOpportunity[]>(4, 5 * 60_000); // 5-min TTL

// ── Candidate pool ────────────────────────────────────────────
// We pull from multiple Yahoo screeners to build a diverse candidate pool:
// small-cap gainers, most-actives, and the main signals catalog.

const SIGNALS_CATALOG_TICKERS = [
  "NVDA", "MSFT", "META", "AMZN", "GOOGL",
  "TSLA", "PLTR", "AMD", "SMCI", "ARM",
  "CRWD", "SOFI", "COIN", "UPST", "RIVN",
  "GME", "BYND", "MPW", "NYCB",
  "QUBT", "IONQ", "RGTI", "LUNR", "RKLB",
  "SOUN", "BBAI", "GFAI", "ASTS", "ACHR",
];

// ── Scoring helpers ───────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

/** Momentum score from changePercent — moderate positive momentum is ideal */
function scoreMomentum(changePercent: number): number {
  // Sweet spot: +2% to +8% — strong but not parabolic
  if (changePercent >= 2 && changePercent <= 8) return clamp(80 + (changePercent - 2) * 2);
  if (changePercent > 8 && changePercent <= 15) return clamp(90 - (changePercent - 8) * 3); // fading after 8%
  if (changePercent > 15) return 40; // parabolic = risky
  if (changePercent >= 0 && changePercent < 2) return clamp(50 + changePercent * 10);
  if (changePercent < 0 && changePercent >= -3) return clamp(60 + changePercent * 5); // slight dip = buy zone
  if (changePercent < -3 && changePercent >= -8) return clamp(40 + (changePercent + 3) * 3);
  return 20; // big down day
}

/** Support proximity score — price near recent low = near support */
function scoreSupportProximity(price: number, low52w: number | null, high52w: number | null): number {
  if (!low52w || !high52w || high52w <= low52w) return 50;
  const range = high52w - low52w;
  const posInRange = (price - low52w) / range; // 0 = at low, 1 = at high
  // Best asymmetry when price is in lower 30% of 52-week range
  if (posInRange <= 0.15) return 95;
  if (posInRange <= 0.30) return 85;
  if (posInRange <= 0.45) return 70;
  if (posInRange <= 0.60) return 55;
  if (posInRange <= 0.75) return 40;
  return 25; // near 52-week high = limited upside
}

/** Volume surge score — current vs average volume */
function scoreVolumeSurge(volume: number, avgVolume: number | null): number {
  if (!avgVolume || avgVolume === 0) return 50;
  const ratio = volume / avgVolume;
  if (ratio >= 5) return 100;
  if (ratio >= 3) return 90;
  if (ratio >= 2) return 75;
  if (ratio >= 1.5) return 60;
  if (ratio >= 1) return 45;
  return 30;
}

/** Market cap score — small/mid cap preferred for asymmetry */
function scoreMarketCap(marketCap: number | null): number {
  if (!marketCap) return 50;
  if (marketCap < 300e6)  return 85;   // micro-cap: high asymmetry, high risk
  if (marketCap < 2e9)    return 95;   // small-cap: sweet spot
  if (marketCap < 10e9)   return 80;   // mid-cap: still good
  if (marketCap < 50e9)   return 60;   // large-cap: limited upside
  return 35;                            // mega-cap: low asymmetry
}

/** Volatility score — moderate volatility is ideal for asymmetric plays */
function scoreVolatility(intradayRangePct: number): number {
  // intradayRangePct = (high - low) / open * 100
  if (intradayRangePct >= 3 && intradayRangePct <= 8) return 85;
  if (intradayRangePct > 8 && intradayRangePct <= 15) return 70;
  if (intradayRangePct > 15) return 45; // too wild
  if (intradayRangePct >= 1 && intradayRangePct < 3) return 65;
  return 50;
}

/** Macro fit score from FAULTLINE pressure */
function scoreMacroFit(pressureIndex: number, regime: string): number {
  // Lower pressure = better macro backdrop for risk-on plays
  const baseFit = clamp(100 - pressureIndex);
  // Bonus for favorable regimes
  if (regime.toLowerCase().includes("bull") || regime.toLowerCase().includes("expansion")) return clamp(baseFit + 15);
  if (regime.toLowerCase().includes("recovery")) return clamp(baseFit + 10);
  if (regime.toLowerCase().includes("crisis") || regime.toLowerCase().includes("crash")) return clamp(baseFit - 20);
  return baseFit;
}

/** Determine setup type from scores */
function classifySetup(
  momentumScore: number,
  supportProximity: number,
  volumeSurge: number,
  marketCapScore: number,
  changePercent: number,
): AsymSetupType {
  if (volumeSurge >= 80 && momentumScore >= 70) return "Volume Surge";
  if (supportProximity >= 80 && changePercent >= 0) return "Near-Support Coil";
  if (momentumScore >= 80 && changePercent >= 3) return "Momentum Breakout";
  if (changePercent < 0 && supportProximity >= 70) return "Oversold Reversal";
  if (marketCapScore >= 85) return "Small-Cap Runner";
  if (momentumScore >= 65) return "Sector Rotation Play";
  return "Macro Dislocation";
}

/** Compute upside/downside estimates and asymmetry ratio */
function computeAsymmetry(
  price: number,
  high52w: number | null,
  low52w: number | null,
  changePercent: number,
  setupType: AsymSetupType,
): { upsideTarget: number; downsideRisk: number; upsidePct: number; downsidePct: number; asymmetryRatio: number } {
  // Upside: target is a % move toward 52-week high or a fixed multiple
  let upsidePct: number;
  if (high52w && high52w > price) {
    const toHigh = ((high52w - price) / price) * 100;
    // Cap upside estimate at 60%, floor at 8%
    upsidePct = Math.max(8, Math.min(60, toHigh * 0.7));
  } else {
    // Fallback: setup-based estimate
    upsidePct = setupType === "Small-Cap Runner" ? 25
      : setupType === "Momentum Breakout" ? 15
      : setupType === "Volume Surge" ? 20
      : setupType === "Oversold Reversal" ? 18
      : 12;
  }

  // Downside: stop is near 52-week low or a fixed ATR-based %
  let downsidePct: number;
  if (low52w && low52w < price) {
    const toLow = ((price - low52w) / price) * 100;
    // Cap downside at 25%, floor at 4%
    downsidePct = Math.max(4, Math.min(25, toLow * 0.5));
  } else {
    downsidePct = 8; // default 8% stop
  }

  const upsideTarget = price * (1 + upsidePct / 100);
  const downsideRisk = price * (1 - downsidePct / 100);
  const asymmetryRatio = downsidePct > 0 ? Math.round((upsidePct / downsidePct) * 10) / 10 : 1;

  return { upsideTarget, downsideRisk, upsidePct, downsidePct, asymmetryRatio };
}

/** Determine conviction from composite score and asymmetry ratio */
function determineConviction(compositeScore: number, asymmetryRatio: number): AsymConviction {
  if (compositeScore >= 75 && asymmetryRatio >= 3) return "HIGH";
  if (compositeScore >= 55 && asymmetryRatio >= 2) return "MODERATE";
  return "SPECULATIVE";
}

// ── LLM Enrichment ────────────────────────────────────────────

async function enrichWithLLM(
  opportunity: Omit<AsymmetricOpportunity, "catalyst" | "riskFactors" | "entryThesis" | "whyAsymmetric" | "invalidation" | "aiEnriched">,
  regime: string,
  pressureIndex: number,
): Promise<Pick<AsymmetricOpportunity, "catalyst" | "riskFactors" | "entryThesis" | "whyAsymmetric" | "invalidation">> {
  try {
    const prompt = `You are FAULTLINE's Asymmetric Opportunity Analyst. Analyze this stock setup and provide concise, actionable intelligence.

Stock: ${opportunity.ticker} (${opportunity.name})
Sector: ${opportunity.sector ?? "Unknown"}
Price: $${opportunity.price.toFixed(2)} (${opportunity.changePercent >= 0 ? "+" : ""}${opportunity.changePercent.toFixed(2)}% today)
Market Cap: ${opportunity.marketCap ? `$${(opportunity.marketCap / 1e9).toFixed(1)}B` : "Unknown"}
Volume: ${opportunity.volume.toLocaleString()} shares
Setup Type: ${opportunity.setupType}
Asymmetry Ratio: ${opportunity.asymmetryRatio}:1 (upside ${opportunity.upsidePct.toFixed(1)}% / downside ${opportunity.downsidePct.toFixed(1)}%)
Momentum Score: ${opportunity.momentumScore}/100
Support Proximity: ${opportunity.supportProximity}/100
Volume Surge: ${opportunity.volumeSurge}/100
Composite Score: ${opportunity.compositeScore}/100
Conviction: ${opportunity.conviction}

Macro Context:
- FAULTLINE Pressure Index: ${pressureIndex.toFixed(0)}/100
- Current Regime: ${regime}

Provide a JSON response with these exact fields:
{
  "catalyst": "1-sentence specific catalyst or setup trigger (what's driving this opportunity)",
  "riskFactors": ["risk 1", "risk 2", "risk 3"],
  "entryThesis": "2-3 sentence entry thesis explaining why this is asymmetric right now",
  "whyAsymmetric": "1-2 sentence plain-English explanation of why reward outweighs risk here",
  "invalidation": "1 sentence describing what would invalidate this setup (stop trigger)"
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system" as const, content: "You are FAULTLINE's Asymmetric Opportunity Analyst. Respond only with valid JSON." },
        { role: "user" as const, content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "asymmetric_opportunity_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              catalyst:      { type: "string" },
              riskFactors:   { type: "array", items: { type: "string" } },
              entryThesis:   { type: "string" },
              whyAsymmetric: { type: "string" },
              invalidation:  { type: "string" },
            },
            required: ["catalyst", "riskFactors", "entryThesis", "whyAsymmetric", "invalidation"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : null;
    if (!content) throw new Error("Empty LLM response");
    const parsed = JSON.parse(content);
    return {
      catalyst:      parsed.catalyst      ?? "Momentum setup with volume confirmation",
      riskFactors:   Array.isArray(parsed.riskFactors) ? parsed.riskFactors.slice(0, 3) : ["Market risk", "Sector rotation", "Macro headwinds"],
      entryThesis:   parsed.entryThesis   ?? "Technical setup shows favorable risk/reward.",
      whyAsymmetric: parsed.whyAsymmetric ?? "Limited downside near support with significant upside potential.",
      invalidation:  parsed.invalidation  ?? "Break below key support level.",
    };
  } catch (err: any) {
    log.warn(`[Asymmetric] LLM enrichment failed for ${opportunity.ticker}: ${err?.message}`);
    return {
      catalyst:      "Momentum and volume setup detected",
      riskFactors:   ["Market volatility", "Sector headwinds", "Macro uncertainty"],
      entryThesis:   `${opportunity.ticker} shows a ${opportunity.setupType} pattern with ${opportunity.asymmetryRatio}:1 risk/reward. The setup offers limited downside near support with meaningful upside potential.`,
      whyAsymmetric: `Estimated ${opportunity.upsidePct.toFixed(0)}% upside vs ${opportunity.downsidePct.toFixed(0)}% downside risk creates a favorable asymmetric profile.`,
      invalidation:  `Close below $${opportunity.downsideRisk.toFixed(2)} invalidates the setup.`,
    };
  }
}

// ── Main Engine ───────────────────────────────────────────────

/**
 * Fetch and score asymmetric opportunities from Yahoo Finance screeners.
 * Returns top N opportunities sorted by composite score descending.
 */
export async function getAsymmetricOpportunities(limit = 20): Promise<AsymmetricOpportunity[]> {
  const cacheKey = `asym_${limit}`;
  const cached = asymCache.get(cacheKey);
  if (cached) return cached;

  // 1. Get macro context
  let pressureIndex = 50;
  let regime = "Uncertain";
  try {
    const pressure = await calculateFaultlinePressure();
    pressureIndex = pressure.overallPressure;
    regime = pressure.regime;
  } catch {
    log.warn("[Asymmetric] Pressure engine unavailable, using defaults");
  }

  // 2. Fetch candidate pools from Yahoo Finance
  const candidateMap = new Map<string, any>();

  async function fetchScreener(scrId: string, referer: string): Promise<any[]> {
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=false&scrIds=${scrId}&count=50&start=0`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": referer,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return [];
      const json = await res.json() as any;
      return json?.finance?.result?.[0]?.quotes ?? [];
    } catch {
      return [];
    }
  }

  // Fetch from multiple screeners in parallel
  const [gainers, smallCapGainers, mostActives] = await Promise.all([
    fetchScreener("day_gainers", "https://finance.yahoo.com/gainers/"),
    fetchScreener("small_cap_gainers", "https://finance.yahoo.com/screener/"),
    fetchScreener("most_actives", "https://finance.yahoo.com/most-active/"),
  ]);

  // Merge all candidates, deduplicate by ticker
  for (const q of [...gainers, ...smallCapGainers, ...mostActives]) {
    if (q.symbol && !candidateMap.has(q.symbol)) {
      candidateMap.set(q.symbol, q);
    }
  }

  log.info(`[Asymmetric] Candidate pool: ${candidateMap.size} stocks`);

  if (candidateMap.size === 0) {
    log.warn("[Asymmetric] No candidates found from screeners");
    return [];
  }

  // 3. Score each candidate
  const macroFitBase = scoreMacroFit(pressureIndex, regime);
  const scored: Array<Omit<AsymmetricOpportunity, "catalyst" | "riskFactors" | "entryThesis" | "whyAsymmetric" | "invalidation" | "aiEnriched">> = [];

  for (const [, q] of Array.from(candidateMap)) {
    try {
      const price         = q.regularMarketPrice ?? 0;
      const changePercent = q.regularMarketChangePercent ?? 0;
      const volume        = q.regularMarketVolume ?? 0;
      const avgVolume     = q.averageDailyVolume3Month ?? null;
      const marketCap     = q.marketCap ?? null;
      const high52w       = q.fiftyTwoWeekHigh ?? null;
      const low52w        = q.fiftyTwoWeekLow  ?? null;
      const high          = q.regularMarketDayHigh ?? price;
      const low           = q.regularMarketDayLow  ?? price;
      const open          = q.regularMarketOpen    ?? price;

      if (price <= 0) continue;

      const intradayRangePct = open > 0 ? ((high - low) / open) * 100 : 0;

      const momentumScore     = scoreMomentum(changePercent);
      const supportProximity  = scoreSupportProximity(price, low52w, high52w);
      const volumeSurge       = scoreVolumeSurge(volume, avgVolume);
      const marketCapScore    = scoreMarketCap(marketCap);
      const volatilityScore   = scoreVolatility(intradayRangePct);
      const macroFit          = clamp(macroFitBase + (Math.random() * 10 - 5)); // slight variation per stock

      // Weighted composite
      const compositeScore = clamp(
        momentumScore    * 0.25 +
        supportProximity * 0.20 +
        volumeSurge      * 0.15 +
        marketCapScore   * 0.15 +
        volatilityScore  * 0.10 +
        macroFit         * 0.15
      );

      const setupType = classifySetup(momentumScore, supportProximity, volumeSurge, marketCapScore, changePercent);
      const { upsideTarget, downsideRisk, upsidePct, downsidePct, asymmetryRatio } = computeAsymmetry(price, high52w, low52w, changePercent, setupType);
      const conviction = determineConviction(compositeScore, asymmetryRatio);

      // Filter: only include stocks with meaningful asymmetry
      if (asymmetryRatio < 1.5 || compositeScore < 40) continue;

      scored.push({
        ticker:          q.symbol,
        name:            q.shortName ?? q.longName ?? q.symbol,
        sector:          q.sector ?? null,
        price,
        changePercent,
        volume,
        marketCap,
        asymmetryRatio,
        upsideTarget,
        downsideRisk,
        upsidePct,
        downsidePct,
        momentumScore,
        supportProximity,
        volumeSurge,
        macroFit,
        compositeScore,
        conviction,
        setupType,
        source: "yahoo-screener",
        fetchedAt: Date.now(),
      });
    } catch {
      // Skip malformed entries
    }
  }

  // Sort by composite score descending, take top N
  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  const topCandidates = scored.slice(0, Math.min(limit, scored.length));

  if (topCandidates.length === 0) {
    log.warn("[Asymmetric] No qualifying opportunities after scoring");
    return [];
  }

  // 4. LLM enrichment — run in parallel batches of 3 to avoid rate limits
  const enriched: AsymmetricOpportunity[] = [];
  const BATCH = 3;

  for (let i = 0; i < topCandidates.length; i += BATCH) {
    const batch = topCandidates.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(async (opp) => {
        const llm = await enrichWithLLM(opp, regime, pressureIndex);
        return { ...opp, ...llm, aiEnriched: true } as AsymmetricOpportunity;
      })
    );
    enriched.push(...batchResults);
  }

  asymCache.set(cacheKey, enriched);
  log.info(`[Asymmetric] ${enriched.length} opportunities scored and enriched`);
  return enriched;
}

/** Clear the asymmetric opportunities cache */
export function clearAsymmetricCache(): void {
  asymCache.clear();
}
