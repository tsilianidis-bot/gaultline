/**
 * Crypto Market Regime Engine
 * Thin adapter over the existing CryptoIntelligence engine that promotes
 * the BTC CyclePhase into a formal CryptoMarketRegime output.
 */
import {
  getCryptoIntelligence,
  CyclePhase,
  AccumulationPhaseAnalysis,
} from "./cryptoIntelligence";
import { LRUCache } from "./lruCache";

// ── Types ─────────────────────────────────────────────────────
export type CryptoRegimeLabel =
  | "Bull Market"
  | "Expansion"
  | "Late Bull / Euphoria"
  | "Distribution"
  | "Bear Market"
  | "Capitulation"
  | "Bear Market → Accumulation Phase"
  | "Accumulation"
  | "Early Recovery";

export type CryptoRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";
export type CryptoRegimeTrend = "Improving" | "Stable" | "Deteriorating";

export interface CryptoMarketRegime {
  regime:               CryptoRegimeLabel;
  cyclePhase:           CyclePhase;
  riskLevel:            CryptoRiskLevel;
  trend:                CryptoRegimeTrend;
  confidence:           number;
  keyFactors:           string[];
  strategy:             string;
  explanation:          string;
  color:                string;
  accumulationAnalysis: AccumulationPhaseAnalysis | null;
  fetchedAt:            number;
  cached:               boolean;
}

// ── Cache ─────────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new LRUCache<string, { regime: CryptoMarketRegime; fetchedAt: number }>(4, CACHE_TTL_MS);

export function clearCryptoRegimeCache(): void { cache.clear(); }

// ── Helpers ───────────────────────────────────────────────────
function cyclePhaseToRegime(phase: CyclePhase): CryptoRegimeLabel {
  const map: Record<CyclePhase, CryptoRegimeLabel> = {
    "Early Bull":                       "Expansion",
    "Mid Bull":                         "Bull Market",
    "Late Bull / Euphoria":             "Late Bull / Euphoria",
    "Distribution":                     "Distribution",
    "Early Bear":                       "Bear Market",
    "Mid Bear":                         "Bear Market",
    "Capitulation":                     "Capitulation",
    "Bear Market → Accumulation Phase": "Bear Market → Accumulation Phase",
    "Accumulation":                     "Accumulation",
  };
  return map[phase] ?? "Bear Market";
}

function regimeColor(r: CryptoRegimeLabel): string {
  const map: Record<CryptoRegimeLabel, string> = {
    "Bull Market":                       "#00FF88",
    "Expansion":                         "#4ADE80",
    "Late Bull / Euphoria":              "#F59E0B",
    "Distribution":                      "#F97316",
    "Bear Market":                       "#EF4444",
    "Capitulation":                      "#DC2626",
    "Bear Market → Accumulation Phase":  "#8B5CF6",
    "Accumulation":                      "#38BDF8",
    "Early Recovery":                    "#34D399",
  };
  return map[r] ?? "#94A3B8";
}

function strategyText(r: CryptoRegimeLabel): string {
  const map: Record<CryptoRegimeLabel, string> = {
    "Bull Market":                       "Ride momentum. Overweight BTC and quality alts. Use trailing stops.",
    "Expansion":                         "Accumulate on dips. Favour BTC and ETH. Reduce stablecoin allocation.",
    "Late Bull / Euphoria":              "Take profits. Reduce alt exposure. Raise stablecoin reserves. Avoid FOMO entries.",
    "Distribution":                      "Shift to stablecoins. Reduce alt exposure significantly. Protect gains.",
    "Bear Market":                       "Capital preservation. Favour stablecoins and cash. Avoid catching falling knives.",
    "Capitulation":                      "Extreme caution. Potential final flush — watch for reversal signals before re-entry.",
    "Bear Market → Accumulation Phase":  "Capital preservation first. Selective BTC accumulation at support. Avoid aggressive risk until breakout confirmation.",
    "Accumulation":                      "Gradual accumulation. Dollar-cost average into BTC. Position for the next cycle.",
    "Early Recovery":                    "Selective re-entry. Favour BTC and ETH. Size small initially.",
  };
  return map[r] ?? "Monitor conditions closely.";
}

function riskLevelFromScore(riskScore: number): CryptoRiskLevel {
  if (riskScore >= 80) return "Critical";
  if (riskScore >= 65) return "High";
  if (riskScore >= 50) return "Elevated";
  if (riskScore >= 35) return "Moderate";
  return "Low";
}

function trendFromDirection(direction: "up" | "down" | "sideways", score: number): CryptoRegimeTrend {
  if (direction === "up" && score > 55) return "Improving";
  if (direction === "down" && score < 45) return "Deteriorating";
  return "Stable";
}

function explanationText(r: CryptoRegimeLabel, phase: CyclePhase, confidence: number): string {
  const confPhrase = confidence >= 75 ? "with high confidence"
    : confidence >= 55 ? "with moderate confidence"
    : "with low confidence";
  const descriptions: Record<CryptoRegimeLabel, string> = {
    "Bull Market":                       `Bitcoin is in a bull market ${confPhrase}. Strong price momentum, expanding liquidity, and positive macro conditions support continued upside.`,
    "Expansion":                         `Bitcoin is in an early bull expansion phase ${confPhrase}. The cycle is gaining momentum with improving on-chain metrics and growing institutional interest.`,
    "Late Bull / Euphoria":              `Bitcoin is in the late bull / euphoria phase ${confPhrase}. Extreme sentiment and parabolic price action signal elevated risk of a cycle top. Profit-taking is warranted.`,
    "Distribution":                      `Bitcoin is in a distribution phase ${confPhrase}. Long-term holders appear to be reducing exposure. This phase often precedes a more significant correction.`,
    "Bear Market":                       `Bitcoin is in a bear market ${confPhrase}. Price structure is broken, liquidity is contracting, and macro conditions are unfavourable. Capital preservation is the priority.`,
    "Capitulation":                      `Bitcoin is in a capitulation phase ${confPhrase}. Forced selling and extreme fear dominate. This is often the final stage of a bear market.`,
    "Bear Market → Accumulation Phase":  `Bitcoin appears to be in an accumulation phase inside a broader bear-market structure ${confPhrase}. Price may be forming a base, but a new bull cycle is not confirmed until price breaks major resistance with strong volume, improving liquidity, and sustained risk-on confirmation.`,
    "Accumulation":                      `Bitcoin is in an accumulation phase ${confPhrase}. Long-term holders are absorbing supply at depressed prices. This phase can last months before a new bull cycle begins.`,
    "Early Recovery":                    `Bitcoin is showing early recovery signals ${confPhrase}. Price action is improving from lows but a new bull market is not yet confirmed.`,
  };
  return descriptions[r] ?? `Bitcoin cycle phase: ${phase}. Confidence: ${confidence}%.`;
}

// ── Public API ────────────────────────────────────────────────
export async function computeCryptoMarketRegime(): Promise<CryptoMarketRegime> {
  const cacheKey = "crypto-regime";
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return { ...hit.regime, cached: true };
  }

  const report = await getCryptoIntelligence();
  const btc     = report.btcDashboard;
  const phase   = btc.marketCyclePhase.phase;
  const conf    = btc.marketCyclePhase.confidence;
  const regime  = cyclePhaseToRegime(phase);
  const trend   = trendFromDirection(btc.trendStrength.direction, btc.trendStrength.score);
  const riskLevel = riskLevelFromScore(report.altcoinRisk.riskScore);

  const keyFactors: string[] = [];
  keyFactors.push(`Trend: ${btc.trendStrength.label} — ${btc.trendStrength.note}`);
  keyFactors.push(`Liquidity: ${btc.liquidityConditions.label} — ${btc.liquidityConditions.note}`);
  if (btc.etfInstitutionalFlow.direction !== "neutral") {
    keyFactors.push(`Institutional flow: ${btc.etfInstitutionalFlow.label} — ${btc.etfInstitutionalFlow.note}`);
  }
  if (report.macroCorrelation.overallMacroSignal !== "Neutral") {
    keyFactors.push(`Macro signal: ${report.macroCorrelation.overallMacroSignal} — ${report.macroCorrelation.correlationSummary.split(".")[0]}`);
  }
  if (btc.accumulationAnalysis?.keyEvidence?.length) {
    keyFactors.push(...btc.accumulationAnalysis.keyEvidence.slice(0, 2));
  }

  const result: CryptoMarketRegime = {
    regime,
    cyclePhase:           phase,
    riskLevel,
    trend,
    confidence:           conf,
    keyFactors,
    strategy:             strategyText(regime),
    explanation:          explanationText(regime, phase, conf),
    color:                regimeColor(regime),
    accumulationAnalysis: btc.accumulationAnalysis ?? null,
    fetchedAt:            Date.now(),
    cached:               false,
  };

  cache.set(cacheKey, { regime: result, fetchedAt: Date.now() });
  return result;
}
