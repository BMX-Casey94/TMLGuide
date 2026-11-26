/**
 * Favourite zones, kept in the visitor's own browser and nowhere else.
 *
 * ## What is stored
 *
 * One `localStorage` key, `tml-map-favourites-v1`, holding a JSON object that maps
 * a venue id to a list of node ids — for example
 * `{"de-schorre":["ds-mainstage"],"dreamville":["dv-montagoe"]}`. Nothing else is
 * written: no name, no timestamp, no device identifier. A node id is only
 * meaningful alongside this guide's own data file, which makes the stored value
 * useless to anyone who reads it from a shared machine, and the key is namespaced
 * so it cannot collide with another application on the same origin.
 *
 * ## Every read is defensive
 *
 * `localStorage` throws on read in Safari's private mode and when site data is
 * blocked, and it can hold anything a previous version of this page — or a
 * visitor with the console open — put there. So a read is wrapped, the parsed
 * value is checked against the ids that actually exist on each venue, and an
 * unknown id is dropped rather than trusted. A corrupt value clears the key and
 * starts again instead of wedging the tool.
 */

import type { GeoMap, VenueMapId } from "@/lib/maps/geo-types";

/** The single storage key. Nothing else is stored for favourites. */
export const FAVOURITES_STORAGE_KEY = "tml-map-favourites-v1";

/** How many favourites a venue may hold. A cap keeps a hostile value bounded. */
export const MAX_FAVOURITES_PER_VENUE = 64;

/** The shape handed around inside React: a set of ids per venue. */
export type FavouritesByVenue = Readonly<Record<VenueMapId, readonly string[]>>;

/** No favourites, which is what a visitor with no saved value gets. */
export const EMPTY_FAVOURITES: FavouritesByVenue = { "de-schorre": [], dreamville: [] };

/**
 * `window.localStorage`, or null when it cannot be reached at all.
 *
 * The property access itself can throw when storage is disabled for the origin,
 * which is why it is inside the `try` rather than after it.
 */
function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const candidate = window.localStorage;
    if (candidate === null || typeof candidate !== "object") return null;
    if (typeof candidate.getItem !== "function" || typeof candidate.setItem !== "function") {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

/**
 * Keeps only the ids that exist on the named map, de-duplicated, in stored order.
 *
 * This is the validation that makes a hostile or stale value harmless: a stored id
 * that no longer appears in `geo-data.ts` is silently dropped, and the tool then
 * shows a list of real places rather than an empty panel it cannot explain.
 */
function validIds(map: GeoMap, candidates: readonly unknown[]): readonly string[] {
  const known = new Set(map.nodes.map((node) => node.id));
  const seen = new Set<string>();
  const out: string[] = [];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    if (!known.has(candidate)) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
    if (out.length >= MAX_FAVOURITES_PER_VENUE) break;
  }

  return out;
}

/** Reads one venue's ids out of an unknown parsed value, without throwing. */
function idsFor(parsed: unknown, map: GeoMap): readonly string[] {
  if (parsed === null || typeof parsed !== "object") return [];
  const record = parsed as Record<string, unknown>;
  const entry = record[map.id];
  if (!Array.isArray(entry)) return [];
  return validIds(map, entry);
}

/**
 * Reads the stored favourites for both venues.
 *
 * A value that cannot be parsed clears the key, because it will never become
 * readable and leaving it in place would fail on every subsequent render. A value
 * that parses but holds unusable ids is kept: the visitor's other venue may still
 * be fine, and dropping only the bad ids is the least destructive repair.
 */
export function readFavourites(maps: Readonly<Record<VenueMapId, GeoMap>>): FavouritesByVenue {
  const store = storage();
  if (store === null) return EMPTY_FAVOURITES;

  let raw: string | null;
  try {
    raw = store.getItem(FAVOURITES_STORAGE_KEY);
  } catch {
    return EMPTY_FAVOURITES;
  }
  if (raw === null || raw.trim() === "") return EMPTY_FAVOURITES;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      store.removeItem(FAVOURITES_STORAGE_KEY);
    } catch {
      // A storage that refuses to remove is a storage that refuses everything; the
      // next read returns the same corrupt value and the tool still works.
    }
    return EMPTY_FAVOURITES;
  }

  return {
    "de-schorre": idsFor(parsed, maps["de-schorre"]),
    dreamville: idsFor(parsed, maps.dreamville),
  };
}

/**
 * Writes both venues' favourites, or says it could not.
 *
 * The return value is what the UI uses to warn honestly: a browser that refuses
 * the write (private mode, a full quota) gets a visible note rather than a star
 * that appears to save and loses the value on reload.
 */
export function writeFavourites(favourites: FavouritesByVenue): boolean {
  const store = storage();
  if (store === null) return false;

  const payload = {
    "de-schorre": [...favourites["de-schorre"]],
    dreamville: [...favourites.dreamville],
  };

  try {
    store.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Adds or removes one id for one venue, returning the new map.
 *
 * Pure, so the component can compute the next value before deciding whether the
 * write succeeded, and a test can call it directly.
 */
export function toggleFavourite(
  favourites: FavouritesByVenue,
  venueId: VenueMapId,
  nodeId: string,
): FavouritesByVenue {
  const current = favourites[venueId];
  const next = current.includes(nodeId)
    ? current.filter((id) => id !== nodeId)
    : current.length >= MAX_FAVOURITES_PER_VENUE
      ? current
      : [...current, nodeId];

  return { ...favourites, [venueId]: next };
}
