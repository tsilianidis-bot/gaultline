import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  model?: string;
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  /** Aborts the HTTP request (used by the PLATO router's per-attempt deadline). Not sent to the provider. */
  signal?: AbortSignal;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type LLMModel = {
  id: string;
  object?: string;
  owned_by?: string;
  capabilities?: Record<string, unknown>;
};

export type ListLLMModelsResult = {
  object?: string;
  data: LLMModel[];
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

/**
 * In-process protection for an explicit daily/free-tier quota. The circuit is
 * keyed by model so a confirmed exhaustion does not cause repeated calls to
 * the same model, while a separately configured PLATO fallback can still run.
 */
const quotaCircuitByModel = new Map<string, number>();

function nextPacificMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const nextDate = new Date(Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day")) + 1));
  const base = Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate());
  const offsetAt = (utcMs: number) => {
    const offset = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" })
      .formatToParts(new Date(utcMs))
      .find(part => part.type === "timeZoneName")?.value ?? "GMT";
    const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(offset);
    if (!match) return 0;
    const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
    return (match[1] === "+" ? 1 : -1) * minutes * 60_000;
  };
  // Resolve midnight in the named timezone rather than assuming a fixed PST/PDT offset.
  let midnightUtc = base;
  for (let i = 0; i < 2; i++) midnightUtc = base - offsetAt(midnightUtc);
  // A short post-reset buffer prevents a boundary race with the provider.
  return midnightUtc + 60_000;
}

function retryAfterMs(response: Response, errorText: string): number | null {
  const header = response.headers.get("retry-after")?.trim() ?? "";
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(Math.round(seconds * 1_000), 60 * 60_000);
  const providerDelay = errorText.match(/retry(?:[_ -]?delay|[_ -]?after)[^0-9]{0,80}(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?/i);
  if (!providerDelay) return null;
  const parsed = Number(providerDelay[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.round(parsed * 1_000), 60 * 60_000) : null;
}

function isDailyQuotaExhaustion(errorText: string): boolean {
  return /free[ -]?tier|requests?\s+per\s+day|per[- ]day|quota\s+limit\s*[:=]?\s*20\b|daily\s+quota/i.test(errorText);
}

function assertQuotaCircuitOpen(model: string): void {
  const until = quotaCircuitByModel.get(model);
  if (!until) return;
  if (until <= Date.now()) {
    quotaCircuitByModel.delete(model);
    return;
  }
  const retrySeconds = Math.max(1, Math.ceil((until - Date.now()) / 1_000));
  throw new Error(`LLM provider quota circuit is open for model ${model}; retry-after-ms=${retrySeconds * 1_000}`);
}

/** Test seam only; production code never clears an active provider quota circuit. */
export function resetLlmQuotaCircuitForTests(): void {
  quotaCircuitByModel.clear();
}

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const gatewayBaseUrl = () => {
  assertGatewayConfig();
  return ENV.forgeApiUrl.trim().replace(/\/$/, "");
};

const usesGeminiOpenAiCompatPath = (base: string): boolean => {
  if (base.endsWith("/openai")) {
    return true;
  }
  try {
    return new URL(base).hostname === "generativelanguage.googleapis.com";
  } catch {
    return false;
  }
};

const resolveApiUrl = () => {
  const base = gatewayBaseUrl();
  return usesGeminiOpenAiCompatPath(base)
    ? `${base}/chat/completions`
    : `${base}/v1/chat/completions`;
};

const resolveModelsApiUrl = () => {
  const base = gatewayBaseUrl();
  return usesGeminiOpenAiCompatPath(base)
    ? `${base}/models`
    : `${base}/v1/models`;
};

const assertGatewayConfig = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
  if (!ENV.forgeApiUrl || ENV.forgeApiUrl.trim().length === 0) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertGatewayConfig();

  const {
    model,
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    maxTokens,
    max_tokens,
    signal,
  } = params;

  const selectedModel = model ?? "gemini-3-flash-preview";
  assertQuotaCircuitOpen(selectedModel);

  const payload: Record<string, unknown> = {
    model: selectedModel,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = maxTokens ?? max_tokens ?? 32768;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const waitMs = retryAfterMs(response, errorText);
    if (response.status === 429 && isDailyQuotaExhaustion(errorText)) {
      quotaCircuitByModel.set(selectedModel, nextPacificMidnight());
    }
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText}${waitMs ? ` retry-after-ms=${waitMs}` : ""} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

export async function listLLMModels(): Promise<ListLLMModelsResult> {
  assertGatewayConfig();

  const response = await fetch(resolveModelsApiUrl(), {
    headers: {
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM model catalog failed: ${response.status} ${response.statusText} – ${errorText}`,
    );
  }

  const result = (await response.json()) as ListLLMModelsResult;
  if (!Array.isArray(result.data)) {
    throw new Error("LLM model catalog returned an invalid response");
  }
  return result;
}
