/**
 * FAULTLINE Pipeline Logger
 * server/pipelineLogger.ts
 *
 * Writes structured failure records to pipeline_health_log.
 * Every provider failure is logged with full context so the
 * Admin Diagnostics / Pipeline Health dashboard can surface it.
 *
 * Usage:
 *   const t0 = Date.now();
 *   try { ... } catch (err) {
 *     await logPipelineFailure({ provider: "yahoo", endpoint: "getQuote", latencyMs: Date.now() - t0, failureReason: String(err) });
 *   }
 */
import { getDb } from "./db";
import { pipelineHealthLog } from "../drizzle/schema";
import { log } from "./logger";

export type Provider =
  | "polygon"
  | "yahoo"
  | "coingecko"
  | "fred"
  | "news"
  | "llm"
  | "social"
  | "ledger"
  | "signals"
  | "other";

export type RecoveryStatus =
  | "cache"
  | "snapshot"
  | "fallback"
  | "recovered"
  | "unresolved";

export interface PipelineFailureInput {
  provider: Provider;
  endpoint: string;
  responseCode?: number;
  latencyMs?: number;
  failureReason?: string;
  retryAttempts?: number;
  recoveryStatus?: RecoveryStatus;
  resolutionTimeMs?: number;
  autoRecovered?: boolean;
}

/**
 * Log a pipeline failure to the database.
 * Non-fatal — never throws, never blocks the caller.
 */
export async function logPipelineFailure(input: PipelineFailureInput): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(pipelineHealthLog).values({
      provider: input.provider,
      endpoint: input.endpoint,
      responseCode: input.responseCode ?? null,
      latencyMs: input.latencyMs ?? null,
      failureReason: input.failureReason ? input.failureReason.slice(0, 2000) : null,
      retryAttempts: input.retryAttempts ?? 0,
      recoveryStatus: input.recoveryStatus ?? null,
      resolutionTimeMs: input.resolutionTimeMs ?? null,
      autoRecovered: input.autoRecovered ?? false,
    });
  } catch (err) {
    // Never let logging failures propagate
    log.warn("[PipelineLogger] Failed to write failure log", { err: String(err) });
  }
}

/**
 * Convenience wrapper: time a function call and log any failure.
 * Returns the result on success, or null on failure.
 */
export async function withPipelineLogging<T>(
  provider: Provider,
  endpoint: string,
  fn: () => Promise<T>,
  opts?: { retryAttempts?: number }
): Promise<{ result: T; latencyMs: number } | null> {
  const t0 = Date.now();
  try {
    const result = await fn();
    return { result, latencyMs: Date.now() - t0 };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    await logPipelineFailure({
      provider,
      endpoint,
      latencyMs,
      failureReason: String(err),
      retryAttempts: opts?.retryAttempts ?? 0,
      recoveryStatus: "unresolved",
      autoRecovered: false,
    });
    return null;
  }
}
