/**
 * Routes this page group is allowed to link to.
 *
 * The home page is built before most of the site exists, so every link on it is
 * checked against this list. That turns a typo into a failing test rather than a
 * dead end for a reader.
 *
 * Every entry is a page that exists today. There is deliberately no wildcard for
 * `/tools/*`: an earlier version accepted any path under that prefix, which let
 * links to `/tools/budget-calculator` and `/tools/pearl-calculator` pass this
 * check and 404 in production, because the real pages are `/tools/budget` and
 * `/tools/pearls`. A tool is listed here when it is built, so linking to one that
 * does not exist fails in the suite instead of on a reader's screen.
 */

/** Destinations the pages in this group may use, exactly as written in a link. */
export const KNOWN_ROUTES = [
  "/",
  "/guides",
  "/guides/tickets",
  "/tools",
  "/tools/sale-timeline",
  "/tools/budget",
  "/tools/pearls",
  "/community",
  "/community#partners",
  "/radio",
  "/about",
] as const;

export type KnownRoute = (typeof KNOWN_ROUTES)[number];

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
  return (KNOWN_ROUTES as readonly string[]).includes(path);
}

/** True for a link that leaves the site. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * Origin used for canonical URLs and JSON-LD when `NEXT_PUBLIC_SITE_URL` is not
 * set. The root layout, the sitemap and `robots.txt` all read the same origin
 * through `@/lib/seo/site`, so a link built here and a canonical URL built by
 * Next cannot disagree about which site they describe.
 */
export { SITE_URL_FALLBACK, absoluteUrl } from "@/lib/seo/site";
