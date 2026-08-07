import { NextResponse } from 'next/server';
import { enforceRateLimit, errorResponse, formatZodError, handleRouteError, resolveModel } from '@/lib/api-helpers';
import { assertConfigured, env } from '@/lib/env';
import { companyResearchJsonSchema } from '@/lib/json-schemas';
import { completeJson } from '@/lib/openrouter';
import { RESEARCH_SYSTEM_PROMPT, buildResearchPrompt } from '@/lib/prompts';
import { companyResearchSchema, researchRequestSchema, type ResearchResponse, type ResearchSource } from '@/lib/schemas';
import { fetchSiteSnapshot, normaliseWebsite, type SiteSnapshot } from '@/lib/site-fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  try {
    assertConfigured();

    const parsed = researchRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(formatZodError(parsed.error), 400);
    }

    const { companyName, website, model: requestedModel } = parsed.data;
    const model = resolveModel(requestedModel, env.model);
    const startedAt = Date.now();

    const sources: ResearchSource[] = [];
    let snapshot: SiteSnapshot | undefined;

    const url = normaliseWebsite(website);
    if (env.scrapeCompanySite && url) {
      const result = await fetchSiteSnapshot(url.toString());
      if (result.ok) {
        snapshot = result.snapshot;
        sources.push({
          kind: 'website',
          label: new URL(result.snapshot.url).hostname,
          detail: `Fetched ${result.snapshot.text.length.toLocaleString()} characters of page copy`,
        });
      } else {
        sources.push({ kind: 'website', label: url.hostname, detail: `Not used — ${result.reason}` });
      }
    }

    if (env.webSearch) {
      sources.push({ kind: 'web-search', label: 'OpenRouter web search', detail: 'Live results attached to the request' });
    }

    sources.push({
      kind: 'model-knowledge',
      label: model,
      detail: snapshot ? 'Used to interpret the page copy' : 'Primary basis for this brief',
    });

    const { data, model: usedModel } = await completeJson({
      model,
      schemaName: 'company_research',
      schema: companyResearchJsonSchema,
      validator: companyResearchSchema,
      temperature: 0.35,
      maxTokens: 5000,
      webSearch: env.webSearch,
      messages: [
        { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
        { role: 'user', content: buildResearchPrompt({ companyName, website, snapshot }) },
      ],
    });

    // Prefer what the user actually typed over the model's echo of it.
    const research = {
      ...data,
      companyName: data.companyName?.trim() || companyName || 'Unknown company',
      website: url ? url.toString() : data.website ?? '',
    };

    return NextResponse.json<ResearchResponse>({
      research,
      sources,
      model: usedModel,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
