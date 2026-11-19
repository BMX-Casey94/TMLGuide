# Route contract: guide pages

Written by the guide-pages workstream so the search index can link to individual
chapters. The chapter route is `/guides/[edition]/[chapter]`; this file records the
exact patterns, the validated value sets and the rules a link builder must respect.

Do not rename a file in `src/content/` without updating this file: a chapter's slug
*is* its URL, so a rename is a broken link.

## Routes

| Route | Renders | Params |
| --- | --- | --- |
| `/guides` | The hub: three edition cards plus the "Good to know" group, each listing its chapters | none |
| `/guides/[edition]` | An edition hub: the chapter cards in order | `edition` |
| `/guides/[edition]/[chapter]` | One chapter: header, table of contents, body, sources, prev/next, related | `edition`, `chapter` |
| `/guides/tickets` | The tickets and packages explorer (a **static** route, owned elsewhere) | query only |

`/guides/tickets` wins over `/guides/[edition]` because a static segment takes
precedence over a dynamic one. That is why `tickets` is not, and must never become,
a value of `edition` in `src/content/schema.ts`.

## `edition`

Closed set of four values, from `GUIDE_EDITIONS` in `src/content/schema.ts`:

```
belgium | winter | brasil | general
```

`general` is the "Good to know" group: chapters that are not tied to one edition.
Anything outside the set answers `notFound()` (HTTP 404).

## `chapter`

A chapter slug from `src/content/<edition>/index.ts`, matched against
`/^[a-z0-9]+(?:-[a-z0-9]+)*$/` and at most 80 characters. A slug is unique inside
its edition; the same slug may exist in two editions (`overview` does), and the two
pages are different addresses with different content.

The slugs the content workstream has agreed, per edition (a link to one that has
not landed yet will 404 until it does):

- **belgium**: `overview`, `dates-and-sales`, `tickets`, `accommodation`,
  `dreamville`, `transport`, `global-journey`, `add-ons`, `food-drinks`, `faq`
- **winter**: `overview`, `tickets-and-packages`, `accommodation`, `transport`,
  `stages-and-hours`, `clothing-and-lockers`, `lessons-and-gear`, `add-ons`
- **brasil**: `overview`, `tickets`, `dreamville`, `transport`
- **general**: `pearls`, `radio`, `sets`, `nft`, `editions`

## Link patterns for the search index

Each entry is a pattern, an example and the rule behind it.

| Pattern | Example | Rule |
| --- | --- | --- |
| `/guides` | — | The hub. Safe to link from anywhere. |
| `/guides/${edition}` | `/guides/belgium` | `edition` must be one of the four values above. Do not build this from user input without validating it. |
| `/guides/${edition}/${chapter}` | `/guides/winter/transport` | The chapter page. Both segments come from the registry, never from a query string, a form field or a slugified label. |
| `/guides/${edition}/${chapter}#${headingId}` | `/guides/belgium/tickets#sale-dates` | A section inside a chapter, using the `id` the chapter's own `h2`/`h3` block declares. Heading ids are unique inside a chapter, so a fragment never needs the chapter slug. |
| `/guides/${edition}/${chapter}#sources` | `/guides/winter/overview#sources` | The source list, whose heading carries the fixed id `sources`. |
| `/guides/${edition}/${chapter}#source-${chapter}-${n}` | `/guides/belgium/tickets#source-tickets-1` | One entry in the source list. `n` counts from 1 in the chapter's own `sources` order. |

### Building an href safely

Two pure helpers exist so a caller does not retype the shape:

```ts
import { chapterPath, allChapterParams, getChapter } from "@/content";

chapterPath({ edition: "belgium", slug: "overview" }); // "/guides/belgium/overview"
allChapterParams(); // [{ edition, chapter }, …] for every chapter that exists
getChapter("general", "pearls"); // the chapter, or null
```

An index entry should be built from `allChapterParams()` and then enriched with the
chapter's own title and summary, which is what the page shows. Entries for chapters
that do not exist yet must be skipped rather than guessed: a slug that has not
landed renders a 404, and a search result that 404s is worse than a missing result.

`src/lib/search/routes.ts` keeps its own whitelist of known routes. Adding the
chapter family to it belongs to the search workstream; this file is only the
contract it can implement against.

## Metadata and structured data

- `metadata.alternates.canonical` is the bare chapter path. No trailing slash, no
  query string, no fragment.
- Open Graph is text only: `title`, `description` (the chapter summary) and `url`.
  There is no per-chapter image.
- JSON-LD is `BreadcrumbList` only, with four positions on a chapter page
  (`Home`, `Guides`, the edition, the chapter) and three on an edition hub. No
  `Article` and no `Product`/`Offer` markup: a price on a chapter comes from the
  data files and can move without the page being rebuilt.

## Empty editions

While an edition's `src/content/<edition>/index.ts` array is empty, its hub page
renders an honest notice ("Chapters for this edition are being checked against the
official site and will appear here once verified") and `generateStaticParams` for
the chapter route returns a single placeholder pair that resolves to no chapter. The
placeholder disappears on its own once the first real chapter exists. A link builder
should therefore skip editions with no chapters rather than pointing at a hub that
has nothing in it yet — though the hub itself always answers 200.
