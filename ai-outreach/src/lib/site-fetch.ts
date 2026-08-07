import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Fetches a company's homepage so the model can reason about real copy rather
 * than recalled facts.
 *
 * The URL comes from user input and is fetched by the server, so this is an
 * SSRF sink: every hop is re-validated against private address ranges, the
 * scheme is restricted to http/https, redirects are followed manually with a
 * hop cap, and the body is size- and time-bounded.
 */

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const MAX_TEXT_CHARS = 12_000;

export type SiteSnapshot = {
  url: string;
  title: string;
  description: string;
  text: string;
};

export type SiteFetchResult =
  | { ok: true; snapshot: SiteSnapshot }
  | { ok: false; reason: string };

/** Accepts "acme.com", "www.acme.com/about", or a full URL. */
export function normaliseWebsite(input: string): URL | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (!url.hostname.includes('.')) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export async function fetchSiteSnapshot(rawUrl: string): Promise<SiteFetchResult> {
  const url = normaliseWebsite(rawUrl);
  if (!url) return { ok: false, reason: 'Not a valid website address.' };

  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const guard = await assertPublicHost(current.hostname);
    if (!guard.ok) return guard;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // Some sites 403 an empty UA; be honest about what we are.
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Outreach/1.0; +research bot)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? 'The website took too long to respond.'
          : 'Could not reach the website.';
      return { ok: false, reason };
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return { ok: false, reason: 'The website redirected without a destination.' };
      try {
        current = new URL(location, current);
      } catch {
        return { ok: false, reason: 'The website redirected to an invalid address.' };
      }
      if (current.protocol !== 'http:' && current.protocol !== 'https:') {
        return { ok: false, reason: 'The website redirected to an unsupported protocol.' };
      }
      continue;
    }

    if (!response.ok) {
      return { ok: false, reason: `The website returned HTTP ${response.status}.` };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !contentType.includes('html') && !contentType.includes('text/plain')) {
      return { ok: false, reason: 'The website did not return an HTML page.' };
    }

    const html = await readCapped(response);
    if (html === undefined) return { ok: false, reason: 'The website response was too large.' };

    return { ok: true, snapshot: buildSnapshot(current.toString(), html) };
  }

  return { ok: false, reason: 'The website redirected too many times.' };
}

async function readCapped(response: Response): Promise<string | undefined> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      // Truncated content is still useful — keep what we have.
      break;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total > MAX_BYTES ? MAX_BYTES : total);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset + chunk.byteLength > merged.length) break;
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

/** Rejects loopback, private, link-local, CGNAT and reserved destinations. */
async function assertPublicHost(hostname: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const literal = isIP(hostname);
  const addresses = literal
    ? [hostname]
    : await lookup(hostname, { all: true, verbatim: true })
        .then((records) => records.map((record) => record.address))
        .catch(() => []);

  if (addresses.length === 0) {
    return { ok: false, reason: 'That domain could not be resolved.' };
  }

  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      return { ok: false, reason: 'That address is not a public website.' };
    }
  }

  return { ok: true };
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const parts = address.split('.').map((part) => Number.parseInt(part, 10));
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 0) return true; // "this network"
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true; // IETF protocol assignments
    if (a >= 224) return true; // multicast, reserved, broadcast
    return false;
  }

  if (version === 6) {
    const normalised = address.toLowerCase().split('%')[0] ?? '';
    if (normalised === '::' || normalised === '::1') return true;
    if (normalised.startsWith('fe80')) return true; // link-local
    if (/^f[cd]/.test(normalised)) return true; // unique local
    // IPv4-mapped (::ffff:10.0.0.1) — re-check the embedded v4 address
    const mapped = normalised.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return false;
  }

  return true; // not an IP literal we understand — refuse
}

/* ------------------------------------------------------------------ */
/* HTML → text                                                         */
/* ------------------------------------------------------------------ */

export function buildSnapshot(url: string, html: string): SiteSnapshot {
  return {
    url,
    title: extractTitle(html),
    description: extractMeta(html, 'description') || extractMeta(html, 'og:description'),
    text: extractText(html).slice(0, MAX_TEXT_CHARS),
  };
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeEntities(match?.[1] ?? '').trim().slice(0, 200);
}

function extractMeta(html: string, name: string): string {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)\\s*=\\s*["']${escapeRegExp(name)}["'][^>]*>`,
    'i',
  );
  const tag = html.match(pattern)?.[0];
  if (!tag) return '';
  const content = tag.match(/content\s*=\s*["']([\s\S]*?)["']/i)?.[1] ?? '';
  return decodeEntities(content).trim().slice(0, 400);
}

/**
 * Strips scripts, styles and tags, keeping block-level boundaries as newlines
 * so headings and list items stay distinguishable in the prompt.
 */
export function extractText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => decodeEntities(line).replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 1)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const codePoint = entity[1]?.toLowerCase() === 'x'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return match;
        }
      }
      return match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
