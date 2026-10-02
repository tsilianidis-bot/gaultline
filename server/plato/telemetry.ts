import { log } from "../logger";
import type { PlatoTaskType } from "./config";

export interface PlatoTelemetry {
  provider: string;
  model: string;
  taskType: PlatoTaskType;
  latencyMs: number;
  success: boolean;
  errorClass: string | null;
  retries: number;
  fallbackUsed: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  timestamp: string;
  manusTaskId?: string;
  manusStatus?: string;
  creditUsage?: number;
}

export function logPlatoCall(event: PlatoTelemetry): void {
  const payload: Record<string, unknown> = {
    provider: event.provider,
    model: event.model,
    taskType: event.taskType,
    latencyMs: event.latencyMs,
    success: event.success,
    errorClass: event.errorClass,
    retries: event.retries,
    fallbackUsed: event.fallbackUsed,
    promptTokens: event.promptTokens,
    completionTokens: event.completionTokens,
    totalTokens: event.totalTokens,
    timestamp: event.timestamp,
  };
  if (event.manusTaskId) payload.manusTaskId = event.manusTaskId;
  if (event.manusStatus) payload.manusStatus = event.manusStatus;
  if (typeof event.creditUsage === "number") payload.creditUsage = event.creditUsage;
  if (event.success) log.info("[PLATO] model call", payload);
  else log.warn("[PLATO] model call", payload);
}
