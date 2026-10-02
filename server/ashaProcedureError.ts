import { TRPCError } from "@trpc/server";
import { PlatoRouteError, PlatoUnavailableError, type PlatoUnavailableReason } from "./plato/errors";
import { PLATO_DAILY_LIMIT_MESSAGE, PLATO_USER_DAILY_LIMIT_MESSAGE } from "../shared/ashaPanelMachine";

/**
 * Client-safe PLATO failure messages. Each starts with the same title so every
 * existing surface (AshaPanel, AshaIntelligenceBrief, greeting) can show it as is.
 * Upstream provider text is never included.
 */
export const PLATO_UNAVAILABLE_MESSAGES: Record<PlatoUnavailableReason, string> = {
  quota: "PLATO is temporarily unavailable: the language model's usage limit has been reached. Please try again later.",
  capacity: "PLATO is temporarily unavailable: the language model is under high demand. Please try again in a few minutes.",
  timeout: "PLATO is temporarily unavailable: the language model did not respond in time. Please try again.",
  misconfigured: "PLATO is temporarily unavailable. Please try again later.",
  provider_error: "PLATO is temporarily unavailable. Please try again.",
  // App-side daily caps: honest copy, no answer, no Retry on the client.
  daily_limit: PLATO_DAILY_LIMIT_MESSAGE,
  user_daily_limit: PLATO_USER_DAILY_LIMIT_MESSAGE,
};

const REASON_TO_CODE: Record<PlatoUnavailableReason, TRPCError["code"]> = {
  quota: "TOO_MANY_REQUESTS",
  capacity: "SERVICE_UNAVAILABLE",
  timeout: "SERVICE_UNAVAILABLE",
  misconfigured: "INTERNAL_SERVER_ERROR",
  provider_error: "SERVICE_UNAVAILABLE",
  daily_limit: "TOO_MANY_REQUESTS",
  user_daily_limit: "TOO_MANY_REQUESTS",
};

export function platoUnavailableReasonOf(error: unknown): PlatoUnavailableReason | null {
  if (error instanceof PlatoUnavailableError) return error.reason;
  if (error instanceof PlatoRouteError) {
    if (error.errorClass === "quota") return "quota";
    if (error.errorClass === "daily_limit") return "daily_limit";
    if (error.errorClass === "capacity" || error.errorClass === "provider_5xx" || error.errorClass === "network") return "capacity";
    if (error.errorClass === "timeout") return "timeout";
    if (error.errorClass === "auth" || error.errorClass === "bad_request") return "misconfigured";
    return "provider_error";
  }
  return null;
}

/**
 * Map a PLATO failure to a typed tRPC error:
 * - quota → TOO_MANY_REQUESTS (429)
 * - capacity / timeout / transient provider failure → SERVICE_UNAVAILABLE (503)
 * - misconfiguration or unknown failure → INTERNAL_SERVER_ERROR (500) with a generic message
 */
export function mapAshaProcedureError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  const reason = platoUnavailableReasonOf(error) ?? "provider_error";
  const code = platoUnavailableReasonOf(error) === null ? "INTERNAL_SERVER_ERROR" : REASON_TO_CODE[reason];
  return new TRPCError({
    code,
    message: PLATO_UNAVAILABLE_MESSAGES[reason],
    cause: error instanceof Error ? error : undefined,
  });
}

/** Routing metadata for server logs. No prompt, question, answer or key. */
export function platoFailureLogFields(error: unknown): Record<string, unknown> {
  if (error instanceof PlatoUnavailableError) {
    return {
      reason: error.reason,
      attempts: error.attempts.map(attempt => ({
        provider: attempt.provider,
        model: attempt.model,
        errorClass: attempt.errorClass,
        httpStatus: attempt.httpStatus,
      })),
    };
  }
  return { reason: "non_provider_failure", errorName: error instanceof Error ? error.name : typeof error };
}
