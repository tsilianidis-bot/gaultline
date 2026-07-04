/**
 * Stock Market Regime Engine
 * Classifies the US equity market into 8 distinct regime states by combining
 * the FAULTLINE Pressure Index with SPY price trend data from Polygon.
 */
import { calculateFaultlinePressure, FaultlinePressureOutput } from "./pressure/engine";
import { fetchDailyBars } from "./signalsProxy";
import { LRUCache } from "./lruCache";

// ── Types ─────────────────────────────────────────────────────
export type StockRegimeLabel =
  | "Bull Market"
  | "Expansion"
  | "Consolidation"
  | "Correction"
  | "Distribution"
  | "Bear Market"
  | "Recovery"
  | "Recession Risk";

export type StockRiskLevel = "Low" | "Moderate" | "Elevated" | "High" | "Critical";
export type StockRegimeTrend = "Improving" | "Stable" | "Deteriorating";

export interface StockMarketRegime {
  regime:        StockRegimeLabel;
  riskLevel:     StockRiskLevel;
  trend:         StockRegimeTrend;
  confidence:    number;
  pressureScore: number;
  keyFactors:    string[];
  strategy:      string;
  explanation:   string;
  color:         string;
  fetchedAt:     number;
  cached:        boolean;
}

// ── Cache ─────────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new LRUCache<string, { regime: StockMarketRegime; fetchedAt: number }>(4, CACHE_TTL_MS);

export function clearStockRegimeCache(): void { cache.clear(); }

// ── Helpers ───────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function regimeColor(r: StockRegimeLabel): string {
  const map: Record<StockRegimeLabel, string> = {
    "Bull Market":    "#00FF88",
    "Expansion":      "#4ADE80",
    "Consolidation":  "#FACC15",
    "Correction":     "#FB923C",
    "Distribution":   "#F97316",
    "Bear Market":    "#EF4444",
    "Recovery":       "#38BDF8",
    "Recession Risk": "#DC2626",
  };
  return map[r] ?? "#94A3B8";
}

function strategyText(r: StockRegimeLabel): string {
  const map: Record<StockRegimeLabel, string> = {
    "Bull Market":    "Ride momentum. Overweight equities, favour growth and cyclicals. Tight stops on laggards.",
    "Expansion":      "Stay invested. Rotate into cyclicals and small-caps. Reduce cash drag.",
    "Consolidation":  "Hold core positions. Avoid chasing breakouts. Wait for directional confirmation.",
    "Correction":     "Reduce risk. Trim high-beta positions. Add defensive exposure. Watch for reversal signals.",
    "Distribution":   "Shift defensive. Raise cash. Favour value and dividend payers. Avoid new longs.",
    "Bear Market":    "Capital preservation. Minimal equity exposure. Favour cash, bonds, and inverse hedges.",
    "Recovery":       "Selective re-entry. Favour quality growth and beaten-down cyclicals. Size small initially.",
    "Recession Risk": "Defensive posture. Raise cash significantly. Favour Treasuries, utilities, and staples.",
  };
  return map[r] ?? "Monitor conditions closely.";
}

function riskLevelFromPressure(pressure: number, regime: StockRegimeLabel): StockRiskLevel {
  if (regime === "Recession Risk") return "Critical";
  if (pressure >= 75 || regime === "Bear Market") return "High";
  if (pressure >= 60 || regime === "Distribution") return "Elevated";
  if (pressure >= 40 || regime === "Correction" || regime === "Consolidation") return "Moderate";
  return "Low";
}

function trendFromPressureOutput(pressure: FaultlinePressureOutput): StockRegimeTrend {
  const r = (pressure.regime ?? "").toLowerCase();
  if (r.includes("low") || r.includes("calm") || r.includes("benign")) return "Improving";
  if (r.includes("elevated") || r.includes("high") || r.includes("crisis")) return "Deteriorating";
  return "Stable";
}

interface SpyMetrics {
  pct20d: number; pct50d: number; pct200d: number;
  aboveSma50: boolean; aboveSma200: boolean;
  trend: StockRegimeTrend; available: boolean;
}

function computeSpyMetrics(bars: { close: number }[]): SpyMetrics {
  if (bars.length < 201) {
    return { pct20d: 0, pct50d: 0, pct200d: 0, aboveSma50: false, aboveSma200: false, trend: "Stable", available: false };
  }
  const latest = bars[bars.length - 1].close;
  const sma = (n: number) => bars.slice(-n).reduce((s, b) => s + b.close, 0) / n;
  const sma50  = sma(50);
  const sma200 = sma(200);
  const p20  = bars[bars.length - 21].close;
  const p50  = bars[bars.length - 51].close;
  const p200 = bars[bars.length - 201].close;
  const pct20d  = ((latest - p20)  / p20)  * 100;
  const pct50d  = ((latest - p50)  / p50)  * 100;
  const pct200d = ((latest - p200) / p200) * 100;
  const trend: StockRegimeTrend = pct20d > 1.5 ? "Improving" : pct20d < -1.5 ? "Deteriorating" : "Stable";
  return { pct20d, pct50d, pct200d, aboveSma50: latest > sma50, aboveSma200: latest > sma200, trend, available: true };
}

function explanationText(r: StockRegimeLabel, pressure: number, trend: StockRegimeTrend): string {
  const pressurePhrase = pressure < 35 ? "macro stress is low"
    : pressure < 55 ? "macro stress is moderate"
    : pressure < 70 ? "macro stress is elevated"
    : "macro stress is high";
  const trendPhrase = trend === "Improving" ? "conditions are improving"
    : trend === "Deteriorating" ? "conditions are deteriorating"
    : "conditions are stable";
  const descriptions: Record<StockRegimeLabel, string> = {
    "Bull Market":    `The US equity market is in a bull market. ${pressurePhrase.charAt(0).toUpperCase() + pressurePhrase.slice(1)} and ${trendPhrase} with broad participation. Risk appetite is healthy and macro conditions are supportive.`,
    "Expansion":      `The market is in an expansion phase. ${pressurePhrase.charAt(0).toUpperCase() + pressurePhrase.slice(1)}, supporting continued equity gains. Breadth is adequate and the macro backdrop remains constructive.`,
    "Consolidation":  `The market is consolidating. ${pressurePhrase.charAt(0).toUpperCase() + pressurePhrase.slice(1)} and ${trendPhrase}. Price action is range-bound as the market digests recent moves. A directional break is likely ahead.`,
    "Correction":     `The market is in a correction. ${pressurePhrase.charAt(0).toUpperCase() + pressurePhrase.slice(1)} and ${trendPhrase}. This is a pullback within a broader trend — not yet a structural breakdown, but risk management is warranted.`,
    "Distribution":   `Distribution is underway. Smart money appears to be reducing exposure. ${pressurePhrase.charAt(0).toUpperCase() + pressurePhrase.slice(1)} and ${trendPhrase}. This phase often precedes a more significant decline.`,
    "Bear Market":    `The market is in a bear market. ${pressurePhrase.charAt(0).toUpperCase() + pressurePhrase.slice(1)} and ${trendPhrase}. Structural damage is evident. Capital preservation is the primary objective.`,
    "Recovery":       `The market is in early recovery. ${pressurePhrase.charAt(0).toUpperCase() + pressurePhrase.slice(1)} and ${trendPhrase}. Price action is improving from lows but a new bull market is not yet confirmed. Selective re-entry is appropriate.`,
    "Recession Risk": `Recession risk is elevated. ${pressurePhrase.charAt(0).toUpperCase() + pressurePhrase.slice(1)} and ${trendPhrase}. Multiple macro indicators are flashing warning signs. Defensive positioning is strongly advised.`,
  };
  return descriptions[r] ?? `Market regime: ${r}. Pressure index: ${Math.round(pressure)}/100.`;
}

function classifyRegime(
  pressure: number,
  metrics: SpyMetrics,
  creditScore: number,
  liquidityScore: number,
  breadthScore: number,
): { regime: StockRegimeLabel; confidence: number; keyFactors: string[] } {
  const { pct20d, pct50d, pct200d, aboveSma50, aboveSma200 } = metrics;
  const keyFactors: string[] = [];

  const scores: Record<StockRegimeLabel, number> = {
    "Bull Market": 0, "Expansion": 0, "Consolidation": 0, "Correction": 0,
    "Distribution": 0, "Bear Market": 0, "Recovery": 0, "Recession Risk": 0,
  };

  if (pressure < 30) {
    scores["Bull Market"] += 30; scores["Expansion"] += 20;
  } else if (pressure < 45) {
    scores["Expansion"] += 25; scores["Consolidation"] += 15; scores["Bull Market"] += 10;
  } else if (pressure < 60) {
    scores["Consolidation"] += 20; scores["Correction"] += 20; scores["Distribution"] += 10;
  } else if (pressure < 75) {
    scores["Distribution"] += 25; scores["Bear Market"] += 20; scores["Recession Risk"] += 10;
  } else {
    scores["Bear Market"] += 30; scores["Recession Risk"] += 30;
  }

  if (metrics.available) {
    if (aboveSma200 && aboveSma50 && pct50d > 5) {
      scores["Bull Market"] += 25; scores["Expansion"] += 15;
      keyFactors.push(`SPY above both 50-day and 200-day moving averages (+${pct50d.toFixed(1)}% over 50 days)`);
    } else if (aboveSma200 && aboveSma50) {
      scores["Expansion"] += 20; scores["Consolidation"] += 10;
      keyFactors.push("SPY above 50-day and 200-day moving averages");
    } else if (aboveSma200 && !aboveSma50) {
      scores["Correction"] += 20; scores["Consolidation"] += 15;
      keyFactors.push("SPY below 50-day MA but above 200-day MA — correction within uptrend");
    } else if (!aboveSma200 && pct200d > -10) {
      scores["Distribution"] += 20; scores["Bear Market"] += 15;
      keyFactors.push(`SPY below 200-day MA (${pct200d.toFixed(1)}% below) — structural weakness`);
    } else {
      scores["Bear Market"] += 25; scores["Recession Risk"] += 15;
      keyFactors.push(`SPY significantly below 200-day MA (${pct200d.toFixed(1)}%) — bear market structure`);
    }
    if (pct20d > 3) {
      scores["Bull Market"] += 15; scores["Expansion"] += 10;
      keyFactors.push(`Strong 20-day momentum: +${pct20d.toFixed(1)}%`);
    } else if (pct20d > 0) {
      scores["Expansion"] += 8; scores["Consolidation"] += 8;
    } else if (pct20d < -5) {
      scores["Bear Market"] += 15; scores["Correction"] += 10;
      keyFactors.push(`Weak 20-day momentum: ${pct20d.toFixed(1)}%`);
    } else if (pct20d < -2) {
      scores["Correction"] += 12; scores["Distribution"] += 8;
    }
  }

  if (creditScore > 70) {
    scores["Recession Risk"] += 20; scores["Bear Market"] += 15;
    keyFactors.push(`Credit stress elevated (score: ${Math.round(creditScore)}) — systemic risk rising`);
  } else if (creditScore > 50) {
    scores["Distribution"] += 10; scores["Correction"] += 8;
  } else if (creditScore < 30) {
    scores["Bull Market"] += 10; scores["Expansion"] += 8;
    keyFactors.push("Credit conditions benign — supports risk appetite");
  }

  if (liquidityScore > 65) {
    scores["Bear Market"] += 10; scores["Recession Risk"] += 10;
    keyFactors.push(`Liquidity stress elevated (score: ${Math.round(liquidityScore)})`);
  } else if (liquidityScore < 30) {
    scores["Bull Market"] += 8; scores["Expansion"] += 8;
  }

  if (metrics.available && pressure > 35 && pressure < 60 && aboveSma50 && pct20d > 1 && pct200d < 0) {
    scores["Recovery"] += 25;
    keyFactors.push("Recovery pattern: improving price action with declining stress from elevated levels");
  }

  if (breadthScore > 65) {
    scores["Bear Market"] += 8; scores["Recession Risk"] += 8;
  } else if (breadthScore < 35) {
    scores["Bull Market"] += 8; scores["Expansion"] += 8;
  }

  const sorted = (Object.entries(scores) as [StockRegimeLabel, number][]).sort((a, b) => b[1] - a[1]);
  const winner   = sorted[0][0];
  const runnerUp = sorted[1][1];
  const winScore = sorted[0][1];
  const total    = sorted.reduce((s, [, v]) => s + v, 0) || 1;
  const rawConf  = clamp((winScore / total) * 100, 0, 100);
  const gap      = winScore - runnerUp;
  const confidence = clamp(Math.round(rawConf * (1 - Math.max(0, (20 - gap) / 40))), 45, 92);

  if (keyFactors.length === 0) {
    keyFactors.push(`Pressure Index: ${Math.round(pressure)}/100`);
    if (metrics.available) keyFactors.push(`20-day trend: ${pct20d.toFixed(1)}%`);
  }

  return { regime: winner, confidence, keyFactors };
}

// ── Public API ────────────────────────────────────────────────
export async function computeStockMarketRegime(): Promise<StockMarketRegime> {
  const cacheKey = "stock-regime";
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return { ...hit.regime, cached: true };
  }

  const pressure = await calculateFaultlinePressure();
  const p = pressure.overallPressure; // already 0-100

  // vectors scores are already 0-100 in the server-side engine
  const vectorScore = (id: string) => pressure.vectors.find(v => v.id === id)?.score ?? 50;
  const creditScore    = vectorScore("credit-contagion");
  const liquidityScore = vectorScore("liquidity-stress");
  const breadthScore   = vectorScore("market-breadth");

  let spyMetrics: SpyMetrics = {
    pct20d: 0, pct50d: 0, pct200d: 0,
    aboveSma50: false, aboveSma200: false,
    trend: "Stable", available: false,
  };
  if (process.env.POLYGON_API_KEY) {
    try {
      const bars = await fetchDailyBars(process.env.POLYGON_API_KEY!, "SPY", 210);
      if (bars && bars.length >= 201) {
        spyMetrics = computeSpyMetrics(bars);
      }
    } catch {
      // Polygon unavailable — continue with pressure-only classification
    }
  }

  const { regime, confidence, keyFactors } = classifyRegime(p, spyMetrics, creditScore, liquidityScore, breadthScore);
  const trend     = spyMetrics.available ? spyMetrics.trend : trendFromPressureOutput(pressure);
  const riskLevel = riskLevelFromPressure(p, regime);

  const result: StockMarketRegime = {
    regime, riskLevel, trend, confidence,
    pressureScore: p,
    keyFactors,
    strategy:    strategyText(regime),
    explanation: explanationText(regime, p, trend),
    color:       regimeColor(regime),
    fetchedAt:   Date.now(),
    cached:      false,
  };

  cache.set(cacheKey, { regime: result, fetchedAt: Date.now() });
  return result;
}
