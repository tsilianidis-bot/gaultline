/**
 * FAULTLINE TIME MACHINE™ — Historical Truth Engine
 *
 * Lets users choose any market period (2000-01 to present) and see what
 * FAULTLINE would have known using only information available at the time.
 * Powered by the pressureHistory table (317 monthly rows, 2000–present).
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getPressureHistory } from "../db";

// ── Curated historical periods for the period picker ──────────────────────────
export const HISTORICAL_PERIODS = [
  {
    id: "dot-com-peak",
    label: "Dot-Com Peak",
    startMonth: "1999-06",
    endMonth: "2001-12",
    peakMonth: "2000-03",
    description: "The NASDAQ peaked in March 2000. What did the pressure engine see in the months before the crash?",
    outcome: "NASDAQ fell 78% from peak to trough. S&P 500 lost 49%. The bear market lasted 31 months.",
    category: "Equity Crash",
  },
  {
    id: "housing-bubble",
    label: "Housing Bubble",
    startMonth: "2005-01",
    endMonth: "2007-06",
    peakMonth: "2006-04",
    description: "Housing prices peaked in 2006. Credit spreads were historically tight. What was the pressure engine reading?",
    outcome: "The S&P/Case-Shiller Index fell 33% from peak. Subprime defaults began accelerating in 2007.",
    category: "Credit Cycle",
  },
  {
    id: "gfc-collapse",
    label: "2008 Financial Crisis",
    startMonth: "2007-06",
    endMonth: "2009-06",
    peakMonth: "2008-09",
    description: "Lehman Brothers filed for bankruptcy on September 15, 2008. What did the pressure engine see in the months before?",
    outcome: "S&P 500 fell 57% from peak. Global credit markets froze. The Fed cut rates to zero. TARP was passed.",
    category: "Systemic Crisis",
  },
  {
    id: "covid-crash",
    label: "COVID Crash",
    startMonth: "2019-10",
    endMonth: "2020-08",
    peakMonth: "2020-03",
    description: "Markets fell 34% in 33 days in February–March 2020. What did the pressure engine see before and during the crash?",
    outcome: "The fastest bear market in history. The Fed cut to zero and launched $3T in QE. Markets recovered in 5 months.",
    category: "Exogenous Shock",
  },
  {
    id: "fed-rate-shock",
    label: "2022 Fed Rate Shock",
    startMonth: "2021-06",
    endMonth: "2023-01",
    peakMonth: "2022-06",
    description: "The Fed raised rates 525bps in 18 months — the fastest tightening cycle in 40 years. What did the pressure engine see?",
    outcome: "S&P 500 fell 25%. NASDAQ fell 33%. Bonds had their worst year since 1788. Rate-sensitive sectors collapsed.",
    category: "Monetary Tightening",
  },
  {
    id: "ai-concentration",
    label: "AI Concentration Risk",
    startMonth: "2023-01",
    endMonth: "2025-06",
    peakMonth: "2024-07",
    description: "The Magnificent 7 drove 60%+ of S&P 500 returns. Market breadth collapsed. What did the pressure engine see?",
    outcome: "Concentration risk reached levels not seen since the Dot-Com bubble. Breadth divergence widened throughout 2024.",
    category: "Structural Risk",
  },
] as const;

export type HistoricalPeriodId = typeof HISTORICAL_PERIODS[number]["id"];

// ── Regime color mapping ───────────────────────────────────────────────────────
export function regimeColor(regime: string): string {
  if (regime.includes("CRITICAL")) return "#FF3B30";
  if (regime.includes("HIGH")) return "#FF6B35";
  if (regime.includes("ELEVATED")) return "#FFB800";
  if (regime.includes("MODERATE")) return "#00E5FF";
  return "#00FF88";
}

// ── Router ────────────────────────────────────────────────────────────────────
export const timeMachineRouter = router({
  /**
   * Returns the list of curated historical periods for the period picker.
   * Public — accessible without authentication for marketing/trust purposes.
   */
  getPeriods: publicProcedure.query(() => {
    return HISTORICAL_PERIODS.map(p => ({
      id: p.id,
      label: p.label,
      startMonth: p.startMonth,
      endMonth: p.endMonth,
      peakMonth: p.peakMonth,
      description: p.description,
      outcome: p.outcome,
      category: p.category,
    }));
  }),

  /**
   * Returns the full pressure timeline for a given period.
   * Includes month-by-month pressure readings, regime labels, and domain scores.
   * Public — the historical record is a transparency/trust feature.
   */
  getPeriodData: publicProcedure
    .input(z.object({
      periodId: z.string().optional(),
      startMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      endMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }))
    .query(async ({ input }) => {
      let startMonth: string;
      let endMonth: string;
      let period: typeof HISTORICAL_PERIODS[number] | undefined;

      if (input.periodId) {
        period = HISTORICAL_PERIODS.find(p => p.id === input.periodId);
        if (!period) throw new Error(`Unknown period: ${input.periodId}`);
        startMonth = period.startMonth;
        endMonth = period.endMonth;
      } else if (input.startMonth && input.endMonth) {
        startMonth = input.startMonth;
        endMonth = input.endMonth;
      } else {
        // Default to GFC
        period = HISTORICAL_PERIODS.find(p => p.id === "gfc-collapse")!;
        startMonth = period.startMonth;
        endMonth = period.endMonth;
      }

      const rows = await getPressureHistory({ startMonth, endMonth });

      if (!rows.length) {
        return {
          period: period ?? null,
          timeline: [],
          peakReading: null,
          firstWarningMonth: null,
          regimeChanges: [],
          stats: null,
        };
      }

      // Build timeline
      const timeline = rows.map(r => ({
        month: r.month,
        overallPressure: r.overallPressure,
        regime: r.regime,
        regimeColor: regimeColor(r.regime),
        liquidityStress: r.liquidityStress ?? null,
        creditContagion: r.creditContagion ?? null,
        volatilityRegime: r.volatilityRegime ?? null,
        macroSensitivity: r.macroSensitivity ?? null,
        marketBreadth: r.marketBreadth ?? null,
        // Raw macro indicators
        baaSpread: r.baaSpread ? Number(r.baaSpread) : null,
        hySpreadProxy: r.hySpreadProxy ? Number(r.hySpreadProxy) : null,
        tsy10y: r.tsy10y ? Number(r.tsy10y) : null,
        tsy2y: r.tsy2y ? Number(r.tsy2y) : null,
        fedfunds: r.fedfunds ? Number(r.fedfunds) : null,
        cpiYoy: r.cpiYoy ? Number(r.cpiYoy) : null,
        unemployment: r.unemployment ? Number(r.unemployment) : null,
        sp500: r.sp500 ? Number(r.sp500) : null,
      }));

      // Find peak reading
      const peakReading = timeline.reduce((max, r) =>
        r.overallPressure > max.overallPressure ? r : max, timeline[0]);

      // Find first warning month (first month where pressure > 60 = ELEVATED or higher)
      const firstWarningMonth = timeline.find(r => r.overallPressure >= 60)?.month ?? null;

      // Detect regime changes
      const regimeChanges: { month: string; from: string; to: string }[] = [];
      for (let i = 1; i < timeline.length; i++) {
        if (timeline[i].regime !== timeline[i - 1].regime) {
          regimeChanges.push({
            month: timeline[i].month,
            from: timeline[i - 1].regime,
            to: timeline[i].regime,
          });
        }
      }

      // Summary stats
      const pressures = timeline.map(r => r.overallPressure);
      const stats = {
        minPressure: Math.min(...pressures),
        maxPressure: Math.max(...pressures),
        avgPressure: Math.round(pressures.reduce((a, b) => a + b, 0) / pressures.length),
        monthsAbove60: pressures.filter(p => p >= 60).length,
        monthsAbove80: pressures.filter(p => p >= 80).length,
        totalMonths: timeline.length,
      };

      return {
        period: period ?? { id: "custom", label: "Custom Period", startMonth, endMonth, peakMonth: peakReading.month, description: "", outcome: "", category: "Custom" },
        timeline,
        peakReading,
        firstWarningMonth,
        regimeChanges,
        stats,
      };
    }),

  /**
   * Returns all available months in the pressureHistory table.
   * Used to populate the custom date range picker.
   */
  getAvailableMonths: publicProcedure.query(async () => {
    const rows = await getPressureHistory({});
    return {
      months: rows.map(r => r.month),
      earliest: rows[0]?.month ?? "2000-01",
      latest: rows[rows.length - 1]?.month ?? "2025-12",
    };
  }),
});
