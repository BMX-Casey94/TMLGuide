import { z } from "zod";
import { httpsUrlSchema, verifiedBase } from "./common";

/**
 * A commercial partner: a travel agent, a gear shop, a transfer company.
 *
 * Partner records are the only place on the site where an outbound link may
 * earn money, so `disclosure` is mandatory rather than optional and must carry
 * at least 20 characters: a commercial relationship has to be stated in a full
 * sentence next to the link, and the minimum length stops a single filler word
 * from passing as a disclosure.
 */
export const partnerSchema = verifiedBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    url: httpsUrlSchema,
    offer: z
      .string({ error: "offer is required" })
      .trim()
      .min(1, { error: "offer is required" })
      .max(200, { error: "offer must be 200 characters or fewer" }),
    promoCode: z
      .string()
      .trim()
      .min(1, { error: "promoCode must not be empty when present" })
      .max(40, { error: "promoCode must be 40 characters or fewer" })
      .optional(),
    disclosure: z
      .string({ error: "disclosure is required" })
      .trim()
      .min(20, { error: "disclosure must be at least 20 characters" })
      .max(400, { error: "disclosure must be 400 characters or fewer" }),
  })
  .strict();

export type Partner = z.infer<typeof partnerSchema>;
