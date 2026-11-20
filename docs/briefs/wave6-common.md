# Wave 6 common brief (tools and layout polish)

Read this first. Every wave 6 agent follows it.

## Ground rules

- Repo: `C:\Users\user\Desktop\TMLGUIDE v3`. Start every shell command with `cd "C:\Users\user\Desktop\TMLGUIDE v3"`. Never touch `C:\Users\user\Desktop\TMLGUIDE Website`.
- Use absolute paths. Do not run `git commit`, `git stash`, `git reset` or anything destructive. The orchestrator reviews and commits.
- Next.js 16.4.6 with `cacheComponents: true`. Read the relevant file in `node_modules/next/dist/docs` before writing Next code. React 19, TypeScript strict, Tailwind v4 (PostCSS), zod, vitest + Testing Library, Playwright + `@axe-core/playwright`.
- UK English, £ for sterling, miles not km. Euro prices stay euros and Brasil prices stay reais (R$): never convert.
- No mock, demo or seed data. Every fact, price, time or rule must come from `src/data/**` or `src/content/**` (validated, with source URLs). If something is not published, say so in the interface. Do not invent.
- Prose style: say things directly. No flourish or metaphor in copy.
- Design: "Dusk Programme". Warm-black ground, hairline rules, tracked mono labels (`.label`), Fraunces serif display, 3dicons via `Icon3D` (`src/components/ui/icon-3d`), per-edition accent `--ea`. Read `docs/design/direction.md`, `src/app/globals.css`, `src/components/ui/ui.css`, `src/components/tools/tools.css` and an existing tool page (`src/app/tools/budget/page.tsx`, `src/components/tools/budget-calculator.tsx`) before designing. Mobile first: 320px, 390px, 900px, 1280px must not scroll sideways.
- Accessibility: WCAG 2.2 AA. Real labels, fieldset/legend for groups, 44px touch targets, visible focus (global `:focus-visible` is set), live regions for results, no colour-only meaning. Scrollable regions need `role="region"`, `aria-label`, `tabIndex={0}`. A link or button's accessible name must contain its visible text (WCAG 2.5.3): add extra context as `sr-only` text after a `{" "}` space, not as `aria-label`.
- Security: any `localStorage` read goes through zod `safeParse` with a safe fallback and never throws (private mode, quota, tampered JSON). No cookies. No network calls. No `dangerouslySetInnerHTML`. Escape/format user text through React only.

## Dev server and verification

- A dev server is already running on `http://localhost:3200`. Use it for looking at pages in the IDE browser (open a new tab with `newTab: true`). Do not start another `next dev` (one per folder).
- Do not run `npm run build` or Playwright repeatedly. Run them once, at the end.
- Quality gate before you report: `npm run typecheck`, `npm run lint`, the vitest files for your area, then once `npx vitest run` (whole suite), and your axe scan with `PORT=3100 npx playwright test e2e/a11y.spec.ts` (add your routes to the route list there only if the brief says you own that file; otherwise write your own spec file `e2e/<area>.spec.ts` scanning your routes with the same tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa`). PowerShell: use single quotes around regex that contain double quotes; do not use `\"`.
- Remove any scratch files you create (`tmp-*`, logs, screenshots) before you finish.

## Divider convention (layout agents)

The site has one section divider: `GoldDivider` (`src/components/ui/gold-divider.tsx`, optional `butterfly="left|right"`). It is the only ornamental break.

1. At most one break between two sibling sections.
2. A `GoldDivider` goes between two top-level sections of a page. Never two in a row, never a divider next to another rule.
3. If something already acts as a break, do not add a divider: a section that starts with its own top border or hairline, a card edge, a full-width band with a different background, or an eyebrow/heading row with a rule. Remove whichever is redundant, keeping the `GoldDivider` where a break is wanted.
4. Hairline `border-t`/`border-b` are for table rows, list items and cards, not for separating page sections.
5. Space around a divider comes from the page rhythm: equal space above and below, using the existing spacing tokens. Do not stack margins from the section and from the divider.

## Spacing convention (layout agents)

- Page content has a horizontal inset of at least 20px at 320px and 24px from 390px, and uses the same `max-w` container as the header.
- Content must never touch the sticky header: first section gets top padding of at least 48px on mobile and 64px on desktop below the header.
- Adjacent cards have a gap of at least 16px (24px on desktop). A card that follows another block has a top margin through the parent's gap, not through ad-hoc margins.
- Text inside a card has padding of at least 20px on mobile and 24px on desktop.
- Decorative art (butterfly etc.) must be allowed to overflow its section where the design wants it, but must never create horizontal page scroll. Clip at the page wrapper (`overflow-x: clip` on the outermost element), not on the section that holds the art.
