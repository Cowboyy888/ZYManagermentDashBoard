// Sliding window rate limiter — keyed by userId + action key
const windows = new Map<string, number[]>();

export function checkRateLimit(
  userId: string,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const mapKey = `${userId}:${key}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  const timestamps = (windows.get(mapKey) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= limit) return false;

  timestamps.push(now);
  windows.set(mapKey, timestamps);
  return true;
}
