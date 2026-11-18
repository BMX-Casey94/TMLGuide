import { z } from "zod";
import { moneyEurSchema, verifiedBase } from "./common";

/**
 * Something bought on top of a ticket: a dining experience, parking, a
 * breakfast package or a rental. `category` groups items on the add-ons page,
 * so it stays a closed enum that a UI can switch on exhaustively.
 */
export const addOnCategorySchema = z.enum(
  ["dining", "parking", "breakfast", "drinks", "experience", "rental", "transport", "other"],
  {
    error:
      'category must be "dining", "parking", "breakfast", "drinks", "experience", "rental", "transport" or "other"',
  },
);
export type AddOnCategory = z.infer<typeof addOnCategorySchema>;

export const addOnSchema = verifiedBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    priceEur: moneyEurSchema,
    category: addOnCategorySchema,
  })
  .strict();

export type AddOn = z.infer<typeof addOnSchema>;
