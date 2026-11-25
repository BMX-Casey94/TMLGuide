# SEO, sitemap, robots and link-hygiene audit

Hardening pass on TMLGUIDE v3. Everything below was measured against a production
build (`next build` with `NEXT_PUBLIC_SITE_URL=https://tmlguide.example`) on
25 November 2026, not inferred from the source.

## Summary

| Area | Before | After |
| --- | --- | --- |
| `sitemap.xml` | Did not exist | 49 URLs, static, no anchors, no private routes |
| `robots.txt` | Did not exist | `Allow: /`, disallows `/admin`, `/api/`, `/offline`, absolute sitemap |
| Public pages with title, description, canonical | 49 of 49 | 49 of 49, enforced by test |
| Public pages with complete Open Graph and Twitter tags | 36 of 49 | 49 of 49, enforced by test |
| Duplicate `<title>` pairs | 6 | 0, enforced by test |
| Community resource URLs that redirect | 3 | 0 |
| Broken internal links on the home page | 2 | 0 |

## 1. Community resource links

`node scripts/check-community-links.mjs --only=resources` reported 16 ok and 3
redirected. Each chain was followed and its final address re-requested to confirm
a 200 before anything changed.

| Record | Stored URL | Final URL | Hops |
| --- | --- | --- | --- |
| `resource-discord` | `https://discord.gg/tomorrowland` | `https://discord.com/invite/tomorrowland` | 1 |
| `resource-radio` | `https://www.tomorrowland.com/home/one-world-radio/` | `https://www.tomorrowland.com/one-world-radio/` | 2 |
| `resource-official` | `https://www.tomorrowland.com/home/` | `https://www.tomorrowland.com/` | 2 |

All three titles were checked on the final page, so each URL is the page it claims
to be rather than merely a 200 somewhere on the same host: `Tomorrowland`,
`One World Radio, Tomorrowland's dance music radio station`, and `Tomorrowland`.

The three records carry `lastVerified: "2026-11-25"` because that is the day their
final address answered on the first request. Every other resource keeps
`2026-11-18`, the day it was actually opened, so a card never shows a check date
that did not happen. A test asserts exactly this.

Re-running the checker now reports **19 ok, 0 redirected, 0 broken**.

`docs/factcheck/links-input.json` is deliberately unchanged: it records what the
old site published, which is the historical input to the fact check, not what
answers today. The test that ties published URLs back to that file therefore
carries an explicit three-entry allowlist of measured from/to pairs, so a fourth
unmeasured URL still fails.

## 2. Sitemap

`src/app/sitemap.ts` did not exist. It is now prerendered as a static route
(`○ /sitemap.xml` in the build output).

Content is derived from `src/lib/seo/routes.ts`, which the tests and this document
also read, so the published file cannot disagree with what the code lists. Guide
routes come from the content registry rather than a typed list: adding a chapter
adds it to the sitemap, deleting one removes it.

49 URLs: 18 static pages, 4 edition hubs, 27 chapters.

- `/tools/maps`, `/tools/winter-timer`, `/ask` and `/community/news` are all
  present (each also has a dedicated test).
- No hash anchors and no query strings. A fragment is not a separate document,
  and listing one asks a crawler to index the same page twice.
- `/admin`, `/offline`, `/kit` and `/api/*` are absent, each with a test, and
  `EXCLUDED_ROUTES` records the reason for every one so the omission is a
  decision rather than an oversight.

`lastModified` is a date the content was **actually checked** (`2026-11-18`, from
the fact-check run), never `new Date()`. A build timestamp would claim the whole
site changes at every deploy, and Google's response to an unreliable `lastmod` is
to ignore it for the site rather than for the one page. `/community/news` has no
`lastModified` at all, because its date is the newest published item's and only
the database knows it.

## 3. Robots

`src/app/robots.ts` did not exist. It now emits:

```text
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /offline

Sitemap: https://tmlguide.example/sitemap.xml
```

`/api/` keeps the trailing slash so every route handler is covered by one rule.
`/kit` is **not** listed: `robots.txt` is a public file, and naming the internal
UI reference there advertises a path that its own `noindex, nofollow` metadata
already protects.

## 4. Metadata coverage

Measured across all 60 prerendered documents, of which 49 are public pages:

- Every public page has a non-empty `<title>`, a description of 115–208
  characters, `rel="canonical"` matching its own path, and no `robots` directive.
- `/admin`, `/offline` and `/kit` all emit `noindex, nofollow` and appear in no
  sitemap.
- `src/app/metadata-coverage.test.ts` asserts all of the above against each route
  module's real `metadata` export, in both directions: every sitemap route has a
  page, and every public page is in the sitemap.

### Fixed: 12 pages had no social metadata

Next replaces the whole `openGraph` object rather than merging it, so a page that
declares none inherits none. Twelve public pages emitted **zero** Open Graph and
Twitter tags, and a thirteenth (`/guides/tickets`) declared a partial object that
dropped `siteName`, `locale` and the Twitter card.

That matters here more than usual: this guide's audience shares links in WhatsApp
and Discord, where the preview is the first thing a reader sees. All thirteen now
use `src/lib/seo/social.ts`, which emits a complete block in one place.

### Fixed: 6 duplicate page titles

A chapter's `title` is written for its own page, which is right in a breadcrumb
and wrong in a `<title>`. Six pairs competed for one result:

| Title | Pages |
| --- | --- |
| `Accommodation` | Belgium, Winter |
| `DreamVille` | Belgium, Brasil |
| `Getting there` | Brasil, Winter |
| `One World Radio` | `/radio`, `/guides/general/radio` |
| `Tickets and packages` | `/guides/tickets`, `/guides/winter/tickets-and-packages` |
| `Tomorrowland Belgium` | Belgium hub, Belgium overview chapter |

`src/lib/seo/titles.ts` appends the edition to chapter titles, and uses the slug
where the title already names its edition (`Tomorrowland Belgium — Overview`). The
two non-chapter pairs were distinguished by saying what each page is for: the live
stream page is `One World Radio live stream`, and the price explorer is
`Tickets and packages, all editions`. A test now fails on any duplicate.

### Removed: a dead hreflang block that would have been wrong

The root layout declared `alternates.languages` with `en-GB` and `x-default` both
pointed at `/`. Two problems:

1. It never rendered. Every page overrides `alternates` with its own canonical, and
   a scan of all 60 prerendered documents found **zero** `hreflang` tags.
2. Had it rendered, it would have marked every page's English alternate as the home
   page, which is a false statement to a crawler.

It is removed. `<html lang="en-GB">` already declares the document language, which
is what a single-locale site needs. `hreflang` returns with locale routing, when
each page can point at its own translations; `src/lib/i18n/locales.ts` holds the
registry those routes will come from.

## 5. Internal link hygiene

The home page linked to `/tools/budget-calculator` and `/tools/pearl-calculator`.
Neither is a route; the real pages are `/tools/budget` and `/tools/pearls`. Both
links 404'd in production.

The cause was a wildcard in `src/components/home/routes.ts`: `isKnownRoute`
accepted any path beginning `/tools/`, so the link guard passed a path nobody had
built. The wildcard is gone and every tool is listed individually, so linking to a
tool that does not exist now fails the suite. A test on the home page also checks
every `/tools/…` link it renders against the sitemap.

## 6. Canonical origin

`NEXT_PUBLIC_SITE_URL` was read three times in three ways. `src/lib/seo/site.ts`
now resolves it once for the root layout's `metadataBase`, the sitemap, robots and
every JSON-LD URL, and validates it:

- A value carrying a path (`https://tml.guide/guides`) is reduced to its origin. Left
  alone it would have become the base for every relative URL, silently producing
  `https://tml.guide/guides/og.png` for an image on `/about`.
- Credentials are refused, because a canonical tag would publish the password.
- Plain `http` is accepted only on loopback.
- A production misconfiguration is logged once, naming the variable, rather than on
  every read of the module.

## 7. Remaining pre-launch items

### Blocking

1. **`NEXT_PUBLIC_SITE_URL` must be set to the real https origin before deploying.**
   Without it, every canonical, `og:url` and sitemap entry falls back to
   `http://localhost:3000`. The build logs this once; the check is manual because a
   build that refuses to run would also block unrelated verification.

### Recommended before launch

2. **~229 KB of gzipped shared JavaScript on every page.** Nine chunks load on all
   49 public pages. 105 KB raw of that is zod, which reaches every page through the
   accessibility toolbar's preference validation. Validating six small enums does
   not need a schema library; hand-written type guards in `a11y-prefs.ts` would
   remove roughly 30 KB gzipped from every visit. This is a refactor of a
   correctness-sensitive module, so it was left alone in a link-and-metadata pass
   rather than changed under time pressure.

3. **No Open Graph image.** Every card is `summary` with no `images`, which is
   honest and better than a blank `summary_large_image` rectangle, but a single
   1200×630 image on `/brand` would improve how links look in WhatsApp. Add it to
   `socialMetadata` and every page gains it at once.

4. **The Belgian overview chapter has the same title as its hub page.** It is
   `Tomorrowland Belgium`, so the page renders `Tomorrowland Belgium — Overview`.
   That is unique and not wrong, but the chapter is really the edition's
   introduction; renaming its `title` in `src/content/belgium/overview.ts` to
   something like `The Belgium weekend` would read better. Content-owned, so not
   changed here.

5. **`/community/news` has no `lastModified`.** Correct today, because the date
   belongs to the newest item in the database. When the news feed is populated, emit
   the newest item's date from the loader rather than leaving it blank.

### Not defects, recorded so nobody re-opens them

- `_global-error` ships without a description or `noindex`. It is Next's built-in
  500 shell, renders outside the root layout and is served with an error status, so
  it cannot be indexed.
- The dynamic route shells (`guides/[edition]`, `guides/[edition]/[chapter]`) appear
  in `.next/server/app` as templates with no metadata of their own. Every path they
  resolve to is prerendered with full metadata; only the placeholder files are bare.
