import { z } from "zod";

/**
 * Guide content model.
 *
 * Guides are typed data, not free-form MDX, so every chapter can carry its sources and last-checked
 * date, prices are rendered from the verified data files instead of being retyped, and the AI guide
 * and search index can read the same structure later.
 *
 * Inline text uses a small, safe markdown subset: **bold**, *italic*, and [label](href) where href is
 * an internal path starting with "/" or an https URL. Nothing else is interpreted and nothing is
 * rendered as HTML.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case kebab-case");

const httpsUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.username === "" && url.password === "";
    } catch {
      return false;
    }
  }, "Must be an https URL without credentials");

export const GUIDE_EDITIONS = ["belgium", "winter", "brasil", "general"] as const;
export const guideEditionSchema = z.enum(GUIDE_EDITIONS);
export type GuideEdition = z.infer<typeof guideEditionSchema>;

/** Text with the inline markdown subset described above. */
const text = z.string().min(1).max(1200);

export const guideSourceSchema = z
  .object({
    id: z.string().regex(/^s\d{1,2}$/, "Source ids look like s1, s2, ..."),
    title: z.string().min(3).max(160),
    url: httpsUrl,
    /** When the page was last read for this guide. */
    checkedOn: isoDate,
  })
  .strict();
export type GuideSource = z.infer<typeof guideSourceSchema>;

const sourceRefs = z.array(z.string().regex(/^s\d{1,2}$/)).min(1).max(4);

const paragraph = z
  .object({ type: z.literal("p"), text, sources: sourceRefs.optional() })
  .strict();

const heading = z
  .object({ type: z.literal("h2"), id: slug, text: z.string().min(3).max(120) })
  .strict();

const subheading = z
  .object({ type: z.literal("h3"), id: slug, text: z.string().min(3).max(120) })
  .strict();

const list = z
  .object({
    type: z.enum(["ul", "ol"]),
    items: z.array(text).min(1).max(20),
    sources: sourceRefs.optional(),
  })
  .strict();

const callout = z
  .object({
    type: z.literal("callout"),
    tone: z.enum(["note", "warning", "tip"]),
    title: z.string().min(3).max(80),
    text,
    sources: sourceRefs.optional(),
  })
  .strict();

/** A label/value table for short facts (opening hours, caps, windows). */
const facts = z
  .object({
    type: z.literal("facts"),
    caption: z.string().min(3).max(120),
    rows: z
      .array(
        z
          .object({
            label: z.string().min(1).max(80),
            value: text,
            sources: sourceRefs,
          })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict();

/**
 * Prices and packages are never typed into a guide. This block names a verified data collection and
 * the renderer reads it, so a price can only change in the data file.
 */
const dataRef = z
  .object({
    type: z.literal("data"),
    edition: z.enum(["belgium", "winter", "brasil"]),
    /**
     * `stages` and `shuttles` were added after the first five collections; the
     * older values keep their meaning, so an existing chapter parses unchanged.
     */
    collection: z.enum([
      "tickets",
      "accommodation",
      "sale-windows",
      "add-ons",
      "faqs",
      "stages",
      "shuttles",
    ]),
    /** Optional filter by record id prefix, for example "belgium-2027-full-madness". */
    idPrefix: z.string().max(80).optional(),
    caption: z.string().min(3).max(120),
  })
  .strict();

export const guideBlockSchema = z.discriminatedUnion("type", [
  paragraph,
  heading,
  subheading,
  list,
  callout,
  facts,
  dataRef,
]);
export type GuideBlock = z.infer<typeof guideBlockSchema>;

export const guideChapterSchema = z
  .object({
    edition: guideEditionSchema,
    slug,
    /** Position within the edition's chapter list. */
    order: z.number().int().min(1).max(40),
    title: z.string().min(3).max(90),
    /** One or two sentences for cards, search and meta description. */
    summary: z.string().min(40).max(200),
    lastVerified: isoDate,
    /** Chapters that cover related ground, as `edition/slug` pairs. */
    related: z
      .array(z.string().regex(/^(belgium|winter|brasil|general)\/[a-z0-9-]+$/))
      .max(6)
      .default([]),
    sources: z.array(guideSourceSchema).min(1).max(20),
    blocks: z.array(guideBlockSchema).min(3).max(80),
  })
  .strict()
  .superRefine((chapter, ctx) => {
    const ids = new Set(chapter.sources.map((source) => source.id));
    if (ids.size !== chapter.sources.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate source ids", path: ["sources"] });
    }
    const headingIds = new Set<string>();
    chapter.blocks.forEach((block, index) => {
      if ("sources" in block && Array.isArray(block.sources)) {
        for (const ref of block.sources) {
          if (!ids.has(ref)) {
            ctx.addIssue({
              code: "custom",
              message: `Unknown source ${ref}`,
              path: ["blocks", index, "sources"],
            });
          }
        }
      }
      if (block.type === "facts") {
        block.rows.forEach((row, rowIndex) => {
          for (const ref of row.sources) {
            if (!ids.has(ref)) {
              ctx.addIssue({
                code: "custom",
                message: `Unknown source ${ref}`,
                path: ["blocks", index, "rows", rowIndex, "sources"],
              });
            }
          }
        });
      }
      if (block.type === "h2" || block.type === "h3") {
        if (headingIds.has(block.id)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate heading id ${block.id}`,
            path: ["blocks", index, "id"],
          });
        }
        headingIds.add(block.id);
      }
    });
    if (!chapter.blocks.some((block) => block.type === "h2")) {
      ctx.addIssue({ code: "custom", message: "A chapter needs at least one h2", path: ["blocks"] });
    }
  });
export type GuideChapter = z.infer<typeof guideChapterSchema>;

/** Every factual paragraph, list, callout and fact row must cite a source. */
export function uncitedFactBlocks(chapter: GuideChapter): number[] {
  const missing: number[] = [];
  chapter.blocks.forEach((block, index) => {
    if (block.type === "p" || block.type === "ul" || block.type === "ol" || block.type === "callout") {
      if (!block.sources || block.sources.length === 0) missing.push(index);
    }
  });
  return missing;
}

export const guideEditionMetaSchema = z
  .object({
    edition: guideEditionSchema,
    title: z.string().min(3).max(80),
    summary: z.string().min(40).max(220),
  })
  .strict();
export type GuideEditionMeta = z.infer<typeof guideEditionMetaSchema>;
