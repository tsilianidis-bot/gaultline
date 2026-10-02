import type { InvokeParams, InvokeResult } from "../_core/llm";
import { createOpenAiCompatibleAdapter, type PlatoAdapter, type PlatoAdapterRequest } from "./adapters/openaiCompatible";
import { readPlatoConfig, PLATO_MAX_RETRY_DELAY_MS, type PlatoConfig, type PlatoTaskType } from "./config";
import {
  classifyTransportError,
  isRetryableOnSameModel,
  PlatoRouteError,
  PlatoUnavailableError,
  shouldFallback,
  type PlatoAttemptRecord,
  type PlatoErrorClass,
} from "./errors";
import { logPlatoCall, type PlatoTelemetry } from "./telemetry";

export type PlatoCompletionRequest = PlatoAdapterRequest;

/**
 * One budget per user question. The answer call and any correction call share
 * it, so a question never exceeds `maxAttempts` provider calls or the total
 * deadline, however many router calls it makes.
 */
export interface PlatoBudget {
  readonly deadline: number;
  readonly maxAttempts: number;
  attemptsUsed: number;
}

export function createPlatoBudget(config: PlatoConfig = readPlatoConfig(), now: () => number = Date.now): PlatoBudget {
  return { deadline: now() + config.totalDeadlineMs, maxAttempts: config.maxAttempts, attemptsUsed: 0 };
}

export function platoBudgetExhausted(budget: PlatoBudget, now: () => number = Date.now): boolean {
  return budget.attemptsUsed >= budget.maxAttempts || budget.deadline - now() <= 0;
}

/** Caller-specific acceptance check on a 200 answer. Return a failure class to reject it and try the next model. */
export type PlatoResponseValidator = (response: InvokeResult) => "empty_response" | "malformed_response" | null;

const BLOCKED_FINISH_REASONS = new Set([
  "content_filter", "safety", "recitation", "prohibited_content", "blocklist", "spii", "image_safety",
]);

function stripCodeFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function wantsJson(request: PlatoCompletionRequest): boolean {
  const format = request.responseFormat ?? request.response_format;
  return Boolean(format && (format.type === "json_schema" || format.type === "json_object"))
    || Boolean(request.outputSchema ?? request.output_schema);
}

/**
 * A 200 is only a success when it carries a usable answer. No choices, empty or
 * null content, a safety/content-filter stop, a truncated (length) stop, or
 * non-JSON content when JSON was requested are failures that move to the next model.
 */
export function checkPlatoResponse(
  response: InvokeResult,
  request: PlatoCompletionRequest,
): "empty_response" | "malformed_response" | null {
  const choice = response?.choices?.[0];
  if (!choice || !choice.message) return "empty_response";
  const finish = typeof choice.finish_reason === "string" ? choice.finish_reason.toLowerCase() : "";
  if (BLOCKED_FINISH_REASONS.has(finish)) return "empty_response";
  const content = choice.message.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map(part => (part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "")).join("")
      : "";
  const hasToolCalls = Array.isArray(choice.message.tool_calls) && choice.message.tool_calls.length > 0;
  if (!text.trim() && !hasToolCalls) return "empty_response";
  if (finish === "length") return "malformed_response";
  if (wantsJson(request) && !hasToolCalls) {
    try {
      const parsed = JSON.parse(stripCodeFences(text));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "malformed_response";
    } catch {
      return "malformed_response";
    }
  }
  return null;
}

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
  /** Shared per-question budget. Omitted: a fresh budget for this call only. */
  budget?: PlatoBudget;
  /** Extra caller check on a 200 answer (e.g. PLATO requires a non-empty `reply`). */
  validateResponse?: PlatoResponseValidator;
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

  const budget = dependencies.budget ?? createPlatoBudget(config, now);
  const deadline = budget.deadline;
  const attempts: PlatoAttemptRecord[] = [];
  let fallbackReason: PlatoErrorClass | null = null;
  let lastError: PlatoRouteError | null = null;

  for (let modelIndex = 0; modelIndex < adapters.length; modelIndex++) {
    const adapter = adapters[modelIndex];
    const isFallback = modelIndex > 0;
    let sameModelRetry = 0;

    while (budget.attemptsUsed < budget.maxAttempts) {
      const remaining = deadline - now();
      if (remaining <= 0) break;
      const attemptStarted = now();
      budget.attemptsUsed++;
      const attemptNumber = budget.attemptsUsed;
      try {
        const result = await runWithDeadline(
          signal => adapter.complete(request, { signal }),
          Math.min(config.attemptTimeoutMs, remaining),
          adapter,
        );
        const unusable = checkPlatoResponse(result.response, request) ?? dependencies.validateResponse?.(result.response) ?? null;
        if (unusable) {
          throw new PlatoRouteError(`PLATO provider returned 200 without a usable answer (${unusable}).`, {
            httpStatus: 200,
            errorClass: unusable,
            provider: result.provider,
            model: result.model,
          });
        }
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
          // Class and status only: no upstream message body, redacted or not, is logged.
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
    if (platoBudgetExhausted(budget, now)) break;
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
