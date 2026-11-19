import { allChapters, chapterPath } from "@/content";
import type { EditionScope } from "../types";
import type { SourceEntry } from "./types";

/**
 * Guide chapters, read from the validated content registry.
 *
 * The chapter route is dynamic, so its hrefs cannot sit on the static
 * `KNOWN_ROUTES` whitelist. They are derived here from the same registry that
 * generates the pages, so a result can only link to a chapter that is rendered.
 * `general` chapters are not tied to an edition and are scoped `all`.
 *
 * Chapter entries carry no `sourceUrl` or `lastVerified`: a chapter is prose
 * that cites many sources, and each figure inside it is dated on the page.
 */
export const guideEntries: SourceEntry[] = allChapters().map((chapter) => ({
  slug: `${chapter.edition}-${chapter.slug}`,
  title: chapter.title,
  snippet: chapter.summary,
  edition: (chapter.edition === "general" ? "all" : chapter.edition) satisfies EditionScope,
  href: chapterPath(chapter),
  source: `src/content/${chapter.edition}/${chapter.slug}.ts`,
}));

/** True when `href` is the page of a chapter in the registry. */
export function isGuideChapterRoute(href: string): boolean {
  return guideEntries.some((entry) => entry.href === href);
}
