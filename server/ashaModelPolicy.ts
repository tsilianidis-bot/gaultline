import { listLLMModels, type ListLLMModelsResult } from "./_core/llm";

const ASHA_MODEL_PREFERENCE = [
  "claude-sonnet-4-6",
  "gpt-5",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
] as const;

const CATALOG_TTL_MS = 15 * 60 * 1000;
const SUPPORTED_TRANSPORT_FALLBACK = "gemini-3-flash-preview";

export interface AshaModelResolution {
  candidates: string[];
  source: "live-catalog" | "transport-fallback";
  resolvedAt: string;
}

interface CachedResolution {
  value: AshaModelResolution;
  resolvedAtMs: number;
}

let cachedResolution: CachedResolution | null = null;

export function resetAshaModelResolutionCache(): void {
  cachedResolution = null;
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
    nowMs - cachedResolution.resolvedAtMs < CATALOG_TTL_MS
  ) {
    return cachedResolution.value;
  }

  try {
    const catalog = await fetchCatalog();
    const availableIds = new Set(catalog.data.map(model => model.id));
    const preferred = ASHA_MODEL_PREFERENCE.filter(model => availableIds.has(model));
    const candidates = preferred.length > 0
      ? [...preferred]
      : catalog.data.map(model => model.id).filter(Boolean).slice(0, 3);

    if (candidates.length === 0) {
      throw new Error("The live LLM catalog contained no usable models");
    }

    const value: AshaModelResolution = {
      candidates,
      source: "live-catalog",
      resolvedAt: new Date(nowMs).toISOString(),
    };
    cachedResolution = { value, resolvedAtMs: nowMs };
    return value;
  } catch {
    const value: AshaModelResolution = {
      candidates: [SUPPORTED_TRANSPORT_FALLBACK],
      source: "transport-fallback",
      resolvedAt: new Date(nowMs).toISOString(),
    };
    cachedResolution = { value, resolvedAtMs: nowMs };
    return value;
  }
}
