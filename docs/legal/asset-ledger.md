# Asset licence ledger

This is the licence record for every static file the site serves, and for every
third-party resource it loads at runtime. It exists so that the answer to "may we
ship this, and what must we say about it?" is written down and checkable, rather
than remembered.

It covers TMLGuide (independent fan guide). It records no personal details: the
project is the only party named as a source or a rights holder, and correspondence
about a licence is kept outside this repository.

Verify it with:

```sh
node scripts/check-asset-ledger.mjs
```

The check walks `public/` and fails, with exit code 1, when a file is served that
this ledger does not describe, when a row no longer matches the files on disk, or
when one of the licence statements below has been deleted. Add the row before you
commit the file.

## How the inventory is written

Each row in the file inventory names a **path pattern**, a **file count**, and the
licence position for the files it covers. A pattern is matched against the path
from the repository root, with forward slashes, case-sensitively — the deployment
target is case-sensitive even where a developer's filesystem is not.

The pattern dialect is deliberately small, and the checker rejects anything else
rather than guessing:

| Syntax | Meaning |
| --- | --- |
| `*` | Any run of characters inside one path segment, including none. |
| `**` | Any run of characters across path segments. |
| `**/` | Zero or more whole path segments. |
| `?` | Exactly one character inside a path segment. |

Character classes (`[a-z]`), brace lists (`{png,webp}`), extglobs (`!(x)`) and
backslash escapes are not supported and are treated as an error, because a pattern
that quietly means something different here than in a shell would pass an audit it
should have failed.

The count is part of the record on purpose. A row that says "three files" is a
statement about a specific set of exports; if a fourth variant appears, the count
mismatches and the check stops, rather than letting the new file inherit a licence
decision nobody made for it.

Write the narrowest pattern that covers what you mean. A row for
`public/brand/logo-*.webp` documents the logo exports; a row for `public/**` would
document everything, including files added next year by someone else, and would pass
an audit it should have failed. The check cannot tell the difference, which is why
this is a rule rather than a test.

## File inventory

Everything in this table is a file under `public/`, served from the site origin.
`public/maplibre-gl/` is excluded because it is generated at install and build time;
it is recorded separately below.

| Path pattern | Files | Asset | Source | Licence | Attribution |
| --- | --- | --- | --- | --- | --- |
| `public/brand/logo-*.webp` | 3 | TMLGuide wordmark (320, 640 and 960 px wide; 320×93, 640×186, 960×279; WebP with alpha) | Original artwork created for TMLGuide (independent fan guide). Master PNG at `design/concepts/Elegant Gold Butterfly Ribbon Logo.png`; trimmed of transparent margins and exported as WebP by `scripts/process-brand-assets.mjs` (sharp, quality 90, alpha quality 95). | Owned by the project. Not a Tomorrowland mark and not derived from one. | None required. The site describes the artwork as original on `/about`. |
| `public/brand/butterfly-mark-*.webp` | 3 | TMLGuide butterfly mark, standing alone (160, 320 and 640 px wide; 160×137, 320×275, 640×549; WebP with alpha) | Original artwork created for TMLGuide. Master PNG at `design/concepts/Golden Butterfly Short Trail.png`; trimmed and exported by `scripts/process-brand-assets.mjs`. This is the source of the Apple touch icon declared in `src/app/layout.tsx` at 160 px. | Owned by the project. An original butterfly drawing, not a reproduction of any Tomorrowland logo or crest. | None required. |
| `public/brand/butterfly-trail-*.webp` | 3 | Butterfly with a glowing flight trail, for parallax sections (640, 1280 and 1774 px wide; 640×282, 1280×563, 1638×721; WebP with alpha) | Original artwork created for TMLGuide. Master PNG at `design/concepts/Golden Butterfly with Glowing Flight Trail.png`, which was flattened onto a baked-in checkerboard rather than carrying real transparency; `scripts/process-brand-assets.mjs` keys the checkerboard out by flood fill from the border across low-saturation light pixels and feathers the edge, then trims and exports at quality 88 (alpha quality 92). The 1774 px request yields 1638 px because the export never enlarges. | Owned by the project. | None required. |
| `public/icons/3d/*.webp` | 33 | 3D icon set: `bag`, `camera`, `chart`, `computer`, `credit-card`, `file-text`, `fire`, `flag`, `flash`, `gift`, `headphone`, `key`, `link`, `lock`, `locker`, `magic-trick`, `map-pin`, `medal`, `money-bag`, `music`, `notebook`, `puzzle`, `rocket`, `setting`, `shield`, `star`, `target`, `thumb-up`, `tick`, `tools`, `trophy`, `video-cam`, `wallet` (500×500 WebP with alpha, 10 to 23 KB each) | [3dicons](https://3dicons.co), an open-source 3D icon library. A curated subset. Twenty of the thirty-three are byte-identical to the working copies in `design/concepts/assets/icons` (which holds those twenty); the other thirteen have no counterpart there, so their exact download variant cannot be traced from this repository alone — see the note below. Served through `src/components/ui/icon-3d.tsx`, whose test fails if the list and the directory disagree. | CC0 1.0 Universal (public domain dedication), as stated on 3dicons.co for the current version of the library. No attribution is required by the licence. | None required. `/about` credits the library anyway, as a courtesy. |
| `public/icons/icon.svg` | 1 | App and favicon icon, 512×512 SVG: gold butterfly on a rounded warm-black tile | Original TMLGuide SVG, authored for this repository. Declared as the browser icon in `src/app/layout.tsx` and as the `any` purpose icon in `src/app/manifest.ts`. | Owned by the project. Contains no third-party artwork, font or embedded bitmap. | None required. |
| `public/icons/icon-maskable.svg` | 1 | Maskable app icon, 512×512 SVG: full-bleed warm-black ground with the butterfly inside the maskable safe zone | Original TMLGuide SVG, authored for this repository as the maskable companion to `icon.svg`. Declared in `src/app/manifest.ts` with `purpose: "maskable"`. | Owned by the project. | None required. |
| `public/sw.js` | 1 | Service worker: versioned caches, precache of the core guide routes, network-first HTML, stale-while-revalidate for static assets | First-party file written for this repository. Contains no vendored or copied code, and no third-party library. Registered by `src/components/pwa/sw-register.tsx` at scope `/`. | Owned by the project. | None required. |
| `public/file.svg` | 1 | Document glyph, 16×16 outline SVG | Next.js `create-next-app` scaffold, carried into the project foundation commit of 18 November 2026. Ships as part of the Next.js repository's app template. | MIT, inherited from the Next.js template it was copied from. | None required. |
| `public/globe.svg` | 1 | Globe glyph, 16×16 outline SVG | Next.js `create-next-app` scaffold, carried into the project foundation commit of 18 November 2026. | MIT, inherited from the Next.js template it was copied from. | None required. |
| `public/next.svg` | 1 | Next.js logotype, SVG | Next.js `create-next-app` scaffold, carried into the project foundation commit of 18 November 2026. | MIT, inherited from the Next.js template it was copied from. The Next.js name and logo remain Vercel trademarks; the file is not used to imply endorsement. | None required. |
| `public/vercel.svg` | 1 | Vercel triangle mark, SVG | Next.js `create-next-app` scaffold, carried into the project foundation commit of 18 November 2026. | MIT, inherited from the Next.js template it was copied from. The Vercel name and logo remain Vercel trademarks. | None required. |
| `public/window.svg` | 1 | Browser-window glyph, 16×16 outline SVG | Next.js `create-next-app` scaffold, carried into the project foundation commit of 18 November 2026. | MIT, inherited from the Next.js template it was copied from. | None required. |

The five scaffold files (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`,
`window.svg`) are part of the create-next-app template and no page, component,
manifest or stylesheet refers to them. They are listed because they are served, not
because they are wanted: deleting them is the strongest position, since a file that
is never served cannot be misused, but that is a change to `public/` and is left to
the owner rather than made silently here. Until then they are documented as above.

### The one open point in the inventory: 3dicons variants

The 3D icons are the only assets whose source cannot be fully proved from inside
this repository. Twenty of the thirty-three files are byte-identical to working
copies kept in `design/concepts/assets/icons`, so they came from that curated set.
The remaining thirteen — `camera`, `chart`, `computer`, `credit-card`, `file-text`,
`key`, `link`, `lock`, `notebook`, `setting`, `thumb-up`, `tools` and `video-cam` —
are present only in `public/icons/3d` and were not exported alongside their
neighbours.

This matters because 3dicons publishes two things under different terms: the open
library, which is CC0 1.0 as recorded above, and a separate premium pack sold on its
own commercial terms. Every one of the thirteen is a plain 500×500 WebP of a subject
the open library includes, which is consistent with the open set, and nothing about
them suggests otherwise. But "consistent with" is not proof, and a licence record
that guesses is worse than one that says what is missing.

Before launch, confirm from the download records that all thirteen came from the CC0
library. If any did not, either replace it with a CC0 equivalent or add the premium
pack's terms to this row. If they are confirmed, delete this subsection and state the
confirmation in the verification record below. The check does not test for this
sentence, because it is a fact about the world that only a person can settle.

## Generated files, recorded but not inventoried

| Path | Files | Asset | Source | Licence | Attribution |
| --- | --- | --- | --- | --- | --- |
| `public/maplibre-gl/` | 2 | `maplibre-gl-worker.mjs`, the tile worker for MapLibre GL JS 6.19.0, and `worker-version.json`, the stamp that records which version was copied | Copied verbatim from `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` by `scripts/copy-maplibre-worker.mjs`, which runs on `postinstall`, `predev` and `prebuild`. The directory is gitignored, so it never enters the repository; it is regenerated from the installed dependency on every machine and every build. | BSD-3-Clause, the licence of MapLibre GL JS. Copyright (c) 2023, MapLibre contributors. Redistribution in source and binary forms is permitted provided the copyright notice, the conditions and the disclaimer travel with it; the full text is in `node_modules/maplibre-gl/LICENSE.txt`. | Retain the MapLibre copyright notice and licence text alongside any distribution of the built site. The map itself carries visible OpenStreetMap attribution, described below. |

## Typefaces

The three families are loaded through `next/font/google` in `src/app/layout.tsx`,
which downloads and self-hosts the files at build time. The built pages therefore
request no font from Google at runtime: the `.woff2` files are served from the site
origin under `/_next/static/`, and the Content Security Policy needs no Google
origin. Because the files are build output rather than files under `public/`, the
inventory above cannot list them, so they are recorded here.

| Family | Used for | Axis and style loaded | Licence |
| --- | --- | --- | --- |
| [Fraunces](https://fonts.google.com/specimen/Fraunces) | Display headings (`--font-display`, exposed as `--font-fraunces`) | Variable, `SOFT`, `WONK` and `opsz` axes, normal and italic, Latin subset | SIL Open Font License 1.1 |
| [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) | Body text (`--font-sans`, exposed as `--font-instrument`) | Variable, normal, Latin subset | SIL Open Font License 1.1 |
| [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) | Labels and figures (`--font-mono`, exposed as `--font-jetbrains`) | Variable, normal, Latin subset | SIL Open Font License 1.1 |

The SIL Open Font License 1.1 permits embedding and web serving, including in
commercial work, provided the fonts are not sold on their own and any modified
version is not distributed under the reserved font name. None of the three is
modified here: `next/font` subsets and re-encodes the files as delivered, which the
licence allows.

The licence text itself is not inherited automatically. `next/font` emits only the
`.woff2` files (they land in `/_next/static/media/`), and the build output contains
no licence file — checked against the local `.next` directory, which has the font
files and no text file beside them. The OFL text lives in `node_modules` with each
package's metadata, and a build that ships the re-encoded files without that text is
narrowly out of step with the licence's requirement that the copyright notice and
licence accompany the font software. The remedy is a third-party notices page or file
served with the site, listing the three families with their copyright lines and the
OFL text, plus the MapLibre notice below. That is a change to `src/` and is recorded
here as an outstanding launch action rather than made silently. No attribution is
required in the page's editorial content, so nothing about this affects the design.

## Map tiles, map data and the map renderer

The venue maps on `/tools/maps` are drawn by MapLibre GL JS from vector tiles built
from OpenStreetMap data and served by OpenFreeMap's public instance. Nothing in that
chain is redistributed from this repository: the tiles are fetched at runtime from
one host, `https://tiles.openfreemap.org`, which the Content Security Policy names
explicitly in `connect-src` (`MAP_TILE_ORIGIN` in `src/lib/security/csp.ts`).

| Component | Where it comes from | Licence | Attribution |
| --- | --- | --- | --- |
| OpenStreetMap data | Surveyed and contributed by the OpenStreetMap community | ODbL 1.0 (Open Database License). The database is open, and any derived database published publicly must be offered under the same licence. TMLGuide publishes no derived database: it reads tiles and adds its own zone outlines and walking graph, which are the project's own estimates and are not ODbL data. | `© OpenStreetMap contributors`, linked to <https://www.openstreetmap.org/copyright>. Rendered in the map's attribution line in `src/components/tools/maps/venue-maps-tool.tsx`. |
| OpenFreeMap vector tiles, TileJSON and glyph ranges | [OpenFreeMap](https://openfreemap.org) public instance, which builds OpenMapTiles-schema tiles from OpenStreetMap data | The OpenFreeMap software and styles are MIT licensed; the tile data it serves is OpenStreetMap data under ODbL 1.0. The public instance is free to use, including commercially, with no key and no request limit. | `OpenFreeMap` alongside the OpenStreetMap credit, as OpenFreeMap asks: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap". The page names both, and states that the zone outlines are the guide's own estimates. |
| Map label glyphs | The same OpenFreeMap host serves pre-rendered glyph ranges for the style's one font stack, `Noto Sans Regular` | The glyph data is served by OpenFreeMap as part of the tile service. The Noto Sans family itself is under the SIL Open Font License 1.1. | Covered by the OpenFreeMap credit above; no separate on-page notice is required for label glyphs. |
| MapLibre GL JS 6.19.0 | `maplibre-gl` npm dependency; its CSS is imported by `venue-maps-tool.tsx` and its worker is copied into `public/maplibre-gl/` | BSD-3-Clause. Copyright (c) 2023, MapLibre contributors. | The copyright notice and licence text must travel with the distributed build. The visible map credit above is the OpenStreetMap requirement, not MapLibre's. |

The zone outlines, stage positions and walking graph in `src/lib/maps/geo-data.ts`
are the project's own estimates, drawn by hand from public sources. They are not
copied from a Tomorrowland site plan, and the page says so beneath the map.

## Third-party assets loaded at runtime, not hosted here

These are third-party user-interface elements and media the browser fetches
directly. No file is stored in this repository, so none appears in the inventory,
but each is a licence position that the launch depends on.

| Resource | When it loads | Licence and terms | Attribution |
| --- | --- | --- | --- |
| Cloudflare Turnstile widget (`https://challenges.cloudflare.com`), an interactive bot challenge | Only when the deployment configures a Turnstile site key. Without a key the policy keeps `frame-src 'none'` and this resource is never requested. | Cloudflare's own terms for Turnstile; the widget is loaded from Cloudflare, not redistributed. No open-source licence is claimed for it here. | None required on the page. Turnstile is a functional challenge, not editorial content. |
| One World Radio audio stream (`https://*.streamtheworld.com`) | When a visitor starts the radio player. Fetched by the browser as a media stream, never downloaded into the site. | Played under the rights holder's own streaming terms, as granted by the public international MP3 redirect. Nothing is re-hosted, transcribed, clipped or embedded as a file, and the stream is bypassed by the service worker so no copy is ever cached. | The player names the station and states in `RADIO_CREDIT` that it is an unofficial embed of the public stream (`src/components/radio/stream.ts`). It does not link out; the credit is the notice. |

## What is excluded, and why

- **Official Tomorrowland material.** No Tomorrowland logo, crest, wordmark, official
  typeface, stage rendering, site plan, photograph, aftermovie or audio recording is
  hosted, copied or recoloured anywhere in the repository. The butterfly artwork and
  the app icons are original drawings made for this project.
- **Files under `public/maplibre-gl/`.** Generated at install and build time from a
  dependency, gitignored, and recorded in its own table above.
- **Build output.** `/_next/static/**` is generated by the build from source, and its
  contents are covered by the entries for the source files and fonts rather than by
  an inventory row.
- **Operating-system litter.** `.DS_Store`, `Thumbs.db` and `desktop.ini` are ignored
  by the check because no static host serves them; they must not be committed either.

## Adding an asset

1. Establish the licence from the source itself — the licence file, the download
   page, or written permission — and record the URL or filename you checked.
2. Prefer a source whose licence needs no attribution, and record the attribution
   anyway if the licence asks for one. A credit that costs one line is cheaper than
   an argument later.
3. Record how the file was made: the tool, the settings, the source file, and any
   script that transforms it. For generated artwork, keep the generator script in the
   repository so the result can be reproduced.
4. Add the row to the file inventory with the right count, then run
   `node scripts/check-asset-ledger.mjs`. A pass is required before the file is
   committed.
5. If the asset arrives with a licence text, keep that text in the repository beside
   the file it covers.

## Outstanding launch actions

Three things in this ledger are decisions or fixes for the owner, not facts the
checker can settle. They are listed together so launch can be judged against them.

1. **Confirm the thirteen untraceable 3D icons** came from the CC0 library. See the
   note under the inventory. If they did not, replace them or record the premium
   terms.
2. **Serve a third-party notices page or file** carrying the copyright lines and
   licence text for Fraunces, Instrument Sans and JetBrains Mono (SIL Open Font
   License 1.1) and for MapLibre GL JS (BSD-3-Clause). The built site currently
   ships the font files and the MapLibre bundle with no licence text beside them.
3. **Delete the five create-next-app scaffold SVGs** from `public/` if they are not
   wanted. Removing them removes the trademark question entirely; while they remain,
   the inventory documents them.

## Verification record

| Date | What was checked | Result |
| --- | --- | --- |
| 26 November 2026 | 3dicons licence statement | 3dicons.co states that the current version of the library is released under CC0, usable in personal and commercial projects without attribution. |
| 26 November 2026 | OpenFreeMap attribution and licence terms | openfreemap.org states that attribution is required, that its own software is MIT licensed, and that the map data is OpenStreetMap data. The page's prescribed credit is "OpenFreeMap © OpenMapTiles Data from OpenStreetMap". |
| 26 November 2026 | MapLibre GL JS licence | `node_modules/maplibre-gl/LICENSE.txt` is the BSD-3-Clause text, copyright (c) 2023, MapLibre contributors, for version 6.19.0. |
| 26 November 2026 | Font licences | Fraunces, Instrument Sans and JetBrains Mono are each published under the SIL Open Font License 1.1, and are self-hosted by `next/font` at build time. |
| 26 November 2026 | `public/` inventory | 50 files, all documented, with `public/maplibre-gl/` excluded as generated. |
