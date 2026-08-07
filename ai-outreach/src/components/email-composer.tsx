'use client';

import { useEffect, useRef } from 'react';
import type { OutreachEmail } from '@/lib/schemas';
import { CopyButton } from './copy-button';
import { MailIcon, RefreshIcon, SparkIcon } from './icons';
import { Badge, Button, Section, Skeleton, cx } from './ui';

/**
 * Everything shown here is editable — the model's output is a first draft, and
 * edits are what actually gets copied. `draft` is owned by the page so edits
 * survive tab switches.
 */
export type EmailDraft = {
  subject: string;
  body: string;
  followUps: Array<{ waitDays: number; subject: string; body: string }>;
};

export function toDraft(email: OutreachEmail): EmailDraft {
  return {
    subject: email.subject,
    body: email.body,
    followUps: email.followUps.map((followUp) => ({ ...followUp })),
  };
}

export function EmailComposer({
  email,
  draft,
  onDraftChange,
  model,
  elapsedMs,
  onRegenerate,
  busy,
}: {
  email: OutreachEmail;
  draft: EmailDraft;
  onDraftChange: (next: EmailDraft) => void;
  model: string;
  elapsedMs: number;
  onRegenerate: () => void;
  busy: boolean;
}) {
  const edited =
    draft.subject !== email.subject ||
    draft.body !== email.body ||
    draft.followUps.some((followUp, index) => {
      const original = email.followUps[index];
      return !original || followUp.subject !== original.subject || followUp.body !== original.body;
    });

  const fullEmail = `Subject: ${draft.subject}\n\n${draft.body}`;
  const wholeSequence = [
    fullEmail,
    ...draft.followUps.map(
      (followUp, index) =>
        `--- Follow-up ${index + 1} (send after ${followUp.waitDays} day${followUp.waitDays === 1 ? '' : 's'}) ---\n` +
        `Subject: ${followUp.subject}\n\n${followUp.body}`,
    ),
  ].join('\n\n');

  return (
    <div className="animate-in space-y-4">
      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] p-5">
          <div className="flex items-center gap-2">
            <MailIcon className="size-4 text-[var(--color-ink-faint)]" />
            <h3 className="text-sm font-semibold tracking-tight">Cold email</h3>
            {edited ? <Badge tone="accent">edited</Badge> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={busy}>
              <RefreshIcon className={cx('size-3.5', busy && 'animate-spin')} />
              Rewrite
            </Button>
            <CopyButton value={draft.body} label="Copy body" />
            <CopyButton value={fullEmail} label="Copy email" variant="primary" />
          </div>
        </header>

        <div className="space-y-4 p-5">
          <div>
            <label className="field-label" htmlFor="email-subject">
              Subject
            </label>
            <input
              id="email-subject"
              className="field font-medium"
              value={draft.subject}
              onChange={(event) => onDraftChange({ ...draft, subject: event.target.value })}
            />
            <CharCount value={draft.subject.length} limit={60} noun="characters" />
          </div>

          {email.alternateSubjects.length > 0 ? (
            <div>
              <span className="field-label">Alternatives — click to use</span>
              <div className="flex flex-wrap gap-1.5">
                {email.alternateSubjects.map((subject, index) => (
                  <button
                    key={`${index}-${subject}`}
                    type="button"
                    onClick={() => onDraftChange({ ...draft, subject })}
                    className={cx(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      subject === draft.subject
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent-strong)]'
                        : 'border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-ink)]',
                    )}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="field-label" htmlFor="email-body">
              Body
            </label>
            <AutoTextarea
              id="email-body"
              value={draft.body}
              onChange={(value) => onDraftChange({ ...draft, body: value })}
              minRows={10}
            />
            <CharCount value={countWords(draft.body)} noun="words" />
          </div>
        </div>
      </section>

      {email.rationale.length > 0 ? (
        <Section title="Why this angle" icon={<SparkIcon className="size-4" />}>
          <ul className="space-y-2">
            {email.rationale.map((reason, index) => (
              <li key={`${index}-${reason.slice(0, 20)}`} className="flex gap-2.5 text-sm text-[var(--color-ink-muted)]">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--color-mint)]" />
                <span className="leading-relaxed">{reason}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {draft.followUps.length > 0 ? (
        <section className="card overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] p-5">
            <h3 className="text-sm font-semibold tracking-tight">Follow-up sequence</h3>
            <CopyButton value={wholeSequence} label="Copy full sequence" />
          </header>

          <div className="divide-y divide-[var(--color-line)]">
            {draft.followUps.map((followUp, index) => (
              <div key={index} className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Follow-up {index + 1}</span>
                    <Badge>
                      +{followUp.waitDays} day{followUp.waitDays === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <CopyButton
                    value={`Subject: ${followUp.subject}\n\n${followUp.body}`}
                    label="Copy"
                    variant="ghost"
                  />
                </div>

                <input
                  aria-label={`Follow-up ${index + 1} subject`}
                  className="field text-sm"
                  value={followUp.subject}
                  onChange={(event) => updateFollowUp(index, { subject: event.target.value })}
                />
                <AutoTextarea
                  ariaLabel={`Follow-up ${index + 1} body`}
                  value={followUp.body}
                  onChange={(value) => updateFollowUp(index, { body: value })}
                  minRows={5}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="px-1 text-[11px] text-[var(--color-ink-faint)]">
        {model} · {(elapsedMs / 1000).toFixed(1)}s · Always read before sending — check names, claims and figures.
      </p>
    </div>
  );

  function updateFollowUp(index: number, patch: Partial<EmailDraft['followUps'][number]>) {
    onDraftChange({
      ...draft,
      followUps: draft.followUps.map((followUp, i) => (i === index ? { ...followUp, ...patch } : followUp)),
    });
  }
}

/** Textarea that grows with its content so long emails never need inner scrolling. */
function AutoTextarea({
  id,
  ariaLabel,
  value,
  onChange,
  minRows,
}: {
  id?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  minRows: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      id={id}
      ref={ref}
      aria-label={ariaLabel}
      rows={minRows}
      value={value}
      spellCheck
      onChange={(event) => onChange(event.target.value)}
      className="field resize-none overflow-hidden font-mono text-[13px] leading-relaxed"
    />
  );
}

function CharCount({ value, limit, noun }: { value: number; limit?: number; noun: string }) {
  const over = limit !== undefined && value > limit;
  return (
    <p className={cx('mt-1.5 text-[11px]', over ? 'text-[var(--color-amber)]' : 'text-[var(--color-ink-faint)]')}>
      {value} {noun}
      {limit !== undefined ? ` · aim for under ${limit}` : ''}
    </p>
  );
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/* ------------------------------------------------------------------ */

export function EmailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="card space-y-4 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}
