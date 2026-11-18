"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * Edition state for the site shell.
 *
 * The choice is stored in localStorage and read through `useSyncExternalStore`, which is React's
 * supported way of reading an external store: the server snapshot is always the default, so the
 * prerendered markup cannot disagree with the first client render, and React re-renders with the
 * stored value immediately after hydration.
 */

export type EditionId = "belgium" | "winter" | "brasil";

export interface EditionOption {
  readonly id: EditionId;
  readonly label: string;
  /** Short code for space-constrained surfaces. */
  readonly shortLabel: string;
}

export const EDITIONS: readonly EditionOption[] = [
  { id: "belgium", label: "Belgium", shortLabel: "BE" },
  { id: "winter", label: "Winter", shortLabel: "WI" },
  { id: "brasil", label: "Brasil", shortLabel: "BR" },
];

export const DEFAULT_EDITION: EditionId = "belgium";

/** localStorage key holding the visitor's edition choice. */
export const EDITION_STORAGE_KEY = "tml-edition";

export function isEditionId(value: unknown): value is EditionId {
  return typeof value === "string" && EDITIONS.some((edition) => edition.id === value);
}

/* ---------------------------------------------------------------------------------------------
 * Store
 *
 * localStorage is the source of truth, with one wrinkle: a write can be refused (private mode,
 * blocked site data, a full quota), and the choice must still hold for the rest of the visit
 * instead of snapping back on the next read. So the last committed value is cached against the
 * Storage object it belongs to: while that Storage object is the document's, the cache answers;
 * if the object is ever replaced, the cache is discarded and storage is read again.
 * ------------------------------------------------------------------------------------------- */

let cache: { storage: Storage | null; edition: EditionId } | null = null;
const listeners = new Set<() => void>();

function currentStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Even reading the property can throw when site data is blocked outright.
    return null;
  }
}

function readStoredEdition(storage: Storage | null): EditionId | null {
  if (storage === null) return null;
  try {
    const stored = storage.getItem(EDITION_STORAGE_KEY);
    return isEditionId(stored) ? stored : null;
  } catch {
    // Private mode, blocked site data, sandboxed frame.
    return null;
  }
}

function writeStoredEdition(storage: Storage | null, edition: EditionId): void {
  if (storage === null) return;
  try {
    storage.setItem(EDITION_STORAGE_KEY, edition);
  } catch {
    // Persisting is a convenience; the cache keeps the choice for this visit.
  }
}

/** Returns a primitive, so React compares snapshots with Object.is and never loops. */
function getSnapshot(): EditionId {
  const storage = currentStorage();
  if (cache === null || cache.storage !== storage) {
    cache = { storage, edition: readStoredEdition(storage) ?? DEFAULT_EDITION };
  }
  return cache.edition;
}

/** The server has no storage to read, so it always renders the default edition. */
function getServerSnapshot(): EditionId {
  return DEFAULT_EDITION;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== EDITION_STORAGE_KEY) return;
  // Another tab wrote or removed the key, so its value is authoritative again.
  cache = {
    storage: currentStorage(),
    edition: isEditionId(event.newValue) ? event.newValue : DEFAULT_EDITION,
  };
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

function commit(next: EditionId): void {
  if (!isEditionId(next)) return;
  const storage = currentStorage();
  writeStoredEdition(storage, next);
  cache = { storage, edition: next };
  emit();
}

/* ---------------------------------------------------------------------------------------------
 * React
 * ------------------------------------------------------------------------------------------- */

interface EditionContextValue {
  readonly edition: EditionId;
  readonly setEdition: (edition: EditionId) => void;
}

const EditionContext = createContext<EditionContextValue | null>(null);

export function EditionProvider({ children }: { children: ReactNode }) {
  const edition = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Mirrors the choice onto <body data-ed>, which is what switches the --ea accent in globals.css.
  useEffect(() => {
    document.body.dataset.ed = edition;
  }, [edition]);

  const setEdition = useCallback((next: EditionId) => {
    commit(next);
  }, []);

  const value = useMemo<EditionContextValue>(() => ({ edition, setEdition }), [edition, setEdition]);

  return <EditionContext.Provider value={value}>{children}</EditionContext.Provider>;
}

export function useEdition(): EditionContextValue {
  const context = useContext(EditionContext);
  if (context === null) {
    throw new Error("useEdition must be used inside EditionProvider (rendered by SiteShell).");
  }
  return context;
}
