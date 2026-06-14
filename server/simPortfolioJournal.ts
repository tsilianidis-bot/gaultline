// ============================================================
// FAULTLINE — Simulated Portfolio Daily Journal Generator
// server/simPortfolioJournal.ts
//
// Generates daily journal entries documenting:
//   1. Portfolio-level macro narrative (regime, pressure, analogs)
//   2. Per-position commentary (what it did, why we hold/sold)
//   3. Forward-looking section (what to watch, potential triggers)
// ============================================================

import { calculateFaultlinePressure, FaultlinePressureOutput } from "./pressure/engine";
import { invokeLLM } from "./_core/llm";
import { log } from "./logger";
import { SimPortfolioValuation } from "./simPortfolioEngine";

// ── Types ─────────────────────────────────────────────────────

export interface DailyJournalEntry {
  date: string;                    // YYYY-MM-DD
  pressureScore: number;
  pressureRegime: string;
  pressureLevel: string;

  // Portfolio summary
  totalValue: number;
  stocksValue: number;
  cryptoValue: number;
  dailyPnl: number;
  dailyPnlPct: number;

  // AI-generated sections
  macroNarrative: string;          // Portfolio-level macro context (2-3 paragraphs)
  positionCommentary: PositionComment[];  // Per-position analysis
  forwardLooking: string;          // What to watch next (1-2 paragraphs)
  actionsTaken: string;            // Summary of any trades made today
  riskAssessment: string;          // Current risk posture

  // Meta
  generatedAt: number;
}

export interface PositionComment {
  ticker: string;
  name: string;
  assetType: "stock" | "crypto";
  action: "HOLD" | "BUY" | "SELL" | "WATCH";
  currentPrice: number;
  dailyChange: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  commentary: string;              // Why we hold/sold this position today
  faultlineAlignment: string;      // How FAULTLINE signals align with this position
  keyLevel: string;                // Important price level to watch
}

// ── Generate per-position commentary ─────────────────────────

async function generatePositionCommentary(
  position: SimPortfolioValuation["positions"][0],
  pressure: FaultlinePressureOutput,
  action: "HOLD" | "BUY" | "SELL",
): Promise<string> {
  const pnlStr = position.unrealizedPnl >= 0
    ? `+$${position.unrealizedPnl.toFixed(2)} (+${position.unrealizedPnlPct.toFixed(2)}%)`
    : `-$${Math.abs(position.unrealizedPnl).toFixed(2)} (${position.unrealizedPnlPct.toFixed(2)}%)`;

  const prompt = `You are FAULTLINE's portfolio journal writer. Write a 2-3 sentence daily commentary for this position.

Position: ${position.ticker} (${position.name}) — ${position.assetType.toUpperCase()}
Action Today: ${action}
Current Price: $${position.currentPrice?.toFixed(2) ?? "N/A"}
Entry Price: $${position.entryPrice.toFixed(2)}
P&L: ${pnlStr}
Original Signal: ${position.entrySignal ?? "N/A"}

FAULTLINE Context:
- Pressure: ${pressure.overallPressure}/100 (${pressure.regime})
- Regime Level: ${pressure.level}
- Top Alert: ${pressure.alerts[0]?.title ?? "None"}

Write a concise, analytical commentary explaining:
1. What the position did today relative to the entry thesis
2. Whether FAULTLINE signals still support holding/selling
3. What specific level or event would change the view

Be direct and data-driven. Reference specific FAULTLINE readings.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE's portfolio journal writer. Be concise, analytical, and always reference specific data points." },
        { role: "user", content: prompt },
      ],
    });
    return (response.choices?.[0]?.message?.content as string) ?? `${action} ${position.ticker} — monitoring position against FAULTLINE pressure at ${pressure.overallPressure}/100.`;
  } catch {
    return `${action} ${position.ticker} at $${position.currentPrice?.toFixed(2) ?? "N/A"}. P&L: ${pnlStr}. FAULTLINE pressure at ${pressure.overallPressure}/100 (${pressure.regime}) — ${action === "HOLD" ? "thesis intact" : "position closed"}.`;
  }
}

// ── Generate full daily journal ───────────────────────────────

export async function generateDailyJournal(
  valuation: SimPortfolioValuation,
  previousTotalValue: number,
  tradesSummary: string,
  pressure?: FaultlinePressureOutput,
): Promise<DailyJournalEntry> {
  const p = pressure ?? await calculateFaultlinePressure();

  const today = new Date().toISOString().split("T")[0];
  const dailyPnl = valuation.totalValue - previousTotalValue;
  const dailyPnlPct = previousTotalValue > 0 ? (dailyPnl / previousTotalValue) * 100 : 0;

  // Build position comments
  const positionComments: PositionComment[] = [];
  for (const pos of valuation.positions) {
    const action: "HOLD" | "BUY" | "SELL" = "HOLD"; // Default — engine will override for trades
    const commentary = await generatePositionCommentary(pos, p, action);

    const faultlineAlignment = p.overallPressure >= 65
      ? `High pressure (${p.overallPressure}/100) creates headwinds — position sizing reduced`
      : p.overallPressure >= 45
      ? `Moderate pressure (${p.overallPressure}/100) — selective exposure appropriate`
      : `Low pressure (${p.overallPressure}/100) supports risk-on positioning`;

    positionComments.push({
      ticker: pos.ticker,
      name: pos.name,
      assetType: pos.assetType,
      action,
      currentPrice: pos.currentPrice ?? pos.entryPrice,
      dailyChange: pos.currentPrice ? ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0,
      unrealizedPnl: pos.unrealizedPnl,
      unrealizedPnlPct: pos.unrealizedPnlPct,
      commentary,
      faultlineAlignment,
      keyLevel: pos.currentPrice
        ? `Support: $${(pos.currentPrice * 0.95).toFixed(2)} | Resistance: $${(pos.currentPrice * 1.08).toFixed(2)}`
        : "Key levels pending",
    });
  }

  // Generate macro narrative
  const vectorSummary = p.vectors
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(v => `${v.label}: ${v.score}/100 (${v.trend})`)
    .join("; ");

  const macroPrompt = `You are FAULTLINE's portfolio journal writer. Write a 2-3 paragraph macro narrative for today's portfolio journal entry.

DATE: ${today}
FAULTLINE PRESSURE INDEX: ${p.overallPressure}/100
REGIME: ${p.regime} (${p.level})
TOP RISK VECTORS: ${vectorSummary}
HISTORICAL ANALOG: ${p.topAnalog.label} (${p.topAnalog.similarity}% similarity)
TOP ALERT: ${p.alerts[0]?.title ?? "No critical alerts"} — ${p.alerts[0]?.detail ?? ""}

PORTFOLIO STATUS:
- Total Value: $${valuation.totalValue.toFixed(2)}
- Stocks: $${valuation.stocksValue.toFixed(2)} | Crypto: $${valuation.cryptoValue.toFixed(2)}
- Daily P&L: ${dailyPnl >= 0 ? "+" : ""}$${dailyPnl.toFixed(2)} (${dailyPnlPct >= 0 ? "+" : ""}${dailyPnlPct.toFixed(2)}%)
- Open Positions: ${valuation.positions.length}
- Trades Today: ${tradesSummary || "No trades executed"}

Write a journal entry that:
1. Explains the current macro environment through FAULTLINE's lens
2. Connects the pressure readings to portfolio positioning decisions
3. References the historical analog and what it implies for near-term risk

Be specific, analytical, and reference exact numbers. This is a permanent record proving the FAULTLINE model works.`;

  let macroNarrative = "";
  let forwardLooking = "";
  let riskAssessment = "";

  try {
    const macroResponse = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE's portfolio journal writer. Generate precise, data-driven daily journal entries that prove the model's value." },
        { role: "user", content: macroPrompt },
      ],
    });
    macroNarrative = (macroResponse.choices?.[0]?.message?.content as string) ?? "";

    // Generate forward-looking section
    const forwardPrompt = `Based on FAULTLINE pressure at ${p.overallPressure}/100 (${p.regime}) and the current portfolio of ${valuation.positions.length} positions, write a 1-2 paragraph forward-looking section for today's journal. 

Cover:
1. What specific events or data releases to watch in the next 3-5 trading days
2. What FAULTLINE pressure level would trigger a portfolio adjustment (add/reduce risk)
3. Which position is most at risk and what would trigger its exit

Be specific — name actual indicators, price levels, and FAULTLINE thresholds.`;

    const forwardResponse = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE's portfolio journal writer." },
        { role: "user", content: forwardPrompt },
      ],
    });
    forwardLooking = (forwardResponse.choices?.[0]?.message?.content as string) ?? "";

    // Risk assessment
    riskAssessment = p.overallPressure >= 65
      ? `ELEVATED RISK POSTURE: FAULTLINE pressure at ${p.overallPressure}/100 demands defensive positioning. Exposure reduced, stops tightened. Cash is a position.`
      : p.overallPressure >= 45
      ? `MODERATE RISK POSTURE: FAULTLINE pressure at ${p.overallPressure}/100 warrants selective exposure. Maintaining core positions with standard stops.`
      : `RISK-ON POSTURE: FAULTLINE pressure at ${p.overallPressure}/100 — low systemic stress supports full deployment. Monitoring for regime shifts.`;

  } catch (err) {
    log.warn("[SimPortfolio] Journal LLM generation failed", { err: err as Error });
    macroNarrative = `FAULTLINE Pressure Index: ${p.overallPressure}/100. Regime: ${p.regime}. ${p.topAnalog.label} analog at ${p.topAnalog.similarity}% similarity. Portfolio value: $${valuation.totalValue.toFixed(2)}.`;
    forwardLooking = `Monitoring FAULTLINE pressure for regime shifts. Key threshold: 65/100 triggers defensive repositioning.`;
    riskAssessment = `Current pressure: ${p.overallPressure}/100 (${p.regime}).`;
  }

  return {
    date: today,
    pressureScore: p.overallPressure,
    pressureRegime: p.regime,
    pressureLevel: p.level,
    totalValue: valuation.totalValue,
    stocksValue: valuation.stocksValue,
    cryptoValue: valuation.cryptoValue,
    dailyPnl,
    dailyPnlPct: Math.round(dailyPnlPct * 100) / 100,
    macroNarrative,
    positionCommentary: positionComments,
    forwardLooking,
    actionsTaken: tradesSummary || "No trades executed today. All positions held per existing thesis.",
    riskAssessment,
    generatedAt: Date.now(),
  };
}
