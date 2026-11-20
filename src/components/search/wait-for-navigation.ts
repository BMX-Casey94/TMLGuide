/**
 * Knowing when a navigation has actually arrived.
 *
 * The palette used to close the instant a result was chosen, which meant the
 * visitor watched an unchanged page for however long the route took. Closing on
 * "arrived" needs a definition that is true for the App Router, for a plain
 * `<a>` follow, and for a test.
 *
 * Two cases, and they need different answers:
 *
 * - **A route change.** Arrival is the address matching what was asked for:
 *   path and query. Requiring the fragment's element as well would be wrong —
 *   the page may not expose that id yet, and the reader would be told the page
 *   "did not open" when it plainly did.
 * - **A hash-only change.** The reader is already on the page and only the
 *   fragment moves, so there is no address change to watch. Arrival is the
 *   element existing.
 *
 * The second case is also why `scrollToHash` exists: landing on the record is a
 * separate job from closing the palette, and it retries on its own.
 *
 * Nothing here imports React, so it is tested directly against jsdom.
 */
import { splitHref } from "@/lib/search/routes";

/** The address a navigation is trying to reach. */
export interface NavigationTarget {
  /** The path, without query or fragment, e.g. `/guides/tickets`. */
  readonly pathname: string;
  /** The query, with a leading `?`, or "" when there is none. */
  readonly search: string;
  /** The anchor id, or null when the href has no fragment. */
  readonly anchor: string | null;
}

/** Where the browser was when the navigation started. */
export interface LocationSnapshot {
  readonly pathname: string;
  readonly search: string;
}

/** Break an internal href into the three parts that decide "arrived". */
export function navigationTarget(href: string): NavigationTarget | null {
  const split = splitHref(href);
  if (split === null) return null;

  const queryAt = split.path.indexOf("?");
  if (queryAt < 0) {
    return { pathname: split.path, search: "", anchor: split.anchor };
  }
  return {
    pathname: split.path.slice(0, queryAt),
    search: normalizeSearch(split.path.slice(queryAt)),
    anchor: split.anchor,
  };
}

/** `?a=1` for any query, and "" for an empty or absent one. */
export function normalizeSearch(search: string): string {
  if (search === "" || search === "?") return "";
  return search.startsWith("?") ? search : `?${search}`;
}

/**
 * True when the navigation is complete.
 *
 * `from` is the address at click time. When the target differs from it, only the
 * address matters; when it does not (a fragment link on the page the reader is
 * already on), the fragment's element is the only evidence available.
 */
export function hasArrived(
  target: NavigationTarget,
  from: LocationSnapshot,
  environment: { pathname: string; search: string; document: Document },
): boolean {
  const pathChanged = target.pathname !== from.pathname;
  const searchChanged = target.search !== normalizeSearch(from.search);

  if (pathChanged || searchChanged) {
    return (
      environment.pathname === target.pathname &&
      normalizeSearch(environment.search) === target.search
    );
  }

  if (target.anchor === null) {
    // Nothing to change and nothing to scroll to: the reader is already there,
    // so treat it as arrived rather than making them wait out a timeout.
    return true;
  }
  return environment.document.getElementById(target.anchor) !== null;
}

/** How long a chosen result may take before the palette says it did not open. */
export const NAVIGATION_TIMEOUT_MS = 8000;

/** How often to look. Short enough that a fast navigation closes at once. */
export const NAVIGATION_POLL_MS = 60;

export interface WaitForNavigationOptions {
  /** Where the browser was when the navigation started. Defaults to the current address. */
  readonly from?: LocationSnapshot;
  /** Give up after this long. Defaults to {@link NAVIGATION_TIMEOUT_MS}. */
  readonly timeoutMs?: number;
  /** Poll interval. Defaults to {@link NAVIGATION_POLL_MS}. */
  readonly pollMs?: number;
  /** Override the document, for tests. */
  readonly root?: Document;
  /** Override the window, for tests. */
  readonly window?: Window;
}

/**
 * Resolve true once the navigation has completed, or false if it has not within
 * the timeout or the href cannot be parsed.
 *
 * Never rejects: a navigation that did not happen is a normal outcome, and the
 * palette has a message for it.
 */
export function waitForNavigation(
  href: string,
  options: WaitForNavigationOptions = {},
): Promise<boolean> {
  const target = navigationTarget(href);
  const win = options.window ?? (typeof window === "undefined" ? null : window);
  const doc = options.root ?? (typeof document === "undefined" ? null : document);

  if (target === null || win === null || doc === null) return Promise.resolve(false);

  const from: LocationSnapshot = options.from ?? {
    pathname: win.location.pathname,
    search: win.location.search,
  };
  const timeoutMs = options.timeoutMs ?? NAVIGATION_TIMEOUT_MS;
  const pollMs = options.pollMs ?? NAVIGATION_POLL_MS;

  return new Promise((resolve) => {
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (arrived: boolean) => {
      if (timer !== null) clearTimeout(timer);
      resolve(arrived);
    };

    const check = () => {
      if (
        hasArrived(target, from, {
          pathname: win.location.pathname,
          search: win.location.search,
          document: doc,
        })
      ) {
        finish(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        finish(false);
        return;
      }
      timer = setTimeout(check, pollMs);
    };

    // The first check is immediate: a hash-only navigation, or a route the
    // router replaces synchronously, closes the palette without a delay.
    check();
  });
}
