/**
 * ScoreExplainer — Platform-wide score explanation framework
 *
 * Renders a consistent, collapsible explanation panel beneath any major
 * FAULTLINE metric.  Covers all 8 required fields:
 *   1. Plain-English Status label
 *   2. One-sentence meaning
 *   3. Why it is here (drivers)
 *   4. Direction indicator (↑ Rising / ↓ Falling / → Stable)
 *   5. Historical context
 *   6. What to watch
 *   7. Learn More link
 *   8. Score range legend
 *
 * Usage:
 *   <ScoreExplainer
 *     scoreKey="pressureIndex"
 *     value={72}
 *     trend="rising"
 *     drivers={["Treasury Stress", "Liquidity", "Credit Markets"]}
 *     historicalPercentile={83}
 *     historicalAnalog="late-2018"
 *     trendDays={6}
 *     defaultExpanded={false}
 *   />
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BookOpen, Info } from "lucide-react";
import { Link } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScoreTrend = "rising" | "falling" | "stable";

export interface ScoreExplainerProps {
  /** Which score this explains — determines all static copy */
  scoreKey: ScoreKey;
  /** Current numeric value (0–100 unless otherwise noted) */
  value: number;
  /** Direction the score is moving */
  trend?: ScoreTrend;
  /** Active drivers to display (only list those supported by current data) */
  drivers?: string[];
  /** Percentile vs history (0–100) */
  historicalPercentile?: number;
  /** Short label for the closest historical analog, e.g. "late-2018" */
  historicalAnalog?: string;
  /** How many consecutive trading days the trend has held */
  trendDays?: number;
  /** Whether the panel starts open */
  defaultExpanded?: boolean;
  /** Override the accent color (defaults to score-based color) */
  accentColor?: string;
  /** Compact inline mode — shows only status label + info icon, expands on click */
  compact?: boolean;
}

export type ScoreKey =
  | "pressureIndex"
  | "marketRisk"
  | "bullProbability"
  | "crashRisk"
  | "opportunityScore"
  | "regime"
  | "confidence"
  | "regimeAlignment"
  | "liquidityStress"
  | "creditStress"
  | "volatilityRegime"
  | "aiConcentration"
  | "breadthHealth"
  | "macroRegime"
  | "treasuryStress";

// ── Score metadata registry ───────────────────────────────────────────────────

interface ScoreMeta {
  label: string;
  shortLabel: string;
  learnMorePath?: string;
  /** Returns a plain-English status label for a given value */
  statusLabel: (value: number) => string;
  /** Returns a one-sentence meaning for a given value */
  meaning: (value: number) => string;
  /** What the score measures (for Learn More) */
  measures: string;
  /** High-level calculation description */
  howCalculated: string;
  /** Why it matters */
  whyItMatters: string;
  /** Range descriptions */
  ranges: { label: string; range: string; description: string }[];
  /** What to watch next */
  watchNext: (value: number, drivers?: string[]) => string;
  /** Historical context template */
  historicalContext: (percentile?: number, analog?: string) => string | null;
  /** Accent color for the score level */
  color: (value: number) => string;
}

const SCORE_REGISTRY: Record<ScoreKey, ScoreMeta> = {
  pressureIndex: {
    label: "FAULTLINE Pressure Index",
    shortLabel: "Pressure Index",
    learnMorePath: "/learn/what-is-market-regime",
    statusLabel: (v) => {
      if (v >= 80) return "Systemic Crisis";
      if (v >= 65) return "High Stress";
      if (v >= 45) return "Elevated Stress";
      if (v >= 25) return "Moderate Risk";
      return "Low Risk";
    },
    meaning: (v) => {
      if (v >= 80) return "Systemic stress is at crisis levels. Multiple fault lines are active simultaneously, indicating a high probability of cascading market disruption.";
      if (v >= 65) return "Market pressure is high and broad-based. Conditions historically associated with elevated drawdown risk and reduced risk appetite across asset classes.";
      if (v >= 45) return "Market pressure is above normal and continues to build. Conditions currently favor increased volatility and higher downside risk.";
      if (v >= 25) return "Market conditions show moderate stress. Some fault lines are active but systemic risk remains contained. Normal risk management applies.";
      return "Market conditions are calm. Systemic pressure is low, liquidity is healthy, and no major fault lines are currently active.";
    },
    measures: "The FAULTLINE Pressure Index is a composite score (0–100) that aggregates six independent risk vectors: Treasury market stress, liquidity conditions, credit spread behavior, volatility regime, macro regime pressure, and market breadth health. It is designed to detect systemic fault lines forming before they become visible crises.",
    howCalculated: "Each of the six risk vectors is scored independently on a 0–100 scale using real-time and near-real-time market data. The composite score is a weighted average of all six vectors, with weights adjusted based on the current macro regime. Higher scores indicate more stress.",
    whyItMatters: "Most market risk tools only measure what has already happened. The Pressure Index is designed to detect stress building beneath the surface — before it becomes a headline. A rising Pressure Index has historically preceded significant market dislocations by days to weeks.",
    ranges: [
      { label: "Low Risk", range: "0–24", description: "Calm conditions. No major fault lines active. Normal risk posture is appropriate." },
      { label: "Moderate Risk", range: "25–44", description: "Some stress present but systemic risk is contained. Monitor for escalation." },
      { label: "Elevated Stress", range: "45–64", description: "Above-normal pressure. Increased volatility likely. Reduce outsized risk exposures." },
      { label: "High Stress", range: "65–79", description: "Broad-based stress. Historically associated with meaningful drawdowns. Defensive posture warranted." },
      { label: "Systemic Crisis", range: "80–100", description: "Crisis-level conditions. Multiple fault lines active simultaneously. Maximum caution." },
    ],
    watchNext: (v, drivers) => {
      const base = drivers?.length
        ? `Watch ${drivers.slice(0, 3).join(", ")} for signs of improvement or further deterioration.`
        : "Watch Treasury yields, credit spreads, and liquidity conditions for directional signals.";
      if (v >= 65) return `${base} A sustained improvement across two or more vectors would be needed to meaningfully reduce the Pressure Index.`;
      if (v >= 45) return `${base} A single vector improvement is unlikely to move the composite score significantly — watch for broad-based stabilization.`;
      return `${base} Monitor for any uptick in credit spreads or volatility that could signal early stress building.`;
    },
    historicalContext: (pct, analog) => {
      if (pct === undefined && !analog) return null;
      const parts: string[] = [];
      if (pct !== undefined) parts.push(`Higher than ${pct}% of all trading days since 2008.`);
      if (analog) parts.push(`Conditions most closely resemble ${analog}.`);
      return parts.join(" ");
    },
    color: (v) => {
      if (v >= 80) return "#FF2D55";
      if (v >= 65) return "#FF6B35";
      if (v >= 45) return "#FFD700";
      if (v >= 25) return "#00D4FF";
      return "#00FF88";
    },
  },

  marketRisk: {
    label: "Market Risk Score",
    shortLabel: "Market Risk",
    learnMorePath: "/learn/how-to-read-stock-market",
    statusLabel: (v) => {
      if (v >= 80) return "Extreme Risk";
      if (v >= 65) return "High Risk";
      if (v >= 45) return "Elevated Risk";
      if (v >= 25) return "Moderate Risk";
      return "Low Risk";
    },
    meaning: (v) => {
      if (v >= 80) return "Market risk is at extreme levels. The probability of a significant near-term drawdown is historically high.";
      if (v >= 65) return "Market risk is high. Current conditions have historically been followed by above-average volatility and drawdown potential.";
      if (v >= 45) return "Market risk is elevated above normal. Investors should be aware of increased downside potential over the coming weeks.";
      if (v >= 25) return "Market risk is moderate. Some caution is warranted but conditions do not suggest imminent broad-based stress.";
      return "Market risk is low. Current conditions are historically associated with stable or rising markets.";
    },
    measures: "The Market Risk Score aggregates equity market stress indicators including implied volatility, put/call ratios, market breadth deterioration, and macro regime signals into a single 0–100 risk reading.",
    howCalculated: "Derived from a combination of options market signals, breadth indicators, and the current FAULTLINE Pressure Index. Higher values indicate greater near-term downside risk.",
    whyItMatters: "Understanding current market risk helps investors size positions appropriately, decide when to hedge, and avoid taking on outsized risk during historically dangerous periods.",
    ranges: [
      { label: "Low Risk", range: "0–24", description: "Favorable conditions. Risk-on posture is historically rewarded." },
      { label: "Moderate Risk", range: "25–44", description: "Normal market conditions. Standard risk management applies." },
      { label: "Elevated Risk", range: "45–64", description: "Above-average risk. Consider reducing position sizes." },
      { label: "High Risk", range: "65–79", description: "Significant downside risk present. Defensive positioning warranted." },
      { label: "Extreme Risk", range: "80–100", description: "Historically dangerous conditions. Capital preservation is the priority." },
    ],
    watchNext: (v) => {
      if (v >= 65) return "Watch VIX for signs of mean reversion, credit spreads for stabilization, and breadth indicators for a recovery in market participation.";
      if (v >= 45) return "Monitor volatility trends, sector rotation patterns, and the FAULTLINE Pressure Index for early warning of escalation.";
      return "Watch for any sudden spike in volatility or credit spreads that could signal a shift in the risk environment.";
    },
    historicalContext: (pct, analog) => {
      if (pct === undefined && !analog) return null;
      const parts: string[] = [];
      if (pct !== undefined) parts.push(`Higher than ${pct}% of all trading days since 2000.`);
      if (analog) parts.push(`Comparable to conditions observed during ${analog}.`);
      return parts.join(" ");
    },
    color: (v) => {
      if (v >= 80) return "#FF2D55";
      if (v >= 65) return "#FF6B35";
      if (v >= 45) return "#FFD700";
      if (v >= 25) return "#00D4FF";
      return "#00FF88";
    },
  },

  bullProbability: {
    label: "Bull Continuation Probability",
    shortLabel: "Bull Probability",
    learnMorePath: "/learn/bull-and-bear-markets",
    statusLabel: (v) => {
      if (v >= 75) return "Strong Bull Signal";
      if (v >= 55) return "Moderate Bull Bias";
      if (v >= 45) return "Neutral / Mixed";
      if (v >= 25) return "Bear Bias";
      return "Strong Bear Signal";
    },
    meaning: (v) => {
      if (v >= 75) return "The probability of continued bullish market conditions is high. Historical setups with this profile have been followed by positive returns in the majority of cases.";
      if (v >= 55) return "Conditions modestly favor continued upside. The macro and technical environment is more supportive than not, but risks remain.";
      if (v >= 45) return "Conditions are mixed. Neither bulls nor bears have a clear edge. Caution and selectivity are warranted.";
      if (v >= 25) return "Conditions favor a bearish or defensive outcome. The weight of evidence points toward continued pressure or further downside.";
      return "The probability of continued bullish conditions is very low. Historical setups with this profile have been followed by meaningful drawdowns in the majority of cases.";
    },
    measures: "Bull Continuation Probability estimates the likelihood that current market conditions will be followed by positive returns over the next 30–90 days, based on the current macro regime, pressure environment, and historical analog matching.",
    howCalculated: "Derived from the FAULTLINE regime classification, the Pressure Index, historical analog outcomes, and momentum signals. It is not a prediction — it is a probability estimate based on historical base rates.",
    whyItMatters: "Understanding the probability distribution of outcomes helps investors make better-informed decisions about position sizing, hedging, and timing rather than relying on binary predictions.",
    ranges: [
      { label: "Strong Bear Signal", range: "0–24", description: "Historical base rate strongly favors downside. Maximum caution." },
      { label: "Bear Bias", range: "25–44", description: "Conditions favor bears. Reduce risk, consider hedges." },
      { label: "Neutral / Mixed", range: "45–54", description: "No clear edge. Selectivity and smaller sizing are appropriate." },
      { label: "Moderate Bull Bias", range: "55–74", description: "Conditions modestly favor upside. Normal risk posture is appropriate." },
      { label: "Strong Bull Signal", range: "75–100", description: "Historical base rate strongly favors upside. Conditions support risk-on positioning." },
    ],
    watchNext: (v) => {
      if (v >= 55) return "Watch for any deterioration in breadth, a spike in credit spreads, or a Fed policy shift that could reduce the bull probability.";
      if (v <= 44) return "Watch for improving breadth, stabilizing credit conditions, or a shift in the macro regime that could signal a recovery in bull probability.";
      return "Watch for a decisive break in either direction — improving macro conditions or worsening credit/liquidity stress — to resolve the current mixed signal.";
    },
    historicalContext: (pct, analog) => {
      if (pct === undefined && !analog) return null;
      const parts: string[] = [];
      if (pct !== undefined) parts.push(`This probability level has been observed in ${pct}% of trading environments since 2000.`);
      if (analog) parts.push(`The current setup most closely resembles ${analog}.`);
      return parts.join(" ");
    },
    color: (v) => {
      if (v >= 75) return "#00FF88";
      if (v >= 55) return "#00D4FF";
      if (v >= 45) return "#FFD700";
      if (v >= 25) return "#FF6B35";
      return "#FF2D55";
    },
  },

  crashRisk: {
    label: "Crash Risk Probability",
    shortLabel: "Crash Risk",
    learnMorePath: "/learn/what-causes-market-crash",
    statusLabel: (v) => {
      if (v >= 70) return "Elevated Crash Risk";
      if (v >= 50) return "Moderate Crash Risk";
      if (v >= 30) return "Low-Moderate Risk";
      return "Low Crash Risk";
    },
    meaning: (v) => {
      if (v >= 70) return "The probability of a significant market dislocation (15%+ drawdown) over the next 90 days is elevated based on current conditions and historical analogs.";
      if (v >= 50) return "Crash risk is moderate. Current conditions share characteristics with environments that have preceded meaningful drawdowns, but are not yet at crisis levels.";
      if (v >= 30) return "Crash risk is below average. While no environment is risk-free, current conditions do not resemble typical pre-crash setups.";
      return "Crash risk is low. Current conditions are historically associated with stable or gradually rising markets.";
    },
    measures: "Crash Risk Probability estimates the likelihood of a rapid, significant market decline (typically defined as 15% or more within 90 days) based on the current Pressure Index, credit conditions, liquidity environment, and historical analog matching.",
    howCalculated: "Based on historical base rates of significant drawdowns following similar Pressure Index readings, credit spread levels, and macro regime conditions. Not a prediction — a probability estimate.",
    whyItMatters: "Crash risk awareness helps investors decide when to hold more cash, buy protective options, or reduce leverage — before a dislocation occurs rather than after.",
    ranges: [
      { label: "Low Crash Risk", range: "0–29", description: "Historically, setups like this have rarely been followed by rapid large declines." },
      { label: "Low-Moderate Risk", range: "30–49", description: "Some risk present but well below historical crash-precursor levels." },
      { label: "Moderate Crash Risk", range: "50–69", description: "Conditions share characteristics with pre-crash environments. Caution warranted." },
      { label: "Elevated Crash Risk", range: "70–100", description: "Historically dangerous. These conditions have preceded significant dislocations." },
    ],
    watchNext: (v) => {
      if (v >= 50) return "Watch credit spreads for further widening, liquidity conditions for deterioration, and the VIX for a sustained spike above 25 — any of these would increase crash risk further.";
      return "Monitor the Pressure Index for any rapid escalation, credit markets for early stress signals, and macro data for unexpected deterioration.";
    },
    historicalContext: (pct, analog) => {
      if (pct === undefined && !analog) return null;
      const parts: string[] = [];
      if (pct !== undefined) parts.push(`This crash risk level has been exceeded in only ${100 - (pct ?? 50)}% of trading environments since 2000.`);
      if (analog) parts.push(`Most comparable to conditions observed during ${analog}.`);
      return parts.join(" ");
    },
    color: (v) => {
      if (v >= 70) return "#FF2D55";
      if (v >= 50) return "#FF6B35";
      if (v >= 30) return "#FFD700";
      return "#00FF88";
    },
  },

  opportunityScore: {
    label: "Opportunity Score",
    shortLabel: "Opportunity",
    learnMorePath: "/learn/macro-investing",
    statusLabel: (v) => {
      if (v >= 80) return "High-Conviction Setup";
      if (v >= 60) return "Favorable Setup";
      if (v >= 40) return "Moderate Setup";
      if (v >= 20) return "Weak Setup";
      return "Unfavorable Setup";
    },
    meaning: (v) => {
      if (v >= 80) return "This setup scores in the top tier historically. The combination of macro alignment, technical structure, and risk/reward profile is highly favorable.";
      if (v >= 60) return "A favorable setup with multiple supporting factors. The macro and technical environment supports a risk-on approach with appropriate position sizing.";
      if (v >= 40) return "A moderate setup with mixed signals. Some supporting factors are present but the overall environment is not strongly aligned.";
      if (v >= 20) return "A weak setup. The current environment does not strongly support this opportunity. Smaller sizing or waiting for better conditions is advisable.";
      return "An unfavorable setup. The macro and technical environment is working against this opportunity. Avoid or wait for conditions to improve.";
    },
    measures: "The Opportunity Score evaluates a specific trade or investment setup against the current macro regime, technical conditions, and risk/reward profile. Higher scores indicate better alignment between the opportunity and the current environment.",
    howCalculated: "Combines regime alignment score, technical signal strength, risk/reward ratio, and macro tailwind/headwind assessment into a single 0–100 score.",
    whyItMatters: "Not all opportunities are equal. A strong setup in a favorable macro environment has historically outperformed the same setup in a hostile environment. The Opportunity Score helps prioritize where to focus capital.",
    ranges: [
      { label: "Unfavorable", range: "0–19", description: "Avoid. The environment is working against this setup." },
      { label: "Weak Setup", range: "20–39", description: "Below-average conditions. Wait for improvement." },
      { label: "Moderate Setup", range: "40–59", description: "Mixed signals. Smaller sizing and tighter risk management." },
      { label: "Favorable Setup", range: "60–79", description: "Good conditions. Normal sizing with defined risk." },
      { label: "High-Conviction", range: "80–100", description: "Excellent conditions. Full sizing with conviction." },
    ],
    watchNext: (v) => {
      if (v >= 60) return "Watch for any deterioration in the macro regime or a breakdown in technical structure that would reduce the score.";
      return "Watch for improving macro alignment, a cleaner technical setup, or a better risk/reward entry point that could improve the score.";
    },
    historicalContext: (pct, analog) => {
      if (pct === undefined && !analog) return null;
      if (pct !== undefined) return `Setups scoring this high have historically produced above-average returns in ${pct}% of cases.`;
      return null;
    },
    color: (v) => {
      if (v >= 80) return "#00FF88";
      if (v >= 60) return "#00D4FF";
      if (v >= 40) return "#FFD700";
      if (v >= 20) return "#FF6B35";
      return "#FF2D55";
    },
  },

  regime: {
    label: "Market Regime",
    shortLabel: "Regime",
    learnMorePath: "/learn/what-is-market-regime",
    statusLabel: (v) => {
      if (v >= 80) return "Systemic Crisis";
      if (v >= 65) return "High Stress Regime";
      if (v >= 45) return "Elevated Risk Regime";
      if (v >= 25) return "Moderate Risk Regime";
      return "Low Risk / Bull Regime";
    },
    meaning: (v) => {
      if (v >= 65) return "The current market regime is characterized by elevated systemic stress. Risk assets historically underperform in this regime and defensive positioning is rewarded.";
      if (v >= 45) return "The current regime shows above-normal stress. Mixed signals across asset classes. Selective risk-taking with defined exits is appropriate.";
      return "The current regime is supportive of risk assets. Macro conditions, liquidity, and credit are broadly aligned with continued market expansion.";
    },
    measures: "The Market Regime classifies the current macro and market environment into one of five states based on the FAULTLINE Pressure Index, credit conditions, and liquidity environment.",
    howCalculated: "Regime is determined by the composite Pressure Index score and confirmed by the direction of credit spreads, liquidity, and macro momentum.",
    whyItMatters: "The regime determines which asset classes, sectors, and strategies have historically performed best. Understanding the regime helps align investment decisions with the current environment rather than fighting it.",
    ranges: [
      { label: "Low Risk / Bull", range: "0–24", description: "Expansionary regime. Risk assets historically outperform." },
      { label: "Moderate Risk", range: "25–44", description: "Normal cycle conditions. Balanced approach." },
      { label: "Elevated Risk", range: "45–64", description: "Late-cycle or early stress. Selectivity matters." },
      { label: "High Stress", range: "65–79", description: "Contraction or early crisis. Defensive assets outperform." },
      { label: "Systemic Crisis", range: "80–100", description: "Crisis regime. Capital preservation is the priority." },
    ],
    watchNext: (v) => {
      if (v >= 65) return "A regime shift requires sustained improvement across credit, liquidity, and macro conditions — watch for two or more vectors improving simultaneously.";
      if (v >= 45) return "Watch for the Pressure Index to break decisively above 65 (stress escalation) or below 35 (normalization) for a regime transition signal.";
      return "Watch for any rapid deterioration in credit spreads, a VIX spike above 25, or a sudden shift in Fed policy that could trigger a regime change.";
    },
    historicalContext: (pct, analog) => {
      if (!analog) return null;
      return `This regime most closely resembles conditions observed during ${analog}.`;
    },
    color: (v) => {
      if (v >= 80) return "#FF2D55";
      if (v >= 65) return "#FF6B35";
      if (v >= 45) return "#FFD700";
      if (v >= 25) return "#00D4FF";
      return "#00FF88";
    },
  },

  confidence: {
    label: "Decision Confidence",
    shortLabel: "Confidence",
    learnMorePath: "/learn/macro-investing",
    statusLabel: (v) => {
      if (v >= 80) return "High Confidence";
      if (v >= 60) return "Moderate-High Confidence";
      if (v >= 40) return "Moderate Confidence";
      if (v >= 20) return "Low Confidence";
      return "Very Low Confidence";
    },
    meaning: (v) => {
      if (v >= 80) return "Multiple independent signals are aligned and pointing in the same direction. This is a high-conviction reading.";
      if (v >= 60) return "Most signals are aligned. The reading has above-average reliability but some uncertainty remains.";
      if (v >= 40) return "Signals are mixed. The reading reflects genuine uncertainty in the current environment. Smaller sizing is appropriate.";
      return "Signals are conflicting or data quality is limited. This reading should be treated with caution.";
    },
    measures: "Confidence measures the degree of agreement among the underlying signals that contribute to a reading. High confidence means multiple independent data sources are pointing in the same direction.",
    howCalculated: "Based on the number of aligned vs. conflicting signals, data freshness, and the historical reliability of similar setups.",
    whyItMatters: "A high-confidence reading is more actionable than a low-confidence one. Confidence helps investors size positions appropriately — larger when signals are aligned, smaller when they conflict.",
    ranges: [
      { label: "Very Low", range: "0–19", description: "Highly conflicting signals. Treat with significant caution." },
      { label: "Low", range: "20–39", description: "More conflict than alignment. Reduce position sizes." },
      { label: "Moderate", range: "40–59", description: "Mixed signals. Standard caution applies." },
      { label: "Moderate-High", range: "60–79", description: "Mostly aligned signals. Above-average reliability." },
      { label: "High", range: "80–100", description: "Strong signal alignment. High-conviction reading." },
    ],
    watchNext: (_v) => "Watch for new data releases, Fed communications, or sudden market moves that could shift the signal alignment and change the confidence level.",
    historicalContext: () => null,
    color: (v) => {
      if (v >= 80) return "#00FF88";
      if (v >= 60) return "#00D4FF";
      if (v >= 40) return "#FFD700";
      if (v >= 20) return "#FF6B35";
      return "#FF2D55";
    },
  },

  regimeAlignment: {
    label: "Regime Alignment Score",
    shortLabel: "Regime Alignment",
    learnMorePath: "/learn/what-is-market-regime",
    statusLabel: (v) => {
      if (v >= 80) return "Strong Alignment";
      if (v >= 60) return "Good Alignment";
      if (v >= 40) return "Partial Alignment";
      if (v >= 20) return "Weak Alignment";
      return "Misaligned";
    },
    meaning: (v) => {
      if (v >= 80) return "This opportunity is strongly aligned with the current macro regime. The macro environment is a tailwind, not a headwind.";
      if (v >= 60) return "Good alignment with the current regime. The macro environment is broadly supportive of this setup.";
      if (v >= 40) return "Partial alignment. Some macro factors support this setup but others are working against it.";
      return "This opportunity is misaligned with the current regime. The macro environment is a headwind. Extra caution is warranted.";
    },
    measures: "Regime Alignment measures how well a specific trade or investment opportunity fits the current macro and market regime. High alignment means the macro environment is a tailwind.",
    howCalculated: "Scores the opportunity against the current regime classification, sector rotation signals, and macro momentum indicators.",
    whyItMatters: "Trading with the regime historically produces better risk-adjusted returns than trading against it. Regime alignment is one of the most important filters for opportunity selection.",
    ranges: [
      { label: "Misaligned", range: "0–19", description: "The macro environment is working against this setup." },
      { label: "Weak Alignment", range: "20–39", description: "More headwinds than tailwinds." },
      { label: "Partial Alignment", range: "40–59", description: "Mixed macro environment." },
      { label: "Good Alignment", range: "60–79", description: "Macro is broadly supportive." },
      { label: "Strong Alignment", range: "80–100", description: "Macro is a clear tailwind." },
    ],
    watchNext: (_v) => "Watch for a regime shift (Pressure Index moving above 65 or below 35) that could change the alignment score significantly.",
    historicalContext: () => null,
    color: (v) => {
      if (v >= 80) return "#00FF88";
      if (v >= 60) return "#00D4FF";
      if (v >= 40) return "#FFD700";
      if (v >= 20) return "#FF6B35";
      return "#FF2D55";
    },
  },

  liquidityStress: {
    label: "Liquidity Stress",
    shortLabel: "Liquidity",
    learnMorePath: "/learn/what-is-liquidity",
    statusLabel: (v) => {
      if (v >= 75) return "Severe Liquidity Stress";
      if (v >= 55) return "Elevated Liquidity Stress";
      if (v >= 35) return "Moderate Liquidity Stress";
      return "Healthy Liquidity";
    },
    meaning: (v) => {
      if (v >= 75) return "Liquidity conditions are severely stressed. Market depth is thin, bid-ask spreads are wide, and funding markets are showing signs of strain.";
      if (v >= 55) return "Liquidity is tightening. Market functioning is becoming less smooth, which historically precedes broader market stress.";
      if (v >= 35) return "Liquidity shows moderate stress. Some tightening is present but markets are still functioning normally.";
      return "Liquidity conditions are healthy. Markets are functioning smoothly with normal depth and tight spreads.";
    },
    measures: "Liquidity Stress measures the availability and cost of liquidity in financial markets, including funding market conditions, bid-ask spreads, and market depth indicators.",
    howCalculated: "Derived from FRED data on financial conditions indices, repo market rates, and Treasury market liquidity proxies.",
    whyItMatters: "Liquidity is the lifeblood of markets. When liquidity dries up, even fundamentally sound assets can sell off sharply. Liquidity stress often precedes broader market dislocations.",
    ranges: [
      { label: "Healthy", range: "0–34", description: "Normal market functioning. Liquidity is not a concern." },
      { label: "Moderate Stress", range: "35–54", description: "Some tightening. Monitor for escalation." },
      { label: "Elevated Stress", range: "55–74", description: "Meaningful tightening. Reduce leverage and illiquid exposures." },
      { label: "Severe Stress", range: "75–100", description: "Crisis-level liquidity conditions. Capital preservation priority." },
    ],
    watchNext: (_v) => "Watch repo rates, the Fed's balance sheet actions, and financial conditions indices for signs of improvement or further deterioration.",
    historicalContext: (pct, analog) => {
      if (pct === undefined && !analog) return null;
      const parts: string[] = [];
      if (pct !== undefined) parts.push(`Tighter than ${pct}% of liquidity readings since 2008.`);
      if (analog) parts.push(`Most comparable to ${analog}.`);
      return parts.join(" ");
    },
    color: (v) => {
      if (v >= 75) return "#FF2D55";
      if (v >= 55) return "#FF6B35";
      if (v >= 35) return "#FFD700";
      return "#00FF88";
    },
  },

  creditStress: {
    label: "Credit Market Stress",
    shortLabel: "Credit Stress",
    learnMorePath: "/learn/credit-spreads",
    statusLabel: (v) => {
      if (v >= 75) return "Severe Credit Stress";
      if (v >= 55) return "Elevated Credit Stress";
      if (v >= 35) return "Moderate Credit Stress";
      return "Healthy Credit";
    },
    meaning: (v) => {
      if (v >= 75) return "Credit markets are under severe stress. Spreads are wide, indicating that lenders are demanding significant risk premiums — a historically reliable warning signal.";
      if (v >= 55) return "Credit spreads are elevated and widening. This historically precedes equity market stress by days to weeks.";
      if (v >= 35) return "Credit markets show moderate stress. Spreads are above normal but not yet at alarming levels.";
      return "Credit markets are healthy. Spreads are tight, indicating normal risk appetite and healthy corporate funding conditions.";
    },
    measures: "Credit Market Stress tracks the spread between corporate bond yields and risk-free Treasury yields. Wider spreads indicate that investors are demanding more compensation for credit risk — a sign of stress.",
    howCalculated: "Based on investment-grade and high-yield credit spread data from FRED, normalized against historical ranges.",
    whyItMatters: "Credit markets often lead equity markets. When credit spreads widen sharply, it signals that sophisticated institutional investors are pricing in higher default and stress risk — often before equity markets react.",
    ranges: [
      { label: "Healthy Credit", range: "0–34", description: "Tight spreads. Normal risk appetite." },
      { label: "Moderate Stress", range: "35–54", description: "Spreads above normal. Monitor closely." },
      { label: "Elevated Stress", range: "55–74", description: "Spreads widening. Equity stress likely to follow." },
      { label: "Severe Stress", range: "75–100", description: "Crisis-level spreads. Significant dislocation risk." },
    ],
    watchNext: (_v) => "Watch investment-grade and high-yield credit spreads daily. A move above recent highs would be a significant warning signal. Narrowing spreads would suggest improving conditions.",
    historicalContext: (pct, analog) => {
      if (pct === undefined && !analog) return null;
      const parts: string[] = [];
      if (pct !== undefined) parts.push(`Wider than ${pct}% of credit spread readings since 2000.`);
      if (analog) parts.push(`Most comparable to ${analog}.`);
      return parts.join(" ");
    },
    color: (v) => {
      if (v >= 75) return "#FF2D55";
      if (v >= 55) return "#FF6B35";
      if (v >= 35) return "#FFD700";
      return "#00FF88";
    },
  },

  volatilityRegime: {
    label: "Volatility Regime",
    shortLabel: "Volatility",
    learnMorePath: "/learn/how-to-read-stock-market",
    statusLabel: (v) => {
      if (v >= 75) return "Extreme Volatility";
      if (v >= 55) return "High Volatility";
      if (v >= 35) return "Elevated Volatility";
      return "Low Volatility";
    },
    meaning: (v) => {
      if (v >= 75) return "Volatility is at extreme levels. Large daily price swings are expected. Options are expensive and risk management is critical.";
      if (v >= 55) return "Volatility is high. Markets are moving more than normal. Position sizing should reflect the increased uncertainty.";
      if (v >= 35) return "Volatility is above average. Some caution is warranted but conditions are not yet extreme.";
      return "Volatility is low. Markets are calm. This can be a sign of complacency — watch for sudden spikes.";
    },
    measures: "Volatility Regime tracks implied and realized volatility across equity markets, normalized against historical ranges.",
    howCalculated: "Based on VIX levels, VIX term structure, and realized volatility, normalized against long-term historical distributions.",
    whyItMatters: "Volatility directly affects position sizing, options pricing, and the risk of stop-outs. High volatility environments require smaller positions and wider stops.",
    ranges: [
      { label: "Low Volatility", range: "0–34", description: "Calm markets. Watch for complacency." },
      { label: "Elevated Volatility", range: "35–54", description: "Above-average moves. Adjust position sizes." },
      { label: "High Volatility", range: "55–74", description: "Significant daily swings. Reduce leverage." },
      { label: "Extreme Volatility", range: "75–100", description: "Crisis-level volatility. Minimum position sizes." },
    ],
    watchNext: (_v) => "Watch the VIX term structure for signs of normalization (contango returning) or further stress (backwardation deepening). A VIX above 30 historically signals elevated systemic risk.",
    historicalContext: (pct, analog) => {
      if (pct === undefined && !analog) return null;
      const parts: string[] = [];
      if (pct !== undefined) parts.push(`Higher than ${pct}% of volatility readings since 2000.`);
      if (analog) parts.push(`Most comparable to ${analog}.`);
      return parts.join(" ");
    },
    color: (v) => {
      if (v >= 75) return "#FF2D55";
      if (v >= 55) return "#FF6B35";
      if (v >= 35) return "#FFD700";
      return "#00D4FF";
    },
  },

  aiConcentration: {
    label: "AI Sector Concentration Risk",
    shortLabel: "AI Concentration",
    learnMorePath: "/learn/macro-investing",
    statusLabel: (v) => {
      if (v >= 75) return "Extreme Concentration";
      if (v >= 55) return "High Concentration";
      if (v >= 35) return "Elevated Concentration";
      return "Normal Concentration";
    },
    meaning: (v) => {
      if (v >= 75) return "AI and mega-cap tech concentration in the index is at extreme levels. A reversal in this sector would have an outsized impact on broad market returns.";
      if (v >= 55) return "AI sector concentration is high. The market's performance is increasingly dependent on a small number of large-cap tech names.";
      if (v >= 35) return "Concentration is above historical norms but not yet at extreme levels.";
      return "Market concentration is within normal historical ranges.";
    },
    measures: "AI Concentration Risk measures the degree to which a small number of AI and mega-cap technology stocks dominate index returns and market capitalization.",
    howCalculated: "Based on the top-10 concentration of major indices, AI sector weighting, and historical comparison against prior concentration peaks.",
    whyItMatters: "High concentration means that the performance of the entire market depends on a handful of stocks. When these stocks correct, the impact on broad indices is amplified.",
    ranges: [
      { label: "Normal", range: "0–34", description: "Healthy diversification across sectors." },
      { label: "Elevated", range: "35–54", description: "Above-average concentration. Monitor for rotation." },
      { label: "High", range: "55–74", description: "Significant concentration risk. Sector rotation could be disruptive." },
      { label: "Extreme", range: "75–100", description: "Historically extreme concentration. High vulnerability to sector-specific shocks." },
    ],
    watchNext: (_v) => "Watch for any earnings disappointments or valuation compression in the top AI names, as these would have an outsized impact on broad market indices.",
    historicalContext: (pct, analog) => {
      if (pct !== undefined) return `Higher than ${pct}% of concentration readings in the past 7 years.`;
      return null;
    },
    color: (v) => {
      if (v >= 75) return "#FF2D55";
      if (v >= 55) return "#FF6B35";
      if (v >= 35) return "#FFD700";
      return "#00D4FF";
    },
  },

  breadthHealth: {
    label: "Market Breadth Health",
    shortLabel: "Breadth Health",
    learnMorePath: "/learn/how-to-read-stock-market",
    statusLabel: (v) => {
      if (v >= 70) return "Strong Breadth";
      if (v >= 50) return "Healthy Breadth";
      if (v >= 30) return "Weakening Breadth";
      return "Poor Breadth";
    },
    meaning: (v) => {
      if (v >= 70) return "Market breadth is strong. The majority of stocks are participating in the current move, suggesting broad-based health.";
      if (v >= 50) return "Breadth is healthy. Most sectors and stocks are broadly aligned with the market direction.";
      if (v >= 30) return "Breadth is weakening. Fewer stocks are participating, which historically precedes broader market weakness.";
      return "Breadth is poor. The market's performance is being driven by a small number of stocks while the majority are declining — a historically bearish signal.";
    },
    measures: "Market Breadth Health measures the percentage of stocks participating in the current market move, including advance/decline ratios, new highs vs. new lows, and percentage of stocks above key moving averages.",
    howCalculated: "Composite of advance/decline data, new 52-week highs vs. lows, and percentage of S&P 500 stocks above their 200-day moving average.",
    whyItMatters: "Markets that rise on narrow breadth are historically more vulnerable to sharp reversals. Broad participation is a sign of genuine strength; narrow participation is a warning sign.",
    ranges: [
      { label: "Poor Breadth", range: "0–29", description: "Very narrow market. High vulnerability to reversal." },
      { label: "Weakening", range: "30–49", description: "Breadth deteriorating. Watch for confirmation of weakness." },
      { label: "Healthy", range: "50–69", description: "Broad participation. Normal conditions." },
      { label: "Strong", range: "70–100", description: "Exceptional breadth. Historically bullish." },
    ],
    watchNext: (_v) => "Watch the percentage of S&P 500 stocks above their 200-day moving average and the advance/decline line for confirmation of the current trend.",
    historicalContext: (pct, analog) => {
      if (pct !== undefined) return `Stronger than ${pct}% of breadth readings since 2000.`;
      return null;
    },
    color: (v) => {
      if (v >= 70) return "#00FF88";
      if (v >= 50) return "#00D4FF";
      if (v >= 30) return "#FFD700";
      return "#FF2D55";
    },
  },

  macroRegime: {
    label: "Macro Regime Pressure",
    shortLabel: "Macro Regime",
    learnMorePath: "/learn/macro-investing",
    statusLabel: (v) => {
      if (v >= 75) return "Severe Macro Stress";
      if (v >= 55) return "Elevated Macro Stress";
      if (v >= 35) return "Moderate Macro Stress";
      return "Supportive Macro";
    },
    meaning: (v) => {
      if (v >= 75) return "The macro environment is severely stressed. Inflation, Fed policy, and recession risk are all working against risk assets simultaneously.";
      if (v >= 55) return "Macro conditions are elevated stress. The combination of inflation trajectory, Fed policy stance, and growth signals is unfavorable for risk assets.";
      if (v >= 35) return "Macro conditions show moderate stress. Some headwinds are present but the overall environment is not yet hostile.";
      return "The macro environment is broadly supportive. Inflation, Fed policy, and growth signals are aligned in a way that historically supports risk assets.";
    },
    measures: "Macro Regime Pressure aggregates inflation trajectory, Federal Reserve policy stance, recession probability, and leading economic indicators into a single macro stress score.",
    howCalculated: "Based on CPI trends, Fed funds rate vs. neutral rate, yield curve shape, and leading economic indicator momentum.",
    whyItMatters: "The macro regime is the single most important determinant of long-term market direction. Understanding the macro environment helps investors align their strategy with the dominant force driving markets.",
    ranges: [
      { label: "Supportive Macro", range: "0–34", description: "Macro tailwinds. Risk assets historically outperform." },
      { label: "Moderate Stress", range: "35–54", description: "Mixed macro signals. Selectivity matters." },
      { label: "Elevated Stress", range: "55–74", description: "Macro headwinds. Defensive positioning warranted." },
      { label: "Severe Stress", range: "75–100", description: "Hostile macro environment. Capital preservation priority." },
    ],
    watchNext: (_v) => "Watch CPI releases, Fed meeting outcomes, and leading economic indicators (ISM, PMI) for signals of macro regime change.",
    historicalContext: (pct, analog) => {
      if (pct !== undefined) return `More stressed than ${pct}% of macro readings since 2000.`;
      if (analog) return `Most comparable to macro conditions during ${analog}.`;
      return null;
    },
    color: (v) => {
      if (v >= 75) return "#FF2D55";
      if (v >= 55) return "#FF6B35";
      if (v >= 35) return "#FFD700";
      return "#00FF88";
    },
  },

  treasuryStress: {
    label: "Treasury Market Stress",
    shortLabel: "Treasury Stress",
    learnMorePath: "/learn/treasury-yields",
    statusLabel: (v) => {
      if (v >= 75) return "Severe Treasury Stress";
      if (v >= 55) return "Elevated Treasury Stress";
      if (v >= 35) return "Moderate Treasury Stress";
      return "Stable Treasury Market";
    },
    meaning: (v) => {
      if (v >= 75) return "Treasury markets are under severe stress. Volatility in the world's largest bond market is at crisis levels, which historically creates systemic risk across all asset classes.";
      if (v >= 55) return "Treasury market stress is elevated. Yield volatility and term premium are rising, creating headwinds for risk assets.";
      if (v >= 35) return "Treasury markets show moderate stress. Some volatility is present but conditions are not yet alarming.";
      return "Treasury markets are stable. Yield volatility is low and the term structure is functioning normally.";
    },
    measures: "Treasury Market Stress tracks volatility in U.S. Treasury markets, including yield volatility (MOVE Index), term premium, and bid-ask spreads in Treasury markets.",
    howCalculated: "Based on the MOVE Index (Treasury volatility), 10-year yield changes, and term premium estimates from FRED.",
    whyItMatters: "The U.S. Treasury market is the foundation of global finance. When it becomes stressed, the ripple effects are felt across all asset classes — equities, credit, and currencies.",
    ranges: [
      { label: "Stable", range: "0–34", description: "Normal Treasury market functioning." },
      { label: "Moderate Stress", range: "35–54", description: "Above-average yield volatility. Monitor." },
      { label: "Elevated Stress", range: "55–74", description: "Significant Treasury volatility. Risk-off signals." },
      { label: "Severe Stress", range: "75–100", description: "Crisis-level Treasury stress. Systemic risk elevated." },
    ],
    watchNext: (_v) => "Watch the MOVE Index, 10-year Treasury yield, and the 2s10s yield curve for signs of normalization or further stress.",
    historicalContext: (pct, analog) => {
      if (pct !== undefined) return `Higher than ${pct}% of Treasury stress readings since 2008.`;
      if (analog) return `Most comparable to Treasury conditions during ${analog}.`;
      return null;
    },
    color: (v) => {
      if (v >= 75) return "#FF2D55";
      if (v >= 55) return "#FF6B35";
      if (v >= 35) return "#FFD700";
      return "#00D4FF";
    },
  },
};

// ── Trend helpers ─────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: ScoreTrend }) {
  if (trend === "rising") return <TrendingUp className="w-3.5 h-3.5" />;
  if (trend === "falling") return <TrendingDown className="w-3.5 h-3.5" />;
  return <Minus className="w-3.5 h-3.5" />;
}

function trendLabel(trend: ScoreTrend): string {
  if (trend === "rising") return "Rising";
  if (trend === "falling") return "Falling";
  return "Stable";
}

function trendColor(trend: ScoreTrend, scoreKey: ScoreKey): string {
  // For scores where "rising" is bad (stress scores), rising = red
  const stressScores: ScoreKey[] = [
    "pressureIndex", "marketRisk", "crashRisk", "liquidityStress",
    "creditStress", "volatilityRegime", "aiConcentration", "treasuryStress", "macroRegime",
  ];
  const isStress = stressScores.includes(scoreKey);
  if (trend === "rising") return isStress ? "#FF6B35" : "#00FF88";
  if (trend === "falling") return isStress ? "#00FF88" : "#FF6B35";
  return "#94A3B8";
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ScoreExplainer({
  scoreKey,
  value,
  trend,
  drivers,
  historicalPercentile,
  historicalAnalog,
  trendDays,
  defaultExpanded = false,
  accentColor,
  compact = false,
}: ScoreExplainerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [learnOpen, setLearnOpen] = useState(false);

  const meta = SCORE_REGISTRY[scoreKey];
  if (!meta) return null;

  const color = accentColor ?? meta.color(value);
  const statusLabel = meta.statusLabel(value);
  const meaning = meta.meaning(value);
  const watchNext = meta.watchNext(value, drivers);
  const histContext = meta.historicalContext(historicalPercentile, historicalAnalog);
  const trendC = trend ? trendColor(trend, scoreKey) : "#94A3B8";

  if (compact) {
    return (
      <span
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          cursor: "pointer",
          color,
          fontSize: "11px",
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: "0.05em",
        }}
        title={`${statusLabel} — click for full explanation`}
      >
        <Info className="w-3 h-3" style={{ opacity: 0.7 }} />
        {statusLabel}
      </span>
    );
  }

  return (
    <div
      style={{
        background: "rgba(10,21,32,0.7)",
        border: `1px solid ${color}22`,
        borderRadius: "10px",
        overflow: "hidden",
        transition: "border-color 0.2s ease",
      }}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          {/* Status badge */}
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              fontWeight: 600,
              color,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {statusLabel}
          </span>
          {/* Trend pill */}
          {trend && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                background: `${trendC}18`,
                border: `1px solid ${trendC}30`,
                borderRadius: "4px",
                padding: "1px 6px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                color: trendC,
                whiteSpace: "nowrap",
              }}
            >
              <TrendIcon trend={trend} />
              {trendLabel(trend)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.08em" }}>
            {expanded ? "LESS" : "EXPLAIN"}
          </span>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "rgba(100,116,139,0.5)" }} />
            : <ChevronDown className="w-3.5 h-3.5" style={{ color: "rgba(100,116,139,0.5)" }} />
          }
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div
          style={{
            padding: "0 14px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            animation: "scoreExpand 0.2s cubic-bezier(0.23,1,0.32,1)",
          }}
        >
          <style>{`
            @keyframes scoreExpand {
              from { opacity: 0; transform: translateY(-4px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Divider */}
          <div style={{ height: "1px", background: `${color}18` }} />

          {/* One-sentence meaning */}
          <p style={{ margin: 0, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "rgba(226,232,240,0.85)", lineHeight: 1.6 }}>
            {meaning}
          </p>

          {/* Drivers */}
          {drivers && drivers.length > 0 && (
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>
                Primary Drivers
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {drivers.map((d) => (
                  <span
                    key={d}
                    style={{
                      background: `${color}12`,
                      border: `1px solid ${color}25`,
                      borderRadius: "4px",
                      padding: "2px 8px",
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "10px",
                      color: `${color}CC`,
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Trend direction */}
          {trend && (
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "4px" }}>
                Trend
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: trendC, fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>
                <TrendIcon trend={trend} />
                <span>{trendLabel(trend)}</span>
                {trendDays && trendDays > 1 && (
                  <span style={{ color: "rgba(100,116,139,0.6)", fontSize: "10px" }}>
                    — {trendDays} consecutive trading {trendDays === 1 ? "day" : "days"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Historical context */}
          {histContext && (
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "4px" }}>
                Historical Context
              </div>
              <p style={{ margin: 0, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "rgba(148,163,184,0.75)", lineHeight: 1.5 }}>
                {histContext}
              </p>
            </div>
          )}

          {/* What to watch */}
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "4px" }}>
              What Could Change This?
            </div>
            <p style={{ margin: 0, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "rgba(148,163,184,0.75)", lineHeight: 1.5 }}>
              {watchNext}
            </p>
          </div>

          {/* Learn More */}
          {meta.learnMorePath && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px" }}>
              <Link href={meta.learnMorePath}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "10px",
                    color: color,
                    opacity: 0.8,
                    cursor: "pointer",
                    textDecoration: "none",
                    letterSpacing: "0.08em",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
                >
                  <BookOpen className="w-3 h-3" />
                  Learn More →
                </span>
              </Link>
              {/* Score range legend toggle */}
              <button
                onClick={() => setLearnOpen(!learnOpen)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  color: "rgba(100,116,139,0.5)",
                  letterSpacing: "0.08em",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                Score Ranges {learnOpen ? "▲" : "▼"}
              </button>
            </div>
          )}

          {/* Score range legend */}
          {learnOpen && (
            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "6px",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {meta.ranges.map((r) => (
                <div key={r.label} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)", whiteSpace: "nowrap", minWidth: "50px" }}>
                    {r.range}
                  </span>
                  <div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(226,232,240,0.7)", fontWeight: 600 }}>
                      {r.label}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "10px", color: "rgba(100,116,139,0.65)", marginLeft: "6px" }}>
                      {r.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Convenience: inline status label only ────────────────────────────────────

export function ScoreStatusLabel({
  scoreKey,
  value,
  style,
}: {
  scoreKey: ScoreKey;
  value: number;
  style?: React.CSSProperties;
}) {
  const meta = SCORE_REGISTRY[scoreKey];
  if (!meta) return null;
  const color = meta.color(value);
  return (
    <span
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        fontWeight: 600,
        color,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {meta.statusLabel(value)}
    </span>
  );
}

export { SCORE_REGISTRY };
export default ScoreExplainer;
