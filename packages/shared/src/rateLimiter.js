/** Tiny in-memory sliding-window limiter (per-process; fine for this prototype). */
export function createRateLimiter({ max = 5, windowMs = 10 * 60 * 1000 } = {}) {
  const hits = new Map();

  return {
    check(key) {
      const now = Date.now();
      const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);
      timestamps.push(now);
      hits.set(key, timestamps);
      return timestamps.length <= max;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}
