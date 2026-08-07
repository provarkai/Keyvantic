import type { ReactNode } from 'react';
import { AlertIcon } from './icons';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'accent' | 'mint' | 'amber' | 'rose';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] text-[var(--color-ink-muted)]',
  accent: 'border-[#33406b] bg-[#1a2038] text-[var(--color-accent-strong)]',
  mint: 'border-[#1f4a3c] bg-[#122620] text-[var(--color-mint)]',
  amber: 'border-[#5a4322] bg-[#241d10] text-[var(--color-amber)]',
  rose: 'border-[#5c2733] bg-[#26131a] text-[var(--color-rose)]',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Maps a severity/effort/confidence value onto a consistent colour. */
export function levelTone(level: string): Tone {
  switch (level.toLowerCase()) {
    case 'high':
      return 'rose';
    case 'medium':
      return 'amber';
    case 'low':
      return 'mint';
    default:
      return 'neutral';
  }
}

/** Effort reads inversely to severity — low effort is the good news. */
export function effortTone(level: string): Tone {
  switch (level.toLowerCase()) {
    case 'low':
      return 'mint';
    case 'medium':
      return 'amber';
    case 'high':
      return 'rose';
    default:
      return 'neutral';
  }
}

export function confidenceTone(level: string): Tone {
  switch (level.toLowerCase()) {
    case 'high':
      return 'mint';
    case 'medium':
      return 'amber';
    case 'low':
      return 'rose';
    default:
      return 'neutral';
  }
}

/* ------------------------------------------------------------------ */

export function Section({
  title,
  icon,
  count,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('card p-5', className)}>
      <header className="mb-4 flex items-center gap-2">
        {icon ? <span className="text-[var(--color-ink-faint)]">{icon}</span> : null}
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {count !== undefined ? (
          <span className="rounded-full bg-[var(--color-surface-raised)] px-2 py-0.5 text-[11px] text-[var(--color-ink-faint)]">
            {count}
          </span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled,
  title,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const variants = {
    primary:
      'bg-[var(--color-accent)] text-[#080a12] hover:bg-[var(--color-accent-strong)] disabled:hover:bg-[var(--color-accent)] font-semibold',
    secondary:
      'border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent-strong)]',
    ghost: 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-ink)]',
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */

export function ErrorBanner({ message, detail }: { message: string; detail?: string }) {
  return (
    <div
      role="alert"
      className="animate-in flex gap-3 rounded-xl border border-[#5c2733] bg-[#1c1216] p-4 text-sm"
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0 text-[var(--color-rose)]" />
      <div className="min-w-0">
        <p className="font-medium text-[var(--color-ink)]">{message}</p>
        {detail ? (
          <p className="mt-1 break-words text-xs text-[var(--color-ink-faint)]">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

export function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-ink-faint)]">Nothing found.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 24)}`} className="flex gap-2.5 text-sm text-[var(--color-ink-muted)]">
          <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('shimmer rounded-md', className)} />;
}
