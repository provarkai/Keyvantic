import 'server-only';
import { env } from './env';

/**
 * Fixed-window rate limiter, in memory.
 *
 * Deliberately simple: state lives in this process, so behind multiple
 * instances the effective limit is per instance. That is fine as a guardrail
 * against a stuck client burning credits; swap the store for Redis (or Vercel
 * KV) if you need a global limit.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
let lastSweep = 0;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  sweep(now);

  const existing = windows.get(key);
  const window: Window =
    existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + env.rateLimitWindowMs };

  window.count += 1;
  windows.set(key, window);

  const allowed = window.count <= env.rateLimitMax;

  return {
    allowed,
    remaining: Math.max(0, env.rateLimitMax - window.count),
    resetAt: window.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  };
}

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** Best-effort client identity from proxy headers, for rate limiting only. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip') || 'anonymous';
}

/** Exposed for tests. */
export function __resetRateLimit(): void {
  windows.clear();
  lastSweep = 0;
}
