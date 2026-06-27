// ============================================================
// FMOS Engine 9 — Historical Analog Engine (Unified)
// (server/fmos/engines/historicalAnalog.ts)
//
// Finds the most similar historical market periods to current
// conditions using multi-dimensional vector similarity.
//
// This engine UNIFIES two incompatible HistoricalAnalog
// implementations:
//   - pressure/engine.ts: uses year + description, 4-vector fingerprint
//   - tradePreflight.ts:  uses period + outcome, 3-vector fingerprint
//
// The unified FMOSHistoricalAnalog type includes all fields.
// Similarity is computed using Euclidean distance on the
// 5-vector fingerprint: [liquidity, credit, macro, volatility, ai]
//
// Inputs:
//   - FaultlinePressureOutput (from pressure/engine.ts)
//
// Output: FMOSHistoricalAnalog[]
// ============================================================

import { euclideanDistance, distanceToSimilarity, clamp } from "../utils";
import type { FaultlinePressureOutput } from "../../pressure/engine";
import type { FMOSHistoricalAnalog } from "../types";

// ── Analog Database ───────────────────────────────────────────

interface AnalogRecord {
  year: number;
  label: string;
  period: string;
  description: string;
  outcome: string;
  similarities: string[];
  differences: string[];
  typicalDuration: string;
  historicalRisks: string[];
  /** 5-vector fingerprint: [liquidity, credit, macro, volatility, ai] */
  fingerprint: [number, number, number, number, number];
}

const ANALOG_DATABASE: AnalogRecord[] = [
  {
    year: 2000,
    label: "Dot-Com Bubble",
    period: "Mar 2000 – Oct 2002",
    description: "Tech concentration peaked, valuations extreme, Fed tightening cycle underway",
    outcome: "NASDAQ fell -78%, S&P 500 -49% over 2.5 years. Tech sector took a decade to recover. Defensive positioning and value stocks outperformed significantly.",
    similarities: ["Narrow AI/tech leadership", "Extreme valuations", "Fed tightening"],
    differences: ["No credit crisis", "Banking system healthy", "No systemic liquidity stress"],
    typicalDuration: "18–30 months",
    historicalRisks: ["Valuation mean reversion", "Earnings disappointment", "Sentiment collapse"],
    fingerprint: [25, 30, 55, 45, 90],
  },
  {
    year: 2008,
    label: "Global Financial Crisis",
    period: "Sep 2008 – Mar 2009",
    description: "Credit contagion from housing, liquidity freeze, systemic bank stress",
    outcome: "S&P 500 fell -57% from peak. Credit markets froze. Fed emergency intervention. Recovery took 4+ years to new highs.",
    similarities: ["Credit contagion risk", "Liquidity stress", "Systemic pressure elevated"],
    differences: ["No housing bubble today", "Banks better capitalized", "Different credit structure"],
    typicalDuration: "12–18 months",
    historicalRisks: ["Credit cascade", "Bank failures", "Liquidity freeze", "Recession"],
    fingerprint: [90, 95, 60, 80, 20],
  },
  {
    year: 2020,
    label: "COVID Shock",
    period: "Feb 2020 – Apr 2020",
    description: "Sudden liquidity crisis, credit dislocation, rapid Fed response",
    outcome: "S&P 500 fell -34% in 33 days. Fed injected $3T+ in liquidity. Market recovered to new highs within 5 months.",
    similarities: ["Sudden liquidity stress", "Credit dislocation", "Volatility spike"],
    differences: ["External shock (not financial)", "Fed had unlimited firepower", "Fiscal stimulus massive"],
    typicalDuration: "1–3 months (with intervention)",
    historicalRisks: ["Liquidity freeze", "Credit cascade", "Earnings collapse"],
    fingerprint: [85, 80, 40, 90, 30],
  },
  {
    year: 2022,
    label: "Rates Shock",
    period: "Jan 2022 – Oct 2022",
    description: "Fastest Fed tightening in 40 years, inflation surge, bond market selloff",
    outcome: "S&P 500 fell -25%, bonds fell -20% (worst bond year in history). Cash and commodities outperformed. Recovery began when Fed signaled pivot.",
    similarities: ["High macro sensitivity", "Fed tightening", "Yield curve stress"],
    differences: ["No credit crisis", "Employment remained strong", "Different inflation driver"],
    typicalDuration: "9–12 months",
    historicalRisks: ["Duration risk", "Earnings multiple compression", "Recession risk"],
    fingerprint: [40, 45, 90, 55, 50],
  },
  {
    year: 1998,
    label: "LTCM / Russia Crisis",
    period: "Aug 1998 – Oct 1998",
    description: "Liquidity crisis from leverage unwind, credit spreads spiked briefly",
    outcome: "S&P 500 fell -19% in 2 months before recovering. Fed cut rates. LTCM bailed out. Markets recovered to new highs within 6 months.",
    similarities: ["Liquidity stress", "Credit spread widening", "Leverage unwind risk"],
    differences: ["Contained to specific sectors", "Fed had room to cut", "No systemic bank risk"],
    typicalDuration: "2–4 months",
    historicalRisks: ["Leverage unwind cascade", "Credit spread spike", "Contagion to EM"],
    fingerprint: [70, 65, 35, 60, 20],
  },
  {
    year: 1973,
    label: "1970s Stagflation",
    period: "1973 – 1982",
    description: "Oil shock, high inflation, recession — macro sensitivity extreme",
    outcome: "S&P 500 fell -48% in real terms. Commodities and energy massively outperformed. Gold rose 10x. Fixed income destroyed by inflation.",
    similarities: ["High macro sensitivity", "Inflation elevated", "Policy constraints"],
    differences: ["No AI bubble", "Different energy structure", "Different monetary framework"],
    typicalDuration: "3–5 years",
    historicalRisks: ["Inflation spiral", "Real return destruction", "Policy error"],
    fingerprint: [50, 55, 95, 40, 10],
  },
  {
    year: 2015,
    label: "China Shock / EM Crisis",
    period: "Aug 2015 – Feb 2016",
    description: "China devaluation, EM stress, commodity collapse, credit spreads widened",
    outcome: "S&P 500 fell -12% in 2 weeks before recovering. EM markets fell -30%+. Defensive positioning reduced drawdown significantly.",
    similarities: ["Credit spread widening", "Macro sensitivity elevated", "Volatility spike"],
    differences: ["US fundamentals solid", "No domestic credit crisis", "Fed on hold"],
    typicalDuration: "3–6 months",
    historicalRisks: ["EM contagion", "Credit spread widening", "Commodity deflation"],
    fingerprint: [55, 60, 65, 65, 35],
  },
  {
    year: 2011,
    label: "European Debt Crisis",
    period: "Apr 2011 – Oct 2011",
    description: "Eurozone sovereign debt crisis, US debt ceiling standoff, credit stress",
    outcome: "S&P 500 fell -19%. Credit spreads spiked. ECB intervention eventually resolved the crisis. Markets recovered within 12 months.",
    similarities: ["Credit contagion risk", "Macro headwinds", "Liquidity stress"],
    differences: ["Eurozone-specific", "US economy recovering", "Fed had QE tools"],
    typicalDuration: "6–12 months",
    historicalRisks: ["Sovereign credit cascade", "Bank stress", "Recession in Europe"],
    fingerprint: [65, 70, 55, 60, 15],
  },
  {
    year: 2019,
    label: "Fed Pivot Rally",
    period: "Jan 2019 – Jul 2019",
    description: "Fed reversed from hiking to cutting, trade war fears, but low systemic stress",
    outcome: "S&P 500 advanced +20% as Fed pivoted. Low pressure and improving breadth confirmed the move. Risk-on positioning was highly rewarded.",
    similarities: ["Low systemic pressure", "Improving liquidity", "Macro uncertainty"],
    differences: ["Fed pivoting dovish", "No credit crisis", "Employment strong"],
    typicalDuration: "6–12 months",
    historicalRisks: ["Trade war escalation", "Earnings miss", "Fed policy error"],
    fingerprint: [25, 25, 40, 25, 30],
  },
  {
    year: 2023,
    label: "Soft Landing Rally",
    period: "Oct 2023 – Dec 2023",
    description: "Inflation cooling, Fed signaling pivot, AI-driven tech rally",
    outcome: "S&P 500 advanced +15% in Q4 2023. AI theme drove mega-cap outperformance. Broad-based advance rewarded diversified risk-on positioning.",
    similarities: ["AI concentration", "Low credit stress", "Improving macro"],
    differences: ["Rates still elevated", "Narrow leadership initially", "Valuation stretched"],
    typicalDuration: "3–6 months",
    historicalRisks: ["Valuation stretch", "AI bubble risk", "Rates staying higher"],
    fingerprint: [20, 20, 30, 20, 75],
  },
];

// ── Similarity Computation ────────────────────────────────────

const MAX_DISTANCE = Math.sqrt(5 * 100 * 100); // max possible 5D Euclidean distance

function computeSimilarity(
  current: [number, number, number, number, number],
  fingerprint: [number, number, number, number, number]
): number {
  const dist = euclideanDistance(current, fingerprint);
  return distanceToSimilarity(dist, MAX_DISTANCE);
}

// ── Main Historical Analog Engine Function ────────────────────

/**
 * Find the most similar historical market periods to current conditions.
 *
 * @param pressure - Output from calculateFaultlinePressure()
 * @param topN     - Number of analogs to return (default: 3)
 */
export function computeHistoricalAnalogs(
  pressure: FaultlinePressureOutput,
  topN = 3
): FMOSHistoricalAnalog[] {
  const getVec = (id: string) => pressure.vectors.find(v => v.id === id)?.score ?? 30;

  const current: [number, number, number, number, number] = [
    getVec("liquidity-stress"),
    getVec("credit-contagion"),
    getVec("macro-sensitivity"),
    getVec("volatility-regime"),
    getVec("ai-bubble"),
  ];

  return ANALOG_DATABASE
    .map(analog => ({
      year: analog.year,
      label: analog.label,
      period: analog.period,
      description: analog.description,
      outcome: analog.outcome,
      similarities: analog.similarities,
      differences: analog.differences,
      typicalDuration: analog.typicalDuration,
      historicalRisks: analog.historicalRisks,
      similarity: computeSimilarity(current, analog.fingerprint),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

/**
 * Get the single best-matching historical analog.
 */
export function getTopAnalog(pressure: FaultlinePressureOutput): FMOSHistoricalAnalog {
  const analogs = computeHistoricalAnalogs(pressure, 1);
  return analogs[0] ?? {
    year: 2023,
    label: "No close analog",
    similarity: 0,
    description: "Current conditions do not closely match any historical analog in the database.",
    outcome: "Insufficient similarity for reliable analog comparison.",
  };
}
