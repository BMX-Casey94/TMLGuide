/**
 * The in-flight navigation store.
 *
 * The progress bar has to know two things it cannot observe on its own: that a
 * navigation has *started* (a click, or a palette result being chosen — no
 * browser event reports that), and that it has *finished* (which the router can
 * see, from a pathname or search-params change).
 *
 * Both live here as one tiny external store. It holds a frozen object, so
 * React's `Object.is` comparison in `useSyncExternalStore` is stable, and the
 * `seq` counter means two navigations to the same href still notify.
 *
 * No React import: this is testable as plain functions, and the two components
 * that read it (`Spinner` via `useNavigationPending`, `NavigationProgress`)
 * subscribe through the same API.
 */

export interface NavigationState {
  /** The href being opened, or null when nothing is in flight. */
  readonly href: string | null;
  /** Incremented on every change, so an identical href still notifies. */
  readonly seq: number;
}

const IDLE: NavigationState = Object.freeze({ href: null, seq: 0 });

let state: NavigationState = IDLE;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Announce that a client navigation has begun. Idempotent per href, but always notifies. */
export function startNavigation(href: string): void {
  state = Object.freeze({ href, seq: state.seq + 1 });
  emit();
}

/** Clear the in-flight navigation, whatever its outcome. */
export function settleNavigation(): void {
  if (state.href === null) return;
  state = Object.freeze({ href: null, seq: state.seq + 1 });
  emit();
}

export function getNavigationState(): NavigationState {
  return state;
}

/** The snapshot the server and the first client render agree on: nothing in flight. */
export function getServerNavigationState(): NavigationState {
  return IDLE;
}

export function subscribeToNavigation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Run `navigate`, with the store reporting the attempt.
 *
 * If `navigate` throws (a router refusing the push, a bad href), the store is
 * cleared before the error propagates: a bar that runs for ever is worse than a
 * navigation that failed.
 */
export function withNavigation<T>(href: string, navigate: () => T): T {
  startNavigation(href);
  try {
    return navigate();
  } catch (error) {
    settleNavigation();
    throw error;
  }
}

/** For tests: reset to idle and drop every listener. */
export function resetNavigationStore(): void {
  state = IDLE;
  listeners.clear();
}
