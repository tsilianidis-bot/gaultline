import type { InvokeResult } from "../_core/llm";
import { createManusGatewayAdapter, createOpenAiCompatibleAdapter, type PlatoAdapter, type PlatoAdapterRequest } from "./adapters/openaiCompatible";
import { createManusV2Adapter } from "./adapters/manusV2";
import { readPlatoConfig, type PlatoConfig, type PlatoProviderId, type PlatoTaskType } from "./config";
import { PlatoRouteError, shouldFallback } from "./errors";
import { log } from "../logger";
import { logPlatoCall, type PlatoTelemetry } from "./telemetry";

export interface PlatoCompletionRequest extends PlatoAdapterRequest {
  /**
   * Explicit task flag. Omitted requests are FAST.
   * DEEP_REASONING is the only path that may call Manus API v2.
   */
  taskType?: Exclude<PlatoTaskType, "FALLBACK">;
  timeoutMs?: number;
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
  };
  telemetry: PlatoTelemetry;
}

interface RouteDependencies {
  config?: PlatoConfig;
  invoke?: Parameters<typeof createOpenAiCompatibleAdapter>[0]["invoke"];
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  adapters?: Partial<Record<"fast" | "reasoning" | "fallback", PlatoAdapter>>;
}

interface SelectedRoute {
  adapter: PlatoAdapter;
  provider: PlatoProviderId;
  model: string;
  configured: boolean;
  taskType: PlatoTaskType;
}

export async function routePlatoCompletion(
  request: PlatoCompletionRequest,
  dependencies: RouteDependencies = {},
): Promise<PlatoCompletion> {
  const config = dependencies.config ?? readPlatoConfig();
  const requested = request.taskType ?? "FAST";
  const primary = selectPrimary(requested, config, dependencies);
  const started = dependencies.now?.() ?? Date.now();
  const attempted = [primary.model];

  try {
    const result = await withTimeout(
      primary.adapter.complete({ ...request, taskType: requested } as PlatoAdapterRequest & { taskType?: string }),
      request.timeoutMs ?? config.fastTimeoutMs,
    );
    return finish(result, primary, attempted, false, started, dependencies.now);
  } catch (error) {
    const failure = asRouteError(error, primary);
    const telemetry = baseTelemetry(failure, primary, false, started, dependencies.now);
    logPlatoCall(telemetry);
    if (!shouldFallback(failure)) {
      failure.attemptedModels.splice(0, failure.attemptedModels.length, ...attempted);
      throw failure;
    }
    const fallback = selectFallback(requested, primary, config, dependencies);
    if (!fallback) throw failure;
    attempted.push(fallback.model);
    try {
      const result = await withTimeout(
        fallback.adapter.complete({ ...request, taskType: "FALLBACK" } as PlatoAdapterRequest & { taskType?: string }),
        request.timeoutMs ?? config.fastTimeoutMs,
      );
      return finish(result, fallback, attempted, true, started, dependencies.now, (result.retries ?? 0) + 1);
    } catch (fallbackError) {
      const second = asRouteError(fallbackError, fallback);
      second.attemptedModels.splice(0, second.attemptedModels.length, ...attempted);
      logPlatoCall(baseTelemetry(second, fallback, true, started, dependencies.now));
      throw second;
    }
  }
}

function selectPrimary(taskType: Exclude<PlatoTaskType, "FALLBACK">, config: PlatoConfig, dependencies: RouteDependencies): SelectedRoute {
  if (taskType === "DEEP_REASONING") {
    if (dependencies.adapters?.reasoning) return selected(dependencies.adapters.reasoning, "DEEP_REASONING", true);
    const provider = config.reasoningProvider ?? "openai-compatible";
    if (provider === "manus-v2") {
      return {
        adapter: manusAdapter(config, dependencies),
        provider,
        model: config.manusAgentProfile ?? "manus-v2",
        configured: true,
        taskType,
      };
    }
    return openAiRoute(provider, config.reasoningModel ?? config.fastModel, config.reasoningModel !== null || config.fastModelConfigured, taskType, config, dependencies);
  }

  if (dependencies.adapters?.fast) return selected(dependencies.adapters.fast, "FAST", true);
  if (config.fastProvider === "manus-v2") {
    log.warn("[PLATO] FAST cannot use Manus API v2; using the OpenAI-compatible adapter");
    return openAiRoute("openai-compatible", config.fastModel, config.fastModelConfigured, "FAST", config, dependencies);
  }
  if (config.fastProvider === "manus-gateway") {
    return {
      adapter: gatewayAdapter(config, dependencies),
      provider: "manus-gateway",
      model: config.gatewayModel,
      configured: true,
      taskType: "FAST",
    };
  }
  return openAiRoute("openai-compatible", config.fastModel, config.fastModelConfigured, "FAST", config, dependencies);
}

function selectFallback(
  requested: Exclude<PlatoTaskType, "FALLBACK">,
  primary: SelectedRoute,
  config: PlatoConfig,
  dependencies: RouteDependencies,
): SelectedRoute | null {
  if (requested === "FAST" && config.fallbackProvider === "manus-v2") return null;
  const fallback = dependencies.adapters?.fallback
    ? selected(dependencies.adapters.fallback, "FALLBACK", true)
    : config.fallbackProvider === "manus-v2"
      ? {
          adapter: manusAdapter(config, dependencies),
          provider: "manus-v2" as const,
          model: config.manusAgentProfile ?? "manus-v2",
          configured: true,
          taskType: "FALLBACK" as const,
        }
      : config.fallbackProvider === "manus-gateway"
        ? {
            adapter: gatewayAdapter(config, dependencies),
            provider: "manus-gateway" as const,
            model: config.gatewayModel,
            configured: config.fallbackModelConfigured,
            taskType: "FALLBACK" as const,
          }
        : openAiRoute("openai-compatible", config.fallbackModel, config.fallbackModelConfigured, "FALLBACK", config, dependencies);

  if (fallback.provider === primary.provider && fallback.model === primary.model) return null;
  return fallback;
}

function openAiRoute(
  provider: PlatoProviderId,
  model: string,
  configured: boolean,
  taskType: PlatoTaskType,
  config: PlatoConfig,
  dependencies: RouteDependencies,
): SelectedRoute {
  const adapter = provider === "manus-gateway"
    ? gatewayAdapter(config, dependencies)
    : createOpenAiCompatibleAdapter({
        model,
        baseUrl: config.forgeBaseUrl,
        invoke: dependencies.invoke,
      });
  return { adapter, provider: adapter.id, model: adapter.model, configured, taskType };
}

function manusAdapter(config: PlatoConfig, dependencies: RouteDependencies): PlatoAdapter {
  return createManusV2Adapter({
    auth: { apiKey: config.manusApiKey, oauthToken: config.manusOauthToken },
    agentProfile: config.manusAgentProfile,
    pollDeadlineMs: config.manusPollDeadlineMs,
    modelLabel: config.manusAgentProfile ?? "manus-v2",
    fetchImpl: dependencies.fetchImpl,
    now: dependencies.now,
    sleep: dependencies.sleep,
    random: dependencies.random,
  });
}

function gatewayAdapter(config: PlatoConfig, dependencies: RouteDependencies): PlatoAdapter {
  return createManusGatewayAdapter({
    enabled: config.gatewayEnabled,
    baseUrl: config.gatewayBaseUrl,
    apiKey: config.gatewayApiKey,
    model: config.gatewayModel,
    fetchImpl: dependencies.fetchImpl,
  });
}

function selected(adapter: PlatoAdapter, taskType: PlatoTaskType, configured: boolean): SelectedRoute {
  return { adapter, provider: adapter.id, model: adapter.model, configured, taskType };
}

function finish(
  result: Awaited<ReturnType<PlatoAdapter["complete"]>>,
  route: SelectedRoute,
  attempted: string[],
  fallbackUsed: boolean,
  started: number,
  now?: () => number,
  retries = result.retries ?? 0,
): PlatoCompletion {
  const timestamp = new Date(now?.() ?? Date.now()).toISOString();
  const usage = result.response.usage;
  const telemetry: PlatoTelemetry = {
    provider: result.provider,
    model: result.model,
    taskType: fallbackUsed ? "FALLBACK" : route.taskType,
    latencyMs: Math.max(0, (now?.() ?? Date.now()) - started),
    success: true,
    errorClass: null,
    retries,
    fallbackUsed,
    promptTokens: usage?.prompt_tokens ?? null,
    completionTokens: usage?.completion_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
    timestamp,
    manusTaskId: result.manusTaskId,
    manusStatus: result.manusStatus,
    creditUsage: result.creditUsage,
  };
  logPlatoCall(telemetry);
  return {
    response: result.response,
    telemetry,
    trace: {
      selectedModel: result.model,
      attemptedModels: attempted,
      resolutionSource: route.configured ? "configured" : "router-default",
      resolvedAt: timestamp,
      provider: result.provider,
      taskType: telemetry.taskType,
      fallbackUsed,
    },
  };
}

function baseTelemetry(
  error: PlatoRouteError,
  route: SelectedRoute,
  fallbackUsed: boolean,
  started: number,
  now?: () => number,
): PlatoTelemetry {
  return {
    provider: route.provider,
    model: route.model,
    taskType: fallbackUsed ? "FALLBACK" : route.taskType,
    latencyMs: Math.max(0, (now?.() ?? Date.now()) - started),
    success: false,
    errorClass: error.errorClass,
    retries: 0,
    fallbackUsed,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    timestamp: new Date(now?.() ?? Date.now()).toISOString(),
    manusTaskId: undefined,
  };
}

function asRouteError(error: unknown, route: SelectedRoute): PlatoRouteError {
  if (error instanceof PlatoRouteError) return error;
  return new PlatoRouteError(error instanceof Error ? error.message : "PLATO provider failed", {
    httpStatus: null,
    rateLimited: false,
    errorClass: "provider_error",
    provider: route.provider,
    model: route.model,
  });
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number | null): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return work;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new PlatoRouteError("PLATO provider timed out.", {
        httpStatus: null,
        rateLimited: false,
        errorClass: "timeout",
        provider: "plato",
        model: "timeout",
      }));
    }, timeoutMs);
    work.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}
