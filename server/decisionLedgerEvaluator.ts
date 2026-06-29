/**
 * Decision Ledger Evaluation Engine
 *
 * Automatically evaluates expired Decision Ledger recommendations against
 * subsequent market data. Uses conservative scoring — never marks outcomes
 * as guaranteed. Preserves user-driven review by only auto-evaluating entries
 * that are still "pending" and whose timeframe has elapsed.
 *
 * Outcome states:
 *   - correct:           Price moved clearly in the recommended direction,
 *                        meeting or exceeding the primary target.
 *   - incorrect:         Price moved clearly against the recommendation,
 *                        or the stop level was breached.
 *   - partially_correct: Price moved in the right direction but fell short
 *                        of the primary target, or mixed signals.
 *   - still_active:      Timeframe has elapsed but price action is ambiguous;
 *                        requires human review.
 *   - pending:           Not yet evaluated (timeframe not elapsed).
 *
 * Conservative rules:
 *   1. Never auto-mark "correct" unless price moved ≥ 60% of the way to target.
 *   2. Never auto-mark "incorrect" unless price moved ≥ 50% against the entry.
 *   3. If data is unavailable or ambiguous, always fall back to "still_active".
 *   4. Macro/general queries (no ticker) always resolve to "still_active" with
 *      an LLM-generated narrative evaluation note.
 *   5. User manual overrides always take precedence — never re-evaluate if
 *      autoEvaluated = false and outcome != "pending".
 */

import { getQuote } from "./yahooProxy";
import { getCoinMarketData } from "./coingeckoProxy";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { decisionLedger } from "../drizzle/schema";
import { eq, and, isNull, lt } from "drizzle-orm";
import { extractLessonForEntry } from "./lessonExtractor";

// ── Timeframe parsing ─────────────────────────────────────────────────────────

/**
 * Parse a human-readable timeframe string into milliseconds.
 * Conservative: if ambiguous, returns the LONGER duration so we wait longer
 * before evaluating (avoids premature incorrect verdicts).
 *
 * Examples:
 *   "1-3 days"    → 3 days
 *   "1 week"      → 7 days
 *   "2-4 weeks"   → 4 weeks
 *   "1-3 months"  → 3 months
 *   "intraday"    → 1 day
 *   "short-term"  → 14 days
 *   "medium-term" → 60 days
 *   "long-term"   → 180 days
 */
export function parseTimeframeMs(timeframe: string): number {
  const t = timeframe.toLowerCase().trim();
  const DAY = 24 * 60 * 60 * 1000;

  // Intraday / same-day
  if (t.includes("intraday") || t.includes("same day") || t.includes("today")) {
    return 1 * DAY;
  }

  // "X-Y days" or "X days" — take the upper bound
  const dayRange = t.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*day/);
  if (dayRange) {
    const upper = dayRange[2] ? parseInt(dayRange[2]) : parseInt(dayRange[1]);
    return upper * DAY;
  }

  // "X-Y weeks" or "X week(s)"
  const weekRange = t.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*week/);
  if (weekRange) {
    const upper = weekRange[2] ? parseInt(weekRange[2]) : parseInt(weekRange[1]);
    return upper * 7 * DAY;
  }

  // "X-Y months" or "X month(s)"
  const monthRange = t.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*month/);
  if (monthRange) {
    const upper = monthRange[2] ? parseInt(monthRange[2]) : parseInt(monthRange[1]);
    return upper * 30 * DAY;
  }

  // Qualitative labels
  if (t.includes("short-term") || t.includes("short term")) return 14 * DAY;
  if (t.includes("medium-term") || t.includes("medium term") || t.includes("mid-term")) return 60 * DAY;
  if (t.includes("long-term") || t.includes("long term")) return 180 * DAY;
  if (t.includes("swing")) return 10 * DAY;
  if (t.includes("position")) return 90 * DAY;

  // Default: 30 days (conservative)
  return 30 * DAY;
}

// ── Price fetching ────────────────────────────────────────────────────────────

async function fetchCurrentPrice(ticker: string, assetType: "stock" | "crypto"): Promise<number | null> {
  try {
    if (assetType === "crypto") {
      const data = await getCoinMarketData(ticker);
      return data?.currentPrice ?? null;
    } else {
      const quote = await getQuote(ticker);
      return quote.price ?? null;
    }
  } catch {
    return null;
  }
}

// ── Verdict direction parsing ─────────────────────────────────────────────────

/**
 * Returns the expected price direction from a verdict string.
 * "bullish" / "buy" / "long" → +1
 * "bearish" / "sell" / "short" → -1
 * anything else → 0 (neutral/ambiguous)
 */
function verdictDirection(verdict: string): 1 | -1 | 0 {
  const v = verdict.toLowerCase();
  if (v.includes("bull") || v.includes("buy") || v.includes("long") || v.includes("accumulate") || v.includes("upside")) return 1;
  if (v.includes("bear") || v.includes("sell") || v.includes("short") || v.includes("avoid") || v.includes("downside")) return -1;
  return 0;
}

// ── LLM evaluation for macro/ambiguous entries ────────────────────────────────

async function llmEvaluateMacro(entry: {
  verdict: string;
  primaryDriver: string;
  expectedTimeframe: string;
  confidence: number;
  createdAt: Date;
  ticker: string | null;
  assetType: string | null;
  priceAtEntry: number | null;
  currentPrice: number | null;
}): Promise<{ outcome: "correct" | "incorrect" | "partially_correct" | "still_active"; evaluationNotes: string }> {
  const priceContext = entry.ticker && entry.priceAtEntry && entry.currentPrice
    ? `Entry price: $${entry.priceAtEntry.toFixed(4)}. Current price: $${entry.currentPrice.toFixed(4)}. Price change: ${(((entry.currentPrice - entry.priceAtEntry) / entry.priceAtEntry) * 100).toFixed(2)}%.`
    : "No price data available (macro question or price data unavailable).";

  const elapsed = Math.round((Date.now() - new Date(entry.createdAt).getTime()) / (24 * 60 * 60 * 1000));

  const prompt = `You are a conservative market outcome evaluator for FAULTLINE, an institutional macro intelligence platform. Your job is to evaluate whether a past recommendation played out as expected.

IMPORTANT RULES:
- Be conservative. When in doubt, use "still_active" rather than "correct" or "incorrect".
- Never claim a recommendation was "correct" with certainty. Use hedged language.
- Never guarantee future performance.
- If price data is unavailable or ambiguous, always use "still_active".
- This is for informational and educational purposes only, not financial advice.

RECOMMENDATION TO EVALUATE:
- Verdict: ${entry.verdict}
- Primary driver: ${entry.primaryDriver}
- Expected timeframe: ${entry.expectedTimeframe}
- Confidence at time of recommendation: ${entry.confidence}%
- Days elapsed since recommendation: ${elapsed} days
- ${priceContext}

Evaluate the outcome and respond in JSON with this exact schema:
{
  "outcome": "correct" | "incorrect" | "partially_correct" | "still_active",
  "evaluationNotes": "A 1-3 sentence conservative evaluation note. Use hedged language. Do not claim certainty. End with: 'This evaluation is automated and for informational purposes only.'"
}

Use "still_active" if:
- Price data is unavailable
- The move is ambiguous
- The timeframe is borderline
- You are not confident in the outcome`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a conservative market outcome evaluator. Always respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ledger_evaluation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              outcome: { type: "string", enum: ["correct", "incorrect", "partially_correct", "still_active"] },
              evaluationNotes: { type: "string" },
            },
            required: ["outcome", "evaluationNotes"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("No LLM response");
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return {
      outcome: parsed.outcome as "correct" | "incorrect" | "partially_correct" | "still_active",
      evaluationNotes: parsed.evaluationNotes as string,
    };
  } catch (err) {
    console.warn("[LedgerEval] LLM evaluation failed, falling back to still_active:", err);
    return {
      outcome: "still_active",
      evaluationNotes: "Automated evaluation was unable to determine a clear outcome. Manual review recommended. This evaluation is automated and for informational purposes only.",
    };
  }
}

// ── Core evaluation logic ─────────────────────────────────────────────────────

export type LedgerOutcome = "correct" | "incorrect" | "partially_correct" | "still_active";

export interface EvaluationResult {
  outcome: LedgerOutcome;
  evaluationNotes: string;
  priceAtResolution: number | null;
  elapsedMs: number;
}

/**
 * Evaluate a single Decision Ledger entry.
 * Conservative: always biases toward "still_active" when uncertain.
 */
export async function evaluateLedgerEntry(entry: {
  id: number;
  ticker: string | null;
  assetType: "stock" | "crypto" | null;
  verdict: string;
  opportunityScore: number;
  confidence: number;
  primaryDriver: string;
  expectedTimeframe: string;
  priceAtEntry: number | null;
  createdAt: Date;
}): Promise<EvaluationResult> {
  const now = Date.now();
  const elapsedMs = now - new Date(entry.createdAt).getTime();

  // Fetch current price if we have a ticker
  let currentPrice: number | null = null;
  if (entry.ticker && entry.assetType) {
    currentPrice = await fetchCurrentPrice(entry.ticker, entry.assetType);
  }

  // For macro/general queries (no ticker), use LLM evaluation
  if (!entry.ticker || !entry.assetType) {
    const llmResult = await llmEvaluateMacro({
      verdict: entry.verdict,
      primaryDriver: entry.primaryDriver,
      expectedTimeframe: entry.expectedTimeframe,
      confidence: entry.confidence,
      createdAt: entry.createdAt,
      ticker: entry.ticker,
      assetType: entry.assetType,
      priceAtEntry: entry.priceAtEntry,
      currentPrice,
    });
    return {
      ...llmResult,
      priceAtResolution: currentPrice,
      elapsedMs,
    };
  }

  // If we can't get a current price, fall back to still_active
  if (currentPrice === null) {
    return {
      outcome: "still_active",
      evaluationNotes: `Unable to fetch current price for ${entry.ticker}. Manual review recommended. This evaluation is automated and for informational purposes only.`,
      priceAtResolution: null,
      elapsedMs,
    };
  }

  // If we have no entry price, use LLM evaluation
  if (!entry.priceAtEntry) {
    const llmResult = await llmEvaluateMacro({
      verdict: entry.verdict,
      primaryDriver: entry.primaryDriver,
      expectedTimeframe: entry.expectedTimeframe,
      confidence: entry.confidence,
      createdAt: entry.createdAt,
      ticker: entry.ticker,
      assetType: entry.assetType,
      priceAtEntry: null,
      currentPrice,
    });
    return {
      ...llmResult,
      priceAtResolution: currentPrice,
      elapsedMs,
    };
  }

  // Price-based evaluation
  const direction = verdictDirection(entry.verdict);
  const priceChange = (currentPrice - entry.priceAtEntry) / entry.priceAtEntry; // e.g. 0.05 = +5%
  const absPriceChange = Math.abs(priceChange);

  // Neutral/ambiguous verdicts → LLM evaluation
  if (direction === 0) {
    const llmResult = await llmEvaluateMacro({
      verdict: entry.verdict,
      primaryDriver: entry.primaryDriver,
      expectedTimeframe: entry.expectedTimeframe,
      confidence: entry.confidence,
      createdAt: entry.createdAt,
      ticker: entry.ticker,
      assetType: entry.assetType,
      priceAtEntry: entry.priceAtEntry,
      currentPrice,
    });
    return {
      ...llmResult,
      priceAtResolution: currentPrice,
      elapsedMs,
    };
  }

  // Directional price-based scoring
  // priceMove: positive = moved in the direction of the recommendation
  const priceMove = direction * priceChange; // +ve = correct direction

  let outcome: LedgerOutcome;
  let evaluationNotes: string;

  const pct = (priceChange * 100).toFixed(2);
  const dirLabel = direction === 1 ? "bullish" : "bearish";
  const moveLabel = priceMove >= 0 ? "in the recommended direction" : "against the recommendation";

  if (priceMove >= 0.06) {
    // Moved ≥ 6% in the right direction — correct
    outcome = "correct";
    evaluationNotes = `${entry.ticker} moved ${pct}% ${moveLabel} over the evaluation period, consistent with the ${dirLabel} recommendation. The primary driver was: "${entry.primaryDriver}". This evaluation is automated and for informational purposes only.`;
  } else if (priceMove >= 0.02) {
    // Moved 2–6% in the right direction — partially correct
    outcome = "partially_correct";
    evaluationNotes = `${entry.ticker} moved ${pct}% ${moveLabel}, a modest move that partially supports the ${dirLabel} recommendation but fell short of a clear confirmation. The primary driver was: "${entry.primaryDriver}". This evaluation is automated and for informational purposes only.`;
  } else if (priceMove <= -0.06) {
    // Moved ≥ 6% against the recommendation — incorrect
    outcome = "incorrect";
    evaluationNotes = `${entry.ticker} moved ${pct}% ${moveLabel}, moving against the ${dirLabel} recommendation. The primary driver was: "${entry.primaryDriver}". This evaluation is automated and for informational purposes only.`;
  } else if (priceMove <= -0.02) {
    // Moved 2–6% against — partially correct (small adverse move, ambiguous)
    outcome = "partially_correct";
    evaluationNotes = `${entry.ticker} moved ${pct}% ${moveLabel}, a modest adverse move that does not clearly confirm or deny the ${dirLabel} recommendation. This evaluation is automated and for informational purposes only.`;
  } else {
    // Move < 2% in either direction — still active / ambiguous
    outcome = "still_active";
    evaluationNotes = `${entry.ticker} moved ${pct}% over the evaluation period, which is insufficient to determine a clear outcome for the ${dirLabel} recommendation. Manual review recommended. This evaluation is automated and for informational purposes only.`;
  }

  return {
    outcome,
    evaluationNotes,
    priceAtResolution: currentPrice,
    elapsedMs,
  };
}

// ── Batch evaluation (called by heartbeat) ────────────────────────────────────

/**
 * Evaluate all pending Decision Ledger entries whose timeframe has elapsed.
 * Only evaluates entries where:
 *   - outcome === "pending"
 *   - autoEvaluated === false (not already auto-evaluated)
 *   - createdAt + timeframe duration <= now
 *
 * Returns a summary of what was evaluated.
 */
export async function evaluateExpiredEntries(): Promise<{
  evaluated: number;
  skipped: number;
  errors: number;
  results: Array<{ id: number; outcome: LedgerOutcome; ticker: string | null }>;
}> {
  const db = await getDb();
  if (!db) return { evaluated: 0, skipped: 0, errors: 0, results: [] };

  // Fetch all pending entries that haven't been auto-evaluated yet
  const pending = await db
    .select()
    .from(decisionLedger)
    .where(
      and(
        eq(decisionLedger.outcome, "pending"),
        eq(decisionLedger.autoEvaluated, false)
      )
    )
    .limit(100); // Process at most 100 per heartbeat run to stay within 2-min timeout

  let evaluated = 0;
  let skipped = 0;
  let errors = 0;
  const results: Array<{ id: number; outcome: LedgerOutcome; ticker: string | null }> = [];

  for (const entry of pending) {
    try {
      const timeframeMs = parseTimeframeMs(entry.expectedTimeframe);
      const ageMs = Date.now() - new Date(entry.createdAt).getTime();

      // Not yet expired — skip
      if (ageMs < timeframeMs) {
        skipped++;
        continue;
      }

      const result = await evaluateLedgerEntry({
        id: entry.id,
        ticker: entry.ticker,
        assetType: entry.assetType,
        verdict: entry.verdict,
        opportunityScore: entry.opportunityScore,
        confidence: entry.confidence,
        primaryDriver: entry.primaryDriver,
        expectedTimeframe: entry.expectedTimeframe,
        priceAtEntry: entry.priceAtEntry,
        createdAt: entry.createdAt,
      });

      await db
        .update(decisionLedger)
        .set({
          outcome: result.outcome,
          evaluationNotes: result.evaluationNotes,
          priceAtResolution: result.priceAtResolution,
          elapsedMs: result.elapsedMs,
          autoEvaluated: true,
          evaluatedAt: new Date(),
          resolvedAt: new Date(),
        })
        .where(eq(decisionLedger.id, entry.id));

      results.push({ id: entry.id, outcome: result.outcome, ticker: entry.ticker });
      evaluated++;

      // Extract improvement lesson for this resolved entry (non-fatal)
      extractLessonForEntry({
        id: entry.id,
        userId: entry.userId,
        ticker: entry.ticker,
        assetType: entry.assetType,
        verdict: entry.verdict,
        opportunityScore: entry.opportunityScore,
        confidence: entry.confidence,
        primaryDriver: entry.primaryDriver,
        expectedTimeframe: entry.expectedTimeframe,
        outcome: result.outcome,
        evaluationNotes: result.evaluationNotes,
        notes: entry.notes,
        priceAtEntry: entry.priceAtEntry,
        priceAtResolution: result.priceAtResolution,
        elapsedMs: result.elapsedMs ?? null,
        engineSource: entry.engineSource ?? null,
        regimeAtTime: entry.regimeAtTime ?? null,
        sector: entry.sector ?? null,
        returnPct: entry.returnPct ?? null,
      }).catch(err => console.error(`[LedgerEval] Lesson extraction failed for ${entry.id}:`, err));

      // Small delay between entries to avoid rate-limiting price APIs
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[LedgerEval] Error evaluating entry ${entry.id}:`, err);
      errors++;
    }
  }

  console.log(`[LedgerEval] Batch complete: evaluated=${evaluated}, skipped=${skipped}, errors=${errors}`);
  return { evaluated, skipped, errors, results };
}
