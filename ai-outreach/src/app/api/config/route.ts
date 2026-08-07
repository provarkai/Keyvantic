import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import type { ClientConfig } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Non-secret configuration for the UI: which models are selectable and whether
 * the server has a key at all. The key itself never leaves the server.
 */
export function GET() {
  return NextResponse.json<ClientConfig>({
    configured: env.openRouterApiKey.length > 0,
    defaultModel: env.model,
    models: env.allowedModels,
    webSearch: env.webSearch,
    scrapeCompanySite: env.scrapeCompanySite,
  });
}
