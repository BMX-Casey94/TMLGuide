/**
 * The internal routes the search index is allowed to link to.
 *
 * This list is the whole link contract: a typo in an href, or a link to a page
 * that does not exist yet, fails the index integrity test instead of shipping a
 * dead palette result. Routes are plain, locale-free paths (there is no i18n
 * layer in this app), so an href needs no rewriting before it reaches an anchor.
 *
 * `/guides/tickets` carries the edition in a query string, which is the
 * tickets page's own URL contract (`?edition=belgium|winter|brasil`), so the
 * three edition views are listed explicitly rather than matched by a pattern.
 * A pattern would let any string through the whitelist.
 */
export const KNOWN_ROUTES = [
  "/",
  "/guides",
  "/guides/tickets",
  "/guides/tickets?edition=belgium",
  "/guides/tickets?edition=winter",
  "/guides/tickets?edition=brasil",
  "/tools",
  "/tools/budget",
  "/tools/pearls",
  "/tools/sale-timeline",
  "/community",
  "/radio",
  "/about",
] as const;

export type KnownRoute = (typeof KNOWN_ROUTES)[number];

const ROUTE_SET: ReadonlySet<string> = new Set(KNOWN_ROUTES);

/** True when `href` is an internal path the site actually renders. */
export function isKnownRoute(href: string): href is KnownRoute {
  return ROUTE_SET.has(href);
}

/**
 * The tickets route for one edition, omitting the query for Belgium because
 * that is the page's default view and its canonical address.
 */
export function ticketsRoute(edition: "belgium" | "winter" | "brasil"): KnownRoute {
  return edition === "belgium" ? "/guides/tickets" : `/guides/tickets?edition=${edition}`;
}
