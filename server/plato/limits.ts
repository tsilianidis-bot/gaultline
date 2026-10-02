/**
 * App-side PLATO usage and cost limits.
 *
 * Defaults live here; each can be overridden by an optional env variable when it is
 * set (none are set in production today, and setting them is James's call):
 * - PLATO_USER_DAILY_QUESTION_LIMIT  per signed-in user, asha.ask questions per UTC day (default 50)
 * - PLATO_GLOBAL_DAILY_CALL_LIMIT    all PLATO provider calls per UTC day, retries, fallbacks,
 *                                    corrections and greetings included (default 2000)
 * - PLATO_MAX_OUTPUT_TOKENS          max_tokens sent on every PLATO call (default 8192, clamped 1024–32768).
 *                                    On Gemini 3 this caps thinking + visible output combined.
 *
 * Counting is in memory, per server process, keyed by UTC date. There is no shared store and no
 * migration: counts reset when the process restarts, and with N replicas the effective caps are N×.
 */
import { log } from "../logger";

export const PLATO_DEFAULT_USER_DAILY_QUESTIONS = 50;
export const PLATO_DEFAULT_GLOBAL_DAILY_CALLS = 2000;
export const PLATO_DEFAULT_MAX_OUTPUT_TOKENS = 8192;
export const PLATO_MIN_OUTPUT_TOKENS = 1024;
export const PLATO_MAX_OUTPUT_TOKENS_CEILING = 32768;

export interface PlatoLimits {
  userDailyQuestions: number;
  globalDailyCalls: number;
  maxOutputTokens: number;
}

function readPositiveInt(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

export function readPlatoLimits(env: NodeJS.ProcessEnv = process.env): PlatoLimits {
  const tokens = readPositiveInt(env.PLATO_MAX_OUTPUT_TOKENS) ?? PLATO_DEFAULT_MAX_OUTPUT_TOKENS;
  return {
    userDailyQuestions: readPositiveInt(env.PLATO_USER_DAILY_QUESTION_LIMIT) ?? PLATO_DEFAULT_USER_DAILY_QUESTIONS,
    globalDailyCalls: readPositiveInt(env.PLATO_GLOBAL_DAILY_CALL_LIMIT) ?? PLATO_DEFAULT_GLOBAL_DAILY_CALLS,
    maxOutputTokens: Math.min(PLATO_MAX_OUTPUT_TOKENS_CEILING, Math.max(PLATO_MIN_OUTPUT_TOKENS, tokens)),
  };
}

/** max_tokens for one PLATO call: the caller's value if lower, never above the cap. */
export function platoMaxTokens(requested: number | undefined, cap: number): number {
  return typeof requested === "number" && Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), cap) : cap;
}

/** In-memory, per-process daily counters keyed by UTC date. */
export class PlatoUsageCounter {
  private day = "";
  private globalCalls = 0;
  private readonly userQuestions = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  private roll(): void {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.globalCalls = 0;
      this.userQuestions.clear();
    }
  }

  /** Counts one provider call. False (nothing counted) when today's global cap is reached. */
  tryConsumeGlobalCall(limit: number): boolean {
    this.roll();
    if (this.globalCalls >= limit) {
      log.warn("[PLATO] daily limit reached", { scope: "global", limit });
      return false;
    }
    this.globalCalls++;
    return true;
  }

  /** Reserves one question for this user. False (nothing reserved) when the user's cap is reached. */
  tryReserveUserQuestion(userId: string | number, limit: number): boolean {
    this.roll();
    const key = String(userId);
    const used = this.userQuestions.get(key) ?? 0;
    if (used >= limit) {
      log.warn("[PLATO] daily limit reached", { scope: "user", limit });
      return false;
    }
    this.userQuestions.set(key, used + 1);
    return true;
  }

  /** Gives a reserved question back (PLATO could not answer it). */
  releaseUserQuestion(userId: string | number): void {
    this.roll();
    const key = String(userId);
    const used = this.userQuestions.get(key) ?? 0;
    if (used <= 1) this.userQuestions.delete(key);
    else this.userQuestions.set(key, used - 1);
  }

  snapshot(): { day: string; globalCalls: number; users: number } {
    this.roll();
    return { day: this.day, globalCalls: this.globalCalls, users: this.userQuestions.size };
  }

  questionsUsed(userId: string | number): number {
    this.roll();
    return this.userQuestions.get(String(userId)) ?? 0;
  }

  reset(): void {
    this.day = "";
    this.globalCalls = 0;
    this.userQuestions.clear();
  }
}

/** Process-wide counter used by the router and the asha.ask procedure. */
export const platoUsage = new PlatoUsageCounter();
