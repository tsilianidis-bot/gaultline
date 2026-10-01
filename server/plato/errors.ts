export type PlatoErrorClass =
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "provider_5xx"
  | "provider_error"
  | "invalid_argument";

export class PlatoRouteError extends Error {
  readonly httpStatus: number | null;
  readonly rateLimited: boolean;
  readonly errorClass: PlatoErrorClass;
  readonly provider: string;
  readonly model: string;
  readonly attemptedModels: string[];

  constructor(
    message: string,
    details: {
      httpStatus: number | null;
      rateLimited: boolean;
      errorClass: PlatoErrorClass;
      provider: string;
      model: string;
      attemptedModels?: string[];
    },
  ) {
    super(message);
    this.name = "PlatoRouteError";
    this.httpStatus = details.httpStatus;
    this.rateLimited = details.rateLimited;
    this.errorClass = details.errorClass;
    this.provider = details.provider;
    this.model = details.model;
    this.attemptedModels = details.attemptedModels ?? [details.model];
  }
}

export function classifyTransportError(error: unknown, provider: string, model: string): PlatoRouteError {
  if (error instanceof PlatoRouteError) return error;
  const message = error instanceof Error ? error.message : "unknown provider failure";
  const statusMatch = message.match(/\b(?:LLM invoke failed|LLM model catalog failed): (\d{3})\b/);
  const status = statusMatch
    ? Number(statusMatch[1])
    : /RESOURCE_EXHAUSTED/i.test(message) ? 429 : null;
  const rateLimited = status === 429 || /RESOURCE_EXHAUSTED/i.test(message) || /rate_limited/i.test(message);
  const errorClass: PlatoErrorClass = rateLimited
    ? "rate_limited"
    : status !== null && status >= 500
      ? "provider_5xx"
      : "provider_error";
  return new PlatoRouteError(message, {
    httpStatus: status,
    rateLimited,
    errorClass,
    provider,
    model,
  });
}

/** Fallback is for capacity, outages, and timeouts. A bad request is not retried on another vendor. */
export function shouldFallback(error: unknown): boolean {
  if (!(error instanceof PlatoRouteError)) return false;
  if (error.rateLimited || error.errorClass === "timeout" || error.errorClass === "unavailable") return true;
  return error.httpStatus !== null && error.httpStatus >= 500;
}
