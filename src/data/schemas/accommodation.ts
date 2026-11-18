import { z } from "zod";
import { moneyEurSchema, verifiedBase } from "./common";

/**
 * A place to sleep, from a bring-your-own tent pitch to a hotel room.
 * `pricing` says whether `nightlyOrTotalEur` is the price of one night or of
 * the whole stay, so a UI can label the figure correctly without guessing.
 */
export const accommodationKindSchema = z.enum(
  ["dreamville-tent", "dreamville-lodge", "hotel", "camping", "other"],
  {
    error:
      'kind must be "dreamville-tent", "dreamville-lodge", "hotel", "camping" or "other"',
  },
);
export type AccommodationKind = z.infer<typeof accommodationKindSchema>;

export const accommodationPricingSchema = z.enum(["per-night", "per-stay"], {
  error: 'pricing must be "per-night" or "per-stay"',
});
export type AccommodationPricing = z.infer<typeof accommodationPricingSchema>;

export const accommodationSchema = verifiedBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    kind: accommodationKindSchema,
    nightlyOrTotalEur: moneyEurSchema,
    pricing: accommodationPricingSchema,
    capacity: z
      .int({ error: "capacity must be a whole number of people" })
      .min(1, { error: "capacity must be at least one person" })
      .max(100, { error: "capacity must be 100 people or fewer" }),
    notes: z
      .string({ error: "notes are required" })
      .trim()
      .min(1, { error: "notes are required" })
      .max(600, { error: "notes must be 600 characters or fewer" }),
  })
  .strict();

export type Accommodation = z.infer<typeof accommodationSchema>;
