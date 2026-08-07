import 'server-only';

/**
 * Server-side configuration. Every value here is read from the environment and
 * must never be imported into a client component — the OpenRouter key lives in
 * this module.
 */

const DEFAULT_MODEL = 'anthropic/claude-sonnet-5';

/** Curated fallback list for the in-app model picker. */
const DEFAULT_ALLOWED_MODELS = [
  'anthropic/claude-sonnet-5',
  'anthropic/claude-opus-5',
  'anthropic/claude-haiku-4.5',
  'openai/gpt-5.4',
  'openai/gpt-5.4-mini',
  'google/gemini-3.5-flash',
];

function str(name: string, fallback = ''): string {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

function bool(name: string, fallback: boolean): boolean {
  const raw = str(name);
  if (raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function int(name: string, fallback: number): number {
  const parsed = Number.parseInt(str(name), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function list(name: string): string[] {
  return str(name)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const env = {
  openRouterApiKey: str('OPENROUTER_API_KEY'),
  model: str('OPENROUTER_MODEL', DEFAULT_MODEL),
  /** Email step can run on a cheaper model; falls back to the research model. */
  get emailModel(): string {
    return str('OPENROUTER_EMAIL_MODEL', this.model);
  },
  get allowedModels(): string[] {
    const configured = list('OPENROUTER_ALLOWED_MODELS');
    const base = configured.length > 0 ? configured : DEFAULT_ALLOWED_MODELS;
    // The configured default is always selectable, even if absent from the list.
    return Array.from(new Set([this.model, ...base]));
  },
  siteUrl: str('OPENROUTER_SITE_URL', 'http://localhost:3000'),
  appName: str('OPENROUTER_APP_NAME', 'AI Outreach'),
  scrapeCompanySite: bool('SCRAPE_COMPANY_SITE', true),
  webSearch: bool('OPENROUTER_WEB_SEARCH', false),
  rateLimitMax: int('RATE_LIMIT_MAX', 20),
  rateLimitWindowMs: int('RATE_LIMIT_WINDOW_MS', 60_000),
} as const;

export function assertConfigured(): void {
  if (!env.openRouterApiKey) {
    throw new ConfigError(
      'OPENROUTER_API_KEY is not set. Copy .env.example to .env.local and add your OpenRouter key.',
    );
  }
}

export class ConfigError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
