'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnalysisPanel, AnalysisSkeleton } from '@/components/analysis-panel';
import { EmailComposer, EmailSkeleton, toDraft, type EmailDraft } from '@/components/email-composer';
import { MailIcon, SearchIcon, SparkIcon } from '@/components/icons';
import { ResearchForm, type ResearchInput } from '@/components/research-form';
import { Badge, ErrorBanner, cx } from '@/components/ui';
import {
  getSenderServerSnapshot,
  getSenderSnapshot,
  subscribeToSender,
  writeSender,
} from '@/lib/sender-store';
import type { ApiError, ClientConfig, EmailResponse, ResearchResponse } from '@/lib/schemas';

type Tab = 'analysis' | 'email';

type Failure = { message: string; detail?: string };

export default function HomePage() {
  const [config, setConfig] = useState<ClientConfig>();
  const [input, setInput] = useState<ResearchInput>({ companyName: '', website: '' });
  const sender = useSyncExternalStore(subscribeToSender, getSenderSnapshot, getSenderServerSnapshot);
  const [senderOpen, setSenderOpen] = useState(false);
  const [model, setModel] = useState('');

  const [research, setResearch] = useState<ResearchResponse>();
  const [email, setEmail] = useState<EmailResponse>();
  const [draft, setDraft] = useState<EmailDraft>();

  const [stage, setStage] = useState<'idle' | 'researching' | 'writing'>('idle');
  const [failure, setFailure] = useState<Failure>();
  const [tab, setTab] = useState<Tab>('analysis');

  // Abort in-flight work when a new run starts or the page unmounts.
  const abortRef = useRef<AbortController>(undefined);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    fetch('/api/config')
      .then((response) => (response.ok ? (response.json() as Promise<ClientConfig>) : undefined))
      .then((value) => {
        if (!value) return;
        setConfig(value);
        setModel(value.defaultModel);
      })
      .catch(() => {
        /* the picker just stays hidden */
      });
  }, []);

  const generateEmail = useCallback(
    async (researchResult: ResearchResponse, signal: AbortSignal) => {
      // Deliberately does not switch tabs: the brief is worth reading, and the
      // Email tab flags itself as ready. Only a direct "Rewrite" jumps across.
      setStage('writing');

      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ research: researchResult.research, sender, model: model || undefined }),
        signal,
      });

      const payload = (await response.json()) as EmailResponse | ApiError;
      if (!response.ok) throw toFailure(payload);

      const result = payload as EmailResponse;
      setEmail(result);
      setDraft(toDraft(result.email));
    },
    [model, sender],
  );

  const runFullFlow = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFailure(undefined);
    setResearch(undefined);
    setEmail(undefined);
    setDraft(undefined);
    setStage('researching');
    setTab('analysis');

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: input.companyName,
          website: input.website,
          model: model || undefined,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as ResearchResponse | ApiError;
      if (!response.ok) throw toFailure(payload);

      const result = payload as ResearchResponse;
      setResearch(result);

      await generateEmail(result, controller.signal);
    } catch (error) {
      if (isAbort(error)) return;
      setFailure(describeError(error));
    } finally {
      if (abortRef.current === controller) setStage('idle');
    }
  }, [generateEmail, input.companyName, input.website, model]);

  const rewriteEmail = useCallback(async () => {
    if (!research) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFailure(undefined);
    setEmail(undefined);
    setDraft(undefined);
    setTab('email'); // an explicit rewrite means the user wants to see the result

    try {
      await generateEmail(research, controller.signal);
    } catch (error) {
      if (isAbort(error)) return;
      setFailure(describeError(error));
    } finally {
      if (abortRef.current === controller) setStage('idle');
    }
  }, [generateEmail, research]);

  const busy = stage !== 'idle';
  const notConfigured = config !== undefined && !config.configured;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-20 sm:px-6 lg:px-8">
      <Header />

      {notConfigured ? (
        <div className="mb-6">
          <ErrorBanner
            message="No OpenRouter API key configured"
            detail="Copy .env.example to .env.local, set OPENROUTER_API_KEY, and restart the dev server."
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ResearchForm
            input={input}
            onInputChange={setInput}
            sender={sender}
            onSenderChange={writeSender}
            models={config?.models ?? []}
            model={model}
            onModelChange={setModel}
            busy={busy}
            stage={stage === 'researching' ? 'Researching…' : stage === 'writing' ? 'Writing email…' : undefined}
            hasResearch={research !== undefined}
            senderOpen={senderOpen}
            onToggleSender={() => setSenderOpen((open) => !open)}
            onSubmit={runFullFlow}
            onRegenerateEmail={rewriteEmail}
          />
        </div>

        <main className="min-w-0 space-y-4">
          {failure ? <ErrorBanner message={failure.message} detail={failure.detail} /> : null}

          {research || busy ? (
            <>
              <Tabs
                tab={tab}
                onChange={setTab}
                emailReady={draft !== undefined}
                emailPending={stage === 'writing'}
              />

              {tab === 'analysis' ? (
                research ? (
                  <AnalysisPanel
                    research={research.research}
                    sources={research.sources}
                    model={research.model}
                    elapsedMs={research.elapsedMs}
                  />
                ) : (
                  <AnalysisSkeleton />
                )
              ) : email && draft ? (
                <EmailComposer
                  email={email.email}
                  draft={draft}
                  onDraftChange={setDraft}
                  model={email.model}
                  elapsedMs={email.elapsedMs}
                  onRegenerate={rewriteEmail}
                  busy={busy}
                />
              ) : stage === 'writing' ? (
                <EmailSkeleton />
              ) : (
                <p className="card p-6 text-sm text-[var(--color-ink-faint)]">
                  Run the research first — the email is written from the brief.
                </p>
              )}
            </>
          ) : (
            <EmptyState disabled={notConfigured} />
          )}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 py-8">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl border border-[#33406b] bg-[#161c30]">
          <SparkIcon className="size-5 text-[var(--color-accent-strong)]" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">AI Outreach</h1>
          <p className="text-xs text-[var(--color-ink-faint)]">
            Research any company, then write the email that opens the conversation
          </p>
        </div>
      </div>
      <Badge tone="accent">Powered by OpenRouter</Badge>
    </header>
  );
}

function Tabs({
  tab,
  onChange,
  emailReady,
  emailPending,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  emailReady: boolean;
  emailPending: boolean;
}) {
  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; hint?: string }> = [
    { id: 'analysis', label: 'Analysis', icon: <SearchIcon className="size-4" /> },
    {
      id: 'email',
      label: 'Email',
      icon: <MailIcon className="size-4" />,
      hint: emailPending ? 'writing' : emailReady ? 'ready' : undefined,
    },
  ];

  return (
    <div role="tablist" aria-label="Results" className="flex gap-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-1">
      {tabs.map((entry) => (
        <button
          key={entry.id}
          role="tab"
          aria-selected={tab === entry.id}
          onClick={() => onChange(entry.id)}
          className={cx(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
            tab === entry.id
              ? 'bg-[var(--color-surface-raised)] font-medium text-[var(--color-ink)]'
              : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
          )}
        >
          {entry.icon}
          {entry.label}
          {entry.hint ? (
            <span className="text-[11px] text-[var(--color-ink-faint)]">· {entry.hint}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ disabled }: { disabled: boolean }) {
  const steps = [
    { title: 'Research the company', body: 'The website is fetched and read, so the brief cites real page copy rather than recall.' },
    { title: 'Surface pain points', body: 'Operational and commercial friction, each with the evidence it was inferred from.' },
    { title: 'Map AI opportunities', body: 'Concrete workflows where automation removes work, scored by effort and impact.' },
    { title: 'Draft the email', body: 'A personalised cold email plus follow-ups — fully editable, ready to copy.' },
  ];

  return (
    <div className="card p-8 sm:p-10">
      <div className="max-w-xl">
        <h2 className="text-xl font-semibold tracking-tight">
          {disabled ? 'Add an API key to get started' : 'Start with a company'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          {disabled
            ? 'The server needs an OpenRouter key before it can research anything.'
            : 'Enter a name or website on the left and hit Research company. Everything below is generated from that one input.'}
        </p>
      </div>

      <ol className="mt-8 grid gap-4 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4"
          >
            <span className="grid size-6 place-items-center rounded-md border border-[#33406b] bg-[#161c30] text-[11px] font-semibold text-[var(--color-accent-strong)]">
              {index + 1}
            </span>
            <h3 className="mt-3 text-sm font-medium">{step.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink-muted)]">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */

class RequestFailure extends Error {
  readonly detail: string | undefined;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = 'RequestFailure';
    this.detail = detail;
  }
}

function toFailure(payload: unknown): RequestFailure {
  const body = payload as Partial<ApiError> | undefined;
  return new RequestFailure(body?.error ?? 'The request failed.', body?.detail);
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function describeError(error: unknown): Failure {
  if (error instanceof RequestFailure) {
    return error.detail ? { message: error.message, detail: error.detail } : { message: error.message };
  }
  return {
    message: 'Could not reach the server.',
    detail: error instanceof Error ? error.message : undefined,
  };
}
