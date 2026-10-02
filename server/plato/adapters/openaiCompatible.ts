import { invokeLLM, type InvokeParams, type InvokeResult, type Message } from "../../_core/llm";
import type { PlatoProviderId } from "../config";
import { classifyTransportError } from "../errors";

export interface PlatoAdapterRequest {
  messages: Message[];
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
}

export interface PlatoAdapter {
  id: PlatoProviderId;
  model: string;
  complete(request: PlatoAdapterRequest, options?: { signal?: AbortSignal }): Promise<PlatoAdapterResult>;
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

/**
 * The existing production gateway (BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY)
 * through `invokeLLM`. One adapter per model; the router walks the chain.
 */
export function createOpenAiCompatibleAdapter(options: {
  model: string;
  baseUrl?: string;
  invoke?: (params: InvokeParams) => Promise<InvokeResult>;
}): PlatoAdapter {
  const providerId: PlatoProviderId = "openai-compatible";
  const model = canonicalModelIdForBase(options.model, options.baseUrl ?? "");
  return {
    id: providerId,
    model,
    async complete(request, callOptions = {}) {
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
          signal: callOptions.signal,
        });
        return { response, provider: providerId, model };
      } catch (error) {
        throw classifyTransportError(error, providerId, model);
      }
    },
  };
}
