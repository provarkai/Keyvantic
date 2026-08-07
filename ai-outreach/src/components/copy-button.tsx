'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';
import { Button } from './ui';

/**
 * Copy-to-clipboard with a confirmation state.
 *
 * `navigator.clipboard` needs a secure context, so this falls back to a
 * hidden textarea + `execCommand` for plain-http deployments and older
 * browsers rather than silently doing nothing.
 */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  variant = 'secondary',
  size = 'sm',
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    const ok = await writeToClipboard(value);
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }, [value]);

  return (
    <>
      <Button
        onClick={copy}
        variant={variant}
        size={size}
        className={className}
        disabled={value.trim().length === 0}
        title={value.trim().length === 0 ? 'Nothing to copy' : label}
      >
        {state === 'copied' ? (
          <CheckIcon className="size-3.5 text-[var(--color-mint)]" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
        {state === 'copied' ? copiedLabel : state === 'failed' ? 'Press Ctrl+C' : label}
      </Button>
      <span aria-live="polite" className="sr-only">
        {state === 'copied' ? `${label} copied to clipboard` : ''}
      </span>
    </>
  );
}

async function writeToClipboard(value: string): Promise<boolean> {
  if (!value) return false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }

  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
