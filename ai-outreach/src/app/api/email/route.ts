import { NextResponse } from 'next/server';
import { enforceRateLimit, errorResponse, formatZodError, handleRouteError, resolveModel } from '@/lib/api-helpers';
import { assertConfigured, env } from '@/lib/env';
import { outreachEmailJsonSchema } from '@/lib/json-schemas';
import { completeJson } from '@/lib/openrouter';
import { EMAIL_SYSTEM_PROMPT, buildEmailPrompt } from '@/lib/prompts';
import { emailRequestSchema, outreachEmailSchema, type EmailResponse } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  try {
    assertConfigured();

    const parsed = emailRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(formatZodError(parsed.error), 400);
    }

    const { research, sender, model: requestedModel } = parsed.data;
    const model = resolveModel(requestedModel, env.emailModel);
    const startedAt = Date.now();

    const { data, model: usedModel } = await completeJson({
      model,
      schemaName: 'outreach_email',
      schema: outreachEmailJsonSchema,
      validator: outreachEmailSchema,
      // A little more latitude than research — this is a writing task.
      temperature: 0.7,
      maxTokens: 3000,
      messages: [
        { role: 'system', content: EMAIL_SYSTEM_PROMPT },
        { role: 'user', content: buildEmailPrompt(research, sender) },
      ],
    });

    const email = {
      ...data,
      followUps: sender.includeFollowUps ? data.followUps : [],
    };

    return NextResponse.json<EmailResponse>({
      email,
      model: usedModel,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
