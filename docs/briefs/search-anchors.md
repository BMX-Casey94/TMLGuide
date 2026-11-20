# Search anchors: the ids each page must expose

The search palette now lands on the record you picked, not the top of the page
that contains it. This document is the contract between `src/lib/search/**` (which
is done) and the pages that are not yet updated. Every id below is currently
produced by `src/lib/search/anchors.ts` and attached to a result's href as
`route#anchor`.

Two things must happen on the target pages for a result to land properly:

1. **Each element gets its `id`.** One id per record, exactly as listed.
2. **`scroll-margin-top`.** The header is sticky, so an element scrolled to the
   top of the viewport sits underneath it. This needs one global rule, given below.

Nothing else is required: the palette scrolls, moves focus and retries on its own.

**Since this doc was first drafted, the palette also compensates for the header
itself** (`scrollClearOfHeader` in `src/components/search/scroll-to-hash.ts`): it
scrolls the target to the top of the viewport and then nudges the page by the
header's height plus 16px. Measured on the production build, a guide section
heading lands at y = 100 with a 69px header. The `:target` rule below is still
worth adding — it is the correct place for the offset, it covers fragments typed
into the address bar and followed from outside the palette, and it costs nothing
when the code above has already placed the element correctly.

---

## 1. The global CSS (one rule set, `src/app/globals.css`)

The header is 60px on a phone and 68px from 900px up (`src/components/shell/site-header.tsx`,
`HEADER_HEIGHT_MOBILE_PX` / `HEADER_HEIGHT_PX`). `globals.css` already sets
`scroll-padding-top: 84px` on `html`, which covers the browser's own fragment
scroll but **not** `element.scrollIntoView()`, which is what the palette calls. The
two need to agree, so a custom property is introduced and both rules read it.

```css
:root {
  /* Sticky header (60px on a phone, 68px from 900px) plus breathing room. The
     header is the taller of the two at every breakpoint that matters here, and
     8px of clearance below it stops a focused heading from touching the bar. */
  --header-h: 76px;
}

html {
  /* Keep the browser's own fragment scroll clear of the sticky header. This
     replaces the hard-coded 84px so the two rules cannot drift apart. */
  scroll-padding-top: var(--header-h);
}

/* Every anchor target, reached from a search result or a hand-typed fragment,
   clears the header. `scroll-margin-top` is what `scrollIntoView` respects; the
   scroll-padding above is not consulted by it. */
:target {
  scroll-margin-top: calc(var(--header-h) + 16px);
}

/* The arrival tint. Outline-free on purpose: a gold wash behind the target for
   just under two seconds says "this is the thing you picked" without drawing a
   second focus ring, and it fades to nothing rather than staying lit. The
   animation is disabled by the two rules below for anyone who asked for less
   motion, and the target is then simply left untinted. */
@keyframes tml-target-arrive {
  from {
    background-color: color-mix(in srgb, var(--ea) 16%, transparent);
  }
  to {
    background-color: transparent;
  }
}

:target {
  animation: tml-target-arrive 1.8s ease-out 1;
}

@media (prefers-reduced-motion: reduce) {
  :target {
    animation: none;
  }
}

html[data-a11y-motion="reduce"] :target {
  animation: none !important;
}
```

Notes for whoever applies this:

- The tint is `background-color` only. Do not add `outline`, `border` or
  `box-shadow` here: the palette focuses the target with `focus()` and
  `preventScroll`, and a ring drawn by this rule would sit next to the accent
  focus ring the site already gives a focused element.
- `--header-h` is deliberately not `--tabbar-h` (that is the mobile bottom bar,
  a different thing at the other end of the screen).
- If `scroll-padding-top` is left at the literal `84px` instead of switching to the
  variable, the two rules can disagree but nothing breaks; the `:target` rule is
  the one the palette depends on.

---

## 2. The ids, route by route

Every id is deterministic from the record id, produced by
`recordAnchor(family, recordId)` in `src/lib/search/anchors.ts`. A page should
**import that function** rather than retyping a string, so a renamed record
cannot silently detach its search result:

```ts
import { recordAnchor, faqAnchor, GUIDE_TOP_ANCHOR } from "@/lib/search/anchors";

// Belgium tickets and DreamVille packages
recordAnchor("ticket", item.id);          // => "ticket-belgium-2027-day-pass"
recordAnchor("stay", item.id);            // => "stay-belgium-2027-easy-tent-2p"
recordAnchor("sale", record.id);          // => "sale-worldwide-ticket-sale"
recordAnchor("whatsapp", group.id);       // => "wa-1"
recordAnchor("resource", resource.id);    // => "resource-travel-partner"
recordAnchor("partner", partner.id);      // => "partner-dca-travel"
faqAnchor("belgium", faq.id);             // => "faq-be-re-entry-after-leaving"
```

`faqAnchor` takes a collection key (`belgium`, `winter`, `brasil`, `shared`)
because two collections answer the same question under the same record id, and one
page cannot carry two elements with one id.

### 2.1 `/community` — 49 ids

| Where | Element to put the id on | Ids |
| --- | --- | --- |
| WhatsApp groups tab (`WhatsappGroupCard`) | the card's `<article>` | `wa-1`, `wa-2`, `wa-3`, `wa-5`, `wa-6`, `wa-7`, `wa-8`, `wa-9`, `wa-10`, `wa-11`, `wa-12`, `wa-13`, `wa-14`, `wa-15`, `wa-16`, `wa-17`, `wa-18`, `wa-19`, `wa-20`, `wa-21`, `wa-22`, `wa-23`, `wa-25`, `wa-26` |
| Resources tab (`ResourceDirectory`) | the card's `<article>` | `resource-travel-partner`, `resource-fraud`, `resource-discord`, `resource-lineup`, `resource-prices`, `resource-maps`, `resource-apps`, `resource-radio`, `resource-official`, `resource-packing`, `resource-whatsapp`, `resource-fb-solo`, `resource-soundcloud`, `resource-fb-sa`, `resource-fb-malta`, `resource-ticketswap`, `resource-tml-spotify`, `resource-hardstyle-classics`, `resource-bracelet-tracking` |
| Partners tab (`PartnerCard`) | the card's `<article>` | `partner-dca-travel`, `partner-rent-a-tent`, `partner-beat-retreat`, `partner-eb-travel`, `partner-tomorrowcrazy`, `partner-buy-me-a-coffee` |

`wa-4` and `wa-24` are absent because those records are not published. Nothing
should be added to fill the gaps.

**Important:** the three panels are tab panels, and only the selected one is
visible. A link to `#partner-dca-travel` must also select the Partners tab, or the
target exists in the DOM but is `hidden` and cannot be scrolled to or focused.
`CommunityHub` already reads the tab from the URL hash (`tabFromHash`), so the
fix is to map an unknown hash to a tab: if the fragment names an element inside a
panel, select that panel. The simplest correct version, inside `CommunityHub`:

```ts
// A fragment naming a record inside a panel selects that panel, so a deep link
// from the search palette opens the right tab before the target is focused.
const deepLinked = panelForAnchor(hash);  // "partners" for #partner-x, etc.
```

with a pure helper (testable, no React) that decides by prefix:

```ts
export function panelForAnchor(hash: string): CommunityTabId | null {
  const id = hash.replace(/^#/, "");
  if (id.startsWith("wa-")) return "whatsapp";
  if (id.startsWith("resource-")) return "resources";
  if (id.startsWith("partner-")) return "partners";
  return null;
}
```

`#whatsapp-groups`, `#resources` and `#partners` keep working exactly as they do
now: `tabFromHash` is tried first, `panelForAnchor` only fills in the record ids.

### 2.2 `/guides/tickets` — Belgium, 24 ids

The explorer renders one card per product (`PackageCard`, `src/components/tickets/package-card.tsx`).
The card already sets `aria-labelledby={`pkg-${item.id}`}` on its title, so the
id is one line away: put it on the `<article>`.

| Kind | Ids |
| --- | --- |
| Tickets (5) | `ticket-belgium-2027-day-pass`, `ticket-belgium-2027-pleasure-day-pass`, `ticket-belgium-2027-comfort-day-pass`, `ticket-belgium-2027-full-madness`, `ticket-belgium-2027-full-madness-comfort` |
| DreamVille packages (19) | `stay-belgium-2027-magnificent-greens`, `stay-belgium-2027-magnificent-greens-tent-1p`, `stay-belgium-2027-magnificent-greens-tent-2p`, `stay-belgium-2027-camp2camp-2p`, `stay-belgium-2027-friendship-garden-10p`, `stay-belgium-2027-spectacular-friendship-garden-10p`, `stay-belgium-2027-easy-tent-2p`, `stay-belgium-2027-easy-tent-4p`, `stay-belgium-2027-relax-room-2p`, `stay-belgium-2027-dreamlodge-2p`, `stay-belgium-2027-spectacular-dreamlodge-2p`, `stay-belgium-2027-kokono-2p`, `stay-belgium-2027-luna-2p`, `stay-belgium-2027-cabana-2p`, `stay-belgium-2027-astera-2p`, `stay-belgium-2027-marivela-2p`, `stay-belgium-2027-ensuite-2p`, `stay-belgium-2027-solara-2p`, `stay-belgium-2027-noctis-2p` |

**Caveat: the explorer is a drill-down.** On `/guides/tickets` with no query, the
page shows the category grid, not the product cards. The product cards render only
in `?category=<id>` view. A link that lands on `#ticket-belgium-2027-day-pass` with
no `category` param therefore has no element to find.

Two options, in order of preference:

1. **Best:** make the anchor link carry the category, so the href is
   `/guides/tickets?category=festival-tickets#ticket-belgium-2027-day-pass`. This
   is the explorer's own deep-link contract (`buildTicketHref`) and needs no page
   change beyond the id itself. It requires the source list to know each item's
   category, which is one field — see "What is blocked" below.
2. **Fallback:** if the page cannot be changed that way, the ids above are still
   correct and harmless (they will simply not be found on the unfiltered view),
   and the palette closes on the page arrival without scrolling. That is the
   behaviour today, so nothing regresses.

Until option 1 lands, `/guides/tickets?edition=winter` and
`/guides/tickets?edition=brasil` have the same problem, and the same fix.

### 2.3 `/guides/tickets?edition=winter` — 1 id

`ticket-seven-day-festival-ticket-2027`.

### 2.4 `/guides/tickets?edition=brasil` — 29 ids

Tickets (16): `ticket-full-madness`, `ticket-full-madness-half-price`,
`ticket-full-madness-social`, `ticket-full-madness-comfort`,
`ticket-full-madness-comfort-half-price`, `ticket-full-madness-comfort-social`,
`ticket-bybit-full-madness`, `ticket-bybit-full-madness-half-price`,
`ticket-bybit-full-madness-social`, `ticket-bybit-full-madness-comfort`,
`ticket-bybit-full-madness-comfort-half-price`, `ticket-bybit-full-madness-comfort-social`,
`ticket-day-pass`, `ticket-day-pass-half-price`, `ticket-day-pass-comfort`,
`ticket-day-pass-no1`.

DreamVille packages (13): `stay-magnificent-greens-1p`, `stay-magnificent-greens-1p-comfort`,
`stay-magnificent-greens-1p-bybit`, `stay-magnificent-greens-1p-bybit-comfort`,
`stay-easy-tent-2p`, `stay-easy-tent-2p-comfort`, `stay-easy-tent-2p-no1`,
`stay-solaris-2p`, `stay-solaris-2p-comfort`, `stay-solaris-2p-no1`,
`stay-grande-4p`, `stay-grande-4p-comfort`, `stay-grande-4p-no1`.

### 2.5 `/tools/sale-timeline` — 9 ids

Put them on each `<li className="timeline__row">` in
`src/components/tools/sale-timeline.tsx`. The rows are already keyed by `sale.id`,
so this is one attribute.

`sale-global-journey-sale`, `sale-worldwide-pre-sale`, `sale-worldwide-ticket-sale`,
`sale-add-on-sale-2027`, `sale-pre-registration-2027`, `sale-bybit-early-bird-2026`,
`sale-global-journey-2026`, `sale-bybit-pre-sale-2026`,
`sale-worldwide-ticket-sale-2026`.

**Caveat:** the timeline is behind edition tabs, and only the selected edition's
rows are rendered. A link to a Winter sale lands on Belgium unless the tab opens
on the right edition. The tabs already take `initialEdition`; the fix is to read
the hash and pick the edition whose records contain that id, or to read the
edition from the fragment's prefix (`sale-add-on-sale-2027` is the only Winter
id). A simpler and equally correct approach: because the page has three
`<h3 className="timeline__title">` rows keyed by record, render the id on the row
and have `SaleTimelineTabs` accept an `initialEdition` derived from a
`?edition=` query the palette passes. Either way the id list above is what the
rows need.

### 2.6 Guide chapters — 27 routes, 1 id each, plus heading ids that already exist

Every chapter page already has:

- `#chapter-title` on the `<h1>` (`ChapterHeader`, `titleId="chapter-title"`).
  This is `GUIDE_TOP_ANCHOR` and every chapter result points at it. **No change
  needed.**
- An id on every `h2` and `h3`, from the chapter content (`ChapterBlocks` renders
  `<h2 id={block.id}>`). Section results point at those ids. **No change needed.**

The only thing these pages need is the `:target { scroll-margin-top: … }` rule
from section 1. The 150 section results across the 27 chapters are listed by
route in the index; they are the chapter's own `h2` ids and cannot drift because
both sides read `src/content`.

Chapter routes (all with `#chapter-title`):

```
/guides/belgium/{overview,dates-and-sales,tickets,accommodation,dreamville,transport,global-journey,add-ons,food-drinks,faq}
/guides/winter/{overview,tickets-and-packages,accommodation,transport,stages-and-hours,clothing-and-lockers,lessons-and-gear,add-ons}
/guides/brasil/{overview,tickets,dreamville,transport}
/guides/general/{pearls,radio,sets,nft,editions}
```

### 2.7 `/guides` — 78 FAQ ids

FAQ answers need a home. Today the guides hub (`src/app/guides/page.tsx`) does not
render any answer; the answers live in three collections (`src/data/belgium/faqs.ts`,
`src/data/winter/faqs.ts`, `src/data/shared/faqs.ts`) and are rendered as tables in
two chapters (`belgium/faq` and, for Winter, `winter/…`) and as four highlights on
the home page.

The FAQ result currently links to `/guides#faq-…`. For that to land, `/guides`
must render every answer. The minimal honest shape, which also improves the page:

```tsx
// A new section on the guides hub, after the edition cards:
// "Every answer, in one place" — the three collections, each answer in a
// <details> with id={faqAnchor(collection, faq.id)}.
```

If the hub is not the right home, the alternative is to point FAQ results at the
chapter that already renders the table (`/guides/belgium/faq#…`), which would need
the data-block table rows to carry ids. That is a larger change than adding the
section, and it splits the answers across chapters by edition, so the hub is the
better target.

Ids, in order: `faq-be-<id>` for the 38 Belgium records, `faq-wi-<id>` for the 25
Winter records, `faq-sh-<id>` for the 15 shared records. Read them from the build
rather than copying this list:

```sh
npx tsx -e "import {buildSearchIndex} from './src/lib/search/build'; \
  console.log(buildSearchIndex().filter(e=>e.kind==='faq').map(e=>e.anchor).join('\n'))"
```

Two ids collide across collections (`official-sales-channels`,
`exchange-desk-fee`) and that is why the collection is in the anchor. A page that
renders only one collection can use `faqAnchor` with that collection's key and the
ids will still match the results scoped to it; a page that renders all three gets
all 78 distinct ids.

---

## 3. What is blocked on page edits

| Item | Blocked on | Effect while blocked |
| --- | --- | --- |
| Ticket and package landing | `/guides/tickets`: ids on `PackageCard`'s article, **and** the category in the href (`?category=…`) | The palette opens the right page and closes, but does not scroll: the card is behind a drill-down. |
| Sale window landing | `/tools/sale-timeline`: ids on each row, and the right edition tab opened | Opens the timeline; may show the wrong edition's tab. |
| WhatsApp and community landing | `/community`: ids on the three card types, and `panelForAnchor` so the right tab opens | Opens the hub; the card may be inside a `hidden` panel. |
| FAQ landing | `/guides`: a section that renders all three FAQ collections with the ids above | Opens the guides hub; no scroll. |
| Chapter and section landing | Nothing. Works today. | — |
| Scroll offset everywhere | Nothing required: `scrollClearOfHeader` handles it. The `:target` rule is still recommended. | — |

The palette itself, `scrollToHash`, `waitForNavigation`, the progress bar and
`src/app/loading.tsx` are complete and tested. None of them needs a page change to
work; they degrade to "open the page, do not scroll" when an id is missing.

The two blocked cases are marked `test.fixme` in `e2e/search-nav.spec.ts`, each
with a comment naming the section of this doc that unblocks it. The rest of that
spec passes on both viewports.
