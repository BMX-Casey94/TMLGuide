import { z } from "zod";
import { isoDateSchema, slugSchema, verifiedBase } from "./common";

/**
 * A dated announcement: a sale date confirmed, a line-up published, a link
 * fixed. `body` and `summary` are Markdown source, so the render layer owns
 * conversion to HTML and the stored values never carry markup that could be
 * injected straight into a page. `slug` is the route segment; keep it stable
 * once published, because changing it breaks inbound links.
 */
export const newsItemSchema = verifiedBase
  .extend({
    title: z
      .string({ error: "title is required" })
      .trim()
      .min(1, { error: "title is required" })
      .max(160, { error: "title must be 160 characters or fewer" }),
    slug: slugSchema,
    publishedOn: isoDateSchema,
    summary: z
      .string({ error: "summary is required" })
      .trim()
      .min(1, { error: "summary is required" })
      .max(300, { error: "summary must be 300 characters or fewer" }),
    body: z
      .string({ error: "body is required" })
      .trim()
      .min(1, { error: "body is required" })
      .max(20_000, { error: "body must be 20000 characters or fewer" }),
    tags: z
      .array(
        z
          .string({ error: "each tag must be text" })
          .trim()
          .min(1, { error: "a tag must not be empty" })
          .max(40, { error: "a tag must be 40 characters or fewer" }),
        { error: "tags must be a list of tags" },
      )
      .max(12, { error: "tags must contain 12 entries or fewer" }),
  })
  .strict();

export type NewsItem = z.infer<typeof newsItemSchema>;
