// A small sliding-window limiter kept in the function's memory. Each Vercel instance counts on its
// own, so this slows a flood from one address rather than enforcing an exact quota.
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  let hits = new Map<string, readonly number[]>();
  let prunedAt = 0;
  return function allow(key: string, now: number = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    // Forget quiet addresses at most once per window, so a large table isn't rebuilt on every request.
    if (hits.size > 5000 && now - prunedAt >= windowMs) {
      hits = new Map([...hits].filter(([, times]) => times.some((time) => now - time < windowMs)));
      prunedAt = now;
    }
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    hits.set(key, [...recent, now]);
    return true;
  };
}
