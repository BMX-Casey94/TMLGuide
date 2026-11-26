/**
 * Redirects for the addresses the previous site published.
 *
 * ## What the previous sites were
 *
 * Two are in the archive, and both matter:
 *
 * 1. **A single-page Vite app.** One document at `/`, with everything else behind
 *    hash fragments (`/#resources`, `/#news`), plus `/admin`. Its host also served
 *    the document at `/index.html`, and answered its SPA fallback — `/* /index.html
 *    200` — for every unknown path, which is why its soft 404s cannot be recovered
 *    here and should not be.
 * 2. **A Next.js app** that was prepared as its replacement: localised routes for
 *    `es`, `fr`, `de`, `nl` and `pt` (English carried no prefix), flat guide slugs
 *    under `/guides/[slug]`, `/news`, `/sets`, `/tools/countdown`,
 *    `/tools/pearl-converter`, and `/community/whatsapp` with
 *    `/community/partners`.
 *
 * v3 renamed most of that: guides became edition-scoped chapters, the community
 * sections became tabs of one hub, news moved under `/community/news`, and the
 * calculators were renamed.
 *
 * ## Rules this table must keep
 *
 * - **308, always.** These are permanent moves between two shapes of the same
 *   content, and a cached 307 would keep asking the origin for a year.
 * - **No loops.** Every destination is either a live v3 route or another entry in
 *   this table that resolves in one further hop, so a chain is at most two hops and
 *   can never return to its source.
 * - **No shadowing.** Next matches `redirects()` before the filesystem, so a source
 *   that is also a live route would make that route unreachable. A test asserts
 *   that no source is a live route, which means adding a real `/news` or `/sets`
 *   page later fails CI until the corresponding rule is deleted.
 * - **Fragment destinations are deliberate.** `/community#community-whatsapp` is
 *   the WhatsApp tab of the community hub, and the hub reads its tab from the
 *   hash. A server cannot see a fragment, so this is the only way to land a reader
 *   on the section the old URL named.
 *
 * ## Deliberately absent
 *
 * - `/privacy`, `/terms`, `/cookies` and `/contact`. The old app had pages for
 *   these; v3 does not yet, and they are the operator-supplied items listed in
 *   `docs/launch/staged-launch-runbook.md`. Redirecting them to a substitute would
 *   both mislead a reader looking for a policy and shadow the real page on the day
 *   it lands. They 404 until the pages exist.
 * - `/search-preview`, which was a development preview with no public meaning.
 * - The SPA's `/assets/*` and `/lovable-uploads/*`, which were content-addressed
 *   build output. A redirect would not restore an image that no longer exists.
 */

/** One permanent redirect, in the shape `next.config.ts` returns. */
export interface LegacyRedirect {
  /** A request path pattern, rooted, with no trailing slash. */
  readonly source: string;
  /** Where it now lives. May carry a fragment. */
  readonly destination: string;
  /** Always true: these are permanent moves, answered as 308. */
  readonly permanent: true;
}

/**
 * The locale prefixes the previous Next.js build published.
 *
 * `en` is absent on purpose: it was the default locale and its routes carried no
 * prefix, so `/guides/belgium` is already the English address and matches the v3
 * route directly.
 */
export const LEGACY_LOCALES = ["es", "fr", "de", "nl", "pt"] as const;

/** The `(a|b|c)` alternation Next uses in a path pattern. */
const LOCALE_ALTERNATION = `(${LEGACY_LOCALES.join("|")})`;

/**
 * The locale rules, which run before the path rules.
 *
 * Stripping the prefix is the whole job: `/es/guides/belgium` becomes
 * `/guides/belgium`, a live route, in one hop; `/fr/guides/food-drinks` becomes
 * `/guides/food-drinks`, which the table below then sends to its chapter, in two.
 * Termination is structural rather than incidental — every application of these
 * rules removes at least one leading segment — so no input can loop.
 *
 * An unknown tail is not special-cased. `/de/anything` becomes `/anything`, which
 * 404s. That is the correct answer: a 404 is a better signal than a redirect to a
 * page that has nothing to do with what was asked for.
 */
export const LEGACY_LOCALE_REDIRECTS: readonly LegacyRedirect[] = [
  { source: `/:locale${LOCALE_ALTERNATION}`, destination: "/", permanent: true },
  { source: `/:locale${LOCALE_ALTERNATION}/:path*`, destination: "/:path*", permanent: true },
];

/**
 * The path rules, most specific first.
 *
 * Next applies the first match, so an exact rule must precede any pattern rule
 * that would also match it. The groups are ordered tools, guides, news, sets,
 * community, then the hosting artefact.
 */
export const LEGACY_PATH_REDIRECTS: readonly LegacyRedirect[] = [
  /* Tools whose slugs changed in v3. `budget-calculator` and `pearl-calculator`
     were also linked from an early v3 home page, so they have inbound links from
     both eras; `/tools/pearl-converter` is the name the previous Next app used. */
  { source: "/tools/budget-calculator", destination: "/tools/budget", permanent: true },
  { source: "/tools/pearl-calculator", destination: "/tools/pearls", permanent: true },
  { source: "/tools/pearl-converter", destination: "/tools/pearls", permanent: true },
  { source: "/tools/countdown", destination: "/tools/sale-timeline", permanent: true },

  /* The flat guide slugs. Every v3 guide is `/guides/<edition>/<chapter>`, so a
     one-segment slug is not a route. Belgium is the edition each of these
     described: the old app had no Winter or Brasil chapter pages. */
  { source: "/guides/food-drinks", destination: "/guides/belgium/food-drinks", permanent: true },
  { source: "/guides/accommodation", destination: "/guides/belgium/accommodation", permanent: true },
  { source: "/guides/dreamville", destination: "/guides/belgium/dreamville", permanent: true },
  { source: "/guides/transport", destination: "/guides/belgium/transport", permanent: true },
  {
    source: "/guides/global-journey",
    destination: "/guides/belgium/global-journey",
    permanent: true,
  },
  { source: "/guides/add-ons", destination: "/guides/belgium/add-ons", permanent: true },
  { source: "/guides/faq", destination: "/guides/belgium/faq", permanent: true },

  /* `/guides/belgium`, `/guides/winter`, `/guides/brasil`, `/guides/tickets` and
     `/guides` are live v3 routes and are deliberately not listed: a rule for any
     of them would shadow the page it points at. `tickets` is worth naming because
     it looks like a flat slug and is not one. */

  /* News moved under the community hub. There is no per-article route in v3, so
     an old article URL lands on the feed rather than 404ing. */
  { source: "/news", destination: "/community/news", permanent: true },
  { source: "/news/:slug", destination: "/community/news", permanent: true },

  /* The sets page became a chapter of the "Good to know" edition. */
  { source: "/sets", destination: "/guides/general/sets", permanent: true },

  /* The community sections became tabs of one hub, selected by the URL hash. */
  {
    source: "/community/whatsapp",
    destination: "/community#community-whatsapp",
    permanent: true,
  },
  {
    source: "/community/partners",
    destination: "/community#community-partners",
    permanent: true,
  },

  /* The single-page host served its document at `/index.html` as well as `/`. */
  { source: "/index.html", destination: "/", permanent: true },
];

/**
 * The full ordered list, for `next.config.ts`.
 *
 * A function rather than a constant so the config cannot be mutated by a caller
 * that receives the array, and so the order is stated in one place.
 */
export function legacyRedirects(): LegacyRedirect[] {
  return [...LEGACY_LOCALE_REDIRECTS, ...LEGACY_PATH_REDIRECTS];
}
