import { log } from "../logger";
import type { PlatoErrorClass } from "./errors";
import type { PlatoTaskType } from "./config";

/**
 * One structured log line per provider attempt. Contains routing metadata only:
 * never the prompt, the user's question, history, page context, the answer,
 * API keys or the gateway URL. `detail` is a redacted, bounded upstream status
 * summary and is present only on failures.
 */
export interface PlatoTelemetry {
  provider: string;
  model: string;
  taskType: PlatoTaskType;
  attempt: number;
  latencyMs: number;
  success: boolean;
  errorClass: PlatoErrorClass | null;
  httpStatus: number | null;
  /** Why this attempt is a fallback (the previous attempt's error class), or null for the first attempt. */
  fallbackReason: PlatoErrorClass | null;
  fallbackUsed: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  timestamp: string;
  detail?: string;
}

export function logPlatoCall(event: PlatoTelemetry): void {
  const payload: Record<string, unknown> = {
    provider: event.provider,
    model: event.model,
    taskType: event.taskType,
    attempt: event.attempt,
    latencyMs: event.latencyMs,
    success: event.success,
    errorClass: event.errorClass,
    httpStatus: event.httpStatus,
    fallbackReason: event.fallbackReason,
    fallbackUsed: event.fallbackUsed,
    promptTokens: event.promptTokens,
    completionTokens: event.completionTokens,
    totalTokens: event.totalTokens,
    timestamp: event.timestamp,
  };
  if (event.detail) payload.detail = event.detail;
  if (event.success) log.info("[PLATO] model call", payload);
  else log.warn("[PLATO] model call", payload);
}
