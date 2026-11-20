import { allChapters, chapterPath, editionLabel } from "@/content";
import type { GuideBlock } from "@/content/schema";
import { GUIDE_TOP_ANCHOR, guideSectionAnchor } from "../anchors";
import type { EditionScope } from "../types";
import { splitHref } from "../routes";
import { plainMarkdown } from "./faqs";
import { joinSnippet } from "./types";
import type { SourceEntry } from "./types";

/**
 * Guide chapters and the headings inside them, read from the validated content
 * registry.
 *
 * The chapter route is dynamic, so its hrefs cannot sit on the static
 * `KNOWN_ROUTES` whitelist. They are derived here from the same registry that
 * generates the pages, so a result can only link to a chapter that is rendered.
 * `general` chapters are not tied to an edition and are scoped `all`.
 *
 * Chapter entries carry no `sourceUrl` or `lastVerified`: a chapter is prose
 * that cites many sources, and each figure inside it is dated on the page.
 *
 * A chapter result lands on the chapter's own top (`#chapter-title`, the `id`
 * the page already puts on its `h1`). A section result lands on the heading
 * itself, whose `id` comes from the chapter content and is already rendered by
 * `ChapterBlocks`.
 */

/** Every chapter path, for the route check. Built once from the registry. */
const chapterPaths: ReadonlySet<string> = new Set(allChapters().map((chapter) => chapterPath(chapter)));

function scopeFor(edition: string): EditionScope {
  return edition === "general" ? "all" : (edition as EditionScope);
}

/** The plain text of the block that follows a heading, capped for a snippet. */
function sectionSnippet(blocks: readonly GuideBlock[], index: number): string {
  for (let cursor = index + 1; cursor < blocks.length; cursor += 1) {
    const block = blocks[cursor];
    if (block === undefined) break;
    if (block.type === "h2") break;
    if (block.type === "p") {
      const text = plainMarkdown(block.text);
      if (text.length > 0) return text;
    }
    if (block.type === "ul" || block.type === "ol") {
      const items = block.items.map(plainMarkdown).filter(Boolean);
      if (items.length > 0) return items.join("; ");
    }
    if (block.type === "callout") {
      const text = plainMarkdown(block.text);
      if (text.length > 0) return text;
    }
  }
  return "";
}

const chapters = allChapters();

/** One entry per chapter, at the chapter top. */
export const guideEntries: SourceEntry[] = chapters.map((chapter) => ({
  slug: `${chapter.edition}-${chapter.slug}`,
  title: chapter.title,
  snippet: chapter.summary,
  edition: scopeFor(chapter.edition),
  href: chapterPath(chapter),
  anchor: GUIDE_TOP_ANCHOR,
  source: `src/content/${chapter.edition}/${chapter.slug}.ts`,
}));

/**
 * One entry per `h2` in every chapter.
 *
 * The title reads as a path — "Belgium: Transport: Arriving by train" — because
 * "Arriving by train" alone does not say which edition or which chapter, and a
 * result has to be identifiable without opening it. The snippet is the first
 * paragraph under the heading, so a reader sees the answer's opening line.
 *
 * This adds 151 entries to a 234-entry index. That is cheap: the index is
 * scanned on every keystroke, and a heading is far more likely to match a
 * specific query ("arriving by train") than the chapter as a whole.
 */
/**
 * "Belgium: Transport: Arriving by train".
 *
 * The edition comes first because a reader comparing three editions needs to
 * know which one a section belongs to before reading its title. A part that
 * another part already contains is dropped rather than repeated: a chapter
 * titled "Tomorrowland Belgium" under "Belgium" would otherwise read
 * "Belgium: Tomorrowland Belgium: …". When two parts contain each other
 * verbatim, the later one is the one kept, so a heading that repeats its
 * chapter title loses the chapter title and not itself.
 *
 * The result is never empty: if every part is redundant, the heading text alone
 * is returned.
 */
function sectionTitle(edition: string, chapterTitle: string, headingText: string): string {
  const parts = [edition, chapterTitle, headingText];
  const folded = parts.map((part) => part.trim().toLowerCase());
  const kept = parts.filter((part, index) => {
    const own = folded[index] ?? "";
    return !folded.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      if (!other.includes(own)) return false;
      // Equal strings: keep the later one. A strict superset: drop this part.
      return other.length > own.length || otherIndex > index;
    });
  });
  return (kept.length > 0 ? kept : [headingText]).join(": ");
}

export const guideSectionEntries: SourceEntry[] = chapters.flatMap((chapter) => {
  const edition = editionLabel(chapter.edition);
  return chapter.blocks.flatMap((block, index) => {
    if (block.type !== "h2") return [];
    const body = sectionSnippet(chapter.blocks, index);
    /* A heading with no prose under it has nothing to quote, and the chapter
       entry already covers it. */
    if (body.length === 0) return [];
    return [
      {
        slug: `${chapter.edition}-${chapter.slug}-${block.id}`,
        title: sectionTitle(edition, chapter.title, block.text),
        snippet: joinSnippet([body, chapter.summary]),
        edition: scopeFor(chapter.edition),
        href: chapterPath(chapter),
        anchor: guideSectionAnchor(block.id),
        source: `src/content/${chapter.edition}/${chapter.slug}.ts`,
      } satisfies SourceEntry,
    ];
  });
});

/**
 * True when `href` is the page of a chapter in the registry, with or without a
 * fragment.
 *
 * The fragment is not checked against the chapter's headings here: the builder
 * validates every anchor against the anchor pattern, and a section id that no
 * longer exists costs the reader a scroll, not their page. Checking it here
 * would also mean reading every chapter's blocks on every index build.
 */
export function isGuideChapterRoute(href: string): boolean {
  const split = splitHref(href);
  return split !== null && chapterPaths.has(split.path);
}
