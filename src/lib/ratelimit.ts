// Simple in-memory sliding-window rate limiter, keyed by client IP. Protects the
// public endpoints (which call the paid Google APIs) from being hammered into a
// large bill. NOTE: per-instance on serverless — best-effort, not global. For
// hard guarantees use a shared store (Upstash) or a WAF/edge rate limit.

const hits = new Map<string, number[]>();

/** Returns true if the request is allowed, false if it should be throttled. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}
