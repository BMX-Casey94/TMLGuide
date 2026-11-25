/**
 * The internal routes the search index is allowed to link to.
 *
 * This list is the whole link contract: a typo in an href, or a link to a page
 * that does not exist yet, fails the index integrity test instead of shipping a
 * dead palette result. Routes are plain, locale-free paths (there is no i18n
 * layer in this app), so an href needs no rewriting before it reaches an anchor.
 *
 * `/guides/tickets` carries its edition and its category in a query string,
 * which is the tickets page's own URL contract
 * (`?edition=belgium|winter|brasil&category=<category>`), so the views the index
 * links to are listed explicitly rather than matched by a pattern. A pattern
 * would let any string through the whitelist.
 *
 * The category matters as much as the edition: the bare tickets page renders the
 * category grid, and a `PackageCard` — the element that carries `ticket-*` and
 * `stay-*` ids — exists only inside a category view. A result linking to the bare
 * page therefore landed at the top of a page whose target had never been
 * rendered. {@link ticketsRoute} builds these URLs from one table, and the table
 * is typed against this list, so the two cannot drift.
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
  "/guides/tickets?category=festival-tickets",
  "/guides/tickets?category=dreamville",
  "/guides/tickets?category=montagoe",
  "/guides/tickets?edition=winter&category=festival-tickets",
  "/guides/tickets?edition=brasil&category=festival-tickets",
  "/guides/tickets?edition=brasil&category=dreamville",
  "/tools",
  "/tools/budget",
  "/tools/pearls",
  "/tools/sale-timeline",
  "/tools/journey",
  "/tools/packing",
  "/tools/my-trip",
  "/tools/maps",
  "/tools/winter-timer",
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

/** The editions the tickets page covers. */
export type TicketEdition = "belgium" | "winter" | "brasil";

/**
 * The category views the index links to.
 *
 * Not every category of every edition is here: the whitelist holds the views a
 * search result can land on and nothing else, so a combination the site renders
 * but no result needs is deliberately absent.
 */
export type TicketCategory = "festival-tickets" | "dreamville" | "montagoe";

/**
 * The canonical URL of each category view, in the same shape
 * `buildTicketHref` produces: `edition=belgium` is omitted because it is the
 * page's default, and the parameters keep the page's own order (edition, then
 * category).
 *
 * Typed against {@link KnownRoute}, so a route that is not on the whitelist is a
 * compile error here rather than a dead palette result at runtime.
 */
const TICKET_CATEGORY_ROUTES: Readonly<
  Record<TicketEdition, Partial<Record<TicketCategory, KnownRoute>>>
> = {
  belgium: {
    "festival-tickets": "/guides/tickets?category=festival-tickets",
    dreamville: "/guides/tickets?category=dreamville",
    montagoe: "/guides/tickets?category=montagoe",
  },
  winter: {
    "festival-tickets": "/guides/tickets?edition=winter&category=festival-tickets",
  },
  brasil: {
    "festival-tickets": "/guides/tickets?edition=brasil&category=festival-tickets",
    dreamville: "/guides/tickets?edition=brasil&category=dreamville",
  },
};

/**
 * The tickets route for one edition, omitting the query for Belgium because that
 * is the page's default view and its canonical address.
 *
 * With a category, the URL addresses the package list rather than the category
 * grid, which is what a result about a single package needs: the card exists only
 * in that view.
 *
 * @throws Error for a category view the site does not serve — a link that would
 *   render the grid and leave the target missing, so it is failed at build time
 *   instead of shipped.
 */
export function ticketsRoute(edition: TicketEdition, category?: TicketCategory): KnownRoute {
  if (category === undefined) {
    return edition === "belgium" ? "/guides/tickets" : `/guides/tickets?edition=${edition}`;
  }

  const route = TICKET_CATEGORY_ROUTES[edition][category];
  if (route === undefined) {
    throw new Error(`ticketsRoute: ${edition} serves no "${category}" view`);
  }
  return route;
}
