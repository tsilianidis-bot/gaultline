/**
 * FAULTLINE — Intelligence Validation Center
 * server/routers/intelligenceValidation.ts
 *
 * Phase 7: 9 analytics procedures that measure, audit, and surface
 * the accuracy and improvement patterns of every FAULTLINE recommendation.
 *
 * All procedures are protected (require authentication).
 * All queries operate on the decision_ledger, improvement_lessons,
 * and ai_improvement_reports tables.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { decisionLedger, improvementLessons, aiImprovementReports, DecisionLedgerEntry } from "../../drizzle/schema";
import { eq, desc, and, gte, lte, isNotNull, sql } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute accuracy metrics from a set of resolved entries.
 * correct = 1pt, partially_correct = 0.5pt, incorrect = 0pt, still_active = 0pt
 */
function computeAccuracy(entries: DecisionLedgerEntry[]) {
  const resolved = entries.filter(e => e.outcome !== "pending");
  const correct = resolved.filter(e => e.outcome === "correct").length;
  const partial = resolved.filter(e => e.outcome === "partially_correct").length;
  const incorrect = resolved.filter(e => e.outcome === "incorrect").length;
  const stillActive = resolved.filter(e => e.outcome === "still_active").length;
  const pending = entries.filter(e => e.outcome === "pending").length;

  const winPoints = correct + partial * 0.5;
  const winRate = resolved.length > 0 ? Math.round((winPoints / resolved.length) * 100) : null;
  const strictAccuracy = resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : null;

  return { total: entries.length, resolved: resolved.length, pending, correct, partial, incorrect, stillActive, winRate, strictAccuracy };
}

/**
 * Get ISO week string from a Date: YYYY-Www
 */
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const intelligenceValidationRouter = router({

  /**
   * Overall validation statistics — the headline numbers.
   * Returns: total, resolved, pending, win rate, strict accuracy, trend vs prior period.
   */
  validationStats: protectedProcedure.query(async ({ ctx }) => {
    try {
    const db = await getDb();
    if (!db) return null;

    const entries = await db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.userId, ctx.user.id))
      .orderBy(desc(decisionLedger.createdAt));

    const stats = computeAccuracy(entries as DecisionLedgerEntry[]);

    // Trend: compare last 30 days vs prior 30 days
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 86400000);
    const sixtyDaysAgo = new Date(now - 60 * 86400000);

    const recent = (entries as DecisionLedgerEntry[]).filter(e => new Date(e.createdAt) >= thirtyDaysAgo);
    const prior = (entries as DecisionLedgerEntry[]).filter(e => new Date(e.createdAt) >= sixtyDaysAgo && new Date(e.createdAt) < thirtyDaysAgo);

    const recentStats = computeAccuracy(recent);
    const priorStats = computeAccuracy(prior);

    const trend = (recentStats.winRate !== null && priorStats.winRate !== null)
      ? recentStats.winRate - priorStats.winRate
      : null;

    // Average return % for resolved entries with returnPct
    const withReturn = (entries as DecisionLedgerEntry[]).filter(e => e.returnPct !== null && e.returnPct !== undefined);
    const avgReturn = withReturn.length > 0
      ? Math.round((withReturn.reduce((sum, e) => sum + (e.returnPct ?? 0), 0) / withReturn.length) * 100) / 100
      : null;

    // Average time to resolution
    const withElapsed = (entries as DecisionLedgerEntry[]).filter(e => e.elapsedMs !== null && e.elapsedMs !== undefined && e.elapsedMs > 0);
    const avgElapsedHours = withElapsed.length > 0
      ? Math.round(withElapsed.reduce((sum, e) => sum + (e.elapsedMs ?? 0), 0) / withElapsed.length / 3600000 * 10) / 10
      : null;

    return {
      ...stats,
      trend,
      trendLabel: trend === null ? null : trend > 0 ? "improving" : trend < 0 ? "declining" : "stable",
      avgReturn,
      avgElapsedHours,
      recentWinRate: recentStats.winRate,
      priorWinRate: priorStats.winRate,
      sampleSufficient: stats.resolved >= 10,
    };
    } catch (err) {
      console.error("[intelligenceValidation] validationStats error:", err);
      return null;
    }
  }),

  /**
   * Breakdown by asset class: stock vs crypto vs macro.
   */
  breakdownByAssetClass: protectedProcedure.query(async ({ ctx }) => {
    try {
    const db = await getDb();
    if (!db) return [];

    const entries = await db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.userId, ctx.user.id));

    const groups: Record<string, DecisionLedgerEntry[]> = {};
    for (const e of entries as DecisionLedgerEntry[]) {
      const key = e.assetType ?? "macro";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    return Object.entries(groups).map(([assetClass, rows]) => ({
      assetClass,
      ...computeAccuracy(rows),
    })).sort((a, b) => b.total - a.total);
    } catch (err) { console.error("[intelligenceValidation] breakdownByAssetClass error:", err); return []; }
  }),

  /**
   * Breakdown by sector (Technology, Healthcare, Crypto, etc.)
   */
  breakdownBySector: protectedProcedure.query(async ({ ctx }) => {
    try {
    const db = await getDb();
    if (!db) return [];

    const entries = await db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.userId, ctx.user.id));

    const groups: Record<string, DecisionLedgerEntry[]> = {};
    for (const e of entries as DecisionLedgerEntry[]) {
      const key = e.sector ?? "Unclassified";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    return Object.entries(groups).map(([sector, rows]) => ({
      sector,
      ...computeAccuracy(rows),
    })).sort((a, b) => b.resolved - a.resolved);
    } catch (err) { console.error("[intelligenceValidation] breakdownBySector error:", err); return []; }
  }),

  /**
   * Breakdown by recommendation type (Accumulate, Reduce, Bullish, Day Trade, etc.)
   */
  breakdownByRecommendationType: protectedProcedure.query(async ({ ctx }) => {
    try {
    const db = await getDb();
    if (!db) return [];

    const entries = await db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.userId, ctx.user.id));

    const groups: Record<string, DecisionLedgerEntry[]> = {};
    for (const e of entries as DecisionLedgerEntry[]) {
      const key = e.recommendationType ?? e.verdict ?? "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    return Object.entries(groups).map(([type, rows]) => ({
      recommendationType: type,
      ...computeAccuracy(rows),
    })).sort((a, b) => b.resolved - a.resolved);
    } catch (err) { console.error("[intelligenceValidation] breakdownByRecommendationType error:", err); return []; }
  }),

  /**
   * Engine scorecards — accuracy per intelligence engine.
   */
  engineScorecards: protectedProcedure.query(async ({ ctx }) => {
    try {
    const db = await getDb();
    if (!db) return [];

    const entries = await db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.userId, ctx.user.id));

    const groups: Record<string, DecisionLedgerEntry[]> = {};
    for (const e of entries as DecisionLedgerEntry[]) {
      const key = e.engineSource ?? "Ask Intelligence";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    return Object.entries(groups).map(([engine, rows]) => {
      const stats = computeAccuracy(rows);
      const avgConfidence = rows.length > 0
        ? Math.round(rows.reduce((sum, r) => sum + r.confidence, 0) / rows.length)
        : null;
      const avgOpportunityScore = rows.length > 0
        ? Math.round(rows.reduce((sum, r) => sum + r.opportunityScore, 0) / rows.length)
        : null;
      return {
        engine,
        ...stats,
        avgConfidence,
        avgOpportunityScore,
        // Grade: A(≥80), B(60-79), C(40-59), D(<40), N/A if insufficient
        grade: stats.winRate === null || stats.resolved < 5 ? "N/A"
          : stats.winRate >= 80 ? "A"
          : stats.winRate >= 60 ? "B"
          : stats.winRate >= 40 ? "C"
          : "D",
      };
    }).sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1));
    } catch (err) { console.error("[intelligenceValidation] engineScorecards error:", err); return []; }
  }),

  /**
   * Confidence calibration — accuracy at each confidence band.
   * Bands: 50-59, 60-69, 70-79, 80-89, 90-100
   */
  confidenceCalibration: protectedProcedure.query(async ({ ctx }) => {
    try {
    const db = await getDb();
    if (!db) return [];

    const entries = await db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.userId, ctx.user.id));

    const bands = [
      { label: "50–59", min: 50, max: 59 },
      { label: "60–69", min: 60, max: 69 },
      { label: "70–79", min: 70, max: 79 },
      { label: "80–89", min: 80, max: 89 },
      { label: "90–100", min: 90, max: 100 },
    ];

    return bands.map(band => {
      const rows = (entries as DecisionLedgerEntry[]).filter(e => e.confidence >= band.min && e.confidence <= band.max);
      const stats = computeAccuracy(rows);
      // Calibration delta: how far actual accuracy is from stated confidence midpoint
      const midpoint = (band.min + band.max) / 2;
      const calibrationDelta = stats.winRate !== null ? stats.winRate - midpoint : null;
      return {
        band: band.label,
        midpoint,
        ...stats,
        calibrationDelta,
        // Calibrated = within ±10% of stated confidence
        isCalibrated: calibrationDelta !== null ? Math.abs(calibrationDelta) <= 10 : null,
      };
    });
    } catch (err) { console.error("[intelligenceValidation] confidenceCalibration error:", err); return []; }
  }),

  /**
   * Performance over time — weekly accuracy trend for the last 12 weeks.
   */
  performanceOverTime: protectedProcedure
    .input(z.object({
      weeks: z.number().min(4).max(52).default(12),
    }))
    .query(async ({ ctx, input }) => {
      try {
      const db = await getDb();
      if (!db) return [];

      const cutoff = new Date(Date.now() - input.weeks * 7 * 86400000);
      const entries = await db
        .select()
        .from(decisionLedger)
        .where(and(
          eq(decisionLedger.userId, ctx.user.id),
          gte(decisionLedger.createdAt, cutoff),
        ))
        .orderBy(desc(decisionLedger.createdAt));

      // Group by ISO week
      const weekGroups: Record<string, DecisionLedgerEntry[]> = {};
      for (const e of entries as DecisionLedgerEntry[]) {
        const week = getISOWeek(new Date(e.createdAt));
        if (!weekGroups[week]) weekGroups[week] = [];
        weekGroups[week].push(e);
      }

      return Object.entries(weekGroups)
        .map(([week, rows]) => ({
          week,
          ...computeAccuracy(rows),
        }))
        .sort((a, b) => a.week.localeCompare(b.week));
      } catch (err) { console.error("[intelligenceValidation] performanceOverTime error:", err); return []; }
    }),

  /**
   * Market regime analysis — accuracy by regime at the time of recommendation.
   */
  marketRegimeAnalysis: protectedProcedure.query(async ({ ctx }) => {
    try {
    const db = await getDb();
    if (!db) return [];

    const entries = await db
      .select()
      .from(decisionLedger)
      .where(eq(decisionLedger.userId, ctx.user.id));

    const groups: Record<string, DecisionLedgerEntry[]> = {};
    for (const e of entries as DecisionLedgerEntry[]) {
      const key = e.regimeAtTime ?? "Unknown Regime";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    return Object.entries(groups).map(([regime, rows]) => ({
      regime,
      ...computeAccuracy(rows),
    })).sort((a, b) => b.resolved - a.resolved);
    } catch (err) { console.error("[intelligenceValidation] marketRegimeAnalysis error:", err); return []; }
  }),

  /**
   * Symbol leaderboard — best and worst predicted symbols.
   * Returns top 10 best and top 10 worst by win rate (min 3 resolved).
   */
  symbolLeaderboard: protectedProcedure.query(async ({ ctx }) => {
    try {
    const db = await getDb();
    if (!db) return { best: [], worst: [] };

    const entries = await db
      .select()
      .from(decisionLedger)
      .where(and(
        eq(decisionLedger.userId, ctx.user.id),
        isNotNull(decisionLedger.ticker),
      ));

    const groups: Record<string, DecisionLedgerEntry[]> = {};
    for (const e of entries as DecisionLedgerEntry[]) {
      if (!e.ticker) continue;
      const key = e.ticker;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    const symbolStats = Object.entries(groups)
      .map(([ticker, rows]) => {
        const stats = computeAccuracy(rows);
        const assetType = rows[0]?.assetType ?? null;
        return { ticker, assetType, ...stats };
      })
      .filter(s => s.resolved >= 3); // minimum sample size

    const sorted = [...symbolStats].sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1));

    return {
      best: sorted.slice(0, 10),
      worst: [...sorted].sort((a, b) => (a.winRate ?? 101) - (b.winRate ?? 101)).slice(0, 10),
    };
    } catch (err) { console.error("[intelligenceValidation] symbolLeaderboard error:", err); return { best: [], worst: [] }; }
  }),

  /**
   * Get improvement lessons for the current user.
   * Optionally filter by patternTag or engineSource.
   */
  getImprovementLessons: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      patternTag: z.string().optional(),
      engineSource: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(improvementLessons.userId, ctx.user.id)];
      if (input.patternTag) {
        conditions.push(eq(improvementLessons.patternTag, input.patternTag));
      }
      if (input.engineSource) {
        conditions.push(eq(improvementLessons.engineSource, input.engineSource));
      }

      return await db
        .select()
        .from(improvementLessons)
        .where(and(...conditions))
        .orderBy(desc(improvementLessons.createdAt))
        .limit(input.limit);
      } catch (err) { console.error("[intelligenceValidation] getImprovementLessons error:", err); return []; }
    }),

  /**
   * Get AI improvement reports (weekly synthesis).
   * Returns the last N weekly reports.
   */
  getAiImprovementReports: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(52).default(12),
    }))
    .query(async ({ ctx: _ctx, input }) => {
      try {
      const db = await getDb();
      if (!db) return [];

      return await db
        .select()
        .from(aiImprovementReports)
        .orderBy(desc(aiImprovementReports.weekOf))
        .limit(input.limit);
      } catch (err) { console.error("[intelligenceValidation] getAiImprovementReports error:", err); return []; }
    }),

  /**
   * Get pattern tag frequency from improvement lessons.
   * Used for the "Top Recurring Patterns" section.
   */
  getPatternTagFrequency: protectedProcedure.query(async ({ ctx }) => {
    try {
    const db = await getDb();
    if (!db) return [];

    const lessons = await db
      .select()
      .from(improvementLessons)
      .where(eq(improvementLessons.userId, ctx.user.id));

    const freq: Record<string, number> = {};
    for (const l of lessons) {
      const tag = l.patternTag ?? "Untagged";
      freq[tag] = (freq[tag] ?? 0) + 1;
    }

    return Object.entries(freq)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    } catch (err) { console.error("[intelligenceValidation] getPatternTagFrequency error:", err); return []; }
  }),
});
