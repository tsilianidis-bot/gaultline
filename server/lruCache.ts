/**
 * Minimal LRU cache with TTL support.
 * Evicts the least-recently-used entry when capacity is exceeded.
 * Prevents unbounded memory growth in long-running server processes.
 */
export class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly ttlMs: number;
  private readonly map = new Map<K, { value: V; fetchedAt: number; lastUsed: number }>();

  constructor(capacity: number, ttlMs: number) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh last-used timestamp (move to "most recently used")
    entry.lastUsed = Date.now();
    return entry.value;
  }

  /** Returns the raw entry (value + fetchedAt) without updating LRU order — for TTL checks */
  peek(key: K): { value: V; fetchedAt: number } | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    return { value: entry.value, fetchedAt: entry.fetchedAt };
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key); // delete to re-insert at end (most recent)
    } else if (this.map.size >= this.capacity) {
      // Evict LRU entry
      let lruKey: K | undefined;
      let lruTime = Infinity;
      Array.from(this.map.entries()).forEach(([k, v]) => {
        if (v.lastUsed < lruTime) {
          lruTime = v.lastUsed;
          lruKey = k;
        }
      });
      if (lruKey !== undefined) this.map.delete(lruKey);
    }
    this.map.set(key, { value, fetchedAt: Date.now(), lastUsed: Date.now() });
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
