# Wave 4 common brief (read first, applies to every agent)

Repo: C:\Users\user\Desktop\TMLGUIDE v3 (Windows, PowerShell). TMLGUIDE v3 is an independent Tomorrowland fan guide, not affiliated with Tomorrowland or WeAreOne.World B.V. Today is 18 November 2026. Output UK English, euro prices with the EUR symbol, miles not km.

Before writing code:
1. Read AGENTS.md, then the relevant parts of node_modules/next/dist/docs (this is Next.js 16 with cacheComponents and partialPrefetching; do not rely on older Next knowledge).
2. Read docs/design/direction.md, src/app/globals.css (tokens), src/components/ui/** (UI kit: Card, Button, SectionHeading, GoldDivider, Icon3D, CardCarousel, ButterflyTrail, cx), src/components/shell/** (header, nav, edition context), src/app/kit/page.tsx (usage examples).
3. Data you may import (all validated, sourced, last verified 2026-11-18): src/data/belgium, src/data/winter, src/data/brasil, src/data/shared, src/data/community (each has an index.ts), schemas in src/data/schemas. Tools logic is in src/lib/tools (money, pearls, sale-timeline, ics, budget). Read each index.ts and the types before using them.

Design: "Dusk Programme": warm-black ground, hairline rules, tracked mono labels, Fraunces display serif, 3dicons (CC0) WebP icons via Icon3D, layered dark premium cards, a restrained sprinkle of the per-edition accent (var(--ea)). Not the official Tomorrowland look (no burgundy, no official fonts or artwork). Mobile first; test at 390 px and 1280 px; tab bar is 64 px high at the bottom on mobile; a radio edge tab sits on the right edge on both mobile and desktop, so keep 56 px free at the right edge of full-width content on desktop only where it would overlap interactive controls (use normal page padding; do not add special gutters).

HARD RULES
- No mock, demo, placeholder or lorem content. No invented facts, prices, dates or links. Everything shown comes from the data files or user input. If something is missing in the data, show an honest "not published yet" state with the official page link, never a guess.
- Every price or fact shown from data must show its source (link) and last-checked date somewhere visible on the page (a compact "Source: ... Checked 18 Nov 2026" line is fine). Prices that depend on edition year must say which year.
- Brasil prices are in reais (R$) and use their own types; never convert currencies. The Altibus Geneva winter shuttle must show the operator's suspension note beside the price (it is in the record notes).
- The Exchange Desk is the only official resale route; TicketSwap is never described as official.
- Accessibility to WCAG 2.2 AA: semantic landmarks and headings, visible focus (global focus ring exists), 44 px touch targets, labels on all controls, no colour-only meaning, reduced-motion respected, contrast at least 4.5:1 for text.
- Security: no dangerouslySetInnerHTML with data; external links use rel="noopener noreferrer" and target _blank only where useful; validate all user input (zod) before use; no secrets; no network calls to third parties.
- Performance: server components by default; client components only where interaction needs them; no new dependencies unless unavoidable (state it in the report); images through next/image or existing WebP assets only.
- Tests: write vitest + Testing Library tests for every component and pure function you add (behaviour, a11y roles/names, edge cases). Use `// @vitest-environment node` only for non-DOM tests.
- Own ONLY the folders named in your brief. Do not edit src/app/layout.tsx, globals.css, shell, ui kit, data, schemas, configs or package.json. If you need a change there, report it instead.
- Never run destructive commands. Do not run git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>". If a command needs approval or hangs, abandon it and use file tools.
- Verify from the repo root, fix until clean: `npm run typecheck`, `npm run lint`, `npx vitest run <your folders>`. Do not run `next build` (other agents are editing in parallel).
- Final report: files created, what is shown from which data, tests and exact command results, anything you could not do, and proposed changes to files you do not own.
