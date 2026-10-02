/** In-process sliding window. Counters reset when the process restarts. */
export class SlidingWindowLimiter {
  private readonly stamps = new Map<string, number[]>();

  constructor(
    private readonly limits: Record<string, number>,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  tryAcquire(key: string): boolean {
    const limit = this.limits[key];
    if (!limit || limit <= 0) return false;
    const current = this.now();
    const kept = (this.stamps.get(key) ?? []).filter(stamp => current - stamp < this.windowMs);
    if (kept.length >= limit) {
      this.stamps.set(key, kept);
      return false;
    }
    kept.push(current);
    this.stamps.set(key, kept);
    return true;
  }
}
