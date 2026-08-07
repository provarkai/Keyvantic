import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ConfigError, env } from './env';
import { OpenRouterError } from './openrouter';
import { checkRateLimit, clientKey } from './rate-limit';
import type { ApiError } from './schemas';

export function errorResponse(message: string, status: number, detail?: string): NextResponse<ApiError> {
  return NextResponse.json<ApiError>(detail ? { error: message, detail } : { error: message }, { status });
}

/** Maps thrown errors onto a response without leaking internals to the client. */
export function handleRouteError(error: unknown): NextResponse<ApiError> {
  if (error instanceof ConfigError) {
    return errorResponse(error.message, error.status);
  }

  if (error instanceof OpenRouterError) {
    // Provider detail is safe to surface: it never contains our key.
    const status = error.status >= 400 && error.status < 600 ? error.status : 502;
    return errorResponse(error.message, status === 401 || status === 403 ? 503 : status, error.detail);
  }

  if (error instanceof SyntaxError) {
    return errorResponse('Request body was not valid JSON.', 400);
  }

  console.error('[api] unhandled error', error);
  return errorResponse('Something went wrong. Please try again.', 500);
}

/** Returns a 429 response when the caller is over the limit, otherwise undefined. */
export function enforceRateLimit(request: Request): NextResponse<ApiError> | undefined {
  const result = checkRateLimit(clientKey(request));
  if (result.allowed) return undefined;

  const response = errorResponse(
    `Too many requests. Try again in ${result.retryAfterSeconds}s.`,
    429,
  );
  response.headers.set('Retry-After', String(result.retryAfterSeconds));
  return response;
}

export function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request.';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Only lets callers pick models the operator has allowlisted. */
export function resolveModel(requested: string | undefined, fallback: string): string {
  if (!requested) return fallback;
  return env.allowedModels.includes(requested) ? requested : fallback;
}
