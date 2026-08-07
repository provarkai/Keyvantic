'use client';

import type { CompanyResearch, ResearchSource } from '@/lib/schemas';
import { BoltIcon, LinkIcon, SearchIcon, TargetIcon, TrendIcon } from './icons';
import { Badge, Bullets, Section, Skeleton, confidenceTone, effortTone, levelTone } from './ui';

export function AnalysisPanel({
  research,
  sources,
  model,
  elapsedMs,
}: {
  research: CompanyResearch;
  sources: ResearchSource[];
  model: string;
  elapsedMs: number;
}) {
  return (
    <div className="animate-in space-y-4">
      <Overview research={research} model={model} elapsedMs={elapsedMs} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="What they do" icon={<SearchIcon className="size-4" />}>
          <Bullets items={research.whatTheyDo} />

          {research.products.length > 0 ? (
            <div className="mt-5 border-t border-[var(--color-line)] pt-4">
              <h4 className="field-label">Products &amp; services</h4>
              <ul className="space-y-2.5">
                {research.products.map((product, index) => (
                  <li key={`${index}-${product.name}`} className="text-sm">
                    <span className="font-medium text-[var(--color-ink)]">{product.name}</span>
                    <span className="text-[var(--color-ink-muted)]"> — {product.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>

        <Section title="Who they sell to" icon={<TargetIcon className="size-4" />}>
          <Bullets items={research.targetCustomers} />

          {research.techSignals.length > 0 ? (
            <div className="mt-5 border-t border-[var(--color-line)] pt-4">
              <h4 className="field-label">Signals</h4>
              <div className="flex flex-wrap gap-1.5">
                {research.techSignals.map((signal, index) => (
                  <Badge key={`${index}-${signal}`}>{signal}</Badge>
                ))}
              </div>
            </div>
          ) : null}
        </Section>
      </div>

      <Section title="Pain points" icon={<TrendIcon className="size-4" />} count={research.painPoints.length}>
        <ul className="space-y-3">
          {research.painPoints.map((pain, index) => (
            <li
              key={`${index}-${pain.title}`}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-medium text-[var(--color-ink)]">{pain.title}</h4>
                <Badge tone={levelTone(pain.severity)}>{pain.severity} severity</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{pain.description}</p>
              <p className="mt-2.5 text-xs leading-relaxed text-[var(--color-ink-faint)]">
                <span className="font-medium uppercase tracking-wide">Basis</span> · {pain.evidence}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Opportunities" icon={<TrendIcon className="size-4" />} count={research.opportunities.length}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {research.opportunities.map((opportunity, index) => (
            <li
              key={`${index}-${opportunity.title}`}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4"
            >
              <h4 className="text-sm font-medium text-[var(--color-ink)]">{opportunity.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{opportunity.description}</p>
              <p className="mt-2.5 text-xs leading-relaxed text-[var(--color-mint)]">{opportunity.impact}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Where AI & automation would help"
        icon={<BoltIcon className="size-4" />}
        count={research.aiOpportunities.length}
      >
        <ul className="space-y-3">
          {research.aiOpportunities.map((item, index) => (
            <li
              key={`${index}-${item.title}`}
              className="rounded-xl border border-[#2a3350] bg-[#111527] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-medium text-[var(--color-ink)]">{item.title}</h4>
                <Badge tone="accent">{item.functionArea}</Badge>
                <Badge tone={effortTone(item.effort)}>{item.effort} effort</Badge>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-ink-muted)]">{item.useCase}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{item.howItHelps}</p>
              <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-[var(--color-mint)]">
                <BoltIcon className="mt-px size-3.5 shrink-0" />
                {item.estimatedImpact}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Outreach angles" icon={<TargetIcon className="size-4" />}>
          <Bullets items={research.outreachAngles} />
        </Section>

        <Section title="Assumptions & sources" icon={<LinkIcon className="size-4" />}>
          {research.assumptions.length > 0 ? (
            <ul className="space-y-2">
              {research.assumptions.map((assumption, index) => (
                <li key={`${index}-${assumption.slice(0, 20)}`} className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {assumption}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-ink-faint)]">No material assumptions flagged.</p>
          )}

          <div className="mt-5 space-y-2 border-t border-[var(--color-line)] pt-4">
            {sources.map((source, index) => (
              <div key={`${index}-${source.label}`} className="flex items-baseline gap-2 text-xs">
                <Badge tone={source.kind === 'website' ? 'accent' : 'neutral'}>{sourceLabel(source.kind)}</Badge>
                <span className="min-w-0 flex-1 text-[var(--color-ink-muted)]">
                  <span className="font-medium text-[var(--color-ink)]">{source.label}</span> — {source.detail}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function sourceLabel(kind: ResearchSource['kind']): string {
  switch (kind) {
    case 'website':
      return 'Website';
    case 'web-search':
      return 'Web search';
    default:
      return 'Model';
  }
}

function Overview({
  research,
  model,
  elapsedMs,
}: {
  research: CompanyResearch;
  model: string;
  elapsedMs: number;
}) {
  const facts = [
    { label: 'Industry', value: research.industry },
    { label: 'Business model', value: research.businessModel },
    { label: 'Size', value: research.companySizeEstimate },
    { label: 'HQ', value: research.hqLocation },
  ].filter((fact) => fact.value && fact.value.toLowerCase() !== 'unknown');

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{research.companyName}</h2>
          {research.website ? (
            <a
              href={research.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--color-accent-strong)] hover:underline"
            >
              <LinkIcon className="size-3.5" />
              {hostname(research.website)}
            </a>
          ) : null}
        </div>
        <Badge tone={confidenceTone(research.confidence)}>{research.confidence} confidence</Badge>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">{research.oneLiner}</p>

      {facts.length > 0 ? (
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--color-line)] pt-4 sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="field-label mb-1">{fact.label}</dt>
              <dd className="truncate text-sm text-[var(--color-ink)]" title={fact.value}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="mt-4 text-[11px] text-[var(--color-ink-faint)]">
        {model} · {(elapsedMs / 1000).toFixed(1)}s
      </p>
    </section>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ */

export function AnalysisSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="card space-y-4 p-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="grid grid-cols-4 gap-4 pt-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-9" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((index) => (
          <div key={index} className="card space-y-3 p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ))}
      </div>
      <div className="card space-y-3 p-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
