import { z } from "zod";
import { httpsUrlSchema, verifiedBase } from "./common";

/**
 * An external reference worth linking: an official help page, a transport
 * timetable, a map. `category` groups resources on the links page, and
 * `description` says why a reader would follow the link, so the page is more
 * than a bare list of URLs.
 */
export const resourceCategorySchema = z.enum(
  ["official", "transport", "accommodation", "practical", "community", "other"],
  {
    error:
      'category must be "official", "transport", "accommodation", "practical", "community" or "other"',
  },
);
export type ResourceCategory = z.infer<typeof resourceCategorySchema>;

export const resourceSchema = verifiedBase
  .extend({
    title: z
      .string({ error: "title is required" })
      .trim()
      .min(1, { error: "title is required" })
      .max(120, { error: "title must be 120 characters or fewer" }),
    url: httpsUrlSchema,
    category: resourceCategorySchema,
    description: z
      .string({ error: "description is required" })
      .trim()
      .min(1, { error: "description is required" })
      .max(400, { error: "description must be 400 characters or fewer" }),
  })
  .strict();

export type Resource = z.infer<typeof resourceSchema>;
