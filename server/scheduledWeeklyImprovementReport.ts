/**
 * FAULTLINE — Weekly AI Improvement Report Heartbeat
 * server/scheduledWeeklyImprovementReport.ts
 *
 * Phase 7: Generates a weekly synthesis report from improvement_lessons
 * and decision_ledger data. Stored in ai_improvement_reports table.
 *
 * Triggered by heartbeat cron: every Monday at 06:00 UTC.
 * Handler path: /api/scheduled/weeklyImprovementReport
 *
 * The report is:
 *   - LLM-generated synthesis of the week's patterns and lessons
 *   - Includes accuracy metrics, top patterns, weaknesses, recommendations
 *   - Never fabricates data — uses only actual DB records
 *   - Idempotent: skips if report for current week already exists
 */

import { Request, Response } from "express";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { decisionLedger, improvementLessons, aiImprovementReports } from "../drizzle/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { sdk } from "./_core/sdk";

// ── ISO week helper ───────────────────────────────────────────────────────────

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1); // Monday
  return d;
}

// ── Generate weekly report ────────────────────────────────────────────────────

async function generateWeeklyReport(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const currentWeek = getISOWeek(new Date());

  // Idempotency: skip if report already exists for this week
  const existing = await db
    .select({ id: aiImprovementReports.id })
    .from(aiImprovementReports)
    .where(eq(aiImprovementReports.weekOf, currentWeek))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[WeeklyReport] Report for ${currentWeek} already exists — skipping`);
    return;
  }

  // Get start of current week
  const weekStart = getStartOfWeek(new Date());

  // Fetch all decision_ledger entries resolved this week
  const resolvedThisWeek = await db
    .select()
    .from(decisionLedger)
    .where(gte(decisionLedger.resolvedAt, weekStart))
    .limit(500);

  // Fetch all improvement lessons from this week
  const lessonsThisWeek = await db
    .select()
    .from(improvementLessons)
    .where(gte(improvementLessons.createdAt, weekStart))
    .limit(200);

  // Compute metrics
  const totalAnalyzed = resolvedThisWeek.length;
  const correctCount = resolvedThisWeek.filter(e => e.outcome === "correct").length;
  const incorrectCount = resolvedThisWeek.filter(e => e.outcome === "incorrect").length;
  const partialCount = resolvedThisWeek.filter(e => e.outcome === "partially_correct").length;
  const activeCount = resolvedThisWeek.filter(e => e.outcome === "still_active").length;
  const winPoints = correctCount + partialCount * 0.5;
  const accuracyRate = totalAnalyzed > 0 ? Math.round((winPoints / totalAnalyzed) * 100 * 10) / 10 : 0;

  // Pattern tag frequency
  const tagFreq: Record<string, number> = {};
  for (const l of lessonsThisWeek) {
    const tag = l.patternTag ?? "Untagged";
    tagFreq[tag] = (tagFreq[tag] ?? 0) + 1;
  }
  const topPatterns = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => `${tag} (${count}x)`);

  // Engine breakdown
  const engineFreq: Record<string, { correct: number; total: number }> = {};
  for (const e of resolvedThisWeek) {
    const eng = e.engineSource ?? "Ask Intelligence";
    if (!engineFreq[eng]) engineFreq[eng] = { correct: 0, total: 0 };
    engineFreq[eng].total++;
    if (e.outcome === "correct") engineFreq[eng].correct++;
  }
  const engineSummary = Object.entries(engineFreq)
    .map(([eng, s]) => `${eng}: ${s.correct}/${s.total} correct`)
    .join(", ");

  // Sample lessons for LLM context
  const sampleLessons = lessonsThisWeek
    .slice(0, 10)
    .map(l => `- [${l.patternTag ?? "?"}] ${l.lessonText}`)
    .join("\n");

  // If no data this week, create a minimal report
  if (totalAnalyzed === 0) {
    await db.insert(aiImprovementReports).values({
      weekOf: currentWeek,
      reportText: `# FAULTLINE Intelligence Report — ${currentWeek}\n\nNo recommendations were resolved this week. The system continues to monitor all pending entries.\n\n*This report is generated automatically and is for informational purposes only.*`,
      totalAnalyzed: 0,
      correctCount: 0,
      incorrectCount: 0,
      partialCount: 0,
      activeCount: 0,
      topPatterns: JSON.stringify([]),
      weaknesses: JSON.stringify([]),
      recommendations: JSON.stringify(["Continue building the recommendation history for more meaningful analysis."]),
      accuracyRate: 0,
    });
    console.log(`[WeeklyReport] Created empty report for ${currentWeek} (no data)`);
    return;
  }

  // Generate LLM synthesis
  const llmPrompt = `You are FAULTLINE's self-improvement intelligence engine. Generate a weekly performance synthesis report.

WEEK: ${currentWeek}
TOTAL RECOMMENDATIONS RESOLVED: ${totalAnalyzed}
CORRECT: ${correctCount} | INCORRECT: ${incorrectCount} | PARTIALLY CORRECT: ${partialCount} | STILL ACTIVE: ${activeCount}
WIN RATE: ${accuracyRate}%

ENGINE BREAKDOWN: ${engineSummary || "N/A"}

TOP RECURRING PATTERNS THIS WEEK:
${topPatterns.length > 0 ? topPatterns.map(p => `- ${p}`).join("\n") : "- Insufficient data"}

SAMPLE LESSONS EXTRACTED:
${sampleLessons || "No lessons extracted this week."}

Generate a concise institutional-grade weekly intelligence report in Markdown format. Include:
1. Executive summary (2-3 sentences on overall performance)
2. What worked well this week
3. Key failure patterns and why they occurred
4. 3-5 specific, actionable recommendations for improving future recommendations
5. Market regime observations (if applicable)

Keep the tone analytical, honest, and forward-looking. Never guarantee future performance.
The report should be 300-500 words.`;

  let reportText: string;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE's self-improvement intelligence engine. Generate honest, analytical weekly performance reports in Markdown. Never fabricate data." },
        { role: "user", content: llmPrompt },
      ],
    });
    reportText = (response.choices[0]?.message?.content as string ?? "").trim();
    if (!reportText || reportText.length < 50) {
      reportText = `# FAULTLINE Intelligence Report — ${currentWeek}\n\nAccuracy this week: ${accuracyRate}% (${correctCount}/${totalAnalyzed} correct).\n\nTop patterns: ${topPatterns.join(", ") || "None identified"}.\n\n*This report is generated automatically and is for informational purposes only.*`;
    }
  } catch (err) {
    console.error("[WeeklyReport] LLM generation failed:", err);
    reportText = `# FAULTLINE Intelligence Report — ${currentWeek}\n\nAccuracy this week: ${accuracyRate}% (${correctCount}/${totalAnalyzed} correct).\n\nTop patterns: ${topPatterns.join(", ") || "None identified"}.\n\n*This report is generated automatically and is for informational purposes only.*`;
  }

  // Identify weaknesses (engines with < 50% accuracy and >= 3 resolved)
  const weaknesses = Object.entries(engineFreq)
    .filter(([, s]) => s.total >= 3 && (s.correct / s.total) < 0.5)
    .map(([eng, s]) => `${eng} accuracy: ${Math.round((s.correct / s.total) * 100)}%`);

  // Recommendations from pattern analysis
  const recommendations = topPatterns
    .slice(0, 3)
    .map(p => `Review ${p.split(" (")[0]} pattern — appears ${p.split("(")[1]?.replace(")", "") ?? "multiple times"} this week`);

  await db.insert(aiImprovementReports).values({
    weekOf: currentWeek,
    reportText,
    totalAnalyzed,
    correctCount,
    incorrectCount,
    partialCount,
    activeCount,
    topPatterns: JSON.stringify(topPatterns),
    weaknesses: JSON.stringify(weaknesses),
    recommendations: JSON.stringify(recommendations),
    accuracyRate,
  });

  console.log(`[WeeklyReport] Generated report for ${currentWeek}: accuracy=${accuracyRate}%, analyzed=${totalAnalyzed}`);
}

// ── Express handler ───────────────────────────────────────────────────────────

export async function weeklyImprovementReportHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      res.status(403).json({ error: "cron-only endpoint" });
      return;
    }

    await generateWeeklyReport();
    res.json({ ok: true, week: getISOWeek(new Date()) });
  } catch (err) {
    console.error("[WeeklyReport] Handler error:", err);
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
}

// ── Export for direct invocation (e.g. from admin panel) ─────────────────────
export { generateWeeklyReport };
