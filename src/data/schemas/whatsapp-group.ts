import { z } from "zod";
import { httpsUrlSchema, isoDateSchema, verifiedBase } from "./common";

/**
 * A community chat group run by attendees, not by the festival.
 *
 * Invite links rot faster than anything else on a guide, so every group carries
 * a `linkStatus` (defaulting to "unchecked", never to "ok") and an optional
 * `lastLinkCheck` recording when a human last opened the invite. The invite URL
 * must be https: the old site listed groups over plain http, and that is
 * exactly what the new data layer refuses.
 */
export const whatsappLinkStatusSchema = z.enum(["ok", "dead", "unchecked"], {
  error: 'linkStatus must be "ok", "dead" or "unchecked"',
});
export type WhatsappLinkStatus = z.infer<typeof whatsappLinkStatusSchema>;

export const whatsappGroupSchema = verifiedBase
  .extend({
    title: z
      .string({ error: "title is required" })
      .trim()
      .min(1, { error: "title is required" })
      .max(120, { error: "title must be 120 characters or fewer" }),
    region: z
      .string({ error: "region is required" })
      .trim()
      .min(1, { error: "region is required" })
      .max(80, { error: "region must be 80 characters or fewer" }),
    inviteUrl: httpsUrlSchema,
    lastLinkCheck: isoDateSchema.optional(),
    linkStatus: whatsappLinkStatusSchema.default("unchecked"),
  })
  .strict();

export type WhatsappGroup = z.infer<typeof whatsappGroupSchema>;
