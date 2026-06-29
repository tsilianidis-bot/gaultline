/**
 * FAULTLINE — Lesson Extractor
 * server/lessonExtractor.ts
 *
 * Phase 7: Self-improvement engine.
 * After each Decision Ledger entry is resolved (by auto-evaluation or user),
 * this module extracts an actionable lesson using the LLM and stores it in
 * the improvement_lessons table.
 *
 * Conservative rules:
 *   - Only extracts lessons for entries with outcome != "pending"
 *   - Never fabricates data — uses only the actual entry fields
 *   - Lesson extraction failure is non-fatal (logged, not thrown)
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { improvementLessons } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ── Pattern tags for lesson classification ────────────────────────────────────

const PATTERN_TAGS = [
  "Correct Thesis",
  "Overconfidence",
  "Underconfidence",
  "Timing Error",
  "Macro Blind Spot",
  "Sector Rotation",
  "Regime Mismatch",
  "Partial Signal",
  "Catalyst Miss",
  "Stop Hit",
  "Target Exceeded",
  "Liquidity Event",
  "Earnings Surprise",
  "Fed Policy Shift",
  "Crypto Correlation",
  "Technical Breakdown",
  "Technical Breakout",
  "Fundamental Divergence",
  "Risk Management",
  "Market Cap Bias",
] as const;

export type PatternTag = typeof PATTERN_TAGS[number];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LedgerEntryForLesson {
  id: number;
  userId: number;
  ticker: string | null;
  assetType: string | null;
  verdict: string;
  opportunityScore: number;
  confidence: number;
  primaryDriver: string;
  expectedTimeframe: string;
  outcome: string;
  evaluationNotes: string | null;
  notes: string | null;
  priceAtEntry: number | null;
  priceAtResolution: number | null;
  elapsedMs: number | null;
  engineSource: string | null;
  regimeAtTime: string | null;
  sector: string | null;
  returnPct: number | null;
}

// ── Extract lesson for a single resolved entry ────────────────────────────────

export async function extractLessonForEntry(entry: LedgerEntryForLesson): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Skip pending entries
  if (entry.outcome === "pending") return;

  // Check if lesson already extracted for this entry
  const existing = await db
    .select({ id: improvementLessons.id })
    .from(improvementLessons)
    .where(eq(improvementLessons.ledgerEntryId, entry.id))
    .limit(1);

  if (existing.length > 0) return; // Already extracted

  try {
    const returnInfo = entry.priceAtEntry && entry.priceAtResolution
      ? `Price moved from $${entry.priceAtEntry} to $${entry.priceAtResolution} (${entry.returnPct !== null ? entry.returnPct + "%" : "return unknown"}).`
      : "Price data unavailable.";

    const elapsedInfo = entry.elapsedMs
      ? `Resolved in ${Math.round(entry.elapsedMs / 3600000)} hours.`
      : "";

    const prompt = `You are FAULTLINE's self-improvement engine. Analyze this resolved recommendation and extract one actionable lesson.

RECOMMENDATION:
- Asset: ${entry.ticker ?? "Macro/General"} (${entry.assetType ?? "N/A"})
- Sector: ${entry.sector ?? "Unknown"}
- Verdict: ${entry.verdict}
- Opportunity Score: ${entry.opportunityScore}/100
- Confidence: ${entry.confidence}%
- Primary Driver: "${entry.primaryDriver}"
- Expected Timeframe: ${entry.expectedTimeframe}
- Engine: ${entry.engineSource ?? "Ask Intelligence"}
- Market Regime: ${entry.regimeAtTime ?? "Unknown"}

OUTCOME:
- Result: ${entry.outcome.toUpperCase().replace("_", " ")}
- ${returnInfo} ${elapsedInfo}
- Evaluation Notes: "${entry.evaluationNotes ?? entry.notes ?? "None"}"

Extract ONE actionable lesson from this outcome. The lesson should:
1. Be specific and actionable (not generic advice)
2. Explain WHY the outcome occurred
3. Suggest what to watch for in similar future recommendations
4. Be 1-3 sentences maximum

Also classify this outcome with ONE pattern tag from this list:
${PATTERN_TAGS.join(", ")}

Respond with JSON only:
{
  "lessonText": "...",
  "patternTag": "...",
  "confidence": 0-100
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are FAULTLINE's self-improvement engine. Extract actionable lessons from resolved recommendations. Respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lesson_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              lessonText: { type: "string" },
              patternTag: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["lessonText", "patternTag", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: { lessonText: string; patternTag: string; confidence: number };
    try {
      parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    } catch {
      console.error("[LessonExtractor] Failed to parse LLM response:", raw);
      return;
    }

    if (!parsed.lessonText || parsed.lessonText.trim().length < 10) return;

    await db.insert(improvementLessons).values({
      userId: entry.userId,
      ledgerEntryId: entry.id,
      ticker: entry.ticker,
      assetType: entry.assetType,
      verdict: entry.verdict,
      outcome: entry.outcome,
      lessonText: parsed.lessonText.trim(),
      patternTag: PATTERN_TAGS.includes(parsed.patternTag as PatternTag) ? parsed.patternTag : "Partial Signal",
      confidence: Math.min(100, Math.max(0, Math.round(parsed.confidence ?? 70))),
      engineSource: entry.engineSource,
      regimeAtTime: entry.regimeAtTime,
    });

    console.log(`[LessonExtractor] Extracted lesson for entry ${entry.id}: ${parsed.patternTag}`);
  } catch (err) {
    // Non-fatal — lesson extraction failure should never block evaluation
    console.error(`[LessonExtractor] Error extracting lesson for entry ${entry.id}:`, err);
  }
}
