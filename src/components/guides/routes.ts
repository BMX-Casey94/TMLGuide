import { GUIDE_EDITIONS, type GuideChapter, type GuideEdition } from "@/content/schema";

/**
 * The route contract for the guide pages.
 *
 *   /guides
 *   /guides/[edition]
 *   /guides/[edition]/[chapter]
 *
 * The two dynamic segments are validated here rather than inline in the pages, so
 * the decisions a reader depends on — which edition strings are real, and when a
 * chapter is missing — are pure functions a test can call without a running
 * server. `/guides/tickets` is a static route that already exists and must keep
 * winning over `/guides/[edition]`; that is a router precedence fact, not
 * something this module can change, so the tickets route is deliberately absent
 * from `GUIDE_EDITIONS`.
 */

/** True for one of the four editions the guide covers. */
export function isGuideEdition(value: unknown): value is GuideEdition {
  return typeof value === "string" && (GUIDE_EDITIONS as readonly string[]).includes(value);
}

/**
 * Normalises a raw `[edition]` segment.
 *
 * Returns null for anything that is not an edition, including a value with
 * surrounding whitespace: `%20belgium` is not an address anyone meant to write.
 */
export function parseEditionParam(value: unknown): GuideEdition | null {
  return isGuideEdition(value) ? value : null;
}

/**
 * Normalises a raw `[chapter]` segment, or null when it cannot be a slug.
 *
 * Chapter slugs are lower-case kebab-case; a segment that is not is answered with
 * a 404 rather than being lower-cased into a chapter it was not asking for.
 */
export function parseChapterParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null;
}

export interface ChapterRoute {
  readonly edition: GuideEdition;
  readonly chapter: string;
}

/**
 * Resolves a route pair to a chapter, or null when either segment is invalid or
 * the chapter does not exist. The page calls `notFound()` on null.
 */
export function resolveChapterRoute(
  editionValue: unknown,
  chapterValue: unknown,
  lookup: (edition: GuideEdition, slug: string) => GuideChapter | null,
): GuideChapter | null {
  const edition = parseEditionParam(editionValue);
  if (edition === null) return null;
  const slug = parseChapterParam(chapterValue);
  if (slug === null) return null;
  return lookup(edition, slug);
}

/** True when an edition and chapter pair addresses a real page. */
export function isKnownChapterRoute(edition: GuideEdition, slug: string, chapters: readonly GuideChapter[]): boolean {
  return chapters.some((chapter) => chapter.edition === edition && chapter.slug === slug);
}
