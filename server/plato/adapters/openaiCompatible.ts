import { invokeLLM, type InvokeParams, type InvokeResult, type Message } from "../../_core/llm";
import type { PlatoProviderId } from "../config";
import { classifyTransportError, PlatoRouteError } from "../errors";

export interface PlatoAdapterRequest {
  messages: Message[];
  /** Set by the router. Manus v2 rejects FAST. */
  taskType?: "FAST" | "DEEP_REASONING" | "FALLBACK";
  tools?: InvokeParams["tools"];
  toolChoice?: InvokeParams["toolChoice"];
  tool_choice?: InvokeParams["tool_choice"];
  maxTokens?: InvokeParams["maxTokens"];
  max_tokens?: InvokeParams["max_tokens"];
  outputSchema?: InvokeParams["outputSchema"];
  output_schema?: InvokeParams["output_schema"];
  responseFormat?: InvokeParams["responseFormat"];
  response_format?: InvokeParams["response_format"];
}

export interface PlatoAdapterResult {
  response: InvokeResult;
  provider: string;
  model: string;
  retries?: number;
  manusTaskId?: string;
  manusStatus?: string;
  creditUsage?: number;
}

export interface PlatoAdapter {
  id: PlatoProviderId;
  model: string;
  complete(request: PlatoAdapterRequest): Promise<PlatoAdapterResult>;
}

export function isGeminiOpenAiCompatBase(base: string): boolean {
  const normalized = base.trim().replace(/\/$/, "");
  if (!normalized) return false;
  if (normalized.endsWith("/openai")) return true;
  try {
    return new URL(normalized).hostname === "generativelanguage.googleapis.com";
  } catch {
    return false;
  }
}

/** Gemini's OpenAI-compatible catalog prefixes ids with `models/`. Chat expects the bare id. */
export function canonicalModelIdForBase(model: string, baseUrl: string): string {
  const trimmed = model.trim();
  if (!isGeminiOpenAiCompatBase(baseUrl)) return trimmed;
  return trimmed.replace(/^models\//, "");
}

const GATEWAY_DISABLED =
  "Manus inference gateway is disabled pending confirmation that external use is officially supported.";

export function createOpenAiCompatibleAdapter(options: {
  providerId?: Extract<PlatoProviderId, "openai-compatible" | "manus-gateway">;
  model: string;
  baseUrl?: string;
  invoke?: (params: InvokeParams) => Promise<InvokeResult>;
  enabled?: boolean;
  disabledReason?: string;
}): PlatoAdapter {
  const providerId = options.providerId ?? "openai-compatible";
  const model = canonicalModelIdForBase(options.model, options.baseUrl ?? "");
  return {
    id: providerId,
    model,
    async complete(request) {
      if (options.enabled === false) {
        throw new PlatoRouteError(options.disabledReason ?? "PLATO provider is not configured.", {
          httpStatus: null,
          rateLimited: false,
          errorClass: "unavailable",
          provider: providerId,
          model,
        });
      }
      try {
        const invoke = options.invoke ?? invokeLLM;
        const response = await invoke({
          messages: request.messages,
          tools: request.tools,
          toolChoice: request.toolChoice,
          tool_choice: request.tool_choice,
          maxTokens: request.maxTokens,
          max_tokens: request.max_tokens,
          outputSchema: request.outputSchema,
          output_schema: request.output_schema,
          responseFormat: request.responseFormat,
          response_format: request.response_format,
          model,
        });
        return { response, provider: providerId, model };
      } catch (error) {
        throw classifyTransportError(error, providerId, model);
      }
    },
  };
}

/**
 * Forge-style OpenAI-compatible adapter for a Manus inference gateway.
 * HARD-DISABLED. Refuses to run unless PLATO_MANUS_GATEWAY_ENABLED=true and
 * PLATO_MANUS_GATEWAY_BASE_URL is set. There is no default URL.
 * Pending Manus confirmation that external use is officially supported.
 */
export function createManusGatewayAdapter(options: {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): PlatoAdapter {
  const ready = options.enabled && options.baseUrl.trim().length > 0 && options.apiKey.trim().length > 0;
  const baseUrl = options.baseUrl.trim().replace(/\/$/, "");
  return createOpenAiCompatibleAdapter({
    providerId: "manus-gateway",
    model: options.model,
    baseUrl,
    enabled: ready,
    disabledReason: GATEWAY_DISABLED,
    invoke: async params => {
      const response = await (options.fetchImpl ?? fetch)(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model,
          messages: params.messages,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText.slice(0, 400)}`);
      }
      return await response.json() as InvokeResult;
    },
  });
}
