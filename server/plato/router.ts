import type { InvokeParams, InvokeResult } from "../_core/llm";
import { createOpenAiCompatibleAdapter, type PlatoAdapter, type PlatoAdapterRequest } from "./adapters/openaiCompatible";
import { readPlatoConfig, PLATO_MAX_RETRY_DELAY_MS, type PlatoConfig, type PlatoTaskType } from "./config";
import {
  classifyTransportError,
  isRetryableOnSameModel,
  PlatoRouteError,
  PlatoUnavailableError,
  redactProviderMessage,
  shouldFallback,
  type PlatoAttemptRecord,
  type PlatoErrorClass,
} from "./errors";
import { logPlatoCall, type PlatoTelemetry } from "./telemetry";

export type PlatoCompletionRequest = PlatoAdapterRequest;

export interface PlatoCompletion {
  response: InvokeResult;
  trace: {
    selectedModel: string;
    attemptedModels: string[];
    resolutionSource: "configured" | "router-default";
    resolvedAt: string;
    provider: string;
    taskType: PlatoTaskType;
    fallbackUsed: boolean;
    fallbackReason: PlatoErrorClass | null;
  };
  telemetry: PlatoTelemetry;
}

export interface RouteDependencies {
  config?: PlatoConfig;
  invoke?: (params: InvokeParams) => Promise<InvokeResult>;
  /** Test seam: one adapter per model, in chain order. */
  adapters?: PlatoAdapter[];
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Routes one PLATO completion through the approved provider.
 *
 * Order: primary model, then each fallback model on the same provider.
 * - quota (429), timeout, retired model (404): move to the next model.
 * - capacity (503 / "high demand"), other 5xx, network: retry the same model
 *   up to `sameModelRetries` times with jittered backoff, then move on.
 * - auth (401/403/missing key) and bad request (400): stop. No other model fixes them.
 * Every attempt has its own deadline; the whole call has a total deadline and
 * a hard attempt cap. If nothing succeeds, a typed PlatoUnavailableError is
 * thrown. The router never returns a synthetic answer.
 */
export async function routePlatoCompletion(
  request: PlatoCompletionRequest,
  dependencies: RouteDependencies = {},
): Promise<PlatoCompletion> {
  const config = dependencies.config ?? readPlatoConfig();
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? defaultSleep;
  const random = dependencies.random ?? Math.random;
  const adapters = dependencies.adapters ?? config.models.map(model => createOpenAiCompatibleAdapter({
    model,
    baseUrl: config.forgeBaseUrl,
    invoke: dependencies.invoke,
  }));

  const started = now();
  const deadline = started + config.totalDeadlineMs;
  const attempts: PlatoAttemptRecord[] = [];
  let fallbackReason: PlatoErrorClass | null = null;
  let lastError: PlatoRouteError | null = null;

  for (let modelIndex = 0; modelIndex < adapters.length; modelIndex++) {
    const adapter = adapters[modelIndex];
    const isFallback = modelIndex > 0;
    let sameModelRetry = 0;

    while (attempts.length < config.maxAttempts) {
      const remaining = deadline - now();
      if (remaining <= 0) break;
      const attemptStarted = now();
      const attemptNumber = attempts.length + 1;
      try {
        const result = await runWithDeadline(
          signal => adapter.complete(request, { signal }),
          Math.min(config.attemptTimeoutMs, remaining),
          adapter,
        );
        const usage = result.response.usage;
        const telemetry: PlatoTelemetry = {
          provider: result.provider,
          model: result.model,
          taskType: isFallback ? "FALLBACK" : "FAST",
          attempt: attemptNumber,
          latencyMs: Math.max(0, now() - attemptStarted),
          success: true,
          errorClass: null,
          httpStatus: 200,
          fallbackReason,
          fallbackUsed: isFallback,
          promptTokens: usage?.prompt_tokens ?? null,
          completionTokens: usage?.completion_tokens ?? null,
          totalTokens: usage?.total_tokens ?? null,
          timestamp: new Date(now()).toISOString(),
        };
        logPlatoCall(telemetry);
        return {
          response: result.response,
          telemetry,
          trace: {
            selectedModel: result.model,
            attemptedModels: [...attempts.map(entry => entry.model), result.model],
            resolutionSource: !isFallback && config.primaryConfigured ? "configured" : "router-default",
            resolvedAt: telemetry.timestamp,
            provider: result.provider,
            taskType: telemetry.taskType,
            fallbackUsed: isFallback,
            fallbackReason,
          },
        };
      } catch (error) {
        const failure = classifyTransportError(error, adapter.id, adapter.model);
        lastError = failure;
        attempts.push({ provider: adapter.id, model: adapter.model, errorClass: failure.errorClass, httpStatus: failure.httpStatus });
        logPlatoCall({
          provider: adapter.id,
          model: adapter.model,
          taskType: isFallback ? "FALLBACK" : "FAST",
          attempt: attemptNumber,
          latencyMs: Math.max(0, now() - attemptStarted),
          success: false,
          errorClass: failure.errorClass,
          httpStatus: failure.httpStatus,
          fallbackReason,
          fallbackUsed: isFallback,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          timestamp: new Date(now()).toISOString(),
          detail: redactProviderMessage(failure.message),
        });

        if (!shouldFallback(failure)) {
          throw new PlatoUnavailableError(failure, attempts);
        }
        if (isRetryableOnSameModel(failure) && sameModelRetry < config.sameModelRetries) {
          sameModelRetry++;
          const delay = Math.min(
            PLATO_MAX_RETRY_DELAY_MS,
            config.retryBaseDelayMs * 2 ** (sameModelRetry - 1) * (0.5 + random()),
          );
          if (now() + delay >= deadline) {
            fallbackReason = failure.errorClass;
            break;
          }
          await sleep(delay);
          continue;
        }
        fallbackReason = failure.errorClass;
        break;
      }
    }
    if (attempts.length >= config.maxAttempts || deadline - now() <= 0) break;
  }

  const final = lastError ?? new PlatoRouteError("PLATO deadline elapsed before any provider attempt.", {
    httpStatus: null,
    errorClass: "timeout",
    provider: config.provider,
    model: config.models[0] ?? "unknown",
  });
  if (attempts.length === 0) {
    attempts.push({ provider: final.provider, model: final.model, errorClass: final.errorClass, httpStatus: null });
  }
  throw new PlatoUnavailableError(final, attempts);
}

/** Runs one attempt with a deadline that also aborts the underlying HTTP request. */
async function runWithDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  adapter: PlatoAdapter,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new PlatoRouteError(`PLATO provider attempt exceeded ${timeoutMs}ms.`, {
        httpStatus: null,
        errorClass: "timeout",
        provider: adapter.id,
        model: adapter.model,
      }));
    }, timeoutMs);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
