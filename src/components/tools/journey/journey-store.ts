"use client";

import {
  clearJourneyState,
  defaultJourneyState,
  journeyStateSchema,
  JOURNEY_STORAGE_KEY,
  loadJourneyState,
  normaliseJourneyState,
  saveJourneyState,
  type JourneyState,
} from "./journey-state";
import type { StorageLike } from "../state";

/**
 * The Journey planner's plan, held outside React.
 *
 * The choice has to survive a reload, which means reading localStorage, and
 * localStorage does not exist during the server render. Reading it in a state
 * initialiser would make the first client render disagree with the server's
 * markup, and reading it in an effect would set state synchronously during
 * render's commit phase. So the plan lives in a small external store read through
 * `useSyncExternalStore`, which is React's supported way to do exactly this: the
 * server snapshot is always the default, and the stored plan arrives immediately
 * after hydration.
 *
 * Three rules hold here:
 *
 * 1. Every read goes through `loadJourneyState`, so a tampered or stale record
 *    resolves to the default plan instead of reaching the render.
 * 2. A refused write (private mode, blocked site data, full quota) still holds
 *    for the rest of the visit, because the last committed value is cached
 *    against the Storage object it belongs to.
 * 3. The snapshot is referentially stable while nothing changes, so React does
 *    not re-render in a loop.
 */

export interface JourneySnapshot {
  readonly state: JourneyState;
  /** True when stored JSON failed validation, so the page offers to start fresh. */
  readonly discarded: boolean;
  /**
   * True when a stored plan was valid but named a bed from the other edition, so
   * only that choice was reset. Kept separate from `discarded` because the reader
   * did choose the edition and the arrival method, and both were kept.
   */
  readonly repaired: boolean;
}

const DEFAULT_SNAPSHOT: JourneySnapshot = Object.freeze({
  state: defaultJourneyState("belgium"),
  discarded: false,
  repaired: false,
});

let cache: { readonly storage: StorageLike | null; snapshot: JourneySnapshot } | null = null;
const listeners = new Set<() => void>();

/** window.localStorage, or null when site data is blocked outright. */
function currentStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function snapshotFromStorage(storage: StorageLike | null): JourneySnapshot {
  const loaded = loadJourneyState(storage);
  return { state: loaded.state, discarded: loaded.discarded, repaired: loaded.repaired };
}

function getSnapshot(): JourneySnapshot {
  const storage = currentStorage();
  if (cache === null || cache.storage !== storage) {
    cache = { storage, snapshot: snapshotFromStorage(storage) };
  }
  return cache.snapshot;
}

/** The server has no storage to read, so it always renders the default plan. */
function getServerSnapshot(): JourneySnapshot {
  return DEFAULT_SNAPSHOT;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  /* One window listener for the whole app, attached while anything is subscribed,
     so a plan changed in another tab is picked up rather than silently overridden
     by this tab's cached copy. */
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== null && event.key !== JOURNEY_STORAGE_KEY) return;
    cache = { storage: currentStorage(), snapshot: snapshotFromStorage(currentStorage()) };
    emit();
  };

  if (listeners.size === 1) window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/**
 * Applies a new plan.
 *
 * The state is parsed again here even though every caller builds it from the
 * validated schema, because this is the one function that writes: a caller that
 * later passes something hand-built cannot put an invalid plan into storage.
 */
export function commitJourneyState(next: JourneyState): void {
  const parsed = journeyStateSchema.safeParse(next);
  if (!parsed.success) return;

  const storage = currentStorage();
  const state = normaliseJourneyState(parsed.data).state;
  saveJourneyState(storage, state);
  cache = { storage, snapshot: { state, discarded: false, repaired: false } };
  emit();
}

/** Restores this edition's default plan and forgets the stored one. */
export function resetJourneyState(edition: JourneyState["edition"]): void {
  const storage = currentStorage();
  clearJourneyState(storage);
  const state = defaultJourneyState(edition);
  cache = { storage, snapshot: { state, discarded: false, repaired: false } };
  emit();
}

export const journeyStore = { subscribe, getSnapshot, getServerSnapshot };
