/**
 * S.O.B.™ Engine — Signals of Breakdown
 *
 * Computes the S.O.B. level from existing FRED + regime data.
 * NOT a crash prediction system — measures accumulation of stress
 * across independent pillars.
 *
 * Pillars:
 *   1. Credit Stress      — credit spread proxy (10Y-2Y spread, HY proxy)
 *   2. Yield Curve        — inversion depth
 *   3. Breadth            — % stocks above 200-day MA proxy
 *   4. Liquidity          — Fed funds rate vs neutral
 *   5. Momentum           — SPY trend proxy
 *   6. Volatility         — VIX proxy from regime
 *
 * Level:
 *   0   = No active signals     → "Clear"
 *   1   = 1 pillar active       → "Awareness"
 *   2–3 = 2–3 pillars active    → "Evolving"
 *   4–5 = 4–5 pillars active    → "Elevated"
 *   6   = All pillars active    → "Critical"
 */

export interface SOBPillar {
  id: string;
  name: string;
  active: boolean;
  value: string;
  description: string;
  severity: "low" | "medium" | "high";
}

export interface SOBResult {
  level: number;           // 0–6
  label: string;           // "Clear" | "Awareness" | "Evolving" | "Elevated" | "Critical"
  color: string;           // hex
  trend: "rising" | "stable" | "falling";
  confidence: number;      // 0–100
  pillars: SOBPillar[];
  explanation: string;
  whatChanged: string;
  whatToWatchNext: string;
  generatedAt: number;
}

export interface SOBInput {
  /** FRED indicators — pass the output from the FRED proxy */
  fredIndicators?: Record<string, number | null>;
  /** Current regime label */
  regime?: string;
  /** Current pressure index (0–100) */
  pressureIndex?: number;
  /** Yield spread (10Y minus 2Y), negative = inverted */
  yieldSpread?: number | null;
  /** Fed funds rate */
  fedFundsRate?: number | null;
  /** VIX level */
  vix?: number | null;
  /** Credit spread proxy (HY spread) */
  creditSpread?: number | null;
}

const LEVEL_LABELS = ["Clear", "Awareness", "Evolving", "Evolving", "Elevated", "Elevated", "Critical"];
const LEVEL_COLORS = ["#4B5563", "#00D4FF", "#F59E0B", "#FF8C00", "#FF2D55", "#FF2D55", "#8B0000"];

export function computeSOB(input: SOBInput): SOBResult {
  const {
    regime = "Unknown",
    pressureIndex = 30,
    yieldSpread = null,
    fedFundsRate = null,
    vix = null,
    creditSpread = null,
  } = input;

  const pillars: SOBPillar[] = [];

  // ── Pillar 1: Credit Stress ──────────────────────────────────────────────
  const creditActive = creditSpread != null ? creditSpread > 450 : pressureIndex > 65;
  pillars.push({
    id: "credit",
    name: "Credit Stress",
    active: creditActive,
    value: creditSpread != null ? `${creditSpread.toFixed(0)} bps` : pressureIndex > 65 ? "Elevated (proxy)" : "Normal",
    description: creditActive
      ? "Credit spreads are elevated, indicating lenders are demanding higher compensation for risk."
      : "Credit spreads are within normal range. No significant stress in lending conditions.",
    severity: creditActive ? (creditSpread != null && creditSpread > 600 ? "high" : "medium") : "low",
  });

  // ── Pillar 2: Yield Curve ────────────────────────────────────────────────
  const yieldActive = yieldSpread != null ? yieldSpread < -0.25 : false;
  pillars.push({
    id: "yield-curve",
    name: "Yield Curve",
    active: yieldActive,
    value: yieldSpread != null ? `${yieldSpread >= 0 ? "+" : ""}${yieldSpread.toFixed(2)}%` : "Data unavailable",
    description: yieldActive
      ? `The yield curve is inverted (10Y-2Y = ${yieldSpread?.toFixed(2)}%). Historically, sustained inversion precedes economic slowdowns.`
      : "The yield curve is not inverted. This pillar is not contributing to S.O.B.",
    severity: yieldActive ? (yieldSpread != null && yieldSpread < -0.75 ? "high" : "medium") : "low",
  });

  // ── Pillar 3: Breadth Deterioration ─────────────────────────────────────
  // Proxy from regime + pressure
  const breadthActive =
    regime.toLowerCase().includes("contraction") ||
    regime.toLowerCase().includes("crisis") ||
    pressureIndex > 70;
  pillars.push({
    id: "breadth",
    name: "Breadth Deterioration",
    active: breadthActive,
    value: breadthActive ? "Narrowing" : "Broad",
    description: breadthActive
      ? "Market gains are concentrated in fewer stocks. The majority of the market is underperforming major indices — a classic warning sign."
      : "Market breadth is healthy. Gains are broadly distributed across sectors and stocks.",
    severity: breadthActive ? "medium" : "low",
  });

  // ── Pillar 4: Liquidity Tightening ───────────────────────────────────────
  const liquidityActive = fedFundsRate != null ? fedFundsRate > 4.5 : false;
  pillars.push({
    id: "liquidity",
    name: "Liquidity Tightening",
    active: liquidityActive,
    value: fedFundsRate != null ? `Fed Funds: ${fedFundsRate.toFixed(2)}%` : "Data unavailable",
    description: liquidityActive
      ? `The Fed Funds rate at ${fedFundsRate?.toFixed(2)}% is in restrictive territory, reducing the flow of money through financial markets.`
      : "Monetary conditions are not significantly restrictive. Liquidity is flowing normally.",
    severity: liquidityActive ? (fedFundsRate != null && fedFundsRate > 5.25 ? "high" : "medium") : "low",
  });

  // ── Pillar 5: Momentum Breakdown ─────────────────────────────────────────
  const momentumActive =
    regime.toLowerCase().includes("bear") ||
    regime.toLowerCase().includes("contraction") ||
    pressureIndex > 75;
  pillars.push({
    id: "momentum",
    name: "Momentum Breakdown",
    active: momentumActive,
    value: momentumActive ? "Negative" : "Positive",
    description: momentumActive
      ? "Price momentum has turned negative. The prevailing trend is downward, which historically increases the probability of further declines."
      : "Price momentum is positive or neutral. No momentum breakdown signal is active.",
    severity: momentumActive ? "medium" : "low",
  });

  // ── Pillar 6: Volatility Expansion ───────────────────────────────────────
  const volActive = vix != null ? vix > 25 : pressureIndex > 60;
  pillars.push({
    id: "volatility",
    name: "Volatility Expansion",
    active: volActive,
    value: vix != null ? `VIX ${vix.toFixed(1)}` : pressureIndex > 60 ? "Elevated (proxy)" : "Normal",
    description: volActive
      ? `Volatility is elevated${vix != null ? ` (VIX ${vix.toFixed(1)})` : ""}. High volatility indicates uncertainty and can amplify both gains and losses.`
      : "Volatility is within normal range. Markets are not showing signs of fear or panic.",
    severity: volActive ? (vix != null && vix > 35 ? "high" : "medium") : "low",
  });

  // ── Compute level ────────────────────────────────────────────────────────
  const activePillars = pillars.filter(p => p.active);
  const level = activePillars.length;
  const label = LEVEL_LABELS[level] ?? "Critical";
  const color = LEVEL_COLORS[level] ?? "#8B0000";

  // Confidence: higher when more data is available
  const dataPoints = [creditSpread, yieldSpread, fedFundsRate, vix].filter(v => v != null).length;
  const confidence = Math.round(50 + (dataPoints / 4) * 40 + (level > 0 ? 5 : 0));

  // Trend: proxy from pressure index direction
  const trend: SOBResult["trend"] = pressureIndex > 60 ? "rising" : pressureIndex < 35 ? "falling" : "stable";

  // Explanation
  const explanations: Record<string, string> = {
    Clear: "No S.O.B. pillars are currently active. Market conditions are within normal parameters across credit, yield curve, breadth, liquidity, momentum, and volatility dimensions.",
    Awareness: `One S.O.B. pillar is active (${activePillars[0]?.name ?? ""}). This is an awareness signal — conditions warrant monitoring but do not indicate elevated stress.`,
    Evolving: `${level} S.O.B. pillars are active: ${activePillars.map(p => p.name).join(", ")}. Conditions are evolving. Multiple independent stress signals are present simultaneously, which historically precedes increased market volatility.`,
    Elevated: `${level} S.O.B. pillars are active: ${activePillars.map(p => p.name).join(", ")}. Stress is elevated across multiple market dimensions. This level of simultaneous signal activation warrants heightened awareness.`,
    Critical: "All 6 S.O.B. pillars are active. This represents the highest level of measured market stress across credit, yield curve, breadth, liquidity, momentum, and volatility. Conditions are historically consistent with significant market stress.",
  };

  const explanation = explanations[label] ?? explanations.Evolving;

  const whatChanged = level === 0
    ? "No new signals have activated. Market conditions remain within normal parameters."
    : `${activePillars.filter(p => p.severity === "high").length > 0 ? "High-severity signals are active: " + activePillars.filter(p => p.severity === "high").map(p => p.name).join(", ") + ". " : ""}The most recently activated pillar is ${activePillars[activePillars.length - 1]?.name ?? "unknown"}.`;

  const watchNextMap: Record<string, string> = {
    Clear: "Monitor credit spreads and the yield curve for early signs of stress developing.",
    Awareness: `Watch the ${activePillars[0]?.name ?? "active"} pillar for escalation. If a second pillar activates, the S.O.B. level will rise to Evolving.`,
    Evolving: "Monitor whether additional pillars activate. Watch for credit spread widening, VIX expansion, or further breadth deterioration as potential escalation signals.",
    Elevated: "Watch for resolution in the most severe active pillars. Credit spread tightening and VIX normalization are typically the first signs of stress reduction.",
    Critical: "Monitor for any signs of policy response (Fed pivot, fiscal stimulus) or credit market stabilization that could begin reducing active pillars.",
  };

  const whatToWatchNext = watchNextMap[label] ?? watchNextMap.Evolving;

  return {
    level,
    label,
    color,
    trend,
    confidence,
    pillars,
    explanation,
    whatChanged,
    whatToWatchNext,
    generatedAt: Date.now(),
  };
}
