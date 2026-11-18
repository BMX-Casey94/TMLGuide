import { z } from "zod";
import { moneyEurSchema, verifiedBase } from "./common";

/**
 * A storage locker rented on site or in the accommodation zone. `size` is kept
 * as text because it is quoted as dimensions ("20 x 30 x 45 cm") rather than a
 * single nominal capacity. Prices are per locker for the period the record
 * describes; the period belongs in `notes`.
 */
export const lockerSchema = verifiedBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    size: z
      .string({ error: "size is required" })
      .trim()
      .min(1, { error: "size is required" })
      .max(80, { error: "size must be 80 characters or fewer" }),
    priceEur: moneyEurSchema,
    notes: z
      .string({ error: "notes are required" })
      .trim()
      .min(1, { error: "notes are required" })
      .max(600, { error: "notes must be 600 characters or fewer" }),
  })
  .strict();

export type Locker = z.infer<typeof lockerSchema>;
