import 'server-only';
import type { ZodType } from 'zod';
import { env } from './env';
import { extractJsonObject } from './json-repair';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 120_000;

export class OpenRouterError extends Error {
  readonly status: number;
  readonly detail: string | undefined;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.detail = detail;
  }
}

type ChatMessage = { role: 'system' | 'user'; content: string };

type CompletionOptions<T> = {
  model: string;
  messages: ChatMessage[];
  /** JSON Schema describing the expected object. */
  schema: Record<string, unknown>;
  schemaName: string;
  /** Zod schema used to validate whatever the model returned. */
  validator: ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  webSearch?: boolean;
};

type OpenRouterChoice = {
  message?: { content?: string | null };
  finish_reason?: string;
};

type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
  error?: { message?: string; code?: number };
  model?: string;
};

/**
 * Calls OpenRouter and returns a validated object.
 *
 * Structured output support varies by model, so this tries the strict
 * `json_schema` response format first and transparently retries with the more
 * widely supported `json_object` format when the provider rejects it. A final
 * repair attempt re-prompts the model with the validation errors.
 */
export async function completeJson<T>(options: CompletionOptions<T>): Promise<{ data: T; model: string }> {
  const attempts: Array<'json_schema' | 'json_object'> = ['json_schema', 'json_object'];
  let lastError: Error | undefined;

  for (const format of attempts) {
    try {
      const { content, model } = await callOpenRouter(options, format);
      const parsed = parseAndValidate(content, options.validator);
      if (parsed.ok) return { data: parsed.data, model };

      // The model answered but the shape was wrong — show it the errors once.
      const repaired = await repair(options, format, content, parsed.errors);
      if (repaired) return repaired;

      lastError = new OpenRouterError(
        'The model returned a response that did not match the expected shape.',
        502,
        parsed.errors,
      );
    } catch (error) {
      if (error instanceof OpenRouterError && shouldRetryWithLooserFormat(error)) {
        lastError = error;
        continue; // try the next response_format
      }
      throw error;
    }
  }

  throw lastError ?? new OpenRouterError('OpenRouter request failed.', 502);
}

function shouldRetryWithLooserFormat(error: OpenRouterError): boolean {
  if (error.status !== 400 && error.status !== 404 && error.status !== 422) return false;
  const haystack = `${error.message} ${error.detail ?? ''}`.toLowerCase();
  return (
    haystack.includes('response_format') ||
    haystack.includes('json_schema') ||
    haystack.includes('structured output') ||
    haystack.includes('not supported')
  );
}

async function callOpenRouter<T>(
  options: CompletionOptions<T>,
  format: 'json_schema' | 'json_object',
  extraMessages: ChatMessage[] = [],
): Promise<{ content: string; model: string }> {
  const responseFormat =
    format === 'json_schema'
      ? {
          type: 'json_schema',
          json_schema: {
            name: options.schemaName,
            strict: true,
            schema: options.schema,
          },
        }
      : { type: 'json_object' };

  const body: Record<string, unknown> = {
    model: options.model,
    messages: [...options.messages, ...extraMessages],
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 4000,
    response_format: responseFormat,
  };

  if (options.webSearch) {
    body.plugins = [{ id: 'web', max_results: 5 }];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.siteUrl,
        'X-Title': env.appName,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenRouterError('The model took too long to respond. Try again or pick a faster model.', 504);
    }
    throw new OpenRouterError('Could not reach OpenRouter.', 502, error instanceof Error ? error.message : undefined);
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  let payload: OpenRouterResponse = {};
  try {
    payload = JSON.parse(raw) as OpenRouterResponse;
  } catch {
    // fall through to the status-based error below
  }

  if (!response.ok) {
    throw new OpenRouterError(
      messageForStatus(response.status, payload.error?.message),
      response.status,
      payload.error?.message ?? raw.slice(0, 500),
    );
  }

  // OpenRouter can return 200 with an error body.
  if (payload.error) {
    throw new OpenRouterError(payload.error.message ?? 'OpenRouter returned an error.', 502, payload.error.message);
  }

  const choice = payload.choices?.[0];
  const content = choice?.message?.content ?? '';

  if (choice?.finish_reason === 'length') {
    throw new OpenRouterError(
      'The model hit its output limit before finishing. Try a shorter request or a model with a larger output budget.',
      502,
    );
  }

  if (!content.trim()) {
    throw new OpenRouterError('OpenRouter returned an empty response.', 502);
  }

  return { content, model: payload.model ?? options.model };
}

function messageForStatus(status: number, providerMessage?: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'OpenRouter rejected the API key. Check OPENROUTER_API_KEY.';
    case 402:
      return 'Your OpenRouter account is out of credits.';
    case 404:
      return providerMessage ?? 'That model is not available on OpenRouter.';
    case 429:
      return 'OpenRouter is rate limiting this key. Wait a moment and try again.';
    default:
      return providerMessage ?? `OpenRouter request failed (HTTP ${status}).`;
  }
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: string };

function parseAndValidate<T>(content: string, validator: ZodType<T>): ParseResult<T> {
  const candidate = extractJsonObject(content);
  if (candidate === undefined) {
    return { ok: false, errors: 'Response was not valid JSON.' };
  }

  const result = validator.safeParse(candidate);
  if (result.success) return { ok: true, data: result.data };

  const errors = result.error.issues
    .slice(0, 12)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');

  return { ok: false, errors };
}

async function repair<T>(
  options: CompletionOptions<T>,
  format: 'json_schema' | 'json_object',
  previous: string,
  errors: string,
): Promise<{ data: T; model: string } | undefined> {
  try {
    const { content, model } = await callOpenRouter(options, format, [
      {
        role: 'user',
        content: [
          'Your previous response did not match the required schema.',
          '',
          'Previous response:',
          previous.slice(0, 6000),
          '',
          'Validation errors:',
          errors,
          '',
          'Return the corrected JSON object only. No prose, no code fences.',
        ].join('\n'),
      },
    ]);

    const parsed = parseAndValidate(content, options.validator);
    return parsed.ok ? { data: parsed.data, model } : undefined;
  } catch {
    return undefined;
  }
}
