import { DEFAULT_CHAT_MODEL, listLLMModels, type ListLLMModelsResult } from "./_core/llm";

/**
 * Preference order is provider-agnostic. A Forge catalog that still lists
 * Claude or GPT matches first. A Gemini catalog matches the Gemini ids.
 * Nothing here disables the OpenAI-compatible /v1 gateway path.
 */
const ASHA_MODEL_PREFERENCE = [
  "claude-sonnet-4-6",
  "gpt-5",
  "gemini-3-flash-preview",
] as const;

/**
 * gemini-3.1-pro-preview has no Gemini free tier. It is used only when
 * FAULTLINE_PLATO_MODEL names it. Automatic catalog fallback must not select it.
 */
const PAID_TIER_UNLESS_CONFIGURED = new Set(["gemini-3.1-pro-preview"]);

const CATALOG_TTL_MS = 15 * 60 * 1000;
const UNCERTAIN_TTL_MS = 15 * 1000;
const SUPPORTED_TRANSPORT_FALLBACK = DEFAULT_CHAT_MODEL;

export interface AshaModelResolution {
  candidates: string[];
  source: "live-catalog" | "transport-fallback" | "configured";
  resolvedAt: string;
}

interface CachedResolution {
  value: AshaModelResolution;
  resolvedAtMs: number;
  ttlMs: number;
}

let cachedResolution: CachedResolution | null = null;

export function resetAshaModelResolutionCache(): void {
  cachedResolution = null;
}

/** Gemini list endpoints prefix ids with `models/`. Forge ids are already bare. */
export function canonicalCatalogModelId(id: string): string {
  return id.trim().replace(/^models\//, "");
}

/** Optional PLATO model. Unset keeps catalog preference, which defaults to gemini-3-flash-preview on Gemini. */
export function resolvePlatoModelOverride(): string | null {
  const configured = process.env.FAULTLINE_PLATO_MODEL?.trim();
  if (!configured) return null;
  const canonical = canonicalCatalogModelId(configured);
  return canonical || null;
}

const NON_CHAT_MODEL = /embed|imagen|image-generation|text-to-speech|(?:^|[^a-z])tts(?:[^a-z]|$)|(?:^|[^a-z])aqa(?:[^a-z]|$)|(?:^|[^a-z])veo(?:[^a-z]|$)|lyria/i;

export function isKnownNonChatModel(id: string): boolean {
  return NON_CHAT_MODEL.test(canonicalCatalogModelId(id));
}

function usableCatalogIds(catalog: ListLLMModelsResult, override: string | null): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const model of catalog.data) {
    const canonical = canonicalCatalogModelId(model.id ?? "");
    if (!canonical || isKnownNonChatModel(canonical) || seen.has(canonical)) continue;
    if (PAID_TIER_UNLESS_CONFIGURED.has(canonical) && canonical !== override) continue;
    seen.add(canonical);
    ids.push(canonical);
  }
  return ids;
}

function cacheTtl(candidates: string[]): number {
  const preferred = new Set<string>(ASHA_MODEL_PREFERENCE);
  return candidates.some(id => preferred.has(canonicalCatalogModelId(id)))
    ? CATALOG_TTL_MS
    : UNCERTAIN_TTL_MS;
}

export async function resolveAshaModelCandidates(options: {
  fetchCatalog?: () => Promise<ListLLMModelsResult>;
  now?: () => number;
  forceRefresh?: boolean;
} = {}): Promise<AshaModelResolution> {
  const fetchCatalog = options.fetchCatalog ?? listLLMModels;
  const now = options.now ?? Date.now;
  const nowMs = now();

  if (
    !options.forceRefresh &&
    cachedResolution &&
    nowMs - cachedResolution.resolvedAtMs < cachedResolution.ttlMs
  ) {
    return cachedResolution.value;
  }

  const override = resolvePlatoModelOverride();
  if (override) {
    const value: AshaModelResolution = {
      candidates: [override],
      source: "configured",
      resolvedAt: new Date(nowMs).toISOString(),
    };
    cachedResolution = { value, resolvedAtMs: nowMs, ttlMs: CATALOG_TTL_MS };
    return value;
  }

  try {
    const catalog = await fetchCatalog();
    const available = usableCatalogIds(catalog, override);
    const preferred = ASHA_MODEL_PREFERENCE.filter(model => available.includes(model));
    const candidates = preferred.length > 0 ? [...preferred] : available.slice(0, 3);

    if (candidates.length === 0) {
      throw new Error("The live LLM catalog contained no usable models");
    }

    const value: AshaModelResolution = {
      candidates,
      source: "live-catalog",
      resolvedAt: new Date(nowMs).toISOString(),
    };
    cachedResolution = { value, resolvedAtMs: nowMs, ttlMs: cacheTtl(candidates) };
    return value;
  } catch {
    const value: AshaModelResolution = {
      candidates: [SUPPORTED_TRANSPORT_FALLBACK],
      source: "transport-fallback",
      resolvedAt: new Date(nowMs).toISOString(),
    };
    cachedResolution = { value, resolvedAtMs: nowMs, ttlMs: UNCERTAIN_TTL_MS };
    return value;
  }
}
