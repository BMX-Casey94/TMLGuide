import { z } from "zod";
import { editionIdSchema, verifiedBase } from "./common";

/**
 * A stage or arena. Stages belong to one edition, so `edition` is narrowed from
 * the base scope to a concrete edition id: "all" is meaningless for a physical
 * stage.
 */
export const stageKindSchema = z.enum(
  ["mainstage", "open-air", "indoor", "club", "experience", "other"],
  {
    error:
      'kind must be "mainstage", "open-air", "indoor", "club", "experience" or "other"',
  },
);
export type StageKind = z.infer<typeof stageKindSchema>;

export const stageSchema = verifiedBase
  .extend({
    edition: editionIdSchema,
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    kind: stageKindSchema,
    description: z
      .string({ error: "description is required" })
      .trim()
      .min(1, { error: "description is required" })
      .max(1200, { error: "description must be 1200 characters or fewer" }),
  })
  .strict();

export type Stage = z.infer<typeof stageSchema>;
