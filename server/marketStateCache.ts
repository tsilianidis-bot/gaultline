import type { UnifiedSeismographIntelligence } from "./seismographUnified";

export interface MarketStateCacheResult<T> {
  value: T;
  status: "fresh-cache" | "refreshed" | "stale-if-error";
  ageMs: number;
  error?: unknown;
}

export interface MarketStateCacheOptions {
  forceRefresh?: boolean;
  now?: () => number;
}

export class MarketStateCache<T> {
  private entry: { value: T; storedAt: number } | null = null;
  private inFlight: Promise<T> | null = null;
  private generation = 0;

  constructor(
    private readonly freshTtlMs: number,
    private readonly staleTtlMs: number,
  ) {
    if (freshTtlMs < 0 || staleTtlMs < freshTtlMs) {
      throw new Error("MarketState cache TTLs are invalid");
    }
  }

  peek(now = Date.now()): { value: T; ageMs: number; fresh: boolean } | null {
    if (!this.entry) return null;
    const ageMs = Math.max(0, now - this.entry.storedAt);
    if (ageMs > this.staleTtlMs) {
      this.entry = null;
      return null;
    }
    return { value: this.entry.value, ageMs, fresh: ageMs <= this.freshTtlMs };
  }

  async getOrLoad(
    loader: () => Promise<T>,
    options: MarketStateCacheOptions = {},
  ): Promise<MarketStateCacheResult<T>> {
    const now = options.now ?? Date.now;
    const cached = this.peek(now());
    if (cached?.fresh && !options.forceRefresh) {
      return { value: cached.value, status: "fresh-cache", ageMs: cached.ageMs };
    }

    const staleCandidate = cached;
    try {
      if (!this.inFlight) {
        const refreshGeneration = this.generation;
        this.inFlight = loader()
          .then(value => {
            if (refreshGeneration === this.generation) {
              this.entry = { value, storedAt: now() };
            }
            return value;
          })
          .finally(() => {
            this.inFlight = null;
          });
      }
      const value = await this.inFlight;
      return { value, status: "refreshed", ageMs: 0 };
    } catch (error) {
      if (staleCandidate) {
        return {
          value: staleCandidate.value,
          status: "stale-if-error",
          ageMs: staleCandidate.ageMs,
          error,
        };
      }
      throw error;
    }
  }

  invalidate(): void {
    this.generation += 1;
    this.entry = null;
  }
}

export const canonicalMarketStateCache = new MarketStateCache<UnifiedSeismographIntelligence>(
  5 * 60 * 1000,
  24 * 60 * 60 * 1000,
);

export function invalidateCanonicalMarketStateCache(): void {
  canonicalMarketStateCache.invalidate();
}
