# Wave 5 content brief (applies to the three content agents)

Repo: C:\Users\user\Desktop\TMLGUIDE v3. ALWAYS `cd "C:\Users\user\Desktop\TMLGUIDE v3"` first and use absolute paths. Do not touch the old project at C:\Users\user\Desktop\TMLGUIDE Website. UK English, euros as EUR amounts in text where unavoidable (but see the data rule), miles not km. No flourishes or marketing prose: write plain, direct, precise sentences. Today is 18 November 2026 (checks dated 2026-11-18).

You write GUIDE CHAPTERS as typed data validated by src/content/schema.ts (read it fully first: block types, source rules, limits). Read docs/briefs/wave4-common.md for the project rules too (no invented facts, accessibility, security, never run destructive commands, no git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>").

SOURCES OF TRUTH, in this order of authority:
1. docs/factcheck/*.md ledgers (belgium.md, winter.md, brasil-general.md, conflicts.md): rows with verdict `confirmed`, `changed` or `outdated` (use the CORRECTED value; the old note is what is outdated) are publishable, each with an official source URL. Verdicts `unverifiable` and `contradicted-by-sources` are NOT facts: do not state them; where the topic matters to readers, say plainly "not confirmed by the official site" or give the corrected value.
2. The validated data in src/data/** (use `type: "data"` blocks to show prices, ticket tiers and sale windows so they are never retyped; do not copy a price into prose).
3. The research notes in research/** are raw source material written earlier and often stale. Use them for structure and explanations, but EVERY factual sentence must be traceable to a ledger row or data record. If you cannot trace it, leave it out. Never carry over 2025/2026 prices as 2027 prices.
Cross-edition rules: the Exchange Desk is the only official resale route; TicketSwap is never official; "OUT = OUT" re-entry (see ledger for edition specifics); Brasil prices are in reais and are never converted; Altibus Geneva winter shuttle did not run in 2025/26, so never present it as a working route.

Each chapter file exports one `GuideChapter` (typed with the schema type, built via `satisfies GuideChapter` or `guideChapterSchema.parse(...)` at module level) and is listed in your edition's `src/content/<edition>/index.ts` (replace the empty array; keep the exported array name). File names: `src/content/<edition>/<chapter-slug>.ts`.
Source objects: `sources` per chapter with ids s1, s2 ... Each source must be an official-source URL that appears in a ledger row (assert this in a test by reading the ledgers with fs). `checkedOn` is "2026-11-18" and `lastVerified` "2026-11-18".
Every p, ul, ol and callout needs `sources` (use `uncitedFactBlocks`), every facts row needs `sources`. Prefer short sections: an h2 per topic, h3 only when needed, at most ~6 paragraphs between headings, lists for rules and steps. Titles are plain nouns ("Getting there"), summaries 40-200 characters. `related` lists `edition/slug` pairs that really exist. Include at least one `callout` where a rule changes the traveller's decision (warning tone for money or deadlines).
Practical usefulness matters: a traveller should know what to do, in what order, by when, and what it costs (via data blocks), and what the official site has not published yet.

TESTS (in your folder): a vitest test (`// @vitest-environment node`) that (1) parses every chapter with guideChapterSchema, (2) asserts no uncited blocks, (3) asserts unique slugs and orders, (4) asserts every source URL appears in the ledgers, (5) asserts `related` targets exist within the combined chapter lists you can import (edition's own plus a static allowlist for other editions: belgium/winter/brasil/general chapter slugs listed in the lists below), (6) asserts no chapter text contains superseded figures that the ledgers mark outdated (build the list from the ledger OLD values you encounter, for example 304, 374, 381, 452 as prices), the strings "Astera" (except Belgium Montagoe where the ledger lists it), "Romania", "TicketSwap is official", and (7) asserts every `data` block references a collection and edition that exist (import the data index and check the idPrefix matches at least one record when given).
Verify: `npm run typecheck`, `npm run lint`, `npx vitest run src/content/<edition>` from the repo root. Do not run next build, do not start servers.
FINAL REPORT: chapters written with their h2 lists, claims you wanted to make but dropped for lack of a verified source (list them: this feeds the next fact-check), and exact command results.

CHAPTER SLUG LISTS (others write the rest; link only to these):
- belgium: overview, dates-and-sales, tickets, accommodation, dreamville, transport, global-journey, add-ons, food-drinks, faq
- winter: overview, tickets-and-packages, accommodation, transport, stages-and-hours, clothing-and-lockers, lessons-and-gear, add-ons
- brasil: overview, tickets, dreamville, transport
- general: pearls, radio, sets, nft, editions
