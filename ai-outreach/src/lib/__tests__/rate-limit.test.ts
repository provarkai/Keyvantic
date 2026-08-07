import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('rate limiter', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RATE_LIMIT_MAX = '3';
    process.env.RATE_LIMIT_WINDOW_MS = '1000';
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it('allows up to the limit then blocks', async () => {
    const { checkRateLimit, __resetRateLimit } = await import('../rate-limit');
    __resetRateLimit();

    const now = 1_000_000;
    expect(checkRateLimit('a', now).allowed).toBe(true);
    expect(checkRateLimit('a', now).allowed).toBe(true);
    expect(checkRateLimit('a', now).allowed).toBe(true);

    const blocked = checkRateLimit('a', now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks keys independently', async () => {
    const { checkRateLimit, __resetRateLimit } = await import('../rate-limit');
    __resetRateLimit();

    const now = 2_000_000;
    for (let i = 0; i < 3; i += 1) checkRateLimit('a', now);

    expect(checkRateLimit('a', now).allowed).toBe(false);
    expect(checkRateLimit('b', now).allowed).toBe(true);
  });

  it('resets once the window rolls over', async () => {
    const { checkRateLimit, __resetRateLimit } = await import('../rate-limit');
    __resetRateLimit();

    const now = 3_000_000;
    for (let i = 0; i < 4; i += 1) checkRateLimit('a', now);
    expect(checkRateLimit('a', now).allowed).toBe(false);

    expect(checkRateLimit('a', now + 1500).allowed).toBe(true);
  });
});

describe('clientKey', () => {
  it('prefers the first x-forwarded-for entry', async () => {
    const { clientKey } = await import('../rate-limit');
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(clientKey(request)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip then a constant', async () => {
    const { clientKey } = await import('../rate-limit');
    expect(clientKey(new Request('https://example.com', { headers: { 'x-real-ip': '198.51.100.9' } }))).toBe(
      '198.51.100.9',
    );
    expect(clientKey(new Request('https://example.com'))).toBe('anonymous');
  });
});
