import type { z } from "zod";

/**
 * Durable, shareable state for a tool page.
 *
 * A tool keeps its answers in two places at once: the URL query string, so a
 * plan can be shared or bookmarked, and localStorage, so returning to the page
 * restores the last state. Both are untrusted input. A query string is edited
 * by hand and forwarded through chat clients; localStorage can hold anything a
 * previous version of the page wrote, or a different site entirely on a shared
 * origin. Every read therefore goes through the caller's zod schema, and a
 * failure discards that source rather than throwing into the render.
 *
 * Precedence is deliberate: a valid query string wins over stored state, so an
 * opened link always shows the plan it names. Storage is only consulted when
 * the query string has nothing usable.
 */

/** The minimal Storage surface used here, so a test can supply its own. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Where a loaded state came from, so a page can say so and offer the right reset. */
export type StateOrigin = "url" | "storage" | "default";

export interface LoadedState<T> {
  /** The validated state, or null when neither source held one. */
  readonly state: T | null;
  readonly origin: StateOrigin;
  /**
   * True when a source held a value that failed validation. The page can use it
   * to explain why nothing was restored instead of appearing to forget silently.
   */
  readonly discarded: boolean;
}

/**
 * Returns window.localStorage, or null when it cannot be reached at all.
 *
 * Reading the property throws outright when site data is blocked, so this is
 * not a theoretical guard; it is the difference between a working page and a
 * blank one in a locked-down browser.
 */
export function safeLocalStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Parses JSON without throwing.
 *
 * Returns a discriminated result so "there was no value" and "the value was not
 * JSON" stay distinguishable: the first is normal (a first visit), the second
 * means something wrote to the key that this tool did not.
 */
function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * Reads the query string of a URL and returns only its plain key/value pairs,
 * dropping any repeated key (an ambiguous value is worse than none).
 */
function queryRecord(search: string): Record<string, string> {
  const record: Record<string, string> = {};
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const seen = new Set<string>();
  for (const [key, value] of params.entries()) {
    // A repeated key makes the intended value ambiguous, so the whole key is
    // dropped rather than resolved by "first wins" or "last wins".
    if (seen.has(key)) {
      delete record[key];
      continue;
    }
    seen.add(key);
    record[key] = value;
  }
  return record;
}

/**
 * Parses a stored or queried state object through the tool's schema.
 *
 * The schema is the only authority on what is acceptable, so a hand-edited URL
 * claiming four million attendees, a negative amount, a string where a number
 * belongs, or a made-up edition is rejected here and never reaches a
 * calculation.
 */
function parseState<T>(schema: z.ZodType<T>, raw: unknown): T | null {
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Options for {@link loadToolState}. */
export interface LoadToolStateOptions<T> {
  /** The tool's schema, which decides what a valid state is. */
  readonly schema: z.ZodType<T>;
  /** Query-string key holding the whole state as JSON. */
  readonly queryKey: string;
  /** localStorage key holding the whole state as JSON. */
  readonly storageKey: string;
  /** The query string to read, normally `window.location.search`. */
  readonly search: string;
  /** Storage to read from; pass `safeLocalStorage()` or a test double. */
  readonly storage: StorageLike | null;
}

/**
 * Loads a tool's state, preferring a valid URL over stored state.
 *
 * Never throws: a corrupt query string, an unreadable storage object or a
 * record that fails the schema all resolve to "nothing usable", which the page
 * renders as its default state.
 */
export function loadToolState<T>(options: LoadToolStateOptions<T>): LoadedState<T> {
  const { schema, queryKey, storageKey, search, storage } = options;
  let discarded = false;

  const rawQuery = queryRecord(search)[queryKey];
  if (rawQuery !== undefined && rawQuery !== "") {
    const parsed = parseJson(rawQuery);
    if (parsed.ok) {
      const state = parseState(schema, parsed.value);
      if (state !== null) return { state, origin: "url", discarded: false };
    }
    discarded = true;
  }

  if (storage !== null) {
    let rawStored: string | null = null;
    try {
      rawStored = storage.getItem(storageKey);
    } catch {
      // Blocked or full: treat as absent rather than failing the page.
      rawStored = null;
    }
    if (rawStored !== null && rawStored !== "") {
      const parsed = parseJson(rawStored);
      if (parsed.ok) {
        const state = parseState(schema, parsed.value);
        if (state !== null) return { state, origin: "storage", discarded: false };
      }
      discarded = true;
    }
  }

  return { state: null, origin: "default", discarded };
}

/**
 * Writes a state to storage, ignoring a refusal.
 *
 * Persisting is a convenience: a browser that blocks storage or is over quota
 * must still give a working calculator, so a failed write is swallowed here and
 * the in-memory state carries on.
 */
export function saveToolState<T>(
  storage: StorageLike | null,
  storageKey: string,
  state: T,
): void {
  if (storage === null) return;
  try {
    storage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Private mode, blocked site data, or a full quota.
  }
}

/** Removes a stored state, ignoring a refusal. */
export function clearToolState(storage: StorageLike | null, storageKey: string): void {
  if (storage === null) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // Nothing to do: the state is memory-only for the rest of the visit.
  }
}

/**
 * Builds the shareable URL for a state: the current path with every other query
 * parameter dropped, so a shared link carries the plan and nothing stale.
 *
 * The state travels as JSON in one parameter rather than as a dozen separate
 * ones, which keeps the URL's shape stable as fields are added and means the
 * schema validates one object instead of reassembling fields by hand.
 */
export function buildShareUrl(origin: string, pathname: string, queryKey: string, state: unknown): string {
  const params = new URLSearchParams();
  params.set(queryKey, JSON.stringify(state));
  const base = origin.replace(/\/+$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}?${params.toString()}`;
}

/**
 * The state a reset produces: every field back to its default, which is also
 * what a first visit shows. Kept as a parameter rather than computed here so the
 * tool owns what its defaults are.
 */
export function resetToDefault<T>(defaults: T): T {
  return defaults;
}
