import { log } from "../logger";
import type { PlatoErrorClass } from "./errors";
import type { PlatoTaskType } from "./config";

/**
 * One structured log line per provider attempt. Contains routing metadata only:
 * never the prompt, the user's question, history, page context, the answer,
 * API keys, the gateway URL or any upstream error body. Failures carry only the
 * error class and HTTP status.
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
  if (event.success) log.info("[PLATO] model call", payload);
  else log.warn("[PLATO] model call", payload);
}
