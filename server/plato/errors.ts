/**
 * Typed PLATO provider failures.
 *
 * Every provider failure is classified once, here. The router decides retry
 * and fallback from the class; the tRPC layer maps the final class to a
 * client-safe error. Raw upstream text is kept for server logs only after
 * redaction and is never sent to the client.
 */
export type PlatoErrorClass =
  /** 429 / RESOURCE_EXHAUSTED: quota or rate limit on this model. */
  | "quota"
  /** 503 / UNAVAILABLE / overloaded / "high demand". */
  | "capacity"
  /** Attempt exceeded its deadline. */
  | "timeout"
  /** Other 5xx (500, 502, 504). */
  | "provider_5xx"
  /** Connection reset, DNS failure, fetch failed. */
  | "network"
  /** 404: model retired or not offered on this key. Another model may work. */
  | "model_unavailable"
  /** 401 / 403 or missing gateway config. Every model shares the key, so no fallback helps. */
  | "auth"
  /** 400 / 422: the request itself was rejected. Not retried anywhere. */
  | "bad_request"
  /** 200 with no usable answer: no choices, empty/null content, or a safety/content-filter block. */
  | "empty_response"
  /** 200 with an answer that cannot be used: truncated (finish_reason=length) or not the requested JSON. */
  | "malformed_response"
  | "provider_error";

/** Final, client-facing reason when PLATO cannot answer. */
export type PlatoUnavailableReason = "quota" | "capacity" | "timeout" | "misconfigured" | "provider_error";

export class PlatoRouteError extends Error {
  readonly httpStatus: number | null;
  readonly errorClass: PlatoErrorClass;
  readonly provider: string;
  readonly model: string;

  constructor(
    message: string,
    details: { httpStatus: number | null; errorClass: PlatoErrorClass; provider: string; model: string },
  ) {
    super(message);
    this.name = "PlatoRouteError";
    this.httpStatus = details.httpStatus;
    this.errorClass = details.errorClass;
    this.provider = details.provider;
    this.model = details.model;
  }

  get rateLimited(): boolean {
    return this.errorClass === "quota";
  }
}

export interface PlatoAttemptRecord {
  provider: string;
  model: string;
  errorClass: PlatoErrorClass;
  httpStatus: number | null;
}

/** Thrown when every allowed attempt failed. Never carries a fabricated answer. */
export class PlatoUnavailableError extends Error {
  readonly reason: PlatoUnavailableReason;
  readonly attempts: PlatoAttemptRecord[];
  readonly lastError: PlatoRouteError;

  constructor(lastError: PlatoRouteError, attempts: PlatoAttemptRecord[]) {
    super(`PLATO unavailable after ${attempts.length} attempt(s): ${lastError.errorClass}`);
    this.name = "PlatoUnavailableError";
    this.lastError = lastError;
    this.attempts = attempts;
    this.reason = unavailableReason(attempts);
  }

  get attemptedModels(): string[] {
    return this.attempts.map(attempt => attempt.model);
  }

  get httpStatus(): number | null {
    return this.lastError.httpStatus;
  }

  get rateLimited(): boolean {
    return this.reason === "quota";
  }
}

/**
 * Summarises why the whole chain failed. Configuration problems win because no
 * retry fixes them; then quota if every model was exhausted; then capacity or
 * timeout for transient demand.
 */
export function unavailableReason(attempts: readonly PlatoAttemptRecord[]): PlatoUnavailableReason {
  const classes = new Set(attempts.map(attempt => attempt.errorClass));
  if (classes.has("auth") || classes.has("bad_request")) return "misconfigured";
  if (classes.size > 0 && Array.from(classes).every(entry => entry === "quota" || entry === "model_unavailable") && classes.has("quota")) {
    return "quota";
  }
  if (classes.has("capacity") || classes.has("provider_5xx") || classes.has("network")) return "capacity";
  if (classes.has("timeout")) return "timeout";
  if (classes.has("quota")) return "quota";
  return "provider_error";
}

const STATUS_PATTERN = /\b(?:LLM invoke failed|LLM model catalog failed): (\d{3})\b/;

export function classifyStatus(status: number | null, message: string): PlatoErrorClass {
  if (status !== null) {
    if (status === 429) return "quota";
    if (status === 503) return "capacity";
    if (status === 504 || status === 408) return "timeout";
    if (status >= 500) return /high demand|overloaded/i.test(message) ? "capacity" : "provider_5xx";
    if (status === 404) return "model_unavailable";
    if (status === 401 || status === 403) return "auth";
    if (/RESOURCE_EXHAUSTED/.test(message)) return "quota";
    if (status === 400 || status === 422) return "bad_request";
    return "provider_error";
  }
  if (/RESOURCE_EXHAUSTED|exceeded your current quota|rate[ _-]?limit/i.test(message)) return "quota";
  if (/high demand|overloaded|\bUNAVAILABLE\b/.test(message)) return "capacity";
  if (/DEADLINE_EXCEEDED|timed out/i.test(message)) return "timeout";
  if (/is not configured|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) return "auth";
  if (/fetch failed|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|UND_ERR|socket hang up|network/i.test(message)) {
    return "network";
  }
  return "provider_error";
}

export function classifyTransportError(error: unknown, provider: string, model: string): PlatoRouteError {
  if (error instanceof PlatoRouteError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new PlatoRouteError("PLATO provider attempt timed out.", { httpStatus: null, errorClass: "timeout", provider, model });
  }
  const message = error instanceof Error ? error.message : "unknown provider failure";
  const cause = error instanceof Error && error.cause instanceof Error ? ` ${error.cause.message}` : "";
  const statusMatch = message.match(STATUS_PATTERN);
  const status = statusMatch ? Number(statusMatch[1]) : null;
  return new PlatoRouteError(message, {
    httpStatus: status,
    errorClass: classifyStatus(status, message + cause),
    provider,
    model,
  });
}

/** Same model again after a short backoff: only for transient demand or transport failures. */
export function isRetryableOnSameModel(error: PlatoRouteError): boolean {
  return error.errorClass === "capacity" || error.errorClass === "provider_5xx" || error.errorClass === "network";
}

/**
 * Next model on the same provider: quota is per model, retired models return
 * 404, and unclassified provider failures may be model-specific. Auth and
 * bad-request failures stop the chain: every model shares the key and payload.
 */
export function shouldFallback(error: unknown): boolean {
  if (!(error instanceof PlatoRouteError)) return false;
  return error.errorClass !== "auth" && error.errorClass !== "bad_request";
}

/** Server-log summary of an upstream error: status line only, key-like strings removed, bounded length. */
export function redactProviderMessage(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-key]")
    .replace(/\b(?:sk|pk|rk)-[0-9A-Za-z_-]{16,}/g, "[redacted-key]")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/[?&]key=[^&\s"']+/gi, "?key=[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

/**
 * Typed failure for a provider answer that reached the caller but cannot be
 * shown (no reply after parsing, unparseable JSON). The caller must surface
 * this instead of inventing a reply.
 */
export function unusableAnswerError(
  errorClass: "empty_response" | "malformed_response",
  provider: string,
  model: string,
): PlatoUnavailableError {
  const failure = new PlatoRouteError(`PLATO provider returned an unusable answer (${errorClass}).`, {
    httpStatus: 200,
    errorClass,
    provider,
    model,
  });
  return new PlatoUnavailableError(failure, [{ provider, model, errorClass, httpStatus: 200 }]);
}

/** Log-safe summary of any PLATO failure: class and status only, never the upstream body. */
export function platoErrorSummary(error: unknown): Record<string, unknown> {
  if (error instanceof PlatoUnavailableError) {
    return { reason: error.reason, errorClass: error.lastError.errorClass, httpStatus: error.lastError.httpStatus, attempts: error.attempts.length };
  }
  if (error instanceof PlatoRouteError) {
    return { errorClass: error.errorClass, httpStatus: error.httpStatus };
  }
  return { errorClass: "non_provider_failure", errorName: error instanceof Error ? error.name : typeof error };
}
