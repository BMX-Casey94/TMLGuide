// @vitest-environment node
import { describe, expect, it } from "vitest";

import { guideRegistry, type GuideChapter } from "@/content";
import { chapterPageTitle, humaniseSlug } from "./titles";

/** A minimal chapter: only the three fields the title function reads. */
function chapter(edition: GuideChapter["edition"], slug: string, title: string) {
  return { edition, slug, title } as Pick<GuideChapter, "edition" | "slug" | "title">;
}

describe("humaniseSlug", () => {
  it("capitalises the first word only", () => {
    expect(humaniseSlug("stages-and-hours")).toBe("Stages and hours");
  });

  it("leaves a single word alone apart from its capital", () => {
    expect(humaniseSlug("overview")).toBe("Overview");
  });

  it("returns the input when it holds no words, rather than an empty string", () => {
    expect(humaniseSlug("---")).toBe("---");
  });
});

describe("chapterPageTitle", () => {
  it("appends the edition to a chapter whose title is a section name", () => {
    expect(chapterPageTitle(chapter("belgium", "accommodation", "Accommodation"))).toBe(
      "Accommodation — Belgium",
    );
    expect(chapterPageTitle(chapter("winter", "accommodation", "Accommodation"))).toBe(
      "Accommodation — Winter",
    );
  });

  it("separates two chapters that share a title", () => {
    const belgium = chapterPageTitle(chapter("belgium", "dreamville", "DreamVille"));
    const brasil = chapterPageTitle(chapter("brasil", "dreamville", "DreamVille"));
    expect(belgium).not.toBe(brasil);
  });

  it("names the general edition as the section it is", () => {
    expect(chapterPageTitle(chapter("general", "radio", "One World Radio"))).toBe(
      "One World Radio — Good to know",
    );
  });

  it("uses the slug rather than repeating an edition the title already names", () => {
    // The Belgium overview chapter is titled "Tomorrowland Belgium", the same as
    // its hub; "Tomorrowland Belgium — Belgium" would read as a mistake.
    expect(chapterPageTitle(chapter("belgium", "overview", "Tomorrowland Belgium"))).toBe(
      "Tomorrowland Belgium — Overview",
    );
  });

  it("keeps the slug as the distinguisher for the other overview chapters too", () => {
    expect(chapterPageTitle(chapter("winter", "overview", "Tomorrowland Winter"))).toBe(
      "Tomorrowland Winter — Overview",
    );
    expect(chapterPageTitle(chapter("brasil", "overview", "Tomorrowland Brasil"))).toBe(
      "Tomorrowland Brasil — Overview",
    );
  });

  it("ignores case when deciding whether the title already names the edition", () => {
    expect(chapterPageTitle(chapter("winter", "overview", "tomorrowland winter"))).toBe(
      "tomorrowland winter — Overview",
    );
  });
});

describe("the live registry", () => {
  it("gives every chapter, in every edition, a distinct page title", () => {
    // Six pairs were duplicated before this function existed, because a chapter
    // title is written per page and not per site.
    const titles = new Map<string, string>();
    const duplicates: string[] = [];

    for (const [edition, chapters] of Object.entries(guideRegistry.byEdition)) {
      for (const chapter of chapters) {
        const title = chapterPageTitle(chapter);
        const where = `${edition}/${chapter.slug}`;
        const existing = titles.get(title);
        if (existing !== undefined) duplicates.push(`${title}: ${existing} and ${where}`);
        titles.set(title, where);
      }
    }

    expect(duplicates).toEqual([]);
  });

  it("gives no chapter the same title as its own edition hub", () => {
    for (const [edition, chapters] of Object.entries(guideRegistry.byEdition)) {
      const hubTitle = `${edition.charAt(0).toUpperCase()}${edition.slice(1)}`;
      for (const chapter of chapters) {
        // The hub's title is the edition's own name; a chapter must not repeat it.
        expect(chapterPageTitle(chapter), `${edition}/${chapter.slug}`).not.toBe(hubTitle);
      }
    }
  });

  it("keeps every title to a length a result list can show", () => {
    for (const chapters of Object.values(guideRegistry.byEdition)) {
      for (const chapter of chapters) {
        // 60 characters is roughly where Google truncates; the suffix must not
        // push an ordinary chapter title past it.
        expect(chapterPageTitle(chapter).length, chapter.slug).toBeLessThanOrEqual(75);
      }
    }
  });
});
