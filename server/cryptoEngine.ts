// ============================================================
// FAULTLINE — Crypto Intelligence Engine
//
// Derives FAULTLINE signal labels, systemic risk scores,
// and regime-aware classifications from live CoinGecko data
// and the existing FAULTLINE macro pressure engine.
//
// Signal labels (institutional, not retail):
//   Speculative Acceleration | Liquidity Fragile | Momentum Breakout
//   AI Narrative Exposure | Macro Sensitive | Stablecoin Stress
//   Deleveraging Risk | Risk-Off Vulnerable | Neutral / Watch
//
// Systemic Risk Score: 0–10 composite
// ============================================================
import { getCoinMarketData, getGlobalStats, getTopMarkets, type CoinMarketData, type GlobalStats } from "./coingeckoProxy";
import { calculateFaultlinePressure } from "./pressure/engine";
import { LRUCache } from "./lruCache";
import { log } from "./logger";

// ── Types ─────────────────────────────────────────────────────
export type CryptoSignalLabel =
  | "Speculative Acceleration"
  | "Liquidity Fragile"
  | "Momentum Breakout"
  | "AI Narrative Exposure"
  | "Macro Sensitive"
  | "Stablecoin Stress"
  | "Deleveraging Risk"
  | "Risk-Off Vulnerable"
  | "Neutral / Watch";

export type CryptoSignalBias = "Bullish" | "Neutral" | "Bearish";
export type CryptoRiskLevel  = "Low" | "Moderate" | "Elevated" | "High" | "Critical";
export type MomentumDir      = "Accelerating" | "Stable" | "Decelerating" | "Reversing";

export interface CryptoSignalVector {
  label: string;
  score: number;         // 0–100
  direction: "positive" | "negative" | "neutral";
  description: string;
}

export interface CryptoAssetIntelligence {
  // Market data
  id:                   string;
  symbol:               string;
  name:                 string;
  image:                string;
  currentPrice:         number;
  priceChangePercent24h: number;
  priceChangePercent7d:  number | null;
  marketCap:            number;
  totalVolume:          number;
  high24h:              number;
  low24h:               number;
  circulatingSupply:    number;
  ath:                  number;
  athChangePercent:     number;
  sparkline7d:          number[];
  volatility24h:        number;
  distanceFromAth:      number;

  // FAULTLINE intelligence
  signalBias:           CryptoSignalBias;
  signalScore:          number;          // 0–100 (100 = max bullish)
  riskLevel:            CryptoRiskLevel;
  riskScore:            number;          // 0–10
  momentum:             MomentumDir;
  primaryLabel:         CryptoSignalLabel;
  secondaryLabels:      CryptoSignalLabel[];
  vectors:              CryptoSignalVector[];
  macroAlignment:       "Aligned" | "Diverging" | "Neutral";
  liquiditySensitivity: "Low" | "Moderate" | "High" | "Extreme";
  speculativeIntensity: "Low" | "Moderate" | "High" | "Extreme";
  regimeNote:           string;
  keyInsights:          string[];
  generatedAt:          number;
}

export interface CryptoSystemicRisk {
  score:              number;   // 0–10
  level:              CryptoRiskLevel;
  btcDominance:       number;
  stablecoinLiquidity: "Expanding" | "Stable" | "Tightening" | "Contracting";
  volatilityRegime:   "Low" | "Normal" | "Elevated" | "Extreme";
  leverageConditions: "Low" | "Normal" | "Elevated" | "Extreme";
  marketBreadth:      "Strong" | "Moderate" | "Weak" | "Deteriorating";
  macroLiquidity:     "Expanding" | "Neutral" | "Tightening" | "Contracting";
  speculativeIntensity: "Low" | "Moderate" | "High" | "Extreme";
  breakdown:          CryptoSignalVector[];
  regime:             string;
  regimeColor:        string;
  summary:            string;
  fetchedAt:          number;
}

export interface CryptoIntelligenceResult {
  asset:        CryptoAssetIntelligence;
  systemicRisk: CryptoSystemicRisk;
  cached:       boolean;
}

// ── Cache ─────────────────────────────────────────────────────
const ASSET_CACHE_TTL = 2 * 60 * 1000;
const RISK_CACHE_TTL  = 3 * 60 * 1000;
const assetCache  = new LRUCache<string, CryptoAssetIntelligence>(200, ASSET_CACHE_TTL);
const riskCache   = new LRUCache<string, CryptoSystemicRisk>(5, RISK_CACHE_TTL);

export function clearCryptoEngineCache() {
  assetCache.clear();
  riskCache.clear();
}

// ── Helpers ───────────────────────────────────────────────────
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function lerp(v: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function scoreToRiskLevel(score: number): CryptoRiskLevel {
  if (score >= 8)  return "Critical";
  if (score >= 6.5) return "High";
  if (score >= 5)  return "Elevated";
  if (score >= 3)  return "Moderate";
  return "Low";
}

function scoreToSignalBias(signalScore: number): CryptoSignalBias {
  if (signalScore >= 60) return "Bullish";
  if (signalScore <= 40) return "Bearish";
  return "Neutral";
}

function deriveMomentum(change24h: number, change7d: number | null): MomentumDir {
  const weekly = change7d ?? 0;
  if (change24h > 3  && weekly > 5)  return "Accelerating";
  if (change24h < -3 && weekly < -5) return "Reversing";
  if (Math.abs(change24h) < 2)       return "Stable";
  return "Decelerating";
}

// ── Systemic Risk Score ───────────────────────────────────────
export async function computeCryptoSystemicRisk(): Promise<CryptoSystemicRisk> {
  const cached = riskCache.peek("systemic");
  if (cached) return cached.value;

  // Fetch macro pressure + global crypto stats in parallel
  const [pressure, global, topCoins] = await Promise.allSettled([
    calculateFaultlinePressure(),
    getGlobalStats(),
    getTopMarkets(20),
  ]);

  const macroP   = pressure.status === "fulfilled" ? pressure.value : null;
  const globalS  = global.status   === "fulfilled" ? global.value   : null;
  const top20    = topCoins.status === "fulfilled"  ? topCoins.value : [];

  // ── Component scores (0–10 each) ──────────────────────────
  // 1. BTC Dominance — high dominance = risk-off (bearish for alts, not systemic risk per se)
  //    But extreme dominance (>65%) can signal flight to safety = elevated risk
  const btcDom = globalS?.btcDominance ?? 55;
  const btcDomScore = btcDom > 65 ? lerp(btcDom, 65, 80, 6, 9) :
                      btcDom > 55 ? lerp(btcDom, 55, 65, 3, 6) :
                      lerp(btcDom, 40, 55, 1, 3);

  // 2. Market cap change 24h — large negative = systemic stress
  const mcChange = globalS?.marketCapChangePercent24h ?? 0;
  const mcScore = mcChange < -8 ? 9 : mcChange < -5 ? 7 : mcChange < -3 ? 5 :
                  mcChange < -1 ? 3 : mcChange > 3 ? 1 : 2;

  // 3. Volatility — average 24h range of top 20
  const avgVol24h = top20.length > 0
    ? top20.reduce((s, c) => s + c.volatility24h, 0) / top20.length
    : 5;
  const volScore = avgVol24h > 15 ? 9 : avgVol24h > 10 ? 7 : avgVol24h > 7 ? 5 :
                   avgVol24h > 4  ? 3 : 1;

  // 4. Macro pressure integration
  const macroScore = macroP ? clamp(macroP.overallPressure / 10, 0, 10) : 5;

  // 5. Breadth — how many of top 20 are down >5% in 24h
  const downCount = top20.filter(c => c.priceChangePercent24h < -5).length;
  const breadthScore = downCount > 15 ? 9 : downCount > 10 ? 7 : downCount > 6 ? 5 :
                       downCount > 3  ? 3 : 1;

  // 6. Stablecoin liquidity proxy — volume / market cap ratio of top stables
  // Higher ratio = more active trading = potential stress
  const stableVolumeRatio = globalS
    ? (globalS.totalVolume24h / Math.max(globalS.totalMarketCap, 1)) * 100
    : 5;
  const stableScore = stableVolumeRatio > 15 ? 8 : stableVolumeRatio > 10 ? 6 :
                      stableVolumeRatio > 6  ? 4 : 2;

  // Weighted composite
  const composite = (
    btcDomScore  * 0.15 +
    mcScore      * 0.25 +
    volScore     * 0.20 +
    macroScore   * 0.20 +
    breadthScore * 0.15 +
    stableScore  * 0.05
  );
  const finalScore = clamp(composite, 0, 10);

  // Qualitative labels
  const stablecoinLiquidity: CryptoSystemicRisk["stablecoinLiquidity"] =
    stableVolumeRatio > 12 ? "Contracting" :
    stableVolumeRatio > 8  ? "Tightening"  :
    stableVolumeRatio > 4  ? "Stable"      : "Expanding";

  const volatilityRegime: CryptoSystemicRisk["volatilityRegime"] =
    avgVol24h > 12 ? "Extreme" : avgVol24h > 8 ? "Elevated" :
    avgVol24h > 4  ? "Normal"  : "Low";

  const leverageConditions: CryptoSystemicRisk["leverageConditions"] =
    finalScore > 7.5 ? "Extreme" : finalScore > 5.5 ? "Elevated" :
    finalScore > 3   ? "Normal"  : "Low";

  const marketBreadth: CryptoSystemicRisk["marketBreadth"] =
    downCount > 14 ? "Deteriorating" : downCount > 9 ? "Weak" :
    downCount > 4  ? "Moderate"      : "Strong";

  const macroLiquidity: CryptoSystemicRisk["macroLiquidity"] =
    macroScore > 7 ? "Contracting" : macroScore > 5 ? "Tightening" :
    macroScore > 3 ? "Neutral"     : "Expanding";

  const speculativeIntensity: CryptoSystemicRisk["speculativeIntensity"] =
    stableVolumeRatio > 12 ? "Extreme" : stableVolumeRatio > 8 ? "High" :
    stableVolumeRatio > 5  ? "Moderate" : "Low";

  // Regime label
  const level = scoreToRiskLevel(finalScore);
  const regimeMap: Record<CryptoRiskLevel, { label: string; color: string }> = {
    "Low":      { label: "CRYPTO STABLE",          color: "#00FF88" },
    "Moderate": { label: "MODERATE CRYPTO STRESS", color: "#00D4FF" },
    "Elevated": { label: "ELEVATED CRYPTO RISK",   color: "#FFD700" },
    "High":     { label: "HIGH CRYPTO STRESS",     color: "#FF9500" },
    "Critical": { label: "CRITICAL CRYPTO RISK",   color: "#FF2D55" },
  };
  const { label: regime, color: regimeColor } = regimeMap[level];

  const summary = finalScore >= 7
    ? "Crypto markets are exhibiting systemic stress signals. Liquidity conditions are tightening, volatility is elevated, and macro pressure is weighing on digital assets. Risk management is critical."
    : finalScore >= 5
    ? "Crypto markets show elevated risk conditions. BTC dominance and volatility metrics suggest caution. Monitor liquidity conditions and macro developments closely."
    : finalScore >= 3
    ? "Crypto conditions are moderately stable. Some volatility present but systemic risk remains contained. Selective positioning may be appropriate."
    : "Crypto markets are in a low-stress regime. Liquidity conditions are supportive and macro alignment is constructive. Risk-on conditions may favor digital assets.";

  const result: CryptoSystemicRisk = {
    score:               parseFloat(finalScore.toFixed(2)),
    level,
    btcDominance:        parseFloat(btcDom.toFixed(2)),
    stablecoinLiquidity,
    volatilityRegime,
    leverageConditions,
    marketBreadth,
    macroLiquidity,
    speculativeIntensity,
    breakdown: [
      { label: "BTC Dominance",       score: btcDomScore  * 10, direction: btcDomScore  > 5 ? "negative" : "positive", description: `BTC dominance at ${btcDom.toFixed(1)}%` },
      { label: "Market Cap Momentum", score: mcScore      * 10, direction: mcScore      > 5 ? "negative" : "positive", description: `24h market cap change: ${mcChange.toFixed(1)}%` },
      { label: "Volatility",          score: volScore     * 10, direction: volScore     > 5 ? "negative" : "positive", description: `Avg 24h range: ${avgVol24h.toFixed(1)}%` },
      { label: "Macro Pressure",      score: macroScore   * 10, direction: macroScore   > 5 ? "negative" : "positive", description: `FAULTLINE macro score: ${(macroScore * 10).toFixed(0)}` },
      { label: "Market Breadth",      score: breadthScore * 10, direction: breadthScore > 5 ? "negative" : "positive", description: `${downCount}/20 top assets down >5%` },
      { label: "Stablecoin Flow",     score: stableScore  * 10, direction: stableScore  > 5 ? "negative" : "positive", description: `Volume/MCap ratio: ${stableVolumeRatio.toFixed(1)}%` },
    ],
    regime,
    regimeColor,
    summary,
    fetchedAt: Date.now(),
  };

  riskCache.set("systemic", result);
  return result;
}

// ── Asset Intelligence ────────────────────────────────────────
export async function computeAssetIntelligence(
  idOrSymbol: string,
  systemicRisk?: CryptoSystemicRisk
): Promise<CryptoAssetIntelligence | null> {
  const cacheKey = idOrSymbol.toLowerCase();
  const cached = assetCache.peek(cacheKey);
  if (cached) return cached.value;

  const [coinData, sysRisk] = await Promise.all([
    getCoinMarketData(idOrSymbol),
    systemicRisk ? Promise.resolve(systemicRisk) : computeCryptoSystemicRisk(),
  ]);

  if (!coinData) return null;

  const c = coinData;
  const sr = sysRisk;

  // ── Signal scoring (0–100, 100 = max bullish) ──────────────
  const vectors: CryptoSignalVector[] = [];

  // 1. Price momentum (24h)
  const momScore24h = clamp(50 + c.priceChangePercent24h * 3, 0, 100);
  vectors.push({
    label: "24h Momentum",
    score: momScore24h,
    direction: c.priceChangePercent24h > 1 ? "positive" : c.priceChangePercent24h < -1 ? "negative" : "neutral",
    description: `${c.priceChangePercent24h >= 0 ? "+" : ""}${c.priceChangePercent24h.toFixed(2)}% in 24h`,
  });

  // 2. Weekly momentum
  const weekly = c.priceChangePercent7d ?? 0;
  const momScore7d = clamp(50 + weekly * 1.5, 0, 100);
  vectors.push({
    label: "7d Momentum",
    score: momScore7d,
    direction: weekly > 2 ? "positive" : weekly < -2 ? "negative" : "neutral",
    description: `${weekly >= 0 ? "+" : ""}${weekly.toFixed(2)}% over 7 days`,
  });

  // 3. Distance from ATH (bearish if far below)
  const athDist = c.distanceFromAth; // negative number
  const athScore = clamp(50 + athDist * 0.5, 0, 100);
  vectors.push({
    label: "ATH Distance",
    score: athScore,
    direction: athDist > -20 ? "positive" : athDist < -60 ? "negative" : "neutral",
    description: `${athDist.toFixed(1)}% from all-time high`,
  });

  // 4. Volume / market cap (liquidity proxy)
  const volMcRatio = c.marketCap > 0 ? (c.totalVolume / c.marketCap) * 100 : 0;
  const volScore = clamp(50 + (volMcRatio - 5) * 3, 0, 100);
  vectors.push({
    label: "Volume / MCap",
    score: volScore,
    direction: volMcRatio > 8 ? "positive" : volMcRatio < 2 ? "negative" : "neutral",
    description: `Volume/MCap ratio: ${volMcRatio.toFixed(2)}%`,
  });

  // 5. Volatility (high vol = risk, not signal)
  const volRisk = clamp(50 - (c.volatility24h - 5) * 3, 0, 100);
  vectors.push({
    label: "Volatility Risk",
    score: volRisk,
    direction: c.volatility24h < 4 ? "positive" : c.volatility24h > 10 ? "negative" : "neutral",
    description: `24h range: ${c.volatility24h.toFixed(2)}%`,
  });

  // 6. Macro alignment (inverse of systemic risk)
  const macroAlignScore = clamp(100 - sr.score * 10, 0, 100);
  vectors.push({
    label: "Macro Alignment",
    score: macroAlignScore,
    direction: sr.score < 4 ? "positive" : sr.score > 6 ? "negative" : "neutral",
    description: `Systemic risk: ${sr.score.toFixed(1)}/10 — ${sr.regime}`,
  });

  // Composite signal score (weighted)
  const signalScore = Math.round(
    momScore24h  * 0.25 +
    momScore7d   * 0.20 +
    athScore     * 0.15 +
    volScore     * 0.15 +
    volRisk      * 0.10 +
    macroAlignScore * 0.15
  );

  // ── Risk score (0–10) ──────────────────────────────────────
  const riskScore = parseFloat(clamp(
    sr.score * 0.4 +
    (c.volatility24h / 2) * 0.3 +
    (Math.abs(c.priceChangePercent24h) / 5) * 0.3,
    0, 10
  ).toFixed(2));

  // ── Signal labels ──────────────────────────────────────────
  const labels: CryptoSignalLabel[] = [];

  // AI/Narrative tokens (RNDR, FET, OCEAN, GRT, INJ)
  const aiTokens = ["RNDR", "RENDER", "FET", "OCEAN", "GRT", "INJ", "TAO", "AGIX", "NMR", "ARKM"];
  if (aiTokens.includes(c.symbol.toUpperCase())) {
    labels.push("AI Narrative Exposure");
  }

  if (c.priceChangePercent24h > 8 && volMcRatio > 10) {
    labels.push("Speculative Acceleration");
  }
  if (volMcRatio < 2 || sr.stablecoinLiquidity === "Contracting") {
    labels.push("Liquidity Fragile");
  }
  if (c.priceChangePercent24h > 5 && (c.priceChangePercent7d ?? 0) > 10) {
    labels.push("Momentum Breakout");
  }
  if (sr.score >= 6) {
    labels.push("Macro Sensitive");
  }
  if (sr.stablecoinLiquidity === "Tightening" || sr.stablecoinLiquidity === "Contracting") {
    labels.push("Stablecoin Stress");
  }
  if (c.priceChangePercent24h < -8 && sr.score > 6) {
    labels.push("Deleveraging Risk");
  }
  if (sr.score > 7 || sr.volatilityRegime === "Extreme") {
    labels.push("Risk-Off Vulnerable");
  }
  if (labels.length === 0) {
    labels.push("Neutral / Watch");
  }

  const primaryLabel = labels[0];
  const secondaryLabels = labels.slice(1, 3);

  // ── Macro alignment ────────────────────────────────────────
  const macroAlignment: CryptoAssetIntelligence["macroAlignment"] =
    sr.score < 3 && signalScore > 55 ? "Aligned" :
    sr.score > 6 && signalScore < 45 ? "Diverging" : "Neutral";

  // ── Liquidity sensitivity ──────────────────────────────────
  const liquiditySensitivity: CryptoAssetIntelligence["liquiditySensitivity"] =
    c.marketCap < 1e9  ? "Extreme" :
    c.marketCap < 10e9 ? "High"    :
    c.marketCap < 100e9 ? "Moderate" : "Low";

  // ── Speculative intensity ──────────────────────────────────
  const speculativeIntensity: CryptoAssetIntelligence["speculativeIntensity"] =
    volMcRatio > 15 ? "Extreme" :
    volMcRatio > 8  ? "High"    :
    volMcRatio > 4  ? "Moderate" : "Low";

  // ── Key insights ───────────────────────────────────────────
  const insights: string[] = [];
  if (c.distanceFromAth < -70) {
    insights.push(`${c.symbol} is ${Math.abs(c.distanceFromAth).toFixed(0)}% below its all-time high, signals may indicate deep value or continued distribution.`);
  } else if (c.distanceFromAth > -15) {
    insights.push(`${c.symbol} is near all-time high territory — momentum conditions suggest potential continuation or resistance.`);
  }
  if (sr.macroLiquidity === "Contracting" || sr.macroLiquidity === "Tightening") {
    insights.push("Macro liquidity conditions are tightening. Historically, risk assets including crypto face headwinds in this regime.");
  }
  if (liquiditySensitivity === "Extreme" || liquiditySensitivity === "High") {
    insights.push(`${c.symbol} has a smaller market cap, making it more sensitive to liquidity shifts and speculative flows.`);
  }
  if (sr.btcDominance > 60) {
    insights.push(`BTC dominance at ${sr.btcDominance.toFixed(1)}% signals risk-off rotation. Altcoins may face relative pressure.`);
  }
  if (insights.length === 0) {
    insights.push(`${c.symbol} is trading within normal parameters. Monitor macro conditions and BTC dominance for directional cues.`);
  }

  const regimeNote = `${sr.regime} — ${sr.summary.split(".")[0]}.`;

  const result: CryptoAssetIntelligence = {
    id:                   c.id,
    symbol:               c.symbol,
    name:                 c.name,
    image:                c.image,
    currentPrice:         c.currentPrice,
    priceChangePercent24h: c.priceChangePercent24h,
    priceChangePercent7d:  c.priceChangePercent7d,
    marketCap:            c.marketCap,
    totalVolume:          c.totalVolume,
    high24h:              c.high24h,
    low24h:               c.low24h,
    circulatingSupply:    c.circulatingSupply,
    ath:                  c.ath,
    athChangePercent:     c.athChangePercent,
    sparkline7d:          c.sparkline7d,
    volatility24h:        c.volatility24h,
    distanceFromAth:      c.distanceFromAth,
    signalBias:           scoreToSignalBias(signalScore),
    signalScore,
    riskLevel:            scoreToRiskLevel(riskScore),
    riskScore,
    momentum:             deriveMomentum(c.priceChangePercent24h, c.priceChangePercent7d),
    primaryLabel,
    secondaryLabels,
    vectors,
    macroAlignment,
    liquiditySensitivity,
    speculativeIntensity,
    regimeNote,
    keyInsights:          insights,
    generatedAt:          Date.now(),
  };

  assetCache.set(cacheKey, result);
  return result;
}

// ── Full intelligence result ──────────────────────────────────
export async function getCryptoIntelligenceResult(
  idOrSymbol: string
): Promise<CryptoIntelligenceResult | null> {
  try {
    const systemicRisk = await computeCryptoSystemicRisk();
    const assetCacheKey = idOrSymbol.toLowerCase();
    const wasCached = assetCache.peek(assetCacheKey) !== null;
    const asset = await computeAssetIntelligence(idOrSymbol, systemicRisk);
    if (!asset) return null;
    return { asset, systemicRisk, cached: wasCached };
  } catch (err) {
    log.error("[CryptoEngine] Failed to compute intelligence", { id: idOrSymbol, err });
    return null;
  }
}
