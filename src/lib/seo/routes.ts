import { GUIDE_EDITIONS, guideRegistry, type GuideChapter, type GuideEdition } from "@/content";

/**
 * Every public route the site publishes, and nothing else.
 *
 * The sitemap, its tests and the audit document all read this list, so "is
 * `/ask` in the sitemap?" is answered by reading one file rather than by
 * grepping for a string. A route reaches the sitemap only by being here.
 *
 * Deliberately absent, with the reason, so their absence is a decision rather
 * than an oversight:
 *
 * - `/admin` — the publishing console, behind auth and `noindex, nofollow`.
 * - `/offline` — the service worker's fallback page. It has no standalone
 *   meaning: a crawler that indexed it would send a reader to a page telling
 *   them their connection has dropped.
 * - `/kit` — the internal UI reference, `noindex, nofollow`.
 * - `/api/*` — route handlers, not pages. There is nothing to index.
 *
 * No entry carries a fragment. A `#section` is not a separate document, and
 * listing one would ask a crawler to index the same page twice.
 */

/** How often a page's content is expected to change. Advisory to crawlers. */
export type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface SitemapRoute {
  /** Rooted path with no trailing slash, except the home page itself. */
  readonly path: string;
  /**
   * The date the page's content was last checked, in `YYYY-MM-DD` form.
   *
   * Omitted when there is no honest date to give. A `lastModified` of "today"
   * on every request tells a crawler the whole site changes daily, which is
   * false; Google's response to an unreliable `lastmod` is to ignore it for the
   * site rather than for the one page.
   */
  readonly lastModified?: string;
  readonly changeFrequency: ChangeFrequency;
  readonly priority: number;
}

/**
 * The date the shared data layer was checked (`docs/factcheck/links.md`).
 *
 * Pages that render those facts are as current as the data behind them, so they
 * carry this date rather than a build timestamp. When the data is re-checked,
 * this constant moves with it.
 */
export const DATA_CHECKED_ON = "2026-11-18";

/**
 * The static routes, in the order a crawler should meet them.
 *
 * `/guides/tickets` is listed alongside the edition hubs: it is its own page,
 * not an edition, and it wins over `/guides/[edition]` by router precedence.
 */
const STATIC_ROUTES: readonly SitemapRoute[] = [
  { path: "/", lastModified: DATA_CHECKED_ON, changeFrequency: "weekly", priority: 1 },
  { path: "/guides", changeFrequency: "weekly", priority: 0.9 },
  {
    path: "/guides/tickets",
    lastModified: DATA_CHECKED_ON,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  { path: "/tools", changeFrequency: "monthly", priority: 0.8 },
  {
    path: "/tools/sale-timeline",
    lastModified: DATA_CHECKED_ON,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    path: "/tools/budget",
    lastModified: DATA_CHECKED_ON,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/tools/pearls",
    lastModified: DATA_CHECKED_ON,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/tools/journey",
    lastModified: DATA_CHECKED_ON,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/tools/packing",
    lastModified: DATA_CHECKED_ON,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  { path: "/tools/my-trip", changeFrequency: "monthly", priority: 0.5 },
  {
    path: "/tools/maps",
    lastModified: DATA_CHECKED_ON,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/tools/winter-timer",
    lastModified: DATA_CHECKED_ON,
    changeFrequency: "monthly",
    priority: 0.7,
  },
  { path: "/ask", changeFrequency: "monthly", priority: 0.6 },
  {
    path: "/community",
    lastModified: DATA_CHECKED_ON,
    changeFrequency: "weekly",
    priority: 0.7,
  },
  /* No `lastModified`: the date of this page is the newest item's, which only
     the database knows. "Daily" is still honest about how often it changes. */
  { path: "/community/news", changeFrequency: "daily", priority: 0.6 },
  { path: "/radio", changeFrequency: "monthly", priority: 0.6 },
  { path: "/about", changeFrequency: "yearly", priority: 0.4 },
  { path: "/accessibility", changeFrequency: "yearly", priority: 0.3 },
];

/** Routes that exist but must never appear in the sitemap, with the reason. */
export const EXCLUDED_ROUTES: Readonly<Record<string, string>> = {
  "/admin": "Publishing console: authenticated, noindex and nofollow.",
  "/offline": "Service-worker fallback shown when the connection drops.",
  "/kit": "Internal UI reference: noindex and nofollow.",
  "/api": "Route handlers, not pages.",
};

/** The most recent `lastVerified` across a set of chapters, or undefined when empty. */
function newestVerified(chapters: readonly GuideChapter[]): string | undefined {
  let newest: string | undefined;
  for (const chapter of chapters) {
    if (newest === undefined || chapter.lastVerified > newest) newest = chapter.lastVerified;
  }
  return newest;
}

/** Chapters by edition: the only part of the registry the sitemap reads. */
export type ChapterIndex = Readonly<Record<GuideEdition, readonly GuideChapter[]>>;

/**
 * Every public route, static and guide, in one list.
 *
 * Guide routes are derived from the content registry rather than typed here, so
 * a chapter that lands in `src/content` is in the sitemap the next time it is
 * generated, and a deleted chapter leaves it. An edition with no chapters yet
 * still gets its hub, which is a real page with a real empty state.
 *
 * @param index - chapters by edition; injectable so a test can run against
 *   fixtures instead of the live content directories.
 */
export function sitemapRoutes(index: ChapterIndex = guideRegistry.byEdition): readonly SitemapRoute[] {
  const chapterRoutes: SitemapRoute[] = [];
  const editionRoutes: SitemapRoute[] = [];

  for (const edition of GUIDE_EDITIONS) {
    const chapters = index[edition] ?? [];
    const lastModified = newestVerified(chapters);

    editionRoutes.push({
      path: `/guides/${edition}`,
      ...(lastModified === undefined ? {} : { lastModified }),
      changeFrequency: "monthly",
      priority: 0.8,
    });

    for (const chapter of chapters) {
      chapterRoutes.push({
        path: `/guides/${edition}/${chapter.slug}`,
        lastModified: chapter.lastVerified,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return [...STATIC_ROUTES, ...editionRoutes, ...chapterRoutes];
}
