/**
 * URL contract for the tickets page.
 *
 * The page is a single route whose state lives entirely in the query string, so
 * every view has a real, shareable, crawlable address:
 *
 *   /guides/tickets
 *   /guides/tickets?edition=winter
 *   /guides/tickets?edition=belgium&category=dreamville
 *   /guides/tickets?edition=belgium&category=dreamville&package=magnificent-greens
 *
 * Query parameters were chosen over nested routes for one reason: they keep the
 * whole drill-down server-rendered from a single page. A visitor without
 * JavaScript follows ordinary links and gets the full content; a crawler sees the
 * same. The URL is the only source of truth, so nothing here reads or writes
 * localStorage.
 */

/** The editions the page covers, in the order the tabs show them. */
export const TICKET_EDITIONS = ["belgium", "winter", "brasil"] as const;

export type TicketEditionId = (typeof TICKET_EDITIONS)[number];

/** Belgium is the default because it is the flagship edition. */
export const DEFAULT_TICKET_EDITION: TicketEditionId = "belgium";

/** The query parameters the page understands. */
export const TICKET_PARAMS = {
  edition: "edition",
  category: "category",
  package: "package",
} as const;

export function isTicketEdition(value: unknown): value is TicketEditionId {
  return typeof value === "string" && (TICKET_EDITIONS as readonly string[]).includes(value);
}

/**
 * Reads the edition from a raw search parameter.
 *
 * An absent or unrecognised value falls back to Belgium rather than 404: a
 * mistyped link should still land on a useful page.
 */
export function parseEdition(value: string | string[] | undefined): TicketEditionId {
  const first = Array.isArray(value) ? value[0] : value;
  return isTicketEdition(first) ? first : DEFAULT_TICKET_EDITION;
}

/**
 * Reads a single optional slug parameter.
 *
 * Rejects arrays, the empty string and whitespace, so `?category=` behaves like
 * an absent parameter instead of becoming a lookup for an empty id.
 */
export function parseSlug(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== "string") return undefined;
  const trimmed = first.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export interface TicketView {
  edition: TicketEditionId;
  category?: string;
  package?: string;
}

/** The drill-down state a URL represents. */
export function parseTicketView(searchParams: Record<string, string | string[] | undefined>): TicketView {
  const view: TicketView = { edition: parseEdition(searchParams[TICKET_PARAMS.edition]) };
  const category = parseSlug(searchParams[TICKET_PARAMS.category]);
  const pkg = parseSlug(searchParams[TICKET_PARAMS.package]);
  if (category !== undefined) view.category = category;
  // A package cannot be addressed without its category, so an orphan is dropped.
  if (category !== undefined && pkg !== undefined) view.package = pkg;
  return view;
}

/**
 * Builds a URL for a view, omitting the default edition so the canonical address
 * of the landing page stays bare.
 *
 * Parameters are encoded with `URLSearchParams`, so an id can never break out of
 * the query string.
 */
export function buildTicketHref(view: Partial<TicketView>): string {
  const params = new URLSearchParams();
  const edition = view.edition ?? DEFAULT_TICKET_EDITION;
  if (edition !== DEFAULT_TICKET_EDITION) params.set(TICKET_PARAMS.edition, edition);
  if (view.category !== undefined) params.set(TICKET_PARAMS.category, view.category);
  if (view.category !== undefined && view.package !== undefined) {
    params.set(TICKET_PARAMS.package, view.package);
  }
  const query = params.toString();
  return query.length === 0 ? "/guides/tickets" : `/guides/tickets?${query}`;
}
