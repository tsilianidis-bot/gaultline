/**
 * PLATO provider configuration.
 *
 * Production has exactly one approved AI provider: the OpenAI-compatible
 * gateway configured by BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY
 * (today Google's Gemini OpenAI-compatible endpoint). This module does not
 * add or enable any other provider.
 *
 * Fallback stays on that same provider and key and walks an ordered list of
 * chat models. On the Gemini API each model has its own quota bucket, so a
 * quota or "high demand" failure on the primary model can still be served by
 * the next model without a new key, a new vendor, or a paid tier.
 */
import { canonicalChatModelId, isKnownNonChatModel } from "../ashaModelPolicy";

export const PLATO_DEFAULT_FAST_MODEL = "gemini-3-flash-preview";

/**
 * Ordered fallback models on the same provider. Verified live against the
 * production key's /models catalog and a chat call on 2026-10-02.
 * gemini-2.5-flash / gemini-2.5-flash-lite return 404 "no longer available to
 * new users" on this key and are deliberately not listed.
 */
export const PLATO_DEFAULT_FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"] as const;

/** Per-attempt deadline. A single PLATO briefing on gemini-3-flash-preview completes well inside this. */
export const PLATO_DEFAULT_ATTEMPT_TIMEOUT_MS = 45_000;
/** Whole-call deadline across every retry and fallback model. */
export const PLATO_DEFAULT_TOTAL_DEADLINE_MS = 100_000;
/** Hard cap on provider calls for one PLATO request, retries included. */
export const PLATO_DEFAULT_MAX_ATTEMPTS = 4;
/** Same-model retries for transient capacity/5xx/network failures. Quota and timeouts move to the next model instead. */
export const PLATO_DEFAULT_SAME_MODEL_RETRIES = 1;
export const PLATO_DEFAULT_RETRY_BASE_DELAY_MS = 750;
export const PLATO_MAX_RETRY_DELAY_MS = 4_000;

export type PlatoProviderId = "openai-compatible";
export type PlatoTaskType = "FAST" | "FALLBACK";

export interface PlatoConfig {
  provider: PlatoProviderId;
  forgeBaseUrl: string;
  /** Ordered model chain: primary first. Never contains a TTS/embedding/image model. */
  models: string[];
  primaryConfigured: boolean;
  attemptTimeoutMs: number;
  totalDeadlineMs: number;
  maxAttempts: number;
  sameModelRetries: number;
  retryBaseDelayMs: number;
}

function readPositiveInt(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function readNonNegativeInt(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function splitList(value: string | undefined): string[] {
  return (value ?? "").split(",").map(entry => entry.trim()).filter(Boolean);
}

/**
 * Builds the ordered, de-duplicated chat model chain.
 * Optional overrides (none are set in production today):
 * - PLATO_FAST_MODEL or FAULTLINE_PLATO_MODEL: primary model
 * - PLATO_FALLBACK_MODELS (comma list) or PLATO_FALLBACK_MODEL: fallback order
 * Non-chat ids (TTS, embedding, image, video, audio) are always dropped.
 */
export function resolvePlatoModelChain(env: NodeJS.ProcessEnv = process.env): { models: string[]; primaryConfigured: boolean } {
  const requestedPrimary = canonicalChatModelId(env.PLATO_FAST_MODEL ?? env.FAULTLINE_PLATO_MODEL ?? "");
  const configuredPrimary = requestedPrimary && !isKnownNonChatModel(requestedPrimary) ? requestedPrimary : "";
  const configuredFallbacks = splitList(env.PLATO_FALLBACK_MODELS);
  const singleFallback = env.PLATO_FALLBACK_MODEL?.trim();
  const fallbacks = configuredFallbacks.length > 0
    ? configuredFallbacks
    : singleFallback
      ? [singleFallback]
      : [...PLATO_DEFAULT_FALLBACK_MODELS];

  const ordered = [configuredPrimary || PLATO_DEFAULT_FAST_MODEL, ...fallbacks];
  const seen = new Set<string>();
  const models: string[] = [];
  for (const raw of ordered) {
    const id = canonicalChatModelId(raw);
    if (!id || seen.has(id) || isKnownNonChatModel(id)) continue;
    seen.add(id);
    models.push(id);
  }
  if (models.length === 0) models.push(PLATO_DEFAULT_FAST_MODEL);
  return { models, primaryConfigured: configuredPrimary.length > 0 };
}

export function readPlatoConfig(env: NodeJS.ProcessEnv = process.env): PlatoConfig {
  const chain = resolvePlatoModelChain(env);
  return {
    provider: "openai-compatible",
    forgeBaseUrl: env.BUILT_IN_FORGE_API_URL?.trim() ?? "",
    models: chain.models,
    primaryConfigured: chain.primaryConfigured,
    attemptTimeoutMs: readPositiveInt(env.PLATO_ATTEMPT_TIMEOUT_MS) ?? PLATO_DEFAULT_ATTEMPT_TIMEOUT_MS,
    totalDeadlineMs: readPositiveInt(env.PLATO_TOTAL_DEADLINE_MS) ?? PLATO_DEFAULT_TOTAL_DEADLINE_MS,
    maxAttempts: Math.min(readPositiveInt(env.PLATO_MAX_ATTEMPTS) ?? PLATO_DEFAULT_MAX_ATTEMPTS, 8),
    sameModelRetries: Math.min(readNonNegativeInt(env.PLATO_SAME_MODEL_RETRIES) ?? PLATO_DEFAULT_SAME_MODEL_RETRIES, 2),
    retryBaseDelayMs: readNonNegativeInt(env.PLATO_RETRY_BASE_DELAY_MS) ?? PLATO_DEFAULT_RETRY_BASE_DELAY_MS,
  };
}
