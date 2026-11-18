import { z } from "zod";

/**
 * Recent searches, persisted in `localStorage`.
 *
 * The stored value is untrusted: it can be edited by hand, left over from an
 * older schema, or corrupted by a partial write. Every read is validated with
 * zod and anything that fails is discarded rather than thrown, so a bad value
 * can never break the palette. Writes are failure-tolerant too — Safari in
 * private mode, or a browser with site data blocked, throws on `setItem`.
 *
 * This module holds no React and no JSX, so it can be unit-tested as plain
 * functions and imported from either side of the client boundary.
 */

export const RECENT_SEARCHES_KEY = "tml-recent-searches";

/** Maximum number of stored searches. */
export const MAX_RECENT_SEARCHES = 5;

/** Must match `QUERY_MAX` in the search library. */
const MAX_QUERY_LENGTH = 80;

/**
 * Item shapes are validated strictly — one bad element means the whole value is
 * untrusted and discarded. The *count* is handled leniently instead: an
 * over-long list is truncated rather than thrown away, because a sixth search is
 * not evidence of corruption.
 */
const recentSearchesSchema = z.array(z.string().trim().min(1).max(MAX_QUERY_LENGTH));

/** Type-safe subset of the DOM `Storage` interface this module relies on. */
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * `localStorage`, or null when it is unavailable (SSR, disabled site data).
 *
 * Reading the property itself can throw when storage is blocked by policy, so
 * even the lookup is guarded.
 */
function getStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Trim, collapse internal whitespace, and cap at the schema limit. */
function normaliseQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

/**
 * Read the stored searches. Always returns an array, never throws, and drops
 * anything that fails validation.
 */
export function readRecentSearches(): string[] {
  const storage = getStorage();
  if (!storage) return [];

  let raw: string | null;
  try {
    raw = storage.getItem(RECENT_SEARCHES_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt JSON: clear it so we stop re-reading the same bad value.
    clearRecentSearches();
    return [];
  }

  const result = recentSearchesSchema.safeParse(parsed);
  if (!result.success) {
    clearRecentSearches();
    return [];
  }

  // Preserve order, drop duplicates a hand edit may have introduced.
  return [...new Set(result.data)].slice(0, MAX_RECENT_SEARCHES);
}

/**
 * Record a search. The newest term moves to the front, duplicates are removed
 * case-insensitively, and the list is capped. Returns the new list.
 */
export function addRecentSearch(query: string): string[] {
  const normalised = normaliseQuery(query);
  if (!normalised) return readRecentSearches();

  const existing = readRecentSearches();
  const deduped = existing.filter((item) => item.toLowerCase() !== normalised.toLowerCase());
  const next = [normalised, ...deduped].slice(0, MAX_RECENT_SEARCHES);
  writeRecentSearches(next);
  return next;
}

export function clearRecentSearches(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Nothing to recover from; the UI keeps its in-memory list.
  }
}

function writeRecentSearches(searches: string[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch {
    // Quota exceeded or storage disabled. Recent searches are a convenience;
    // failing to persist them must not interrupt the search itself.
  }
}
