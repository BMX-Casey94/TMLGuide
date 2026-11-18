import { z } from "zod";
import { moneyEurSchema, verifiedBase } from "./common";

/**
 * A ticket or package product: a day pass, a weekend pass, a DreamVille
 * package or a hospitality product. `priceEur` is the advertised total for the
 * product as sold (a two-person package carries the two-person total), stored
 * in euros. `nights` is 0 for a pass that includes no overnight stay.
 */
export const ticketTierSchema = z.enum(["regular", "comfort", "premium", "hospitality"], {
  error: 'tier must be "regular", "comfort", "premium" or "hospitality"',
});
export type TicketTier = z.infer<typeof ticketTierSchema>;

export const ticketPackageSchema = verifiedBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    tier: ticketTierSchema,
    nights: z
      .int({ error: "nights must be a whole number" })
      .min(0, { error: "nights must not be negative" })
      .max(30, { error: "nights must be 30 or fewer" }),
    priceEur: moneyEurSchema,
    includes: z
      .array(
        z
          .string({ error: "each inclusion must be text" })
          .trim()
          .min(1, { error: "an inclusion must not be empty" })
          .max(200, { error: "an inclusion must be 200 characters or fewer" }),
        { error: "includes must be a list of inclusions" },
      )
      .min(1, { error: "includes must list at least one inclusion" })
      .max(40, { error: "includes must list 40 inclusions or fewer" }),
    notes: z
      .string()
      .trim()
      .min(1, { error: "notes must not be empty when present" })
      .max(600, { error: "notes must be 600 characters or fewer" })
      .optional(),
  })
  .strict();

export type TicketPackage = z.infer<typeof ticketPackageSchema>;
