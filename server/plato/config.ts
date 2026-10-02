export const PLATO_DEFAULT_FAST_MODEL = "gemini-3-flash-preview";

/**
 * Application deadline for a synchronous Manus v2 poll.
 * UNVERIFIED: Manus does not publish a task SLA. This is not a provider limit.
 * Override with PLATO_MANUS_POLL_DEADLINE_MS.
 */
export const APPLICATION_MANUS_POLL_DEADLINE_MS = 45_000;

export type PlatoProviderId = "openai-compatible" | "manus-v2" | "manus-gateway";
export type PlatoTaskType = "FAST" | "DEEP_REASONING" | "FALLBACK";
export type ManusAgentProfile = "standard" | "lite" | "max";

export interface PlatoConfig {
  fastProvider: PlatoProviderId;
  reasoningProvider: PlatoProviderId | null;
  fallbackProvider: PlatoProviderId;
  fastModel: string;
  fastModelConfigured: boolean;
  reasoningModel: string | null;
  fallbackModel: string;
  fallbackModelConfigured: boolean;
  manusApiKey: string;
  manusOauthToken: string;
  manusAgentProfile: ManusAgentProfile | null;
  manusPollDeadlineMs: number;
  fastTimeoutMs: number | null;
  forgeBaseUrl: string;
  gatewayEnabled: boolean;
  gatewayBaseUrl: string;
  gatewayApiKey: string;
  gatewayModel: string;
}

const PROVIDERS = new Set<PlatoProviderId>(["openai-compatible", "manus-v2", "manus-gateway"]);

function readProvider(value: string | undefined, fallback: PlatoProviderId | null): PlatoProviderId | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallback;
  return PROVIDERS.has(trimmed as PlatoProviderId) ? trimmed as PlatoProviderId : fallback;
}

function readPositiveInt(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function readAgentProfile(value: string | undefined): ManusAgentProfile | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "standard" || trimmed === "lite" || trimmed === "max") return trimmed;
  return null;
}

export function readPlatoConfig(env: NodeJS.ProcessEnv = process.env): PlatoConfig {
  const configuredFast = env.PLATO_FAST_MODEL?.trim() || env.FAULTLINE_PLATO_MODEL?.trim() || "";
  const configuredFallback = env.PLATO_FALLBACK_MODEL?.trim() || "";
  const configuredReasoning = env.PLATO_REASONING_MODEL?.trim() || "";
  const fastModel = configuredFast || PLATO_DEFAULT_FAST_MODEL;
  const pollDeadline = readPositiveInt(env.PLATO_MANUS_POLL_DEADLINE_MS) ?? APPLICATION_MANUS_POLL_DEADLINE_MS;
  return {
    fastProvider: readProvider(env.PLATO_FAST_PROVIDER, "openai-compatible") ?? "openai-compatible",
    reasoningProvider: readProvider(env.PLATO_REASONING_PROVIDER, null),
    fallbackProvider: readProvider(env.PLATO_FALLBACK_PROVIDER, "openai-compatible") ?? "openai-compatible",
    fastModel,
    fastModelConfigured: configuredFast.length > 0,
    reasoningModel: configuredReasoning || null,
    fallbackModel: configuredFallback || fastModel,
    fallbackModelConfigured: configuredFallback.length > 0,
    manusApiKey: env.MANUS_API_KEY?.trim() ?? "",
    manusOauthToken: env.MANUS_OAUTH_TOKEN?.trim() ?? "",
    manusAgentProfile: readAgentProfile(env.PLATO_MANUS_AGENT_PROFILE),
    manusPollDeadlineMs: pollDeadline,
    fastTimeoutMs: readPositiveInt(env.PLATO_FAST_TIMEOUT_MS),
    forgeBaseUrl: env.BUILT_IN_FORGE_API_URL?.trim() ?? "",
    gatewayEnabled: env.PLATO_MANUS_GATEWAY_ENABLED?.trim() === "true",
    gatewayBaseUrl: env.PLATO_MANUS_GATEWAY_BASE_URL?.trim() ?? "",
    gatewayApiKey: env.PLATO_MANUS_GATEWAY_API_KEY?.trim() ?? "",
    gatewayModel: env.PLATO_MANUS_GATEWAY_MODEL?.trim() || fastModel,
  };
}
