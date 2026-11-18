/**
 * The four questions the home page highlights.
 *
 * They are chosen because each one changes what a reader does before they
 * travel, and each is answered by an entry that already exists in the verified
 * FAQ data. Nothing is written here: the question, answer, source link and check
 * date come from the record, so the page cannot drift away from the guide it
 * summarises.
 *
 * Two entries come from the shared FAQ set, which covers rules that apply at
 * every edition, and two from the Belgium set, because ticket caps and the
 * 2027 pre-registration window are edition-specific. Where an id exists in both
 * sets, the shared entry wins: it is the festival-wide rule rather than one
 * edition's restatement of it.
 */
import { belgiumData } from "@/data/belgium";
import { sharedData } from "@/data/shared";
import type { Faq } from "@/data/schemas";

/**
 * The highlighted entries, in reading order: the rule that decides your day,
 * the only safe way to buy second-hand, the cap on how many you may buy, and
 * the step that gates every sale.
 */
export const HIGHLIGHTED_FAQ_IDS = [
  "re-entry",
  "resale-exchange-desk",
  "how-many-tickets-per-account",
  "pre-registration",
] as const;

export type HighlightedFaqId = (typeof HIGHLIGHTED_FAQ_IDS)[number];

/**
 * Picks the highlighted entries out of the FAQ collections.
 *
 * A missing id is skipped rather than filled with substitute copy, so the
 * section shrinks honestly if a record is ever retired. The order of
 * {@link HIGHLIGHTED_FAQ_IDS} is preserved, so it reads as a sequence rather
 * than in whatever order the data files happen to use.
 *
 * @param collections - Faq lists to search. Later lists win on a duplicate id,
 *   so pass the most specific first.
 * @throws Error when two entries in the same list share a highlighted id, which
 *   would make the answer depend on array order.
 */
export function pickHighlightedFaqs(
  collections: readonly (readonly Faq[])[],
  ids: readonly string[] = HIGHLIGHTED_FAQ_IDS,
): readonly Faq[] {
  // Build the lookup in reverse so the first list given has the final say.
  const byId = new Map<string, Faq>();
  for (const collection of [...collections].reverse()) {
    const seen = new Set<string>();
    for (const faq of collection) {
      if (!ids.includes(faq.id)) continue;
      if (seen.has(faq.id)) {
        throw new Error(`pickHighlightedFaqs: two entries share the id "${faq.id}"`);
      }
      seen.add(faq.id);
      byId.set(faq.id, faq);
    }
  }

  const picked: Faq[] = [];
  const taken = new Set<string>();
  for (const id of ids) {
    // A repeated request must not render the same answer twice under one anchor.
    if (taken.has(id)) continue;
    const entry = byId.get(id);
    if (entry === undefined) continue;
    taken.add(id);
    picked.push(entry);
  }
  return picked;
}

/**
 * The highlighted entries, read from the validated data.
 *
 * The shared set is searched first so a festival-wide rule is the one shown, and
 * the Belgium set fills in the two edition-specific entries.
 */
export function highlightedFaqs(): readonly Faq[] {
  return pickHighlightedFaqs([sharedData.faqs, belgiumData.faqs]);
}

/**
 * A stable, unique anchor for one entry. It is used for the `id` of the
 * `<details>` element and for the `name` that lets the accordion close its
 * siblings, so only one answer is open at a time.
 */
export function faqAnchor(prefix: string, id: string): string {
  return `${prefix}-${id}`;
}
