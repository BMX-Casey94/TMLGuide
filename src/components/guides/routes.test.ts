// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  isGuideEdition,
  isKnownChapterRoute,
  parseChapterParam,
  parseEditionParam,
  resolveChapterRoute,
} from "./routes";
import { GUIDE_EDITIONS, guideChapterSchema, type GuideChapter } from "@/content/schema";

function fixture(edition: GuideChapter["edition"], slug: string): GuideChapter {
  return guideChapterSchema.parse({
    edition,
    slug,
    order: 1,
    title: `Chapter ${slug}`,
    summary:
      "A fixture summary long enough for the schema, used only by the route tests in this file.",
    lastVerified: "2026-11-18",
    sources: [
      { id: "s1", title: "Fixture page", url: "https://example.com/x", checkedOn: "2026-11-18" },
    ],
    blocks: [
      { type: "h2", id: "topic", text: "Topic" },
      { type: "p", text: "Body text.", sources: ["s1"] },
      { type: "p", text: "More body text.", sources: ["s1"] },
    ],
  });
}

const CHAPTERS: readonly GuideChapter[] = [
  fixture("belgium", "overview"),
  fixture("winter", "transport"),
  fixture("general", "pearls"),
];

describe("edition params", () => {
  it("accepts the four editions", () => {
    for (const edition of GUIDE_EDITIONS) expect(parseEditionParam(edition)).toBe(edition);
  });

  it("rejects anything else, including the static tickets route", () => {
    for (const value of ["tickets", "thailand", "", "Belgium", " belgium", "belgium "]) {
      expect(parseEditionParam(value)).toBeNull();
    }
  });

  it("rejects a non-string", () => {
    expect(parseEditionParam(undefined)).toBeNull();
    expect(parseEditionParam(null)).toBeNull();
    expect(parseEditionParam(["belgium"])).toBeNull();
    expect(parseEditionParam(7)).toBeNull();
  });

  it("narrows the type", () => {
    const value: unknown = "winter";
    expect(isGuideEdition(value)).toBe(true);
    expect(isGuideEdition("nope")).toBe(false);
  });
});

describe("chapter params", () => {
  it("accepts a kebab-case slug", () => {
    expect(parseChapterParam("dates-and-sales")).toBe("dates-and-sales");
    expect(parseChapterParam("tickets")).toBe("tickets");
    expect(parseChapterParam("add-ons-2")).toBe("add-ons-2");
  });

  it("rejects a slug that is not kebab-case", () => {
    for (const value of ["Dates", "dates_and_sales", "-leading", "trailing-", "double--hyphen", "", " a b "]) {
      expect(parseChapterParam(value)).toBeNull();
    }
  });

  it("rejects a slug longer than the schema allows", () => {
    expect(parseChapterParam("a".repeat(81))).toBeNull();
    expect(parseChapterParam("a".repeat(80))).toBe("a".repeat(80));
  });

  it("rejects a non-string and a path traversal attempt", () => {
    expect(parseChapterParam(undefined)).toBeNull();
    expect(parseChapterParam("../schema")).toBeNull();
    expect(parseChapterParam("overview/extra")).toBeNull();
  });
});

describe("chapter route resolution", () => {
  const lookup = (edition: GuideChapter["edition"], slug: string) =>
    CHAPTERS.find((chapter) => chapter.edition === edition && chapter.slug === slug) ?? null;

  it("resolves a real chapter", () => {
    expect(resolveChapterRoute("belgium", "overview", lookup)?.slug).toBe("overview");
  });

  it("refuses an unknown chapter", () => {
    expect(resolveChapterRoute("belgium", "no-such-chapter", lookup)).toBeNull();
  });

  it("refuses a chapter that exists only in another edition", () => {
    expect(resolveChapterRoute("belgium", "transport", lookup)).toBeNull();
    expect(resolveChapterRoute("winter", "transport", lookup)?.slug).toBe("transport");
  });

  it("refuses an unknown edition before looking the chapter up", () => {
    expect(resolveChapterRoute("thailand", "overview", lookup)).toBeNull();
    expect(resolveChapterRoute("tickets", "overview", lookup)).toBeNull();
  });

  it("refuses a malformed slug", () => {
    expect(resolveChapterRoute("belgium", "Overview", lookup)).toBeNull();
    expect(resolveChapterRoute("belgium", ["overview"], lookup)).toBeNull();
  });
});

describe("known route check", () => {
  it("knows a real pair and refuses a wrong edition for the same slug", () => {
    expect(isKnownChapterRoute("general", "pearls", CHAPTERS)).toBe(true);
    expect(isKnownChapterRoute("belgium", "pearls", CHAPTERS)).toBe(false);
  });
});
