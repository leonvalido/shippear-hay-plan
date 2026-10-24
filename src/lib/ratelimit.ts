/**
 * In-memory rate limiting, per server instance (good enough behind Vercel: each
 * instance enforces its own counters, the key is still protected from a single
 * abusive client). Nothing here persists across deploys.
 */

type Bucket = number[]; // timestamps (ms) of accepted hits

const g = globalThis as unknown as { __rl?: Map<string, Bucket>; __daily?: { day: string; count: number } };
const buckets = (g.__rl ??= new Map<string, Bucket>());

export const MINUTE = 60_000;
export const DAY = 86_400_000;

export type Limit = { windowMs: number; max: number };

/** Returns true when `key` may proceed under every limit, and records the hit. */
export function allow(key: string, limits: Limit[], now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
  const longest = Math.max(...limits.map((l) => l.windowMs));
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < longest);
  for (const l of limits) {
    const inWindow = hits.filter((t) => now - t < l.windowMs);
    if (inWindow.length >= l.max) {
      const oldest = inWindow[0]!;
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + l.windowMs - now) / 1000)) };
    }
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) sweep(now, longest);
  return { ok: true };
}

function sweep(now: number, windowMs: number) {
  for (const [k, v] of buckets) if (v.length === 0 || now - v[v.length - 1]! > windowMs) buckets.delete(k);
}

/** Global per-instance counter that resets each UTC day. Returns false once `max` is reached. */
export function underDailyBudget(max: number, now = new Date()): boolean {
  const day = now.toISOString().slice(0, 10);
  if (!g.__daily || g.__daily.day !== day) g.__daily = { day, count: 0 };
  if (g.__daily.count >= max) return false;
  g.__daily.count++;
  return true;
}

/** Client IP from the proxy header, first hop; "unknown" when absent. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim();
  return ip && ip.length <= 64 ? ip : "unknown";
}
