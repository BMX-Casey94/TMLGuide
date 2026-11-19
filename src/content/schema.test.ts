// @vitest-environment node
import { describe, expect, it } from "vitest";
import { guideBlockSchema, guideChapterSchema } from "./schema";

/**
 * The `data` block's collection enum.
 *
 * Prices are never typed into a chapter: a block names a collection and the
 * renderer reads the validated records. Adding a collection is therefore a
 * schema change, and this file pins both halves of it: the two catalogue
 * collections parse, and the five original values keep parsing unchanged so
 * existing chapters need no edit.
 */

const SOURCES = [
  { id: "s1", title: "An official page", url: "https://example.com/page", checkedOn: "2026-11-18" },
] as const;

function block(collection: string, extra: Record<string, unknown> = {}) {
  return {
    type: "data" as const,
    edition: "winter" as const,
    collection,
    caption: "A caption for the block",
    ...extra,
  };
}

const COLLECTIONS = [
  "tickets",
  "accommodation",
  "sale-windows",
  "add-ons",
  "faqs",
  "stages",
  "shuttles",
] as const;

describe("data block collections", () => {
  it.each(COLLECTIONS)("parses the %s collection", (collection) => {
    const result = guideBlockSchema.safeParse(block(collection));

    expect(result.success).toBe(true);
  });

  it("still parses the five collections that existed before the two new ones", () => {
    for (const collection of ["tickets", "accommodation", "sale-windows", "add-ons", "faqs"]) {
      const result = guideBlockSchema.safeParse(block(collection));

      expect({ collection, ok: result.success }).toEqual({ collection, ok: true });
    }
  });

  it("parses a stage block with no id prefix, which is how a whole roster is shown", () => {
    const parsed = guideBlockSchema.parse(block("stages"));

    expect(parsed.type).toBe("data");
    if (parsed.type !== "data") throw new Error("unreachable");
    expect(parsed.collection).toBe("stages");
    expect(parsed.idPrefix).toBeUndefined();
  });

  it("parses a shuttle block filtered to one operator's records", () => {
    const parsed = guideBlockSchema.parse(block("shuttles", { idPrefix: "altibus-geneva-" }));

    if (parsed.type !== "data") throw new Error("unreachable");
    expect(parsed.collection).toBe("shuttles");
    expect(parsed.idPrefix).toBe("altibus-geneva-");
  });

  it("refuses a collection that is not in the enum", () => {
    const result = guideBlockSchema.safeParse(block("coaches"));

    expect(result.success).toBe(false);
  });

  it("refuses the general edition, which has no data collections", () => {
    const result = guideBlockSchema.safeParse({ ...block("stages"), edition: "general" });

    expect(result.success).toBe(false);
  });

  it("refuses an unknown key, so a stale field cannot ride along silently", () => {
    const result = guideBlockSchema.safeParse(block("stages", { table: "stages" }));

    expect(result.success).toBe(false);
  });
});

describe("chapters that use the new collections", () => {
  const chapter = {
    edition: "winter" as const,
    slug: "stages-and-hours",
    order: 1,
    title: "Stages and hours",
    summary: "A fixture summary that is long enough for the schema's lower bound on its length.",
    lastVerified: "2026-11-18",
    related: [],
    sources: SOURCES,
    blocks: [
      { type: "h2" as const, id: "the-stages", text: "The stages" },
      block("stages"),
      block("shuttles", { idPrefix: "transaltitude-" }),
      { type: "p" as const, text: "A cited closing paragraph.", sources: ["s1"] },
    ],
  };

  it("parses a chapter that renders stages and shuttles from data", () => {
    const result = guideChapterSchema.safeParse(chapter);

    expect(result.success).toBe(true);
  });

  it("accepts the same two collections for the belgium and brasil editions", () => {
    for (const edition of ["belgium", "brasil"] as const) {
      const result = guideChapterSchema.safeParse({
        ...chapter,
        edition,
        blocks: [
          { type: "h2" as const, id: "the-stages", text: "The stages" },
          { ...block("stages"), edition },
          { ...block("shuttles"), edition },
          { type: "p" as const, text: "A cited closing paragraph.", sources: ["s1"] },
        ],
      });

      expect({ edition, ok: result.success }).toEqual({ edition, ok: true });
    }
  });
});
