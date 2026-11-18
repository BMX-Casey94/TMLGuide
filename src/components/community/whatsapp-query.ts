import type { EditionScope } from "@/data/schemas";
import {
  NO_WHATSAPP_FILTERS,
  type EditionFilter,
  type WhatsappFilters,
} from "./whatsapp-filter";

/**
 * URL state for the WhatsApp directory.
 *
 * The filters live in the query string so a filtered view can be linked and
 * shared, and so the browser's back button undoes a filter change. This module
 * is pure: it parses and serialises, and the component decides when to navigate.
 *
 * Query keys are short because they appear in every shared link, but each is
 * validated on the way in. An unknown edition or a region the data does not
 * publish is dropped rather than trusted: a hand-edited URL then shows the full
 * directory instead of an unexplained empty page.
 */

export const WHATSAPP_QUERY_KEYS = {
  q: "q",
  edition: "edition",
  region: "region",
} as const;

const EDITION_VALUES: readonly EditionScope[] = ["belgium", "winter", "brasil", "all"];

/** Longest search text accepted from a URL; longer values are truncated, not rejected. */
export const MAX_QUERY_LENGTH = 80;

export function parseEditionFilter(value: string | null): EditionFilter {
  if (value === null) return "any";
  return EDITION_VALUES.includes(value as EditionScope) ? (value as EditionScope) : "any";
}

/**
 * @param value the raw query value.
 * @param allowedRegions every region present in the published data. A value
 *   outside this list is discarded, because filtering by a region that does not
 *   exist can only ever produce an empty list.
 */
export function parseRegionFilter(
  value: string | null,
  allowedRegions: readonly string[],
): string | null {
  if (value === null || value === "") return null;
  return allowedRegions.includes(value) ? value : null;
}

/**
 * Reads filters from a query string.
 *
 * Takes a `URLSearchParams` rather than a string so the caller can pass either
 * the router's read-only params or a parsed `location.search`.
 */
export function parseWhatsappFilters(
  params: Pick<URLSearchParams, "get">,
  allowedRegions: readonly string[],
): WhatsappFilters {
  const q = params.get(WHATSAPP_QUERY_KEYS.q) ?? "";
  return {
    q: q.slice(0, MAX_QUERY_LENGTH),
    edition: parseEditionFilter(params.get(WHATSAPP_QUERY_KEYS.edition)),
    region: parseRegionFilter(params.get(WHATSAPP_QUERY_KEYS.region), allowedRegions),
  };
}

/**
 * Writes filters to a query string, omitting defaults.
 *
 * The result is sorted by key and free of empty values, so the same filters
 * always produce the same URL and the address bar never grows a trail of blank
 * parameters as the visitor clicks around.
 */
export function serialiseWhatsappFilters(filters: WhatsappFilters): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q !== "") params.set(WHATSAPP_QUERY_KEYS.q, q.slice(0, MAX_QUERY_LENGTH));
  if (filters.edition !== "any") params.set(WHATSAPP_QUERY_KEYS.edition, filters.edition);
  if (filters.region !== null) params.set(WHATSAPP_QUERY_KEYS.region, filters.region);
  params.sort();
  return params.toString();
}

/** The full href for a filter state, including a hash for the directory itself. */
export function whatsappFilterHref(pathname: string, filters: WhatsappFilters): string {
  const query = serialiseWhatsappFilters(filters);
  return query === "" ? pathname : `${pathname}?${query}`;
}

/** True when a parsed filter state is the same one the directory opens with. */
export function isPristine(filters: WhatsappFilters): boolean {
  return (
    filters.q === NO_WHATSAPP_FILTERS.q &&
    filters.edition === NO_WHATSAPP_FILTERS.edition &&
    filters.region === NO_WHATSAPP_FILTERS.region
  );
}
