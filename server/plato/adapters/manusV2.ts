import type { InvokeResult, Message, MessageContent, ResponseFormat } from "../../_core/llm";
import type { ManusAgentProfile } from "../config";
import { PlatoRouteError } from "../errors";
import { SlidingWindowLimiter } from "../slidingWindow";
import type { PlatoAdapter, PlatoAdapterRequest, PlatoAdapterResult } from "./openaiCompatible";

/**
 * Documented Manus API v2 base. https://open.manus.ai/docs/v2/introduction.md
 * API keys grant full account access. OAuth bearer tokens are preferred when present.
 */
export const MANUS_API_BASE = "https://api.manus.ai";

/**
 * Documented user-text cap is about 5,000 estimated tokens.
 * UNVERIFIED: Manus does not publish the estimator. chars/4 is a conservative stand-in.
 */
export const MANUS_INPUT_TOKEN_LIMIT = 5_000;

/** Documented per-user limits: task.create 10/min, task.detail and task.listMessages 100/min. */
export const MANUS_RATE_LIMITS = {
  "task.create": 10,
  "task.detail": 100,
  "task.listMessages": 100,
} as const;

export function estimateManusTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type ManusAuth = { apiKey: string; oauthToken: string };

interface ManusTask {
  id?: string;
  status?: "running" | "stopped" | "waiting" | "error";
  credit_usage?: number;
  has_running_background_jobs?: boolean;
  agent_profile?: string;
}

interface ManusEvent {
  type?: string;
  assistant_message?: { content?: string };
  structured_output_result?: { success?: boolean; value?: unknown };
}

export function createManusV2Adapter(options: {
  auth: ManusAuth;
  agentProfile: ManusAgentProfile | null;
  pollDeadlineMs: number;
  modelLabel: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}): PlatoAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const limiter = new SlidingWindowLimiter(MANUS_RATE_LIMITS, 60_000, now);
  const model = options.modelLabel || options.agentProfile || "manus-v2";

  return {
    id: "manus-v2",
    model,
    async complete(request) {
      assertDeepReasoningOnly(request);
      const headers = authHeaders(options.auth, model);
      const prompt = messagesToText(request.messages);
      const estimated = estimateManusTokens(prompt);
      if (estimated > MANUS_INPUT_TOKEN_LIMIT) {
        throw new PlatoRouteError(
          `Manus v2 input is about ${estimated} estimated tokens, above the documented ~${MANUS_INPUT_TOKEN_LIMIT} token limit.`,
          { httpStatus: 400, rateLimited: false, errorClass: "invalid_argument", provider: "manus-v2", model },
        );
      }

      let retries = 0;
      const created = await postCreate(fetchImpl, headers, limiter, sleep, random, {
        prompt,
        agentProfile: options.agentProfile,
        schema: structuredSchema(request),
      }, () => { retries += 1; });
      const taskId = created.task_id;
      if (!taskId) {
        throw new PlatoRouteError("Manus v2 task.create did not return task_id.", {
          httpStatus: null, rateLimited: false, errorClass: "provider_error", provider: "manus-v2", model,
        });
      }

      const deadline = now() + options.pollDeadlineMs;
      let task = await pollUntilSettled(fetchImpl, headers, limiter, sleep, random, taskId, deadline, now, () => { retries += 1; });
      const extracted = await readAssistantText(fetchImpl, headers, limiter, sleep, random, taskId, () => { retries += 1; });
      if (!extracted) {
        throw new PlatoRouteError("Manus v2 task finished without an assistant message.", {
          httpStatus: null, rateLimited: false, errorClass: "provider_error", provider: "manus-v2", model,
          attemptedModels: [model],
        });
      }

      const response: InvokeResult = {
        id: taskId,
        created: Math.floor(now() / 1000),
        model,
        choices: [{ index: 0, message: { role: "assistant", content: extracted }, finish_reason: "stop" }],
      };
      const result: PlatoAdapterResult = {
        response,
        provider: "manus-v2",
        model,
        retries,
        manusTaskId: taskId,
        manusStatus: task.status,
        creditUsage: task.credit_usage,
      };
      return result;
    },
  };
}

function assertDeepReasoningOnly(request: PlatoAdapterRequest): void {
  if (request.taskType === "FAST") {
    throw new PlatoRouteError("Manus API v2 is not used for FAST chat.", {
      httpStatus: null, rateLimited: false, errorClass: "unavailable", provider: "manus-v2", model: "manus-v2",
    });
  }
}

function authHeaders(auth: ManusAuth, model: string): Record<string, string> {
  if (!auth.oauthToken && !auth.apiKey) {
    throw new PlatoRouteError("Manus v2 is disabled until MANUS_OAUTH_TOKEN or MANUS_API_KEY is set.", {
      httpStatus: null, rateLimited: false, errorClass: "unavailable", provider: "manus-v2", model,
    });
  }
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (auth.oauthToken) headers.authorization = `Bearer ${auth.oauthToken}`;
  else headers["x-manus-api-key"] = auth.apiKey;
  return headers;
}

function messagesToText(messages: Message[]): string {
  return messages.map(message => {
    const text = contentToText(message.content).trim();
    return text ? `${message.role}: ${text}` : "";
  }).filter(Boolean).join("\n\n");
}

function contentToText(content: Message["content"]): string {
  if (typeof content === "string") return content;
  const parts = Array.isArray(content) ? content : [content];
  return parts.map(part => partToText(part)).filter(Boolean).join("\n");
}

function partToText(part: MessageContent): string {
  if (typeof part === "string") return part;
  if (part.type === "text") return part.text;
  return "";
}

function structuredSchema(request: PlatoAdapterRequest): Record<string, unknown> | null {
  const format = request.responseFormat ?? request.response_format;
  if (format && isJsonSchema(format)) return format.json_schema.schema;
  return request.outputSchema?.schema ?? request.output_schema?.schema ?? null;
}

function isJsonSchema(format: ResponseFormat): format is Extract<ResponseFormat, { type: "json_schema" }> {
  return format.type === "json_schema" && !!format.json_schema?.schema;
}

async function postCreate(
  fetchImpl: typeof fetch,
  headers: Record<string, string>,
  limiter: SlidingWindowLimiter,
  sleep: (ms: number) => Promise<void>,
  random: () => number,
  input: { prompt: string; agentProfile: ManusAgentProfile | null; schema: Record<string, unknown> | null },
  countRetry: () => void,
): Promise<{ task_id?: string }> {
  const body: Record<string, unknown> = {
    message: { content: input.prompt },
    interactive_mode: false,
    hide_in_task_list: true,
  };
  if (input.agentProfile) body.agent_profile = input.agentProfile;
  if (input.schema) body.structured_output_schema = input.schema;
  return manusRequest(fetchImpl, headers, limiter, sleep, random, "task.create", `${MANUS_API_BASE}/v2/task.create`, {
    method: "POST",
    body: JSON.stringify(body),
  }, countRetry);
}

async function pollUntilSettled(
  fetchImpl: typeof fetch,
  headers: Record<string, string>,
  limiter: SlidingWindowLimiter,
  sleep: (ms: number) => Promise<void>,
  random: () => number,
  taskId: string,
  deadline: number,
  now: () => number,
  countRetry: () => void,
): Promise<ManusTask> {
  let waitMs = 1_000;
  let latest: ManusTask = { id: taskId, status: "running" };
  while (now() <= deadline) {
    const detail = await manusRequest<{ task?: ManusTask }>(
      fetchImpl, headers, limiter, sleep, random, "task.detail",
      `${MANUS_API_BASE}/v2/task.detail?task_id=${encodeURIComponent(taskId)}`,
      { method: "GET" },
      countRetry,
    );
    latest = detail.task ?? latest;
    if (latest.status === "error") {
      throw new PlatoRouteError(`Manus v2 task ${taskId} returned status error.`, {
        httpStatus: null, rateLimited: false, errorClass: "provider_error", provider: "manus-v2", model: "manus-v2",
      });
    }
    if (latest.status === "waiting") {
      throw new PlatoRouteError(`Manus v2 task ${taskId} is waiting for input. PLATO does not auto-confirm actions.`, {
        httpStatus: null, rateLimited: false, errorClass: "unavailable", provider: "manus-v2", model: "manus-v2",
      });
    }
    if (latest.status === "stopped" && latest.has_running_background_jobs === false) return latest;
    if (now() >= deadline) break;
    await sleep(waitMs);
    waitMs = Math.min(waitMs * 2, 5_000);
  }
  if (latest.status === "stopped") return latest;
  throw new PlatoRouteError(`Manus v2 task ${taskId} did not finish before the application poll deadline.`, {
    httpStatus: null, rateLimited: false, errorClass: "timeout", provider: "manus-v2", model: "manus-v2",
  });
}

async function readAssistantText(
  fetchImpl: typeof fetch,
  headers: Record<string, string>,
  limiter: SlidingWindowLimiter,
  sleep: (ms: number) => Promise<void>,
  random: () => number,
  taskId: string,
  countRetry: () => void,
): Promise<string | null> {
  const page = await manusRequest<{ messages?: ManusEvent[] }>(
    fetchImpl, headers, limiter, sleep, random, "task.listMessages",
    `${MANUS_API_BASE}/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=20`,
    { method: "GET" },
    countRetry,
  );
  const messages = page.messages ?? [];
  const structured = messages.find(event =>
    event.type === "structured_output_result" && event.structured_output_result?.success && event.structured_output_result.value,
  );
  if (structured?.structured_output_result?.value) {
    return JSON.stringify(structured.structured_output_result.value);
  }
  const assistant = messages.find(event => event.type === "assistant_message" && event.assistant_message?.content);
  return assistant?.assistant_message?.content ?? null;
}

async function manusRequest<T>(
  fetchImpl: typeof fetch,
  headers: Record<string, string>,
  limiter: SlidingWindowLimiter,
  sleep: (ms: number) => Promise<void>,
  random: () => number,
  endpoint: keyof typeof MANUS_RATE_LIMITS,
  url: string,
  init: { method: "GET" | "POST"; body?: string },
  countRetry: () => void,
): Promise<T> {
  let attempt = 0;
  while (true) {
    if (!limiter.tryAcquire(endpoint)) {
      throw new PlatoRouteError(`Manus v2 ${endpoint} client limit reached (${MANUS_RATE_LIMITS[endpoint]}/min).`, {
        httpStatus: 429, rateLimited: true, errorClass: "rate_limited", provider: "manus-v2", model: "manus-v2",
      });
    }
    const response = await fetchImpl(url, { method: init.method, headers, body: init.body });
    const payload = await response.json().catch(() => null) as { ok?: boolean; error?: { code?: string; message?: string } } | null;
    const code = payload?.error?.code;
    const rateLimited = response.status === 429 || code === "rate_limited";
    if (response.ok && payload?.ok !== false) return payload as T;
    if (rateLimited && attempt < 1) {
      attempt += 1;
      countRetry();
      await sleep(1_000 + Math.floor(random() * 250));
      continue;
    }
    const message = payload?.error?.message?.slice(0, 300) || `Manus v2 ${endpoint} failed`;
    throw new PlatoRouteError(message, {
      httpStatus: rateLimited ? 429 : response.status || null,
      rateLimited,
      errorClass: rateLimited ? "rate_limited" : response.status >= 500 ? "provider_5xx" : "provider_error",
      provider: "manus-v2",
      model: "manus-v2",
    });
  }
}
