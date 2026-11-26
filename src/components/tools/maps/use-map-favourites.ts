"use client";

/**
 * The favourites as an external store, read through `useSyncExternalStore`.
 *
 * ## Why not `useState` plus a mount effect
 *
 * `localStorage` does not exist during the server render, so the value can only be
 * read in the browser. Reading it in a mount effect and calling `setState` there
 * causes a second render pass on every visit and is the pattern React now warns
 * about. `useSyncExternalStore` is the supported way to read a mutable external
 * source: the server snapshot is the empty set, so the prerendered markup cannot
 * disagree with the first client render, and React re-renders with the stored
 * value as soon as it hydrates.
 *
 * This mirrors `src/components/a11y/a11y-store.ts`, for the same reasons.
 *
 * ## A refused write
 *
 * Private mode and a full quota both make `setItem` throw. The choice must not be
 * lost for the rest of the visit, so the last committed value is cached against the
 * `Storage` object it belongs to; while that object is the document's, the cache
 * answers. The same cache carries whether the last write succeeded, which is what
 * the panel's warning is driven by.
 */

import { useCallback, useSyncExternalStore } from "react";

import { PHYSICAL_VENUE_MAPS } from "@/lib/maps/geo-data";
import type { PhysicalVenueId } from "@/lib/maps/geo-types";

import {
  EMPTY_FAVOURITES,
  readFavourites,
  toggleFavourite,
  writeFavourites,
  type FavouritesByVenue,
} from "./map-favourites";

/** What a reader sees: the saved ids, and whether saving is working at all. */
export interface FavouritesSnapshot {
  readonly favourites: FavouritesByVenue;
  /** False once a write has been refused. */
  readonly writable: boolean;
}

const INITIAL: FavouritesSnapshot = { favourites: EMPTY_FAVOURITES, writable: true };

/** One cache entry, valid only for the `Storage` object it was read from. */
let cache: { storage: Storage | null; snapshot: FavouritesSnapshot } | null = null;

const listeners = new Set<() => void>();

/** `window.localStorage`, or null when site data is blocked outright. */
function currentStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns a stable object, so React's `Object.is` comparison never loops.
 *
 * A new object on every call would re-render forever, which is the one trap in
 * this hook.
 */
function getSnapshot(): FavouritesSnapshot {
  const storage = currentStorage();
  if (cache === null || cache.storage !== storage) {
    cache = { storage, snapshot: { favourites: readFavourites(PHYSICAL_VENUE_MAPS), writable: true } };
  }
  return cache.snapshot;
}

function getServerSnapshot(): FavouritesSnapshot {
  return INITIAL;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Commits a new value, recording whether the browser accepted the write.
 *
 * The in-memory value is kept either way, so a refused write costs the reader the
 * save rather than the interaction.
 */
function commit(favourites: FavouritesByVenue): void {
  const writable = writeFavourites(favourites);
  cache = { storage: currentStorage(), snapshot: { favourites, writable } };
  emit();
}

/** The store's current value, for a caller outside a React render. */
export function readFavouritesSnapshot(): FavouritesSnapshot {
  return getSnapshot();
}

export interface MapFavouritesApi {
  readonly favourites: FavouritesByVenue;
  readonly writable: boolean;
  readonly isFavourite: (venueId: PhysicalVenueId, nodeId: string) => boolean;
  readonly toggle: (venueId: PhysicalVenueId, nodeId: string) => void;
}

/** The favourites for the whole app; one store, because there is one browser. */
export function useMapFavourites(): MapFavouritesApi {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((venueId: PhysicalVenueId, nodeId: string) => {
    const current = getSnapshot().favourites;
    commit(toggleFavourite(current, venueId, nodeId));
  }, []);

  const isFavourite = useCallback(
    (venueId: PhysicalVenueId, nodeId: string) => snapshot.favourites[venueId].includes(nodeId),
    [snapshot],
  );

  return {
    favourites: snapshot.favourites,
    writable: snapshot.writable,
    isFavourite,
    toggle,
  };
}

/** Clears the module cache. For tests only. */
export function resetFavouritesCache(): void {
  cache = null;
  listeners.clear();
}
