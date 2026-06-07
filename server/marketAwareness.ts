/**
 * FAULTLINE Complete Market Awareness™
 * Server-side helpers: DB access, scoring engine, and action key constants.
 */

import { getDb } from "./db";
import { userMarketAwarenessActions } from "../drizzle/schema";
import { eq, and, gte, desc } from "drizzle-orm";

// ── Action Keys ──────────────────────────────────────────────
export const ACTION_KEYS = [
  "viewed_dashboard",
  "reviewed_faultline_score",
  "opened_score_explanation",
  "viewed_market_regime",
  "viewed_pressure_drivers",
  "viewed_alerts",
  "opened_daily_briefing",
  "viewed_signal_explanation",
  "checked_data_status",
  "added_watchlist_item",
  "opened_scenario_tool",
  "opened_historical_comparison",
  "opened_ai_market_explanation",
  "completed_daily_market_preflight",
  "completed_decision_check",
] as const;

export type ActionKey = (typeof ACTION_KEYS)[number];

// ── Scoring Model ────────────────────────────────────────────
/**
 * Maps action keys to the scoring category they contribute to.
 * Total possible: 100 points.
 *
 * A. Dashboard & Score Review        — 20 pts
 * B. Market Context Review           — 20 pts
 * C. Signal Context Review           — 20 pts
 * D. Risk Scenario Review            — 15 pts
 * E. Data Trust Awareness            — 10 pts
 * F. Portfolio / Watchlist Context   — 10 pts
 * G. Daily Market Preflight          —  5 pts
 */
const SCORING_MAP: Record<ActionKey, { category: string; points: number }> = {
  viewed_dashboard:                 { category: "A", points: 10 },
  reviewed_faultline_score:         { category: "A", points: 10 },
  opened_score_explanation:         { category: "B", points: 10 },
  viewed_market_regime:             { category: "B", points: 10 },
  viewed_pressure_drivers:          { category: "B", points: 0  }, // bonus — covered by B above
  viewed_alerts:                    { category: "C", points: 10 },
  viewed_signal_explanation:        { category: "C", points: 10 },
  opened_daily_briefing:            { category: "C", points: 0  }, // bonus
  checked_data_status:              { category: "E", points: 10 },
  added_watchlist_item:             { category: "F", points: 10 },
  opened_scenario_tool:             { category: "D", points: 15 },
  opened_historical_comparison:     { category: "D", points: 0  }, // bonus
  opened_ai_market_explanation:     { category: "B", points: 0  }, // bonus
  completed_daily_market_preflight: { category: "G", points: 5  },
  completed_decision_check:         { category: "F", points: 0  }, // bonus
};

// ── Rating Labels ────────────────────────────────────────────
export function getAwarenessRating(score: number): {
  label: string;
  statusLabel: string;
  color: string;
} {
  if (score >= 90) return { label: "Complete Market Awareness",  statusLabel: "Full Awareness Confirmed",    color: "#00d4ff" };
  if (score >= 75) return { label: "Strong Market Awareness",    statusLabel: "Market Context Reviewed",     color: "#22c55e" };
  if (score >= 60) return { label: "Developing Awareness",       statusLabel: "Ready for Review",            color: "#84cc16" };
  if (score >= 40) return { label: "Partial Awareness",          statusLabel: "Preflight Incomplete",        color: "#f59e0b" };
  return               { label: "Limited Awareness",          statusLabel: "Review Recommended",          color: "#ef4444" };
}

// ── DB Helpers ───────────────────────────────────────────────

/** Return today's UTC midnight timestamp */
function todayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Log a single user action */
export async function logMarketAwarenessAction(
  userId: number,
  actionKey: ActionKey,
  sourcePage?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(userMarketAwarenessActions).values({
    userId,
    actionKey,
    sourcePage: sourcePage ?? null,
    metadata: metadata ? JSON.stringify(metadata) : null,
    completedAt: new Date(),
    createdAt: new Date(),
  });
}

/** Get all actions for a user since today's UTC midnight */
export async function getTodayActions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userMarketAwarenessActions)
    .where(
      and(
        eq(userMarketAwarenessActions.userId, userId),
        gte(userMarketAwarenessActions.completedAt, todayStart())
      )
    )
    .orderBy(desc(userMarketAwarenessActions.completedAt));
}

/** Compute the Complete Market Awareness Score (0–100) for today */
export async function computeAwarenessScore(userId: number): Promise<{
  score: number;
  completedKeys: ActionKey[];
  missingKeys: ActionKey[];
  rating: ReturnType<typeof getAwarenessRating>;
  categoryBreakdown: Record<string, { earned: number; max: number }>;
}> {
  const actions = await getTodayActions(userId);
  const completedKeys = Array.from(new Set(actions.map((a: { actionKey: string }) => a.actionKey as ActionKey)));

  // Compute score — each key contributes its points once per day
  let score = 0;
  const categoryBreakdown: Record<string, { earned: number; max: number }> = {
    A: { earned: 0, max: 20 },
    B: { earned: 0, max: 20 },
    C: { earned: 0, max: 20 },
    D: { earned: 0, max: 15 },
    E: { earned: 0, max: 10 },
    F: { earned: 0, max: 10 },
    G: { earned: 0, max: 5  },
  };

  for (const key of completedKeys) {
    const entry = SCORING_MAP[key as ActionKey];
    if (entry && entry.points > 0) {
      const cat = categoryBreakdown[entry.category];
      if (cat && cat.earned < cat.max) {
        const add = Math.min(entry.points, cat.max - cat.earned);
        cat.earned += add;
        score += add;
      }
    }
  }

  score = Math.min(100, score);

  const missingKeys = ACTION_KEYS.filter((k) => !completedKeys.includes(k));

  return {
    score,
    completedKeys,
    missingKeys,
    rating: getAwarenessRating(score),
    categoryBreakdown,
  };
}

/** Get recent action history (last 7 days) for the user */
export async function getRecentActions(userId: number, days = 7) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userMarketAwarenessActions)
    .where(
      and(
        eq(userMarketAwarenessActions.userId, userId),
        gte(userMarketAwarenessActions.completedAt, since)
      )
    )
    .orderBy(desc(userMarketAwarenessActions.completedAt));
}
