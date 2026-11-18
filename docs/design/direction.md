# TMLGUIDE v3: locked design direction ("Dusk Programme")

Status: approved by the owner on 18 November 2026. Reference mockup: `design/concepts/concept-d-dusk-programme.html`.
Source of truth for tokens: `src/styles/tokens.css` (to be created). This file records the intent.

## Principles

1. Professional first. Calm, structured and refined, with colour used as a sprinkle, not a flood. The owner's words: "a sprinkle of colour here and there".
2. Clearly not the official Tomorrowland look. No burgundy ground, no official typefaces, crest, artwork, line-icon set or strap line.
3. Premium through detail: hairline rules, tracked mono labels, serif display type, layered dark cards, glowing 3D icons, slow ambient glows.
4. Mobile is a first-class design, not a reduction of desktop.
5. Accessibility and performance limit the visual ambition (WCAG 2.2 AA minimum, performance budgets, reduced motion respected).

## Colour

- Ground `#0C0A09`, surface `#15110F`, surface-2 `#1D1714`, cream text `#F4ECE0`, muted text cream at 68% opacity (passes AAA on both grounds).
- Hairlines: cream at 14% (default) and 26% (emphasis).
- Edition accent (one per edition, set via `data-ed` on the body): Belgium saffron `#FFC83D`, Winter ice `#8EDBFF`, Brasil coral `#FF8A5C`. Dark text (`#14100C`) on all three passes AAA.
- Ambient glows use our own hues: ember `#FF6A3D`, teal `#2BC4B4`, rose `#F0527F`. Use at low opacity. Teal is the "verified" colour. Rose is the "live" colour.
- Sprinkle of colour (approved addition): each edition hub and each guide category may use one secondary hue from the ambient set as a small accent (an icon glow, a tag, a rule, a card edge), never as a large fill. Large colour areas are reserved for the hero ambient glow only.

## Typography

- Display: Fraunces (variable, SOFT 100, WONK 1), weights 300 to 500, italic for emphasis words.
- Text: Instrument Sans 400 to 700.
- Labels, dates, prices, Pearl values: JetBrains Mono, uppercase, tracked 0.14 to 0.24em for labels.
- Self-host all fonts in production (no third-party font requests).

## Components

- Cards: dark layered surface, 1px hairline, 24px radius, 2px accent edge on top, radial glow behind a 3D icon, lift and icon tilt on hover, no lift on touch.
- Sale and timeline rows: circular 3D icon chips, serif title, mono accent date, muted description, hairline divider, calendar action.
- Navigation (desktop): sticky, 68px, tabbed mono labels with accent underline, edition switch as a pill group, search trigger.
- Navigation (mobile): bottom tab bar (safe-area aware), full-width sticky edition switcher, compact search button, no hamburger for primary destinations.
- Radio: One World Radio player. Desktop floating pill, mobile docked mini-player above the tab bar. Never autoplays, loads the stream only after a tap, shows a clear error state.
- Logo treatment: the supplied logo PNG sits in the header and is allowed to overhang the bottom edge of the navigation bar slightly. It also appears in the footer. Overhang must not cover content, must have a transparent-background version, and must work at mobile size.
- Section dividers: thin gold sparkle dividers with a few subtle butterflies, replacing plain hairlines at major section breaks (plain hairlines remain inside cards and lists). Gold is `#E9C46A` to `#FFC83D`. Butterflies are an original illustration (not the official crest), small, low contrast, and decorative only (`aria-hidden`). Sparkle twinkle is slow, disabled under reduced motion, and the divider is a static SVG fallback on low-power devices.
- Parallax: an elegant, subtle butterfly-trail parallax feature using brand assets made from the owner's reference images. Disabled under reduced motion and on low-power devices.

## Imagery and icons

- 3D icons from the 3dicons library (CC0 current version), curated subset copied from PeerMark, optimised WebP or AVIF.
- Premium photography and motion assets per the plan. Every asset logged in `docs/assets/ledger.md`.

## Mobile requirements

- No horizontal overflow at 320 px and above. Minimum tap target 44 px.
- Card groups become swipeable snap carousels with a visible peek of the next card.
- Safe-area insets respected for the tab bar and radio.
- Test on real devices over a slow connection before launch.
