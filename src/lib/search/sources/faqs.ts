import { faqs as belgiumFaqs } from "@/data/belgium";
import { winterFaqs } from "@/data/winter";
import { sharedData } from "@/data/shared";
import type { Faq } from "@/data/schemas";
import type { SourceEntry } from "./types";

/**
 * Frequently asked questions, taken from the three validated FAQ collections.
 *
 * The question is the title and a plain-text rendering of the answer is the
 * snippet: the answers are Markdown source, so emphasis markers, link syntax and
 * list bullets are removed rather than shown to a reader. Nothing is reworded,
 * and the entry links to the guides index, which is where the answers are
 * published in full. The palette therefore never states more than the guide
 * does.
 *
 * Scope comes from the record itself. The shared collection is `edition: "all"`,
 * so those answers still appear when a specific edition is boosted.
 */

/**
 * Markdown to one line of prose: link targets and emphasis markers go, the
 * visible text stays, and the result is a single line.
 */
export function plainMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]{1,3}/g, "")
    .replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** One entry per question, with a prefix keeping ids unique across editions. */
function entriesFor(collection: readonly Faq[], prefix: string): SourceEntry[] {
  return collection.map((faq) => ({
    slug: `${prefix}-${faq.id}`,
    title: faq.question,
    snippet: plainMarkdown(faq.answer),
    edition: faq.edition,
    href: "/guides",
    source: faq.edition === "all" ? "src/data/shared/faqs.ts" : `src/data/${faq.edition}/faqs.ts`,
    sourceUrl: faq.source.url,
    lastVerified: faq.lastVerified,
  }));
}

export const faqEntries: SourceEntry[] = [
  ...entriesFor(belgiumFaqs, "be"),
  ...entriesFor(winterFaqs, "wi"),
  ...entriesFor(sharedData.faqs, "sh"),
];
