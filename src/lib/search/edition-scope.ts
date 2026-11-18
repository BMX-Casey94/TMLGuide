import { EDITION_IDS, isEditionId, type EditionId } from "./types";

/**
 * Which edition the palette should boost, read from the current address.
 *
 * The tickets page carries its edition in the query string, and that is the only
 * route that names one, so that is the only place the path can decide the
 * answer:
 *
 *   /guides/tickets?edition=winter   → winter
 *   /guides/tickets                  → belgium (the page's default view)
 *
 * Every other route returns null, and the caller falls back to the edition the
 * visitor has selected in the header. An unrecognised value is ignored rather
 * than trusted: the query string is user-editable.
 */
export function editionFromPath(pathname: string, search: string): EditionId | null {
  if (pathname !== "/guides/tickets") return null;

  const value = new URLSearchParams(search).get("edition");
  if (value === null) return "belgium";
  return isEditionId(value) ? value : null;
}

export interface EditionContext {
  /** `window.location.pathname` at the moment the palette opened. */
  pathname: string;
  /** `window.location.search`, including the leading "?". */
  search: string;
  /** The `data-ed` value on `<body>`, set by the shell's edition switcher. */
  bodyEdition?: string | null;
}

/**
 * The edition to boost, preferring the address over the visitor's own choice:
 * someone reading the Winter view of the tickets page wants Winter results even
 * if they once selected Belgium.
 *
 * Returns null when nothing can be established, which simply means no boost.
 * Boosting is an ordering hint, so an unknown value must never hide results.
 */
export function resolveSearchEdition({ pathname, search, bodyEdition }: EditionContext): EditionId | null {
  const fromPath = editionFromPath(pathname, search);
  if (fromPath !== null) return fromPath;
  return isEditionId(bodyEdition) ? bodyEdition : null;
}

/** The edition named by a bare string, or null. Exported for callers that hold one. */
export function parseEdition(value: string | null | undefined): EditionId | null {
  return isEditionId(value) ? value : null;
}

/** Every edition, for a caller that wants to offer a choice. */
export const ALL_EDITIONS: readonly EditionId[] = EDITION_IDS;
