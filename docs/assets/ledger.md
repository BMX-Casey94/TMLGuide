# Asset ledger

Every image, icon, font, audio file, motion asset and imported component used on the site is recorded here with its source, licence and how it was made. Add a row before the asset is committed.

| Asset | Path | Source | Licence | Notes |
| --- | --- | --- | --- | --- |
| 3D icon set (33 icons) | `public/icons/3d/*.webp` | 3dicons.co, copied from the owner's PeerMark project (`public/icons`) | CC0 per the 3dicons site (current version). Confirm the exact pack variants used ("premium" and "color" names) against the owner's download records. | Optimised WebP, 10 to 23 KB each. |
| Fraunces, Instrument Sans, JetBrains Mono | self-hosted via `next/font/google` at build | Google Fonts | SIL Open Font Licence | No runtime third-party font requests. |
| Logo (header and footer) | `public/brand/` (pending) | Supplied by the owner | Owner-owned | Owner is adding the PNG to `design/concepts`. Needs a transparent-background version. |
| Brand reference images 2 and 3 | `design/concepts` (pending) | Supplied by the owner | Reference only | Used as direction for original butterfly-trail and divider artwork. Do not reproduce third-party artwork directly. |
| Sale dates and festival figures | `src/data/*` (pending) | Official Belgium sales page, seen 18 Nov 2026 (owner screenshot) | Facts, cited with source and date | Must be re-verified on the official site before launch. |

## Rules

- No official Tomorrowland logos, crest, typefaces, stage photography, aftermovies or artwork.
- Generated or commissioned imagery must record the tool or author, the date, and the prompt or brief.
- Imported component code (for example from 21st.dev) must record the component URL, author and licence before use.
