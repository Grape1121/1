// Tiny in-memory TTL cache. Cuts repeated Google calls (cost + latency) for
// identical queries. NOTE: per-instance only on serverless — best-effort, not a
// shared cache. For production-grade caching use Redis/Upstash.

interface Entry {
  value: unknown;
  expires: number;
}

const store = new Map<string, Entry>();

export function cacheGet<T>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expires) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
  // Opportunistic cleanup so the map can't grow unbounded.
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store) if (now > v.expires) store.delete(k);
  }
}
