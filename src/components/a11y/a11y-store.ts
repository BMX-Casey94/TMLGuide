"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  A11Y_STORAGE_KEY,
  DEFAULT_A11Y_PREFS,
  applyPrefsToElement,
  parsePrefs,
  serialisePrefs,
  type A11yPrefKey,
  type A11yPrefs,
} from "./a11y-prefs";

/**
 * The accessibility preferences as an external store.
 *
 * localStorage is the source of truth, read through `useSyncExternalStore`, which is React's
 * supported way of reading a mutable external source: the server snapshot is always the defaults,
 * so the prerendered panel cannot disagree with the first client render, and React re-renders with
 * the stored value as soon as it hydrates.
 *
 * A failed write (private mode, blocked site data, a full quota) must not lose the choice for the
 * rest of the visit, so the last committed value is cached against the Storage object it belongs to.
 * While that object is the document's, the cache answers; if it is ever replaced, storage is read
 * again. This is the same shape as the edition store in `src/components/shell/edition-context.tsx`,
 * for the same reason.
 */

let cache: { storage: Storage | null; prefs: A11yPrefs } | null = null;
const listeners = new Set<() => void>();

function currentStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Reading the property itself can throw when site data is blocked outright.
    return null;
  }
}

function readStored(storage: Storage | null): A11yPrefs {
  if (storage === null) return DEFAULT_A11Y_PREFS;
  try {
    return parsePrefs(storage.getItem(A11Y_STORAGE_KEY));
  } catch {
    // Private mode, blocked storage, a sandboxed frame.
    return DEFAULT_A11Y_PREFS;
  }
}

function writeStored(storage: Storage | null, prefs: A11yPrefs): void {
  if (storage === null) return;
  try {
    storage.setItem(A11Y_STORAGE_KEY, serialisePrefs(prefs));
  } catch {
    // Persisting is a convenience; the cache holds the choice for this visit.
  }
}

/** Publishes the preferences onto <html>. Cheap, idempotent and safe to call at any time. */
function applyToDocument(prefs: A11yPrefs): void {
  if (typeof document === "undefined") return;
  applyPrefsToElement(document.documentElement, prefs);
}

/** Returns a stable object, so React's Object.is comparison never loops. */
function getSnapshot(): A11yPrefs {
  const storage = currentStorage();
  if (cache === null || cache.storage !== storage) {
    cache = { storage, prefs: readStored(storage) };
  }
  return cache.prefs;
}

function getServerSnapshot(): A11yPrefs {
  return DEFAULT_A11Y_PREFS;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent): void {
  // `key` is null when another tab cleared the whole origin; both cases mean "read again".
  if (event.key !== null && event.key !== A11Y_STORAGE_KEY) return;
  const prefs = parsePrefs(event.newValue);
  cache = { storage: currentStorage(), prefs };
  applyToDocument(prefs);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // One window listener for the whole app, attached while anything is subscribed.
  if (listeners.size === 1) window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", handleStorage);
  };
}

function commit(next: A11yPrefs): void {
  const storage = currentStorage();
  writeStored(storage, next);
  cache = { storage, prefs: next };
  applyToDocument(next);
  emit();
}

/**
 * Applies whatever is stored, without going through React.
 *
 * Called once on mount. The inline boot script has already done this before the first paint, so
 * in production this is a no-op. In development React's Strict Mode remounts the tree and resets
 * `<html>` to the attributes it manages from JSX, which would drop the script's work; this puts it
 * back before the browser paints.
 */
export function syncDocumentWithStoredPrefs(): A11yPrefs {
  const prefs = getSnapshot();
  applyToDocument(prefs);
  return prefs;
}

/** The store's current value, for callers outside a React render. */
export function readA11yPrefs(): A11yPrefs {
  return getSnapshot();
}

interface A11yPrefsApi {
  readonly prefs: A11yPrefs;
  readonly setPref: <K extends A11yPrefKey>(key: K, value: A11yPrefs[K]) => void;
  readonly reset: () => void;
}

export function useA11yPrefs(): A11yPrefsApi {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPref = useCallback(
    <K extends A11yPrefKey>(key: K, value: A11yPrefs[K]) => {
      const current = getSnapshot();
      if (current[key] === value) return;
      commit({ ...current, [key]: value });
    },
    [],
  );

  const reset = useCallback(() => {
    commit(DEFAULT_A11Y_PREFS);
  }, []);

  return { prefs, setPref, reset };
}
