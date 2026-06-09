/* ============================================================
   FAULTLINE — Pre-Flight Market Awareness Engine
   ============================================================
   Purpose: Answer "Do I fully understand current market conditions
   before risking capital?" — NOT a trade simulator.

   This module computes:
   - Awareness Score (0–100)
   - Pressure Index + Regime
   - Bull vs Bear Probability
   - Threat Board (top risks)
   - Key Risk Alerts
   - Macro Drivers
   - Credit Conditions
   - Liquidity Conditions
   - AI Bubble Risk
   - Recession Risk
   - Daily Intelligence Brief (LLM-generated)
   - Missing Awareness Checks
   ============================================================ */

import { calculateFaultlinePressure, type FaultlinePressureOutput, type RiskVector } from "./pressure/engine";
import { invokeLLM } from "./_core/llm";

// ── Types ─────────────────────────────────────────────────────

export type AwarenessLevel = "FULLY AWARE" | "AWARE" | "PARTIAL AWARENESS" | "LOW AWARENESS" | "BLIND SPOT";

export type ConditionLevel = "Clear" | "Stable" | "Caution" | "Stressed" | "Critical";

export interface MacroDriver {
  name: string;
  value: string;
  direction: "bullish" | "neutral" | "bearish";
  impact: string;
  detail: string;
}

export interface RiskAlert {
  id: string;
  title: string;
  severity: "low" | "moderate" | "elevated" | "high" | "critical";
  category: "macro" | "credit" | "liquidity" | "volatility" | "ai" | "recession" | "breadth" | "fed";
  summary: string;
  detail: string;
  actionImplication: string;
}

export interface ConditionPanel {
  label: string;
  level: ConditionLevel;
  score: number;        // 0–100 (higher = more stress)
  summary: string;
  detail: string;
  indicators: { name: string; value: string; status: "green" | "yellow" | "red" }[];
}

export interface AwarenessCheck {
  id: string;
  question: string;
  status: "pass" | "warn" | "fail";
  explanation: string;
}

export interface ThreatItem {
  rank: number;
  title: string;
  severity: "low" | "moderate" | "elevated" | "high" | "critical";
  category: string;
  summary: string;
  hiddenPressure?: string;
}

export interface PreFlightOutput {
  // Core scores
  awarenessScore: number;          // 0–100
  awarenessLevel: AwarenessLevel;
  pressureIndex: number;           // 0–100
  regime: string;
  regimeLevel: string;
  marketStatus: "Cleared" | "Caution" | "Defensive";

  // Probabilities
  bullProbability: number;         // 0–100
  bearProbability: number;         // 0–100
  recessionProbability: number;    // 0–100
  crashProbability: number;        // 0–100

  // Condition panels
  creditCondition: ConditionPanel;
  liquidityCondition: ConditionPanel;
  aiBubbleRisk: ConditionPanel;
  recessionRisk: ConditionPanel;
  volatilityCondition: ConditionPanel;
  macroCondition: ConditionPanel;

  // Macro drivers
  macroDrivers: MacroDriver[];

  // Threat board
  threatBoard: ThreatItem[];

  // Key risk alerts
  keyRisks: RiskAlert[];

  // Awareness checks
  awarenessChecks: AwarenessCheck[];

  // Daily Intelligence Brief
  dailyBrief: string;

  // Metadata
  dataSource: "live" | "fallback";
  timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getVectorScore(vectors: RiskVector[], id: string): number {
  return vectors.find(v => v.id === id)?.score ?? 50;
}

function scoreToConditionLevel(score: number): ConditionLevel {
  if (score >= 80) return "Critical";
  if (score >= 60) return "Stressed";
  if (score >= 40) return "Caution";
  if (score >= 20) return "Stable";
  return "Clear";
}

function computeMarketStatus(pressure: FaultlinePressureOutput): "Cleared" | "Caution" | "Defensive" {
  if (pressure.overallPressure >= 55) return "Defensive";
  if (pressure.overallPressure >= 30) return "Caution";
  return "Cleared";
}

function computeAwarenessScore(pressure: FaultlinePressureOutput): number {
  // Awareness score is inverse of how many hidden risks are present.
  // High pressure + many elevated vectors = lower awareness (more unknowns).
  // The score represents how "clear" the picture is, not how safe the market is.
  const elevatedVectors = pressure.vectors.filter(v => v.score >= 50).length;
  const totalVectors = pressure.vectors.length;
  const hiddenRatio = elevatedVectors / Math.max(totalVectors, 1);

  // Base: start at 100, deduct for hidden risks
  let score = 100;
  score -= Math.round(hiddenRatio * 35);                        // up to -35 for many elevated vectors
  score -= Math.round(pressure.overallPressure * 0.25);         // up to -25 for high pressure
  if (pressure.alerts.length >= 5) score -= 15;
  else if (pressure.alerts.length >= 3) score -= 8;
  else if (pressure.alerts.length >= 1) score -= 3;

  return clamp(Math.round(score), 10, 98);
}

function getAwarenessLevel(score: number): AwarenessLevel {
  if (score >= 85) return "FULLY AWARE";
  if (score >= 70) return "AWARE";
  if (score >= 50) return "PARTIAL AWARENESS";
  if (score >= 30) return "LOW AWARENESS";
  return "BLIND SPOT";
}

function buildCreditCondition(vectors: RiskVector[], pressure: FaultlinePressureOutput): ConditionPanel {
  const creditScore = getVectorScore(vectors, "credit-stress");
  const level = scoreToConditionLevel(creditScore);

  const spreadLabel = creditScore >= 70 ? "Widening rapidly" : creditScore >= 45 ? "Moderately elevated" : "Contained";
  const defaultLabel = creditScore >= 70 ? "Rising" : creditScore >= 45 ? "Stable with pockets" : "Low";
  const leverageLabel = creditScore >= 60 ? "Elevated" : creditScore >= 35 ? "Moderate" : "Low";

  return {
    label: "Credit Conditions",
    level,
    score: creditScore,
    summary: creditScore >= 60
      ? "Credit stress elevated — spreads widening and default risk rising."
      : creditScore >= 35
      ? "Credit conditions moderately stressed — monitor spread trends."
      : "Credit markets stable — spreads contained and default risk low.",
    detail: `High-yield spreads ${spreadLabel.toLowerCase()}. Corporate default risk ${defaultLabel.toLowerCase()}. Leverage levels ${leverageLabel.toLowerCase()}. ${
      creditScore >= 60
        ? "Elevated credit stress historically precedes equity drawdowns by 2–6 weeks."
        : creditScore >= 35
        ? "Moderate stress warrants monitoring. Watch for spread acceleration."
        : "Favorable credit backdrop supports risk assets."
    }`,
    indicators: [
      { name: "HY Spread", value: creditScore >= 70 ? "475+ bps" : creditScore >= 45 ? "275–475 bps" : "< 275 bps", status: creditScore >= 70 ? "red" : creditScore >= 45 ? "yellow" : "green" },
      { name: "Default Risk", value: defaultLabel, status: creditScore >= 60 ? "red" : creditScore >= 35 ? "yellow" : "green" },
      { name: "Leverage", value: leverageLabel, status: creditScore >= 60 ? "red" : creditScore >= 35 ? "yellow" : "green" },
      { name: "IG Spread", value: creditScore >= 70 ? "Elevated" : creditScore >= 45 ? "Moderate" : "Tight", status: creditScore >= 70 ? "red" : creditScore >= 45 ? "yellow" : "green" },
    ],
  };
}

function buildLiquidityCondition(vectors: RiskVector[], pressure: FaultlinePressureOutput): ConditionPanel {
  const liquidityScore = getVectorScore(vectors, "liquidity-risk");
  const level = scoreToConditionLevel(liquidityScore);

  return {
    label: "Liquidity Conditions",
    level,
    score: liquidityScore,
    summary: liquidityScore >= 60
      ? "Liquidity tightening — market depth reduced and bid-ask spreads widening."
      : liquidityScore >= 35
      ? "Liquidity adequate but showing stress in pockets."
      : "Ample liquidity — market depth healthy and spreads tight.",
    detail: `${
      liquidityScore >= 60
        ? "Fed balance sheet reduction and elevated rates are compressing market liquidity. Thin order books increase slippage risk. Position sizing should account for reduced exit capacity."
        : liquidityScore >= 35
        ? "Liquidity adequate at index level but thinner in small/mid-cap and high-yield. Monitor for sudden drying up during risk-off events."
        : "Strong liquidity conditions. Fed accommodation or neutral stance supporting market depth. Low slippage risk for most position sizes."
    }`,
    indicators: [
      { name: "Market Depth", value: liquidityScore >= 60 ? "Thin" : liquidityScore >= 35 ? "Moderate" : "Deep", status: liquidityScore >= 60 ? "red" : liquidityScore >= 35 ? "yellow" : "green" },
      { name: "Bid-Ask Spreads", value: liquidityScore >= 60 ? "Wide" : liquidityScore >= 35 ? "Normal" : "Tight", status: liquidityScore >= 60 ? "red" : liquidityScore >= 35 ? "yellow" : "green" },
      { name: "Fed Stance", value: liquidityScore >= 60 ? "Restrictive" : liquidityScore >= 35 ? "Neutral" : "Accommodative", status: liquidityScore >= 60 ? "red" : liquidityScore >= 35 ? "yellow" : "green" },
      { name: "Repo Market", value: liquidityScore >= 60 ? "Stressed" : "Normal", status: liquidityScore >= 60 ? "red" : "green" },
    ],
  };
}

function buildAIBubbleRisk(vectors: RiskVector[], pressure: FaultlinePressureOutput): ConditionPanel {
  const aiScore = getVectorScore(vectors, "ai-speculation");
  const level = scoreToConditionLevel(aiScore);

  return {
    label: "AI Bubble Risk",
    level,
    score: aiScore,
    summary: aiScore >= 65
      ? "AI concentration risk elevated — narrow leadership masking broad weakness."
      : aiScore >= 40
      ? "AI theme valuations stretched but not yet at bubble extremes."
      : "AI theme valuations reasonable — concentration risk contained.",
    detail: `${
      aiScore >= 65
        ? "Top AI/tech names represent an outsized share of index returns. Valuation multiples at historical extremes. A rotation or earnings miss in key names could trigger broad market repricing. Avoid adding concentrated AI exposure at current levels."
        : aiScore >= 40
        ? "AI valuations elevated relative to earnings growth expectations. Concentration risk building but not yet at bubble levels. Monitor earnings revisions and capital expenditure guidance from key AI infrastructure names."
        : "AI sector valuations within historical norms. Earnings growth supporting current multiples. Concentration risk manageable."
    }`,
    indicators: [
      { name: "AI Concentration", value: aiScore >= 65 ? "Extreme" : aiScore >= 40 ? "Elevated" : "Normal", status: aiScore >= 65 ? "red" : aiScore >= 40 ? "yellow" : "green" },
      { name: "Valuation Multiple", value: aiScore >= 65 ? "Extreme" : aiScore >= 40 ? "Stretched" : "Fair", status: aiScore >= 65 ? "red" : aiScore >= 40 ? "yellow" : "green" },
      { name: "Earnings Support", value: aiScore >= 65 ? "Weak" : aiScore >= 40 ? "Mixed" : "Strong", status: aiScore >= 65 ? "red" : aiScore >= 40 ? "yellow" : "green" },
      { name: "Rotation Risk", value: aiScore >= 55 ? "High" : aiScore >= 35 ? "Moderate" : "Low", status: aiScore >= 55 ? "red" : aiScore >= 35 ? "yellow" : "green" },
    ],
  };
}

function buildRecessionRisk(vectors: RiskVector[], pressure: FaultlinePressureOutput): ConditionPanel {
  const creditScore = getVectorScore(vectors, "credit-stress");
  const breadthScore = getVectorScore(vectors, "market-breadth");
  const recessionScore = clamp(Math.round(creditScore * 0.35 + breadthScore * 0.35 + pressure.overallPressure * 0.30), 0, 100);
  const level = scoreToConditionLevel(recessionScore);

  const recessionProb = clamp(Math.round(recessionScore * 0.6), 5, 70);

  return {
    label: "Recession Risk",
    level,
    score: recessionScore,
    summary: recessionScore >= 60
      ? `Recession probability elevated (~${recessionProb}%) — leading indicators deteriorating.`
      : recessionScore >= 35
      ? `Recession risk moderate (~${recessionProb}%) — watch leading indicators closely.`
      : `Recession risk low (~${recessionProb}%) — economic expansion intact.`,
    detail: `${
      recessionScore >= 60
        ? "Yield curve inversion, credit tightening, and deteriorating breadth are classic pre-recession signals. Corporate earnings guidance turning cautious. Consumer spending showing stress at the margin. Defensive positioning warranted."
        : recessionScore >= 35
        ? "Mixed signals — some leading indicators softening while others remain resilient. Labor market still healthy but showing early cracks. Monitor PMI, jobless claims, and consumer confidence for confirmation."
        : "Economic fundamentals solid. Labor market strong, consumer spending healthy, corporate earnings growing. Recession within 12 months unlikely at current trajectory."
    }`,
    indicators: [
      { name: "Yield Curve", value: recessionScore >= 60 ? "Inverted" : recessionScore >= 35 ? "Flattening" : "Normal", status: recessionScore >= 60 ? "red" : recessionScore >= 35 ? "yellow" : "green" },
      { name: "Leading Indicators", value: recessionScore >= 60 ? "Declining" : recessionScore >= 35 ? "Mixed" : "Positive", status: recessionScore >= 60 ? "red" : recessionScore >= 35 ? "yellow" : "green" },
      { name: "Labor Market", value: recessionScore >= 60 ? "Softening" : "Resilient", status: recessionScore >= 60 ? "red" : "green" },
      { name: "12-Month Probability", value: `~${recessionProb}%`, status: recessionProb >= 40 ? "red" : recessionProb >= 20 ? "yellow" : "green" },
    ],
  };
}

function buildVolatilityCondition(vectors: RiskVector[], pressure: FaultlinePressureOutput): ConditionPanel {
  const volScore = getVectorScore(vectors, "volatility-regime");
  const level = scoreToConditionLevel(volScore);

  return {
    label: "Volatility Regime",
    level,
    score: volScore,
    summary: volScore >= 65
      ? "Elevated volatility regime — VIX elevated, tail risk premium high."
      : volScore >= 40
      ? "Moderate volatility — normal market fluctuations with occasional spikes."
      : "Low volatility regime — complacency risk building.",
    detail: `${
      volScore >= 65
        ? "VIX elevated above 25 signals institutional hedging demand. Options skew pricing in tail risk. Elevated volatility compresses risk-adjusted returns and widens bid-ask spreads. Consider reducing position sizes and adding defined-risk structures."
        : volScore >= 40
        ? "Volatility within normal ranges. VIX 15–25 zone. Standard position sizing appropriate. Monitor for volatility spikes around macro events (Fed, CPI, earnings)."
        : "Low VIX environment (< 15). Complacency risk building — markets historically vulnerable to sharp reversals from low-vol regimes. Maintain hedges even when markets feel calm."
    }`,
    indicators: [
      { name: "VIX Level", value: volScore >= 65 ? "> 25" : volScore >= 40 ? "15–25" : "< 15", status: volScore >= 65 ? "red" : volScore >= 40 ? "yellow" : "green" },
      { name: "Options Skew", value: volScore >= 65 ? "Elevated" : volScore >= 40 ? "Normal" : "Low", status: volScore >= 65 ? "red" : volScore >= 40 ? "yellow" : "green" },
      { name: "Realized Vol", value: volScore >= 65 ? "High" : volScore >= 40 ? "Moderate" : "Low", status: volScore >= 65 ? "red" : volScore >= 40 ? "yellow" : "green" },
      { name: "Complacency Risk", value: volScore < 20 ? "High" : volScore < 35 ? "Moderate" : "Low", status: volScore < 20 ? "red" : volScore < 35 ? "yellow" : "green" },
    ],
  };
}

function buildMacroCondition(vectors: RiskVector[], pressure: FaultlinePressureOutput): ConditionPanel {
  const fedScore = getVectorScore(vectors, "fed-policy");
  const debtScore = getVectorScore(vectors, "debt-fiscal");
  const macroScore = clamp(Math.round(fedScore * 0.5 + debtScore * 0.5), 0, 100);
  const level = scoreToConditionLevel(macroScore);

  return {
    label: "Macro Environment",
    level,
    score: macroScore,
    summary: macroScore >= 60
      ? "Macro headwinds elevated — restrictive policy and fiscal stress weighing on growth."
      : macroScore >= 35
      ? "Macro environment mixed — policy uncertainty creating cross-currents."
      : "Macro tailwinds supportive — policy accommodative and fiscal backdrop stable.",
    detail: `Fed policy ${fedScore >= 60 ? "restrictive" : fedScore >= 35 ? "neutral" : "accommodative"} with ${
      fedScore >= 60 ? "rates at restrictive levels suppressing growth and valuations" : fedScore >= 35 ? "rates near neutral — watching inflation and employment data" : "rate cuts supporting risk assets and economic expansion"
    }. Fiscal backdrop ${debtScore >= 60 ? "stressed — deficit spending elevated and debt service rising" : debtScore >= 35 ? "manageable but trending toward stress" : "stable with controlled deficit trajectory"}.`,
    indicators: [
      { name: "Fed Policy", value: fedScore >= 60 ? "Restrictive" : fedScore >= 35 ? "Neutral" : "Accommodative", status: fedScore >= 60 ? "red" : fedScore >= 35 ? "yellow" : "green" },
      { name: "Inflation Trend", value: fedScore >= 60 ? "Elevated" : fedScore >= 35 ? "Moderating" : "Contained", status: fedScore >= 60 ? "red" : fedScore >= 35 ? "yellow" : "green" },
      { name: "Fiscal Deficit", value: debtScore >= 60 ? "Elevated" : debtScore >= 35 ? "Moderate" : "Controlled", status: debtScore >= 60 ? "red" : debtScore >= 35 ? "yellow" : "green" },
      { name: "Growth Trajectory", value: macroScore >= 60 ? "Slowing" : macroScore >= 35 ? "Stable" : "Expanding", status: macroScore >= 60 ? "red" : macroScore >= 35 ? "yellow" : "green" },
    ],
  };
}

function buildMacroDrivers(vectors: RiskVector[], pressure: FaultlinePressureOutput): MacroDriver[] {
  const fedScore = getVectorScore(vectors, "fed-policy");
  const creditScore = getVectorScore(vectors, "credit-stress");
  const volScore = getVectorScore(vectors, "volatility-regime");
  const aiScore = getVectorScore(vectors, "ai-speculation");
  const debtScore = getVectorScore(vectors, "debt-fiscal");
  const breadthScore = getVectorScore(vectors, "market-breadth");

  return [
    {
      name: "Federal Reserve Policy",
      value: fedScore >= 65 ? "Restrictive" : fedScore >= 35 ? "Neutral" : "Accommodative",
      direction: fedScore >= 55 ? "bearish" : fedScore >= 35 ? "neutral" : "bullish",
      impact: fedScore >= 55 ? "Negative" : fedScore >= 35 ? "Neutral" : "Positive",
      detail: fedScore >= 65
        ? "Rates at restrictive levels. Fed signaling higher-for-longer. Equity valuations compressed by elevated discount rates."
        : fedScore >= 35
        ? "Fed in data-dependent mode. Rate path uncertain. Markets pricing 1–2 cuts in next 12 months."
        : "Accommodative stance supporting risk assets. Rate cuts reducing discount rates and boosting valuations.",
    },
    {
      name: "Credit & Spread Environment",
      value: creditScore >= 65 ? "Stressed" : creditScore >= 35 ? "Moderate" : "Benign",
      direction: creditScore >= 55 ? "bearish" : creditScore >= 35 ? "neutral" : "bullish",
      impact: creditScore >= 55 ? "Negative" : creditScore >= 35 ? "Neutral" : "Positive",
      detail: creditScore >= 65
        ? "HY spreads widening aggressively. Credit tightening historically leads equity drawdowns by 4–8 weeks."
        : creditScore >= 35
        ? "Spreads moderately elevated. Credit conditions tightening at the margin but not yet signaling systemic stress."
        : "Spreads tight. Credit markets confirming equity rally. Low default expectations.",
    },
    {
      name: "Market Breadth",
      value: breadthScore >= 65 ? "Deteriorating" : breadthScore >= 35 ? "Narrowing" : "Broad",
      direction: breadthScore >= 55 ? "bearish" : breadthScore >= 35 ? "neutral" : "bullish",
      impact: breadthScore >= 55 ? "Negative" : breadthScore >= 35 ? "Neutral" : "Positive",
      detail: breadthScore >= 65
        ? "Rally narrowing to fewer names. Index gains masking broad underlying weakness. High risk of sharp reversal."
        : breadthScore >= 35
        ? "Breadth narrowing but not yet alarming. Watch for advance-decline divergence from index."
        : "Broad participation. Most sectors and stocks advancing. Healthy bull market structure.",
    },
    {
      name: "AI / Tech Concentration",
      value: aiScore >= 65 ? "Extreme" : aiScore >= 40 ? "Elevated" : "Normal",
      direction: aiScore >= 60 ? "bearish" : aiScore >= 40 ? "neutral" : "bullish",
      impact: aiScore >= 60 ? "Risk Factor" : aiScore >= 40 ? "Watch" : "Neutral",
      detail: aiScore >= 65
        ? "Top AI names at extreme concentration. Single-stock risk elevated. Any earnings miss or capex concern could trigger broad selloff."
        : aiScore >= 40
        ? "AI theme driving outsized returns. Concentration building. Diversification away from mega-cap tech prudent."
        : "AI theme valuations reasonable. Concentration risk contained. Broad market participation.",
    },
    {
      name: "Volatility Regime",
      value: volScore >= 65 ? "Elevated" : volScore >= 40 ? "Moderate" : "Suppressed",
      direction: volScore >= 55 ? "bearish" : volScore < 20 ? "neutral" : "bullish",
      impact: volScore >= 55 ? "Negative" : volScore < 20 ? "Complacency Risk" : "Positive",
      detail: volScore >= 65
        ? "VIX elevated. Institutional hedging demand high. Risk-adjusted returns compressed. Reduce position sizes."
        : volScore >= 40
        ? "Normal volatility. Standard risk management applies. Watch for vol spikes around macro events."
        : "Low VIX. Complacency risk. Markets historically vulnerable to sharp reversals from suppressed volatility.",
    },
    {
      name: "Fiscal & Debt Backdrop",
      value: debtScore >= 65 ? "Stressed" : debtScore >= 35 ? "Elevated" : "Stable",
      direction: debtScore >= 60 ? "bearish" : debtScore >= 35 ? "neutral" : "bullish",
      impact: debtScore >= 60 ? "Long-term Headwind" : debtScore >= 35 ? "Watch" : "Neutral",
      detail: debtScore >= 65
        ? "Deficit spending elevated. Debt service rising as rates stay high. Treasury supply increasing. Long-term rates under upward pressure."
        : debtScore >= 35
        ? "Fiscal situation manageable but deteriorating. Watch for Treasury auction demand and long-end rate pressure."
        : "Fiscal backdrop stable. Deficit trajectory controlled. No near-term debt market stress.",
    },
  ];
}

function buildThreatBoard(vectors: RiskVector[], pressure: FaultlinePressureOutput): ThreatItem[] {
  const threats: ThreatItem[] = [];

  // Map pressure alerts to threat items
  for (const alert of pressure.alerts) {
    threats.push({
      rank: threats.length + 1,
      title: alert.title,
      severity: alert.severity,
      category: "macro",
      summary: alert.detail,
    });
  }

  // Add vector-derived threats for any elevated vectors not already covered
  for (const vector of vectors) {
    if (vector.score >= 55 && threats.length < 8) {
      const alreadyCovered = threats.some(t => t.title.toLowerCase().includes(vector.label.toLowerCase()));
      if (!alreadyCovered) {
        threats.push({
          rank: threats.length + 1,
          title: vector.label,
          severity: vector.score >= 75 ? "high" : vector.score >= 55 ? "elevated" : "moderate",
          category: vector.id.split("-")[0],
          summary: vector.description ?? `${vector.label} at elevated levels — score ${vector.score}/100.`,
        });
      }
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, elevated: 2, moderate: 3, low: 4 };
  threats.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Re-rank
  return threats.slice(0, 8).map((t, i) => ({ ...t, rank: i + 1 }));
}

function buildKeyRisks(vectors: RiskVector[], pressure: FaultlinePressureOutput): RiskAlert[] {
  const risks: RiskAlert[] = [];

  const creditScore = getVectorScore(vectors, "credit-stress");
  const liquidityScore = getVectorScore(vectors, "liquidity-risk");
  const aiScore = getVectorScore(vectors, "ai-speculation");
  const volScore = getVectorScore(vectors, "volatility-regime");
  const fedScore = getVectorScore(vectors, "fed-policy");
  const breadthScore = getVectorScore(vectors, "market-breadth");
  const debtScore = getVectorScore(vectors, "debt-fiscal");

  if (creditScore >= 45) {
    risks.push({
      id: "credit-stress",
      title: "Credit Market Stress",
      severity: creditScore >= 70 ? "high" : creditScore >= 55 ? "elevated" : "moderate",
      category: "credit",
      summary: `HY spreads ${creditScore >= 70 ? "aggressively widening" : "moderately elevated"}.`,
      detail: `Credit stress at ${creditScore}/100. High-yield spreads widening signals deteriorating corporate fundamentals and reduced risk appetite. Historically precedes equity drawdowns.`,
      actionImplication: creditScore >= 70 ? "Reduce high-yield and leveraged equity exposure immediately." : "Monitor spread trajectory. Avoid adding credit-sensitive positions.",
    });
  }

  if (liquidityScore >= 40) {
    risks.push({
      id: "liquidity-risk",
      title: "Liquidity Tightening",
      severity: liquidityScore >= 65 ? "elevated" : "moderate",
      category: "liquidity",
      summary: `Market liquidity ${liquidityScore >= 65 ? "significantly reduced" : "showing stress"}.`,
      detail: `Liquidity risk at ${liquidityScore}/100. Reduced market depth increases slippage and exit risk. Position sizing should account for reduced capacity to exit quickly.`,
      actionImplication: liquidityScore >= 65 ? "Reduce position sizes. Avoid illiquid instruments." : "Factor in wider spreads when sizing positions.",
    });
  }

  if (aiScore >= 50) {
    risks.push({
      id: "ai-concentration",
      title: "AI Concentration Risk",
      severity: aiScore >= 70 ? "elevated" : "moderate",
      category: "ai",
      summary: `AI/tech concentration ${aiScore >= 70 ? "at extreme levels" : "building"}.`,
      detail: `AI speculation score at ${aiScore}/100. Narrow leadership in AI/tech names creates fragility. Index performance dependent on few names sustaining elevated multiples.`,
      actionImplication: aiScore >= 70 ? "Avoid adding AI/tech concentration. Diversify across sectors." : "Monitor AI earnings guidance. Reduce concentration if multiples expand further.",
    });
  }

  if (volScore >= 50) {
    risks.push({
      id: "volatility-regime",
      title: "Elevated Volatility Regime",
      severity: volScore >= 70 ? "elevated" : "moderate",
      category: "volatility",
      summary: `VIX elevated — institutional hedging demand ${volScore >= 70 ? "high" : "moderate"}.`,
      detail: `Volatility score at ${volScore}/100. Elevated VIX compresses risk-adjusted returns and signals institutional uncertainty. Tail risk premium elevated.`,
      actionImplication: "Reduce position sizes. Consider defined-risk structures (spreads, collars) over naked long exposure.",
    });
  }

  if (fedScore >= 50) {
    risks.push({
      id: "fed-policy",
      title: "Restrictive Fed Policy",
      severity: fedScore >= 70 ? "elevated" : "moderate",
      category: "fed",
      summary: `Fed maintaining ${fedScore >= 70 ? "highly restrictive" : "restrictive"} stance.`,
      detail: `Fed policy pressure at ${fedScore}/100. Elevated rates compress equity valuations via higher discount rates and increase debt service costs for leveraged companies.`,
      actionImplication: "Favor quality over growth. Avoid highly leveraged companies. Duration risk elevated in long-duration assets.",
    });
  }

  if (breadthScore >= 55) {
    risks.push({
      id: "breadth-deterioration",
      title: "Market Breadth Deteriorating",
      severity: breadthScore >= 70 ? "elevated" : "moderate",
      category: "breadth",
      summary: `Rally narrowing — fewer stocks ${breadthScore >= 70 ? "driving gains" : "participating"}.`,
      detail: `Breadth score at ${breadthScore}/100. Narrow market leadership is a classic late-cycle warning. When breadth deteriorates, index-level gains mask broad underlying weakness.`,
      actionImplication: "Avoid chasing index highs. Focus on stocks with strong individual breadth. Watch for advance-decline line divergence.",
    });
  }

  if (pressure.overallPressure >= 55) {
    risks.push({
      id: "systemic-pressure",
      title: "Elevated Systemic Pressure",
      severity: pressure.overallPressure >= 70 ? "high" : "elevated",
      category: "macro",
      summary: `Overall market pressure at ${pressure.overallPressure}/100 — ${pressure.regime}.`,
      detail: `Multiple risk vectors elevated simultaneously. Systemic pressure at this level historically associated with increased drawdown risk and reduced recovery time.`,
      actionImplication: "Defensive positioning warranted. Raise cash allocation. Prioritize capital preservation.",
    });
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, elevated: 2, moderate: 3, low: 4 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return risks.slice(0, 6);
}

function buildAwarenessChecks(vectors: RiskVector[], pressure: FaultlinePressureOutput): AwarenessCheck[] {
  const creditScore = getVectorScore(vectors, "credit-stress");
  const liquidityScore = getVectorScore(vectors, "liquidity-risk");
  const aiScore = getVectorScore(vectors, "ai-speculation");
  const volScore = getVectorScore(vectors, "volatility-regime");
  const fedScore = getVectorScore(vectors, "fed-policy");
  const breadthScore = getVectorScore(vectors, "market-breadth");

  return [
    {
      id: "regime-check",
      question: "Do you know the current market regime?",
      status: "pass",
      explanation: `Current regime: ${pressure.regime} (${pressure.level}). Pressure index: ${pressure.overallPressure}/100.`,
    },
    {
      id: "credit-check",
      question: "Are you aware of current credit conditions?",
      status: creditScore >= 60 ? "fail" : creditScore >= 35 ? "warn" : "pass",
      explanation: creditScore >= 60
        ? `Credit stress elevated at ${creditScore}/100. HY spreads widening — this is a key risk you must factor into position sizing.`
        : creditScore >= 35
        ? `Credit conditions moderately stressed at ${creditScore}/100. Monitor spread trends before adding risk.`
        : `Credit conditions benign at ${creditScore}/100. No immediate credit risk to factor in.`,
    },
    {
      id: "liquidity-check",
      question: "Have you assessed current liquidity conditions?",
      status: liquidityScore >= 55 ? "warn" : "pass",
      explanation: liquidityScore >= 55
        ? `Liquidity tighter than normal at ${liquidityScore}/100. Factor in wider spreads and reduced exit capacity.`
        : `Liquidity adequate at ${liquidityScore}/100. Normal position sizing appropriate.`,
    },
    {
      id: "breadth-check",
      question: "Is market breadth confirming the trend?",
      status: breadthScore >= 65 ? "fail" : breadthScore >= 45 ? "warn" : "pass",
      explanation: breadthScore >= 65
        ? `Breadth deteriorating at ${breadthScore}/100. Index gains masking broad weakness — high reversal risk.`
        : breadthScore >= 45
        ? `Breadth narrowing at ${breadthScore}/100. Rally becoming less broad — watch for divergence.`
        : `Breadth healthy at ${breadthScore}/100. Wide participation confirming the trend.`,
    },
    {
      id: "volatility-check",
      question: "Are you positioned for the current volatility regime?",
      status: volScore >= 60 ? "warn" : volScore < 20 ? "warn" : "pass",
      explanation: volScore >= 60
        ? `Elevated volatility at ${volScore}/100. Reduce position sizes and consider defined-risk structures.`
        : volScore < 20
        ? `Very low VIX — complacency risk. Markets historically vulnerable to sharp reversals from suppressed volatility.`
        : `Volatility normal at ${volScore}/100. Standard position sizing appropriate.`,
    },
    {
      id: "fed-check",
      question: "Do you understand the Fed's current policy stance?",
      status: fedScore >= 60 ? "warn" : "pass",
      explanation: fedScore >= 60
        ? `Fed policy restrictive at ${fedScore}/100. Higher-for-longer rates compress valuations and increase debt service costs.`
        : `Fed policy at ${fedScore}/100. Neutral to accommodative stance. Rate path uncertainty manageable.`,
    },
    {
      id: "ai-check",
      question: "Are you aware of AI/tech concentration risk?",
      status: aiScore >= 65 ? "fail" : aiScore >= 45 ? "warn" : "pass",
      explanation: aiScore >= 65
        ? `AI concentration extreme at ${aiScore}/100. Index highly dependent on few names. Diversification critical.`
        : aiScore >= 45
        ? `AI concentration elevated at ${aiScore}/100. Monitor for earnings misses in key AI names.`
        : `AI concentration normal at ${aiScore}/100. No immediate concentration risk.`,
    },
    {
      id: "thesis-check",
      question: "Have you identified what could invalidate your thesis?",
      status: pressure.overallPressure >= 55 ? "warn" : "pass",
      explanation: pressure.overallPressure >= 55
        ? `With systemic pressure at ${pressure.overallPressure}/100, multiple scenarios could invalidate a bullish thesis. Define your invalidation levels before entering.`
        : `Market pressure manageable at ${pressure.overallPressure}/100. Still important to define invalidation levels for any position.`,
    },
  ];
}

async function generateDailyBrief(
  pressure: FaultlinePressureOutput,
  vectors: RiskVector[],
  awarenessScore: number,
  marketStatus: "Cleared" | "Caution" | "Defensive",
): Promise<string> {
  const creditScore = getVectorScore(vectors, "credit-stress");
  const liquidityScore = getVectorScore(vectors, "liquidity-risk");
  const aiScore = getVectorScore(vectors, "ai-speculation");
  const volScore = getVectorScore(vectors, "volatility-regime");
  const fedScore = getVectorScore(vectors, "fed-policy");
  const breadthScore = getVectorScore(vectors, "market-breadth");

  const topAlerts = pressure.alerts.slice(0, 3).map(a => `- ${a.title}: ${a.detail}`).join("\n");

  const prompt = `You are FAULTLINE, an institutional-grade market intelligence system. Generate a concise daily market awareness brief (3–4 sentences, no bullet points, no headers) for a trader preparing to make decisions today.

Current market data:
- Overall Pressure: ${pressure.overallPressure}/100
- Regime: ${pressure.regime} (${pressure.level})
- Market Status: ${marketStatus}
- Awareness Score: ${awarenessScore}/100
- Credit Stress: ${creditScore}/100
- Liquidity Risk: ${liquidityScore}/100
- AI Speculation: ${aiScore}/100
- Volatility: ${volScore}/100
- Fed Pressure: ${fedScore}/100
- Market Breadth: ${breadthScore}/100

Top active alerts:
${topAlerts || "No critical alerts at this time."}

Write a brief that:
1. States the current market regime and what it means for risk-taking
2. Highlights the most important risk factor to be aware of today
3. Gives a clear directional awareness statement (not a trade recommendation)
4. Ends with what to watch for that could change the picture

Tone: professional, direct, institutional. No hedging language. No "I" statements. Write as FAULTLINE.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE, an institutional market intelligence system. Be direct, precise, and professional." },
        { role: "user", content: prompt },
      ],
    });
    const content = response?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.length > 20
      ? content
      : `${pressure.regime} regime with pressure at ${pressure.overallPressure}/100. Market status: ${marketStatus}. ${pressure.alerts[0]?.detail ?? "Monitor key risk vectors before deploying capital."}`;
  } catch {
    return `${pressure.regime} regime. Systemic pressure at ${pressure.overallPressure}/100. Market status: ${marketStatus}. Key risk: ${pressure.alerts[0]?.title ?? "Elevated macro uncertainty"}. Monitor ${pressure.alerts[0]?.detail ?? "all risk vectors"} before committing capital.`;
  }
}

// ── Main export ───────────────────────────────────────────────

export async function getPreFlightData(): Promise<PreFlightOutput> {
  const pressure = await calculateFaultlinePressure();
  const vectors = pressure.vectors;

  const awarenessScore = computeAwarenessScore(pressure);
  const awarenessLevel = getAwarenessLevel(awarenessScore);
  const marketStatus = computeMarketStatus(pressure);

  const creditScore = getVectorScore(vectors, "credit-stress");
  const breadthScore = getVectorScore(vectors, "market-breadth");
  const recessionScore = clamp(Math.round(creditScore * 0.35 + breadthScore * 0.35 + pressure.overallPressure * 0.30), 0, 100);

  const bullProbability = clamp(Math.round((100 - pressure.overallPressure) * 0.80 + (100 - creditScore) * 0.20), 5, 95);
  const bearProbability = clamp(100 - bullProbability, 5, 95);
  const recessionProbability = clamp(Math.round(recessionScore * 0.6), 5, 70);
  const crashProbability = clamp(Math.round(pressure.overallPressure * 0.60 + creditScore * 0.40) / 2, 5, 95);

  const creditCondition = buildCreditCondition(vectors, pressure);
  const liquidityCondition = buildLiquidityCondition(vectors, pressure);
  const aiBubbleRisk = buildAIBubbleRisk(vectors, pressure);
  const recessionRisk = buildRecessionRisk(vectors, pressure);
  const volatilityCondition = buildVolatilityCondition(vectors, pressure);
  const macroCondition = buildMacroCondition(vectors, pressure);

  const macroDrivers = buildMacroDrivers(vectors, pressure);
  const threatBoard = buildThreatBoard(vectors, pressure);
  const keyRisks = buildKeyRisks(vectors, pressure);
  const awarenessChecks = buildAwarenessChecks(vectors, pressure);

  const dailyBrief = await generateDailyBrief(pressure, vectors, awarenessScore, marketStatus);

  return {
    awarenessScore,
    awarenessLevel,
    pressureIndex: pressure.overallPressure,
    regime: pressure.regime,
    regimeLevel: pressure.level,
    marketStatus,
    bullProbability,
    bearProbability,
    recessionProbability,
    crashProbability,
    creditCondition,
    liquidityCondition,
    aiBubbleRisk,
    recessionRisk,
    volatilityCondition,
    macroCondition,
    macroDrivers,
    threatBoard,
    keyRisks,
    awarenessChecks,
    dailyBrief,
    dataSource: pressure.dataSource,
    timestamp: pressure.timestamp,
  };
}
