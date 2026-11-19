// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GUIDE_EDITIONS, editionChapters, getChapter, allChapterParams, relatedChapters } from "@/content";
import { resolveChapterPage } from "@/app/guides/[edition]/[chapter]/page";
import { chapterParamsForBuild, PENDING_CHAPTER_PARAM } from "@/content";
import { parseChapterParam } from "@/components/guides/routes";

/**
 * Registry-wide invariants, checked against whatever the content workstream has
 * landed so far. These are the rules a chapter author cannot see from inside one
 * file: cross-edition `related` targets, unique orders, valid data-block references.
 *
 * Nothing here asserts how many chapters exist, so a new chapter cannot break the
 * suite; a broken chapter will.
 */
describe("the live content set", () => {
  it("has at least one chapter in some edition", () => {
    const total = GUIDE_EDITIONS.reduce((sum, edition) => sum + editionChapters(edition).length, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("resolves every related reference across the whole registry", () => {
    for (const edition of GUIDE_EDITIONS) {
      for (const chapter of editionChapters(edition)) {
        // Strict mode throws on a dangling reference, which is the assertion.
        expect(() => relatedChapters(chapter, { strict: true })).not.toThrow();
      }
    }
  });

  it("never lists a chapter as related to itself", () => {
    for (const edition of GUIDE_EDITIONS) {
      for (const chapter of editionChapters(edition)) {
        expect(chapter.related).not.toContain(`${edition}/${chapter.slug}`);
      }
    }
  });

  it("resolves every real chapter route and refuses every placeholder", () => {
    for (const param of allChapterParams()) {
      expect(resolveChapterPage(param.edition, param.chapter)?.slug).toBe(param.chapter);
    }
    expect(resolveChapterPage(PENDING_CHAPTER_PARAM.edition, PENDING_CHAPTER_PARAM.chapter)).toBeNull();
  });

  it("keeps the build params to real chapters whenever any exist", () => {
    const params = chapterParamsForBuild();
    if (allChapterParams().length > 0) {
      expect(params).toEqual(allChapterParams());
      expect(params).not.toContainEqual(PENDING_CHAPTER_PARAM);
    }
  });

  it("gives every chapter a slug its own route parser accepts", () => {
    for (const edition of GUIDE_EDITIONS) {
      for (const chapter of editionChapters(edition)) {
        expect(parseChapterParam(chapter.slug)).toBe(chapter.slug);
      }
    }
  });

  it("gives every chapter a summary short enough for a meta description", () => {
    for (const edition of GUIDE_EDITIONS) {
      for (const chapter of editionChapters(edition)) {
        expect(chapter.summary.length).toBeLessThanOrEqual(200);
        expect(chapter.summary.length).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it("gives every chapter at least one heading and one source", () => {
    for (const edition of GUIDE_EDITIONS) {
      for (const chapter of editionChapters(edition)) {
        expect(chapter.sources.length).toBeGreaterThan(0);
        expect(chapter.blocks.some((block) => block.type === "h2")).toBe(true);
      }
    }
  });

  it("finds a chapter by edition and slug for every live chapter", () => {
    for (const edition of GUIDE_EDITIONS) {
      for (const chapter of editionChapters(edition)) {
        expect(getChapter(edition, chapter.slug)?.title).toBe(chapter.title);
      }
    }
  });
});
