/**
 * The browser URL as an external store.
 *
 * The directory's filters and the hub's selected tab both live in the URL, so
 * both need to read it, be told when it changes, and write to it. React's own
 * answer to "state that lives outside React" is `useSyncExternalStore`, and it is
 * used here rather than an effect that copies the URL into state:
 *
 * - An effect that calls `setState` on mount renders the page twice and is what
 *   the `react-hooks/set-state-in-effect` rule exists to catch.
 * - A store read through `useSyncExternalStore` has a defined server snapshot, so
 *   the prerendered markup and the first client render agree and React re-renders
 *   with the real value immediately afterwards. No mismatch, no extra effect.
 *
 * The snapshots are primitives (`location.search` and `location.hash`), which is
 * what keeps this safe: `useSyncExternalStore` compares snapshots with
 * `Object.is`, and a freshly parsed object on every read would loop forever.
 * Callers parse the string with `useMemo` instead.
 *
 * Writing is deliberately not part of the store's own API. `pushState` and
 * `replaceState` are silent by design, so each caller writes and then calls
 * `notifyUrlChange()`; the difference between the two is a history question the
 * caller is best placed to answer.
 */

/** Returned during prerendering and hydration, where there is no URL to read. */
const SERVER_SEARCH = "";
const SERVER_HASH = "";

function canRead(): boolean {
  return typeof window !== "undefined" && typeof window.location !== "undefined";
}

export function getSearchSnapshot(): string {
  return canRead() ? window.location.search : SERVER_SEARCH;
}

export function getHashSnapshot(): string {
  return canRead() ? window.location.hash : SERVER_HASH;
}

export function getServerSearchSnapshot(): string {
  return SERVER_SEARCH;
}

export function getServerHashSnapshot(): string {
  return SERVER_HASH;
}

/**
 * Listener set shared by every subscriber.
 *
 * One pair of window listeners exists for the whole app while anything is
 * subscribed, rather than one pair per component, and they are removed when the
 * last subscriber goes away.
 */
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function notifyUrlChange(): void {
  emit();
}

/**
 * Subscribes to every way the URL can change without a remount:
 * `popstate` for back and forward, `hashchange` for a hash edited by hand or
 * followed from a link, and `notifyUrlChange` for our own writes.
 */
export function subscribeToUrl(listener: () => void): () => void {
  listeners.add(listener);

  if (listeners.size === 1 && canRead()) {
    window.addEventListener("popstate", emit);
    window.addEventListener("hashchange", emit);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && canRead()) {
      window.removeEventListener("popstate", emit);
      window.removeEventListener("hashchange", emit);
    }
  };
}

export type HistoryMode = "push" | "replace";

/**
 * Writes a URL and tells the subscribers.
 *
 * The href is built from the current pathname plus whatever the caller wants in
 * the query and hash, so a write can never drop the other half of the URL.
 */
export function writeUrl(href: string, mode: HistoryMode): void {
  if (!canRead()) return;
  if (mode === "push") window.history.pushState(null, "", href);
  else window.history.replaceState(null, "", href);
  emit();
}

/** The current pathname, or "" when there is none to read. */
export function currentPathname(): string {
  return canRead() ? window.location.pathname : "";
}
