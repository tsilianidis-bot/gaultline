// ============================================================
// FAULTLINE Crypto Intelligence™ — server/cryptoIntelligence.ts
//
// Generates institutional-grade crypto market signals by
// combining FAULTLINE macro pressure data with crypto-specific
// risk factors (dominance, stablecoin supply, liquidity cycles).
//
// Signal labels: Bullish | Neutral | Bearish
// Risk levels:   Low | Moderate | Elevated | High | Critical
//
// DISCLAIMER: Signals are for informational purposes only and
// do not constitute financial advice.
// ============================================================
import { invokeLLM } from "./_core/llm";
import { calculateFaultlinePressure, type FaultlinePressureOutput } from "./pressure/engine";
import { LRUCache } from "./lruCache";

// ── Types ────────────────────────────────────────────────────

export type CryptoSignal = "Bullish" | "Neutral" | "Bearish";
export type CryptoRisk   = "Low" | "Moderate" | "Elevated" | "High" | "Critical";
export type MomentumDir  = "Accelerating" | "Stable" | "Decelerating" | "Reversing";
export type CyclePhase   =
  | "Early Bull"
  | "Mid Bull"
  | "Late Bull / Euphoria"
  | "Distribution"
  | "Early Bear"
  | "Mid Bear"
  | "Capitulation"
  | "Accumulation";

export interface CryptoAssetSignal {
  id: string;
  name: string;
  ticker: string;
  signal: CryptoSignal;
  momentum: MomentumDir;
  risk: CryptoRisk;
  riskScore: number;      // 0–100
  signalScore: number;    // 0–100 (higher = more bullish)
  explanation: string;    // 1–2 sentence plain-English summary
  keyDrivers: string[];   // 2–3 bullet strings
  macroAlignment: "Aligned" | "Diverging" | "Neutral";
}

export interface BitcoinMacroDashboard {
  trendStrength:       { score: number; label: string; direction: "up" | "down" | "sideways"; note: string };
  liquidityConditions: { score: number; label: string; direction: "expanding" | "contracting" | "neutral"; note: string };
  dollarPressure:      { score: number; label: string; direction: "strengthening" | "weakening" | "neutral"; note: string };
  yieldPressure:       { score: number; label: string; direction: "rising" | "falling" | "neutral"; note: string };
  etfInstitutionalFlow:{ score: number; label: string; direction: "inflow" | "outflow" | "neutral"; note: string };
  marketCyclePhase:    { phase: CyclePhase; confidence: number; note: string };
  overallBtcBias:      CryptoSignal;
  aiNarrative:         string;
}

export interface AltcoinRiskAssessment {
  overallRisk: CryptoRisk;
  riskScore: number;          // 0–100
  btcDominanceSignal: string; // e.g. "Dominance rising — altcoin risk elevated"
  liquiditySignal: string;
  stablecoinSignal: string;
  riskOnOffSignal: string;
  macroPressureSignal: string;
  volatilitySignal: string;
  altcoinSeasonProbability: number; // 0–100
  recommendation: string;
}

export interface CryptoMacroCorrelation {
  fedPolicyImpact:    { signal: CryptoSignal; note: string };
  interestRateImpact: { signal: CryptoSignal; note: string };
  dollarStrength:     { signal: CryptoSignal; note: string };
  liquidityCycle:     { signal: CryptoSignal; note: string };
  equityRiskAppetite: { signal: CryptoSignal; note: string };
  bondMarketStress:   { signal: CryptoSignal; note: string };
  overallMacroSignal: CryptoSignal;
  correlationSummary: string;
}

export interface CryptoPortfolioGuidance {
  btcGuidance:   { action: string; condition: string; note: string };
  ethGuidance:   { action: string; condition: string; note: string };
  altGuidance:   { action: string; condition: string; note: string };
  stableGuidance:{ action: string; condition: string; note: string };
  overallBias:   string;
  disclaimer:    string;
}

export interface CryptoIntelligenceReport {
  generatedAt:       number;
  pressureIndex:     number;
  regime:            string;
  signals:           CryptoAssetSignal[];
  btcDashboard:      BitcoinMacroDashboard;
  altcoinRisk:       AltcoinRiskAssessment;
  macroCorrelation:  CryptoMacroCorrelation;
  portfolioGuidance: CryptoPortfolioGuidance;
  cached?:           boolean;
}

// ── LRU cache (5-minute TTL) ─────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const cryptoCache = new LRUCache<string, { report: CryptoIntelligenceReport; fetchedAt: number }>(20, CACHE_TTL_MS);

export function clearCryptoCache(): void {
  cryptoCache.clear();
}

// ── Helpers ──────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function scoreToSignal(score: number): CryptoSignal {
  if (score >= 60) return "Bullish";
  if (score >= 40) return "Neutral";
  return "Bearish";
}

function scoreToRisk(score: number): CryptoRisk {
  if (score >= 80) return "Critical";
  if (score >= 65) return "High";
  if (score >= 45) return "Elevated";
  if (score >= 25) return "Moderate";
  return "Low";
}

function scoreToMomentum(score: number, prev = 50): MomentumDir {
  const delta = score - prev;
  if (delta > 10) return "Accelerating";
  if (delta < -10) return "Reversing";
  if (Math.abs(delta) <= 5) return "Stable";
  return "Decelerating";
}

// ── Crypto signal scoring ─────────────────────────────────────

function scoreBitcoin(p: FaultlinePressureOutput): { signalScore: number; riskScore: number; drivers: string[] } {
  const pressure = p.overallPressure;
  // BTC signal: inversely correlated with macro pressure, positively with liquidity
  const liquidityBoost  = clamp(100 - (p.vectors.find(v => v.id === "liquidity")?.score ?? 50), 0, 100);
  const macroHeadwind   = clamp(pressure, 0, 100);
  const yieldHeadwind   = clamp((p.vectors.find(v => v.id === "yield_curve")?.score ?? 40), 0, 100);
  const creditHeadwind  = clamp((p.vectors.find(v => v.id === "credit_stress")?.score ?? 40), 0, 100);

  const signalScore = clamp(
    0.40 * liquidityBoost +
    0.30 * (100 - macroHeadwind) +
    0.15 * (100 - yieldHeadwind) +
    0.15 * (100 - creditHeadwind),
    0, 100
  );
  const riskScore = clamp(
    0.35 * macroHeadwind +
    0.25 * yieldHeadwind +
    0.20 * creditHeadwind +
    0.20 * (100 - liquidityBoost),
    0, 100
  );

  const drivers: string[] = [];
  if (liquidityBoost > 60)  drivers.push("Liquidity conditions are supportive for risk assets");
  else if (liquidityBoost < 40) drivers.push("Tightening liquidity is a headwind for BTC");
  if (yieldHeadwind > 60)   drivers.push("Elevated Treasury yields compress crypto valuations");
  if (macroHeadwind > 65)   drivers.push("Macro stress regime typically precedes crypto drawdowns");
  if (creditHeadwind < 35)  drivers.push("Credit markets stable — risk appetite intact");
  if (drivers.length === 0) drivers.push("Mixed macro signals — BTC tracking broader risk sentiment");
  return { signalScore, riskScore, drivers };
}

function scoreEthereum(p: FaultlinePressureOutput): { signalScore: number; riskScore: number; drivers: string[] } {
  const btc = scoreBitcoin(p);
  // ETH is more sensitive to liquidity and tech-sector conditions
  const techSector = clamp((p.vectors.find(v => v.id === "equity_stress")?.score ?? 40), 0, 100);
  const signalScore = clamp(btc.signalScore * 0.7 + (100 - techSector) * 0.3, 0, 100);
  const riskScore   = clamp(btc.riskScore   * 0.6 + techSector           * 0.4, 0, 100);
  const drivers = [
    ...btc.drivers.slice(0, 2),
    techSector > 55 ? "Equity market stress amplifies ETH downside risk" : "Tech-sector stability supports ETH network activity",
  ];
  return { signalScore, riskScore, drivers };
}

function scoreSolana(p: FaultlinePressureOutput): { signalScore: number; riskScore: number; drivers: string[] } {
  const eth = scoreEthereum(p);
  // SOL is higher-beta — amplifies ETH moves
  const volatilityFactor = 1.15;
  const signalScore = clamp((eth.signalScore - 50) * volatilityFactor + 50, 0, 100);
  const riskScore   = clamp(eth.riskScore * volatilityFactor, 0, 100);
  return {
    signalScore,
    riskScore,
    drivers: [
      "SOL is higher-beta than ETH — amplifies both upside and downside",
      ...eth.drivers.slice(0, 2),
    ],
  };
}

function scoreTotalMarketCap(p: FaultlinePressureOutput): { signalScore: number; riskScore: number; drivers: string[] } {
  const btc = scoreBitcoin(p);
  const pressure = p.overallPressure;
  const signalScore = clamp(btc.signalScore * 0.8 + (100 - pressure) * 0.2, 0, 100);
  const riskScore   = clamp(btc.riskScore   * 0.8 + pressure         * 0.2, 0, 100);
  return {
    signalScore,
    riskScore,
    drivers: [
      "Total market cap tracks BTC with broader altcoin participation",
      pressure > 60 ? "Macro stress historically compresses total crypto market cap" : "Macro conditions are not severely restrictive for crypto markets",
    ],
  };
}

function scoreAltcoinSeason(p: FaultlinePressureOutput): { signalScore: number; riskScore: number; drivers: string[] } {
  const pressure = p.overallPressure;
  const liquidity = clamp(100 - (p.vectors.find(v => v.id === "liquidity")?.score ?? 50), 0, 100);
  // Altcoin season requires: low macro pressure, high liquidity, risk-on conditions
  const signalScore = clamp(
    0.40 * liquidity +
    0.40 * (100 - pressure) +
    0.20 * clamp(100 - (p.vectors.find(v => v.id === "credit_stress")?.score ?? 40), 0, 100),
    0, 100
  );
  const riskScore = clamp(100 - signalScore, 0, 100);
  return {
    signalScore,
    riskScore,
    drivers: [
      liquidity > 60 ? "Liquidity expansion historically precedes altcoin outperformance" : "Liquidity contraction suppresses altcoin season probability",
      pressure < 40  ? "Low macro pressure supports risk-on rotation into altcoins" : "Elevated macro pressure reduces altcoin season probability",
    ],
  };
}

function scoreStablecoinLiquidity(p: FaultlinePressureOutput): { signalScore: number; riskScore: number; drivers: string[] } {
  const pressure = p.overallPressure;
  const liquidity = clamp(100 - (p.vectors.find(v => v.id === "liquidity")?.score ?? 50), 0, 100);
  // Stablecoin liquidity is a leading indicator — high stablecoin supply = dry powder
  const signalScore = clamp(liquidity * 0.6 + (100 - pressure) * 0.4, 0, 100);
  const riskScore   = clamp(pressure * 0.5 + (100 - liquidity) * 0.5, 0, 100);
  return {
    signalScore,
    riskScore,
    drivers: [
      signalScore > 60 ? "Stablecoin supply signals dry powder available for deployment" : "Stablecoin supply contraction suggests capital is already deployed",
      "Stablecoin liquidity is a leading indicator for crypto market moves",
    ],
  };
}

// ── Bitcoin Macro Dashboard ───────────────────────────────────

function buildBtcDashboard(p: FaultlinePressureOutput): Omit<BitcoinMacroDashboard, "aiNarrative"> {
  const pressure  = p.overallPressure;
  const liquidity = clamp(100 - (p.vectors.find(v => v.id === "liquidity")?.score ?? 50), 0, 100);
  const yields    = clamp((p.vectors.find(v => v.id === "yield_curve")?.score ?? 40), 0, 100);
  const credit    = clamp((p.vectors.find(v => v.id === "credit_stress")?.score ?? 40), 0, 100);
  const equity    = clamp((p.vectors.find(v => v.id === "equity_stress")?.score ?? 40), 0, 100);
  const sovereign = clamp((p.vectors.find(v => v.id === "sovereign_debt")?.score ?? 40), 0, 100);

  // Trend strength: inverse of pressure + equity stress
  const trendScore = clamp(100 - (pressure * 0.6 + equity * 0.4), 0, 100);

  // Dollar pressure: sovereign debt + yield curve (proxy for DXY strength)
  const dxyScore = clamp(sovereign * 0.5 + yields * 0.5, 0, 100);

  // ETF/institutional flow: inversely correlated with macro stress
  const etfScore = clamp(100 - (pressure * 0.5 + credit * 0.5), 0, 100);

  // Cycle phase determination
  let cyclePhase: CyclePhase;
  let cycleConfidence: number;
  if (trendScore >= 75 && liquidity >= 65) {
    cyclePhase = "Mid Bull"; cycleConfidence = 72;
  } else if (trendScore >= 60 && liquidity >= 50) {
    cyclePhase = "Early Bull"; cycleConfidence = 65;
  } else if (trendScore >= 50 && pressure >= 55) {
    cyclePhase = "Late Bull / Euphoria"; cycleConfidence = 55;
  } else if (pressure >= 65 && trendScore < 50) {
    cyclePhase = "Distribution"; cycleConfidence = 60;
  } else if (pressure >= 75) {
    cyclePhase = "Early Bear"; cycleConfidence = 68;
  } else if (pressure >= 80 && liquidity < 35) {
    cyclePhase = "Mid Bear"; cycleConfidence = 70;
  } else if (trendScore < 30 && liquidity < 30) {
    cyclePhase = "Capitulation"; cycleConfidence = 62;
  } else {
    cyclePhase = "Accumulation"; cycleConfidence = 58;
  }

  const btcSignalScore = scoreBitcoin(p).signalScore;

  return {
    trendStrength: {
      score: trendScore,
      label: trendScore >= 70 ? "Strong" : trendScore >= 50 ? "Moderate" : trendScore >= 30 ? "Weak" : "Deteriorating",
      direction: trendScore >= 55 ? "up" : trendScore >= 40 ? "sideways" : "down",
      note: trendScore >= 60 ? "BTC trend is supported by macro conditions" : "Macro headwinds are pressuring BTC trend strength",
    },
    liquidityConditions: {
      score: liquidity,
      label: liquidity >= 65 ? "Expanding" : liquidity >= 45 ? "Neutral" : liquidity >= 25 ? "Contracting" : "Tightening",
      direction: liquidity >= 55 ? "expanding" : liquidity >= 40 ? "neutral" : "contracting",
      note: liquidity >= 55 ? "Liquidity expansion historically precedes crypto rallies" : "Liquidity contraction is a headwind for crypto markets",
    },
    dollarPressure: {
      score: dxyScore,
      label: dxyScore >= 65 ? "Strong Dollar" : dxyScore >= 45 ? "Neutral" : "Weak Dollar",
      direction: dxyScore >= 55 ? "strengthening" : dxyScore >= 40 ? "neutral" : "weakening",
      note: dxyScore >= 60 ? "Dollar strength historically creates headwinds for BTC" : "Dollar weakness may support BTC as an alternative store of value",
    },
    yieldPressure: {
      score: yields,
      label: yields >= 65 ? "Elevated" : yields >= 45 ? "Moderate" : "Low",
      direction: yields >= 55 ? "rising" : yields >= 40 ? "neutral" : "falling",
      note: yields >= 60 ? "Rising yields compress risk-asset valuations including crypto" : "Yield conditions are not severely restrictive for crypto",
    },
    etfInstitutionalFlow: {
      score: etfScore,
      label: etfScore >= 65 ? "Inflow Bias" : etfScore >= 45 ? "Mixed" : "Outflow Bias",
      direction: etfScore >= 55 ? "inflow" : etfScore >= 40 ? "neutral" : "outflow",
      note: etfScore >= 60 ? "Macro conditions suggest institutional flows may favor crypto" : "Macro stress may be reducing institutional risk appetite for crypto",
    },
    marketCyclePhase: {
      phase: cyclePhase,
      confidence: cycleConfidence,
      note: `FAULTLINE macro indicators suggest ${cyclePhase} conditions with ${cycleConfidence}% signal confidence`,
    },
    overallBtcBias: scoreToSignal(btcSignalScore),
  };
}

// ── Altcoin Risk Assessment ───────────────────────────────────

function buildAltcoinRisk(p: FaultlinePressureOutput): AltcoinRiskAssessment {
  const pressure  = p.overallPressure;
  const liquidity = clamp(100 - (p.vectors.find(v => v.id === "liquidity")?.score ?? 50), 0, 100);
  const credit    = clamp((p.vectors.find(v => v.id === "credit_stress")?.score ?? 40), 0, 100);
  const equity    = clamp((p.vectors.find(v => v.id === "equity_stress")?.score ?? 40), 0, 100);

  const riskScore = clamp(
    0.30 * pressure +
    0.25 * (100 - liquidity) +
    0.25 * credit +
    0.20 * equity,
    0, 100
  );

  const altSeasonProb = clamp(
    0.40 * liquidity +
    0.40 * (100 - pressure) +
    0.20 * (100 - credit),
    0, 100
  );

  return {
    overallRisk: scoreToRisk(riskScore),
    riskScore,
    btcDominanceSignal: pressure > 60
      ? "Elevated macro stress typically drives BTC dominance higher — altcoin risk is elevated"
      : "Macro conditions may support rotation from BTC into altcoins",
    liquiditySignal: liquidity > 60
      ? "Liquidity expansion signals may indicate favorable conditions for altcoin participation"
      : "Liquidity contraction historically precedes altcoin underperformance",
    stablecoinSignal: liquidity > 55
      ? "Stablecoin supply conditions suggest dry powder available for altcoin deployment"
      : "Stablecoin supply contraction may signal reduced altcoin buying pressure",
    riskOnOffSignal: equity < 45
      ? "Risk-on equity conditions may support altcoin risk appetite"
      : "Risk-off equity conditions typically suppress altcoin performance",
    macroPressureSignal: pressure < 40
      ? "Low macro pressure is historically associated with altcoin season conditions"
      : "Elevated macro pressure is a headwind for speculative altcoin positions",
    volatilitySignal: credit > 55
      ? "Credit market stress signals elevated volatility risk for altcoins"
      : "Credit conditions are not signaling extreme volatility risk",
    altcoinSeasonProbability: Math.round(altSeasonProb),
    recommendation: altSeasonProb > 65
      ? "Conditions may be developing that historically precede altcoin outperformance — monitor closely"
      : altSeasonProb > 45
      ? "Mixed signals — selective altcoin exposure may be appropriate with risk management"
      : "Current macro conditions suggest caution with broad altcoin exposure",
  };
}

// ── Macro Correlation ─────────────────────────────────────────

function buildMacroCorrelation(p: FaultlinePressureOutput): Omit<CryptoMacroCorrelation, "correlationSummary"> {
  const pressure  = p.overallPressure;
  const liquidity = clamp(100 - (p.vectors.find(v => v.id === "liquidity")?.score ?? 50), 0, 100);
  const yields    = clamp((p.vectors.find(v => v.id === "yield_curve")?.score ?? 40), 0, 100);
  const credit    = clamp((p.vectors.find(v => v.id === "credit_stress")?.score ?? 40), 0, 100);
  const equity    = clamp((p.vectors.find(v => v.id === "equity_stress")?.score ?? 40), 0, 100);
  const sovereign = clamp((p.vectors.find(v => v.id === "sovereign_debt")?.score ?? 40), 0, 100);

  // Fed policy: tighter policy = bearish for crypto
  const fedScore = clamp(100 - (yields * 0.6 + sovereign * 0.4), 0, 100);
  // Interest rates: higher rates = bearish
  const rateScore = clamp(100 - yields, 0, 100);
  // Dollar strength: stronger dollar = bearish for crypto
  const dxyScore = clamp(100 - (sovereign * 0.5 + yields * 0.5), 0, 100);
  // Liquidity cycle: expanding = bullish
  const liqScore = liquidity;
  // Equity risk appetite: risk-on = bullish for crypto
  const eqScore = clamp(100 - equity, 0, 100);
  // Bond stress: high bond stress = bearish
  const bondScore = clamp(100 - credit, 0, 100);

  const overallScore = clamp(
    (fedScore + rateScore + dxyScore + liqScore + eqScore + bondScore) / 6, 0, 100
  );

  return {
    fedPolicyImpact: {
      signal: scoreToSignal(fedScore),
      note: fedScore >= 60
        ? "Fed policy conditions may be supportive for risk assets including crypto"
        : "Restrictive Fed policy signals are a headwind for crypto valuations",
    },
    interestRateImpact: {
      signal: scoreToSignal(rateScore),
      note: rateScore >= 60
        ? "Interest rate conditions are not severely restrictive for crypto"
        : "Elevated interest rates historically compress crypto risk premiums",
    },
    dollarStrength: {
      signal: scoreToSignal(dxyScore),
      note: dxyScore >= 60
        ? "Dollar weakness conditions may support crypto as an alternative asset"
        : "Dollar strength signals may create headwinds for crypto markets",
    },
    liquidityCycle: {
      signal: scoreToSignal(liqScore),
      note: liqScore >= 60
        ? "Liquidity cycle signals suggest conditions may be favorable for crypto"
        : "Liquidity contraction is historically associated with crypto drawdowns",
    },
    equityRiskAppetite: {
      signal: scoreToSignal(eqScore),
      note: eqScore >= 60
        ? "Equity risk appetite signals suggest risk-on conditions for crypto"
        : "Risk-off equity conditions may suppress crypto risk appetite",
    },
    bondMarketStress: {
      signal: scoreToSignal(bondScore),
      note: bondScore >= 60
        ? "Bond market conditions are not signaling systemic stress for crypto"
        : "Bond market stress signals may indicate broader risk-off conditions",
    },
    overallMacroSignal: scoreToSignal(overallScore),
  };
}

// ── Portfolio Guidance ────────────────────────────────────────

function buildPortfolioGuidance(p: FaultlinePressureOutput): CryptoPortfolioGuidance {
  const pressure  = p.overallPressure;
  const liquidity = clamp(100 - (p.vectors.find(v => v.id === "liquidity")?.score ?? 50), 0, 100);
  const btcScore  = scoreBitcoin(p).signalScore;
  const altScore  = scoreAltcoinSeason(p).signalScore;

  const btcAction   = btcScore >= 65 ? "Add" : btcScore >= 50 ? "Hold" : btcScore >= 35 ? "Trim" : btcScore >= 20 ? "Reduce Risk" : "Move to Stables";
  const ethAction   = btcScore >= 60 ? "Hold" : btcScore >= 45 ? "Hold" : btcScore >= 30 ? "Trim" : "Reduce Risk";
  const altAction   = altScore >= 65 ? "Selective Add" : altScore >= 50 ? "Hold" : altScore >= 35 ? "Trim" : "Reduce Risk";
  const stableAction = pressure >= 70 ? "Increase Allocation" : pressure >= 50 ? "Maintain Buffer" : "Reduce — Deploy Selectively";

  return {
    btcGuidance: {
      action: btcAction,
      condition: btcScore >= 60
        ? "Macro conditions may support BTC exposure"
        : "Macro headwinds suggest caution with BTC sizing",
      note: "BTC guidance is based on macro pressure, liquidity, and yield conditions — not price prediction",
    },
    ethGuidance: {
      action: ethAction,
      condition: btcScore >= 55
        ? "ETH conditions broadly track BTC with additional tech-sector sensitivity"
        : "ETH may face amplified downside if macro stress continues",
      note: "ETH signals assess macro alignment and network activity conditions",
    },
    altGuidance: {
      action: altAction,
      condition: altScore >= 60
        ? "Conditions may be developing that historically precede altcoin rotation"
        : "Macro environment suggests selectivity and risk management for altcoins",
      note: "Altcoin guidance reflects liquidity, dominance, and macro risk conditions",
    },
    stableGuidance: {
      action: stableAction,
      condition: pressure >= 65
        ? "Elevated macro stress signals may indicate value in maintaining stablecoin reserves"
        : "Current conditions do not signal an urgent need to increase stablecoin allocation",
      note: "Stablecoin guidance reflects overall macro risk level — not a specific allocation recommendation",
    },
    overallBias: btcScore >= 60 && liquidity >= 55
      ? "Risk-on conditions may support crypto exposure with appropriate position sizing"
      : btcScore >= 45
      ? "Mixed signals — selective exposure with active risk management may be appropriate"
      : "Macro conditions suggest caution — risk management and capital preservation may be prudent",
    disclaimer:
      "All guidance is for informational purposes only. FAULTLINE helps assess market conditions — it does not provide financial advice. Signals may indicate conditions but do not predict outcomes.",
  };
}

// ── LLM narrative generation ──────────────────────────────────

async function generateBtcNarrative(
  p: FaultlinePressureOutput,
  dashboard: Omit<BitcoinMacroDashboard, "aiNarrative">
): Promise<string> {
  try {
    const prompt = `You are FAULTLINE, an institutional-grade macro intelligence system. Generate a 3-sentence Bitcoin macro narrative based on these conditions:

FAULTLINE Pressure Index: ${p.overallPressure.toFixed(1)}/100
Regime: ${p.regime}
BTC Trend Strength: ${dashboard.trendStrength.label} (${dashboard.trendStrength.score.toFixed(0)}/100)
Liquidity Conditions: ${dashboard.liquidityConditions.label} (${dashboard.liquidityConditions.score.toFixed(0)}/100)
Dollar Pressure: ${dashboard.dollarPressure.label}
Yield Pressure: ${dashboard.yieldPressure.label}
ETF/Institutional Flow: ${dashboard.etfInstitutionalFlow.label}
Market Cycle Phase: ${dashboard.marketCyclePhase.phase}
Overall BTC Bias: ${dashboard.overallBtcBias}

Write 3 sentences in institutional tone. Use language like "signals may indicate," "conditions suggest," "macro data points to." Do not make price predictions. Focus on macro-crypto relationships.`;

    const res = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE, an institutional macro intelligence system. Be precise, analytical, and use responsible language. Never make price predictions." },
        { role: "user", content: prompt },
      ],
    });
    return (res.choices[0]?.message?.content as string) ?? "Macro conditions are being assessed. FAULTLINE signals may indicate evolving crypto market dynamics.";
  } catch {
    return `FAULTLINE macro indicators suggest ${dashboard.overallBtcBias.toLowerCase()} conditions for Bitcoin. ${dashboard.liquidityConditions.note} ${dashboard.trendStrength.note}`;
  }
}

async function generateCorrelationSummary(
  p: FaultlinePressureOutput,
  corr: Omit<CryptoMacroCorrelation, "correlationSummary">
): Promise<string> {
  try {
    const prompt = `You are FAULTLINE. Summarize crypto-macro correlation in 2 sentences based on:
Fed Policy: ${corr.fedPolicyImpact.signal}
Interest Rates: ${corr.interestRateImpact.signal}
Dollar: ${corr.dollarStrength.signal}
Liquidity: ${corr.liquidityCycle.signal}
Equity Risk: ${corr.equityRiskAppetite.signal}
Bond Stress: ${corr.bondMarketStress.signal}
Overall: ${corr.overallMacroSignal}
Pressure: ${p.overallPressure.toFixed(1)}/100

Use responsible language. 2 sentences max.`;

    const res = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE. Be concise and analytical." },
        { role: "user", content: prompt },
      ],
    });
    return (res.choices[0]?.message?.content as string) ?? "Crypto markets are showing macro correlation signals. FAULTLINE is tracking multiple cross-asset relationships.";
  } catch {
    return `Current macro conditions suggest ${corr.overallMacroSignal.toLowerCase()} alignment between crypto and traditional markets. Liquidity and Fed policy signals are the primary drivers to monitor.`;
  }
}

// ── Main export ───────────────────────────────────────────────

export async function getCryptoIntelligence(): Promise<CryptoIntelligenceReport> {
  const cacheKey = "crypto-intelligence";
  const cached = cryptoCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { ...cached.report, cached: true };
  }

  // Get FAULTLINE pressure data
  const pressure = await calculateFaultlinePressure();

  // Build all signal scores
  const btcData   = scoreBitcoin(pressure);
  const ethData   = scoreEthereum(pressure);
  const solData   = scoreSolana(pressure);
  const mktData   = scoreTotalMarketCap(pressure);
  const altData   = scoreAltcoinSeason(pressure);
  const stblData  = scoreStablecoinLiquidity(pressure);

  const signals: CryptoAssetSignal[] = [
    {
      id: "btc",
      name: "Bitcoin",
      ticker: "BTC",
      signal: scoreToSignal(btcData.signalScore),
      momentum: scoreToMomentum(btcData.signalScore),
      risk: scoreToRisk(btcData.riskScore),
      riskScore: Math.round(btcData.riskScore),
      signalScore: Math.round(btcData.signalScore),
      explanation: btcData.signalScore >= 60
        ? "Macro conditions may be supportive for Bitcoin. Liquidity and yield signals are key drivers."
        : btcData.signalScore >= 40
        ? "Mixed macro signals for Bitcoin. Conditions suggest monitoring rather than aggressive positioning."
        : "Macro headwinds may be creating challenging conditions for Bitcoin. Risk management signals are elevated.",
      keyDrivers: btcData.drivers,
      macroAlignment: btcData.signalScore >= 60 ? "Aligned" : btcData.signalScore >= 40 ? "Neutral" : "Diverging",
    },
    {
      id: "eth",
      name: "Ethereum",
      ticker: "ETH",
      signal: scoreToSignal(ethData.signalScore),
      momentum: scoreToMomentum(ethData.signalScore),
      risk: scoreToRisk(ethData.riskScore),
      riskScore: Math.round(ethData.riskScore),
      signalScore: Math.round(ethData.signalScore),
      explanation: ethData.signalScore >= 60
        ? "ETH macro alignment signals may be favorable. Network conditions and liquidity are supportive factors."
        : ethData.signalScore >= 40
        ? "ETH is showing mixed macro signals. Tech-sector correlation adds additional sensitivity."
        : "ETH macro conditions suggest caution. Elevated sensitivity to equity stress and liquidity conditions.",
      keyDrivers: ethData.drivers,
      macroAlignment: ethData.signalScore >= 60 ? "Aligned" : ethData.signalScore >= 40 ? "Neutral" : "Diverging",
    },
    {
      id: "sol",
      name: "Solana",
      ticker: "SOL",
      signal: scoreToSignal(solData.signalScore),
      momentum: scoreToMomentum(solData.signalScore),
      risk: scoreToRisk(solData.riskScore),
      riskScore: Math.round(solData.riskScore),
      signalScore: Math.round(solData.signalScore),
      explanation: solData.signalScore >= 60
        ? "SOL conditions may be favorable — higher-beta asset that amplifies macro tailwinds."
        : solData.signalScore >= 40
        ? "SOL is showing mixed signals. As a higher-beta asset, macro conditions have amplified impact."
        : "SOL macro conditions suggest elevated risk. Higher-beta assets typically amplify macro headwinds.",
      keyDrivers: solData.drivers,
      macroAlignment: solData.signalScore >= 60 ? "Aligned" : solData.signalScore >= 40 ? "Neutral" : "Diverging",
    },
    {
      id: "total-mcap",
      name: "Total Crypto Market Cap",
      ticker: "TOTAL",
      signal: scoreToSignal(mktData.signalScore),
      momentum: scoreToMomentum(mktData.signalScore),
      risk: scoreToRisk(mktData.riskScore),
      riskScore: Math.round(mktData.riskScore),
      signalScore: Math.round(mktData.signalScore),
      explanation: mktData.signalScore >= 60
        ? "Total market cap conditions may support broad crypto participation. Macro alignment is positive."
        : mktData.signalScore >= 40
        ? "Total market cap signals are mixed. Macro conditions suggest selective rather than broad exposure."
        : "Total market cap macro conditions suggest caution. Broad crypto exposure may carry elevated risk.",
      keyDrivers: mktData.drivers,
      macroAlignment: mktData.signalScore >= 60 ? "Aligned" : mktData.signalScore >= 40 ? "Neutral" : "Diverging",
    },
    {
      id: "altcoin-season",
      name: "Altcoin Season Index",
      ticker: "ALT",
      signal: scoreToSignal(altData.signalScore),
      momentum: scoreToMomentum(altData.signalScore),
      risk: scoreToRisk(altData.riskScore),
      riskScore: Math.round(altData.riskScore),
      signalScore: Math.round(altData.signalScore),
      explanation: altData.signalScore >= 65
        ? "Conditions may be developing that historically precede altcoin season. Liquidity and macro signals are supportive."
        : altData.signalScore >= 45
        ? "Altcoin season conditions are mixed. Selective exposure with active risk management may be appropriate."
        : "Current macro conditions suggest altcoin season probability is low. Risk management signals are elevated.",
      keyDrivers: altData.drivers,
      macroAlignment: altData.signalScore >= 60 ? "Aligned" : altData.signalScore >= 40 ? "Neutral" : "Diverging",
    },
    {
      id: "stablecoin-liquidity",
      name: "Stablecoin Liquidity",
      ticker: "STABLE",
      signal: scoreToSignal(stblData.signalScore),
      momentum: scoreToMomentum(stblData.signalScore),
      risk: scoreToRisk(stblData.riskScore),
      riskScore: Math.round(stblData.riskScore),
      signalScore: Math.round(stblData.signalScore),
      explanation: stblData.signalScore >= 60
        ? "Stablecoin liquidity conditions suggest dry powder may be available. This is historically a leading indicator for crypto markets."
        : stblData.signalScore >= 40
        ? "Stablecoin liquidity signals are mixed. Monitoring supply conditions may provide early warning signals."
        : "Stablecoin supply contraction signals may indicate reduced buying pressure for crypto markets.",
      keyDrivers: stblData.drivers,
      macroAlignment: stblData.signalScore >= 60 ? "Aligned" : stblData.signalScore >= 40 ? "Neutral" : "Diverging",
    },
  ];

  // Build BTC dashboard
  const btcDashboardPartial = buildBtcDashboard(pressure);
  const btcNarrative = await generateBtcNarrative(pressure, btcDashboardPartial);
  const btcDashboard: BitcoinMacroDashboard = { ...btcDashboardPartial, aiNarrative: btcNarrative };

  // Build altcoin risk
  const altcoinRisk = buildAltcoinRisk(pressure);

  // Build macro correlation
  const corrPartial = buildMacroCorrelation(pressure);
  const corrSummary = await generateCorrelationSummary(pressure, corrPartial);
  const macroCorrelation: CryptoMacroCorrelation = { ...corrPartial, correlationSummary: corrSummary };

  // Build portfolio guidance
  const portfolioGuidance = buildPortfolioGuidance(pressure);

  const report: CryptoIntelligenceReport = {
    generatedAt: Date.now(),
    pressureIndex: pressure.overallPressure,
    regime: pressure.regime,
    signals,
    btcDashboard,
    altcoinRisk,
    macroCorrelation,
    portfolioGuidance,
    cached: false,
  };

  cryptoCache.set(cacheKey, { report, fetchedAt: Date.now() });
  return report;
}
