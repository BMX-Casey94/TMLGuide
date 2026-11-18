/**
 * Routes this page group is allowed to link to.
 *
 * The home and About pages are built before most of the site exists, so every
 * link on them is checked against this list. That turns a typo into a failing
 * test rather than a dead end for a reader, and it keeps the two pages from
 * advertising a destination nobody has agreed to build.
 *
 * `/tools/*` is a family rather than a single page: the planning tools live at
 * their own paths under it.
 */

/** Destinations the pages in this group may use, exactly as written in a link. */
export const KNOWN_ROUTES = [
  "/",
  "/guides",
  "/guides/tickets",
  "/tools",
  "/tools/sale-timeline",
  "/tools/budget-calculator",
  "/tools/pearl-calculator",
  "/community",
  "/community#partners",
  "/radio",
  "/about",
] as const;

export type KnownRoute = (typeof KNOWN_ROUTES)[number];

/** Path prefixes that stand for a family of routes. */
const ROUTE_FAMILIES: readonly string[] = ["/tools/"];

/**
 * Strips a query string and fragment, which never change which page is served.
 * `#top` and `?edition=belgium` both still land on their bare path.
 */
export function routePath(href: string): string {
  const [withoutFragment] = href.split("#");
  const [path] = withoutFragment.split("?");
  return path === "" ? "/" : path;
}

/**
 * True when a same-site link points at a route this group knows about.
 * Absolute http(s) links and any other scheme are not internal routes, so they
 * answer false here and are checked separately by the caller.
 */
export function isKnownRoute(href: string): boolean {
  if (!href.startsWith("/")) return false;
  const path = routePath(href);
  if ((KNOWN_ROUTES as readonly string[]).includes(path)) return true;
  return ROUTE_FAMILIES.some((prefix) => path.startsWith(prefix) && path.length > prefix.length);
}

/** True for a link that leaves the site. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * Origin used for canonical URLs and JSON-LD when `NEXT_PUBLIC_SITE_URL` is not
 * set. The root layout applies the same fallback to `metadataBase`, so a link
 * built here and a canonical URL built by Next always agree.
 */
export const SITE_URL_FALLBACK = "http://localhost:3000";

/** Resolves a site path to an absolute URL for metadata and JSON-LD. */
export function absoluteUrl(path: string): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL_FALLBACK).replace(/\/+$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
