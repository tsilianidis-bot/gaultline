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
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { toOperationalPressure } from "./operationalSignalInputs";
import { getAsymmetricScreenerCandidates, getQuotes, getDailyBars, classifyYahooObservation } from "./yahooProxy";
import { completedSignalBars } from "./signalVisualDetail";
import { TRPCError } from "@trpc/server";
import { evidenceNarrativePromptContract } from "../shared/evidenceContract";
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
  canonicalStateId: string;
  canonicalAsOf: string;
  evidenceQuality: string;
  observedAt: number;
  priceSource: string;
  sourceInputIds: string[];
  methodologyVersion: "asymmetric-observed-rules-v2";
  evidenceClass: "DERIVED";
  interpretationStatus?: "MODEL_INTERPRETATION" | "UNAVAILABLE";
  observationTiming: string;
  rangeBasis: "completed-3mo-observations";
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
): Promise<Pick<AsymmetricOpportunity, "catalyst" | "riskFactors" | "entryThesis" | "whyAsymmetric" | "invalidation" | "aiEnriched" | "interpretationStatus">> {
  try {
    const prompt = `You are FAULTLINE's Asymmetric Opportunity Analyst. Interpret only supplied observations and explicitly identified deterministic rule estimates.
${evidenceNarrativePromptContract()}
Canonical state: ${opportunity.canonicalStateId}; source observations: ${opportunity.sourceInputIds.join(", ")}; methodology: ${opportunity.methodologyVersion}.
No company news, earnings, analyst, insider, institutional-flow, or catalyst source is provided. Leave catalyst empty. Range basis is completed three-month bars, not a 52-week support observation. Targets/stops and conviction are rule estimates, not observed facts or calibrated forecasts.

Stock: ${opportunity.ticker} (${opportunity.name})
Sector: ${opportunity.sector ?? "Unknown"}
Price: $${opportunity.price.toFixed(2)} (${opportunity.changePercent >= 0 ? "+" : ""}${opportunity.changePercent.toFixed(2)}% at provider observation ${new Date(opportunity.observedAt).toISOString()})
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
    if (![parsed.entryThesis, parsed.whyAsymmetric, parsed.invalidation].every(value => typeof value === "string") || !Array.isArray(parsed.riskFactors)) throw new Error("Invalid model interpretation");
    return { catalyst: "", riskFactors: parsed.riskFactors.filter((value: unknown) => typeof value === "string").slice(0, 3),
      entryThesis: parsed.entryThesis, whyAsymmetric: parsed.whyAsymmetric, invalidation: parsed.invalidation,
      aiEnriched: true, interpretationStatus: "MODEL_INTERPRETATION" };
  } catch (err: any) {
    log.warn(`[Asymmetric] Model interpretation unavailable for ${opportunity.ticker}: ${err?.message}`);
    return { catalyst: "", riskFactors: [], entryThesis: "", whyAsymmetric: "", invalidation: "", aiEnriched: false, interpretationStatus: "UNAVAILABLE" };
  }
}

// ── Main Engine ───────────────────────────────────────────────

/**
 * Fetch and score asymmetric opportunities from Yahoo Finance screeners.
 * Returns top N opportunities sorted by composite score descending.
 */
export async function getAsymmetricOpportunities(limit = 20): Promise<AsymmetricOpportunity[]> {
  const canonical = await getAuthoritativeCanonicalIntelligenceState();
  const pressure = toOperationalPressure(canonical);
  const pressureIndex = pressure.overallPressure;
  const regime = pressure.regime;
  const cacheKey = `asym_${limit}_${canonical!.stateId}`;
  const cached = asymCache.get(cacheKey);
  if (cached) return cached;
  const pool = await getAsymmetricScreenerCandidates();
  if (pool.status === "UNAVAILABLE") throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Asymmetric Opportunities: Yahoo candidate discovery is unavailable." });
  const quotes = await getQuotes(pool.candidates.map(candidate => candidate.ticker));
  const byTicker = new Map(quotes.map(quote => [quote.ticker.toUpperCase(), quote]));
  const macroFit = scoreMacroFit(pressureIndex, regime);
  const scored: Array<Omit<AsymmetricOpportunity, "catalyst" | "riskFactors" | "entryThesis" | "whyAsymmetric" | "invalidation" | "aiEnriched">> = [];
  let verifiedCount = 0;
  // Bound provider work without turning failures into invented score inputs.
  for (let start = 0; start < pool.candidates.length; start += 5) {
    const batch = pool.candidates.slice(start, start + 5);
    const observations = await Promise.all(batch.map(async candidate => ({ candidate, bars: completedSignalBars(await getDailyBars(candidate.ticker, "3mo")) })));
    for (const { candidate, bars } of observations) {
      const quote = byTicker.get(candidate.ticker);
      const timing = classifyYahooObservation(quote);
      if (!quote || quote.source === "error" || !["live", "delayed", "completed_session"].includes(timing.timing) ||
          ![quote.price, quote.changePercent, quote.volume, quote.open, quote.high, quote.low, quote.observedAt].every(value => typeof value === "number" && Number.isFinite(value)) || bars.length < 21) continue;
      const price = quote.price as number, changePercent = quote.changePercent as number, volume = quote.volume as number;
      const high = quote.high as number, low = quote.low as number, open = quote.open as number;
      if (price <= 0 || open <= 0 || volume < 0 || high < low) continue;
      const avgVolume = bars.slice(-21, -1).reduce((sum, bar) => sum + bar.volume, 0) / 20;
      const rangeHigh = Math.max(...bars.map(bar => bar.high));
      const rangeLow = Math.min(...bars.map(bar => bar.low));
      if (avgVolume <= 0 || rangeHigh <= rangeLow || rangeLow <= 0) continue;
      verifiedCount++;
      const marketCap = candidate.observedAt !== null && candidate.marketCap !== null && candidate.marketCap > 0 ? candidate.marketCap : null;
      const momentumScore = scoreMomentum(changePercent);
      const supportProximity = scoreSupportProximity(price, rangeLow, rangeHigh);
      const volumeSurge = scoreVolumeSurge(volume, avgVolume);
      const marketCapScore = marketCap === null ? null : scoreMarketCap(marketCap);
      const volatilityScore = scoreVolatility(((high - low) / open) * 100);
      // Original dimension weights retained; absent market cap is omitted and
      // available weights renormalized, never replaced with neutral 50.
      const scoreNumerator = momentumScore * .25 + supportProximity * .20 + volumeSurge * .15 + volatilityScore * .10 + macroFit * .15 + (marketCapScore === null ? 0 : marketCapScore * .15);
      const compositeScore = clamp(scoreNumerator / (marketCapScore === null ? .85 : 1));
      const setupType = classifySetup(momentumScore, supportProximity, volumeSurge, marketCapScore ?? -1, changePercent);
      const estimates = computeAsymmetry(price, rangeHigh, rangeLow, changePercent, setupType);
      if (estimates.asymmetryRatio < 1.5 || compositeScore < 40) continue;
      scored.push({ ticker: candidate.ticker, name: candidate.name, sector: candidate.sector, price, changePercent, volume, marketCap,
        ...estimates, momentumScore, supportProximity, volumeSurge, macroFit, compositeScore,
        conviction: determineConviction(compositeScore, estimates.asymmetryRatio), setupType, source: "yahoo-screener", fetchedAt: quote.fetchedAt,
        canonicalStateId: canonical!.stateId, canonicalAsOf: canonical!.effectiveAt, evidenceQuality: canonical!.confidenceOrEvidenceQuality,
        observedAt: quote.observedAt as number, priceSource: quote.source,
        sourceInputIds: [candidate.sourceIdentifier, `yahoo:quote:${candidate.ticker}:${quote.observedAt}`, `yahoo:completed-bars:${candidate.ticker}:${bars.at(-1)!.timestamp}`, canonical!.inputSnapshotId],
        methodologyVersion: "asymmetric-observed-rules-v2", evidenceClass: "DERIVED", observationTiming: timing.timing, rangeBasis: "completed-3mo-observations" });
    }
  }
  if (pool.candidates.length > 0 && verifiedCount === 0) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Asymmetric Opportunities: timestamped quotes and sufficient completed volume observations unavailable." });

  // Sort by composite score descending, take top N
  scored.sort((a, b) => b.compositeScore - a.compositeScore || a.ticker.localeCompare(b.ticker));
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
        return { ...opp, ...llm } as AsymmetricOpportunity;
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
