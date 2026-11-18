import { z } from "zod";
import { slugSchema, verifiedBase } from "./common";

/**
 * A question and its answer. `answer` is Markdown source, not HTML: the render
 * layer converts it, so the stored value never carries a script tag. `tags`
 * drive filtering and search; `related` holds ids of other FAQ entries that
 * should be offered at the end of the answer.
 */
export const faqSchema = verifiedBase
  .extend({
    question: z
      .string({ error: "question is required" })
      .trim()
      .min(1, { error: "question is required" })
      .max(200, { error: "question must be 200 characters or fewer" }),
    answer: z
      .string({ error: "answer is required" })
      .trim()
      .min(1, { error: "answer is required" })
      .max(8000, { error: "answer must be 8000 characters or fewer" }),
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
    related: z
      .array(slugSchema, { error: "related must be a list of FAQ ids" })
      .max(12, { error: "related must contain 12 ids or fewer" }),
  })
  .strict()
  .superRefine((faq, ctx) => {
    if (faq.related.includes(faq.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["related"],
        message: "related must not point at the entry itself",
      });
    }
  });

export type Faq = z.infer<typeof faqSchema>;
