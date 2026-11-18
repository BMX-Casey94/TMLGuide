import { z } from "zod";
import { moneyEurSchema, verifiedBase } from "./common";

/**
 * A prepaid bundle of Pearls, the cashless currency used inside the festival. * `pearls` is a whole number because a fraction of a Pearl cannot be loaded,
 * and `priceEur` is the amount charged for the bundle: the effective Pearl rate
 * is derived from the pair rather than stored separately, so the two can never
 * disagree.
 */
export const pearlBundleSchema = verifiedBase
  .extend({
    pearls: z
      .int({ error: "pearls must be a whole number" })
      .min(1, { error: "pearls must be at least 1" })
      .max(100_000, { error: "pearls must be 100000 or fewer" }),
    priceEur: moneyEurSchema,
  })
  .strict();

export type PearlBundle = z.infer<typeof pearlBundleSchema>;
