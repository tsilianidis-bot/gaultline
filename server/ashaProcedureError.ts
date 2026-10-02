import { TRPCError } from "@trpc/server";
import { AshaProviderError, isAshaRateLimitError } from "./ashaGateway";

const RATE_LIMIT_MESSAGE = "PLATO is temporarily unavailable because the language model is at capacity. Please try again later.";
const UNAVAILABLE_MESSAGE = "PLATO is temporarily unavailable. Please try again.";

/** Map a provider failure to a tRPC error the panel can show without replaying the summon intro. */
export function mapAshaProcedureError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  if (isAshaRateLimitError(error) || (error instanceof AshaProviderError && error.rateLimited)) {
    return new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: RATE_LIMIT_MESSAGE,
      cause: error instanceof Error ? error : undefined,
    });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: UNAVAILABLE_MESSAGE,
    cause: error instanceof Error ? error : undefined,
  });
}
