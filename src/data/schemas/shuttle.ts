import { z } from "zod";
import { httpsUrlSchema, moneyEurSchema, verifiedBase } from "./common";

/**
 * A paid transfer to or from a festival site. `route` is free text ("City
 * centre to festival entrance") because routes are not uniform between
 * editions. `bookingUrl` is optional: a shuttle can be documented before its
 * booking page exists, but any link that is present must be https.
 */
export const shuttleSchema = verifiedBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    route: z
      .string({ error: "route is required" })
      .trim()
      .min(1, { error: "route is required" })
      .max(200, { error: "route must be 200 characters or fewer" }),
    priceEur: moneyEurSchema,
    operator: z
      .string({ error: "operator is required" })
      .trim()
      .min(1, { error: "operator is required" })
      .max(120, { error: "operator must be 120 characters or fewer" }),
    notes: z
      .string({ error: "notes are required" })
      .trim()
      .min(1, { error: "notes are required" })
      .max(600, { error: "notes must be 600 characters or fewer" }),
    bookingUrl: httpsUrlSchema.optional(),
  })
  .strict();

export type Shuttle = z.infer<typeof shuttleSchema>;
