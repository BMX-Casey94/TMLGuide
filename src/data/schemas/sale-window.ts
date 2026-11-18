import { z } from "zod";
import { isoInstantSchema, verifiedBase } from "./common";

/**
 * A dated moment when tickets, packages or add-ons go on sale.
 *
 * `opensAt` must carry an explicit UTC offset so a sale cannot be rendered in
 * the reader's own zone by accident. `timeZone` is pinned to
 * "Europe/Brussels" because every sale time the festival publishes is quoted
 * in Belgian local time.
 *
 * `audience` is free text because the groups that get early access change year
 * to year (general sale, pre-sale, waiting list, hospitality, invited
 * communities). It is a short human-readable label rendered beside the date,
 * so "General sale" and "Pre-sale, registration required" both belong here.
 */
export const saleWindowSchema = verifiedBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    opensAt: isoInstantSchema,
    timeZone: z.literal("Europe/Brussels", {
      error: 'timeZone must be "Europe/Brussels"',
    }),
    audience: z
      .string({ error: "audience is required" })
      .trim()
      .min(1, { error: "audience is required" })
      .max(120, { error: "audience must be 120 characters or fewer" }),
    notes: z
      .string()
      .trim()
      .min(1, { error: "notes must not be empty when present" })
      .max(600, { error: "notes must be 600 characters or fewer" })
      .optional(),
  })
  .strict();

export type SaleWindow = z.infer<typeof saleWindowSchema>;
