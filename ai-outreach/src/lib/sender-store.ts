'use client';

import { DEFAULT_SENDER, senderSchema, type Sender } from './schemas';

/**
 * Sender details persisted to localStorage.
 *
 * localStorage is an external store, so this is modelled as one and read with
 * `useSyncExternalStore` rather than hydrated in an effect: the server snapshot
 * is the default sender, React swaps in the stored value on the client without
 * a hydration mismatch, and a `storage` listener keeps other tabs in sync.
 */

const STORAGE_KEY = 'ai-outreach:sender';

const listeners = new Set<() => void>();

/** Cached so `getSnapshot` returns a referentially stable value between writes. */
let cache: Sender | undefined;

function read(): Sender {
  if (cache) return cache;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Stored data can be stale or hand-edited; validate before trusting it.
      const parsed = senderSchema.safeParse({ ...DEFAULT_SENDER, ...JSON.parse(raw) });
      cache = parsed.success ? parsed.data : DEFAULT_SENDER;
    } else {
      cache = DEFAULT_SENDER;
    }
  } catch {
    cache = DEFAULT_SENDER;
  }

  return cache;
}

export function subscribeToSender(onChange: () => void): () => void {
  listeners.add(onChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cache = undefined; // force a re-read on the next snapshot
    for (const listener of listeners) listener();
  };

  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function getSenderSnapshot(): Sender {
  return read();
}

export function getSenderServerSnapshot(): Sender {
  return DEFAULT_SENDER;
}

export function writeSender(next: Sender): void {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or quota exceeded — the in-memory value still applies.
  }
  for (const listener of listeners) listener();
}
