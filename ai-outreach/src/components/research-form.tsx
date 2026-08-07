'use client';

import type { FormEvent } from 'react';
import { LENGTHS, TONES, type Sender } from '@/lib/schemas';
import { ChevronIcon, RefreshIcon, SearchIcon } from './icons';
import { Button, cx } from './ui';

export type ResearchInput = { companyName: string; website: string };

export function ResearchForm({
  input,
  onInputChange,
  sender,
  onSenderChange,
  models,
  model,
  onModelChange,
  busy,
  stage,
  hasResearch,
  senderOpen,
  onToggleSender,
  onSubmit,
  onRegenerateEmail,
}: {
  input: ResearchInput;
  onInputChange: (next: ResearchInput) => void;
  sender: Sender;
  onSenderChange: (next: Sender) => void;
  models: string[];
  model: string;
  onModelChange: (model: string) => void;
  busy: boolean;
  stage: string | undefined;
  hasResearch: boolean;
  senderOpen: boolean;
  onToggleSender: () => void;
  onSubmit: () => void;
  onRegenerateEmail: () => void;
}) {
  const canSubmit = (input.companyName.trim() || input.website.trim()).length > 0 && !busy;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) onSubmit();
  }

  const set = <K extends keyof Sender>(key: K, value: Sender[K]) => onSenderChange({ ...sender, [key]: value });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="card p-5">
        <h2 className="text-sm font-semibold tracking-tight">Target company</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-faint)]">
          A website gives far better results — the page copy is fetched and used as evidence.
        </p>

        <div className="mt-4 space-y-3.5">
          <div>
            <label className="field-label" htmlFor="companyName">
              Company name
            </label>
            <input
              id="companyName"
              className="field"
              placeholder="Acme Logistics"
              autoComplete="organization"
              value={input.companyName}
              disabled={busy}
              onChange={(event) => onInputChange({ ...input, companyName: event.target.value })}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="website">
              Website
            </label>
            <input
              id="website"
              className="field"
              placeholder="acmelogistics.com"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              value={input.website}
              disabled={busy}
              onChange={(event) => onInputChange({ ...input, website: event.target.value })}
            />
          </div>

          {models.length > 1 ? (
            <div>
              <label className="field-label" htmlFor="model">
                Model
              </label>
              <select
                id="model"
                className="field"
                value={model}
                disabled={busy}
                onChange={(event) => onModelChange(event.target.value)}
              >
                {models.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <Button type="submit" disabled={!canSubmit} className="mt-5 w-full">
          {busy ? (
            <>
              <span
                aria-hidden
                className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              {stage ?? 'Working…'}
            </>
          ) : (
            <>
              <SearchIcon className="size-4" />
              {hasResearch ? 'Research again' : 'Research company'}
            </>
          )}
        </Button>

        {hasResearch && !busy ? (
          <Button variant="secondary" onClick={onRegenerateEmail} className="mt-2 w-full">
            <RefreshIcon className="size-3.5" />
            Rewrite email
          </Button>
        ) : null}
      </div>

      {/* Sender details — collapsed by default so the primary action stays above the fold. */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={onToggleSender}
          aria-expanded={senderOpen}
          className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-[var(--color-surface-raised)]"
        >
          <span>
            <span className="block text-sm font-semibold tracking-tight">Your details</span>
            <span className="mt-0.5 block text-xs text-[var(--color-ink-faint)]">
              {describeSender(sender)}
            </span>
          </span>
          <ChevronIcon
            className={cx(
              'size-4 shrink-0 text-[var(--color-ink-faint)] transition-transform duration-200',
              senderOpen && 'rotate-180',
            )}
          />
        </button>

        {senderOpen ? (
          <div className="space-y-3.5 border-t border-[var(--color-line)] p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="senderName">
                  Your name
                </label>
                <input
                  id="senderName"
                  className="field"
                  placeholder="Jordan Blake"
                  value={sender.name}
                  disabled={busy}
                  onChange={(event) => set('name', event.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="senderRole">
                  Role
                </label>
                <input
                  id="senderRole"
                  className="field"
                  placeholder="Founder"
                  value={sender.role}
                  disabled={busy}
                  onChange={(event) => set('role', event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="senderCompany">
                Your company
              </label>
              <input
                id="senderCompany"
                className="field"
                placeholder="Northwind Automation"
                value={sender.company}
                disabled={busy}
                onChange={(event) => set('company', event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="offering">
                What you offer
              </label>
              <textarea
                id="offering"
                className="field resize-y"
                rows={2}
                placeholder="We build AI agents that clear support backlogs for logistics operators."
                value={sender.offering}
                disabled={busy}
                onChange={(event) => set('offering', event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="proofPoint">
                Proof point <span className="normal-case text-[var(--color-ink-faint)]">(optional)</span>
              </label>
              <textarea
                id="proofPoint"
                className="field resize-y"
                rows={2}
                placeholder="Cut first-response time from 9 hours to 40 minutes for a 3PL with 60 agents."
                value={sender.proofPoint}
                disabled={busy}
                onChange={(event) => set('proofPoint', event.target.value)}
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-ink-faint)]">
                Leave blank and no proof point is used — the model is told never to invent one.
              </p>
            </div>

            <div>
              <label className="field-label" htmlFor="cta">
                Call to action
              </label>
              <input
                id="cta"
                className="field"
                placeholder="Worth a short reply if this is on your roadmap?"
                value={sender.callToAction}
                disabled={busy}
                onChange={(event) => set('callToAction', event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="tone">
                  Tone
                </label>
                <select
                  id="tone"
                  className="field"
                  value={sender.tone}
                  disabled={busy}
                  onChange={(event) => set('tone', event.target.value as Sender['tone'])}
                >
                  {TONES.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="length">
                  Length
                </label>
                <select
                  id="length"
                  className="field"
                  value={sender.length}
                  disabled={busy}
                  onChange={(event) => set('length', event.target.value as Sender['length'])}
                >
                  {LENGTHS.map((length) => (
                    <option key={length} value={length}>
                      {length}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-sm text-[var(--color-ink-muted)]">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent)]"
                checked={sender.includeFollowUps}
                disabled={busy}
                onChange={(event) => set('includeFollowUps', event.target.checked)}
              />
              Include a 2-step follow-up sequence
            </label>
          </div>
        ) : null}
      </div>
    </form>
  );
}

function describeSender(sender: Sender): string {
  const identity = [sender.name, sender.company].filter(Boolean).join(' · ');
  if (!identity) return 'Add your name and offer to personalise the email';
  return identity;
}
