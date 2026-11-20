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
 *
 * A known route may carry one fragment: `route#anchor`, where the anchor is the
 * DOM id of the record the result is about (see `anchors.ts`). The fragment does
 * not widen the whitelist — the base route still has to be listed here, or be a
 * real guide chapter — and the anchor is held to a strict kebab-case pattern, so
 * a fragment cannot smuggle in a second `#`, a `?`, a percent-encoded path or
 * anything else that changes what the URL means.
 */
import { isAnchorId } from "./anchors";

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
  "/tools/journey",
  "/tools/packing",
  "/tools/my-trip",
  "/community",
  "/radio",
  "/about",
  "/accessibility",
] as const;

export type KnownRoute = (typeof KNOWN_ROUTES)[number];

const ROUTE_SET: ReadonlySet<string> = new Set(KNOWN_ROUTES);

/** A href taken apart into the route the site serves and the id to scroll to. */
export interface SplitHref {
  /** The path, with its query string when it has one, and no fragment. */
  readonly path: string;
  /** The fragment without its `#`, or null when the href names no anchor. */
  readonly anchor: string | null;
}

/**
 * Split `href` into its path and fragment, or null when it is not a usable
 * internal href at all.
 *
 * This is the parse every caller should use, and it is strict on purpose:
 *
 * - it must start with exactly one `/`, which rules out `//evil.example`, a
 *   protocol-relative URL and every absolute URL;
 * - it must not contain a backslash (browsers treat `\` as `/` in some
 *   positions), whitespace, or a control character;
 * - it may contain at most one `#`, and the fragment after it must match the
 *   anchor pattern, so `#a#b`, `#../x`, `#%2F` and an empty `#` are all refused;
 * - a `?` may only appear before the fragment, so an anchor cannot start a
 *   query string.
 *
 * It says nothing about whether the path is a page the site renders: that is
 * {@link isKnownRoute}'s job, and the two are deliberately separate so the guide
 * chapter check can apply its own rule to the same parse.
 */
export function splitHref(href: string): SplitHref | null {
  if (typeof href !== "string" || href.length === 0 || href.length > 2048) return null;
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  if (/[\\\s\u0000-\u001f\u007f]/.test(href)) return null;

  const hashAt = href.indexOf("#");
  if (hashAt < 0) return { path: href, anchor: null };

  const path = href.slice(0, hashAt);
  const anchor = href.slice(hashAt + 1);
  // Exactly one fragment, and a path before it: `#x` alone is not a route.
  if (anchor.includes("#") || path.length === 0) return null;
  if (!isAnchorId(anchor)) return null;
  return { path, anchor };
}

/** True when `href` is an internal path the site actually renders, with an optional anchor. */
export function isKnownRoute(href: string): boolean {
  const split = splitHref(href);
  return split !== null && ROUTE_SET.has(split.path);
}

/**
 * The tickets route for one edition, omitting the query for Belgium because
 * that is the page's default view and its canonical address.
 */
export function ticketsRoute(edition: "belgium" | "winter" | "brasil"): KnownRoute {
  return edition === "belgium" ? "/guides/tickets" : `/guides/tickets?edition=${edition}`;
}
