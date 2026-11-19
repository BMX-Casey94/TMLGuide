// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EDITION_META,
  GUIDE_EDITIONS,
  PENDING_CHAPTER_PARAM,
  allChapterParams,
  buildRegistry,
  chapterKey,
  chapterParamsForBuild,
  chapterPath,
  editionChapters,
  getChapter,
  guideRegistry,
  latestCheckedOn,
  neighbours,
  relatedChapters,
  type GuideChapter,
  type GuideEdition,
} from "./index";
import { guideChapterSchema } from "./schema";

/**
 * Fixtures live here, inside the test file, so nothing production can ever import
 * a fake chapter. They are parsed through the real schema first, which is what
 * makes them usable as stand-ins for real content.
 */

function chapter(overrides: Partial<GuideChapter> & Pick<GuideChapter, "edition" | "slug" | "order">): GuideChapter {
  const base = {
    title: `Chapter ${overrides.slug}`,
    summary:
      "A fixture summary that is long enough for the schema, written for the registry tests only.",
    lastVerified: "2026-11-18",
    related: [],
    sources: [
      {
        id: "s1",
        title: "Fixture source page",
        url: "https://example.com/fixture",
        checkedOn: "2026-11-18",
      },
    ],
    blocks: [
      { type: "h2" as const, id: "first-topic", text: "First topic" },
      { type: "p" as const, text: "Fixture paragraph text with a citation.", sources: ["s1"] },
      { type: "p" as const, text: "A second fixture paragraph.", sources: ["s1"] },
    ],
  };
  return guideChapterSchema.parse({ ...base, ...overrides });
}

function editionList(
  edition: GuideEdition,
  ...chapters: GuideChapter[]
): readonly GuideChapter[] {
  return chapters;
}

describe("registry parsing", () => {
  it("parses every chapter through the schema and sorts each edition by order", () => {
    const registry = buildRegistry({
      belgium: editionList(
        "belgium",
        chapter({ edition: "belgium", slug: "third", order: 30 }),
        chapter({ edition: "belgium", slug: "first", order: 10 }),
        chapter({ edition: "belgium", slug: "second", order: 20 }),
      ),
      winter: [],
      brasil: [],
      general: [],
    });

    expect(editionChapters("belgium", registry).map((entry) => entry.slug)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("rejects a chapter that does not match the schema, naming the index", () => {
    expect(() =>
      buildRegistry({
        // The summary is too short for the schema, so the parse must fail.
        belgium: [{ edition: "belgium", slug: "bad", order: 1, title: "Bad", summary: "Too short" }],
        winter: [],
        brasil: [],
        general: [],
      }),
    ).toThrow(/belgiumChapters\[0\]/);
  });

  it("rejects a chapter filed under the wrong edition", () => {
    expect(() =>
      buildRegistry({
        belgium: [chapter({ edition: "belgium", slug: "misplaced", order: 1 })],
        winter: [chapter({ edition: "belgium", slug: "wrong-array", order: 1 })],
        brasil: [],
        general: [],
      }),
    ).toThrow(/declares edition "belgium" but is listed under "winter"/);
  });

  it("rejects a duplicated slug inside one edition", () => {
    expect(() =>
      buildRegistry({
        belgium: [
          chapter({ edition: "belgium", slug: "same", order: 1 }),
          chapter({
            edition: "belgium",
            slug: "same",
            order: 2,
            blocks: [
              { type: "h2", id: "another-topic", text: "Another topic" },
              { type: "p", text: "Fixture paragraph.", sources: ["s1"] },
              { type: "p", text: "Second fixture paragraph.", sources: ["s1"] },
            ],
          }),
        ],
        winter: [],
        brasil: [],
        general: [],
      }),
    ).toThrow(/duplicate slug/);
  });

  it("rejects two chapters claiming the same order in one edition", () => {
    expect(() =>
      buildRegistry({
        winter: [
          chapter({ edition: "winter", slug: "alpha", order: 4 }),
          chapter({
            edition: "winter",
            slug: "beta",
            order: 4,
            blocks: [
              { type: "h2", id: "beta-topic", text: "Beta topic" },
              { type: "p", text: "Fixture paragraph.", sources: ["s1"] },
              { type: "p", text: "Second fixture paragraph.", sources: ["s1"] },
            ],
          }),
        ],
        belgium: [],
        brasil: [],
        general: [],
      }),
    ).toThrow(/order 4 is also used by "alpha"/);
  });

  it("allows the same order number in different editions", () => {
    const registry = buildRegistry({
      belgium: [chapter({ edition: "belgium", slug: "overview", order: 1 })],
      winter: [chapter({ edition: "winter", slug: "overview", order: 1 })],
      brasil: [],
      general: [],
    });

    expect(editionChapters("belgium", registry)).toHaveLength(1);
    expect(editionChapters("winter", registry)).toHaveLength(1);
  });

  it("accepts an edition with no chapters yet", () => {
    const registry = buildRegistry({ belgium: [], winter: [], brasil: [], general: [] });
    for (const edition of GUIDE_EDITIONS) {
      expect(editionChapters(edition, registry)).toEqual([]);
    }
  });
});

describe("selectors", () => {
  const registry = buildRegistry({
    belgium: [
      chapter({ edition: "belgium", slug: "overview", order: 1, related: ["belgium/dreamville"] }),
      chapter({
        edition: "belgium",
        slug: "dreamville",
        order: 2,
        blocks: [
          { type: "h2", id: "dreamville-topic", text: "DreamVille topic" },
          { type: "p", text: "Fixture paragraph.", sources: ["s1"] },
          { type: "p", text: "Second fixture paragraph.", sources: ["s1"] },
        ],
      }),
    ],
    winter: [],
    brasil: [],
    general: [],
  });

  it("finds a chapter by edition and slug", () => {
    expect(getChapter("belgium", "overview", registry)?.slug).toBe("overview");
  });

  it("returns null for an unknown chapter and for a chapter in another edition", () => {
    expect(getChapter("belgium", "nope", registry)).toBeNull();
    expect(getChapter("winter", "overview", registry)).toBeNull();
  });

  it("returns the previous and next chapter within the edition", () => {
    const overview = getChapter("belgium", "overview", registry);
    const dreamville = getChapter("belgium", "dreamville", registry);
    if (overview === null || dreamville === null) throw new Error("fixture missing");

    expect(neighbours(overview, registry)).toEqual({ previous: null, next: dreamville });
    expect(neighbours(dreamville, registry)).toEqual({ previous: overview, next: null });
  });

  it("gives a lone chapter no neighbours at all", () => {
    const single = buildRegistry({
      belgium: [chapter({ edition: "belgium", slug: "overview", order: 1 })],
      winter: [],
      brasil: [],
      general: [],
    });
    const only = getChapter("belgium", "overview", single);
    if (only === null) throw new Error("fixture missing");

    expect(neighbours(only, single)).toEqual({ previous: null, next: null });
  });

  it("resolves related chapters across editions", () => {
    const crossEdition = buildRegistry({
      belgium: [
        chapter({ edition: "belgium", slug: "overview", order: 1, related: ["general/pearls"] }),
      ],
      winter: [],
      brasil: [],
      general: [chapter({ edition: "general", slug: "pearls", order: 1 })],
    });
    const overview = getChapter("belgium", "overview", crossEdition);
    if (overview === null) throw new Error("fixture missing");

    const related = relatedChapters(overview, {}, crossEdition);
    expect(related.map((entry) => `${entry.edition}/${entry.slug}`)).toEqual(["general/pearls"]);
  });

  it("drops an unknown related reference at runtime but throws in strict mode", () => {
    const withBrokenRef = buildRegistry({
      belgium: [
        chapter({
          edition: "belgium",
          slug: "overview",
          order: 1,
          related: ["general/does-not-exist"],
        }),
      ],
      winter: [],
      brasil: [],
      general: [],
    });
    const overview = getChapter("belgium", "overview", withBrokenRef);
    if (overview === null) throw new Error("fixture missing");

    expect(relatedChapters(overview, {}, withBrokenRef)).toEqual([]);
    expect(() => relatedChapters(overview, { strict: true }, withBrokenRef)).toThrow(
      /lists unknown chapter "general\/does-not-exist"/,
    );
  });

  it("does not repeat a related chapter listed twice", () => {
    const duplicated = buildRegistry({
      belgium: [
        chapter({ edition: "belgium", slug: "overview", order: 1, related: ["general/pearls", "general/pearls"] }),
      ],
      winter: [],
      brasil: [],
      general: [chapter({ edition: "general", slug: "pearls", order: 1 })],
    });
    const overview = getChapter("belgium", "overview", duplicated);
    if (overview === null) throw new Error("fixture missing");

    expect(relatedChapters(overview, {}, duplicated)).toHaveLength(1);
  });

  it("lists every chapter as route params", () => {
    const params = allChapterParams(registry);
    expect(params).toEqual([
      { edition: "belgium", chapter: "overview" },
      { edition: "belgium", chapter: "dreamville" },
    ]);
  });

  it("builds the public path of a chapter", () => {
    expect(chapterPath({ edition: "winter", slug: "transport" })).toBe("/guides/winter/transport");
    expect(chapterKey("brasil", "tickets")).toBe("brasil/tickets");
  });

  it("reads the latest check date across a set of chapters", () => {
    const older = chapter({ edition: "belgium", slug: "older", order: 1, lastVerified: "2026-10-01" });
    const newer = chapter({
      edition: "belgium",
      slug: "newer",
      order: 2,
      lastVerified: "2026-11-18",
      blocks: [
        { type: "h2", id: "newer-topic", text: "Newer topic" },
        { type: "p", text: "Fixture paragraph.", sources: ["s1"] },
        { type: "p", text: "Second fixture paragraph.", sources: ["s1"] },
      ],
    });

    expect(latestCheckedOn([older, newer])).toBe("2026-11-18");
    expect(latestCheckedOn([])).toBeNull();
  });
});

describe("build-time params", () => {
  it("falls back to one placeholder pair when no chapter exists, because Cache Components refuses an empty list", () => {
    const empty = buildRegistry({ belgium: [], winter: [], brasil: [], general: [] });
    expect(chapterParamsForBuild(empty)).toEqual([PENDING_CHAPTER_PARAM]);
  });

  it("returns only real chapters once any exist", () => {
    const registry = buildRegistry({
      belgium: [chapter({ edition: "belgium", slug: "overview", order: 1 })],
      winter: [],
      brasil: [],
      general: [],
    });
    expect(chapterParamsForBuild(registry)).toEqual([{ edition: "belgium", chapter: "overview" }]);
  });

  it("uses a placeholder that resolves to no chapter, so it renders a 404 rather than a page", () => {
    expect(getChapter(PENDING_CHAPTER_PARAM.edition, PENDING_CHAPTER_PARAM.chapter)).toBeNull();
  });
});

describe("edition metadata", () => {
  it("gives every edition a title and a summary that needs no citation", () => {
    for (const edition of GUIDE_EDITIONS) {
      const meta = EDITION_META[edition];
      expect(meta.edition).toBe(edition);
      expect(meta.title.length).toBeGreaterThan(2);
      expect(meta.summary.length).toBeGreaterThanOrEqual(40);
      // A date or a price in the summary would be a claim this text cannot source.
      expect(meta.summary).not.toMatch(/€|R\$|\d{4}/);
    }
  });

  it("uses the agreed titles", () => {
    expect(EDITION_META.belgium.title).toBe("Tomorrowland Belgium");
    expect(EDITION_META.winter.title).toBe("Tomorrowland Winter");
    expect(EDITION_META.brasil.title).toBe("Tomorrowland Brasil");
    expect(EDITION_META.general.title).toBe("Good to know");
  });
});

describe("the live registry", () => {
  it("parses whatever the content directories currently hold, without throwing", () => {
    expect(guideRegistry.byEdition).toBeDefined();
    for (const edition of GUIDE_EDITIONS) {
      expect(Array.isArray(editionChapters(edition))).toBe(true);
    }
  });

  it("has every live related reference pointing at a live chapter", () => {
    for (const edition of GUIDE_EDITIONS) {
      for (const entry of editionChapters(edition)) {
        expect(() => relatedChapters(entry, { strict: true })).not.toThrow();
      }
    }
  });

  it("keeps the live chapters in ascending order within each edition", () => {
    for (const edition of GUIDE_EDITIONS) {
      const orders = editionChapters(edition).map((entry) => entry.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });
});
